const { parentPort } = require('worker_threads');
const sharp = require('sharp');
const exifParser = require('exif-parser');

parentPort.on('message', async (buffer) => {
  let lat = null;
  let lng = null;

  try {
    // 1. Extract EXIF data (if present)
    const parser = exifParser.create(buffer);
    const result = parser.parse();
    
    if (result && result.tags) {
      if (result.tags.GPSLatitude && result.tags.GPSLongitude) {
        lat = result.tags.GPSLatitude;
        lng = result.tags.GPSLongitude;
      }
    }
  } catch (err) {
    console.warn('Worker: Failed to parse EXIF data:', err.message);
  }

  try {
    // 2. Compress and optimize image using sharp
    // Images resized to 800px and EXIF stripped before storage using sharp
    const optimizedBuffer = await sharp(buffer)
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    parentPort.postMessage({
      success: true,
      lat,
      lng,
      optimizedBuffer
    });
  } catch (err) {
    parentPort.postMessage({
      success: false,
      error: err.message
    });
  }
});
