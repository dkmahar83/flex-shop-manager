const express = require('express');
const router = express.Router();
const db = require('../db/database');
const util = require('util');

const dbAllAsync = util.promisify(db.all).bind(db);

function todayIST() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).split(' ')[0];
}

// ── Low stock / out of stock across ALL inventory types ──
// Thresholds match exactly what Inventory.jsx already shows, taaki dono jagah same data dikhe.
async function getLowStockAlerts() {
  const [flexLow, framesLow, stampsOut, chemLow, inkLow, dynLow] = await Promise.all([
    dbAllAsync(`SELECT brand, size_ft, quantity FROM inventory_flex WHERE quantity <= 1`),
    dbAllAsync(`SELECT frame_type, size, design, quantity FROM inventory_frames WHERE quantity < 5`),
    dbAllAsync(`SELECT stamp_type, size, quantity FROM inventory_stamps WHERE quantity = 0`),
    dbAllAsync(`SELECT chemical_name, quantity, unit, minimum_stock FROM inventory_chemicals WHERE quantity = 0 OR (minimum_stock > 0 AND quantity <= minimum_stock)`),
    dbAllAsync(`SELECT item_name, item_type, quantity, unit, minimum_level FROM inventory_ink WHERE quantity = 0 OR (minimum_level > 0 AND quantity <= minimum_level)`),
    dbAllAsync(`
      SELECT d.item_name, d.attr1, d.attr2, d.quantity, d.unit, c.label as category_label
      FROM inventory_dynamic_items d
      JOIN inventory_categories c ON d.category_id = c.id
      WHERE d.quantity = 0 OR (d.minimum_stock > 0 AND d.quantity <= d.minimum_stock)
    `)
  ]);

  const alerts = [
    ...flexLow.map(f => ({
      category: 'Flex Roll', item_name: `${f.brand} ${f.size_ft}ft`,
      quantity: f.quantity, unit: 'roll', status: f.quantity === 0 ? 'out' : 'low'
    })),
    ...framesLow.map(f => ({
      category: 'Photo Frame',
      item_name: `${f.frame_type}${f.size ? ' ' + f.size : ''}${f.design ? ' ' + f.design : ''}`,
      quantity: f.quantity, unit: 'pcs', status: f.quantity === 0 ? 'out' : 'low'
    })),
    ...stampsOut.map(s => ({
      category: 'Stamp', item_name: `${s.stamp_type}${s.size ? ' ' + s.size : ''}`,
      quantity: s.quantity, unit: 'pcs', status: 'out'
    })),
    ...chemLow.map(c => ({
      category: 'Chemical', item_name: c.chemical_name,
      quantity: c.quantity, unit: c.unit, status: c.quantity === 0 ? 'out' : 'low'
    })),
    ...inkLow.map(i => ({
      category: i.item_type === 'solvent' ? 'Solvent' : 'Ink', item_name: i.item_name,
      quantity: i.quantity, unit: i.unit, status: i.quantity === 0 ? 'out' : 'low'
    })),
    ...dynLow.map(d => ({
      category: d.category_label,
      item_name: `${d.item_name}${d.attr1 ? ' ' + d.attr1 : ''}${d.attr2 ? ' ' + d.attr2 : ''}`,
      quantity: d.quantity, unit: d.unit, status: d.quantity === 0 ? 'out' : 'low'
    })),
  ];

  // Out of stock pehle dikhao, phir low stock
  alerts.sort((a, b) => (a.status === 'out' ? 0 : 1) - (b.status === 'out' ? 0 : 1));
  return alerts;
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

            // 6. Low stock alerts — saari inventory tables se combined
            getLowStockAlerts()
              .then(alerts => {
                result.low_stock_alerts = alerts;
                res.json({ date: today, ...result });
              })
              .catch(lowStockErr => {
                console.error('Low stock fetch failed:', lowStockErr.message);
                result.low_stock_alerts = [];
                res.json({ date: today, ...result });
              });
          });
        });
      });
    });
  });
});

module.exports = router;