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
  const today = new Date().toISOString().split('T')[0];

  db.get(`SELECT * FROM daily_records WHERE record_date = ?`, [today], (err, record) => {
    if (err) return res.status(500).json({ error: err.message });

    // Order payments today
    db.all(`
      SELECT payments.*, orders.description, customers.firm_name
      FROM payments
      JOIN orders ON payments.order_id = orders.id
      JOIN customers ON payments.customer_id = customers.id
      WHERE payments.payment_date = ?
    `, [today], (err, orderPayments) => {
      if (err) return res.status(500).json({ error: err.message });

      // UPI received today — grouped by account
      db.all(`
        SELECT upi_account, SUM(amount) as total, COUNT(*) as count
        FROM upi_transactions
        WHERE transaction_date = ?
        GROUP BY upi_account
      `, [today], (err, upiToday) => {
        if (err) return res.status(500).json({ error: err.message });

        // UPI transactions detail today
        db.all(`
          SELECT upi_transactions.*, customers.firm_name as customer_firm
          FROM upi_transactions
          LEFT JOIN customers ON upi_transactions.customer_id = customers.id
          WHERE transaction_date = ?
          ORDER BY id DESC
        `, [today], (err, upiDetail) => {
          if (err) return res.status(500).json({ error: err.message });

          // Cheques received today
          db.all(`
            SELECT cheques.*, customers.firm_name as customer_firm
            FROM cheques
            LEFT JOIN customers ON cheques.customer_id = customers.id
            WHERE received_date = ?
          `, [today], (err, chequesToday) => {
            if (err) return res.status(500).json({ error: err.message });

            // Cash income today
            db.all(`
            SELECT cash_income.*, customers.firm_name
            FROM cash_income
            LEFT JOIN customers ON cash_income.customer_id = customers.id
            WHERE income_date = ?
            ORDER BY id DESC
            `, [today], (err, cashIncomeToday) => {
            if (err) return res.status(500).json({ error: err.message });

            const cashIncomeTotal = cashIncomeToday.reduce((s, c) => s + c.amount, 0)
            const orderPaymentsTotal = orderPayments.reduce((s, p) => s + p.amount, 0)
            const upiTotal = upiToday.reduce((s, u) => s + u.total, 0)
            const chequeTotal = chequesToday.reduce((s, c) => s + c.amount, 0)
            const manualSales = record ? record.total_sales : 0
            const totalCashIn = orderPaymentsTotal + cashIncomeTotal + upiTotal

            res.json({
                record_date: today,
                manual_sales: manualSales,
                total_expenses: record ? record.total_expenses : 0,
                order_payments: orderPayments,
                order_payments_total: orderPaymentsTotal,
                cash_income_today: cashIncomeToday,
                cash_income_total: cashIncomeTotal,
                upi_by_account: upiToday,
                upi_detail: upiDetail,
                upi_total: upiTotal,
                cheques_today: chequesToday,
                cheque_total: chequeTotal,
                total_cash_in: totalCashIn
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
  const { month, year } = req.query
  if (!month || !year) return res.status(400).json({ error: 'month and year required' })

  const m = month.padStart(2, '0')

  // 1. Order payments this month
  db.get(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM payments
    WHERE strftime('%m', payment_date) = ? AND strftime('%Y', payment_date) = ?
  `, [m, year], (err, orderPayments) => {
    if (err) return res.status(500).json({ error: err.message })

    // 2. Cash income this month
    db.get(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM cash_income
      WHERE strftime('%m', income_date) = ? AND strftime('%Y', income_date) = ?
    `, [m, year], (err, cashIncome) => {
      if (err) return res.status(500).json({ error: err.message })

      // 3. UPI income this month (not expenses)
      db.get(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM upi_transactions
        WHERE strftime('%m', transaction_date) = ?
        AND strftime('%Y', transaction_date) = ?
        AND (notes NOT LIKE 'EXPENSE:%' OR notes IS NULL)
      `, [m, year], (err, upiIncome) => {
        if (err) return res.status(500).json({ error: err.message })

        // 4. Total expenses by category
        db.all(`
          SELECT category, COALESCE(SUM(amount), 0) as total, COUNT(*) as count
          FROM expenses
          WHERE strftime('%m', expense_date) = ? AND strftime('%Y', expense_date) = ?
          GROUP BY category
          ORDER BY total DESC
        `, [m, year], (err, expensesByCategory) => {
          if (err) return res.status(500).json({ error: err.message })

          // 5. Total expenses
          db.get(`
            SELECT COALESCE(SUM(amount), 0) as total
            FROM expenses
            WHERE strftime('%m', expense_date) = ? AND strftime('%Y', expense_date) = ?
          `, [m, year], (err, totalExpenses) => {
            if (err) return res.status(500).json({ error: err.message })

            // 6. All dues
            db.all(`
              SELECT orders.id, orders.description, orders.total_amount,
                orders.balance_due, orders.follow_up_date, orders.status,
                customers.firm_name, customers.phone
              FROM orders
              JOIN customers ON orders.customer_id = customers.id
              WHERE orders.balance_due > 0
              AND orders.deleted_at IS NULL
              ORDER BY orders.follow_up_date ASC, orders.balance_due DESC
            `, [], (err, dues) => {
              if (err) return res.status(500).json({ error: err.message })

              // 7. Total outstanding
              db.get(`
                SELECT COALESCE(SUM(balance_due), 0) as total
                FROM orders WHERE balance_due > 0 AND deleted_at IS NULL
              `, [], (err, totalDues) => {
                if (err) return res.status(500).json({ error: err.message })

                const totalIncome = (orderPayments.total || 0) +
                  (cashIncome.total || 0) +
                  (upiIncome.total || 0)
                const totalExp = totalExpenses.total || 0

                res.json({
                  month: m, year,
                  income: {
                    order_payments: orderPayments.total || 0,
                    cash_income: cashIncome.total || 0,
                    upi_income: upiIncome.total || 0,
                    total: totalIncome
                  },
                  expenses: {
                    by_category: expensesByCategory,
                    total: totalExp
                  },
                  net_profit: totalIncome - totalExp,
                  dues: {
                    list: dues,
                    total_outstanding: totalDues.total || 0
                  }
                })
              })
            })
          })
        })
      })
    })
  })
})
// GET /api/daily/report/yearly?year=2026
router.get('/report/yearly', (req, res) => {
  const { year } = req.query
  if (!year) return res.status(400).json({ error: 'year required' })

  // Monthly breakdown for the year
  db.all(`
    SELECT
      strftime('%m', payment_date) as month,
      COALESCE(SUM(amount), 0) as order_payments
    FROM payments
    WHERE strftime('%Y', payment_date) = ?
    GROUP BY month
  `, [year], (err, monthlyPayments) => {
    if (err) return res.status(500).json({ error: err.message })

    db.all(`
      SELECT
        strftime('%m', expense_date) as month,
        COALESCE(SUM(amount), 0) as total_expenses
      FROM expenses
      WHERE strftime('%Y', expense_date) = ?
      GROUP BY month
    `, [year], (err, monthlyExpenses) => {
      if (err) return res.status(500).json({ error: err.message })

      // Build 12-month summary
      const months = ['01','02','03','04','05','06','07','08','09','10','11','12']
      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

      const summary = months.map((m, i) => {
        const inc = monthlyPayments.find(r => r.month === m)
        const exp = monthlyExpenses.find(r => r.month === m)
        const income = inc ? inc.order_payments : 0
        const expenses = exp ? exp.total_expenses : 0
        return {
          month: m,
          month_name: monthNames[i],
          income,
          expenses,
          net: income - expenses
        }
      })

      const totalIncome = summary.reduce((s, r) => s + r.income, 0)
      const totalExpenses = summary.reduce((s, r) => s + r.expenses, 0)

      res.json({
        year,
        monthly_summary: summary,
        total_income: totalIncome,
        total_expenses: totalExpenses,
        net_profit: totalIncome - totalExpenses
      })
    })
  })
})
// POST /api/daily/cash-income
router.post('/cash-income', (req, res) => {
  const {
    customer_id,
    amount,
    income_date,
    notes,
    payment_mode,
    upi_account
  } = req.body;

  if (!customer_id)
    return res.status(400).json({ error: 'customer_id is required' });

  if (!amount || isNaN(amount) || Math.round(Number(amount)) <= 0)
    return res.status(400).json({ error: 'Valid amount is required' });

  const date = income_date || new Date().toISOString().split('T')[0];

  db.run(`
    INSERT INTO cash_income
    (customer_id, amount, income_date, notes, payment_mode, upi_account)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    customer_id,
    Math.round(Number(amount)),
    date,
    notes || null,
    payment_mode || 'cash',
    payment_mode === 'upi' ? upi_account : null
  ], function(err) {
    if (err) return res.status(500).json({ error: err.message });

    // if (payment_mode === 'upi' && upi_account) {
    //   db.run(`
    //     INSERT INTO upi_transactions
    //     (upi_account, customer_id, customer_name, amount, transaction_date, notes)
    //     VALUES (?, ?, ?, ?, ?, ?)
    //   `, [
    //     upi_account,
    //     customer_id,
    //     null,
    //     Number(amount),
    //     date,
    //     notes || 'Cash income via UPI'
    //   ]);
    // }

    res.status(201).json({ id: this.lastID, message: 'Income saved' });
  });
});

// GET /api/daily/summary
router.get('/summary', (req, res) => {
  const { month, year } = req.query;

  db.get(`
    SELECT
      COUNT(*) as days_recorded,
      SUM(total_expenses) as total_expenses
    FROM daily_records
    WHERE strftime('%m', record_date) = ?
    AND strftime('%Y', record_date) = ?
  `, [month, year], (err, daily) => {
    if (err) return res.status(500).json({ error: err.message });

    db.get(`
      SELECT SUM(amount) as payments_total
      FROM payments
      WHERE strftime('%m', payment_date) = ?
      AND strftime('%Y', payment_date) = ?
    `, [month, year], (err, payments) => {
      if (err) return res.status(500).json({ error: err.message });

      db.get(`
        SELECT SUM(amount) as cash_income_total
        FROM cash_income
        WHERE strftime('%m', income_date) = ?
        AND strftime('%Y', income_date) = ?
      `, [month, year], (err, cashIncome) => {
        if (err) return res.status(500).json({ error: err.message });

        const paymentsTotal = payments.payments_total || 0;
        const cashIncomeTotal = cashIncome.cash_income_total || 0;
        const totalSales = paymentsTotal + cashIncomeTotal;
        const totalExpenses = daily.total_expenses || 0;

        res.json({
          days_recorded: daily.days_recorded || 0,
          cash_income_total: cashIncomeTotal,
          payments_total: paymentsTotal,
          total_sales: totalSales,
          total_expenses: totalExpenses,
          net_profit: totalSales - totalExpenses
        });
      });
    });
  });
});

// GET /api/daily/ledger?month=06&year=2026

// GET /api/daily/ledger/date?date=2026-06-15
router.get('/ledger/date', (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date required' });

  // Income: Order payments
  db.all(`
    SELECT payments.amount, payments.payment_mode,
      customers.firm_name as party_name,
      'Order Payment' as type
    FROM payments
    JOIN orders ON payments.order_id = orders.id
    JOIN customers ON payments.customer_id = customers.id
    WHERE payments.payment_date = ?
  `, [date], (err, orderPayments) => {
    if (err) return res.status(500).json({ error: err.message });

    // Income: Cash income
    db.all(`
      SELECT cash_income.amount, cash_income.payment_mode,
        cash_income.upi_account,
        customers.firm_name as party_name,
        'Cash Income' as type
      FROM cash_income
      LEFT JOIN customers ON cash_income.customer_id = customers.id
      WHERE cash_income.income_date = ?
    `, [date], (err, cashIncome) => {
      if (err) return res.status(500).json({ error: err.message });

      // Income: UPI transactions (not from expenses)
      db.all(`
        SELECT amount, upi_account as payment_mode,
          COALESCE(customer_name, customers.firm_name, 'Unknown') as party_name,
          'UPI Payment' as type
        FROM upi_transactions
        LEFT JOIN customers ON upi_transactions.customer_id = customers.id
        WHERE transaction_date = ?
        AND notes NOT LIKE 'EXPENSE:%'
      `, [date], (err, upiPayments) => {
        if (err) return res.status(500).json({ error: err.message });

        // Expenses
        db.all(`
          SELECT expenses.amount, expenses.payment_mode,
            expenses.category, expenses.upi_account,
            CASE
              WHEN paid_to_type = 'employee' THEN employees.name
              WHEN paid_to_type = 'vendor' THEN vendors.name
              ELSE expenses.category
            END as party_name,
            expenses.description
          FROM expenses
          LEFT JOIN employees ON paid_to_type = 'employee' AND paid_to_id = employees.id
          LEFT JOIN vendors ON paid_to_type = 'vendor' AND paid_to_id = vendors.id
          WHERE expense_date = ?
        `, [date], (err, expenses) => {
          if (err) return res.status(500).json({ error: err.message });

          const income = [...orderPayments, ...cashIncome, ...upiPayments]
          const totalIncome = income.reduce((s, i) => s + i.amount, 0)
          const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)

          res.json({
            date,
            income,
            expenses,
            total_income: totalIncome,
            total_expenses: totalExpenses,
            net: totalIncome - totalExpenses
          });
        });
      });
    });
  });
});

// Combined view of all income and expenses
router.get('/ledger', (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return res.status(400).json({ error: 'month and year required' });

  // Order payments received
  const orderPaymentsQuery = `
    SELECT
      payments.payment_date as date,
      'Order Payment' as type,
      customers.firm_name as party_name,
      payments.payment_mode,
      payments.amount
    FROM payments
    JOIN orders ON payments.order_id = orders.id
    JOIN customers ON payments.customer_id = customers.id
    WHERE strftime('%m', payments.payment_date) = ?
    AND strftime('%Y', payments.payment_date) = ?
  `;

  // Cash income (manual payments not linked to orders)
  const cashIncomeQuery = `
    SELECT
      cash_income.income_date as date,
      'Cash Income' as type,
      customers.firm_name as party_name,
      cash_income.payment_mode,
      cash_income.amount
    FROM cash_income
    LEFT JOIN customers ON cash_income.customer_id = customers.id
    WHERE strftime('%m', cash_income.income_date) = ?
    AND strftime('%Y', cash_income.income_date) = ?
  `;

  // Expenses
  const expensesQuery = `
    SELECT
      expense_date as date,
      'Expense' as type,
      CASE
        WHEN paid_to_type = 'employee' THEN employees.name
        WHEN paid_to_type = 'vendor' THEN vendors.name
        ELSE category
      END as party_name,
      payment_mode,
      -amount as amount
    FROM expenses
    LEFT JOIN employees ON paid_to_type = 'employee' AND paid_to_id = employees.id
    LEFT JOIN vendors ON paid_to_type = 'vendor' AND paid_to_id = vendors.id
    WHERE strftime('%m', expense_date) = ?
    AND strftime('%Y', expense_date) = ?
  `;

  const params = [month.padStart(2,'0'), year];

  db.all(orderPaymentsQuery, params, (err, orderPayments) => {
    if (err) return res.status(500).json({ error: err.message });

    db.all(cashIncomeQuery, params, (err, cashIncome) => {
      if (err) return res.status(500).json({ error: err.message });

      db.all(expensesQuery, params, (err, expenses) => {
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

  // Step 1: Opening balance = sum of all cash transactions BEFORE this date
  const openingQuery = `
    SELECT
      COALESCE(SUM(cash_in), 0) - COALESCE(SUM(cash_out), 0) as opening_balance
    FROM (
      -- Cash order payments before this date
      SELECT amount as cash_in, 0 as cash_out
      FROM payments
      WHERE payment_mode = 'cash' AND payment_date < ?

      UNION ALL

      -- Cash income before this date
      SELECT amount as cash_in, 0 as cash_out
      FROM cash_income
      WHERE (payment_mode = 'cash' OR payment_mode IS NULL)
      AND income_date < ?

      UNION ALL

      -- Cash expenses before this date
      SELECT 0 as cash_in, amount as cash_out
      FROM expenses
      WHERE payment_mode = 'cash'
      AND expense_date < ?
    )
  `;

  db.get(openingQuery, [date, date, date], (err, openingRow) => {
    if (err) return res.status(500).json({ error: err.message });

    const openingBalance = openingRow?.opening_balance || 0;

    // Step 2: Cash IN for this date
    const cashInQuery = `
      SELECT amount, 'Order Payment' as type, 
             customers.firm_name as party_name,
             payment_date as txn_date
      FROM payments
      JOIN orders ON payments.order_id = orders.id
      JOIN customers ON payments.customer_id = customers.id
      WHERE payments.payment_mode = 'cash'
      AND payments.payment_date = ?

      UNION ALL

      SELECT cash_income.amount, 'Cash Income' as type,
             customers.firm_name as party_name,
             income_date as txn_date
      FROM cash_income
      LEFT JOIN customers ON cash_income.customer_id = customers.id
      WHERE (cash_income.payment_mode = 'cash' OR cash_income.payment_mode IS NULL)
      AND cash_income.income_date = ?
    `;

    db.all(cashInQuery, [date, date], (err, cashInRows) => {
      if (err) return res.status(500).json({ error: err.message });

      // Step 3: Cash OUT for this date
      const cashOutQuery = `
        SELECT expenses.amount, expenses.category,
               CASE
                 WHEN paid_to_type = 'employee' THEN employees.name
                 WHEN paid_to_type = 'vendor' THEN vendors.name
                 ELSE expenses.category
               END as party_name,
               expenses.description,
               expense_date as txn_date
        FROM expenses
        LEFT JOIN employees ON paid_to_type = 'employee' AND paid_to_id = employees.id
        LEFT JOIN vendors ON paid_to_type = 'vendor' AND paid_to_id = vendors.id
        WHERE expenses.payment_mode = 'cash'
        AND expenses.expense_date = ?
      `;

      db.all(cashOutQuery, [date], (err, cashOutRows) => {
        if (err) return res.status(500).json({ error: err.message });

        const totalCashIn = cashInRows.reduce((s, r) => s + Number(r.amount || 0), 0);
        const totalCashOut = cashOutRows.reduce((s, r) => s + Number(r.amount || 0), 0);
        const closingBalance = openingBalance + totalCashIn - totalCashOut;

        res.json({
          date,
          opening_balance: openingBalance,
          cash_in: cashInRows,
          cash_out: cashOutRows,
          total_cash_in: totalCashIn,
          total_cash_out: totalCashOut,
          closing_balance: closingBalance
        });
      });
    });
  });
});


module.exports = router;