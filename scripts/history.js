import { loadExamHistory } from './exam-history-store.js';
import { formatDuration, TARGET_PERCENT } from './exam.js';

const $ = selector => document.querySelector(selector);

function create(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function formatPercent(value) {
  return `${Math.round(value)} %`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat('fr-BE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function renderOverview(records) {
  const average = records.reduce((sum, record) => sum + record.percent, 0) / records.length;
  const qualified = records.filter(record => record.qualified).length;
  $('#historySessionCount').textContent = String(records.length);
  $('#historyAverage').textContent = formatPercent(average);
  $('#historyQualified').textContent = `${qualified} / ${records.length}`;
}

function collectExerciseStats(records) {
  const stats = new Map();
  for (const record of records) {
    for (const exercise of record.exercises) {
      const stat = stats.get(exercise.exerciseId) || {
        id: exercise.exerciseId,
        name: exercise.name,
        appearances: 0,
        qualified: 0,
        testPercentTotal: 0,
      };
      stat.appearances += 1;
      stat.qualified += Number(exercise.qualified);
      stat.testPercentTotal += exercise.percent;
      stats.set(exercise.exerciseId, stat);
    }
  }
  return [...stats.values()].sort((left, right) => right.appearances - left.appearances || left.name.localeCompare(right.name, 'fr'));
}

function renderExerciseStats(records) {
  const container = $('#exerciseStats');
  container.replaceChildren();
  const stats = collectExerciseStats(records);
  if (!stats.length) {
    container.append(create('p', 'history-empty', 'Les résultats par exercice apparaîtront après ta première simulation.'));
    return;
  }

  for (const stat of stats) {
    const rate = stat.qualified / stat.appearances * 100;
    const average = stat.testPercentTotal / stat.appearances;
    const card = create('article', 'exercise-stat');
    const copy = create('div', 'exercise-stat-copy');
    copy.append(create('strong', '', stat.name));
    copy.append(create('small', '', `${stat.qualified} réussite${stat.qualified === 1 ? '' : 's'} sur ${stat.appearances} apparition${stat.appearances === 1 ? '' : 's'} · moyenne des tests ${formatPercent(average)}`));
    const value = create('strong', 'exercise-stat-rate', formatPercent(rate));
    const meter = create('div', 'rate-track');
    const fill = create('span', 'rate-fill');
    fill.style.width = `${rate}%`;
    meter.append(fill);
    card.append(copy, value, meter);
    container.append(card);
  }
}

function renderSession(record) {
  const card = create('article', 'history-session');
  const heading = create('header', 'history-session-heading');
  const title = create('div', 'history-session-title');
  title.append(create('strong', '', formatDate(record.finishedAt)));
  title.append(create('small', '', record.reason === 'timeout' ? 'Temps écoulé' : record.reason === 'manual' ? 'Terminée avant la fin' : 'Session complète'));
  const result = create('div', `history-session-result${record.qualified ? ' is-qualified' : ''}`);
  result.append(create('strong', '', formatPercent(record.percent)));
  result.append(create('small', '', `${record.passed} / ${record.total} tests`));
  heading.append(title, result);

  const footer = create('div', 'history-session-meta');
  footer.append(create('span', '', `Durée ${formatDuration(record.elapsedMs)}`));
  footer.append(create('span', '', `${record.exercises.length} exercices`));

  const list = create('div', 'history-session-exercises');
  record.exercises.forEach((exercise, index) => {
    const row = create('div', `history-exercise${exercise.qualified ? ' is-qualified' : ''}`);
    row.append(create('span', 'history-exercise-number', String(index + 1).padStart(2, '0')));
    row.append(create('strong', 'history-exercise-name', exercise.name));
    const score = exercise.submittedCode === null
      ? 'Non soumis'
      : `${exercise.passed} / ${exercise.total} tests · ${formatPercent(exercise.percent)}`;
    row.append(create('span', 'history-exercise-score', score));
    list.append(row);
  });
  card.append(heading, footer, list);
  return card;
}

async function render() {
  try {
    const records = await loadExamHistory();
    records.sort((left, right) => new Date(right.finishedAt) - new Date(left.finishedAt));
    $('#historyStatus').hidden = true;
    $('#historyContent').hidden = false;
    if (!records.length) {
      $('#historySessionCount').textContent = '0';
      $('#historyAverage').textContent = '—';
      $('#historyQualified').textContent = '0 / 0';
      $('#exerciseStats').append(create('p', 'history-empty', 'Les résultats par exercice apparaîtront après ta première simulation.'));
      $('#examHistoryList').append(create('p', 'history-empty', 'Aucune simulation enregistrée pour le moment.'));
      return;
    }

    renderOverview(records);
    renderExerciseStats(records);
    const list = $('#examHistoryList');
    list.replaceChildren(...records.map(renderSession));
  } catch (error) {
    $('#historyStatus').textContent = `Impossible de charger l’historique : ${error.message} Vérifie que le serveur AlgoLab est lancé.`;
    $('#historyStatus').classList.add('is-error');
  }
}

render();
