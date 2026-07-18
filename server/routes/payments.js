const express = require('express');
const router = express.Router();
const db = require('../db/database');
const validate = require('../middleware/validate');
const { createPaymentSchema } = require('../schemas/paymentSchemas');
const logger = require('../utils/logger');
const { recalculateOrderBalance } = require('../utils/orderBalance');
const { getCustomerDuesList } = require('../utils/customerDues');

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

router.post('/', validate(createPaymentSchema), (req, res) => {
  const { order_id, customer_id, amount, payment_date, note, payment_mode, upi_account, cheque_number, bank_name, denomination_breakdown } = req.body;

  const cleanDate = parseToYMD(payment_date);
  const cleanMode = payment_mode || 'cash';
  const cleanUpi  = (cleanMode === 'upi' && upi_account) ? upi_account : null;
  const createdAt = nowIST();

  // Cheque payments go to the cheques table, not the payments table —
  // they only count as real cash once cleared (handled in cheques.js)
  if (cleanMode === 'cheque') {
    return db.get(`SELECT * FROM orders WHERE id = ?`, [order_id], (err, order) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!order) return res.status(404).json({ error: 'Order not found' });

      db.get(`SELECT firm_name FROM customers WHERE id = ?`, [customer_id], (err, customer) => {
        if (err) return res.status(500).json({ error: err.message });

        db.run(`
          INSERT INTO cheques (cheque_number, firm_name, customer_id, bank_name, amount, received_date, order_id, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [cheque_number || null, customer ? customer.firm_name : '', customer_id, bank_name || null,
         amount, cleanDate, order_id, note || 'Order Payment'],
        function(err) {
          if (err) return res.status(500).json({ error: err.message });

          // Note: balance_due is NOT reduced here — order stays "due" until cheque clears.
          // Mark cleared in Accounts > Cheques, which will then settle the order balance.
          res.status(201).json({
            id:       this.lastID,
            order_id,
            amount,
            payment_mode: 'cheque',
            message:  'Cheque recorded — balance will update once cheque is marked cleared'
          });
        });
      });
    });
  }

  db.get(`SELECT * FROM orders WHERE id = ?`, [order_id], (err, order) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const breakdownToSave = (cleanMode === 'cash' && denomination_breakdown && Object.keys(denomination_breakdown).length > 0)
      ? JSON.stringify(denomination_breakdown)
      : null;

    db.run(`
      INSERT INTO payments (order_id, customer_id, amount, payment_date, note, payment_mode, upi_account, created_at, denomination_breakdown)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [order_id, customer_id, amount, cleanDate, note || '', cleanMode, cleanUpi, createdAt, breakdownToSave],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });

      const payment_id = this.lastID;

      recalculateOrderBalance(order_id, (err, new_balance) => {
        if (err) return res.status(500).json({ error: err.message });

          // ✅ UPI payment ko upi_transactions me bhi mirror karo
          if (cleanMode === 'upi' && cleanUpi) {
            db.get(`SELECT firm_name FROM customers WHERE id = ?`, [customer_id], (err, customer) => {
              if (err) logger.error('Could not fetch customer for UPI record: ' + err.message);

              db.run(`
                INSERT INTO upi_transactions 
                  (upi_account, customer_name, customer_id, amount, transaction_date, notes, order_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              `,
              [
                cleanUpi,
                customer ? customer.firm_name : null,
                customer_id,
                amount,
                cleanDate,
                note || 'Order Payment',
                order_id,
                createdAt
              ],
              (err) => {
                if (err) logger.error('UPI transaction insert failed: ' + err.message);
              });
            });
          }

          res.status(201).json({
            id:              payment_id,
            order_id,
            amount,
            payment_date:    cleanDate,
            payment_mode:    cleanMode,
            upi_account:     cleanUpi,
            new_balance_due: new_balance,
            message:         'Payment recorded successfully'
          });
        });
      });
    });
  });

router.get('/dues', (req, res) => {
  getCustomerDuesList(db, { includeContactName: true }, (err, rows) => {
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