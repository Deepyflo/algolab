let worker;
let pending;
let timeoutHandle;
let currentOptions;

function createWorker() {
  worker = new Worker('./scripts/execution-worker.js');
  worker.onmessage = ({ data }) => {
    if (!pending) return;
    if (data.type === 'ready') {
      pending.ready = true;
      pending.startTimer();
    } else if (data.type === 'analysis') {
      pending.analysis = data.analysis;
    } else if (data.type === 'result') {
      clearTimeout(timeoutHandle);
      const done = pending;
      pending = null;
      done.resolve({ ...data.result, complexity: data.result.complexity || done.analysis });
    } else if (data.type === 'error') {
      clearTimeout(timeoutHandle);
      const done = pending;
      pending = null;
      done.reject(new Error(data.message));
    }
  };
  worker.onerror = event => {
    if (!pending) return;
    clearTimeout(timeoutHandle);
    const done = pending;
    pending = null;
    done.reject(new Error(event.message || 'Le moteur Python a rencontré une erreur.'));
  };
}

function stopWorker() {
  worker?.terminate();
  worker = null;
}

export function executeExercise(code, cases, options = {}) {
  stopWorker();
  clearTimeout(timeoutHandle);
  currentOptions = { timeoutMs: 10000, memoryLimitMB: 128, ...options };
  return new Promise((resolve, reject) => {
    pending = {
      resolve,
      reject,
      analysis: null,
      startTimer() {
        timeoutHandle = setTimeout(() => {
          const done = pending;
          pending = null;
          stopWorker();
          done.resolve({
            results: [{ ok: false, label: 'Time Limit Exceeded', got: `Temps maximal de ${(currentOptions.timeoutMs / 1000).toFixed(0)} s dépassé`, expected: '' }],
            stdout: '', stderr: '', elapsedMs: currentOptions.timeoutMs, peakBytes: null,
            memoryLimitMB: currentOptions.memoryLimitMB, status: 'Time Limit Exceeded', complexity: done.analysis,
          });
        }, currentOptions.timeoutMs);
        worker.postMessage({ type: 'run', code, cases, memoryLimitMB: currentOptions.memoryLimitMB });
      },
    };
    createWorker();
  });
}
