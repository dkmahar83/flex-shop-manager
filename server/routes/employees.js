const express = require('express');
const router = express.Router();
const db = require('../db/database');
const fs = require('fs');
const path = require('path');
const { uploadEmployee } = require('../middleware/upload');
const { getLiveCashBalance } = require('../utils/cashBalance');

// ─────────────────────────────────────────
// HELPER: IST timestamp (consistent with orders.js)
// ─────────────────────────────────────────
function nowIST() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace('T', ' ');
}

// ─────────────────────────────────────────
// HELPER: Advance jo SIRF specific month/year mein diya gaya
// (poore tenure ka outstanding nahi — sirf current month ka advance)
// ─────────────────────────────────────────
function getMonthAdvance(employeeId, month, year, callback) {
  db.get(`
    SELECT COALESCE(SUM(amount), 0) AS total_advance
    FROM expenses
    WHERE paid_to_type = 'employee' AND paid_to_id = ?
    AND strftime('%m', expense_date) = ?
    AND strftime('%Y', expense_date) = ?
  `, [employeeId, month, year], (err, row) => {
    if (err) return callback(err);
    callback(null, row.total_advance);
  });
}

// ─────────────────────────────────────────
// HELPER: Employee ki poori salary_history (ascending by effective_date) —
// day-wise salary calculation ke liye.
// ─────────────────────────────────────────
function getSalaryHistory(employeeId, callback) {
  db.all(`
    SELECT old_salary, new_salary, effective_date
    FROM salary_history
    WHERE employee_id = ?
    ORDER BY effective_date ASC, id ASC
  `, [employeeId], (err, rows) => {
    if (err) return callback(err);
    callback(null, rows);
  });
}

// HELPER: ek specific date par employee ki monthly_salary rate kya thi,
// salary_history se nikaalta hai. Agar kabhi revision hui hi nahi (history
// khaali), hamesha currentSalary use hota hai — purana behavior bilkul
// waisa hi rehta hai jaisa is fix se pehle tha.
function rateOnDate(history, date, currentSalary) {
  let applicable = null;
  for (const row of history) {
    if (row.effective_date <= date) {
      applicable = row;
    } else {
      break;
    }
  }
  if (applicable) return applicable.new_salary;
  // date sabse pehli tracked revision se bhi pehle ki hai — us revision ke
  // old_salary ko hi tab tak ki rate maano.
  if (history.length > 0 && history[0].old_salary != null) {
    return history[0].old_salary;
  }
  return currentSalary;
}

