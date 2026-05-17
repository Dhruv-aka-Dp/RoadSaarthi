const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { z } = require('zod');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'fallback_secret', {
    expiresIn: process.env.JWT_EXPIRE || '30d',
  });
};

const registerSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Please add a valid email'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    role: z.enum(['user', 'officer', 'admin']).optional(),
    officerId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === 'officer' && !data.officerId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['officerId'],
        message: 'Officer ID is required for officer accounts',
      });
    }
  });

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const validatedData = registerSchema.parse(req.body);
    const { name, email, password, role, officerId } = validatedData;
    const isAdminCreatingAccount = req.user?.role === 'admin';
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedOfficerId = officerId?.trim();
    const requestedRole = role || 'user';
    const finalRole = isAdminCreatingAccount
      ? requestedRole
      : requestedRole === 'officer'
        ? 'officer'
        : 'user';

    if (!isAdminCreatingAccount && requestedRole === 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin accounts cannot be created from public signup',
      });
    }

    if (finalRole === 'officer' && normalizedOfficerId) {
      const officerIdExists = await User.findOne({ officerId: normalizedOfficerId });

      if (officerIdExists) {
        return res.status(400).json({
          success: false,
          error: 'Officer ID already exists',
        });
      }
    }

    // Check if user exists
    const userExists = await User.findOne({ email: normalizedEmail });

    if (userExists) {
      return res.status(400).json({ success: false, error: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: finalRole,
      officerId: finalRole === 'officer' ? normalizedOfficerId || null : null,
    });

    if (user) {
      res.status(201).json({
        success: true,
        data: {
          _id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          officerId: user.officerId,
        },
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ success: false, error: 'Invalid user data' });
    }
  } catch (err) {
    next(err);
  }
};

const loginSchema = z.object({
  email: z.string().email('Please add a valid email'),
  password: z.string().min(1, 'Please enter a password'),
});

// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const validatedData = loginSchema.parse(req.body);
    const { email, password } = validatedData;
    const normalizedEmail = email.trim().toLowerCase();

    // Check for user email
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Check if password matches
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    res.status(200).json({
      success: true,
      data: {
        _id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        officerId: user.officerId,
      },
      token: generateToken(user._id),
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get user data
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.status(200).json({
      success: true,
      data: {
        _id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        officerId: user.officerId,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all users (for admin dashboard)
// @route   GET /api/auth/users
// @access  Private
exports.getUsers = async (req, res, next) => {
  try {
    const users = await User.find({}).select('-password');
    res.status(200).json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
};
