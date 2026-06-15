const express = require('express');
const router = express.Router();
const db = require('../db/database');

// GET all cheques
router.get('/', (req, res) => {
  const { status, month, year } = req.query;

  let query = `
    SELECT cheques.*, customers.firm_name as customer_firm
    FROM cheques
    LEFT JOIN customers ON cheques.customer_id = customers.id
    WHERE 1=1
  `;

  let params = [];

  if (status) {
    query += ` AND cheques.status = ?`;
    params.push(status);
  }

  if (month && year) {
    query += `
      AND substr(received_date, 7, 4) = ?
      AND substr(received_date, 4, 2) = ?
    `;

    params.push(
      year.toString(),
      month.toString().padStart(2, '0')
    );
  }

  query += ` ORDER BY received_date DESC`;

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    res.json(rows);
  });
});

// POST add cheque
router.post('/', (req, res) => {
  const {
    cheque_number,
    firm_name,
    customer_id,
    bank_name,
    amount,
    received_date,
    order_id,
    notes
  } = req.body;

  if (!firm_name || !amount) {
    return res.status(400).json({
      error: 'firm_name and amount required'
    });
  }

  let formattedDate;

  if (received_date) {
    const [day, month, year] = received_date.split('-');
    formattedDate = `${day}-${month}-${year}`;
  } else {
    const today = new Date();

    formattedDate =
      String(today.getDate()).padStart(2, '0') +
      '-' +
      String(today.getMonth() + 1).padStart(2, '0') +
      '-' +
      today.getFullYear();
  }

  db.run(
    `
    INSERT INTO cheques
    (cheque_number, firm_name, customer_id, bank_name, amount, received_date, order_id, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      cheque_number || null,
      firm_name,
      customer_id || null,
      bank_name || null,
      amount,
      formattedDate,
      order_id || null,
      notes || null
    ],
    function (err) {
      if (err) {
        return res.status(500).json({
          error: err.message
        });
      }

      res.status(201).json({
        id: this.lastID,
        message: 'Cheque recorded'
      });
    }
  );
});

// PUT update cheque status
router.put('/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = [
    'received',
    'deposited',
    'cleared',
    'bounced'
  ];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      error: 'Invalid status'
    });
  }

  db.run(
    `UPDATE cheques SET status = ? WHERE id = ?`,
    [status, id],
    function (err) {
      if (err) {
        return res.status(500).json({
          error: err.message
        });
      }

      res.json({
        message: `Cheque status updated to ${status}`
      });
    }
  );
});

// GET summary
router.get('/summary', (req, res) => {
  db.all(
    `
    SELECT status, COUNT(*) as count, SUM(amount) as total
    FROM cheques
    GROUP BY status
    `,
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({
          error: err.message
        });
      }

      res.json(rows);
    }
  );
});

module.exports = router;