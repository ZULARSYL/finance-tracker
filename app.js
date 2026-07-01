const express = require('express');
const expressLayouts = require('express-ejs-layouts');

const session = require('express-session');
const cookieParser = require('cookie-parser');
const flash = require('connect-flash');
require('./utils/db');
const Transactions = require('./model/transaction');

const app = express();
const port = 3000;
app.use(express.urlencoded({ extended: true }));

//ejs
app.set('view engine', 'ejs');
app.use(expressLayouts);

//konfigurasi flash
app.use(cookieParser('secret'));
app.use(
  session({
    cookie: { maxAge: 6000 },
    secret: 'secret',
    resave: true,
    saveUninitialized: true,
  })
);
app.use(flash());

// Set current path for active navbar state
app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  next();
});

const getTransactionSummary = async () => {
  const transactions = await Transactions.find().sort({ tanggal: -1 });

  const totalIncome = transactions
    .filter(t => t.jenis === 'Pemasukan')
    .reduce((sum, t) => sum + t.nominal, 0);

  const totalExpense = transactions
    .filter(t => t.jenis === 'Pengeluaran')
    .reduce((sum, t) => sum + t.nominal, 0);

  const totalTransactions = transactions.length;
  const balance = totalIncome - totalExpense;
  const progress_pengeluaran = totalExpense !== 0 ? balance / totalExpense * 100 : 0;
  const progress_pemasukan = totalIncome !== 0 ? balance / totalIncome * 100 : 0;

// menampilkan bulan untuk sekarang
  const currentMonth = new Date().toLocaleDateString('id-ID', { 
    month: 'long', 
    year: 'numeric'
 });

  return {
    transactions,
    totalIncome,
    totalExpense,
    totalTransactions,
    balance,
    progress_pengeluaran,
    progress_pemasukan,
    currentMonth
  };
};

//route home
app.get('/', async (req, res) => {
  try {
    const summary = await getTransactionSummary();

    res.render('index', {
      layout: 'layouts/main-layout',
      nama: 'Zul Arsyl',
      title: 'Halaman Home',
      ...summary
    });
  } catch (error) {
    console.error('Error fetching home summary:', error);
    res.render('index', {
      layout: 'layouts/main-layout',
      nama: 'Zul Arsyl',
      title: 'Halaman Home',
      transactions: [],
      totalIncome: 0,
      totalExpense: 0,
      totalTransactions: 0,
      balance: 0,
      progress_pengeluaran: 0,
      progress_pemasukan: 0
    });
  }
});

//route budgeting
app.get('/budgeting', (req, res) => {
  // res.send('Hello World!');
  res.render('budgeting', {
    layout: 'layouts/main-layout',
    nama: 'Zul Arsyl',
    title: 'Halaman Budgeting'
  });
});


//route laporan
app.get('/laporan', (req, res) => {
  // res.send('Hello World!');
  res.render('laporan', {
    layout: 'layouts/main-layout',
    nama: 'Zul Arsyl',
    title: 'Halaman Laporan'
  });
});


//route transaksi
app.get('/transaksi', async(req, res) => {
  try {
    const summary = await getTransactionSummary();

    res.render('transaksi', {
      layout: 'layouts/main-layout',
      nama: 'Zul Arsyl',
      title: 'Halaman Transaksi',
      ...summary
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.render('transaksi', {
      layout: 'layouts/main-layout',
      nama: 'Zul Arsyl',
      title: 'Halaman Transaksi',
      transactions: [],
      totalIncome: 0,
      totalExpense: 0,
      totalTransactions: 0,
      balance: 0,
      currenMonth
    });
  }
});

app.get('/api/transaksi/:id', async(req, res) => {
  try {
    const transaction = await Transactions.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ message: 'Transaksi tidak ditemukan' });
    }

    res.json(transaction);
  } catch (error) {
    console.error('Error fetching transaction detail:', error);
    res.status(500).json({ message: 'Gagal mengambil detail transaksi' });
  }
});

app.post('/transaksi/pemasukan', async (req, res) => {
    try {
        const { kategori, jenis, nominal, tanggal, catatan } = req.body;

        await Transactions.create({
            kategori,
            jenis,
            nominal: Number(nominal),
            tanggal,
            catatan
        });

        res.redirect('/transaksi');
    } catch (error) {
        console.error(error);
        res.send('Gagal menyimpan data pemasukan');
    }
});

app.post('/transaksi/pengeluaran', async (req, res) => {
    try {
        const { kategori, jenis, nominal, tanggal, catatan } = req.body;

        await Transactions.create({
            kategori,
            jenis,
            nominal: Number(nominal),
            tanggal,
            catatan
        });

        res.redirect('/transaksi');
    } catch (error) {
        console.error(error);
        res.send('Gagal menyimpan data pengeluaran');
    }
});

app.post('/transaksi/:id/edit', async (req, res) => {
    try {
        const { kategori, jenis, nominal, tanggal, catatan } = req.body;

        await Transactions.findByIdAndUpdate(req.params.id, {
            kategori,
            jenis,
            nominal: Number(nominal),
            tanggal,
            catatan
        }, { new: true });

        res.redirect('/transaksi');
    } catch (error) {
        console.error(error);
        res.send('Gagal memperbarui data transaksi');
    }
});

app.post('/transaksi/:id/delete', async (req, res) => {
    try {
        await Transactions.findByIdAndDelete(req.params.id);

        res.redirect('/transaksi');
    } catch (err) {
        console.log(err);
        res.send('Gagal menghapus data');
    }
});
app.get('/about', (req, res) => {
  const mahasiswa = [
    {
      nama: 'Zul Arsyl',
      nim: '123456789'
    },
    {
      nama: 'Zul madjid',
      nim: '123456789'
    }
  ];

  res.render('about', {mahasiswa});
});

app.get('/login', (req, res) => {
  res.sendFile(__dirname + '/login.html');
});

app.use('/produk/:id', (req, res) => {
  res.send(`Produk id: ${req.params.id} Kategori: ${req.query.categorie}`);
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

