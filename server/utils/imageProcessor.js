const sharp = require('sharp');
const cloudinary = require('../config/cloudinary');
const { parseExifGps } = require('./exifGps');
const { extractExifGpsInWorker } = require('./exifWorkerClient');

const OUTPUT_IMAGE_SIZE = 800;

const extractGpsMetadata = async (buffer) => {
  try {
    const workerResult = await extractExifGpsInWorker(buffer);

    return {
      ...workerResult,
      workerUsed: true,
      fallbackUsed: false,
    };
  } catch (workerError) {
    console.warn('EXIF worker failed, falling back to inline parser:', workerError.message);

    try {
      const fallbackResult = parseExifGps(buffer);

      return {
        ...fallbackResult,
        workerUsed: false,
        fallbackUsed: true,
      };
    } catch (fallbackError) {
      console.warn('Failed to parse EXIF data:', fallbackError.message);

      return {
        lat: null,
        lng: null,
        hasGps: false,
        workerUsed: false,
        fallbackUsed: true,
      };
    }
  }
};

/**
 * Process the image buffer: extract GPS, compress with sharp,
 * upload to Cloudinary, and return { lat, lng, imageUrl }.
 */
const processImage = async (buffer, originalFilename) => {
  const metadata = await extractGpsMetadata(buffer);

  // Sharp strips EXIF/metadata by default unless withMetadata() is called.
  // Re-encoding here intentionally removes location metadata from the stored asset.
  const optimizedBuffer = await sharp(buffer)
    .rotate()
    .resize(OUTPUT_IMAGE_SIZE, OUTPUT_IMAGE_SIZE, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();

  // 2. Upload the optimized buffer to Cloudinary
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
    lat: metadata.lat,
    lng: metadata.lng,
    hasGps: metadata.hasGps,
    imageUrl: uploadResult.secure_url,
    processing: {
      originalFilename,
      maxDimension: OUTPUT_IMAGE_SIZE,
      outputFormat: 'jpeg',
      exifStripped: true,
      workerUsed: metadata.workerUsed,
      fallbackUsed: metadata.fallbackUsed,
    },
  };
};

module.exports = {
  processImage,
};
