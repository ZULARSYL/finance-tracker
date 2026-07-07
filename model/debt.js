const mongoose = require('mongoose');

const debtSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  nominal: {
    type: Number,
    required: true
  },
  deskripsi: {
    type: String,
    default: 'Hutang'
  },
  tanggalJatuhTempo: {
    type: Date,
    required: true
  },
  statusPembayaran: {
    type: String,
    enum: ['belum', 'sudah'],
    default: 'belum'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Debt', debtSchema);
