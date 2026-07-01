const mongoose = require('mongoose');

const goalSettingSchema = new mongoose.Schema({
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

module.exports = mongoose.model('GoalSetting', goalSettingSchema);
