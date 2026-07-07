const express = require('express');
const expressLayouts = require('express-ejs-layouts');

const session = require('express-session');
const cookieParser = require('cookie-parser');
const flash = require('connect-flash');
require('./utils/db');
const bcrypt = require('bcryptjs');
const User = require('./model/user');


const Transactions = require('./model/transaction');
const BudgetSetting = require('./model/budget-setting');
const GoalSetting = require('./model/goal-setting');
const Debt = require('./model/debt');
const { calculateBudgetSummary, DEFAULT_RATIOS } = require('./utils/budgeting');

const app = express();
const port = 3000;
app.use(express.urlencoded({ extended: true }));

//ejs
app.set('view engine', 'ejs');
app.use(expressLayouts);
const path = require('path');

// serve static assets from /public
app.use(express.static(path.join(__dirname, 'public')));

//konfigurasi flash
app.use(cookieParser('secret'));
// session cookie set to 3 days
app.use(
  session({
    cookie: { maxAge: 3 * 24 * 60 * 60 * 1000 },
    secret: 'secret',
    resave: true,
    saveUninitialized: true,
  })
);
app.use(flash());

app.use((req, res, next) => {
  res.locals.messages = {
    success: req.flash('success'),
    error: req.flash('error')
  };
  next();
});

// expose current user to views
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  next();
});

// simple auth middleware: allow /login, /register, static assets, otherwise require session
app.use((req, res, next) => {
  const openPaths = ['/login', '/logout', '/register'];
  if (openPaths.includes(req.path) || req.path.startsWith('/public') || req.path.startsWith('/assets') || req.path.startsWith('/css') || req.path.startsWith('/js')) {
    return next();
  }

  if (!req.session.user) {
    return res.redirect('/login');
  }

  next();
});

// Set current path for active navbar state
app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  next();
});

// Middleware untuk fetch notifikasi hutang
app.use(async (req, res, next) => {
  try {
    if (!req.session.user) {
      res.locals.debts = [];
      res.locals.notificationDebts = [];
      res.locals.debtNotificationCount = 0;
      return next();
    }

    const debts = await Debt.find({ user: req.session.user.id, statusPembayaran: 'belum' }).sort({ tanggalJatuhTempo: 1 });
    
    // Detect hutang yang jatuh tempo dalam 3 hari ke depan
    const now = new Date();
    const threeRaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    
    const notificationDebts = debts.filter(d => {
      const dueDate = new Date(d.tanggalJatuhTempo);
      return dueDate <= threeRaysLater && dueDate >= now;
    });
    
    res.locals.debts = debts;
    res.locals.notificationDebts = notificationDebts;
    res.locals.debtNotificationCount = notificationDebts.length;
    
    next();
  } catch (error) {
    console.error('Error fetching debts:', error);
    res.locals.debts = [];
    res.locals.notificationDebts = [];
    res.locals.debtNotificationCount = 0;
    next();
  }
});

const getTransactionSummary = async (userId) => {
  const transactions = await Transactions.find({ user: userId }).sort({ tanggal: -1 });

  const totalIncome = transactions
    .filter(t => t.jenis === 'Pemasukan')
    .reduce((sum, t) => sum + t.nominal, 0);

  const totalExpense = transactions
    .filter(t => t.jenis === 'Pengeluaran')
    .reduce((sum, t) => sum + t.nominal, 0);

  const totalTransactions = transactions.length;
  const balance = totalIncome - totalExpense;
  const progress_pengeluaran = totalExpense !== 0 ? (totalExpense / totalIncome) * 100 : 0;
  const progress_pemasukan = totalIncome !== 0 ? balance / totalIncome * 100 : 0;

// menampilkan bulan untuk sekarang
  const currentMonth = new Date().toLocaleDateString('id-ID', { 
    month: 'long', 
    year: 'numeric'
 });

// laporan pemasukan
 const IncomeTransactions = transactions.filter(t => t.jenis === 'Pemasukan');
 const ExpenseTransactions = transactions.filter(t => t.jenis === 'Pengeluaran');
 const totalIncomeTransactions = IncomeTransactions.length;
 const totalExpenseTransactions = ExpenseTransactions.length;
 const TabunganReport = transactions.filter(t => t.kategori === 'Tabungan').reduce((total, transaksi) => total + transaksi.nominal, 0);

  return {
    transactions,
    totalIncome,
    totalExpense,
    totalTransactions,
    balance,
    progress_pengeluaran,
    progress_pemasukan,
    currentMonth,
    IncomeTransactions,
    ExpenseTransactions,
    totalIncomeTransactions,
    totalExpenseTransactions,
    TabunganReport
  };
};

