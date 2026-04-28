const express = require('express');
const { signup, officerSignup, login } = require('../controllers/authController');

const router = express.Router();

router.post('/signup', signup);
router.post('/officer-signup', officerSignup);
router.post('/login', login);

module.exports = router;
