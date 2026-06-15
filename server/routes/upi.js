const express = require('express');
const router = express.Router();
const db = require('../db/database');

const UPI_ACCOUNTS = [
  'BOI Shop Account',
  'Google Pay - Rampratap Painter',
  'PhonePe - Bhavya Printers',
  'Amazon Pay - Deepak'
];

// GET all UPI transactions
router.get('/', (req, res) => {
  const { upi_account, month, year } = req.query;
  let query = `
    SELECT upi_transactions.*, customers.firm_name as customer_firm
    FROM upi_transactions
    LEFT JOIN customers ON upi_transactions.customer_id = customers.id
    WHERE 1=1
  `;
  let params = [];

  if (upi_account) { query += ` AND upi_account = ?`; params.push(upi_account); }
    if (month && year) {
    query += `
        AND substr(transaction_date, 7, 4) = ?
        AND substr(transaction_date, 4, 2) = ?
    `;

    params.push(
        year.toString(),
        month.toString().padStart(2, '0')
    );
    }
  query += ` ORDER BY transaction_date DESC`;

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET UPI account wise summary
router.get('/summary', (req, res) => {
  const { month, year } = req.query;
  let query = `
    SELECT upi_account, COUNT(*) as count, SUM(amount) as total
    FROM upi_transactions
    WHERE 1=1
  `;
  let params = [];
    if (month && year) {
    query += `
        AND substr(transaction_date, 7, 4) = ?
        AND substr(transaction_date, 4, 2) = ?
    `;

    params.push(
        year.toString(),
        month.toString().padStart(2, '0')
    );
    }
  query += ` GROUP BY upi_account`;

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ accounts: UPI_ACCOUNTS, summary: rows });
  });
});

// POST add UPI transaction
router.post('/', (req, res) => {
  const {
    upi_account,
    customer_name,
    customer_id,
    amount,
    transaction_date,
    utr_number,
    order_id,
    notes
  } = req.body;

  if (!upi_account || !amount) {
    return res.status(400).json({
      error: 'upi_account and amount required'
    });
  }

  let formattedDate;

  if (transaction_date) {
    const [day, month, year] = transaction_date.split('-');
    formattedDate = `${year}-${month}-${day}`;
  } else {
    formattedDate = new Date().toISOString().split('T')[0];
  }

  db.run(
    `
    INSERT INTO upi_transactions 
    (upi_account, customer_name, customer_id, amount, transaction_date, utr_number, order_id, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      upi_account,
      customer_name,
      customer_id || null,
      amount,
      formattedDate,
      utr_number || null,
      order_id || null,
      notes || null
    ],
    function (err) {
      if (err) {
        console.error('UPI ERROR:', err);
        return res.status(500).json({
          error: err.message
        });
      }

      res.status(201).json({
        id: this.lastID,
        message: 'UPI transaction recorded'
      });
    }
  );
});

module.exports = router;