// ─────────────────────────────────────────
// HELPER: Din-wise salary — har attendance record ko USI DIN effective
// thi wahi rate se count karta hai. Mahine/tenure ke beech hui revision
// sahi se handle hoti hai: revision se pehle purani rate, revision ke
// din se aage nayi rate.
// ─────────────────────────────────────────
function calcDayWiseSalary(attendance, history, currentSalary) {
  let total = 0;
  let effectiveDays = 0;
  for (const rec of attendance) {
    const multiplier = rec.status === 'present' ? 1 : rec.status === 'half_day' ? 0.5 : 0;
    if (multiplier === 0) continue;
    const rate = rateOnDate(history, rec.date, currentSalary);
    total += (rate / 30) * multiplier;
    effectiveDays += multiplier;
  }
  return { calculated_salary: Math.round(total), effective_days: effectiveDays };
}

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
// ─────────────────────────────────────────
router.post('/attendance', (req, res) => {
  const { date, records } = req.body;

  if (!date || !records || records.length === 0) {
    return res.status(400).json({ error: 'date and records are required' });
  }

  const upsert = (record) => new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO attendance (employee_id, date, status)
       VALUES (?, ?, ?)
       ON CONFLICT(employee_id, date) DO UPDATE SET status = excluded.status`,
      [record.employee_id, date, record.status],
      (err) => err ? reject(err) : resolve()
    );
  });

  Promise.all(records.map(upsert))
    .then(() => res.status(201).json({ message: 'Attendance marked successfully' }))
    .catch(err => res.status(500).json({ error: 'Attendance save failed: ' + err.message }));
});

// ─────────────────────────────────────────
// ⚠️  IMPORTANT: Named routes (non-:param) MUST come before /:param routes
// in Express. If /attendance/:id or /salary/:id appear before /profile/:id,
// Express will never match /profile/:id correctly.
// Order is: POST/GET on static paths first, then /:param last.
// ─────────────────────────────────────────

// GET /api/employees/attendance/:employee_id
router.get('/attendance/:employee_id', (req, res) => {
  const { employee_id } = req.params;
  const { month, year } = req.query;

  let query = `SELECT * FROM attendance WHERE employee_id = ?`;
  let params = [employee_id];

  if (month && year) {
    query += ` AND strftime('%m', date) = ? AND strftime('%Y', date) = ?`;
    params.push(month, year);
  }

  query += ` GROUP BY date ORDER BY date ASC`;

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET /api/employees/salary/:employee_id
router.get('/salary/:employee_id', (req, res) => {
  const { employee_id } = req.params;
  const { month, year } = req.query;

  db.get(`SELECT * FROM employees WHERE id = ?`, [employee_id], (err, employee) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    db.all(`
      SELECT * FROM attendance
      WHERE employee_id = ?
      AND strftime('%m', date) = ?
      AND strftime('%Y', date) = ?
      GROUP BY date
    `, [employee_id, month, year], (err, attendance) => {
      if (err) return res.status(500).json({ error: err.message });

      const total_days     = attendance.length;
      const present_days   = attendance.filter(a => a.status === 'present').length;
      const half_days      = attendance.filter(a => a.status === 'half_day').length;
      const absent_days    = attendance.filter(a => a.status === 'absent').length;
      const per_day_salary = employee.monthly_salary / 30;

      getSalaryHistory(employee_id, (err, history) => {
        if (err) return res.status(500).json({ error: err.message });

        // Din-wise — mahine ke beech salary revise hui ho to purane din
        // purani rate se, naye din nayi rate se count honge.
        const { calculated_salary, effective_days } = calcDayWiseSalary(attendance, history, employee.monthly_salary);
        const deduction = employee.monthly_salary - calculated_salary;

        getMonthAdvance(employee_id, month, year, (err, monthAdvance) => {
          if (err) return res.status(500).json({ error: err.message });

          const net_payable = calculated_salary - monthAdvance;
          const payable_salary = Math.max(0, net_payable);

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
            outstanding_advance: monthAdvance,
            net_payable,
            payable_salary,
            month,
            year
          });
        });
      });
    });
  });
});

// ─────────────────────────────────────────
// GET /api/employees/profile/:id
// Employee profile + payment history
//
// FIX: This route was previously shadowed by /attendance/:employee_id
// and /salary/:employee_id if registered after them. Now declared here
// in the correct order — static-segment routes always before /:param.
// ─────────────────────────────────────────
router.get('/profile/:id', (req, res) => {
  const { id } = req.params;

  db.get(`SELECT * FROM employees WHERE id = ?`, [id], (err, employee) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    // Advances — ALL-TIME (join date se ab tak). Salary payouts (category
    // 'Employee Salary') aur salary-revision log entries yahan se EXCLUDE
    // kiye — warna generate-salary ne jo net-cash row 'expenses' mein daali
    // thi wahi dobara "Advance" ban ke dikhne/count hone lagti (double count).
    db.all(`
      SELECT id, expense_date as date, amount, description, payment_mode, upi_account,
             'advance' as type, created_at
      FROM expenses
      WHERE paid_to_type = 'employee' AND paid_to_id = ?
      AND category NOT IN ('Employee Salary', 'Salary Revision')
      ORDER BY expense_date DESC
    `, [id], (err, advances) => {
      if (err) return res.status(500).json({ error: err.message });

      // Salary credits — ALL-TIME (gross amount, record/display ke liye)
      db.all(`
        SELECT id, credited_date as date, salary_amount as amount, notes as description,
              payment_mode, upi_account, 'salary' as type, NULL as created_at
        FROM employee_salary_credits
        WHERE employee_id = ?
        ORDER BY credited_date DESC
      `, [id], (err, salaries) => {
        if (err) return res.status(500).json({ error: err.message });

        // Actual NET cash jo salary ke roop mein diya gaya (expenses table se,
        // category 'Employee Salary'). Ye employee_salary_credits ke gross
        // amount se kam ho sakta hai jab us month ka advance adjust hua ho.
        db.get(`
          SELECT COALESCE(SUM(amount), 0) as total
          FROM expenses
          WHERE paid_to_type = 'employee' AND paid_to_id = ?
          AND category = 'Employee Salary'
        `, [id], (err, salaryCashRow) => {
          if (err) return res.status(500).json({ error: err.message });
          const totalSalaryCashPaid = salaryCashRow.total;

          // Salary revisions — real rate changes only (old_salary IS NOT NULL).
          // Payment History mein "Revision" ke roop mein dikhti hain AND
          // day-wise salary calculation mein use hoti hain.
          db.all(`
            SELECT id, old_salary, new_salary, effective_date as date, reason, created_at
            FROM salary_history
            WHERE employee_id = ? AND old_salary IS NOT NULL
            ORDER BY effective_date DESC
          `, [id], (err, revisionRows) => {
            if (err) return res.status(500).json({ error: err.message });

            const revisions = revisionRows.map(r => ({
              id: r.id,
              date: r.date,
              type: 'revision',
              description: `Salary revised: ₹${r.old_salary} → ₹${r.new_salary}${r.reason ? ' | ' + r.reason : ''}`,
              amount: r.new_salary - r.old_salary,
              payment_mode: null,
              upi_account: null,
              created_at: r.created_at
            }));

            getSalaryHistory(id, (err, history) => {
              if (err) return res.status(500).json({ error: err.message });

              // Attendance — ALL-TIME (month/year filter hataya). Wajah: "Salary Earned"
              // aur "Advance Given" ab hamesha SAME time-period (poora tenure) represent
              // karte hain — pehle salary_earned sirf ek mahine ka tha jabki advance/salary
              // history hamesha all-time thi, jisse Net Payable galat/misleading ban jaata tha.
              db.all(`
                SELECT * FROM attendance
                WHERE employee_id = ?
                GROUP BY date
              `, [id], (err, attendance) => {
                if (err) return res.status(500).json({ error: err.message });

                const presentDays = attendance.filter(a => a.status === 'present').length;
                const halfDays    = attendance.filter(a => a.status === 'half_day').length;

                // Din-wise — poore tenure mein salary revise hui ho to purane
                // din purani rate se, naye din nayi rate se count honge.
                const { calculated_salary: salaryEarned, effective_days: effectiveDays } =
                  calcDayWiseSalary(attendance, history, employee.monthly_salary);

                const totalAdvancePaid    = advances.reduce((s, a) => s + a.amount, 0);
                const totalSalaryCredited = salaries.reduce((s, s2) => s + s2.amount, 0);
                // Total actually paid = genuine advances + ACTUAL net cash diya gaya
                // salary mein (gross salary_credited nahi — warna jo advance already
                // us month mein adjust ho chuka, wo dobara ghat jaata).
                const totalPaid  = totalAdvancePaid + totalSalaryCashPaid;
                const netPayable = salaryEarned - totalAdvancePaid - totalSalaryCashPaid;

                const payment_history = [...advances, ...salaries, ...revisions]
                  .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

                res.json({
                  employee,
                  payment_history,
                  total_advance_paid:      totalAdvancePaid,
                  total_salary_credited:   totalSalaryCredited,
                  total_salary_cash_paid:  totalSalaryCashPaid,
                  total_paid:              totalPaid,
                  salary_earned:           salaryEarned,
                  effective_days:          effectiveDays,
                  present_days:            presentDays,
                  half_days:               halfDays,
                  net_payable:             netPayable
                });
              });
            });
          });
        });
      });
    });
  });
});

// ─────────────────────────────────────────
// POST /api/employees/generate-salary
// ─────────────────────────────────────────
router.post('/generate-salary', (req, res) => {
  const { employee_id, month, year, payment_mode, upi_account, notes, denomination_breakdown } = req.body;
  const createdAt = nowIST();
  const breakdownToSave = ((payment_mode || 'cash') === 'cash' && denomination_breakdown && Object.keys(denomination_breakdown).length > 0)
    ? JSON.stringify(denomination_breakdown)
    : null;

  db.get(`
    SELECT * FROM employee_salary_credits
    WHERE employee_id = ? AND month = ? AND year = ?
  `, [employee_id, month, year], (err, existing) => {
    if (err) return res.status(500).json({ error: err.message });
    if (existing) {
      return res.status(400).json({ error: `Salary already generated for ${month}/${year}` });
    }

    db.get(`SELECT * FROM employees WHERE id = ?`, [employee_id], (err, employee) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!employee) return res.status(404).json({ error: 'Employee not found' });

      db.all(`
        SELECT * FROM attendance
        WHERE employee_id = ?
        AND strftime('%m', date) = ?
        AND strftime('%Y', date) = ?
        GROUP BY date
      `, [employee_id, month, year], (err, attendance) => {
        if (err) return res.status(500).json({ error: err.message });

        // Use IST date, not UTC
        const today = nowIST().split(' ')[0];

        getSalaryHistory(employee_id, (err, history) => {
          if (err) return res.status(500).json({ error: err.message });

          // Din-wise — mahine ke beech salary revise hui ho to purane din
          // purani rate se, naye din nayi rate se count honge.
          const { calculated_salary: calculatedSalary } = calcDayWiseSalary(attendance, history, employee.monthly_salary);

          getMonthAdvance(employee_id, month, year, (err, monthAdvance) => {
            if (err) return res.status(500).json({ error: err.message });

            const payableNow = Math.max(0, calculatedSalary - monthAdvance);

            function creditSalary() {
              db.run(`
              INSERT INTO employee_salary_credits
                (employee_id, month, year, salary_amount, credited_date, notes, payment_mode, upi_account, denomination_breakdown)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              employee_id, month, year, calculatedSalary, today,
              notes || `${month}/${year} salary${monthAdvance > 0 ? ` (₹${monthAdvance} advance adjust)` : ''}`,
              payment_mode || 'cash', upi_account || null, breakdownToSave
            ], function(err) {
              if (err) return res.status(500).json({ error: err.message });

              db.run(`
                INSERT INTO expenses
                  (category, amount, expense_date, description, paid_to_type, paid_to_id,
                   payment_mode, upi_account, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              `, [
                'Employee Salary', payableNow, today,
                `${employee.name} salary (${month}/${year})${monthAdvance > 0 ? ` — ₹${monthAdvance} advance adjusted` : ''}`,
                'employee', employee_id,
                payment_mode || 'cash', upi_account || null, createdAt
              ], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({
                  message: 'Salary generated successfully',
                  salary_amount: calculatedSalary,
                  advance_adjusted: monthAdvance,
                  net_paid: payableNow
                });
              });
              });
            }

            // A cash payout can't exceed what's actually in the drawer. UPI
            // payouts don't touch the physical cash balance, so they skip this.
            if ((payment_mode || 'cash') === 'cash') {
              getLiveCashBalance((err, liveBalance) => {
                if (err) return res.status(500).json({ error: err.message });
                if (payableNow > liveBalance) {
                  return res.status(400).json({
                    error: `Galla mein sirf ₹${liveBalance} hai — ₹${payableNow} salary cash mein nahi de sakte.`
                  });
                }
                creditSalary();
              });
            } else {
              creditSalary();
            }
          });
        });
      });
    });
  });
});
// ─────────────────────────────────────────
// PUT /api/employees/:id/salary
// ─────────────────────────────────────────
router.put('/:id/salary', (req, res) => {
  const { id } = req.params;
  const { new_salary, reason, effective_date } = req.body;

  if (!new_salary || isNaN(new_salary) || new_salary <= 0)
    return res.status(400).json({ error: 'Valid salary required' });

  db.get(`SELECT * FROM employees WHERE id = ?`, [id], (err, employee) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const old_salary = employee.monthly_salary;
    const date = effective_date || nowIST().split(' ')[0];
    const createdAt = nowIST();

    db.run(`UPDATE employees SET monthly_salary = ? WHERE id = ?`, [new_salary, id], function(err) {
      if (err) return res.status(500).json({ error: err.message });

      // salary_history mein log karo — isi table se day-wise salary
      // calculate hoti hai (is date se pehle purani rate, is date se
      // aage nayi rate use hogi), aur ye Payment History mein "Revision"
      // ke roop mein bhi dikhta hai.
      db.run(`
        INSERT INTO salary_history (employee_id, old_salary, new_salary, effective_date, reason, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [id, old_salary, new_salary, date, reason || null, createdAt], (err) => {
        if (err) console.warn('History log failed:', err.message);
        res.json({ message: 'Salary updated', old_salary, new_salary: parseInt(new_salary) });
      });
    });
  });
});
// Employee + saara related data delete karta hai
// ─────────────────────────────────────────
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  db.get(`SELECT * FROM employees WHERE id = ?`, [id], (err, employee) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    db.serialize(() => {
      db.run(`DELETE FROM attendance WHERE employee_id = ?`, [id]);
      db.run(`DELETE FROM employee_salary_credits WHERE employee_id = ?`, [id]);
      db.run(`DELETE FROM expenses WHERE paid_to_type = 'employee' AND paid_to_id = ?`, [id]);
      db.run(`DELETE FROM employees WHERE id = ?`, [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: `${employee.name} aur unka saara data delete ho gaya.` });
      });
    });
  });
});

// ─────────────────────────────────────────
// POST /api/employees/:id/photo
// ─────────────────────────────────────────
router.post('/:id/photo', uploadEmployee.single('photo'), (req, res) => {
  const { id } = req.params;

  if (!req.file) {
    return res.status(400).json({ error: 'No photo file received' });
  }

  db.get(`SELECT photo_path FROM employees WHERE id = ?`, [id], (err, employee) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!employee) {
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({ error: 'Employee not found' });
    }

    const newPhotoPath = `uploads/employees/${req.file.filename}`;

    db.run(`UPDATE employees SET photo_path = ? WHERE id = ?`, [newPhotoPath, id], function (err) {
      if (err) return res.status(500).json({ error: err.message });

      if (employee.photo_path) {
        const oldFullPath = path.join(__dirname, '..', employee.photo_path);
        fs.unlink(oldFullPath, () => {});
      }

      res.json({ message: 'Photo uploaded successfully', photo_path: newPhotoPath });
    });
  });
});

// ─────────────────────────────────────────
// DELETE /api/employees/:id/photo
// ─────────────────────────────────────────
router.delete('/:id/photo', (req, res) => {
  const { id } = req.params;

  db.get(`SELECT photo_path FROM employees WHERE id = ?`, [id], (err, employee) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });
    if (!employee.photo_path) return res.status(400).json({ error: 'No photo to delete' });

    const fullPath = path.join(__dirname, '..', employee.photo_path);

    db.run(`UPDATE employees SET photo_path = NULL WHERE id = ?`, [id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      fs.unlink(fullPath, () => {});
      res.json({ message: 'Photo removed successfully' });
    });
  });
});

module.exports = router;