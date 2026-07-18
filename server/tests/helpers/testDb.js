const sqlite3 = require('sqlite3').verbose();

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

async function createTestDb() {
  const db = await new Promise((resolve, reject) => {
    const instance = new sqlite3.Database(':memory:', (err) => (err ? reject(err) : resolve(instance)));
  });

  await run(db, 'PRAGMA foreign_keys = ON');

  await run(db, `CREATE TABLE customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firm_name TEXT NOT NULL,
    contact_name TEXT,
    phone TEXT,
    opening_balance REAL DEFAULT 0,
    deleted_at DATETIME DEFAULT NULL
  )`);

  await run(db, `CREATE TABLE orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    total_amount REAL DEFAULT 0,
    advance_paid REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    balance_due REAL DEFAULT 0,
    follow_up_date TEXT,
    deleted_at DATETIME DEFAULT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  )`);

  await run(db, `CREATE TABLE payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    customer_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  )`);

  await run(db, `CREATE TABLE upi_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    upi_account TEXT NOT NULL,
    customer_id INTEGER,
    amount REAL NOT NULL,
    order_id INTEGER,
    notes TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  )`);

  await run(db, `CREATE TABLE cheques (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    amount REAL NOT NULL,
    status TEXT DEFAULT 'received',
    order_id INTEGER,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  )`);

  await run(db, `CREATE TABLE cash_income (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    notes TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  )`);

  await run(db, `CREATE TABLE expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    customer_id INTEGER,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  )`);

  return { db, run, get, all };
}

function closeDb(db) {
  return new Promise((resolve, reject) => {
    db.close((err) => (err ? reject(err) : resolve()));
  });
}

module.exports = { createTestDb, closeDb, run, get, all };
