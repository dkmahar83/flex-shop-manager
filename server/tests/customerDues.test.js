const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  getCustomerDuesListAsync,
  getTotalOutstandingAsync,
} = require('../utils/customerDues');
const { createTestDb, closeDb, run } = require('./helpers/testDb');

describe('customerDues', () => {
  let db;

  before(async () => {
    ({ db } = await createTestDb());

    await run(db, `INSERT INTO customers (firm_name, opening_balance) VALUES (?, ?)`, [
      'Gupta Enterprises',
      2000,
    ]);
    await run(db, `INSERT INTO orders (customer_id, total_amount, balance_due) VALUES (1, 3000, 3000)`);
    await run(db, `INSERT INTO cash_income (customer_id, amount, notes) VALUES (1, 250, 'Partial opening balance payment')`);
  });

  after(async () => {
    await closeDb(db);
  });

  it('computes net due with partial payment against opening balance', async () => {
    const list = await getCustomerDuesListAsync(db);
    assert.equal(list.length, 1);
    assert.equal(list[0].firm_name, 'Gupta Enterprises');
    assert.equal(list[0].orders_due, 3000);
    assert.equal(list[0].opening_balance, 2000);
    assert.equal(list[0].total_due, 4750);
  });

  it('returns the same total from getTotalOutstanding as the dues list sum', async () => {
    const [list, totalRow] = await Promise.all([
      getCustomerDuesListAsync(db),
      getTotalOutstandingAsync(db),
    ]);

    const listSum = list.reduce((sum, row) => sum + row.total_due, 0);
    assert.equal(totalRow.total, listSum);
    assert.equal(totalRow.total, 4750);
  });

  it('excludes customers whose net balance is zero or negative', async () => {
    await run(db, `INSERT INTO customers (firm_name, opening_balance) VALUES (?, ?)`, [
      'Fully Paid Co',
      0,
    ]);
    await run(db, `INSERT INTO orders (customer_id, total_amount, advance_paid, balance_due) VALUES (2, 1000, 1000, 0)`);

    const list = await getCustomerDuesListAsync(db);
    assert.equal(list.length, 1);
    assert.equal(list[0].firm_name, 'Gupta Enterprises');
  });

  it('includes commission expenses in net due', async () => {
    await run(db, `INSERT INTO customers (firm_name, opening_balance) VALUES (?, ?)`, [
      'Commission Customer',
      0,
    ]);
    await run(db, `INSERT INTO expenses (category, amount, customer_id) VALUES ('Commission', 500, 3)`);

    const list = await getCustomerDuesListAsync(db);
    const commissionRow = list.find((row) => row.firm_name === 'Commission Customer');
    assert.ok(commissionRow);
    assert.equal(commissionRow.total_due, 500);

    const totalRow = await getTotalOutstandingAsync(db);
    assert.equal(totalRow.total, 4750 + 500);
  });
});
