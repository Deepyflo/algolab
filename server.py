"""Serve AlgoLab et fournit une petite API pour sa base JSON locale."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock
from urllib.parse import unquote, urlsplit
import json
import os
import tempfile
import uuid

ROOT = Path(__file__).resolve().parent
DATABASE = ROOT / "data" / "exercises.json"
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
        if urlsplit(self.path).path == "/api/exercises":
            try:
                with DB_LOCK:
                    return self.send_json(200, read_database())
            except RuntimeError as error:
                return self.send_json(500, {"error": str(error)})
        return super().do_GET()

    def do_POST(self):
        path = urlsplit(self.path).path
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
    server = ThreadingHTTPServer(address, AlgoLabHandler)
    print(f"AlgoLab est disponible sur http://localhost:{address[1]}")
    print(f"Base JSON : {DATABASE}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nArrêt du serveur AlgoLab.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
