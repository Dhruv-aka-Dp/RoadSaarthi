const jwt = require('jsonwebtoken');
const User = require('../models/User');

const getTokenFromRequest = (req) => {
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    return req.headers.authorization.split(' ')[1];
  }

  return null;
};

const attachUserFromToken = async (token, req) => {
  const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
  req.user = await User.findById(decoded.id).select('-password');
  return req.user;
};

const protect = async (req, res, next) => {
  const token = getTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({ success: false, error: 'Not authorized, no token' });
  }

  try {
    const user = await attachUserFromToken(token, req);

    if (!user) {
      return res.status(401).json({ success: false, error: 'Not authorized, user not found' });
    }

    next();
  } catch (error) {
    console.error(error);
    return res.status(401).json({ success: false, error: 'Not authorized, token failed' });
  }
};

const optionalProtect = async (req, res, next) => {
  const token = getTokenFromRequest(req);

  if (!token) {
    return next();
  }

  try {
    await attachUserFromToken(token, req);
  } catch (error) {
    console.warn('Ignoring invalid optional auth token:', error.message);
  }

  next();
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized, no authenticated user found',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
          success: false, 
          error: `User role ${req.user.role} is not authorized to access this route` 
      });
    }
    next();
  };
};

module.exports = { protect, optionalProtect, authorize };
