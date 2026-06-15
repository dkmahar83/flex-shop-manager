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

// ─────────────────────────────────────────
// GET /api/employees/profile/:id
// Employee profile + payment history
// ─────────────────────────────────────────
router.get('/profile/:id', (req, res) => {
  const { id } = req.params

  db.get(`
    SELECT * FROM employees
    WHERE id = ?
  `, [id], (err, employee) => {
    if (err) return res.status(500).json({ error: err.message })
    if (!employee) return res.status(404).json({ error: 'Employee not found' })

    // Employee advances from expenses
    db.all(`
      SELECT
        id,
        expense_date as date,
        amount,
        description,
        payment_mode,
        upi_account,
        'advance' as type
      FROM expenses
      WHERE paid_to_type = 'employee'
      AND paid_to_id = ?

      UNION ALL

      SELECT
        id,
        credited_date as date,
        salary_amount as amount,
        notes as description,
        payment_mode,
        upi_account,
        'salary_credit' as type
      FROM employee_salary_credits
      WHERE employee_id = ?

      ORDER BY date DESC
    `, [id, id], (err, history) => {
      if (err) return res.status(500).json({ error: err.message })

      db.all(`
        SELECT *
        FROM employee_salary_credits
        WHERE employee_id = ?
        ORDER BY id DESC
      `, [id], (err, salaries) => {
        if (err) return res.status(500).json({ error: err.message })

        const totalAdvancePaid =
          history
            .filter(h => h.type === 'advance')
            .reduce((sum, h) => sum + h.amount, 0)

        const totalSalaryGenerated =
          salaries.reduce((sum, s) => sum + s.salary_amount, 0)

        const totalPaid =
          history.reduce((sum, h) => sum + h.amount, 0)

        res.json({
          employee,
          payment_history: history,
          salaries,
          total_advance_paid: totalAdvancePaid,
          total_salary_generated: totalSalaryGenerated,
          total_paid: totalPaid,
          remaining_due:
            totalSalaryGenerated - totalAdvancePaid
        })
      })
    })
  })
})


// ─────────────────────────────────────────
// POST /api/employees/generate-salary
// Generate salary + create expense
// ─────────────────────────────────────────
router.post('/generate-salary', (req, res) => {
  const {
    employee_id,
    month,
    year,
    payment_mode,
    upi_account,
    notes
  } = req.body

  // Check duplicate
  db.get(`
    SELECT *
    FROM employee_salary_credits
    WHERE employee_id = ?
    AND month = ?
    AND year = ?
  `, [employee_id, month, year], (err, existing) => {
    if (err) return res.status(500).json({ error: err.message })

    if (existing) {
      return res.status(400).json({
        error: `Salary already generated for ${month}/${year}`
      })
    }

    // Get employee
    db.get(`
      SELECT *
      FROM employees
      WHERE id = ?
    `, [employee_id], (err, employee) => {
      if (err) return res.status(500).json({ error: err.message })
      if (!employee)
        return res.status(404).json({ error: 'Employee not found' })

      // Attendance for month
      db.all(`
        SELECT *
        FROM attendance
        WHERE employee_id = ?
        AND strftime('%m', date) = ?
        AND strftime('%Y', date) = ?
      `, [employee_id, month, year], (err, attendance) => {
        if (err) return res.status(500).json({ error: err.message })

        const presentDays =
          attendance.filter(a => a.status === 'present').length

        const halfDays =
          attendance.filter(a => a.status === 'half_day').length

        const effectiveDays =
          presentDays + (halfDays * 0.5)

        const perDaySalary =
          employee.monthly_salary / 30

        const calculatedSalary =
          Math.round(perDaySalary * effectiveDays)

        const today =
          new Date().toISOString().split('T')[0]

        // Save salary credit
        db.run(`
          INSERT INTO employee_salary_credits (
            employee_id,
            month,
            year,
            salary_amount,
            credited_date,
            notes,
            payment_mode,
            upi_account
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          employee_id,
          month,
          year,
          calculatedSalary,
          today,
          notes || `${month}/${year} salary`,
          payment_mode || 'cash',
          upi_account || null
        ], function(err) {
          if (err)
            return res.status(500).json({ error: err.message })

          // Create expense entry automatically
          db.run(`
            INSERT INTO expenses (
              category,
              amount,
              expense_date,
              description,
              paid_to_type,
              paid_to_id,
              payment_mode,
              upi_account
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            'Employee Salary',
            calculatedSalary,
            today,
            `${employee.name} salary (${month}/${year})`,
            'employee',
            employee_id,
            payment_mode || 'cash',
            upi_account || null
          ], (err) => {
            if (err)
              return res.status(500).json({ error: err.message })

            res.json({
              message: 'Salary generated successfully',
              salary_amount: calculatedSalary
            })
          })
        })
      })
    })
  })
})

module.exports = router;