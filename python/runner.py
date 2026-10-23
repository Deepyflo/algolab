"""Exécute un exercice, capture ses sorties et mesure temps et mémoire Python."""
import contextlib
import gc
import json
import sys
import time
import tracemalloc


class MemoryLimitExceeded(Exception):
    pass


class BoundedOutput:
    """Capture stdout/stderr sans laisser des prints volumineux épuiser la mémoire."""
    LIMIT = 32_000

    def __init__(self):
        self.parts = []
        self.length = 0
        self.truncated = False

    def write(self, value):
        value = str(value)
        remaining = self.LIMIT - self.length
        if remaining > 0:
            piece = value[:remaining]
            self.parts.append(piece)
            self.length += len(piece)
        if len(value) > max(remaining, 0):
            self.truncated = True
        return len(value)

    def flush(self):
        pass

    def getvalue(self):
        output = "".join(self.parts)
        if self.truncated:
            output += "\n… sortie tronquée après 32 000 caractères …\n"
        return output


def run_exercise(payload_json, complexity_json=None):
    payload = json.loads(payload_json)
    namespace = {}
    results = []
    stdout = BoundedOutput()
    stderr = BoundedOutput()
    memory_limit = int(payload.get("memoryLimitMB", 128)) * 1024 * 1024
    gc.collect()
    if not tracemalloc.is_tracing():
        tracemalloc.start()
    else:
        tracemalloc.reset_peak()
    baseline, _ = tracemalloc.get_traced_memory()
    start = time.perf_counter()
    status = "Accepted"

    def memory_guard(frame, event, arg):
        if event == "line" and frame.f_globals is namespace:
            _, peak = tracemalloc.get_traced_memory()
            if peak - baseline > memory_limit:
                raise MemoryLimitExceeded()
        return memory_guard

    sys.settrace(memory_guard)
    try:
        try:
            with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
                exec(payload["code"], namespace)
        except MemoryLimitExceeded:
            status = "Memory Limit Exceeded"
            results.append({"ok": False, "label": status, "got": f"Limite Python de {payload.get('memoryLimitMB', 128)} MB dépassée", "expected": ""})
        except Exception as error:
            status = "Runtime Error"
            results.append({"ok": False, "label": "Erreur de syntaxe ou exécution", "got": f"{type(error).__name__}: {error}", "expected": ""})
        else:
            for case in payload["cases"]:
                try:
                    with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
                        actual = eval(case["expr"], namespace)
                    _, peak = tracemalloc.get_traced_memory()
                    if peak - baseline > memory_limit:
                        raise MemoryLimitExceeded()
                    ok = actual == case["expected"] and type(actual) is type(case["expected"])
                    results.append({"ok": ok, "label": case["label"], "got": repr(actual), "expected": repr(case["expected"])})
                except MemoryLimitExceeded:
                    status = "Memory Limit Exceeded"
                    results.append({"ok": False, "label": status, "got": f"Limite Python de {payload.get('memoryLimitMB', 128)} MB dépassée", "expected": ""})
                    break
                except Exception as error:
                    results.append({"ok": False, "label": case["label"], "got": f"{type(error).__name__}: {error}", "expected": repr(case["expected"])})
    finally:
        sys.settrace(None)

    elapsed_ms = (time.perf_counter() - start) * 1000
    _, peak = tracemalloc.get_traced_memory()
    peak_bytes = max(0, peak - baseline)
    if status == "Accepted" and peak_bytes > memory_limit:
        status = "Memory Limit Exceeded"
    try:
        complexity = json.loads(complexity_json) if complexity_json else {
            "order": "Indéterminée",
            "confidence": "—",
            "explanation": "Analyse de complexité indisponible.",
        }
    except (TypeError, ValueError):
        complexity = {"order": "Indéterminée", "confidence": "—", "explanation": "Résultat d’analyse illisible."}
    return json.dumps({
        "results": results,
        "stdout": stdout.getvalue(),
        "stderr": stderr.getvalue(),
        "elapsedMs": elapsed_ms,
        "peakBytes": peak_bytes,
        "memoryLimitMB": payload.get("memoryLimitMB", 128),
        "status": status,
        "complexity": complexity,
    }, ensure_ascii=False)
