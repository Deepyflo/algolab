import { createEditor } from './editor.js';
import {
  readExerciseDatabase, saveCustomExercise, updateCustomExercise,
  deleteCustomExercise, importCustomExercises
} from './catalog.js';

const $ = selector => document.querySelector(selector);
const starter = 'def solution():\n    # TODO: implement\n    pass';
const editor = createEditor($('#codeEditor'), starter, () => {});
const params = new URLSearchParams(location.search);
const editingId = params.get('edit');
let caseCount = 0;
let customExercises = [];

function addCase(initial = {}) {
  caseCount += 1;
  const fragment = $('#caseTemplate').content.cloneNode(true);
  fragment.querySelector('.case-label').value = initial.label || `Cas ${caseCount}`;
  fragment.querySelector('.case-expression').value = initial.expr || '';
  fragment.querySelector('.case-expected').value = initial.expected === undefined ? '' : JSON.stringify(initial.expected);
  fragment.querySelector('.remove-case').addEventListener('click', event => event.currentTarget.closest('.case-row').remove());
  $('#testCases').append(fragment);
}

function renderDatabase() {
  const list = $('#exerciseList');
  list.replaceChildren();
  $('#databaseCount').textContent = `${customExercises.length} exercice${customExercises.length === 1 ? '' : 's'}`;
  $('#databaseStatus').textContent = customExercises.length
    ? 'Les exercices intégrés et personnalisés sont chargés depuis leurs fichiers JSON.'
    : 'La base JSON est prête. Elle ne contient encore aucun exercice.';
  if (!customExercises.length) {
    const empty = document.createElement('div');
    empty.className = 'database-empty';
    empty.textContent = 'Aucun exercice personnalisé pour le moment.';
    list.append(empty);
    return;
  }
  for (const exercise of customExercises) {
    const row = document.createElement('article');
    row.className = 'database-row';
    const details = document.createElement('div');
    details.className = 'database-details';
    const title = document.createElement('h3');
    title.textContent = exercise.title;
    const summary = document.createElement('p');
    summary.textContent = `${exercise.folder} · ${exercise.cases.length} test${exercise.cases.length === 1 ? '' : 's'}`;
    details.append(title, summary);
    const actions = document.createElement('div');
    actions.className = 'database-actions';
    const edit = document.createElement('a');
    edit.className = 'btn';
    edit.href = `custom.html?edit=${encodeURIComponent(exercise.id)}`;
    edit.textContent = 'Modifier';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'btn delete-exercise';
    remove.textContent = 'Supprimer';
    remove.addEventListener('click', async () => {
      if (!window.confirm(`Supprimer « ${exercise.title} » de la base JSON ?`)) return;
      try {
        await deleteCustomExercise(exercise.id);
        customExercises = customExercises.filter(item => item.id !== exercise.id);
        renderDatabase();
        if (editingId === exercise.id) location.href = 'custom.html';
      } catch (error) { $('#databaseStatus').textContent = error.message; }
    });
    actions.append(edit, remove);
    row.append(details, actions);
    list.append(row);
  }
}

function loadIntoForm(exercise) {
  $('#exerciseTitle').value = exercise.title;
  $('#statement').value = exercise.statement;
  editor.setValue(exercise.code);
  $('#testCases').replaceChildren();
  caseCount = 0;
  exercise.cases.forEach(test => addCase(test));
  $('#formTitle').textContent = 'Modifier un exercice';
  $('#saveExercise').textContent = 'Enregistrer les modifications';
  $('#databaseStatus').textContent = `Modification de « ${exercise.title} »`;
}

