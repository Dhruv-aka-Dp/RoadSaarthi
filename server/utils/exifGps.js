const exifParser = require('exif-parser');

const parseExifGps = (buffer) => {
  const parser = exifParser.create(buffer);
  const result = parser.parse();

  const lat = result?.tags?.GPSLatitude ?? null;
  const lng = result?.tags?.GPSLongitude ?? null;

  return {
    lat,
    lng,
    hasGps: Number.isFinite(lat) && Number.isFinite(lng),
  };
};

module.exports = {
  parseExifGps,
};
