const express = require('express');
const router = express.Router();
const db = require('../db/database');

function parseToYMD(dateStr) {
  if (!dateStr) return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).split(' ')[0];
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.split(' ')[0];
  const parts = dateStr.split('/');
  if (parts.length === 3) return `${parts[2].split(' ')[0]}-${parts[1]}-${parts[0]}`;
  return dateStr.split(' ')[0];
}

function nowIST() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace('T', ' ');
}

router.post('/', (req, res) => {
  const { order_id, customer_id, amount, payment_date, note, payment_mode } = req.body;

  if (!order_id || !customer_id || !amount) {
    return res.status(400).json({ error: 'order_id, customer_id and amount are required' });
  }

  const cleanDate = parseToYMD(payment_date);
  const cleanMode = payment_mode || 'cash';
  const createdAt = nowIST();

  db.get(`SELECT * FROM orders WHERE id = ?`, [order_id], (err, order) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    db.run(`
      INSERT INTO payments (order_id, customer_id, amount, payment_date, note, payment_mode, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [order_id, customer_id, amount, cleanDate, note || '', cleanMode, createdAt],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });

      const payment_id  = this.lastID;
      const new_balance = order.balance_due - amount;

      db.run(`
        UPDATE orders SET balance_due = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `, [new_balance, order_id], (err) => {
        if (err) return res.status(500).json({ error: err.message });

        res.status(201).json({
          id:              payment_id,
          order_id,
          amount,
          payment_date:    cleanDate,
          payment_mode:    cleanMode,
          new_balance_due: new_balance,
          message:         'Payment recorded successfully'
        });
      });
    });
  });
});

router.get('/dues', (req, res) => {
  db.all(`
    SELECT orders.id as order_id, orders.description, orders.total_amount,
      orders.advance_paid, orders.balance_due, orders.follow_up_date,
      orders.status, customers.firm_name, customers.contact_name, customers.phone
    FROM orders
    JOIN customers ON orders.customer_id = customers.id
    WHERE orders.balance_due > 0
    ORDER BY orders.follow_up_date ASC, orders.balance_due DESC
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.get('/order/:order_id', (req, res) => {
  const { order_id } = req.params;
  db.all(`
    SELECT * FROM payments WHERE order_id = ? ORDER BY payment_date DESC
  `, [order_id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

module.exports = router;