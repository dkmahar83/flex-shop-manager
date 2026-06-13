const express = require('express');
const router = express.Router();
const db = require('../db/database');

// ─────────────────────────────────────────
// GET /api/dashboard
// Everything needed for the home screen
// ─────────────────────────────────────────
router.get('/', (req, res) => {
  const today = new Date().toISOString().split('T')[0]; // "2026-06-13"

  const result = {};

  // 1. Today's order counts by status
  db.all(`
    SELECT status, COUNT(*) as count 
    FROM orders 
    WHERE DATE(created_at) = ? 
    GROUP BY status
  `, [today], (err, orderStats) => {
    if (err) return res.status(500).json({ error: err.message });
    result.today_orders = orderStats;

    // 2. Total pending orders (all time)
    db.get(`
      SELECT COUNT(*) as count FROM orders 
      WHERE status IN ('pending', 'in_progress')
    `, [], (err, pending) => {
      if (err) return res.status(500).json({ error: err.message });
      result.pending_orders = pending.count;

      // 3. Due reminders for today and overdue
      db.all(`
        SELECT 
          orders.id as order_id,
          orders.description,
          orders.balance_due,
          orders.follow_up_date,
          customers.firm_name,
          customers.phone
        FROM orders
        JOIN customers ON orders.customer_id = customers.id
        WHERE orders.balance_due > 0 
        AND orders.follow_up_date <= ?
        ORDER BY orders.follow_up_date ASC
      `, [today], (err, reminders) => {
        if (err) return res.status(500).json({ error: err.message });
        result.due_reminders = reminders;

        // 4. Total outstanding dues
        db.get(`
          SELECT SUM(balance_due) as total FROM orders WHERE balance_due > 0
        `, [], (err, totalDue) => {
          if (err) return res.status(500).json({ error: err.message });
          result.total_outstanding = totalDue.total || 0;

          // 5. Today's orders list
          db.all(`
            SELECT orders.*, customers.firm_name, customers.phone
            FROM orders
            JOIN customers ON orders.customer_id = customers.id
            WHERE DATE(orders.created_at) = ?
            ORDER BY orders.created_at DESC
          `, [today], (err, todayOrders) => {
            if (err) return res.status(500).json({ error: err.message });
            result.today_orders_list = todayOrders;

            // Send complete dashboard data
            res.json({
              date: today,
              ...result
            });
          });
        });
      });
    });
  });
});

module.exports = router;