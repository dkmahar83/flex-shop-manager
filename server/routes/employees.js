const express = require('express');
const router = express.Router();
const db = require('../db/database');

// ─────────────────────────────────────────
// GET /api/employees
// ─────────────────────────────────────────
router.get('/', (req, res) => {
  db.all(`SELECT * FROM employees WHERE is_active = 1 ORDER BY name ASC`, 
  [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ─────────────────────────────────────────
// POST /api/employees
// ─────────────────────────────────────────
router.post('/', (req, res) => {
  const { name, phone, monthly_salary, join_date } = req.body;

  if (!name) return res.status(400).json({ error: 'name is required' });

  db.run(`
    INSERT INTO employees (name, phone, monthly_salary, join_date)
    VALUES (?, ?, ?, ?)
  `, [name, phone, monthly_salary || 0, join_date], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({
      id: this.lastID,
      name,
      phone,
      monthly_salary,
      message: 'Employee added successfully'
    });
  });
});

// ─────────────────────────────────────────
// PUT /api/employees/:id
// ─────────────────────────────────────────
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, phone, monthly_salary, is_active } = req.body;

  db.run(`
    UPDATE employees SET name = ?, phone = ?, monthly_salary = ?, is_active = ?
    WHERE id = ?
  `, [name, phone, monthly_salary, is_active, id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Employee not found' });
    res.json({ message: 'Employee updated successfully' });
  });
});

// ─────────────────────────────────────────
// POST /api/employees/attendance
// Mark attendance for one or multiple employees
// ─────────────────────────────────────────
router.post('/attendance', (req, res) => {
  const { date, records } = req.body;
  // records = [{ employee_id: 1, status: 'present' }, ...]

  if (!date || !records || records.length === 0) {
    return res.status(400).json({ error: 'date and records are required' });
  }

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO attendance (employee_id, date, status)
    VALUES (?, ?, ?)
  `);

  records.forEach(record => {
    stmt.run([record.employee_id, date, record.status]);
  });

  stmt.finalize();
  res.status(201).json({ message: 'Attendance marked successfully' });
});

// ─────────────────────────────────────────
// GET /api/employees/attendance/:employee_id
// Get attendance for an employee by month
// ─────────────────────────────────────────
router.get('/attendance/:employee_id', (req, res) => {
  const { employee_id } = req.params;
  const { month, year } = req.query;
  // e.g. /api/employees/attendance/1?month=06&year=2026

  let query = `SELECT * FROM attendance WHERE employee_id = ?`;
  let params = [employee_id];

  if (month && year) {
    query += ` AND strftime('%m', date) = ? AND strftime('%Y', date) = ?`;
    params.push(month, year);
  }

  query += ` ORDER BY date ASC`;

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ─────────────────────────────────────────
// GET /api/employees/salary/:employee_id
// Calculate salary for a given month
// ─────────────────────────────────────────
router.get('/salary/:employee_id', (req, res) => {
  const { employee_id } = req.params;
  const { month, year } = req.query;

  // Get employee details
  db.get(`SELECT * FROM employees WHERE id = ?`, [employee_id], (err, employee) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    // Get attendance for this month
    db.all(`
      SELECT * FROM attendance 
      WHERE employee_id = ? 
      AND strftime('%m', date) = ? 
      AND strftime('%Y', date) = ?
    `, [employee_id, month, year], (err, attendance) => {
      if (err) return res.status(500).json({ error: err.message });

      // Count days
      const total_days = attendance.length;
      const present_days = attendance.filter(a => a.status === 'present').length;
      const half_days = attendance.filter(a => a.status === 'half_day').length;
      const absent_days = attendance.filter(a => a.status === 'absent').length;

      // Salary calculation (your business logic)
      // Full month salary ÷ total working days marked × days present
      const per_day_salary = employee.monthly_salary / 30; // 30 working days assumed
      const effective_days = present_days + (half_days * 0.5);
      const calculated_salary = Math.round(per_day_salary * effective_days);
      const deduction = employee.monthly_salary - calculated_salary;

      res.json({
        employee_name: employee.name,
        monthly_salary: employee.monthly_salary,
        per_day_salary: Math.round(per_day_salary),
        total_days_marked: total_days,
        present_days,
        half_days,
        absent_days,
        effective_days,
        calculated_salary,
        deduction,
        month,
        year
      });
    });
  });
});

module.exports = router;