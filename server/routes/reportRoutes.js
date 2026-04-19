const express = require('express');
const {
  createReport,
  getReports,
  assignReport,
  resolveReport,
} = require('../controllers/reportController');

const upload = require('../middleware/upload');

const router = express.Router();

router.route('/')
  .get(getReports)
  .post(upload.single('image'), createReport);

router.route('/:id/assign')
  .patch(assignReport);

router.route('/:id/resolve')
  .patch(resolveReport);

module.exports = router;
