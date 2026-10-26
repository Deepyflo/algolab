import { loadExercises } from './catalog.js';
import { createEditor } from './editor.js';
import { executeExercise } from './runner.js';
import { formatDuration, minimumPassingCount, TARGET_PERCENT } from './exam.js';
import { saveExamRun } from './exam-history-store.js';

const $ = selector => document.querySelector(selector);
const EXERCISE_COUNT = 5;
const PYTHON_TIMEOUT_MS = 10000;
const PYTHON_MEMORY_LIMIT_MB = 128;

let pool = [];
let selectedIds = new Set();
let session = null;
let currentIndex = 0;
let timerInterval = null;
let isRunning = false;

const editor = createEditor($('#examEditor'), '', value => {
  if (!session || session.finished) return;
  const exercise = session.exercises[currentIndex];
  if (exercise) session.code[exercise.id] = value;
});

function shuffled(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function setError(message = '') {
  $('#setupError').textContent = message;
}

function mode() {
  return document.querySelector('input[name="examMode"]:checked')?.value || 'random';
}

function updatePickerVisibility() {
  $('#manualPicker').hidden = mode() !== 'manual';
  setError();
}

function renderChoices() {
  const container = $('#exerciseChoices');
  const template = $('#choiceTemplate');
  container.replaceChildren();
  pool.forEach((exercise, index) => {
    const choice = template.content.firstElementChild.cloneNode(true);
    const checkbox = choice.querySelector('input');
    checkbox.checked = selectedIds.has(exercise.id);
    checkbox.disabled = selectedIds.size >= EXERCISE_COUNT && !checkbox.checked;
    choice.querySelector('.choice-number').textContent = String(index + 1).padStart(2, '0');
    choice.querySelector('.choice-copy b').textContent = exercise.name;
    choice.querySelector('.choice-copy small').textContent = `${exercise.cases.length} tests`;
    choice.classList.toggle('is-selected', checkbox.checked);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) selectedIds.add(exercise.id);
      else selectedIds.delete(exercise.id);
      renderChoices();
      updateSelectionCount();
    });
    container.append(choice);
  });
  updateSelectionCount();
}

function updateSelectionCount() {
  $('#selectionCount').textContent = `${selectedIds.size} / ${EXERCISE_COUNT}`;
  $('#selectionCount').classList.toggle('selection-ready', selectedIds.size === EXERCISE_COUNT);
}

function chooseExercises() {
  if (mode() === 'random') return shuffled(pool).slice(0, EXERCISE_COUNT);
  if (selectedIds.size !== EXERCISE_COUNT) {
    setError(`Sélectionne exactement ${EXERCISE_COUNT} exercices pour continuer.`);
    return null;
  }
  return pool.filter(exercise => selectedIds.has(exercise.id));
}

function updateTimer() {
  if (!session || session.finished) return;
  const remaining = Math.max(0, session.endsAt - Date.now());
  $('#examTimer').textContent = formatDuration(remaining);
  $('#examTimer').classList.toggle('timer-warning', remaining <= 5 * 60 * 1000);
  if (!remaining) finishExam('timeout');
}

function updateSessionStats() {
  const passed = Object.values(session.submissions).reduce((sum, result) => sum + result.passed, 0);
  const total = session.exercises.reduce((sum, exercise) => sum + exercise.cases.length, 0);
  $('#sessionExerciseCount').textContent = `Exercice ${currentIndex + 1} / ${EXERCISE_COUNT}`;
  $('#examTestScore').textContent = `${passed} / ${total}`;
  $('#examProgress').setAttribute('aria-valuenow', String(currentIndex + 1));
  $('#examProgress').replaceChildren(...session.exercises.map((_, index) => {
    const segment = document.createElement('span');
    segment.className = `progress-segment${index < currentIndex ? ' is-complete' : ''}${index === currentIndex ? ' is-current' : ''}`;
    segment.setAttribute('aria-hidden', 'true');
    return segment;
  }));
}

function showCurrentExercise() {
  if (!session || session.finished || isRunning) return;
  const exercise = session.exercises[currentIndex];
  $('#examPosition').textContent = `EXERCICE ${currentIndex + 1} / ${EXERCISE_COUNT}`;
  $('#examTitle').textContent = exercise.name;
  $('#examDescription').textContent = exercise.statement;
  $('#examFilename').textContent = `${exercise.id.replace('/', '_')}.py`;
  $('#examStatus').textContent = session.submissions[exercise.id] ? 'Dernier résultat conservé' : 'À toi de jouer';
  $('#examResultSummary').textContent = session.submissions[exercise.id]
    ? `${session.submissions[exercise.id].passed} / ${session.submissions[exercise.id].total} tests`
    : 'Non soumis';
  editor.setValue(session.code[exercise.id] ?? exercise.code);
  if (session.submissions[exercise.id]) renderExecution(session.submissions[exercise.id]);
  else $('#examConsole').innerHTML = '<span class="muted">Soumets ton code pour voir les tests.</span>';
  $('#nextExamExercise').textContent = currentIndex === EXERCISE_COUNT - 1
    ? 'Terminer et voir le récap →'
    : 'Exercice suivant →';
  updateSessionStats();
}

