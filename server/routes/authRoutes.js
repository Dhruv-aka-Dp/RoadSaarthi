const express = require('express');
const { register, login, getMe, getUsers } = require('../controllers/authController');
const { protect, optionalProtect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', optionalProtect, register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.get('/users', protect, authorize('admin'), getUsers);

module.exports = router;
