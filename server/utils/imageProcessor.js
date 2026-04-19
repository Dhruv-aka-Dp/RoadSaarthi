const sharp = require('sharp');
const exifParser = require('exif-parser');
const path = require('path');
const fs = require('fs/promises');

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
fs.mkdir(UPLOADS_DIR, { recursive: true }).catch(console.error);

/**
 * Process the image buffer: extract GPS, compress, and save locally.
 * Returns an object with { lat, lng, filename } or just { filename } if no GPS.
 */
const processImage = async (buffer, originalFilename) => {
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
    console.warn('Failed to parse EXIF data:', err.message);
    // Continue processing even if EXIF parsing fails
  }

  // 2. Compress and optimize image using sharp
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(originalFilename || '.jpg')}`;
  const filepath = path.join(UPLOADS_DIR, filename);

  await sharp(buffer)
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true }) // Max 1024x1024
    .jpeg({ quality: 80 }) // Compress to 80% JPEG
    .toFile(filepath);

  // Return the extracted data and filename
  return {
    lat,
    lng,
    filename
  };
};

module.exports = {
  processImage
};
