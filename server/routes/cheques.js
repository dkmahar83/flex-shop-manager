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

  db.run(`UPDATE cheques SET status = ? WHERE id = ?`, [status, id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Cheque not found' });
    res.json({ message: `Cheque marked as ${status}` });
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