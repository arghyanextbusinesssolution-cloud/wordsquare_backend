const mongoose = require('mongoose');

const adminLogSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'puzzle_created',
      'puzzle_updated',
      'puzzle_deleted',
      'user_banned',
      'user_unbanned',
      'user_deleted',
      'report_resolved',
      'settings_changed',
      'admin_login',
      'announcement_created',
      'announcement_updated',
      'announcement_deleted'
    ]
  },
  targetType: {
    type: String,
    enum: ['puzzle', 'user', 'report', 'settings', 'announcement'],
    required: true
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
adminLogSchema.index({ adminId: 1, createdAt: -1 });
adminLogSchema.index({ action: 1, createdAt: -1 });
adminLogSchema.index({ targetType: 1, targetId: 1 });

// Static method to log admin action
adminLogSchema.statics.logAction = async function (adminId, action, targetType, targetId = null, details = {}, req = null) {
  return this.create({
    adminId,
    action,
    targetType,
    targetId,
    details,
    ipAddress: req?.ip || req?.connection?.remoteAddress,
    userAgent: req?.get('User-Agent')
  });
};

module.exports = mongoose.model('AdminLog', adminLogSchema);
