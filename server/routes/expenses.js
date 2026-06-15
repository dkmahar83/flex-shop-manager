const express = require('express');
const router = express.Router();
const db = require('../db/database');

// GET /api/expenses?month=06&year=2026
router.get('/', (req, res) => {
  const { month, year } = req.query;

  let query = `SELECT * FROM expenses ORDER BY expense_date DESC`;
  let params = [];

  if (month && year) {
    query = `
      SELECT * FROM expenses
      WHERE strftime('%m', expense_date) = ?
      AND strftime('%Y', expense_date) = ?
      ORDER BY expense_date DESC
    `;
    params = [month, year];
  }

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST /api/expenses — add a new expense
router.post('/', (req, res) => {
  const { category, amount, expense_date, description } = req.body;

  if (!category || !amount) {
    return res.status(400).json({ error: 'category and amount are required' });
  }

  const date = expense_date || new Date().toISOString().split('T')[0];

  db.run(`
    INSERT INTO expenses (category, amount, expense_date, description)
    VALUES (?, ?, ?, ?)
  `, [category, amount, date, description], function(err) {
    if (err) return res.status(500).json({ error: err.message });

    // Also update total_expenses in daily_records for this date
    db.run(`
      INSERT INTO daily_records (record_date, total_expenses)
      VALUES (?, ?)
      ON CONFLICT(record_date) DO UPDATE SET
        total_expenses = total_expenses + excluded.total_expenses
    `, [date, parseFloat(amount)], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });

      res.status(201).json({
        id: this.lastID,
        category,
        amount,
        date,
        message: 'Expense recorded'
      });
    });
  });
});

// DELETE /api/expenses/:id
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  // First get the expense to reverse the daily total
  db.get(`SELECT * FROM expenses WHERE id = ?`, [id], (err, expense) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!expense) return res.status(404).json({ error: 'Expense not found' });

    db.run(`DELETE FROM expenses WHERE id = ?`, [id], function(err) {
      if (err) return res.status(500).json({ error: err.message });

      // Reverse the amount from daily total
      db.run(`
        UPDATE daily_records
        SET total_expenses = total_expenses - ?
        WHERE record_date = ?
      `, [expense.amount, expense.expense_date], () => {
        res.json({ message: 'Expense deleted' });
      });
    });
  });
});

module.exports = router;