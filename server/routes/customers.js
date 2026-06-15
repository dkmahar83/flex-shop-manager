const express = require('express');
const router = express.Router();
const db = require('../db/database');

// GET /api/customers
router.get('/', (req, res) => {
  const search = req.query.search;

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
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET /api/customers/:id
router.get('/:id', (req, res) => {
  const { id } = req.params;

  db.get(`SELECT * FROM customers WHERE id = ? AND deleted_at IS NULL`, [id], (err, customer) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    db.all(`SELECT * FROM orders WHERE customer_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`, [id], (err, orders) => {
      if (err) return res.status(500).json({ error: err.message });

      db.all(`SELECT id, amount, payment_date as date, note as source, 'Order Payment' as payment_type FROM payments WHERE customer_id = ?`, [id], (err, orderPayments) => {
        if (err) return res.status(500).json({ error: err.message });

        db.all(`SELECT id, amount, transaction_date as date, upi_account as source, 'UPI' as payment_type FROM upi_transactions WHERE customer_id = ?`, [id], (err, upiPayments) => {
          if (err) return res.status(500).json({ error: err.message });

          db.all(`SELECT id, amount, received_date as date, bank_name as source, status, cheque_number, 'Cheque' as payment_type FROM cheques WHERE customer_id = ?`, [id], (err, chequePayments) => {
            if (err) return res.status(500).json({ error: err.message });

            // NEW: cash income entries linked to this customer
            db.all(`SELECT id, amount, income_date as date, notes as source, 'Cash Income' as payment_type FROM cash_income WHERE customer_id = ?`, [id], (err, cashIncomePayments) => {
              if (err) return res.status(500).json({ error: err.message });

              const totalBilled = orders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
              const totalAdvance = orders.reduce((sum, o) => sum + Number(o.advance_paid || 0), 0);
              const totalOrderPayments = orderPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
              const totalUpi = upiPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
              const totalChequeCleared = chequePayments
                .filter(p => p.status === 'cleared')
                .reduce((sum, p) => sum + Number(p.amount || 0), 0);
              const totalCashIncome = cashIncomePayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

              const totalPaid = totalAdvance + totalOrderPayments + totalUpi + totalChequeCleared + totalCashIncome;
              const totalDue = totalBilled - totalPaid;

              const allPayments = [
                ...orders.filter(o => o.advance_paid > 0).map(o => ({
                  id: `adv-${o.id}`,
                  amount: o.advance_paid,
                  date: o.created_at?.split('T')[0],
                  source: 'Advance Payment',
                  payment_type: 'Advance',
                  order_description: o.description
                })),
                ...orderPayments,
                ...upiPayments,
                ...chequePayments,
                ...cashIncomePayments   // ← cash income entries appear here
              ].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

              res.json({
                ...customer,
                orders,
                payments: allPayments,
                totalBilled,
                totalAdvance,
                totalOrderPayments,
                totalUpi,
                totalChequeCleared,
                totalCashIncome,
                totalPaid,
                totalDue
              });
            });
          });
        });
      });
    });
  });
});

// POST /api/customers
router.post('/', (req, res) => {
  const { firm_name, contact_name, phone } = req.body;

  if (!firm_name) return res.status(400).json({ error: 'firm_name is required' });

  db.run(`INSERT INTO customers (firm_name, contact_name, phone) VALUES (?, ?, ?)`,
    [firm_name, contact_name, phone], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, firm_name, contact_name, phone, message: 'Customer created successfully' });
    });
});

// PUT /api/customers/:id
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { firm_name, contact_name, phone } = req.body;

  db.run(`UPDATE customers SET firm_name = ?, contact_name = ?, phone = ? WHERE id = ?`,
    [firm_name, contact_name, phone, id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Customer not found' });
      res.json({ message: 'Customer updated successfully' });
    });
});

// DELETE /api/customers/:id — soft delete
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  db.run(`UPDATE customers SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?`, [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Customer not found' });
    res.json({ message: 'Customer deleted (recoverable for 24 hours)' });
  });
});

// PUT /api/customers/:id/restore
router.put('/:id/restore', (req, res) => {
  const { id } = req.params;
  db.run(`UPDATE customers SET deleted_at = NULL WHERE id = ?`, [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Customer restored successfully' });
  });
});

// GET /api/customers/deleted/recent
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