function appendOutput(label, content, type = '') {
  if (!content) return;
  const section = document.createElement('section');
  section.className = 'console-output-section';
  const heading = document.createElement('div');
  heading.className = 'console-output-label';
  heading.textContent = label;
  const output = document.createElement('pre');
  output.className = `console-output ${type}`;
  output.textContent = String(content).replace(/\n$/, '');
  section.append(heading, output);
  $('#examConsole').append(section);
}

function renderExecution(result) {
  const consolePanel = $('#examConsole');
  consolePanel.replaceChildren();
  appendOutput('stdout · print()', result.stdout, 'stdout');
  appendOutput('stderr', result.stderr, 'stderr');
  const heading = document.createElement('div');
  heading.className = 'console-output-label test-results-label';
  heading.textContent = 'Résultats des tests';
  consolePanel.append(heading);
  for (const test of result.results) {
    const row = document.createElement('div');
    row.className = test.ok ? 'pass exam-test' : 'fail exam-test';
    row.textContent = `${test.ok ? '✓' : '✗'} ${test.label}${test.ok ? '' : ` — reçu ${test.got} · attendu ${test.expected}`}`;
    consolePanel.append(row);
  }
}

function createSession(exercises) {
  const durationMs = Number(document.querySelector('input[name="examDuration"]:checked')?.value || 75) * 60 * 1000;
  session = {
    exercises,
    durationMs,
    startedAt: Date.now(),
    endsAt: Date.now() + durationMs,
    code: {},
    submissions: {},
    finished: false,
  };
  $('#examSetup').hidden = true;
  $('#examRecap').hidden = true;
  $('#examSession').hidden = false;
  currentIndex = 0;
  updateTimer();
  updateSessionStats();
  showCurrentExercise();
  clearInterval(timerInterval);
  timerInterval = setInterval(updateTimer, 250);
}

function submitCurrentExercise() {
  if (!session || session.finished || isRunning) return;
  const exercise = session.exercises[currentIndex];
  session.code[exercise.id] = editor.getValue();
  isRunning = true;
  $('#submitExamExercise').disabled = true;
  $('#examStatus').textContent = 'Démarrage de Python…';
  $('#examResultSummary').textContent = 'Exécution…';
  $('#examConsole').textContent = 'Le moteur Python exécute les tests…';
  $('#nextExamExercise').disabled = true;
  executeExercise(session.code[exercise.id], exercise.cases, {
    timeoutMs: PYTHON_TIMEOUT_MS,
    memoryLimitMB: PYTHON_MEMORY_LIMIT_MB,
  }).then(execution => {
    if (!session || session.finished) return;
    const passed = execution.results.filter(result => result.ok).length;
    session.submissions[exercise.id] = {
      passed,
      total: exercise.cases.length,
      code: session.code[exercise.id],
      results: execution.results,
      stdout: execution.stdout,
      stderr: execution.stderr,
      elapsedMs: execution.elapsedMs,
      status: execution.status || 'Terminé',
    };
    $('#examStatus').textContent = `${passed} / ${exercise.cases.length} tests réussis`;
    $('#examResultSummary').textContent = `${passed} / ${exercise.cases.length} tests`;
    renderExecution(session.submissions[exercise.id]);
    updateSessionStats();
  }).catch(error => {
    if (!session || session.finished) return;
    $('#examConsole').textContent = `Erreur du moteur Python : ${error.message}`;
    $('#examStatus').textContent = 'Erreur du moteur';
    $('#examResultSummary').textContent = 'Erreur';
  }).finally(() => {
    isRunning = false;
    $('#submitExamExercise').disabled = false;
    $('#nextExamExercise').disabled = false;
  });
}

function advanceExercise() {
  if (!session || session.finished || isRunning) return;
  if (currentIndex >= EXERCISE_COUNT - 1) {
    finishExam('completed');
    return;
  }
  currentIndex += 1;
  showCurrentExercise();
}

