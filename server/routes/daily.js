const express = require('express');
const router = express.Router();
const db = require('../db/database');

// GET /api/daily?month=06&year=2026
router.get('/', (req, res) => {
  const { month, year } = req.query;

  let query = `SELECT * FROM daily_records ORDER BY record_date DESC`;
  let params = [];

  if (month && year) {
    query = `
      SELECT * FROM daily_records
      WHERE strftime('%m', record_date) = ?
      AND strftime('%Y', record_date) = ?
      ORDER BY record_date DESC
    `;
    params = [month, year];
  }

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET /api/daily/today
router.get('/today', (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  db.get(`SELECT * FROM daily_records WHERE record_date = ?`, [today], (err, record) => {
    if (err) return res.status(500).json({ error: err.message });

    // Order payments today
    db.all(`
      SELECT payments.*, orders.description, customers.firm_name
      FROM payments
      JOIN orders ON payments.order_id = orders.id
      JOIN customers ON payments.customer_id = customers.id
      WHERE payments.payment_date = ?
    `, [today], (err, orderPayments) => {
      if (err) return res.status(500).json({ error: err.message });

      // UPI received today — grouped by account
      db.all(`
        SELECT upi_account, SUM(amount) as total, COUNT(*) as count
        FROM upi_transactions
        WHERE transaction_date = ?
        GROUP BY upi_account
      `, [today], (err, upiToday) => {
        if (err) return res.status(500).json({ error: err.message });

        // UPI transactions detail today
        db.all(`
          SELECT upi_transactions.*, customers.firm_name as customer_firm
          FROM upi_transactions
          LEFT JOIN customers ON upi_transactions.customer_id = customers.id
          WHERE transaction_date = ?
          ORDER BY id DESC
        `, [today], (err, upiDetail) => {
          if (err) return res.status(500).json({ error: err.message });

          // Cheques received today
          db.all(`
            SELECT cheques.*, customers.firm_name as customer_firm
            FROM cheques
            LEFT JOIN customers ON cheques.customer_id = customers.id
            WHERE received_date = ?
          `, [today], (err, chequesToday) => {
            if (err) return res.status(500).json({ error: err.message });

            // Cash income today (linked to customers)
            db.all(`
              SELECT cash_income.*, customers.firm_name
              FROM cash_income
              JOIN customers ON cash_income.customer_id = customers.id
              WHERE income_date = ?
              ORDER BY id DESC
            `, [today], (err, cashIncomeToday) => {
              if (err) return res.status(500).json({ error: err.message });

              const orderPaymentsTotal = orderPayments.reduce((s, p) => s + p.amount, 0);
              const upiTotal = upiToday.reduce((s, u) => s + u.total, 0);
              const chequeTotal = chequesToday.reduce((s, c) => s + c.amount, 0);
              const cashIncomeTotal = cashIncomeToday.reduce((s, c) => s + c.amount, 0);
              const totalCashIn = orderPaymentsTotal + upiTotal + cashIncomeTotal;

              res.json({
                record_date: today,
                manual_sales: cashIncomeTotal,
                total_expenses: record ? record.total_expenses : 0,
                notes: record ? record.notes : '',
                payments_received: orderPayments,
                payments_total: orderPaymentsTotal,
                upi_by_account: upiToday,
                upi_detail: upiDetail,
                upi_total: upiTotal,
                cheques_today: chequesToday,
                cheque_total: chequeTotal,
                cash_income_today: cashIncomeToday,
                cash_income_total: cashIncomeTotal,
                total_cash_in: totalCashIn
              });
            });
          });
        });
      });
    });
  });
});

// POST /api/daily/cash-income
router.post('/cash-income', (req, res) => {
  const {
    customer_id,
    amount,
    income_date,
    notes,
    payment_mode,
    upi_account
  } = req.body;

  if (!customer_id)
    return res.status(400).json({ error: 'customer_id is required' });

  if (!amount || isNaN(amount) || Number(amount) <= 0)
    return res.status(400).json({ error: 'Valid amount is required' });

  const date = income_date || new Date().toISOString().split('T')[0];

  db.run(`
    INSERT INTO cash_income
    (customer_id, amount, income_date, notes, payment_mode, upi_account)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    customer_id,
    Number(amount),
    date,
    notes || null,
    payment_mode || 'cash',
    payment_mode === 'upi' ? upi_account : null
  ], function(err) {
    if (err) return res.status(500).json({ error: err.message });

    if (payment_mode === 'upi' && upi_account) {
      db.run(`
        INSERT INTO upi_transactions
        (upi_account, customer_id, customer_name, amount, transaction_date, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        upi_account,
        customer_id,
        null,
        Number(amount),
        date,
        notes || 'Cash income via UPI'
      ]);
    }

    res.status(201).json({ id: this.lastID, message: 'Income saved' });
  });
});

