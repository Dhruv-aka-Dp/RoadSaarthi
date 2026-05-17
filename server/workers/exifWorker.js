const { parentPort, workerData } = require('worker_threads');
const { parseExifGps } = require('../utils/exifGps');

try {
  const buffer = Buffer.isBuffer(workerData)
    ? workerData
    : Buffer.from(workerData);

  const result = parseExifGps(buffer);
  parentPort.postMessage(result);
} catch (error) {
  parentPort.postMessage({
    lat: null,
    lng: null,
    hasGps: false,
    error: error.message,
  });
}
