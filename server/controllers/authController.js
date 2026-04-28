const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sendEmail = require('../utils/sendEmail');

// Helper to generate JWT token
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET || 'fallback_secret_key', {
    expiresIn: '30d',
  });
};

// @desc    Register a new user
exports.signup = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Please provide all fields' });
    }

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, error: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: 'user'
    });

    // Send Welcome Email (Non-blocking)
    try {
      await sendEmail({
        to: user.email,
        subject: 'Welcome to RoadSaarthi!',
        text: `Hi ${user.name},\n\nWelcome to RoadSaarthi! Thank you for signing up . Let's make our roads safer together.\n\nBest regards,\nThe RoadSaarthi Team`
      });
    } catch (err) {
      console.error('Email sending failed:', err);
    }

    const token = generateToken(user._id, user.role);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Register a new officer
exports.officerSignup = async (req, res, next) => {
  try {
    const { name, email, officerCode } = req.body;

    if (!email || !officerCode) {
      return res.status(400).json({ success: false, error: 'Please provide email and officer code' });
    }

    // Verify Officer Code
    const expectedOfficerCode = process.env.OFFICER_SECRET || 'roadsaarthi_officer_2026';
    if (officerCode !== expectedOfficerCode) {
      return res.status(401).json({ success: false, error: 'Invalid officer code' });
    }

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, error: 'User already exists' });
    }

    // Create officer without a password
    const user = await User.create({
      name,
      email,
      role: 'officer'
    });

    // Send Welcome Email (Non-blocking)
    try {
      await sendEmail({
        to: user.email,
        subject: 'Officer Account Created - RoadSaarthi',
        text: `Hello ${user.name},\n\nYour officer account on RoadSaarthi has been successfully created. Thank you for your service.\n\nBest regards,\nThe RoadSaarthi Team`
      });
    } catch (err) {
      console.error('Email sending failed:', err);
    }

    const token = generateToken(user._id, user.role);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login user, officer, or admin
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, passwordOrCode } = req.body;

    if (!email || !passwordOrCode) {
      return res.status(400).json({ success: false, error: 'Please provide email and password/code' });
    }

    // 1. Admin Login (Hardcoded bypass)
    if (email === 'admin@roadsaarthi.com' && passwordOrCode === 'admin123') {
      const token = generateToken('admin_id', 'admin');
      return res.status(200).json({
        success: true,
        token,
        user: { id: 'admin_id', name: 'Admin', email, role: 'admin' }
      });
    }

    // 2. Lookup in database
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // 3. Verify based on role
    if (user.role === 'user') {
      const isMatch = await bcrypt.compare(passwordOrCode, user.password);
      if (!isMatch) {
        return res.status(401).json({ success: false, error: 'Invalid credentials' });
      }
    } else if (user.role === 'officer') {
      const expectedOfficerCode = process.env.OFFICER_SECRET || 'roadsaarthi_officer_2026';
      if (passwordOrCode !== expectedOfficerCode) {
        return res.status(401).json({ success: false, error: 'Invalid officer code' });
      }
    } else {
      return res.status(401).json({ success: false, error: 'Role login error' });
    }

    // 4. Issue Token
    const token = generateToken(user._id, user.role);
    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    next(error);
  }
};
