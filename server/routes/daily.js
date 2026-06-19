const express = require('express');
const router = express.Router();
const db = require('../db/database');

// GET /api/daily?month=06&year=2026
router.get('/', (req, res) => {
  const { month, year } = req.query;
  let query = `SELECT * FROM daily_records ORDER BY record_date DESC`;
  let params = [];
  if (month && year) {
    query = `
      SELECT * FROM daily_records
      WHERE strftime('%m', record_date) = ?
      AND strftime('%Y', record_date) = ?
      ORDER BY record_date DESC
    `;
    params = [month, year];
  }
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET /api/daily/today
router.get('/today', (req, res) => {
  const today = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).split(' ')[0];

  db.get(`SELECT * FROM daily_records WHERE record_date = ?`, [today], (err, record) => {
    if (err) return res.status(500).json({ error: err.message });

    // Step 1: Follow-up payments from payments table (non-advance)
    db.all(`
      SELECT payments.amount, payments.payment_mode, payments.created_at,
             orders.description, customers.firm_name
      FROM payments
      JOIN orders ON payments.order_id = orders.id
      JOIN customers ON payments.customer_id = customers.id
      WHERE payments.payment_date = ?
    `, [today], (err, followupPayments) => {
      if (err) return res.status(500).json({ error: err.message });

      // Step 2: Advance payments via UPI (from upi_transactions, order-linked)
      db.all(`
        SELECT upi_transactions.amount, upi_transactions.upi_account as payment_mode,
               upi_transactions.created_at,
               COALESCE(customers.firm_name, upi_transactions.customer_name) as firm_name,
               'Advance' as description
        FROM upi_transactions
        LEFT JOIN customers ON upi_transactions.customer_id = customers.id
        WHERE upi_transactions.transaction_date = ?
          AND upi_transactions.order_id IS NOT NULL
          AND upi_transactions.notes = 'Order Advance Payment'
      `, [today], (err, advanceUpi) => {
        if (err) return res.status(500).json({ error: err.message });

        // Step 3: Advance payments via Cash (from cash_income, order-linked)
        db.all(`
          SELECT cash_income.amount, 'cash' as payment_mode, cash_income.created_at,
                 customers.firm_name, 'Advance' as description
          FROM cash_income
          LEFT JOIN customers ON cash_income.customer_id = customers.id
          WHERE cash_income.income_date = ?
            AND cash_income.notes = 'Order Advance Payment'
        `, [today], (err, advanceCash) => {
          if (err) return res.status(500).json({ error: err.message });

          // All order payments = follow-up + advances
          const orderPayments = [...followupPayments, ...advanceUpi, ...advanceCash];
          const orderPaymentsTotal = orderPayments.reduce((s, p) => s + p.amount, 0);

          // Step 4: Non-order UPI (standalone UPI income, not linked to any order)
          db.all(`
            SELECT upi_account, SUM(amount) as total, COUNT(*) as count
            FROM upi_transactions
            WHERE transaction_date = ?
              AND order_id IS NULL
              AND (notes NOT LIKE 'EXPENSE:%' OR notes IS NULL)
            GROUP BY upi_account
          `, [today], (err, upiToday) => {
            if (err) return res.status(500).json({ error: err.message });

            db.all(`
              SELECT upi_transactions.*, customers.firm_name as customer_firm
              FROM upi_transactions
              LEFT JOIN customers ON upi_transactions.customer_id = customers.id
              WHERE transaction_date = ?
                AND order_id IS NULL
                AND (upi_transactions.notes NOT LIKE 'EXPENSE:%' OR upi_transactions.notes IS NULL)
              ORDER BY id DESC
            `, [today], (err, upiDetail) => {
              if (err) return res.status(500).json({ error: err.message });

              db.all(`
                SELECT cheques.*, customers.firm_name as customer_firm
                FROM cheques
                LEFT JOIN customers ON cheques.customer_id = customers.id
                WHERE received_date = ?
              `, [today], (err, chequesToday) => {
                if (err) return res.status(500).json({ error: err.message });

                // Non-order cash income (manually recorded, not order-related)
                db.all(`
                  SELECT cash_income.*, customers.firm_name
                  FROM cash_income
                  LEFT JOIN customers ON cash_income.customer_id = customers.id
                  WHERE income_date = ?
                    AND (cash_income.notes NOT IN ('Order Advance Payment', 'Order Payment') OR cash_income.notes IS NULL)
                  ORDER BY id DESC
                `, [today], (err, cashIncomeToday) => {
                  if (err) return res.status(500).json({ error: err.message });

                  db.get(`
                    SELECT COALESCE(SUM(amount), 0) as total FROM expenses
                    WHERE expense_date = ? AND category != 'Ghar Khata'
                  `, [today], (err, todayExpenses) => {
                    if (err) return res.status(500).json({ error: err.message });

                    const cashIncomeTotal = cashIncomeToday.reduce((s, c) => s + c.amount, 0);
                    const upiTotal        = upiToday.reduce((s, u) => s + u.total, 0);
                    const chequeTotal     = chequesToday.reduce((s, c) => s + c.amount, 0);
                    const manualSales     = record ? record.total_sales : 0;
                    const totalCashIn     = orderPaymentsTotal + cashIncomeTotal + upiTotal;

                    res.json({
                      record_date:          today,
                      manual_sales:         manualSales,
                      total_expenses:       todayExpenses.total || 0,
                      order_payments:       orderPayments,
                      order_payments_total: orderPaymentsTotal,
                      payments_total:       orderPaymentsTotal,
                      payments_received:    orderPayments, // full list with created_at for time display
                      cash_income_today:    cashIncomeToday,
                      cash_income_total:    cashIncomeTotal,
                      upi_by_account:       upiToday,
                      upi_detail:           upiDetail,
                      upi_total:            upiTotal,
                      cheques_today:        chequesToday,
                      cheque_total:         chequeTotal,
                      total_cash_in:        totalCashIn
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});

// GET /api/daily/report?month=06&year=2026
router.get('/report', (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return res.status(400).json({ error: 'month and year required' });
  const m = month.padStart(2, '0');

  // 1. Order follow-up payments (payments table)
  db.get(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM payments
    WHERE strftime('%m', payment_date) = ? AND strftime('%Y', payment_date) = ?
  `, [m, year], (err, orderPayments) => {
    if (err) return res.status(500).json({ error: err.message });

    // 2. Advance payments via UPI (order-linked upi_transactions)
    db.get(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM upi_transactions
      WHERE strftime('%m', transaction_date) = ? AND strftime('%Y', transaction_date) = ?
        AND order_id IS NOT NULL
        AND notes = 'Order Advance Payment'
    `, [m, year], (err, advanceUpi) => {
      if (err) return res.status(500).json({ error: err.message });

      // 3. Advance payments via Cash (order-linked cash_income)
      db.get(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM cash_income
        WHERE strftime('%m', income_date) = ? AND strftime('%Y', income_date) = ?
          AND notes = 'Order Advance Payment'
      `, [m, year], (err, advanceCash) => {
        if (err) return res.status(500).json({ error: err.message });

        // 4. Cash income ONLY (non-order, payment_mode = cash) — Ghar Khata excluded — includes cleared cheques
        db.get(`
          SELECT COALESCE(SUM(ci.amount), 0) as total
          FROM cash_income ci
          LEFT JOIN customers c ON ci.customer_id = c.id
          WHERE strftime('%m', ci.income_date) = ?
            AND strftime('%Y', ci.income_date) = ?
            AND (ci.payment_mode = 'cash' OR ci.payment_mode IS NULL OR ci.payment_mode = 'cheque')
            AND ci.notes != 'Order Advance Payment'
            AND (c.firm_name != 'Ghar Khata' OR c.id IS NULL)
        `, [m, year], (err, cashIncome) => {
          if (err) return res.status(500).json({ error: err.message });

          // 5. UPI income — non-order only (order_id IS NULL) — Ghar Khata excluded
          db.get(`
            SELECT COALESCE(SUM(amount), 0) as total FROM (
              SELECT ut.amount
              FROM upi_transactions ut
              LEFT JOIN customers c ON ut.customer_id = c.id
              WHERE strftime('%m', ut.transaction_date) = ?
                AND strftime('%Y', ut.transaction_date) = ?
                AND (ut.notes NOT LIKE 'EXPENSE:%' OR ut.notes IS NULL)
                AND (c.firm_name != 'Ghar Khata' OR c.id IS NULL)
                AND ut.order_id IS NULL
              UNION ALL
              SELECT ci.amount
              FROM cash_income ci
              LEFT JOIN customers c ON ci.customer_id = c.id
              WHERE strftime('%m', ci.income_date) = ?
                AND strftime('%Y', ci.income_date) = ?
                AND ci.payment_mode = 'upi'
                AND ci.notes != 'Order Advance Payment'
                AND (c.firm_name != 'Ghar Khata' OR c.id IS NULL)
            )
          `, [m, year, m, year], (err, upiIncome) => {
            if (err) return res.status(500).json({ error: err.message });

            // 6. Expenses by category — Ghar Khata excluded
            db.all(`
              SELECT category, COALESCE(SUM(amount), 0) as total, COUNT(*) as count
              FROM expenses
              WHERE strftime('%m', expense_date) = ? AND strftime('%Y', expense_date) = ?
                AND category != 'Ghar Khata'
              GROUP BY category
              ORDER BY total DESC
            `, [m, year], (err, expensesByCategory) => {
              if (err) return res.status(500).json({ error: err.message });

              // 7. Total expenses — Ghar Khata excluded
              db.get(`
                SELECT COALESCE(SUM(amount), 0) as total
                FROM expenses
                WHERE strftime('%m', expense_date) = ? AND strftime('%Y', expense_date) = ?
                  AND category != 'Ghar Khata'
              `, [m, year], (err, totalExpenses) => {
                if (err) return res.status(500).json({ error: err.message });

                // 8. Dues
                db.all(`
                  SELECT orders.id, orders.description, orders.total_amount,
                    orders.balance_due, orders.follow_up_date, orders.status,
                    customers.firm_name, customers.phone
                  FROM orders
                  JOIN customers ON orders.customer_id = customers.id
                  WHERE orders.balance_due > 0 AND orders.deleted_at IS NULL
                  ORDER BY orders.follow_up_date ASC, orders.balance_due DESC
                `, [], (err, dues) => {
                  if (err) return res.status(500).json({ error: err.message });

                  // 9. Total outstanding
                  db.get(`
                    SELECT COALESCE(SUM(balance_due), 0) as total
                    FROM orders WHERE balance_due > 0 AND deleted_at IS NULL
                  `, [], (err, totalDues) => {
                    if (err) return res.status(500).json({ error: err.message });

                    const advanceTotal = (advanceUpi.total || 0) + (advanceCash.total || 0);
                    const totalIncome = (orderPayments.total || 0) + advanceTotal + (cashIncome.total || 0) + (upiIncome.total || 0);
                    const totalExp = totalExpenses.total || 0;

                    res.json({
                      month: m, year,
                      income: {
                        order_payments: orderPayments.total || 0,
                        advance_payments: advanceTotal,
                        cash_income: cashIncome.total || 0,
                        upi_income: upiIncome.total || 0,
                        total: totalIncome
                      },
                      expenses: { by_category: expensesByCategory, total: totalExp },
                      net_profit: totalIncome - totalExp,
                      dues: { list: dues, total_outstanding: totalDues.total || 0 }
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});

// GET /api/daily/report/yearly?year=2026
router.get('/report/yearly', (req, res) => {
  const { year } = req.query;
  if (!year) return res.status(400).json({ error: 'year required' });

  db.all(`
    SELECT strftime('%m', payment_date) as month, COALESCE(SUM(amount), 0) as total
    FROM payments WHERE strftime('%Y', payment_date) = ?
    GROUP BY month
  `, [year], (err, orderPayments) => {
    if (err) return res.status(500).json({ error: err.message });

    // Advance UPI yearly
    db.all(`
      SELECT strftime('%m', transaction_date) as month, COALESCE(SUM(amount), 0) as total
      FROM upi_transactions
      WHERE strftime('%Y', transaction_date) = ?
        AND order_id IS NOT NULL AND notes = 'Order Advance Payment'
      GROUP BY month
    `, [year], (err, advanceUpi) => {
      if (err) return res.status(500).json({ error: err.message });

      // Advance Cash yearly
      db.all(`
        SELECT strftime('%m', income_date) as month, COALESCE(SUM(amount), 0) as total
        FROM cash_income
        WHERE strftime('%Y', income_date) = ? AND notes = 'Order Advance Payment'
        GROUP BY month
      `, [year], (err, advanceCash) => {
        if (err) return res.status(500).json({ error: err.message });

        // Cash only (non-order) — Ghar Khata excluded
        db.all(`
          SELECT strftime('%m', ci.income_date) as month, COALESCE(SUM(ci.amount), 0) as total
          FROM cash_income ci
          LEFT JOIN customers c ON ci.customer_id = c.id
          WHERE strftime('%Y', ci.income_date) = ?
            AND (ci.payment_mode = 'cash' OR ci.payment_mode IS NULL)
            AND ci.notes != 'Order Advance Payment'
            AND (c.firm_name != 'Ghar Khata' OR c.id IS NULL)
          GROUP BY month
        `, [year], (err, cashIncome) => {
          if (err) return res.status(500).json({ error: err.message });

          // UPI non-order — Ghar Khata excluded
          db.all(`
            SELECT month, COALESCE(SUM(amount), 0) as total FROM (
              SELECT strftime('%m', ut.transaction_date) as month, ut.amount
              FROM upi_transactions ut
              LEFT JOIN customers c ON ut.customer_id = c.id
              WHERE strftime('%Y', ut.transaction_date) = ?
                AND (ut.notes NOT LIKE 'EXPENSE:%' OR ut.notes IS NULL)
                AND (c.firm_name != 'Ghar Khata' OR c.id IS NULL)
                AND ut.order_id IS NULL
              UNION ALL
              SELECT strftime('%m', ci.income_date) as month, ci.amount
              FROM cash_income ci
              LEFT JOIN customers c ON ci.customer_id = c.id
              WHERE strftime('%Y', ci.income_date) = ?
                AND ci.payment_mode = 'upi'
                AND ci.notes != 'Order Advance Payment'
                AND (c.firm_name != 'Ghar Khata' OR c.id IS NULL)
            )
            GROUP BY month
          `, [year, year], (err, upiIncome) => {
            if (err) return res.status(500).json({ error: err.message });

            db.all(`
              SELECT strftime('%m', expense_date) as month, COALESCE(SUM(amount), 0) as total
              FROM expenses
              WHERE strftime('%Y', expense_date) = ? AND category != 'Ghar Khata'
              GROUP BY month
            `, [year], (err, monthlyExpenses) => {
              if (err) return res.status(500).json({ error: err.message });

              const months = ['01','02','03','04','05','06','07','08','09','10','11','12'];
              const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

              const summary = months.map((m, i) => {
                const orders   = (orderPayments.find(r => r.month === m) || {}).total || 0;
                const advUpi   = (advanceUpi.find(r => r.month === m)   || {}).total || 0;
                const advCash  = (advanceCash.find(r => r.month === m)  || {}).total || 0;
                const cash     = (cashIncome.find(r => r.month === m)   || {}).total || 0;
                const upi      = (upiIncome.find(r => r.month === m)    || {}).total || 0;
                const expenses = (monthlyExpenses.find(r => r.month === m) || {}).total || 0;
                const income   = orders + advUpi + advCash + cash + upi;
                return { month: m, month_name: monthNames[i], income, expenses, net: income - expenses };
              });

              const totalIncome   = summary.reduce((s, r) => s + r.income, 0);
              const totalExpenses = summary.reduce((s, r) => s + r.expenses, 0);

              res.json({
                year,
                monthly_summary: summary,
                total_income: totalIncome,
                total_expenses: totalExpenses,
                net_profit: totalIncome - totalExpenses
              });
            });
          });
        });
      });
    });
  });
});

// POST /api/daily/cash-income
router.post('/cash-income', (req, res) => {
  const { customer_id, amount, income_date, notes, payment_mode, upi_account } = req.body;
  if (!customer_id) return res.status(400).json({ error: 'customer_id is required' });
  if (!amount || isNaN(amount) || parseInt(Number(amount), 10) <= 0)
    return res.status(400).json({ error: 'Valid amount is required' });

  const parsedAmount = parseInt(Number(amount), 10);
  const date = income_date || new Date().toLocaleString('sv-SE', {timeZone: 'Asia/Kolkata'}).split(' ')[0];
  const createdAt = new Date().toLocaleString('sv-SE', {timeZone: 'Asia/Kolkata'}).replace('T', ' ');

  db.run(`
    INSERT INTO cash_income (customer_id, amount, income_date, notes, payment_mode, upi_account, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    customer_id, parsedAmount, date, notes || null,
    payment_mode || 'cash',
    payment_mode === 'upi' ? upi_account : null,
    createdAt
  ], function(err) {
    if (err) return res.status(500).json({ error: err.message });

    if (payment_mode === 'upi' && upi_account) {
      db.get(`SELECT firm_name FROM customers WHERE id = ?`, [customer_id], (err, customer) => {
        db.run(`
          INSERT INTO upi_transactions
            (upi_account, customer_id, customer_name, amount, transaction_date, notes, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          upi_account, customer_id,
          customer ? customer.firm_name : null,
          parsedAmount, date, notes || 'Cash Income', createdAt
        ], () => {});
      });
    }

    res.status(201).json({ id: this.lastID, message: 'Income saved' });
  });
});

// GET /api/daily/summary
router.get('/summary', (req, res) => {
  const { month, year } = req.query;

  db.get(`
    SELECT COUNT(*) as days_recorded FROM daily_records
    WHERE strftime('%m', record_date) = ? AND strftime('%Y', record_date) = ?
  `, [month, year], (err, daily) => {
    if (err) return res.status(500).json({ error: err.message });

    // Follow-up payments
    db.get(`
      SELECT COALESCE(SUM(amount), 0) as total FROM payments
      WHERE strftime('%m', payment_date) = ? AND strftime('%Y', payment_date) = ?
    `, [month, year], (err, payments) => {
      if (err) return res.status(500).json({ error: err.message });

      // Advance UPI
      db.get(`
        SELECT COALESCE(SUM(amount), 0) as total FROM upi_transactions
        WHERE strftime('%m', transaction_date) = ? AND strftime('%Y', transaction_date) = ?
          AND order_id IS NOT NULL AND notes = 'Order Advance Payment'
      `, [month, year], (err, advanceUpi) => {
        if (err) return res.status(500).json({ error: err.message });

        // Advance Cash
        db.get(`
          SELECT COALESCE(SUM(amount), 0) as total FROM cash_income
          WHERE strftime('%m', income_date) = ? AND strftime('%Y', income_date) = ?
            AND notes = 'Order Advance Payment'
        `, [month, year], (err, advanceCash) => {
          if (err) return res.status(500).json({ error: err.message });

          // Non-order cash — Ghar Khata excluded — includes cleared cheques
          db.get(`
            SELECT COALESCE(SUM(ci.amount), 0) as total
            FROM cash_income ci
            LEFT JOIN customers c ON ci.customer_id = c.id
            WHERE strftime('%m', ci.income_date) = ? AND strftime('%Y', ci.income_date) = ?
              AND (ci.payment_mode = 'cash' OR ci.payment_mode IS NULL OR ci.payment_mode = 'cheque')
              AND ci.notes != 'Order Advance Payment'
              AND (c.firm_name != 'Ghar Khata' OR c.id IS NULL)
          `, [month, year], (err, cashIncome) => {
            if (err) return res.status(500).json({ error: err.message });

            // Non-order UPI — Ghar Khata excluded
            db.get(`
              SELECT COALESCE(SUM(amount), 0) as total FROM (
                SELECT ut.amount
                FROM upi_transactions ut
                LEFT JOIN customers c ON ut.customer_id = c.id
                WHERE strftime('%m', ut.transaction_date) = ? AND strftime('%Y', ut.transaction_date) = ?
                  AND (ut.notes NOT LIKE 'EXPENSE:%' OR ut.notes IS NULL)
                  AND (c.firm_name != 'Ghar Khata' OR c.id IS NULL)
                  AND ut.order_id IS NULL
                UNION ALL
                SELECT ci.amount
                FROM cash_income ci
                LEFT JOIN customers c ON ci.customer_id = c.id
                WHERE strftime('%m', ci.income_date) = ? AND strftime('%Y', ci.income_date) = ?
                  AND ci.payment_mode = 'upi'
                  AND ci.notes != 'Order Advance Payment'
                  AND (c.firm_name != 'Ghar Khata' OR c.id IS NULL)
              )
            `, [month, year, month, year], (err, upiIncome) => {
              if (err) return res.status(500).json({ error: err.message });

              db.get(`
                SELECT COALESCE(SUM(amount), 0) as total FROM expenses
                WHERE strftime('%m', expense_date) = ? AND strftime('%Y', expense_date) = ?
                  AND category != 'Ghar Khata'
              `, [month, year], (err, expenses) => {
                if (err) return res.status(500).json({ error: err.message });

                const paymentsTotal = (payments.total || 0) + (advanceUpi.total || 0) + (advanceCash.total || 0);
                const cashTotal     = cashIncome.total || 0;
                const upiTotal      = upiIncome.total  || 0;
                const totalSales    = paymentsTotal + cashTotal + upiTotal;
                const totalExpenses = expenses.total || 0;

                res.json({
                  days_recorded:     daily.days_recorded || 0,
                  payments_total:    paymentsTotal,
                  cash_income_total: cashTotal,
                  upi_income_total:  upiTotal,
                  total_sales:       totalSales,
                  total_expenses:    totalExpenses,
                  net_profit:        totalSales - totalExpenses
                });
              });
            });
          });
        });
      });
    });
  });
});

// GET /api/daily/ledger/date?date=2026-06-15
router.get('/ledger/date', (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date required' });

  // Follow-up order payments
  db.all(`
    SELECT payments.amount,
      CASE
        WHEN payments.payment_mode = 'upi' AND payments.upi_account IS NOT NULL
        THEN payments.upi_account
        ELSE payments.payment_mode
      END as payment_mode,
      payments.created_at,
      customers.firm_name as party_name, 'Order Payment' as type
    FROM payments
    JOIN orders ON payments.order_id = orders.id
    JOIN customers ON payments.customer_id = customers.id
    WHERE payments.payment_date = ?
  `, [date], (err, orderPayments) => {
    if (err) return res.status(500).json({ error: err.message });

    // Advance UPI payments
    db.all(`
      SELECT upi_transactions.amount, upi_transactions.upi_account as payment_mode,
        upi_transactions.created_at,
        COALESCE(customers.firm_name, upi_transactions.customer_name) as party_name,
        'Order Payment' as type
      FROM upi_transactions
      LEFT JOIN customers ON upi_transactions.customer_id = customers.id
      WHERE upi_transactions.transaction_date = ?
        AND upi_transactions.order_id IS NOT NULL
        AND upi_transactions.notes = 'Order Advance Payment'
    `, [date], (err, advanceUpiPayments) => {
      if (err) return res.status(500).json({ error: err.message });

      // Advance Cash payments
      db.all(`
        SELECT cash_income.amount, 'cash' as payment_mode, cash_income.created_at,
          customers.firm_name as party_name, 'Order Payment' as type
        FROM cash_income
        LEFT JOIN customers ON cash_income.customer_id = customers.id
        WHERE cash_income.income_date = ?
          AND cash_income.notes = 'Order Advance Payment'
      `, [date], (err, advanceCashPayments) => {
        if (err) return res.status(500).json({ error: err.message });

        // Non-order cash income
        db.all(`
          SELECT cash_income.amount, cash_income.payment_mode,
            cash_income.upi_account, cash_income.created_at,
            cash_income.notes,
            customers.firm_name as party_name,
            'Cash Income' as type
          FROM cash_income
          LEFT JOIN customers ON cash_income.customer_id = customers.id
          WHERE cash_income.income_date = ?
            AND (cash_income.notes != 'Order Advance Payment' OR cash_income.notes IS NULL)
        `, [date], (err, cashIncome) => {
          if (err) return res.status(500).json({ error: err.message });

          // Non-order UPI payments
          db.all(`
            SELECT amount, upi_account as payment_mode,
              COALESCE(customers.firm_name, 'Unknown') as party_name, 'UPI Payment' as type
            FROM upi_transactions
            LEFT JOIN customers ON upi_transactions.customer_id = customers.id
            WHERE transaction_date = ?
              AND (notes NOT LIKE 'EXPENSE:%' OR notes IS NULL)
              AND order_id IS NULL
          `, [date], (err, upiPayments) => {
            if (err) return res.status(500).json({ error: err.message });

            db.all(`
              SELECT expenses.amount, expenses.payment_mode, expenses.category,
                expenses.upi_account,
                CASE
                  WHEN paid_to_type = 'employee' THEN employees.name
                  WHEN paid_to_type = 'vendor' THEN vendors.name
                  ELSE expenses.category
                END as party_name, expenses.description, expenses.created_at
              FROM expenses
              LEFT JOIN employees ON paid_to_type = 'employee' AND paid_to_id = employees.id
              LEFT JOIN vendors ON paid_to_type = 'vendor' AND paid_to_id = vendors.id
              WHERE expense_date = ?
            `, [date], (err, expenses) => {
              if (err) return res.status(500).json({ error: err.message });

              const income = [...orderPayments, ...advanceUpiPayments, ...advanceCashPayments, ...cashIncome, ...upiPayments];
              const totalIncome = income.reduce((s, i) => s + i.amount, 0);
              const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

              res.json({
                date, income, expenses,
                total_income: totalIncome,
                total_expenses: totalExpenses,
                net: totalIncome - totalExpenses
              });
            });
          });
        });
      });
    });
  });
});

// GET /api/daily/ledger?month=06&year=2026
router.get('/ledger', (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return res.status(400).json({ error: 'month and year required' });

  const params = [month.padStart(2,'0'), year];

  db.all(`
    SELECT payments.payment_date as date, 'Order Payment' as type,
      customers.firm_name as party_name, payments.payment_mode, payments.amount
    FROM payments
    JOIN orders ON payments.order_id = orders.id
    JOIN customers ON payments.customer_id = customers.id
    WHERE strftime('%m', payments.payment_date) = ? AND strftime('%Y', payments.payment_date) = ?
  `, params, (err, orderPayments) => {
    if (err) return res.status(500).json({ error: err.message });

    db.all(`
      SELECT cash_income.income_date as date, 'Cash Income' as type,
        customers.firm_name as party_name, cash_income.payment_mode, cash_income.amount
      FROM cash_income
      LEFT JOIN customers ON cash_income.customer_id = customers.id
      WHERE strftime('%m', cash_income.income_date) = ? AND strftime('%Y', cash_income.income_date) = ?
    `, params, (err, cashIncome) => {
      if (err) return res.status(500).json({ error: err.message });

      db.all(`
        SELECT expense_date as date, 'Expense' as type,
          CASE
            WHEN paid_to_type = 'employee' THEN employees.name
            WHEN paid_to_type = 'vendor' THEN vendors.name
            ELSE category
          END as party_name, payment_mode, -amount as amount
        FROM expenses
        LEFT JOIN employees ON paid_to_type = 'employee' AND paid_to_id = employees.id
        LEFT JOIN vendors ON paid_to_type = 'vendor' AND paid_to_id = vendors.id
        WHERE strftime('%m', expense_date) = ? AND strftime('%Y', expense_date) = ?
      `, params, (err, expenses) => {
        if (err) return res.status(500).json({ error: err.message });

        const allRows = [...orderPayments, ...cashIncome, ...expenses]
          .sort((a, b) => b.date.localeCompare(a.date));
        res.json(allRows);
      });
    });
  });
});

// GET /api/daily/cash-drawer?date=2026-06-17
router.get('/cash-drawer', (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date required' });

  const openingQuery = `
    SELECT COALESCE(SUM(cash_in), 0) - COALESCE(SUM(cash_out), 0) as opening_balance
    FROM (
      SELECT amount as cash_in, 0 as cash_out FROM payments
      WHERE payment_mode = 'cash' AND payment_date < ?
      UNION ALL
      SELECT amount as cash_in, 0 as cash_out FROM cash_income
      WHERE (payment_mode = 'cash' OR payment_mode IS NULL) AND income_date < ?
      UNION ALL
      SELECT 0 as cash_in, amount as cash_out FROM expenses
      WHERE payment_mode = 'cash' AND expense_date < ?
    )
  `;

  db.get(openingQuery, [date, date, date], (err, openingRow) => {
    if (err) return res.status(500).json({ error: err.message });
    const openingBalance = openingRow?.opening_balance || 0;

    db.all(`
      SELECT amount, 'Order Payment' as type, customers.firm_name as party_name,
             payment_date as txn_date, payments.created_at
      FROM payments
      JOIN orders ON payments.order_id = orders.id
      JOIN customers ON payments.customer_id = customers.id
      WHERE payments.payment_mode = 'cash' AND payments.payment_date = ?
      UNION ALL
      SELECT cash_income.amount, 'Cash Income' as type, customers.firm_name as party_name,
             income_date as txn_date, cash_income.created_at
      FROM cash_income
      LEFT JOIN customers ON cash_income.customer_id = customers.id
      WHERE (cash_income.payment_mode = 'cash' OR cash_income.payment_mode IS NULL)
        AND cash_income.income_date = ?
    `, [date, date], (err, cashInRows) => {
      if (err) return res.status(500).json({ error: err.message });

      db.all(`
        SELECT expenses.amount, expenses.category,
          CASE
            WHEN paid_to_type = 'employee' THEN employees.name
            WHEN paid_to_type = 'vendor' THEN vendors.name
            ELSE expenses.category
          END as party_name, expenses.description, expense_date as txn_date, expenses.created_at
        FROM expenses
        LEFT JOIN employees ON paid_to_type = 'employee' AND paid_to_id = employees.id
        LEFT JOIN vendors ON paid_to_type = 'vendor' AND paid_to_id = vendors.id
        WHERE expenses.payment_mode = 'cash' AND expenses.expense_date = ?
      `, [date], (err, cashOutRows) => {
        if (err) return res.status(500).json({ error: err.message });

        const totalCashIn  = cashInRows.reduce((s, r) => s + Number(r.amount || 0), 0);
        const totalCashOut = cashOutRows.reduce((s, r) => s + Number(r.amount || 0), 0);

        res.json({
          date,
          opening_balance: openingBalance,
          cash_in: cashInRows,
          cash_out: cashOutRows,
          total_cash_in: totalCashIn,
          total_cash_out: totalCashOut,
          closing_balance: openingBalance + totalCashIn - totalCashOut
        });
      });
    });
  });
});

module.exports = router;