function renderRecap(reason) {
  const passed = Object.values(session.submissions).reduce((sum, result) => sum + result.passed, 0);
  const total = session.exercises.reduce((sum, exercise) => sum + exercise.cases.length, 0);
  const percent = total ? passed / total * 100 : 0;
  const qualified = percent > TARGET_PERCENT;
  const elapsed = Math.min(session.durationMs, Date.now() - session.startedAt);
  $('#recapTitle').textContent = reason === 'timeout' ? 'Temps écoulé' : 'Simulation terminée';
  $('#recapMessage').textContent = qualified
    ? 'Seuil de réussite dépassé. Garde cette méthode pour le jour de l’examen.'
    : `Il fallait réussir au moins ${minimumPassingCount(total)} tests pour dépasser ${TARGET_PERCENT} %. Revois les exercices non validés et retente une session.`;
  $('#recapScoreCard').classList.toggle('recap-qualified', qualified);
  $('#recapScore').textContent = `${Math.round(percent)} %`;
  $('#recapTests').textContent = `${passed} / ${total} tests réussis`;
  $('#recapTime').textContent = formatDuration(elapsed);
  $('#recapThreshold').textContent = `${minimumPassingCount(total)} / ${total} tests`;

  const list = $('#recapList');
  list.replaceChildren();
  session.exercises.forEach((exercise, index) => {
    const result = session.submissions[exercise.id];
    const row = document.createElement('article');
    row.className = `recap-row${result && result.passed === result.total ? ' recap-row-pass' : ''}`;
    const number = document.createElement('span');
    number.className = 'recap-number';
    number.textContent = String(index + 1).padStart(2, '0');
    const name = document.createElement('strong');
    name.textContent = exercise.name;
    const score = document.createElement('span');
    score.className = 'recap-row-score';
    score.textContent = result ? `${result.passed} / ${result.total} tests · ${Math.round(result.passed / result.total * 100)} %` : `Non soumis · 0 / ${exercise.cases.length} tests`;
    const status = document.createElement('span');
    status.className = 'recap-row-status';
    status.textContent = result ? result.status : 'À revoir';
    row.append(number, name, score, status);
    if (result) {
      const codeDetails = document.createElement('details');
      codeDetails.className = 'recap-code';
      codeDetails.open = true;
      const codeSummary = document.createElement('summary');
      codeSummary.textContent = 'Code de la dernière soumission';
      const codeBlock = document.createElement('pre');
      const code = document.createElement('code');
      code.textContent = result.code ?? 'Code indisponible pour cette soumission.';
      codeBlock.append(code);
      codeDetails.append(codeSummary, codeBlock);
      row.append(codeDetails);
    }
    list.append(row);
  });
}

function createHistoryRecord(reason) {
  const passed = Object.values(session.submissions).reduce((sum, result) => sum + result.passed, 0);
  const total = session.exercises.reduce((sum, exercise) => sum + exercise.cases.length, 0);
  const percent = total ? passed / total * 100 : 0;
  const finishedAt = Date.now();
  return {
    id: globalThis.crypto?.randomUUID?.() || `${finishedAt}-${Math.random().toString(36).slice(2)}`,
    startedAt: new Date(session.startedAt).toISOString(),
    finishedAt: new Date(finishedAt).toISOString(),
    durationMs: session.durationMs,
    elapsedMs: Math.min(session.durationMs, finishedAt - session.startedAt),
    reason,
    passed,
    total,
    percent,
    qualified: percent > TARGET_PERCENT,
    exercises: session.exercises.map(exercise => {
      const result = session.submissions[exercise.id];
      const exercisePercent = result?.total ? result.passed / result.total * 100 : 0;
      return {
        exerciseId: exercise.id,
        name: exercise.name,
        folder: exercise.folder,
        passed: result?.passed ?? 0,
        total: exercise.cases.length,
        percent: exercisePercent,
        qualified: exercisePercent > TARGET_PERCENT,
        submittedCode: result?.code ?? null,
      };
    }),
  };
}

function finishExam(reason = 'manual') {
  if (!session || session.finished) return;
  if (reason === 'manual' && !window.confirm('Terminer cette simulation et afficher le récapitulatif ?')) return;
  const historyRecord = createHistoryRecord(reason);
  session.finished = true;
  clearInterval(timerInterval);
  $('#examSession').hidden = true;
  $('#examRecap').hidden = false;
  renderRecap(reason);
  $('#historySaveStatus').textContent = 'Enregistrement de la simulation…';
  saveExamRun(historyRecord)
    .then(() => { $('#historySaveStatus').textContent = 'Simulation ajoutée à l’historique.'; })
    .catch(error => { $('#historySaveStatus').textContent = `Historique non enregistré : ${error.message}`; });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetExam() {
  clearInterval(timerInterval);
  session = null;
  isRunning = false;
  selectedIds.clear();
  renderChoices();
  $('#examSession').hidden = true;
  $('#examRecap').hidden = true;
  $('#examSetup').hidden = false;
  setError();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.querySelectorAll('input[name="examMode"]').forEach(input => input.addEventListener('change', updatePickerVisibility));
$('#startExam').addEventListener('click', () => {
  const exercises = chooseExercises();
  if (!exercises) return;
  setError();
  createSession(exercises);
});
$('#submitExamExercise').addEventListener('click', submitCurrentExercise);
$('#nextExamExercise').addEventListener('click', advanceExercise);
$('#finishExam').addEventListener('click', () => finishExam('manual'));
$('#newExam').addEventListener('click', resetExam);

try {
  const exercises = await loadExercises();
  pool = exercises;
  if (pool.length < EXERCISE_COUNT) throw new Error('Il faut au moins cinq exercices dans la base pour démarrer un examen blanc.');
  renderChoices();
  $('#startExam').disabled = false;
} catch (error) {
  $('#setupError').textContent = `${error.message} Lance le site depuis python3 server.py.`;
  $('#startExam').disabled = true;
}
