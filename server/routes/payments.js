const express = require('express');
const router = express.Router();
const db = require('../db/database');

// ─────────────────────────────────────────
// POST /api/payments
// Record a payment against an order
// ─────────────────────────────────────────
router.post('/', (req, res) => {
  const { order_id, customer_id, amount, payment_date, note } = req.body;

  if (!order_id || !customer_id || !amount) {
    return res.status(400).json({ error: 'order_id, customer_id and amount are required' });
  }

  // Step 1: Check order exists and get current balance
  db.get(`SELECT * FROM orders WHERE id = ?`, [order_id], (err, order) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Step 2: Insert payment record
    db.run(`
      INSERT INTO payments (order_id, customer_id, amount, payment_date, note)
      VALUES (?, ?, ?, ?, ?)
    `,
    [order_id, customer_id, amount, payment_date || new Date().toISOString().split('T')[0], note],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });

      // Step 3: Recalculate balance_due on the order
      const new_balance = order.balance_due - amount;

      db.run(`
        UPDATE orders SET balance_due = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [new_balance, order_id], (err) => {
        if (err) return res.status(500).json({ error: err.message });

        res.status(201).json({
          id: this.lastID,
          order_id,
          amount,
          new_balance_due: new_balance,
          message: 'Payment recorded successfully'
        });
      });
    });
  });
});

// ─────────────────────────────────────────
// GET /api/payments/dues
// Get all orders with pending balance_due > 0
// ─────────────────────────────────────────
router.get('/dues', (req, res) => {
  db.all(`
    SELECT 
      orders.id as order_id,
      orders.description,
      orders.total_amount,
      orders.advance_paid,
      orders.balance_due,
      orders.follow_up_date,
      orders.status,
      customers.firm_name,
      customers.contact_name,
      customers.phone
    FROM orders
    JOIN customers ON orders.customer_id = customers.id
    WHERE orders.balance_due > 0
    ORDER BY orders.follow_up_date ASC, orders.balance_due DESC
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ─────────────────────────────────────────
// GET /api/payments/order/:order_id
// Get all payments for a specific order
// ─────────────────────────────────────────
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