const express = require('express');
const {
  createReport,
  getReports,
  assignReport,
  resolveReport,
  getHotspots,
  getDashboardStats,
  getOfficerStats,
  getAdminOfficerMetrics,
  getAnalyticsSummary,
} = require('../controllers/reportController');

const upload = require('../middleware/upload');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.route('/hotspots')
  .get(getHotspots);

router.route('/stats')
  .get(protect, getDashboardStats);

router.route('/analytics')
  .get(protect, authorize('admin'), getAnalyticsSummary);

router.route('/officer-stats/:officerId')
  .get(protect, authorize('officer', 'admin'), getOfficerStats);

router.route('/admin/officer-metrics')
  .get(protect, authorize('admin'), getAdminOfficerMetrics);

router.route('/')
  .get(protect, getReports)
  .post(protect, upload.single('image'), createReport);

router.route('/:id/assign')
  .patch(protect, authorize('admin'), assignReport);

router.route('/:id/resolve')
  .patch(protect, authorize('officer', 'admin'), resolveReport);

module.exports = router;