const getMonthlyChartData = (transactions = []) => {
  // Get 12 months of data
  const now = new Date();
  const months = [];
  const monthLabels = [];
  const incomeByMonth = [];
  const expenseByMonth = [];
  
  // Prepare data for last 12 months
  for (let i = 11; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Get month name
    const monthName = monthDate.toLocaleDateString('id-ID', { month: 'short' });
    monthLabels.push(monthName);
    
    // Filter and aggregate transactions for this month
    const monthTransactions = transactions.filter(t => {
      const date = new Date(t.tanggal);
      return date >= firstDay && date <= lastDay;
    });
    
    const income = monthTransactions
      .filter(t => t.jenis === 'Pemasukan')
      .reduce((sum, t) => sum + Number(t.nominal || 0), 0);
    
    const expense = monthTransactions
      .filter(t => t.jenis === 'Pengeluaran')
      .reduce((sum, t) => sum + Number(t.nominal || 0), 0);
    
    incomeByMonth.push(income);
    expenseByMonth.push(expense);
  }
  
  return {
    labels: monthLabels,
    datasets: [
      {
        label: 'Pemasukan',
        data: incomeByMonth,
        backgroundColor: '#0A5C15',
        borderRadius: 8,
        borderSkipped: false
      },
      {
        label: 'Pengeluaran',
        data: expenseByMonth,
        backgroundColor: '#64b5e6',
        borderRadius: 8,
        borderSkipped: false
      }
    ]
  };
};

