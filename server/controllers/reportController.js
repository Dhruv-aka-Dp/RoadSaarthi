const Report = require('../models/Report');
const { z } = require('zod');
const { processImage } = require('../utils/imageProcessor');
const sendEmail = require('../utils/sendEmail');
const { getRedisClient } = require('../config/redis');

// Validation schema for creating a report
const createReportSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100),
  description: z.string().min(1, 'Description is required').max(500),
  // Make these optional here; we validate the final presence later 
  longitude: z.coerce.number().optional(),
  latitude: z.coerce.number().optional(),
});

// @desc    Create new report
// @route   POST /api/reports
// @access  Public (for now)
exports.createReport = async (req, res, next) => {
  try {
    // Validate input
    const validatedData = createReportSchema.parse(req.body);

    let finalLat = validatedData.latitude;
    let finalLng = validatedData.longitude;
    let imageUrl = undefined;

    // Process image if it exists (uploads to Cloudinary)
    if (req.file) {
      const result = await processImage(req.file.buffer, req.file.originalname);
      imageUrl = result.imageUrl;
      
      // Override with GPS if found in EXIF
      if (result.lat !== null && result.lng !== null) {
        finalLat = result.lat;
        finalLng = result.lng;
      }
    }

    // Fallback assertion
    if (finalLat === undefined || finalLng === undefined || isNaN(finalLat) || isNaN(finalLng)) {
      return res.status(400).json({
        success: false,
        error: 'Location coordinates (latitude and longitude) are required. They must be provided manually or embedded via image EXIF data.'
      });
    }

    // Determine priority based on nearby reports within 5km
    // Using $geoWithin/$centerSphere instead of $near because
    // countDocuments() uses aggregation internally where $near is not allowed
    const nearbyReportsCount = await Report.countDocuments({
      location: {
        $geoWithin: {
          $centerSphere: [
            [finalLng, finalLat],
            5 / 6378.1, // 5km radius in radians (Earth radius ≈ 6378.1 km)
          ],
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
      location: {
        type: 'Point',
        coordinates: [finalLng, finalLat],
      },
      priority,
    });

    // Send email notification for new report
    try {
      await sendEmail({
        to: process.env.CONTACT_EMAIL || 'admin@roadsaarthi.com',
        subject: `New Road Report: ${report.title}`,
        text: `A new road report has been submitted.\n\nTitle: ${report.title}\nDescription: ${report.description}\nPriority: ${priority}\nLocation: ${finalLat}, ${finalLng}`,
      });
    } catch (emailErr) {
      console.error('Email notification failed:', emailErr.message);
      // Don't fail the whole request if email fails
    }

    // Invalidate the hotspots cache on new report
    const redisClient = getRedisClient();
    if (redisClient && redisClient.isReady) {
      await redisClient.del('hotspots');
    }

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
// @access  Public
exports.getReports = async (req, res, next) => {
  try {
    const { lng, lat, distance } = req.query;

    let query = {};

    // If spatial parameters are provided, do a geo query
    if (lng && lat && distance) {
      query.location = {
        $geoWithin: {
          $centerSphere: [
            [parseFloat(lng), parseFloat(lat)],
            parseFloat(distance) / 6378.1, // Convert km to radians (Earth radius ≈ 6378.1 km)
          ],
        },
      };
    }

    const reports = await Report.find(query);

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
// @access  Private (Admin/Officer role ideally)
exports.assignReport = async (req, res, next) => {
  try {
    const { officerId } = req.body;

    if (!officerId) {
      return res.status(400).json({ success: false, error: 'Please provide an officerId' });
    }

    let report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({ success: false, error: `Report not found with id ${req.params.id}` });
    }

    report = await Report.findByIdAndUpdate(
      req.params.id,
      { assignedTo: officerId, status: 'assigned' },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Resolve report
// @route   PATCH /api/reports/:id/resolve
// @access  Private (Admin/Officer role ideally)
exports.resolveReport = async (req, res, next) => {
  try {
    let report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({ success: false, error: `Report not found with id ${req.params.id}` });
    }

    report = await Report.findByIdAndUpdate(
      req.params.id,
      { status: 'resolved' },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: report,
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
    const redisClient = getRedisClient();

    // 1. Check cache first
    if (redisClient && redisClient.isReady) {
      const cachedHotspots = await redisClient.get('hotspots');
      if (cachedHotspots) {
        return res.status(200).json({
          success: true,
          data: JSON.parse(cachedHotspots),
          source: 'cache'
        });
      }
    }

    const rawFacets = await Report.aggregate([
      {
        $facet: {
          densityBuckets: [
            // 1. Project and round coordinates
            {
              $project: {
                roundedLng: { $round: [{ $arrayElemAt: ['$location.coordinates', 0] }, 2] },
                roundedLat: { $round: [{ $arrayElemAt: ['$location.coordinates', 1] }, 2] },
              },
            },
            // 2. Group to count reports per rounded zone
            {
              $group: {
                _id: { lng: '$roundedLng', lat: '$roundedLat' },
                count: { $sum: 1 },
              },
            },
            // 3. Match only zones with > 1 reports (hotspots)
            {
              $match: {
                count: { $gt: 1 },
              },
            },
            // 4. Bucket the zones by their count severity
            {
              $bucket: {
                groupBy: '$count',
                boundaries: [2, 5, 10000], // [2, 5) -> medium, [5, 10000) -> high
                default: 10000,
                output: {
                  zones: {
                    $push: { lat: '$_id.lat', lng: '$_id.lng', count: '$count' },
                  },
                },
              },
            },
          ],
        },
      },
    ]);

    // Flatten the buckets into the format expected by the frontend
    const hotspots = [];
    if (rawFacets.length > 0 && rawFacets[0].densityBuckets) {
      rawFacets[0].densityBuckets.forEach((bucket) => {
        let severity = 'low'; // default fallback
        if (bucket._id === 2) severity = 'medium';
        else if (bucket._id === 5) severity = 'high';

        bucket.zones.forEach((zone) => {
          hotspots.push({
            lat: zone.lat,
            lng: zone.lng,
            count: zone.count,
            severity,
          });
        });
      });
    }

    // 2. Save to cache with 10-minute TTL (600 seconds)
    if (redisClient && redisClient.isReady) {
      await redisClient.setEx('hotspots', 600, JSON.stringify(hotspots));
    }

    res.status(200).json({
      success: true,
      data: hotspots,
      source: 'database'
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get dashboard summary statistics
// @route   GET /api/reports/stats
// @access  Public
exports.getDashboardStats = async (req, res, next) => {
  try {
    const totalReports = await Report.countDocuments();
    const pendingReports = await Report.countDocuments({ status: 'pending' });
    const assignedReports = await Report.countDocuments({ status: 'assigned' });
    const resolvedReports = await Report.countDocuments({ status: 'resolved' });
    
    // Calculate hotspots count (re-using the logic from getHotspots)
    const hotspotData = await Report.aggregate([
      {
        $project: {
          roundedLng: { $round: [{ $arrayElemAt: ['$location.coordinates', 0] }, 2] },
          roundedLat: { $round: [{ $arrayElemAt: ['$location.coordinates', 1] }, 2] },
        },
      },
      {
        $group: {
          _id: { lng: '$roundedLng', lat: '$roundedLat' },
          count: { $sum: 1 },
        },
      },
      {
        $match: {
          count: { $gt: 1 },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        total: totalReports,
        pending: pendingReports,
        assigned: assignedReports,
        resolved: resolvedReports,
        hotspots: hotspotData.length,
      },
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

    const assigned = await Report.countDocuments({ assignedTo: officerId });
    const pending = await Report.countDocuments({ assignedTo: officerId, status: 'assigned' }); // Pending for this officer
    const resolved = await Report.countDocuments({ assignedTo: officerId, status: 'resolved' });
    
    // Resolved today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const resolvedToday = await Report.countDocuments({ 
      assignedTo: officerId, 
      status: 'resolved',
      updatedAt: { $gte: startOfToday }
    });

    const resolutionRate = assigned > 0 ? (resolved / assigned) * 100 : 0;

    res.status(200).json({
      success: true,
      data: {
        totalAssigned: assigned,
        pendingForOfficer: pending,
        resolved: resolved,
        resolvedToday: resolvedToday,
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
    const metrics = await Report.aggregate([
      {
        $match: { assignedTo: { $ne: null } }
      },
      {
        $group: {
          _id: '$assignedTo',
          totalAssigned: { $sum: 1 },
          resolved: {
            $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
          },
          pending: {
            $sum: { $cond: [{ $eq: ['$status', 'assigned'] }, 1, 0] }
          }
        }
      },
      {
        $project: {
          officerId: '$_id',
          totalAssigned: 1,
          resolved: 1,
          pending: 1,
          resolutionRate: {
            $multiply: [{ $divide: ['$resolved', '$totalAssigned'] }, 100]
          }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: metrics,
    });
  } catch (err) {
    next(err);
  }
};