function readLegacyExercises() {
  try {
    const data = JSON.parse(localStorage.getItem('algolab-custom-exercises-v1') || '[]');
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

async function initialize() {
  try {
    customExercises = await readExerciseDatabase();
    renderDatabase();
    const legacy = readLegacyExercises();
    if (legacy.length) {
      $('#legacyImport').hidden = false;
      $('#legacyMessage').textContent = `${legacy.length} exercice${legacy.length === 1 ? '' : 's'} trouvé${legacy.length === 1 ? '' : 's'} dans l’ancien stockage navigateur.`;
    }
    if (editingId) {
      const exercise = customExercises.find(item => item.id === editingId);
      if (!exercise) {
        $('#formError').textContent = 'Cet exercice est introuvable dans la base JSON.';
      } else loadIntoForm(exercise);
    } else addCase();
  } catch (error) {
    $('#databaseStatus').textContent = `Connexion à la base impossible : ${error.message}`;
    $('#formError').textContent = 'Lance le site avec python3 server.py pour accéder à la base JSON.';
  }
}

$('#addCase').addEventListener('click', () => addCase());
$('#importLegacy').addEventListener('click', async () => {
  const button = $('#importLegacy');
  const legacy = readLegacyExercises();
  button.disabled = true;
  try {
    const result = await importCustomExercises(legacy);
    localStorage.removeItem('algolab-custom-exercises-v1');
    customExercises = await readExerciseDatabase();
    renderDatabase();
    $('#legacyImport').hidden = true;
    $('#databaseStatus').textContent = `${result.imported} nouvel${result.imported === 1 ? '' : 's'} exercice${result.imported === 1 ? '' : 's'} importé${result.imported === 1 ? '' : 's'} · ${result.updated} mise${result.updated === 1 ? '' : 's'} à jour.`;
  } catch (error) {
    $('#databaseStatus').textContent = `Import impossible : ${error.message}`;
  } finally { button.disabled = false; }
});

$('#exportDatabase').addEventListener('click', async () => {
  try {
    const contents = JSON.stringify(await readExerciseDatabase(), null, 2);
    const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'algolab-exercises.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) { $('#databaseStatus').textContent = `Export impossible : ${error.message}`; }
});

$('#chooseImport').addEventListener('click', () => $('#importFile').click());
$('#importFile').addEventListener('change', async event => {
  const input = event.currentTarget;
  const file = input.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (!Array.isArray(parsed)) throw new Error('Le fichier doit contenir une liste d’exercices JSON.');
    const result = await importCustomExercises(parsed);
    customExercises = await readExerciseDatabase();
    renderDatabase();
    $('#databaseStatus').textContent = `${result.imported} nouvel${result.imported === 1 ? '' : 's'} exercice${result.imported === 1 ? '' : 's'} importé${result.imported === 1 ? '' : 's'} · ${result.updated} mise${result.updated === 1 ? '' : 's'} à jour.`;
  } catch (error) {
    $('#databaseStatus').textContent = `Import impossible : ${error.message}`;
  } finally { input.value = ''; }
});

$('#exerciseForm').addEventListener('submit', async event => {
  event.preventDefault();
  const errorPanel = $('#formError');
  errorPanel.textContent = '';
  const rows = [...document.querySelectorAll('.case-row')];
  if (!rows.length) {
    errorPanel.textContent = 'Ajoute au moins un cas de test.';
    return;
  }

  let cases;
  try {
    cases = rows.map((row, index) => {
      const label = row.querySelector('.case-label').value.trim();
      const expr = row.querySelector('.case-expression').value.trim();
      const rawExpected = row.querySelector('.case-expected').value.trim();
      if (!label || !expr || !rawExpected) throw new Error(`Complète les trois champs du cas ${index + 1}.`);
      return { label, expr, expected: JSON.parse(rawExpected) };
    });
  } catch (error) {
    errorPanel.textContent = error instanceof SyntaxError
      ? 'Un résultat attendu n’est pas du JSON valide. Exemples : 42, "texte", true, [1, 2], null.'
      : error.message;
    return;
  }

  const payload = {
    title: $('#exerciseTitle').value.trim(),
    statement: $('#statement').value.trim(),
    code: editor.getValue().trimEnd(),
    cases
  };
  if (!payload.title || !payload.statement || !payload.code) {
    errorPanel.textContent = 'Complète le titre, l’énoncé et le code de base.';
    return;
  }

  const button = $('#saveExercise');
  button.disabled = true;
  try {
    const saved = editingId
      ? await updateCustomExercise(editingId, payload)
      : await saveCustomExercise(payload);
    location.href = `index.html?exercise=${encodeURIComponent(saved.id)}`;
  } catch (error) {
    errorPanel.textContent = `Impossible d’enregistrer cet exercice : ${error.message}`;
  } finally { button.disabled = false; }
});

initialize();
