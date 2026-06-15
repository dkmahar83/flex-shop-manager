const express = require('express');
const router = express.Router();
const db = require('../db/database');

// ─────────────────────────────────────────
// GET /api/customers
// Get all customers, or search by name/phone
// ─────────────────────────────────────────
router.get('/', (req, res) => {
  const search = req.query.search; // e.g. /api/customers?search=sharma

  let query = `SELECT * FROM customers WHERE deleted_at IS NULL ORDER BY created_at ASC`;
  let params = [];

  if (search) {
    query = `SELECT * FROM customers 
         WHERE deleted_at IS NULL
         AND (firm_name LIKE ? OR contact_name LIKE ? OR phone LIKE ?)
         ORDER BY created_at ASC`;
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

  db.get(`SELECT * FROM customers WHERE id = ? AND deleted_at IS NULL`, [id], (err, customer) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    // GET ORDERS
    db.all(`SELECT * FROM orders WHERE customer_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`, [id], (err, orders) => {
      if (err) return res.status(500).json({ error: err.message });

      // GET ORDER PAYMENTS (recorded via payments table)
      db.all(`SELECT id, amount, payment_date as date, note as source, 'Order Payment' as payment_type FROM payments WHERE customer_id = ?`, [id], (err, orderPayments) => {
        if (err) return res.status(500).json({ error: err.message });

        // GET UPI PAYMENTS
        db.all(`SELECT id, amount, transaction_date as date, upi_account as source, 'UPI' as payment_type FROM upi_transactions WHERE customer_id = ?`, [id], (err, upiPayments) => {
          if (err) return res.status(500).json({ error: err.message });

          // GET ALL CHEQUES (not just cleared — show all with status)
          db.all(`SELECT id, amount, received_date as date, bank_name as source, status, cheque_number, 'Cheque' as payment_type FROM cheques WHERE customer_id = ?`, [id], (err, chequePayments) => {
            if (err) return res.status(500).json({ error: err.message });

            // CALCULATIONS
            const totalBilled = orders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0)

            // Advance paid is part of order creation — already in orders.advance_paid
            const totalAdvance = orders.reduce((sum, o) => sum + Number(o.advance_paid || 0), 0)

            // Additional order payments
            const totalOrderPayments = orderPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0)

            // UPI payments
            const totalUpi = upiPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0)

            // Only cleared cheques count as received payment
            const totalChequeCleared = chequePayments
              .filter(p => p.status === 'cleared')
              .reduce((sum, p) => sum + Number(p.amount || 0), 0)

            const totalPaid = totalAdvance + totalOrderPayments + totalUpi + totalChequeCleared
            const totalDue = totalBilled - totalPaid

            // Combine all payments sorted by date
            const allPayments = [
              // Advances (from orders)
              ...orders.filter(o => o.advance_paid > 0).map(o => ({
                id: `adv-${o.id}`,
                amount: o.advance_paid,
                date: o.created_at?.split('T')[0],
                source: 'Advance Payment',
                payment_type: 'Advance',
                order_description: o.description
              })),
              ...orderPayments.map(p => ({ ...p })),
              ...upiPayments.map(p => ({ ...p })),
              ...chequePayments.map(p => ({ ...p }))
            ].sort((a, b) => (b.date || '').localeCompare(a.date || ''))

            res.json({
              ...customer,
              orders,
              payments: allPayments,
              totalBilled,
              totalAdvance,
              totalOrderPayments,
              totalUpi,
              totalChequeCleared,
              totalPaid,
              totalDue
            });
          });
        });
      });
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

// DELETE /api/customers/:id
// Soft delete
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  db.run(`UPDATE customers SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?`, 
  [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Customer not found' });
    res.json({ message: 'Customer deleted (recoverable for 24 hours)' });
  });
});

// Restore deleted customer
router.put('/:id/restore', (req, res) => {
  const { id } = req.params;
  db.run(`UPDATE customers SET deleted_at = NULL WHERE id = ?`,
  [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Customer restored successfully' });
  });
});

// Get recently deleted (last 24 hours)
router.get('/deleted/recent', (req, res) => {
  db.all(`
    SELECT * FROM customers 
    WHERE deleted_at IS NOT NULL 
    AND deleted_at > datetime('now', '-24 hours')
    ORDER BY deleted_at DESC
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

module.exports = router;