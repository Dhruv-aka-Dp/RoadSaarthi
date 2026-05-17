const Report = require('../models/Report');
const User = require('../models/User');
const { z } = require('zod');
const { processImage } = require('../utils/imageProcessor');
const sendEmail = require('../utils/sendEmail');
const { getRedisClient } = require('../config/redis');
const {
  buildHotspotAggregation,
  buildAnalyticsPipeline,
  normalizeAnalytics,
} = require('../utils/reportAnalytics');

const HOTSPOT_CACHE_KEY = 'hotspots';
const ANALYTICS_CACHE_KEY = 'analytics-summary';
const CACHE_TTL_SECONDS = 600;

const createReportSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100),
  description: z.string().min(1, 'Description is required').max(500),
  longitude: z.coerce.number().optional(),
  latitude: z.coerce.number().optional(),
  locationSource: z.enum(['browser', 'manual']).optional(),
});

const getAccessMatchForUser = (user) => {
  if (!user) {
    return {};
  }

  if (user.role === 'user') {
    return { createdBy: user._id };
  }

  if (user.role === 'officer') {
    return { assignedTo: user.officerId };
  }

  return {};
};

const invalidateAnalyticsCaches = async (...keys) => {
  const redisClient = getRedisClient();

  if (!redisClient || !redisClient.isReady || keys.length === 0) {
    return;
  }

  await redisClient.del(...keys);
};

const getCachedPayload = async (cacheKey) => {
  const redisClient = getRedisClient();

  if (!redisClient || !redisClient.isReady) {
    return null;
  }

  const cached = await redisClient.get(cacheKey);
  return cached ? JSON.parse(cached) : null;
};

const setCachedPayload = async (cacheKey, payload, ttl = CACHE_TTL_SECONDS) => {
  const redisClient = getRedisClient();

  if (!redisClient || !redisClient.isReady) {
    return;
  }

  await redisClient.setEx(cacheKey, ttl, JSON.stringify(payload));
};

const getOrBuildAnalytics = async (baseMatch = {}, useCache = false) => {
  const shouldUseSharedCache = useCache && Object.keys(baseMatch).length === 0;

  if (shouldUseSharedCache) {
    const cached = await getCachedPayload(ANALYTICS_CACHE_KEY);
    if (cached) {
      return { analytics: cached, source: 'cache' };
    }
  }

  const [rawAnalytics = {}] = await Report.aggregate(
    buildAnalyticsPipeline(baseMatch)
  );
  const normalized = normalizeAnalytics(rawAnalytics);

  if (shouldUseSharedCache) {
    await setCachedPayload(ANALYTICS_CACHE_KEY, normalized, 300);
  }

  return {
    analytics: normalized,
    source: 'database',
  };
};

