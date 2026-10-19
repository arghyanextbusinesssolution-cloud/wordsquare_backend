const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  puzzleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Puzzle',
    required: true
  },
  userGrid: {
    type: [[String]],
    required: true
  },
  hintUsed: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
    default: 'pending'
  },
  reportType: {
    type: String,
    enum: ['bug', 'incorrect_solution', 'display_issue', 'other'],
    default: 'other'
  },
  description: {
    type: String,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  adminNotes: {
    type: String,
    maxlength: [1000, 'Admin notes cannot exceed 1000 characters']
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  resolvedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ puzzleId: 1 });
reportSchema.index({ userId: 1 });

module.exports = mongoose.model('Report', reportSchema);
