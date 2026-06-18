const express = require('express');
const router = express.Router();
const db = require('../db/database');

function todayIST() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).split(' ')[0];
}

router.get('/', (req, res) => {
  const today = todayIST();
  const result = {};

  // 1. Pending orders count (not deleted)
  db.get(`
    SELECT COUNT(*) as count FROM orders
    WHERE status IN ('pending', 'in_progress') AND deleted_at IS NULL
  `, [], (err, pending) => {
    if (err) return res.status(500).json({ error: err.message });
    result.pending_orders = pending.count;

    // 2. Total outstanding (not deleted)
    db.get(`
      SELECT COALESCE(SUM(balance_due), 0) as total FROM orders
      WHERE balance_due > 0 AND deleted_at IS NULL
    `, [], (err, totalDue) => {
      if (err) return res.status(500).json({ error: err.message });
      result.total_outstanding = totalDue.total;

      // 3. Due reminders — today and overdue (not deleted)
      db.all(`
        SELECT orders.id as order_id, orders.description,
          orders.balance_due, orders.follow_up_date,
          customers.firm_name, customers.phone
        FROM orders
        JOIN customers ON orders.customer_id = customers.id
        WHERE orders.balance_due > 0
          AND orders.follow_up_date <= ?
          AND orders.deleted_at IS NULL
        ORDER BY orders.follow_up_date ASC
      `, [today], (err, reminders) => {
        if (err) return res.status(500).json({ error: err.message });
        result.due_reminders = reminders;

        // 4. Today's orders (not deleted)
        db.all(`
          SELECT orders.*, customers.firm_name, customers.phone
          FROM orders
          JOIN customers ON orders.customer_id = customers.id
          WHERE DATE(orders.created_at) = ?
            AND orders.deleted_at IS NULL
          ORDER BY orders.created_at DESC
        `, [today], (err, todayOrders) => {
          if (err) return res.status(500).json({ error: err.message });
          result.today_orders_list = todayOrders;

          // 5. ALL due payments — for full due table with filters
          db.all(`
            SELECT orders.id as order_id, orders.description,
              orders.balance_due, orders.follow_up_date, orders.status,
              orders.total_amount, orders.advance_paid,
              customers.firm_name, customers.phone, customers.id as customer_id
            FROM orders
            JOIN customers ON orders.customer_id = customers.id
            WHERE orders.balance_due > 0
              AND orders.deleted_at IS NULL
            ORDER BY orders.follow_up_date ASC, orders.balance_due DESC
          `, [], (err, allDues) => {
            if (err) return res.status(500).json({ error: err.message });
            result.all_dues = allDues;

            res.json({ date: today, ...result });
          });
        });
      });
    });
  });
});

module.exports = router;