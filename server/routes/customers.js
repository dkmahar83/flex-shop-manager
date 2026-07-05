const express = require('express');
const router = express.Router();
const db = require('../db/database');
const fs = require('fs');
const path = require('path');
const { upload } = require('../middleware/upload');

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

      db.all(`
        SELECT id, amount, payment_date as date,
          CASE
            WHEN payment_mode = 'upi' AND upi_account IS NOT NULL THEN upi_account
            WHEN payment_mode = 'upi' THEN 'UPI'
            WHEN payment_mode = 'cash' OR payment_mode IS NULL THEN 'Cash'
            ELSE payment_mode
          END as source,
          'Order Payment' as payment_type, payment_mode, upi_account, note, created_at
        FROM payments WHERE customer_id = ?
      `, [id], (err, orderPayments) => {
        if (err) return res.status(500).json({ error: err.message });

        db.all(`SELECT id, amount, transaction_date as date, upi_account as source, 'UPI' as payment_type, created_at FROM upi_transactions WHERE customer_id = ? AND order_id IS NULL AND (notes NOT LIKE 'EXPENSE:%' OR notes IS NULL)`, [id], (err, upiPayments) => {
          if (err) return res.status(500).json({ error: err.message });

          db.all(`SELECT id, amount, received_date as date, bank_name as source, status, cheque_number, 'Cheque' as payment_type FROM cheques WHERE customer_id = ?`, [id], (err, chequePayments) => {
            if (err) return res.status(500).json({ error: err.message });

            db.all(`
              SELECT 
                id, 
                amount, 
                income_date as date, 
                CASE 
                  WHEN payment_mode = 'upi' AND upi_account IS NOT NULL 
                  THEN upi_account 
                  ELSE COALESCE(notes, 'Cash') 
                END as source,
                CASE 
                  WHEN payment_mode = 'upi' THEN 'UPI'
                  ELSE 'Cash Income'
                END as payment_type,
                created_at
              FROM cash_income 
              WHERE customer_id = ?
              AND (notes NOT IN ('Order Advance Payment', 'Order Payment') OR notes IS NULL)
              AND (notes NOT LIKE 'Cheque Cleared%')
              AND (notes NOT LIKE 'Galla Opening Balance%')
            `, [id], (err, cashIncomePayments) => {
              if (err) return res.status(500).json({ error: err.message });

              db.all(`
                SELECT 
                  id,
                  amount,
                  expense_date as date,
                  CASE 
                    WHEN payment_mode = 'upi' AND upi_account IS NOT NULL 
                    THEN upi_account 
                    ELSE 'Cash' 
                  END as source,
                  'Commission' as payment_type,
                  description,
                  payment_mode,
                  upi_account,
                  created_at
                FROM expenses
                WHERE category = 'Commission'
                  AND customer_id = ?
                ORDER BY expense_date DESC
              `, [id], (err, commissionPayments) => {
                if (err) return res.status(500).json({ error: err.message });

                const totalBilled = orders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
                const totalDiscount = orders.reduce((sum, o) => sum + Number(o.discount_amount || 0), 0);
                const totalAdvance = orders.reduce((sum, o) => sum + Number(o.advance_paid || 0), 0);
                const totalOrderPayments = orderPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
                const totalUpi = upiPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
                const totalChequeCleared = chequePayments
                  .filter(p => p.status === 'cleared')
                  .reduce((sum, p) => sum + Number(p.amount || 0), 0);
                const totalCashIncome = cashIncomePayments.filter(p => p.payment_type === 'Cash Income').reduce((sum, p) => sum + Number(p.amount || 0), 0);
                const totalCommission = commissionPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

                const totalPaid = totalAdvance + totalOrderPayments + totalUpi + totalChequeCleared + totalCashIncome;
                const totalDue = totalBilled - totalPaid - totalDiscount + totalCommission;

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
                  ...cashIncomePayments.filter(p => p.payment_type !== 'UPI'),
                  ...commissionPayments
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
                  totalCommission,
                  totalPaid,
                  totalDiscount,
                  totalDue
                });
              }); // commissionPayments close
            }); // cashIncomePayments close
          }); // chequePayments close
        }); // upiPayments close
      }); // orderPayments close
    }); // orders close
  }); // customer close
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
  db.run(`UPDATE customers SET deleted_at = datetime('now', '+5 hours', '+30 minutes') WHERE id = ?`, [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Customer not found' });
    res.json({ message: 'Customer deleted (recoverable for 30 days)' });
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
    AND deleted_at > datetime('now', '-30 days')
    ORDER BY deleted_at DESC
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST /api/customers/:id/opening-balance
router.post('/:id/opening-balance', (req, res) => {
  const { id } = req.params;
  const { amount, date, notes } = req.body;

  if (!amount || isNaN(amount) || Number(amount) <= 0) {
    return res.status(400).json({ error: 'Valid amount required' });
  }

  const createdAt = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace('T', ' ');
  const entryDate = date || new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).split(' ')[0];

  db.run(`
    INSERT INTO orders
      (customer_id, description, status, total_amount, advance_paid, balance_due,
       advance_payment_mode, follow_up_date, notes, advance_entry_table, advance_entry_id, created_at)
    VALUES (?, 'Opening Balance', 'pending', ?, 0, ?, NULL, NULL, ?, NULL, NULL, ?)
  `,
  [id, Number(amount), Number(amount), notes || 'Pichle saal ka bakaya', createdAt],
  function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID, message: 'Opening balance added successfully' });
  });
});

// POST /api/customers/:id/photo
router.post('/:id/photo', upload.single('photo'), (req, res) => {
  const { id } = req.params;

  if (!req.file) {
    return res.status(400).json({ error: 'No photo file received' });
  }

  db.get(`SELECT photo_path FROM customers WHERE id = ? AND deleted_at IS NULL`, [id], (err, customer) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!customer) {
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({ error: 'Customer not found' });
    }

    const newPhotoPath = `uploads/customers/${req.file.filename}`;

    db.run(`UPDATE customers SET photo_path = ? WHERE id = ?`, [newPhotoPath, id], function (err) {
      if (err) return res.status(500).json({ error: err.message });

      if (customer.photo_path) {
        const oldFullPath = path.join(__dirname, '..', customer.photo_path);
        fs.unlink(oldFullPath, () => {});
      }

      res.json({ message: 'Photo uploaded successfully', photo_path: newPhotoPath });
    });
  });
});

// DELETE /api/customers/:id/photo
router.delete('/:id/photo', (req, res) => {
  const { id } = req.params;

  db.get(`SELECT photo_path FROM customers WHERE id = ? AND deleted_at IS NULL`, [id], (err, customer) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    if (!customer.photo_path) return res.status(400).json({ error: 'No photo to delete' });

    const fullPath = path.join(__dirname, '..', customer.photo_path);

    db.run(`UPDATE customers SET photo_path = NULL WHERE id = ?`, [id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      fs.unlink(fullPath, () => {});
      res.json({ message: 'Photo removed successfully' });
    });
  });
});

module.exports = router;