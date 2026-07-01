const mongoose = require('mongoose');

//schema
const Transactions = mongoose.model('Transaction', {
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

module.exports = Transactions;