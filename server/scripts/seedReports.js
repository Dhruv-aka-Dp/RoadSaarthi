const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Report = require('../models/Report');
const User = require('../models/User');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const DEFAULT_COUNT = 250;
const HOTSPOT_CITIES = [
  { name: 'Bengaluru', lat: 12.9716, lng: 77.5946 },
  { name: 'Hyderabad', lat: 17.385, lng: 78.4867 },
  { name: 'Chennai', lat: 13.0827, lng: 80.2707 },
  { name: 'Pune', lat: 18.5204, lng: 73.8567 },
  { name: 'Delhi', lat: 28.6139, lng: 77.209 },
];

const STATUSES = ['pending', 'pending', 'assigned', 'resolved'];
const SOURCES = ['browser', 'browser', 'manual', 'exif'];

const getArgValue = (flag, fallback) => {
  const index = process.argv.indexOf(flag);

  if (index === -1 || index === process.argv.length - 1) {
    return fallback;
  }

  return process.argv[index + 1];
};

const randomFrom = (items) => items[Math.floor(Math.random() * items.length)];
const jitter = (center, amount) => center + (Math.random() - 0.5) * amount;

const randomRecentDate = () => {
  const now = Date.now();
  const daysBack = Math.floor(Math.random() * 10);
  const minutesBack = Math.floor(Math.random() * 24 * 60);
  return new Date(now - (daysBack * 24 * 60 + minutesBack) * 60 * 1000);
};

const buildPriority = (cityIndex) => {
  if (cityIndex < 2) {
    return Math.random() > 0.45 ? 'high' : 'medium';
  }

  return Math.random() > 0.7 ? 'medium' : 'low';
};

const run = async () => {
  const reportCount = Number.parseInt(getArgValue('--count', DEFAULT_COUNT), 10);
  const replaceSeeded = process.argv.includes('--replace-seeded');

  if (!Number.isFinite(reportCount) || reportCount <= 0) {
    throw new Error('Please provide a positive integer for --count');
  }

  await mongoose.connect(
    process.env.MONGO_URI || 'mongodb://localhost:27017/roadsarthi'
  );

  if (replaceSeeded) {
    const deletion = await Report.deleteMany({ title: /^\[Seeded\]/ });
    console.log(`Removed ${deletion.deletedCount} previously seeded reports.`);
  }

  const officers = await User.find({ role: 'officer', officerId: { $ne: null } })
    .select('officerId')
    .lean();

  const seededReports = Array.from({ length: reportCount }, (_, index) => {
    const cityIndex = Math.floor(Math.random() * HOTSPOT_CITIES.length);
    const city = HOTSPOT_CITIES[cityIndex];
    const status = randomFrom(STATUSES);
    const source = randomFrom(SOURCES);
    const assignedOfficer =
      status === 'assigned' || status === 'resolved'
        ? randomFrom(officers)?.officerId || null
        : null;
    const createdAt = randomRecentDate();
    const updatedAt = new Date(createdAt.getTime() + Math.random() * 72 * 60 * 60 * 1000);

    return {
      title: `[Seeded] ${city.name} road issue ${index + 1}`,
      description:
        `[seeded] Synthetic pothole cluster generated for benchmarking near ${city.name}.`,
      location: {
        type: 'Point',
        coordinates: [jitter(city.lng, 0.18), jitter(city.lat, 0.18)],
      },
      status,
      priority: buildPriority(cityIndex),
      assignedTo: assignedOfficer,
      locationSource: source,
      image: 'no-photo.jpg',
      imageProcessing: {
        originalFilename: null,
        maxDimension: 800,
        format: 'jpeg',
        exifStripped: true,
        workerUsed: false,
        fallbackUsed: false,
      },
      createdBy: null,
      createdAt,
      updatedAt,
    };
  });

  const result = await Report.insertMany(seededReports, { ordered: false });

  console.log(`Inserted ${result.length} seeded reports.`);
  console.log(
    `Hotspot distribution centered around: ${HOTSPOT_CITIES.map((city) => city.name).join(', ')}`
  );

  await mongoose.disconnect();
};

run()
  .catch(async (error) => {
    console.error('Seeding failed:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  });
