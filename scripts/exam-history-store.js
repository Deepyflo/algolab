const HISTORY_API = './api/exam-history';

async function readJsonResponse(response, fallbackMessage) {
  const body = await response.text();
  let payload;
  try {
    payload = body ? JSON.parse(body) : null;
  } catch {
    throw new Error(
      `Le serveur a renvoyé une réponse non JSON (HTTP ${response.status}). ` +
      'Redémarre AlgoLab avec server.py depuis le dossier du projet.'
    );
  }
  if (!response.ok) throw new Error(payload?.error || fallbackMessage);
  return payload;
}

export async function loadExamHistory() {
  const response = await fetch(HISTORY_API);
  return readJsonResponse(response, 'Impossible de charger l’historique des examens.');
}

export async function saveExamRun(record) {
  const response = await fetch(HISTORY_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
    keepalive: true,
  });
  return readJsonResponse(response, 'Impossible d’enregistrer cette simulation.');
}

export async function deleteExamRun(id) {
  const response = await fetch(`${HISTORY_API}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return readJsonResponse(response, 'Impossible de supprimer cette simulation.');
}
