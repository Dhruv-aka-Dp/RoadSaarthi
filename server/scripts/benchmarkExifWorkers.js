const fs = require('fs');
const path = require('path');
const { parseExifGps } = require('../utils/exifGps');
const { extractExifGpsInWorker } = require('../utils/exifWorkerClient');

const SAMPLE_DIR = path.join(__dirname, '..', 'uploads');
const DEFAULT_ITERATIONS = Number(process.env.EXIF_BENCHMARK_ITERATIONS || 60);
const HEARTBEAT_INTERVAL_MS = 10;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const pickSampleFile = () => {
  const files = fs
    .readdirSync(SAMPLE_DIR)
    .filter((file) => /\.(jpe?g|png)$/i.test(file));

  if (files.length === 0) {
    throw new Error('No sample images found in server/uploads');
  }

  return path.join(SAMPLE_DIR, files[0]);
};

const measureEventLoopLag = async (label, task) => {
  let maxLagMs = 0;
  let expected = performance.now() + HEARTBEAT_INTERVAL_MS;

  const timer = setInterval(() => {
    const now = performance.now();
    maxLagMs = Math.max(maxLagMs, now - expected);
    expected = now + HEARTBEAT_INTERVAL_MS;
  }, HEARTBEAT_INTERVAL_MS);

  const start = performance.now();
  await task();
  const durationMs = performance.now() - start;
  clearInterval(timer);

  await sleep(HEARTBEAT_INTERVAL_MS);

  return {
    label,
    durationMs: Number(durationMs.toFixed(2)),
    maxLagMs: Number(maxLagMs.toFixed(2)),
  };
};

const run = async () => {
  const sampleFile = pickSampleFile();
  const buffer = fs.readFileSync(sampleFile);

  const inlineResult = await measureEventLoopLag('inline', async () => {
    for (let index = 0; index < DEFAULT_ITERATIONS; index += 1) {
      parseExifGps(buffer);
    }
  });

  const workerResult = await measureEventLoopLag('worker', async () => {
    for (let index = 0; index < DEFAULT_ITERATIONS; index += 1) {
      await extractExifGpsInWorker(buffer);
    }
  });

  console.log(
    JSON.stringify(
      {
        sampleFile: path.basename(sampleFile),
        iterations: DEFAULT_ITERATIONS,
        inline: inlineResult,
        worker: workerResult,
        note:
          'Worker offload may have more wall-clock overhead but should keep event-loop lag lower for CPU-bound EXIF parsing.',
      },
      null,
      2
    )
  );
};

run().catch((error) => {
  console.error('EXIF benchmark failed:', error.message);
  process.exit(1);
});
