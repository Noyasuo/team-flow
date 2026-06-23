const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    kind: {
      type: String,
      enum: ['INFO', 'TASK', 'COMMENT', 'ASSIGNMENT'],
      default: 'INFO',
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
      index: true,
    },
    referenceType: {
      type: String,
      enum: ['TASK', 'PROJECT', 'COMMENT', 'WORKSPACE'],
      default: 'TASK',
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ user: 1, readAt: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
