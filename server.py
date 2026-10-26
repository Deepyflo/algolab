"""Serve AlgoLab et fournit une petite API pour sa base JSON locale."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock
from urllib.parse import unquote, urlsplit
import json
import math
import os
import tempfile
import uuid

ROOT = Path(__file__).resolve().parent
DATABASE = ROOT / "data" / "exercises.json"
EXAM_HISTORY_DATABASE = ROOT / "data" / "exam-history.json"
DB_LOCK = Lock()
MAX_BODY = 2_000_000


def read_database():
    if not DATABASE.exists():
        return []
    try:
        value = json.loads(DATABASE.read_text(encoding="utf-8"))
        return value if isinstance(value, list) else []
    except (OSError, json.JSONDecodeError) as error:
        raise RuntimeError(f"La base JSON est illisible : {error}") from error


def write_database(exercises):
    DATABASE.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix="exercises-", suffix=".json", dir=DATABASE.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(exercises, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
        os.replace(temp_name, DATABASE)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)


def read_exam_history():
    if not EXAM_HISTORY_DATABASE.exists():
        # The writable history is intentionally local and ignored by Git.
        # Recreate it from an empty baseline whenever a fresh checkout starts.
        write_exam_history([])
    try:
        value = json.loads(EXAM_HISTORY_DATABASE.read_text(encoding="utf-8"))
        return value if isinstance(value, list) else []
    except (OSError, json.JSONDecodeError) as error:
        raise RuntimeError(f"L’historique des examens est illisible : {error}") from error


def write_exam_history(history):
    EXAM_HISTORY_DATABASE.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix="exam-history-", suffix=".json", dir=EXAM_HISTORY_DATABASE.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(history, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
        os.replace(temp_name, EXAM_HISTORY_DATABASE)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)


def validate_exam_record(payload):
    if not isinstance(payload, dict):
        raise ValueError("La simulation doit être un objet JSON.")
    if not isinstance(payload.get("id"), str) or not payload["id"].strip():
        raise ValueError("Identifiant de simulation invalide.")
    for key in ("startedAt", "finishedAt"):
        if not isinstance(payload.get(key), str) or not payload[key].strip():
            raise ValueError(f"Date {key} invalide.")
    for key in ("durationMs", "elapsedMs", "passed", "total"):
        if not isinstance(payload.get(key), int) or isinstance(payload[key], bool) or payload[key] < 0:
            raise ValueError(f"Valeur {key} invalide.")
    percent = payload.get("percent")
    if not isinstance(percent, (int, float)) or isinstance(percent, bool) or not math.isfinite(percent) or not 0 <= percent <= 100:
        raise ValueError("Taux de réussite invalide.")
    if not isinstance(payload.get("qualified"), bool) or payload.get("reason") not in {"completed", "manual", "timeout"}:
        raise ValueError("Résultat de simulation invalide.")
    exercises = payload.get("exercises")
    if not isinstance(exercises, list) or len(exercises) != 5:
        raise ValueError("Une simulation doit contenir cinq exercices.")
    for exercise in exercises:
        if not isinstance(exercise, dict):
            raise ValueError("Exercice invalide dans la simulation.")
        for key in ("exerciseId", "name"):
            if not isinstance(exercise.get(key), str) or not exercise[key].strip():
                raise ValueError(f"Champ {key} manquant dans la simulation.")
        for key in ("passed", "total"):
            if not isinstance(exercise.get(key), int) or isinstance(exercise[key], bool) or exercise[key] < 0:
                raise ValueError(f"Valeur {key} invalide pour un exercice.")
        exercise_percent = exercise.get("percent")
        if exercise["passed"] > exercise["total"] or not isinstance(exercise_percent, (int, float)) or isinstance(exercise_percent, bool) or not math.isfinite(exercise_percent) or not 0 <= exercise_percent <= 100:
            raise ValueError("Score invalide pour un exercice.")
        if not isinstance(exercise.get("qualified"), bool):
            raise ValueError("Statut de réussite invalide pour un exercice.")
        code = exercise.get("submittedCode")
        if code is not None and not isinstance(code, str):
            raise ValueError("Le code soumis doit être du texte.")


def validate_exercise(payload):
    if not isinstance(payload, dict):
        raise ValueError("L’exercice doit être un objet JSON.")
    for key in ("title", "statement", "code"):
        if not isinstance(payload.get(key), str) or not payload[key].strip():
            raise ValueError(f"Le champ {key} est obligatoire.")
    cases = payload.get("cases")
    if not isinstance(cases, list) or not cases:
        raise ValueError("Ajoute au moins un cas de test.")
    for case in cases:
        if not isinstance(case, dict) or not all(isinstance(case.get(key), str) and case[key].strip() for key in ("label", "expr")) or "expected" not in case:
            raise ValueError("Chaque test doit contenir un nom, un appel Python et un résultat attendu.")


class AlgoLabHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_json(self, status, value):
        body = json.dumps(value, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def read_json_body(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > MAX_BODY:
            raise ValueError("Taille de requête invalide.")
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/api/exam-history":
            try:
                with DB_LOCK:
                    return self.send_json(200, read_exam_history())
            except RuntimeError as error:
                return self.send_json(500, {"error": str(error)})
        if path == "/api/exercises":
            try:
                with DB_LOCK:
                    return self.send_json(200, read_database())
            except RuntimeError as error:
                return self.send_json(500, {"error": str(error)})
        return super().do_GET()

    def do_POST(self):
        path = urlsplit(self.path).path
        if path == "/api/exam-history":
            try:
                record = self.read_json_body()
                validate_exam_record(record)
                with DB_LOCK:
                    history = read_exam_history()
                    if any(item.get("id") == record["id"] for item in history):
                        return self.send_json(409, {"error": "Cette simulation figure déjà dans l’historique."})
                    history.append(record)
                    write_exam_history(history)
                return self.send_json(201, record)
            except OSError as error:
                return self.send_json(500, {"error": f"Impossible d’écrire l’historique des examens : {error}"})
            except (ValueError, json.JSONDecodeError, UnicodeDecodeError, RuntimeError) as error:
                return self.send_json(400, {"error": str(error)})
        if path == "/api/exercises/import":
            try:
                imported = self.read_json_body()
                if not isinstance(imported, list):
                    raise ValueError("L’import doit être une liste d’exercices.")
                for exercise in imported:
                    validate_exercise(exercise)
                with DB_LOCK:
                    exercises = read_database()
                    existing = {item.get("id"): index for index, item in enumerate(exercises)}
                    added = 0
                    updated_count = 0
                    for item in imported:
                        exercise_id = item.get("id")
                        if not isinstance(exercise_id, str):
                            exercise_id = f"custom/{uuid.uuid4()}"
                        title = item["title"].strip()
                        folder = item.get("folder", "custom")
                        if folder not in {"custom", "warmup", "drill", "simulation"}:
                            folder = "custom"
                        normalized = {
                            **item,
                            "id": exercise_id, "folder": folder, "name": title,
                            "title": title, "statement": item["statement"].strip(),
                            "code": item["code"], "cases": item["cases"],
                            "custom": bool(item.get("custom", folder == "custom")),
                        }
                        if exercise_id in existing:
                            exercises[existing[exercise_id]] = normalized
                            updated_count += 1
                        else:
                            exercises.insert(0, normalized)
                            existing = {entry.get("id"): index for index, entry in enumerate(exercises)}
                            added += 1
                    write_database(exercises)
                return self.send_json(200, {"imported": added, "updated": updated_count, "total": len(imported)})
            except (ValueError, json.JSONDecodeError, UnicodeDecodeError, RuntimeError) as error:
                return self.send_json(400, {"error": str(error)})
        if path != "/api/exercises":
            return self.send_error(404, "Route introuvable")
        try:
            exercise = self.read_json_body()
            validate_exercise(exercise)
            exercise = {
                "id": f"custom/{uuid.uuid4()}",
                "folder": "custom",
                "name": exercise["title"].strip(),
                "title": exercise["title"].strip(),
                "statement": exercise["statement"].strip(),
                "code": exercise["code"],
                "cases": exercise["cases"],
                "custom": True,
            }
            with DB_LOCK:
                exercises = read_database()
                exercises.insert(0, exercise)
                write_database(exercises)
            return self.send_json(201, exercise)
        except (ValueError, json.JSONDecodeError, UnicodeDecodeError, RuntimeError) as error:
            return self.send_json(400, {"error": str(error)})

    def do_PUT(self):
        path = urlsplit(self.path).path
        prefix = "/api/exercises/"
        if not path.startswith(prefix):
            return self.send_error(404, "Route introuvable")
        exercise_id = unquote(path[len(prefix):])
        try:
            payload = self.read_json_body()
            validate_exercise(payload)
            with DB_LOCK:
                exercises = read_database()
                index = next((i for i, item in enumerate(exercises) if item.get("id") == exercise_id), None)
                if index is None:
                    return self.send_json(404, {"error": "Exercice introuvable."})
                updated = {
                    **exercises[index],
                    "name": payload["title"].strip(),
                    "title": payload["title"].strip(),
                    "statement": payload["statement"].strip(),
                    "code": payload["code"],
                    "cases": payload["cases"],
                }
                exercises[index] = updated
                write_database(exercises)
            return self.send_json(200, updated)
        except (ValueError, json.JSONDecodeError, UnicodeDecodeError, RuntimeError) as error:
            return self.send_json(400, {"error": str(error)})

    def do_DELETE(self):
        path = urlsplit(self.path).path
        history_prefix = "/api/exam-history/"
        if path.startswith(history_prefix):
            record_id = unquote(path[len(history_prefix):]).strip()
            if not record_id:
                return self.send_json(400, {"error": "Identifiant de simulation manquant."})
            try:
                with DB_LOCK:
                    history = read_exam_history()
                    remaining = [item for item in history if item.get("id") != record_id]
                    if len(remaining) == len(history):
                        return self.send_json(404, {"error": "Simulation introuvable dans l’historique."})
                    write_exam_history(remaining)
                return self.send_json(200, {"deleted": record_id})
            except OSError as error:
                return self.send_json(500, {"error": f"Impossible de mettre à jour l’historique : {error}"})
            except RuntimeError as error:
                return self.send_json(500, {"error": str(error)})
        prefix = "/api/exercises/"
        if not path.startswith(prefix):
            return self.send_error(404, "Route introuvable")
        exercise_id = unquote(path[len(prefix):])
        try:
            with DB_LOCK:
                exercises = read_database()
                remaining = [item for item in exercises if item.get("id") != exercise_id]
                if len(remaining) == len(exercises):
                    return self.send_json(404, {"error": "Exercice introuvable."})
                write_database(remaining)
        except RuntimeError as error:
            return self.send_json(500, {"error": str(error)})
        return self.send_json(200, {"deleted": exercise_id})


def main():
    address = ("127.0.0.1", 8000)
    with DB_LOCK:
        read_exam_history()
    server = ThreadingHTTPServer(address, AlgoLabHandler)
    print(f"AlgoLab est disponible sur http://localhost:{address[1]}")
    print(f"Base JSON : {DATABASE}")
    print(f"Historique des examens : {EXAM_HISTORY_DATABASE}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nArrêt du serveur AlgoLab.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
