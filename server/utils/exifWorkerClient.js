const path = require('path');
const { Worker } = require('worker_threads');

const EXIF_WORKER_PATH = path.join(__dirname, '../workers/exifWorker.js');
const DEFAULT_TIMEOUT_MS = 5000;

const extractExifGpsInWorker = (buffer, timeoutMs = DEFAULT_TIMEOUT_MS) =>
  new Promise((resolve, reject) => {
    const worker = new Worker(EXIF_WORKER_PATH, {
      workerData: buffer,
    });

    let settled = false;

    const cleanup = () => {
      worker.removeAllListeners('message');
      worker.removeAllListeners('error');
      worker.removeAllListeners('exit');
    };

    const finish = (handler) => (value) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeoutId);
      cleanup();
      handler(value);
    };

    const resolveOnce = finish(resolve);
    const rejectOnce = finish(reject);

    const timeoutId = setTimeout(async () => {
      try {
        await worker.terminate();
      } catch (error) {
        // Ignore termination errors; the timeout is the primary signal here.
      }

      rejectOnce(new Error(`EXIF worker timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    worker.on('message', (message) => {
      if (message?.error) {
        rejectOnce(new Error(message.error));
        return;
      }

      resolveOnce(message);
    });

    worker.on('error', rejectOnce);

    worker.on('exit', (code) => {
      if (!settled && code !== 0) {
        rejectOnce(new Error(`EXIF worker exited with code ${code}`));
      }
    });
  });

module.exports = {
  extractExifGpsInWorker,
};
