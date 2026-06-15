const express = require('express');
const router = express.Router();
const db = require('../db/database');

// GET all vendors
router.get('/', (req, res) => {
  db.all(`SELECT * FROM vendors ORDER BY name ASC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET single vendor with transactions
router.get('/:id', (req, res) => {
  const { id } = req.params;
  db.get(`SELECT * FROM vendors WHERE id = ?`, [id], (err, vendor) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });

    db.all(`SELECT * FROM vendor_transactions WHERE vendor_id = ? ORDER BY transaction_date DESC`,
    [id], (err, transactions) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ...vendor, transactions });
    });
  });
});

// POST add vendor
router.post('/', (req, res) => {
  const { name, phone, shop_type, city, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  db.run(`INSERT INTO vendors (name, phone, shop_type, city, notes) VALUES (?, ?, ?, ?, ?)`,
  [name, phone, shop_type, city, notes], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID, message: 'Vendor added' });
  });
});

// POST vendor purchase (we bought something from vendor)
router.post('/:id/purchase', (req, res) => {
  const { id } = req.params;
  const { amount, description, transaction_date } = req.body;
  if (!amount) return res.status(400).json({ error: 'amount required' });

  db.run(`
    INSERT INTO vendor_transactions (vendor_id, type, amount, transaction_date, description)
    VALUES (?, 'purchase', ?, ?, ?)
  `, [id, amount, transaction_date || new Date().toISOString().split('T')[0], description],
  function(err) {
    if (err) return res.status(500).json({ error: err.message });

    // Update vendor totals
    db.run(`
      UPDATE vendors SET
        total_purchased = total_purchased + ?,
        balance_due = balance_due + ?
      WHERE id = ?
    `, [amount, amount, id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ message: 'Purchase recorded' });
    });
  });
});

// POST vendor payment (we paid the vendor)
router.post('/:id/payment', (req, res) => {
  const { id } = req.params;
  const { amount, description, transaction_date } = req.body;
  if (!amount) return res.status(400).json({ error: 'amount required' });

  db.run(`
    INSERT INTO vendor_transactions (vendor_id, type, amount, transaction_date, description)
    VALUES (?, 'payment', ?, ?, ?)
  `, [id, amount, transaction_date || new Date().toISOString().split('T')[0], description],
  function(err) {
    if (err) return res.status(500).json({ error: err.message });

    db.run(`
      UPDATE vendors SET
        total_paid = total_paid + ?,
        balance_due = balance_due - ?
      WHERE id = ?
    `, [amount, amount, id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ message: 'Payment to vendor recorded' });
    });
  });
});

module.exports = router;