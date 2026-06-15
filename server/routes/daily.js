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

            const orderPaymentsTotal = orderPayments.reduce((s, p) => s + p.amount, 0)
            const upiTotal = upiToday.reduce((s, u) => s + u.total, 0)
            const chequeTotal = chequesToday.reduce((s, c) => s + c.amount, 0)
            const manualSales = record ? record.total_sales : 0
            const totalCashIn = manualSales + orderPaymentsTotal + upiTotal

            res.json({
              record_date: today,
              manual_sales: manualSales,
              total_expenses: record ? record.total_expenses : 0,
              notes: record ? record.notes : '',
              order_payments: orderPayments,
              order_payments_total: orderPaymentsTotal,
              upi_by_account: upiToday,
              upi_detail: upiDetail,
              upi_total: upiTotal,
              cheques_today: chequesToday,
              cheque_total: chequeTotal,
              total_cash_in: totalCashIn
            });
          });
        });
      });
    });
  });
});

// POST /api/daily — create or update today's record
router.post('/', (req, res) => {
  const { record_date, total_sales, notes } = req.body;
  const date = record_date || new Date().toISOString().split('T')[0];

  // INSERT OR REPLACE — if record exists for this date, update it
  db.run(`
    INSERT INTO daily_records (record_date, total_sales, notes)
    VALUES (?, ?, ?)
    ON CONFLICT(record_date) DO UPDATE SET
      total_sales = excluded.total_sales,
      notes = excluded.notes
  `, [date, total_sales || 0, notes], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: 'Daily record saved', date });
  });
});

router.get('/summary', (req, res) => {
  const { month, year } = req.query;

  // Manual sales from daily_records
  db.get(`
    SELECT
      COUNT(*) as days_recorded,
      SUM(total_sales) as manual_sales,
      SUM(total_expenses) as total_expenses
    FROM daily_records
    WHERE strftime('%m', record_date) = ?
    AND strftime('%Y', record_date) = ?
  `, [month, year], (err, daily) => {
    if (err) return res.status(500).json({ error: err.message });

    // Payments received this month from orders
    db.get(`
      SELECT SUM(amount) as payments_total
      FROM payments
      WHERE strftime('%m', payment_date) = ?
      AND strftime('%Y', payment_date) = ?
    `, [month, year], (err, payments) => {
      if (err) return res.status(500).json({ error: err.message });

      const manualSales = daily.manual_sales || 0
      const paymentsTotal = payments.payments_total || 0
      const totalSales = manualSales + paymentsTotal
      const totalExpenses = daily.total_expenses || 0

      res.json({
        days_recorded: daily.days_recorded || 0,
        manual_sales: manualSales,
        payments_total: paymentsTotal,
        total_sales: totalSales,
        total_expenses: totalExpenses,
        net_profit: totalSales - totalExpenses
      });
    });
  });
});

module.exports = router;