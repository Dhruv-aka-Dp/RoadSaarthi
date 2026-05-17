const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Report = require('../models/Report');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const DEFAULT_CENTER = {
  lat: Number(process.env.BENCHMARK_LAT || 12.9716),
  lng: Number(process.env.BENCHMARK_LNG || 77.5946),
};
const DEFAULT_RADIUS_KM = Number(process.env.BENCHMARK_RADIUS_KM || 5);

const haversineDistanceKm = (lat1, lng1, lat2, lng2) => {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const latDelta = toRadians(lat2 - lat1);
  const lngDelta = toRadians(lng2 - lng1);

  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(lngDelta / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
};

const run = async () => {
  await mongoose.connect(
    process.env.MONGO_URI || 'mongodb://localhost:27017/roadsarthi'
  );

  const totalReports = await Report.countDocuments();
  if (totalReports === 0) {
    throw new Error('No reports found. Seed data first with npm run seed:reports');
  }

  const indexedQuery = {
    location: {
      $geoWithin: {
        $centerSphere: [
          [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat],
          DEFAULT_RADIUS_KM / 6378.1,
        ],
      },
    },
  };

  const indexedStart = performance.now();
  const indexedResults = await Report.find(indexedQuery).lean();
  const indexedDurationMs = performance.now() - indexedStart;

  const explainStart = performance.now();
  const explainPlan = await Report.find(indexedQuery).explain('executionStats');
  const explainDurationMs = performance.now() - explainStart;

  const scanStart = performance.now();
  const allReports = await Report.find({}).lean();
  const scanMatches = allReports.filter((report) => {
    const coordinates = report?.location?.coordinates;

    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      return false;
    }

    const [lng, lat] = coordinates;
    return (
      haversineDistanceKm(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng, lat, lng) <=
      DEFAULT_RADIUS_KM
    );
  });
  const scanDurationMs = performance.now() - scanStart;

  console.log(
    JSON.stringify(
      {
        datasetSize: totalReports,
        center: DEFAULT_CENTER,
        radiusKm: DEFAULT_RADIUS_KM,
        indexed: {
          durationMs: Number(indexedDurationMs.toFixed(2)),
          matchedReports: indexedResults.length,
        },
        fullScan: {
          durationMs: Number(scanDurationMs.toFixed(2)),
          matchedReports: scanMatches.length,
        },
        explain: {
          durationMs: Number(explainDurationMs.toFixed(2)),
          winningStage:
            explainPlan?.queryPlanner?.winningPlan?.inputStage?.stage ||
            explainPlan?.queryPlanner?.winningPlan?.stage ||
            'unknown',
          totalDocsExamined:
            explainPlan?.executionStats?.totalDocsExamined ?? null,
          totalKeysExamined:
            explainPlan?.executionStats?.totalKeysExamined ?? null,
          executionTimeMillis:
            explainPlan?.executionStats?.executionTimeMillis ?? null,
        },
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
};

run()
  .catch(async (error) => {
    console.error('Geo benchmark failed:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  });
