const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database file will be created at server/db/flexshop.db
const DB_PATH = path.join(__dirname, 'flexshop.db');

// Connect to SQLite database (creates file if it doesn't exist)
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
  }
});

// Enable foreign keys (SQLite has them off by default)
db.run('PRAGMA foreign_keys = ON');

// Create all tables if they don't exist
db.serialize(() => {

  // 1. CUSTOMERS
  db.run(`CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firm_name TEXT NOT NULL,
    contact_name TEXT,
    phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 2. ORDERS
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending',
    total_amount REAL DEFAULT 0,
    advance_paid REAL DEFAULT 0,
    balance_due REAL DEFAULT 0,
    follow_up_date TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  )`);

  // 3. ORDER ITEMS (line items like flex, pipe, labour)
  db.run(`CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    item_name TEXT NOT NULL,
    quantity REAL DEFAULT 1,
    unit_price REAL DEFAULT 0,
    subtotal REAL DEFAULT 0,
    FOREIGN KEY (order_id) REFERENCES orders(id)
  )`);

  // 4. PAYMENTS
  db.run(`CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    customer_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    payment_date TEXT DEFAULT CURRENT_DATE,
    note TEXT,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  )`);

  // 5. EMPLOYEES
  db.run(`CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    monthly_salary REAL DEFAULT 0,
    join_date TEXT,
    is_active INTEGER DEFAULT 1
  )`);

  // 6. ATTENDANCE
  db.run(`CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    status TEXT DEFAULT 'present',
    FOREIGN KEY (employee_id) REFERENCES employees(id)
  )`);

  // 7. DAILY RECORDS (sales + expenses per day)
  db.run(`CREATE TABLE IF NOT EXISTS daily_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_date TEXT UNIQUE,
    total_sales REAL DEFAULT 0,
    total_expenses REAL DEFAULT 0,
    notes TEXT
  )`);

  // 8. EXPENSE CATEGORIES
  db.run(`CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    expense_date TEXT DEFAULT CURRENT_DATE,
    description TEXT,
    daily_record_id INTEGER,
    FOREIGN KEY (daily_record_id) REFERENCES daily_records(id)
  )`);

  // 9. FLEX INVENTORY
  db.run(`CREATE TABLE IF NOT EXISTS flex_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gsm_type TEXT NOT NULL,
    roll_width_ft REAL,
    total_meters REAL DEFAULT 0,
    remaining_meters REAL DEFAULT 0,
    supplier_name TEXT,
    purchase_date TEXT DEFAULT CURRENT_DATE,
    cost_paid REAL DEFAULT 0,
    notes TEXT
  )`);

  // 10. SUPPLIERS
  db.run(`CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    city TEXT,
    notes TEXT
  )`);

  // 11. PRICE MASTER (your standard rates)
  db.run(`CREATE TABLE IF NOT EXISTS price_master (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_name TEXT NOT NULL,
    unit TEXT,
    default_price REAL DEFAULT 0,
    description TEXT
  )`);

  console.log('All tables created successfully.');
});

module.exports = db;