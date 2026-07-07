const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tanggal: {
    type: Date,
    required: true
  },
  kategori: {
    type: String,
    required: true
  },
  jenis: {
    type: String,
    enum: ['Pemasukan', 'Pengeluaran'],
    required: true
  },
  catatan: {
    type: String,
    required: false
  },
  nominal: {
    type: Number,
    required: true
  }
});

module.exports = mongoose.model('Transaction', transactionSchema);