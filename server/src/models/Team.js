const mongoose = require('mongoose');

const teamMemberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['ADMIN', 'MANAGER', 'MEMBER', 'CLIENT'],
      required: true,
      default: 'MEMBER',
    },
  },
  { _id: false }
);

const teamSchema = new mongoose.Schema(
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
      type: [teamMemberSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

teamSchema.index({ owner: 1, createdAt: -1 });
teamSchema.index({ 'members.user': 1, createdAt: -1 });

module.exports = mongoose.model('Team', teamSchema);
