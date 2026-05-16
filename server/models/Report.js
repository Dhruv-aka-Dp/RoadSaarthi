const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please add a title'],
      trim: true,
      maxlength: [100, 'Title cannot be more than 100 characters'],
    },
    description: {
      type: String,
      required: [true, 'Please add a description'],
      maxlength: [500, 'Description cannot be more than 500 characters'],
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
      },
      coordinates: {
        type: [Number], // Array of numbers: [longitude, latitude]
        required: true,
      },
      address: String,
    },
    image: {
      type: String, // URL/Path to the stored image
      default: 'no-photo.jpg',
    },
    status: {
      type: String,
      enum: ['pending', 'assigned', 'resolved'],
      default: 'pending',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'low',
    },
    assignedTo: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      default: null, // Depending on if anonymous reports are allowed
    },
  },
  {
    timestamps: true,
  }
);

// Create 2dsphere index for GeoJSON location
reportSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Report', reportSchema);
