const HISTORY_API = './api/exam-history';

export async function loadExamHistory() {
  const response = await fetch(HISTORY_API);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'Impossible de charger l’historique des examens.');
  return payload;
}

export async function saveExamRun(record) {
  const response = await fetch(HISTORY_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
    keepalive: true,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'Impossible d’enregistrer cette simulation.');
  return payload;
}
