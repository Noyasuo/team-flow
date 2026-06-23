const mongoose = require('mongoose');

const workspaceMemberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'],
      default: 'MEMBER',
      required: true,
    },
  },
  { _id: false }
);

const workspaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    members: {
      type: [workspaceMemberSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

workspaceSchema.index({ owner: 1, createdAt: -1 });
workspaceSchema.index({ 'members.user': 1, createdAt: -1 });

module.exports = mongoose.model('Workspace', workspaceSchema);
