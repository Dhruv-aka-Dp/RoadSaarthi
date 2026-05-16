const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Body parser
app.use(express.json());

// Enable CORS
app.use(cors());

// Static folder for uploads
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Route files
const reportRoutes = require('./routes/reportRoutes');
const contactRoutes = require('./routes/contactRoutes');

// Mount routers
app.use('/api/reports', reportRoutes);
app.use('/api/contact', contactRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Roadsarthi API is running' });
});

// Use error handler middleware (must be after routes)
app.use(errorHandler);

module.exports = app;
