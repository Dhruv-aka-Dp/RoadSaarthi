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
} = require('../controllers/reportController');

const upload = require('../middleware/upload');

const router = express.Router();

router.route('/hotspots')
  .get(getHotspots);

router.route('/stats')
  .get(getDashboardStats);

router.route('/officer-stats/:officerId')
  .get(getOfficerStats);

router.route('/admin/officer-metrics')
  .get(getAdminOfficerMetrics);

router.route('/')
  .get(getReports)
  .post(upload.single('image'), createReport);

router.route('/:id/assign')
  .patch(assignReport);

router.route('/:id/resolve')
  .patch(resolveReport);

module.exports = router;
