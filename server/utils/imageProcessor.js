const { Worker } = require('worker_threads');
const path = require('path');
const cloudinary = require('../config/cloudinary');

/**
 * Process the image buffer: extract GPS, compress with sharp,
 * upload to Cloudinary, and return { lat, lng, imageUrl }.
 */
const processImage = async (buffer, originalFilename) => {
  // 1 & 2: Use worker thread for CPU-intensive EXIF parsing and sharp compression
  const workerResult = await new Promise((resolve, reject) => {
    const workerPath = path.join(__dirname, '..', 'workers', 'imageWorker.js');
    const worker = new Worker(workerPath);
    
    worker.on('message', (message) => {
      if (message.success) {
        resolve(message);
      } else {
        reject(new Error(message.error));
      }
      worker.terminate();
    });
    
    worker.on('error', (err) => {
      reject(err);
      worker.terminate();
    });
    
    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });

    // Send the buffer to the worker
    worker.postMessage(buffer);
  });

  // 3. Upload the optimized buffer to Cloudinary
  const uploadResult = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'roadsarthi_reports',
        resource_type: 'image',
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );
    // Buffer passed via postMessage is converted back to Uint8Array/Buffer on receiving end
    stream.end(Buffer.from(workerResult.optimizedBuffer));
  });

  // Return the extracted data and the Cloudinary secure URL
  return {
    lat: workerResult.lat,
    lng: workerResult.lng,
    imageUrl: uploadResult.secure_url,
  };
};

module.exports = {
  processImage,
};
