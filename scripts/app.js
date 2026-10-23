import { loadExercises, readProgress, saveCode, saveDone, saveMetrics, renderNavigation } from './catalog.js';
import { executeExercise } from './runner.js';
import { createEditor } from './editor.js';
import { formatDuration, minimumPassingCount, TARGET_PERCENT } from './exam.js';

const $ = selector => document.querySelector(selector);
const progress = readProgress();
let exercises = [];
let current = null;

const editor = createEditor($('#editor'), '', value => {
  if (!current) return;
  progress.code[current.id] = value;
  saveCode(progress.code);
});

function metricFor(id) {
  if (!progress.metrics[id]) progress.metrics[id] = { elapsedMs: 0, startedAt: null, score: null };
  return progress.metrics[id];
}

function renderNav() {
  renderNavigation({ exercises, current, done: progress.done, query: $('#search').value, onSelect: selectExercise });
}

function updateTimerDisplay() {
  if (!current) return;
  const metric = metricFor(current.id);
  const elapsed = metric.elapsedMs + (metric.startedAt ? Date.now() - metric.startedAt : 0);
  $('#timer').textContent = formatDuration(elapsed);
  $('#timerToggle').textContent = metric.startedAt ? 'Pause' : (elapsed ? 'Reprendre' : 'Démarrer');
  $('#timerToggle').classList.toggle('is-running', Boolean(metric.startedAt));
}

function updateScoreDisplay(exercise) {
  const total = exercise.cases.length;
  const required = minimumPassingCount(total);
  const result = metricFor(exercise.id).score;
  const badge = $('#score');
  badge.classList.remove('score-pass', 'score-fail');
  badge.title = `Pour dépasser strictement ${TARGET_PERCENT} %, il faut au moins ${required} test${required > 1 ? 's' : ''} réussi${required > 1 ? 's' : ''} sur ${total}.`;
  if (!result) {
    badge.textContent = `Cible ${required}/${total}`;
    return;
  }
  const qualified = result.percent > TARGET_PERCENT;
  badge.textContent = `${Math.round(result.percent)} % · ${result.passed}/${result.total}`;
  badge.classList.add(qualified ? 'score-pass' : 'score-fail');
  badge.title += qualified ? ' Seuil atteint.' : ' Seuil non atteint.';
}

function pauseTimer(id) {
  const metric = metricFor(id);
  if (!metric.startedAt) return;
  metric.elapsedMs += Date.now() - metric.startedAt;
  metric.startedAt = null;
  saveMetrics(progress.metrics);
  if (current?.id === id) updateTimerDisplay();
}

function selectExercise(exercise) {
  if (current?.id === exercise.id) return;
  if (current) {
    pauseTimer(current.id);
    progress.code[current.id] = editor.getValue();
    saveCode(progress.code);
  }
  current = exercise;
  const challenge = exercise.id.match(/challenge_(\d+)/)?.[1];
  $('#title').textContent = challenge ? `Challenge ${challenge}` : exercise.title;
  $('#crumb').textContent = exercise.folder.toUpperCase();
  $('#tag').textContent = exercise.folder === 'simulation' ? 'Sans indice · simulation' :
    exercise.folder === 'drill' ? 'Pattern · entraînement' : 'Pattern · échauffement';
  $('#desc').textContent = exercise.statement;
  $('#filename').textContent = `${exercise.id.replace('/', '_')}.py`;
  editor.setValue(progress.code[exercise.id] ?? exercise.code);
  $('#console').textContent = `Prêt à lancer les ${exercise.cases.length} tests de cet exercice.`;
  $('#summary').textContent = `${exercise.cases.length} tests`;
  $('#status').textContent = 'Prêt';
  updateTimerDisplay();
  updateScoreDisplay(exercise);
  renderNav();
}

