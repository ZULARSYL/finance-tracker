const mongoose = require('mongoose');

const budgetSettingSchema = new mongoose.Schema({
  ratios: {
    primer: { type: Number, default: 50 },
    sekunder: { type: Number, default: 30 },
    tabungan: { type: Number, default: 20 }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('BudgetSetting', budgetSettingSchema);
