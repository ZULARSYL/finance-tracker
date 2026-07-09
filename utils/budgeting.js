const DEFAULT_RATIOS = { primer: 50, sekunder: 30, tabungan: 20 };

const CATEGORY_GROUPS = {
  primer: ['makan', 'transportasi', 'komunikasi', 'pendidikan'],
  sekunder: ['olahraga', 'belanja', 'hiburan'],
  tabungan: ['tabungan', 'investasi', 'darurat']
};

const normalizeRatios = (ratios = {}) => ({
  primer: Number(ratios.primer ?? DEFAULT_RATIOS.primer),
  sekunder: Number(ratios.sekunder ?? DEFAULT_RATIOS.sekunder),
  tabungan: Number(ratios.tabungan ?? DEFAULT_RATIOS.tabungan)
});

const getCategoryGroup = (category = '') => {
  const normalized = String(category).trim().toLowerCase();

  if (CATEGORY_GROUPS.primer.includes(normalized)) return 'primer';
  if (CATEGORY_GROUPS.sekunder.includes(normalized)) return 'sekunder';
  if (CATEGORY_GROUPS.tabungan.includes(normalized)) return 'tabungan';

  return 'lainnya';
};

const sumTransactions = (transactions = [], predicate) => {
  return transactions.reduce((total, transaction) => {
    return predicate(transaction) ? total + Number(transaction.nominal || 0) : total;
  }, 0);
};

const getBudgetExpenseAmount = (transaction) => {
  return transaction.jenis === 'Pengeluaran' ? Number(transaction.nominal || 0) : 0;
};

const calculateBudgetSummary = (transactions = [], settings = {}, month = null) => {
  const ratios = normalizeRatios(settings);
  // const now = new Date();
  // const start = new Date(now.getFullYear(), now.getMonth(), 1);
  // const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  let start;
  let end;
  let currentDate;

  if (month) {

      currentDate = new Date(month + "-01");

  } else {

      currentDate = new Date();

  }

  start = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1
  );

  end = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
  );

  const monthTransactions = (transactions || []).filter((transaction) => {
    const date = new Date(transaction.tanggal);
    return !Number.isNaN(date.getTime()) && date >= start && date <= end;
  });

  const totalIncome = sumTransactions(monthTransactions, (transaction) => transaction.jenis === 'Pemasukan');
  const totalExpense = sumTransactions(monthTransactions, (transaction) => transaction.jenis === 'Pengeluaran');
  const totalBudget = totalIncome;

  const allocation = {
    primer: totalBudget * (ratios.primer / 100),
    sekunder: totalBudget * (ratios.sekunder / 100),
    tabungan: totalBudget * (ratios.tabungan / 100)
  };

  const used = {
    primer: sumTransactions(monthTransactions, (transaction) => getBudgetExpenseAmount(transaction) > 0 && getCategoryGroup(transaction.kategori) === 'primer'),
    sekunder: sumTransactions(monthTransactions, (transaction) => getBudgetExpenseAmount(transaction) > 0 && getCategoryGroup(transaction.kategori) === 'sekunder'),
    tabungan: sumTransactions(monthTransactions, (transaction) => getBudgetExpenseAmount(transaction) > 0 && getCategoryGroup(transaction.kategori) === 'tabungan')
  };

  const usedTotal = used.primer + used.sekunder + used.tabungan;
  const remaining = totalBudget - usedTotal;
  const usagePercent = totalBudget > 0 ? (usedTotal / totalBudget) * 100 : 0;

  const progress = {
    primer: allocation.primer > 0 ? Math.min(100, (used.primer / allocation.primer) * 100) : 0,
    sekunder: allocation.sekunder > 0 ? Math.min(100, (used.sekunder / allocation.sekunder) * 100) : 0,
    tabungan: allocation.tabungan > 0 ? Math.min(100, (used.tabungan / allocation.tabungan) * 100) : 0
  };

  const goalTarget = 0;
  const goalCurrent = used.tabungan;
  const goalPercent = goalTarget > 0 ? Math.min(100, (goalCurrent / goalTarget) * 100) : 0;

  return {
    transactions: monthTransactions,
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    totalBudget,
    allocation,
    used,
    usedTotal,
    remaining,
    usagePercent,
    progress,
    ratios,
    goalTarget,
    goalCurrent,
    goalPercent,
    // currentMonthLabel: now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
    currentMonthLabel: currentDate.toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric'
    }),
    insight: {
      primer: used.primer <= allocation.primer ? 'Pengeluaran primer masih aman.' : 'Primer sudah melewati batas budget.',
      sekunder: progress.sekunder >= 80 ? 'Budget sekunder sudah banyak digunakan.' : 'Budget sekunder masih terkontrol.',
      tabungan: goalPercent >= 40 ? 'Tabungan berjalan baik.' : 'Tabungan masih perlu ditingkatkan.'
    }
  };
};



module.exports = {
  calculateBudgetSummary,
  DEFAULT_RATIOS
};