//route home
app.get('/', async (req, res) => {
  try {
    const summary = await getTransactionSummary(req.session.user.id);

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
app.get('/budgeting', async (req, res) => {
  try {
    const [settingsDoc, goalDoc, transactions] = await Promise.all([
      BudgetSetting.findOne({ user: req.session.user.id }),
      GoalSetting.findOne({ user: req.session.user.id }),
      Transactions.find({ user: req.session.user.id }).sort({ tanggal: -1 })
    ]);

    const summary = calculateBudgetSummary(transactions, settingsDoc ? settingsDoc.ratios : DEFAULT_RATIOS);
    const goalTarget = goalDoc ? Number(goalDoc.target || 0) : 0;
    const goalTitle = goalDoc ? goalDoc.title : 'Target Menabung';
    const goalCurrent = summary.used.tabungan;
    const goalPercent = goalTarget > 0 ? Math.min(100, (goalCurrent / goalTarget) * 100) : 0;

    res.render('budgeting', {
      layout: 'layouts/main-layout',
      nama: 'Zul Arsyl',
      title: 'Halaman Budgeting',
      ...summary,
      ratios: summary.ratios,
      progressPrimerPercent: summary.progress.primer,
      progressSekunderPercent: summary.progress.sekunder,
      progressTabunganPercent: summary.progress.tabungan,
      goalTarget,
      goalCurrent,
      goalPercent,
      goalTitle
    });
  } catch (error) {
    console.error('Error fetching budgeting summary:', error);
    res.render('budgeting', {
      layout: 'layouts/main-layout',
      nama: 'Zul Arsyl',
      title: 'Halaman Budgeting',
      transactions: [],
      totalIncome: 0,
      totalExpense: 0,
      balance: 0,
      totalBudget: 0,
      allocation: { primer: 0, sekunder: 0, tabungan: 0 },
      used: { primer: 0, sekunder: 0, tabungan: 0 },
      usedTotal: 0,
      remaining: 0,
      usagePercent: 0,
      progress: { primer: 0, sekunder: 0, tabungan: 0 },
      ratios: DEFAULT_RATIOS,
      goalTarget: 0,
      goalCurrent: 0,
      goalPercent: 0,
      goalTitle: 'Target Menabung',
      progressPrimerPercent: 0,
      progressSekunderPercent: 0,
      progressTabunganPercent: 0,
      currentMonthLabel: new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
      insight: {
        primer: 'Pengeluaran primer masih aman.',
        sekunder: 'Budget sekunder masih terkontrol.',
        tabungan: 'Tabungan masih perlu ditingkatkan.'
      }
    });
  }
});

app.post('/budgeting/ratio', async (req, res) => {
  try {
    const { primer, sekunder, tabungan } = req.body;
    const ratios = {
      primer: Number(primer),
      sekunder: Number(sekunder),
      tabungan: Number(tabungan)
    };

    const total = ratios.primer + ratios.sekunder + ratios.tabungan;
    if (total !== 100) {
      req.flash('error', 'Total rasio harus 100%');
      return res.redirect('/budgeting');
    }

    await BudgetSetting.findOneAndUpdate(
      { user: req.session.user.id },
      { user: req.session.user.id, ratios },
      { upsert: true, new: true }
    );

    req.flash('success', 'Rasio budget berhasil disimpan');
    res.redirect('/budgeting');
  } catch (error) {
    console.error('Error saving budget ratio:', error);
    req.flash('error', 'Gagal menyimpan rasio budget');
    res.redirect('/budgeting');
  }
});

app.post('/budgeting/goal', async (req, res) => {
  try {
    const { title, target } = req.body;

    await GoalSetting.findOneAndUpdate(
      { user: req.session.user.id },
      {
        user: req.session.user.id,
        title: title || 'Target Menabung',
        target: Number(target || 0)
      },
      { upsert: true, new: true }
    );

    req.flash('success', 'Target goal berhasil disimpan');
    res.redirect('/budgeting');
  } catch (error) {
    console.error('Error saving goal:', error);
    req.flash('error', 'Gagal menyimpan target goal');
    res.redirect('/budgeting');
  }
});


//route laporan
app.get('/laporan', async (req, res) => {
  try {
    const [settingsDoc, goalDoc, transactions] = await Promise.all([
      BudgetSetting.findOne({ user: req.session.user.id }),
      GoalSetting.findOne({ user: req.session.user.id }),
      Transactions.find({ user: req.session.user.id }).sort({ tanggal: -1 })
    ]);

    const summary = await getTransactionSummary(req.session.user.id);
    const summary2 = calculateBudgetSummary(transactions, settingsDoc ? settingsDoc.ratios : DEFAULT_RATIOS);
    const budgetSetting = await BudgetSetting.findOne({ user: req.session.user.id });
    const ratioPrimer = budgetSetting.ratios.primer;
    const ratioSekunder = budgetSetting.ratios.sekunder;
    const ratioTabungan = budgetSetting.ratios.tabungan;
    const chartData = getMonthlyChartData(transactions);

    res.render('laporan', {
      layout: 'layouts/main-layout',
      nama: 'Zul Arsyl',
      title: 'Halaman laporan',
      ...summary,
      ratios: summary2.ratios,
      allocation: summary2.allocation,
      used: summary2.used,
      progressPrimerPercent: summary2.progress.primer,
      progressSekunderPercent: summary2.progress.sekunder,
      progressTabunganPercent: summary2.progress.tabungan,
      ratioPrimer,
      ratioSekunder,
      ratioTabungan,
      chartData: JSON.stringify(chartData)
    });
  } catch (error) {
    console.error('Error fetching home summary:', error);
    const emptyChartData = {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      datasets: [
        { 
          label: 'Pemasukan', 
          data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
          backgroundColor: '#0A5C15',
          borderRadius: 8,
          borderSkipped: false
        },
        { 
          label: 'Pengeluaran', 
          data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
          backgroundColor: '#64b5e6',
          borderRadius: 8,
          borderSkipped: false
        }
      ]
    };
    res.render('laporan', {
      layout: 'layouts/main-layout',
      nama: 'Zul Arsyl',
      title: 'Halaman Laporan',
      transactions: [],
      allocation: { primer: 0, sekunder: 0, tabungan: 0 },
      used: { primer: 0, sekunder: 0, tabungan: 0 },
      usedTotal: 0,
      remaining: 0,
      usagePercent: 0,
      progress: { primer: 0, sekunder: 0, tabungan: 0 },
      ratios: DEFAULT_RATIOS,
      totalIncome: 0,
      totalExpense: 0,
      totalTransactions: 0,
      balance: 0,
      progress_pengeluaran: 0,
      progress_pemasukan: 0,
      IncomeTransactions: [],
      ExpenseTransactions: [],
      totalIncomeTransactions: 0,
      totalExpenseTransactions: 0,
      TabunganReport: 0,
      ratioTabungan: 20,
      ratioPrimer: 50,
      ratioSekunder: 30,
      progressPrimerPercent: 0,
      progressSekunderPercent: 0,
      progressTabunganPercent: 0,
      chartData: JSON.stringify(emptyChartData)
    });
  }
});

//route transaksi
app.get('/transaksi', async(req, res) => {
  try {
    const summary = await getTransactionSummary(req.session.user.id);

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
    const transaction = await Transactions.findOne({ _id: req.params.id, user: req.session.user.id });

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
            user: req.session.user.id,
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
            user: req.session.user.id,
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

        await Transactions.findOneAndUpdate(
            { _id: req.params.id, user: req.session.user.id },
            {
                kategori,
                jenis,
                nominal: Number(nominal),
                tanggal,
                catatan
            },
            { new: true }
        );

        res.redirect('/transaksi');
    } catch (error) {
        console.error(error);
        res.send('Gagal memperbarui data transaksi');
    }
});

app.post('/transaksi/:id/delete', async (req, res) => {
    try {
        await Transactions.findOneAndDelete({ _id: req.params.id, user: req.session.user.id });

        res.redirect('/transaksi');
    } catch (err) {
        console.log(err);
        res.send('Gagal menghapus data');
    }
});

// render login page
app.get('/login', (req, res) => {
  res.render('login', { layout: false, title: 'Login' });
});

// handle login post
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) {
      req.flash('error', 'Username atau password salah');
      return res.redirect('/login');
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      req.flash('error', 'Username atau password salah');
      return res.redirect('/login');
    }

    req.session.user = { id: user._id.toString(), username: user.username };
    req.flash('success', 'Berhasil login');
    res.redirect('/');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Terjadi kesalahan pada server');
    res.redirect('/login');
  }
});

