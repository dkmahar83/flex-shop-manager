const express = require('express');
const router = express.Router();
const db = require('../db/database');

// ─────────────────────────────────────────
// GET /api/customers
// Get all customers, or search by name/phone
// ─────────────────────────────────────────
router.get('/', (req, res) => {
  const search = req.query.search; // e.g. /api/customers?search=sharma

  let query = `SELECT * FROM customers ORDER BY firm_name ASC`;
  let params = [];

  if (search) {
    query = `SELECT * FROM customers 
             WHERE firm_name LIKE ? OR contact_name LIKE ? OR phone LIKE ?
             ORDER BY firm_name ASC`;
    params = [`%${search}%`, `%${search}%`, `%${search}%`];
  }

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// ─────────────────────────────────────────
// GET /api/customers/:id
// Get single customer + their orders
// ─────────────────────────────────────────
router.get('/:id', (req, res) => {
  const { id } = req.params;

  db.get(`SELECT * FROM customers WHERE id = ?`, [id], (err, customer) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    // Also get their orders
    db.all(`SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC`, 
      [id], (err, orders) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ ...customer, orders });
    });
  });
});

// ─────────────────────────────────────────
// POST /api/customers
// Create a new customer
// ─────────────────────────────────────────
router.post('/', (req, res) => {
  const { firm_name, contact_name, phone } = req.body;

  // Validation — firm_name is required
  if (!firm_name) {
    return res.status(400).json({ error: 'firm_name is required' });
  }

  const query = `INSERT INTO customers (firm_name, contact_name, phone) 
                 VALUES (?, ?, ?)`;

  db.run(query, [firm_name, contact_name, phone], function(err) {
    if (err) return res.status(500).json({ error: err.message });

    // this.lastID gives the id of the newly inserted row
    res.status(201).json({
      id: this.lastID,
      firm_name,
      contact_name,
      phone,
      message: 'Customer created successfully'
    });
  });
});

// ─────────────────────────────────────────
// PUT /api/customers/:id
// Update a customer
// ─────────────────────────────────────────
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { firm_name, contact_name, phone } = req.body;

  const query = `UPDATE customers SET firm_name = ?, contact_name = ?, phone = ?
                 WHERE id = ?`;

  db.run(query, [firm_name, contact_name, phone, id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Customer not found' });

    res.json({ message: 'Customer updated successfully' });
  });
});

module.exports = router;