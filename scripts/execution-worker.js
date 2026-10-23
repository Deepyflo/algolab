let pyodide;
let initialization;

async function getPyodide() {
  if (!initialization) {
    importScripts('https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js');
    initialization = loadPyodide().then(async instance => {
      pyodide = instance;
      for (const file of ['complexity.py', 'runner.py']) {
        const response = await fetch(new URL(`../python/${file}`, self.location.href));
        if (!response.ok) throw new Error(`Le module Python python/${file} est introuvable.`);
        await pyodide.runPythonAsync(await response.text());
      }
      return pyodide;
    });
  }
  return initialization;
}

self.onmessage = async ({ data }) => {
  if (data.type !== 'run') return;
  try {
    const engine = await getPyodide();
    engine.globals.set('analysis_code', data.code);
    const analysisJson = engine.runPython('analyze_complexity(analysis_code)');
    const analysis = JSON.parse(String(analysisJson));
    if (analysisJson && typeof analysisJson.destroy === 'function') analysisJson.destroy();
    self.postMessage({ type: 'analysis', analysis });
    engine.globals.set('payload_json', JSON.stringify({ code: data.code, cases: data.cases, memoryLimitMB: data.memoryLimitMB }));
    const resultJson = await engine.runPythonAsync('run_exercise(payload_json)');
    const result = JSON.parse(String(resultJson));
    if (resultJson && typeof resultJson.destroy === 'function') resultJson.destroy();
    result.complexity = analysis;
    self.postMessage({ type: 'result', result });
  } catch (error) {
    self.postMessage({ type: 'error', message: error?.message || String(error) });
  }
};

getPyodide().then(() => self.postMessage({ type: 'ready' })).catch(error => {
  self.postMessage({ type: 'error', message: error?.message || String(error) });
});