function showResults(execution, total) {
  const results = execution.results;
  const passed = results.filter(result => result.ok).length;
  const consolePanel = $('#console');
  consolePanel.replaceChildren();
  const metrics = document.createElement('div');
  metrics.className = 'execution-metrics';
  const addMetric = (label, value, detail = '') => {
    const card = document.createElement('div');
    card.className = 'execution-metric';
    const name = document.createElement('span'); name.textContent = label;
    const main = document.createElement('strong'); main.textContent = value;
    card.append(name, main);
    if (detail) { const note = document.createElement('small'); note.textContent = detail; card.append(note); }
    metrics.append(card);
  };
  const duration = execution.elapsedMs < 1000 ? `${execution.elapsedMs.toFixed(1)} ms` : `${(execution.elapsedMs / 1000).toFixed(2)} s`;
  const memory = execution.peakBytes == null ? '—' : `${(execution.peakBytes / 1048576).toFixed(2)} MB`;
  addMetric('Statut', execution.status || 'Terminé');
  addMetric('Temps d’exécution', duration);
  addMetric('Mémoire Python · pic estimé', memory, `Limite ${execution.memoryLimitMB} MB · hors moteur Pyodide`);
  const complexity = execution.complexity;
  addMetric('Complexité estimée', complexity?.order || 'Indéterminée', complexity ? `${complexity.confidence} · ${complexity.explanation}` : 'Analyse indisponible');
  consolePanel.append(metrics);
  const appendOutput = (label, content, className) => {
    const safeContent = typeof content === 'string' ? content : String(content ?? '');
    if (!safeContent) return;
    const section = document.createElement('section');
    section.className = 'console-output-section';
    const heading = document.createElement('div');
    heading.className = 'console-output-label';
    heading.textContent = label;
    const output = document.createElement('pre');
    output.className = `console-output ${className}`;
    output.textContent = safeContent.replace(/\n$/, '');
    section.append(heading, output);
    consolePanel.append(section);
  };
  appendOutput('stdout · print()', execution.stdout, 'stdout');
  appendOutput('stderr', execution.stderr, 'stderr');
  const testHeading = document.createElement('div');
  testHeading.className = 'console-output-label test-results-label';
  testHeading.textContent = 'Résultats des tests';
  consolePanel.append(testHeading);
  for (const result of results) {
    const row = document.createElement('div');
    row.className = result.ok ? 'pass' : 'fail';
    row.textContent = `${result.ok ? '✓' : '✗'} ${result.label}${result.ok ? '' : ` — reçu ${result.got} · attendu ${result.expected}`}`;
    consolePanel.append(row);
  }
  const percent = total ? passed / total * 100 : 0;
  const qualified = percent > TARGET_PERCENT;
  metricFor(current.id).score = { passed, total, percent };
  saveMetrics(progress.metrics);
  updateScoreDisplay(current);
  $('#summary').textContent = `${passed}/${total} · ${Math.round(percent)} %${qualified ? ' · seuil atteint' : ' · seuil non atteint'}`;
  $('#status').textContent = execution.status === 'Time Limit Exceeded' ? 'Time Limit Exceeded' : execution.status === 'Memory Limit Exceeded' ? 'Memory Limit Exceeded' : qualified ? 'Seuil de réussite atteint' : 'Exécution terminée';
  if (passed === total && total && execution.status === 'Accepted') {
    progress.done[current.id] = true;
    saveDone(progress.done);
    renderNav();
  }
}

$('#search').addEventListener('input', renderNav);
$('#timerToggle').addEventListener('click', () => {
  if (!current) return;
  const metric = metricFor(current.id);
  if (metric.startedAt) pauseTimer(current.id);
  else {
    metric.startedAt = Date.now();
    saveMetrics(progress.metrics);
    updateTimerDisplay();
  }
});
$('#timerReset').addEventListener('click', () => {
  if (!current) return;
  progress.metrics[current.id] = { elapsedMs: 0, startedAt: null, score: metricFor(current.id).score };
  saveMetrics(progress.metrics);
  updateTimerDisplay();
});
$('#reset').addEventListener('click', () => {
  if (!current) return;
  delete progress.code[current.id];
  saveCode(progress.code);
  editor.setValue(current.code);
  $('#status').textContent = 'Code initial restauré';
});
$('#clearSubmissions').addEventListener('click', () => {
  const confirmed = window.confirm(
    'Effacer les soumissions de tous les exercices ? Cela supprimera les brouillons enregistrés, les résultats, les validations et les chronos. Les énoncés resteront intacts.'
  );
  if (!confirmed) return;

  progress.code = {};
  progress.done = {};
  progress.metrics = {};
  saveCode(progress.code);
  saveDone(progress.done);
  saveMetrics(progress.metrics);

  if (current) {
    editor.setValue(current.code);
    $('#console').textContent = `Prêt à lancer les ${current.cases.length} tests de cet exercice.`;
    $('#summary').textContent = `${current.cases.length} tests`;
    $('#status').textContent = 'Toutes les soumissions ont été effacées';
    updateTimerDisplay();
    updateScoreDisplay(current);
  }
  renderNav();
});
$('#run').addEventListener('click', async () => {
  if (!current) return;
  const button = $('#run');
  button.disabled = true;
  $('#status').textContent = 'Démarrage de Python…';
  try {
    const results = await executeExercise(editor.getValue(), current.cases, {
      timeoutMs: Number($('#timeoutLimit').value) * 1000,
      memoryLimitMB: Number($('#memoryLimit').value),
    });
    showResults(results, current.cases.length);
  } catch (error) {
    $('#console').textContent = `Erreur du moteur Python : ${error.message}`;
    $('#status').textContent = 'Erreur';
  } finally { button.disabled = false; }
});

setInterval(updateTimerDisplay, 250);

try {
  exercises = await loadExercises();
  $('#count').textContent = `${exercises.length} exercices`;
  renderNav();
  const requestedId = new URLSearchParams(location.search).get('exercise');
  const selected = exercises.find(exercise => exercise.id === requestedId) ?? exercises[0];
  if (selected) selectExercise(selected);
} catch (error) {
  $('#title').textContent = 'Impossible de charger les exercices';
  $('#desc').textContent = `${error.message} Lance la page depuis un serveur local (voir README.md).`;
}
