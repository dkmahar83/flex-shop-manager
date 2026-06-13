const express = require('express');
const router = express.Router();
const db = require('../db/database');

// ─────────────────────────────────────────
// GET /api/orders
// Get all orders, with optional filters
// ─────────────────────────────────────────
router.get('/', (req, res) => {
  const { status, customer_id, search } = req.query;

  let query = `
    SELECT orders.*, customers.firm_name, customers.contact_name, customers.phone
    FROM orders
    JOIN customers ON orders.customer_id = customers.id
    WHERE 1=1
  `;
  let params = [];

  // Add filters dynamically
  if (status) {
    query += ` AND orders.status = ?`;
    params.push(status);
  }

  if (customer_id) {
    query += ` AND orders.customer_id = ?`;
    params.push(customer_id);
  }

  if (search) {
    query += ` AND (customers.firm_name LIKE ? OR orders.description LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }

  query += ` ORDER BY orders.created_at DESC`;

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ─────────────────────────────────────────
// GET /api/orders/:id
// Get single order with its items and payments
// ─────────────────────────────────────────
router.get('/:id', (req, res) => {
  const { id } = req.params;

  // Step 1: Get the order
  db.get(`
    SELECT orders.*, customers.firm_name, customers.contact_name, customers.phone
    FROM orders
    JOIN customers ON orders.customer_id = customers.id
    WHERE orders.id = ?
  `, [id], (err, order) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Step 2: Get its line items
    db.all(`SELECT * FROM order_items WHERE order_id = ?`, [id], (err, items) => {
      if (err) return res.status(500).json({ error: err.message });

      // Step 3: Get its payments
      db.all(`SELECT * FROM payments WHERE order_id = ?`, [id], (err, payments) => {
        if (err) return res.status(500).json({ error: err.message });

        // Combine everything into one response
        res.json({ ...order, items, payments });
      });
    });
  });
});

// ─────────────────────────────────────────
// POST /api/orders
// Create a new order with line items
// ─────────────────────────────────────────
router.post('/', (req, res) => {
  const {
    customer_id,
    description,
    advance_paid,
    follow_up_date,
    notes,
    items   // array of line items
  } = req.body;

  // Validation
  if (!customer_id) {
    return res.status(400).json({ error: 'customer_id is required' });
  }
  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'At least one item is required' });
  }

  // Calculate total from items
  const total_amount = items.reduce((sum, item) => {
    return sum + (item.quantity * item.unit_price);
  }, 0);

  const advance = advance_paid || 0;
  const balance_due = total_amount - advance;

  // Insert the order first
  db.run(`
    INSERT INTO orders 
    (customer_id, description, status, total_amount, advance_paid, balance_due, follow_up_date, notes)
    VALUES (?, ?, 'pending', ?, ?, ?, ?, ?)
  `,
  [customer_id, description, total_amount, advance, balance_due, follow_up_date, notes],
  function(err) {
    if (err) return res.status(500).json({ error: err.message });

    const order_id = this.lastID;

    // Now insert each line item
    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, item_name, quantity, unit_price, subtotal)
      VALUES (?, ?, ?, ?, ?)
    `);

    items.forEach(item => {
      const subtotal = item.quantity * item.unit_price;
      insertItem.run([order_id, item.item_name, item.quantity, item.unit_price, subtotal]);
    });

    insertItem.finalize();

    res.status(201).json({
      id: order_id,
      customer_id,
      total_amount,
      advance_paid: advance,
      balance_due,
      status: 'pending',
      message: 'Order created successfully'
    });
  });
});

// ─────────────────────────────────────────
// PUT /api/orders/:id/status
// Update order status only
// ─────────────────────────────────────────
router.put('/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['pending', 'in_progress', 'ready', 'delivered'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  db.run(`
    UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `, [status, id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Order not found' });
    res.json({ message: `Order status updated to ${status}` });
  });
});

// ─────────────────────────────────────────
// PUT /api/orders/:id
// Update order details (description, notes, follow_up_date)
// ─────────────────────────────────────────
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { description, notes, follow_up_date, advance_paid } = req.body;

  // First get current order to recalculate balance
  db.get(`SELECT * FROM orders WHERE id = ?`, [id], (err, order) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const new_advance = advance_paid !== undefined ? advance_paid : order.advance_paid;
    const new_balance = order.total_amount - new_advance;

    db.run(`
      UPDATE orders 
      SET description = ?, notes = ?, follow_up_date = ?, 
          advance_paid = ?, balance_due = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [
      description || order.description,
      notes || order.notes,
      follow_up_date || order.follow_up_date,
      new_advance,
      new_balance,
      id
    ],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Order updated successfully', balance_due: new_balance });
    });
  });
});

module.exports = router;