// GET /api/daily/summary
router.get('/summary', (req, res) => {
  const { month, year } = req.query;

  db.get(`
    SELECT
      COUNT(*) as days_recorded,
      SUM(total_expenses) as total_expenses
    FROM daily_records
    WHERE strftime('%m', record_date) = ?
    AND strftime('%Y', record_date) = ?
  `, [month, year], (err, daily) => {
    if (err) return res.status(500).json({ error: err.message });

    db.get(`
      SELECT SUM(amount) as payments_total
      FROM payments
      WHERE strftime('%m', payment_date) = ?
      AND strftime('%Y', payment_date) = ?
    `, [month, year], (err, payments) => {
      if (err) return res.status(500).json({ error: err.message });

      db.get(`
        SELECT SUM(amount) as cash_income_total
        FROM cash_income
        WHERE strftime('%m', income_date) = ?
        AND strftime('%Y', income_date) = ?
      `, [month, year], (err, cashIncome) => {
        if (err) return res.status(500).json({ error: err.message });

        const paymentsTotal = payments.payments_total || 0;
        const cashIncomeTotal = cashIncome.cash_income_total || 0;
        const totalSales = paymentsTotal + cashIncomeTotal;
        const totalExpenses = daily.total_expenses || 0;

        res.json({
          days_recorded: daily.days_recorded || 0,
          cash_income_total: cashIncomeTotal,
          payments_total: paymentsTotal,
          total_sales: totalSales,
          total_expenses: totalExpenses,
          net_profit: totalSales - totalExpenses
        });
      });
    });
  });
});

// GET /api/daily/ledger
router.get('/ledger', (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return res.status(400).json({ error: 'month and year required' });

  const query = `
    SELECT income_date as date, 'Cash Income' as type,
      customers.firm_name as party_name, cash_income.amount,
      COALESCE(cash_income.payment_mode, 'cash') as payment_mode,
      cash_income.notes
    FROM cash_income
    LEFT JOIN customers ON cash_income.customer_id = customers.id
    WHERE strftime('%m', income_date) = ? AND strftime('%Y', income_date) = ?

    UNION ALL

    SELECT payment_date as date, 'Order Payment' as type,
      customers.firm_name as party_name, payments.amount,
      'cash' as payment_mode, NULL as notes
    FROM payments
    LEFT JOIN customers ON payments.customer_id = customers.id
    WHERE strftime('%m', payment_date) = ? AND strftime('%Y', payment_date) = ?

    UNION ALL

    SELECT expense_date as date, 'Expense' as type,
      COALESCE(paid_to_name_sub.name, category) as party_name,
      amount * -1 as amount,
      COALESCE(payment_mode, 'cash') as payment_mode,
      description as notes
    FROM expenses
    LEFT JOIN (
      SELECT 'vendor' as type, id, name FROM vendors
      UNION ALL
      SELECT 'employee' as type, id, name FROM employees
    ) paid_to_name_sub ON expenses.paid_to_type = paid_to_name_sub.type 
      AND expenses.paid_to_id = paid_to_name_sub.id
    WHERE strftime('%m', expense_date) = ? AND strftime('%Y', expense_date) = ?

    ORDER BY date DESC
  `;

  db.all(query, [month, year, month, year, month, year], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

module.exports = router;