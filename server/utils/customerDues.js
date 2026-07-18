// Single source of truth for customer net-due calculations.
// Dashboard, Reports (daily.js), and Payments (/dues) must all use this module
// so the same business fact never drifts across screens again.

const NET_DUE_EXPR = `(
  COALESCE(oa.orders_total, 0) + COALESCE(c.opening_balance, 0)
  - COALESCE(oa.orders_advance, 0)
  - COALESCE(pay.total_order_payments, 0)
  - COALESCE(upi.total_upi, 0)
  - COALESCE(cheq.total_cheque_cleared, 0)
  - COALESCE(cash.total_cash_income, 0)
  - COALESCE(oa.orders_discount, 0)
  + COALESCE(comm.total_commission, 0)
)`;

const ORDERS_AGG_SUBQUERY = `
  SELECT customer_id,
    SUM(total_amount) as orders_total,
    SUM(discount_amount) as orders_discount,
    SUM(advance_paid) as orders_advance,
    SUM(CASE WHEN balance_due > 0 THEN balance_due ELSE 0 END) as orders_due,
    SUM(CASE WHEN balance_due > 0 THEN 1 ELSE 0 END) as orders_due_count,
    MIN(CASE WHEN balance_due > 0 THEN follow_up_date END) as follow_up_date
  FROM orders WHERE deleted_at IS NULL GROUP BY customer_id
`;

const ORDERS_AGG_SIMPLE_SUBQUERY = `
  SELECT customer_id,
    SUM(total_amount) as orders_total,
    SUM(discount_amount) as orders_discount,
    SUM(advance_paid) as orders_advance
  FROM orders WHERE deleted_at IS NULL GROUP BY customer_id
`;

const PAYMENT_JOINS = `
  LEFT JOIN (
    SELECT customer_id, SUM(amount) as total_order_payments FROM payments GROUP BY customer_id
  ) pay ON pay.customer_id = c.id
  LEFT JOIN (
    SELECT customer_id, SUM(amount) as total_upi FROM upi_transactions
    WHERE order_id IS NULL AND (notes NOT LIKE 'EXPENSE:%' OR notes IS NULL)
    GROUP BY customer_id
  ) upi ON upi.customer_id = c.id
  LEFT JOIN (
    SELECT customer_id, SUM(amount) as total_cheque_cleared FROM cheques WHERE status = 'cleared' GROUP BY customer_id
  ) cheq ON cheq.customer_id = c.id
  LEFT JOIN (
    SELECT customer_id, SUM(amount) as total_cash_income FROM cash_income
    WHERE (notes IS NULL OR notes NOT IN ('Order Advance Payment', 'Order Payment'))
      AND (notes IS NULL OR notes NOT LIKE 'Cheque Cleared%')
      AND (notes IS NULL OR notes NOT LIKE 'Galla Opening Balance%')
    GROUP BY customer_id
  ) cash ON cash.customer_id = c.id
  LEFT JOIN (
    SELECT customer_id, SUM(amount) as total_commission FROM expenses WHERE category = 'Commission' GROUP BY customer_id
  ) comm ON comm.customer_id = c.id
`;

function buildCustomerDuesListSQL({ includeContactName = false } = {}) {
  const contactCol = includeContactName ? 'c.contact_name,' : '';
  return `
    SELECT * FROM (
      SELECT
        c.id as customer_id,
        c.firm_name,
        ${contactCol}
        c.phone,
        COALESCE(oa.orders_due, 0) as orders_due,
        COALESCE(oa.orders_due_count, 0) as orders_due_count,
        COALESCE(c.opening_balance, 0) as opening_balance,
        oa.follow_up_date as follow_up_date,
        ${NET_DUE_EXPR} as total_due
      FROM customers c
      LEFT JOIN (${ORDERS_AGG_SUBQUERY}) oa ON oa.customer_id = c.id
      ${PAYMENT_JOINS}
      WHERE c.deleted_at IS NULL
    )
    WHERE total_due > 0
    ORDER BY follow_up_date ASC, total_due DESC
  `;
}

function buildTotalOutstandingSQL() {
  return `
    WITH customer_net_due AS (
      SELECT
        c.id as customer_id,
        ${NET_DUE_EXPR} as total_due
      FROM customers c
      LEFT JOIN (${ORDERS_AGG_SIMPLE_SUBQUERY}) oa ON oa.customer_id = c.id
      ${PAYMENT_JOINS}
      WHERE c.deleted_at IS NULL
    )
    SELECT COALESCE(SUM(total_due), 0) as total FROM customer_net_due WHERE total_due > 0
  `;
}

function getCustomerDuesList(db, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  db.all(buildCustomerDuesListSQL(options), [], callback);
}

function getTotalOutstanding(db, callback) {
  db.get(buildTotalOutstandingSQL(), [], callback);
}

function getCustomerDuesListAsync(db, options = {}) {
  return new Promise((resolve, reject) => {
    getCustomerDuesList(db, options, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

function getTotalOutstandingAsync(db) {
  return new Promise((resolve, reject) => {
    getTotalOutstanding(db, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

module.exports = {
  buildCustomerDuesListSQL,
  buildTotalOutstandingSQL,
  getCustomerDuesList,
  getTotalOutstanding,
  getCustomerDuesListAsync,
  getTotalOutstandingAsync,
};
