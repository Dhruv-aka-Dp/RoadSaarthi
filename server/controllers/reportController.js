const Report = require('../models/Report');
const { z } = require('zod');
const { processImage } = require('../utils/imageProcessor');
const sendEmail = require('../utils/sendEmail');

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
    let imageFilename = undefined;

    // Process image if it exists
    if (req.file) {
      const { lat, lng, filename } = await processImage(req.file.buffer, req.file.originalname);
      imageFilename = filename;
      
      // Override with GPS if found in EXIF
      if (lat !== null && lng !== null) {
        finalLat = lat;
        finalLng = lng;
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
    const nearbyReportsCount = await Report.countDocuments({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [finalLng, finalLat],
          },
          $maxDistance: 5000,
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
      image: imageFilename ? `/uploads/${imageFilename}` : 'no-photo.jpg',
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

    // If spatial parameters are provided, do a geo near query
    if (lng && lat && distance) {
      query.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
          $maxDistance: parseFloat(distance) * 1000, // Distance in meters (e.g., 5km = 5000)
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
    const hotspots = await Report.aggregate([
      {
        $project: {
          // Round coordinates to 2 decimal places (~1.1km precision)
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
          // Only consider it a hotspot if there's more than 1 report
          count: { $gt: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          lat: '$_id.lat',
          lng: '$_id.lng',
          count: 1,
          severity: {
            $switch: {
              branches: [
                { case: { $gte: ['$count', 5] }, then: 'high' },
                { case: { $gte: ['$count', 2] }, then: 'medium' },
              ],
              default: 'low',
            },
          },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: hotspots,
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
