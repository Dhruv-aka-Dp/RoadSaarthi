const sharp = require('sharp');
const exifParser = require('exif-parser');
const cloudinary = require('../config/cloudinary');

/**
 * Process the image buffer: extract GPS, compress with sharp,
 * upload to Cloudinary, and return { lat, lng, imageUrl }.
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

  // 2. Compress and optimize image using sharp (in memory)
  const optimizedBuffer = await sharp(buffer)
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();

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
    stream.end(optimizedBuffer);
  });

  // Return the extracted data and the Cloudinary secure URL
  return {
    lat,
    lng,
    imageUrl: uploadResult.secure_url,
  };
};

module.exports = {
  processImage,
};
