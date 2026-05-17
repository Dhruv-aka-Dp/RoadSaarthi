const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const getAdminCredentials = () => {
  const adminEmail = (
    process.env.ADMIN_EMAIL ||
    process.env.adminEmail ||
    'admin@roadsaarthi.com'
  )
    .trim()
    .toLowerCase();

  const adminPassword =
    process.env.ADMIN_PASSWORD ||
    process.env.adminPassword ||
    'admin123';

  return {
    adminEmail,
    adminPassword,
  };
};

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/roadsarthi');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Seed admin user
    await seedAdmin();
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

const seedAdmin = async () => {
  try {
    const { adminEmail, adminPassword } = getAdminCredentials();

    // Find the configured admin account, including password so we can sync credentials.
    const adminExists = await User.findOne({ email: adminEmail }).select('+password');

    if (!adminExists) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(adminPassword, salt);

      await User.create({
        name: 'System Admin',
        email: adminEmail,
        password: hashedPassword,
        role: 'admin',
      });
      console.log('Default admin user created with email: ' + adminEmail);
      return;
    }

    const passwordMatches = await bcrypt.compare(adminPassword, adminExists.password);
    const updates = {};

    if (adminExists.role !== 'admin') {
      updates.role = 'admin';
    }

    if (!passwordMatches) {
      const salt = await bcrypt.genSalt(10);
      updates.password = await bcrypt.hash(adminPassword, salt);
    }

    if (Object.keys(updates).length > 0) {
      await User.updateOne({ _id: adminExists._id }, updates);
      console.log('Configured admin credentials synchronized for: ' + adminEmail);
    }
  } catch (error) {
    console.error('Error seeding admin user:', error);
  }
};

module.exports = connectDB;
