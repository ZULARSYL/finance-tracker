const mongoose = require('mongoose');

const goalSettingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    default: 'Target Menabung'
  },
  target: {
    type: Number,
    default: 15000000
  }
}, {
  timestamps: true
});

goalSettingSchema.index({ user: 1 }, { unique: true });

module.exports = mongoose.model('GoalSetting', goalSettingSchema);
