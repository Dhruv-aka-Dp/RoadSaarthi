const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

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
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@roadsaarthi.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    
    // Check if an admin already exists
    const adminExists = await User.findOne({ email: adminEmail });
    if (!adminExists) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(adminPassword, salt);
      
      await User.create({
        name: 'System Admin',
        email: adminEmail,
        password: hashedPassword,
        role: 'admin'
      });
      console.log('Default admin user created with email: ' + adminEmail);
    }
  } catch (error) {
    console.error('Error seeding admin user:', error);
  }
};

module.exports = connectDB;