// logout
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    res.redirect('/login');
  });
});

// ensure there is at least one default admin user
(async () => {
  try {
    const count = await User.countDocuments();
    if (count === 0) {
      const hash = await bcrypt.hash('admin', 10);
      await User.create({ username: 'admin', password: hash });
      console.log('Default admin user created (username: admin, password: admin)');
    }
  } catch (err) {
    console.error('Error ensuring default user:', err);
  }
})();

//ROUTES REGISTER
app.get('/register', (req, res) => {
  res.render('register', { layout: false, title: 'Register' });
});

app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    req.flash('error', 'Username dan password wajib diisi');
    return res.redirect('/register');
  }

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      req.flash('error', 'Username sudah terdaftar');
      return res.redirect('/register');
    }

    const hash = await bcrypt.hash(password, 10);
    const newUser = await User.create({ username, password: hash });

    req.session.user = { id: newUser._id.toString(), username: newUser.username };
    req.flash('success', 'Akun berhasil dibuat dan Anda telah login');
    res.redirect('/');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Terjadi kesalahan saat membuat akun');
    res.redirect('/register');
  }
});

// ROUTES DEBT (Pengingat Hutang)
// Tambah hutang
app.post('/debt/add', async (req, res) => {
  try {
    const { nominal, deskripsi, tanggalJatuhTempo } = req.body;

    const newDebt = new Debt({
      user: req.session.user.id,
      nominal: Number(nominal),
      deskripsi: deskripsi || 'Hutang',
      tanggalJatuhTempo: new Date(tanggalJatuhTempo)
    });

    await newDebt.save();
    req.flash('success', 'Hutang berhasil ditambahkan');
    res.redirect(req.header('referer') || '/');
  } catch (error) {
    console.error('Error adding debt:', error);
    req.flash('error', 'Gagal menambahkan hutang');
    res.redirect(req.header('referer') || '/');
  }
});

// Mark hutang sebagai sudah dibayar
app.post('/debt/mark-paid/:id', async (req, res) => {
  try {
    await Debt.findOneAndUpdate(
      { _id: req.params.id, user: req.session.user.id },
      { statusPembayaran: 'sudah' }
    );
    req.flash('success', 'Hutang berhasil ditandai sudah dibayar');
    res.redirect(req.header('referer') || '/');
  } catch (error) {
    console.error('Error marking debt as paid:', error);
    req.flash('error', 'Gagal memperbarui status hutang');
    res.redirect(req.header('referer') || '/');
  }
});

// Hapus hutang
app.post('/debt/delete/:id', async (req, res) => {
  try {
    await Debt.findOneAndDelete({ _id: req.params.id, user: req.session.user.id });
    req.flash('success', 'Hutang berhasil dihapus');
    res.redirect(req.header('referer') || '/');
  } catch (error) {
    console.error('Error deleting debt:', error);
    req.flash('error', 'Gagal menghapus hutang');
    res.redirect(req.header('referer') || '/');
  }
});

// start server with simple retry on EADDRINUSE (try next port)
const startServer = (p) => {
  const srv = app.listen(p, () => {
    console.log(`Example app listening on port ${p}`);
  });

  srv.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.warn(`Port ${p} in use, trying port ${p + 1}...`);
      setTimeout(() => startServer(p + 1), 200);
    } else {
      console.error('Server error:', err);
      process.exit(1);
    }
  });
};

startServer(port);