// @desc    Create new report
// @route   POST /api/reports
// @access  Private
exports.createReport = async (req, res, next) => {
  try {
    const validatedData = createReportSchema.parse(req.body);

    let finalLat = validatedData.latitude;
    let finalLng = validatedData.longitude;
    let locationSource =
      validatedData.locationSource ||
      (finalLat !== undefined && finalLng !== undefined ? 'manual' : 'unknown');
    let imageUrl;
    let imageProcessing;

    if (req.file) {
      const result = await processImage(req.file.buffer, req.file.originalname);
      imageUrl = result.imageUrl;
      imageProcessing = result.processing;

      if (result.hasGps) {
        finalLat = result.lat;
        finalLng = result.lng;
        locationSource = 'exif';
      }
    }

    if (
      finalLat === undefined ||
      finalLng === undefined ||
      Number.isNaN(finalLat) ||
      Number.isNaN(finalLng)
    ) {
      return res.status(400).json({
        success: false,
        error:
          'Location coordinates are required. Provide browser/manual GPS data or upload a photo with EXIF GPS metadata.',
      });
    }

    const nearbyReportsCount = await Report.countDocuments({
      location: {
        $geoWithin: {
          $centerSphere: [[finalLng, finalLat], 5 / 6378.1],
        },
      },
    });

    let priority = 'low';
    if (nearbyReportsCount >= 5) {
      priority = 'high';
    } else if (nearbyReportsCount >= 2) {
      priority = 'medium';
    }

    const report = await Report.create({
      title: validatedData.title,
      description: validatedData.description,
      image: imageUrl || 'no-photo.jpg',
      imageProcessing: imageProcessing || undefined,
      location: {
        type: 'Point',
        coordinates: [finalLng, finalLat],
      },
      locationSource,
      priority,
      createdBy: req.user._id,
    });

    try {
      await sendEmail({
        to: process.env.CONTACT_EMAIL || 'admin@roadsaarthi.com',
        subject: `New Road Report: ${report.title}`,
        text:
          `A new road report has been submitted.\n\n` +
          `Title: ${report.title}\n` +
          `Description: ${report.description}\n` +
          `Priority: ${priority}\n` +
          `Location: ${finalLat}, ${finalLng}\n` +
          `Location Source: ${locationSource}`,
      });
    } catch (emailErr) {
      console.error('Email notification failed:', emailErr.message);
    }

    await invalidateAnalyticsCaches(HOTSPOT_CACHE_KEY, ANALYTICS_CACHE_KEY);

    res.status(201).json({
      success: true,
      data: report,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all reports (with optional spatial filtering)
// @route   GET /api/reports
// @access  Private
exports.getReports = async (req, res, next) => {
  try {
    const { lng, lat, distance } = req.query;
    const query = getAccessMatchForUser(req.user);

    if (lng && lat && distance) {
      query.location = {
        $geoWithin: {
          $centerSphere: [
            [parseFloat(lng), parseFloat(lat)],
            parseFloat(distance) / 6378.1,
          ],
        },
      };
    }

    const reports = await Report.find(query).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: reports.length,
      data: reports,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Assign report to officer
// @route   PATCH /api/reports/:id/assign
// @access  Private (Admin)
exports.assignReport = async (req, res, next) => {
  try {
    const { officerId } = req.body;

    if (!officerId) {
      return res.status(400).json({
        success: false,
        error: 'Please provide an officerId',
      });
    }

    const officer = await User.findOne({ officerId, role: 'officer' });
    if (!officer) {
      return res.status(404).json({
        success: false,
        error: `Officer not found for officerId ${officerId}`,
      });
    }

    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: `Report not found with id ${req.params.id}`,
      });
    }

    if (report.status === 'resolved') {
      return res.status(400).json({
        success: false,
        error: 'Resolved reports cannot be reassigned',
      });
    }

    const updatedReport = await Report.findByIdAndUpdate(
      req.params.id,
      { assignedTo: officerId, status: 'assigned' },
      { new: true, runValidators: true }
    );

    await invalidateAnalyticsCaches(ANALYTICS_CACHE_KEY);

    res.status(200).json({
      success: true,
      data: updatedReport,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Resolve report
// @route   PATCH /api/reports/:id/resolve
// @access  Private (Officer/Admin)
exports.resolveReport = async (req, res, next) => {
  try {
    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: `Report not found with id ${req.params.id}`,
      });
    }

    if (
      req.user.role === 'officer' &&
      report.assignedTo !== req.user.officerId
    ) {
      return res.status(403).json({
        success: false,
        error: 'Officers can only resolve reports assigned to their own officer ID',
      });
    }

    const updatedReport = await Report.findByIdAndUpdate(
      req.params.id,
      { status: 'resolved' },
      { new: true, runValidators: true }
    );

    await invalidateAnalyticsCaches(ANALYTICS_CACHE_KEY);

    res.status(200).json({
      success: true,
      data: updatedReport,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get report hotspots
// @route   GET /api/reports/hotspots
// @access  Public
exports.getHotspots = async (req, res, next) => {
  try {
    const cachedHotspots = await getCachedPayload(HOTSPOT_CACHE_KEY);

    if (cachedHotspots) {
      return res.status(200).json({
        success: true,
        data: cachedHotspots,
        source: 'cache',
      });
    }

    const hotspots = await Report.aggregate(buildHotspotAggregation({}, 2));
    await setCachedPayload(HOTSPOT_CACHE_KEY, hotspots);

    res.status(200).json({
      success: true,
      data: hotspots,
      source: 'database',
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get dashboard summary statistics
// @route   GET /api/reports/stats
// @access  Private
exports.getDashboardStats = async (req, res, next) => {
  try {
    const baseMatch = getAccessMatchForUser(req.user);
    const { analytics } = await getOrBuildAnalytics(baseMatch);

    res.status(200).json({
      success: true,
      data: {
        total: analytics.totals.reports,
        pending: analytics.status.pending || 0,
        assigned: analytics.status.assigned || 0,
        resolved: analytics.status.resolved || 0,
        hotspots: analytics.totals.hotspots,
        highPriority: analytics.priority.high || 0,
        locationSource: analytics.locationSource,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get full analytics summary
// @route   GET /api/reports/analytics
// @access  Private (Admin)
exports.getAnalyticsSummary = async (req, res, next) => {
  try {
    const { analytics, source } = await getOrBuildAnalytics({}, true);

    res.status(200).json({
      success: true,
      data: analytics,
      source,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get stats for a specific officer
// @route   GET /api/reports/officer-stats/:officerId
// @access  Private (Officer/Admin)
exports.getOfficerStats = async (req, res, next) => {
  try {
    const { officerId } = req.params;

    if (
      req.user.role === 'officer' &&
      req.user.officerId !== officerId
    ) {
      return res.status(403).json({
        success: false,
        error: 'Officers can only view their own assignment metrics',
      });
    }

    const assigned = await Report.countDocuments({ assignedTo: officerId });
    const pending = await Report.countDocuments({
      assignedTo: officerId,
      status: 'assigned',
    });
    const resolved = await Report.countDocuments({
      assignedTo: officerId,
      status: 'resolved',
    });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const resolvedToday = await Report.countDocuments({
      assignedTo: officerId,
      status: 'resolved',
      updatedAt: { $gte: startOfToday },
    });

    const resolutionRate = assigned > 0 ? (resolved / assigned) * 100 : 0;

    res.status(200).json({
      success: true,
      data: {
        totalAssigned: assigned,
        pendingForOfficer: pending,
        resolved,
        resolvedToday,
        resolutionPercentage: resolutionRate.toFixed(1),
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get performance metrics for all officers
// @route   GET /api/reports/admin/officer-metrics
// @access  Private (Admin)
exports.getAdminOfficerMetrics = async (req, res, next) => {
  try {
    const { analytics } = await getOrBuildAnalytics({}, true);

    res.status(200).json({
      success: true,
      data: analytics.assignmentBreakdown,
    });
  } catch (err) {
    next(err);
  }
};
