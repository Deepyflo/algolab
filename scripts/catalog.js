const STORAGE_CODE = 'algolab-code-v2';
const STORAGE_DONE = 'algolab-done-v2';
const STORAGE_METRICS = 'algolab-exam-metrics-v1';
const GROUPS = ['warmup', 'drill', 'simulation'];
const GROUP_LABELS = { custom: '00 — Mes exercices', warmup: '01 — Warmup', drill: '02 — Drill', simulation: '03 — Simulation' };

export async function loadExercises() {
  const response = await fetch('./api/exercises');
  if (!response.ok) throw new Error('Impossible de lire la base des exercices. Lance le site avec python3 server.py.');
  return response.json();
}

export async function readExerciseDatabase() {
  const response = await fetch('./api/exercises');
  if (!response.ok) throw new Error('Impossible de lire la base des exercices.');
  return response.json();
}

async function sendCustomRequest(url, method, payload) {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: payload ? JSON.stringify(payload) : undefined
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `Erreur de sauvegarde (${response.status})`);
  return result;
}

export function saveCustomExercise(exercise) {
  return sendCustomRequest('./api/exercises', 'POST', exercise);
}
export function updateCustomExercise(id, exercise) {
  return sendCustomRequest(`./api/exercises/${encodeURIComponent(id)}`, 'PUT', exercise);
}
export function deleteCustomExercise(id) {
  return sendCustomRequest(`./api/exercises/${encodeURIComponent(id)}`, 'DELETE');
}
export function importCustomExercises(exercises) {
  return sendCustomRequest('./api/exercises/import', 'POST', exercises);
}

export function readProgress() {
  return {
    code: JSON.parse(localStorage.getItem(STORAGE_CODE) || '{}'),
    done: JSON.parse(localStorage.getItem(STORAGE_DONE) || '{}'),
    metrics: JSON.parse(localStorage.getItem(STORAGE_METRICS) || '{}')
  };
}

export function saveCode(code) { localStorage.setItem(STORAGE_CODE, JSON.stringify(code)); }
export function saveDone(done) { localStorage.setItem(STORAGE_DONE, JSON.stringify(done)); }
export function saveMetrics(metrics) { localStorage.setItem(STORAGE_METRICS, JSON.stringify(metrics)); }

export function renderNavigation({ exercises, current, done, query, onSelect }) {
  const nav = document.querySelector('#nav');
  nav.replaceChildren();
  for (const group of ['custom', ...GROUPS]) {
    const matches = exercises.filter(ex => ex.folder === group &&
      `${ex.name} ${ex.statement}`.toLowerCase().includes(query.toLowerCase()));
    if (!matches.length) continue;
    const heading = document.createElement('div');
    heading.className = 'group';
    heading.textContent = GROUP_LABELS[group];
    nav.append(heading);
    for (const ex of matches) {
      const item = document.createElement('div');
      item.className = `item${current?.id === ex.id ? ' active' : ''}${done[ex.id] ? ' done' : ''}`;
      const dot = document.createElement('span'); dot.className = 'dot';
      const name = document.createElement('span'); name.className = 'name'; name.textContent = ex.name;
      item.append(dot, name);
      if (done[ex.id]) { const check = document.createElement('span'); check.className = 'check'; check.textContent = '✓'; item.append(check); }
      item.addEventListener('click', () => onSelect(ex));
      nav.append(item);
    }
  }
}
