const mongoose = require('mongoose');

const projectMemberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    accessLevel: { type: String, enum: ['VIEW', 'EDIT', 'MANAGE'], required: true, default: 'VIEW' },
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
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
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: ['PLANNING', 'ACTIVE', 'ON_HOLD', 'DONE'],
      default: 'ACTIVE',
      index: true,
    },
    startDate: {
      type: Date,
      default: null,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    members: {
      type: [projectMemberSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

projectSchema.index({ workspace: 1, createdAt: -1 });
projectSchema.index({ workspace: 1, status: 1 });

module.exports = mongoose.model('Project', projectSchema);
