const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const { connectRedis } = require('./config/redis');
const errorHandler = require('./middleware/errorHandler');

// Load env vars
dotenv.config();

// Connect to databases
connectDB();
connectRedis();

const app = express();

// Body parser
app.use(express.json());

// Enable CORS
app.use(cors());

// Serve static uploads folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// Route files
const reportRoutes = require('./routes/reportRoutes');
const contactRoutes = require('./routes/contactRoutes');
const authRoutes = require('./routes/authRoutes');

// Mount routers
app.use('/api/reports', reportRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/auth', authRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Roadsarthi API is running' });
});

// Use error handler middleware (must be after routes)
app.use(errorHandler);

module.exports = app;
