const express = require('express');
const router = express.Router();
const db = require('../db/database');

// Helper — store dates as YYYY-MM-DD always
function toISO(dateStr) {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  // If DD-MM-YYYY
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    const [d, m, y] = dateStr.split('-');
    return `${y}-${m}-${d}`;
  }
  return dateStr;
}

// GET /api/cheques
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
    query += ` AND strftime('%m', cheques.received_date) = ? AND strftime('%Y', cheques.received_date) = ?`;
    params.push(month.padStart(2, '0'), year);
  }
  query += ` ORDER BY cheques.received_date DESC`;

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET /api/cheques/summary
router.get('/summary', (req, res) => {
  db.all(`
    SELECT status, COUNT(*) as count, SUM(amount) as total
    FROM cheques
    GROUP BY status
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET /api/cheques/:id — single cheque detail
router.get('/:id', (req, res) => {
  const { id } = req.params;
  db.get(`
    SELECT cheques.*, customers.firm_name as customer_firm, customers.phone as customer_phone
    FROM cheques
    LEFT JOIN customers ON cheques.customer_id = customers.id
    WHERE cheques.id = ?
  `, [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Cheque not found' });
    res.json(row);
  });
});

// POST /api/cheques
router.post('/', (req, res) => {
  const { cheque_number, firm_name, customer_id, bank_name, amount, received_date, order_id, notes } = req.body;
  if (!firm_name || !amount) return res.status(400).json({ error: 'firm_name and amount required' });

  const date = toISO(received_date);

  db.run(`
    INSERT INTO cheques (cheque_number, firm_name, customer_id, bank_name, amount, received_date, order_id, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [cheque_number || null, firm_name, customer_id || null, bank_name || null,
     amount, date, order_id || null, notes || null],
  function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID, message: 'Cheque recorded' });
  });
});

// PUT /api/cheques/:id/status
router.put('/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const validStatuses = ['received', 'deposited', 'cleared', 'bounced'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  db.get(`SELECT * FROM cheques WHERE id = ?`, [id], (err, cheque) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!cheque) return res.status(404).json({ error: 'Cheque not found' });

    db.run(`UPDATE cheques SET status = ? WHERE id = ?`, [status, id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Cheque not found' });

      // When a cheque clears: (1) drop a "Cash Income" style entry on TODAY's date
      // so it appears in the Daily Ledger / cash flow, and (2) settle the linked order's balance.
      if (status === 'cleared' && cheque.status !== 'cleared') {
        const clearedDate = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).split(' ')[0];
        const createdAt   = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace('T', ' ');

        db.run(`
          INSERT INTO cash_income (customer_id, amount, income_date, notes, payment_mode, upi_account, created_at)
          VALUES (?, ?, ?, ?, 'cheque', NULL, ?)
        `,
        [cheque.customer_id, cheque.amount, clearedDate,
         `Cheque Cleared${cheque.cheque_number ? ' #' + cheque.cheque_number : ''} (${cheque.firm_name})`,
         createdAt],
        (err) => {
          if (err) console.error('Could not add cheque-cleared ledger entry:', err.message);
        });

        if (cheque.order_id) {
          db.get(`SELECT total_amount, advance_paid FROM orders WHERE id = ?`, [cheque.order_id], (err, order) => {
            if (err || !order) return;
            db.get(`SELECT COALESCE(SUM(amount),0) as paid FROM payments WHERE order_id = ?`, [cheque.order_id], (err, r) => {
              if (err) return;
              db.get(`SELECT COALESCE(SUM(amount),0) as cleared FROM cheques WHERE order_id = ? AND status = 'cleared'`, [cheque.order_id], (err, c) => {
                if (err) return;
                const newBalance = Math.max(0, order.total_amount - order.advance_paid - r.paid - c.cleared);
                db.run(`UPDATE orders SET balance_due = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                  [newBalance, cheque.order_id], () => {});
              });
            });
          });
        }
      }

      res.json({ message: `Cheque marked as ${status}` });
    });
  });
});

// PUT /api/cheques/:id — update cheque details
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { cheque_number, bank_name, notes, received_date } = req.body;

  db.run(`
    UPDATE cheques SET cheque_number = ?, bank_name = ?, notes = ?, received_date = ?
    WHERE id = ?
  `, [cheque_number, bank_name, notes, toISO(received_date), id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Cheque updated' });
  });
});

module.exports = router;