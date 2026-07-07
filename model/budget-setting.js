const mongoose = require('mongoose');

const budgetSettingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  ratios: {
    primer: { type: Number, default: 50 },
    sekunder: { type: Number, default: 30 },
    tabungan: { type: Number, default: 20 }
  }
}, {
  timestamps: true
});

budgetSettingSchema.index({ user: 1 }, { unique: true });

module.exports = mongoose.model('BudgetSetting', budgetSettingSchema);
