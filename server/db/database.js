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

// Add new columns to expenses if they don't exist
db.run(`ALTER TABLE expenses ADD COLUMN paid_to_type TEXT DEFAULT NULL`, () => {})
db.run(`ALTER TABLE expenses ADD COLUMN paid_to_id INTEGER DEFAULT NULL`, () => {})
db.run(`ALTER TABLE expenses ADD COLUMN payment_mode TEXT DEFAULT 'cash'`, () => {})
db.run(`ALTER TABLE expenses ADD COLUMN upi_account TEXT DEFAULT NULL`, () => {})
db.run(`ALTER TABLE expenses ADD COLUMN utr_number TEXT DEFAULT NULL`, () => {})

// Create employee_salary_credits table
db.run(`CREATE TABLE IF NOT EXISTS employee_salary_credits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  month TEXT NOT NULL,
  year TEXT NOT NULL,
  salary_amount REAL NOT NULL,
  credited_date TEXT DEFAULT CURRENT_DATE,
  notes TEXT,
  payment_mode TEXT DEFAULT 'cash',
  upi_account TEXT,
  FOREIGN KEY (employee_id) REFERENCES employees(id)
)`)

// Add soft delete columns if they don't exist yet
db.run(`ALTER TABLE customers ADD COLUMN deleted_at DATETIME DEFAULT NULL`, () => {})
db.run(`ALTER TABLE orders ADD COLUMN deleted_at DATETIME DEFAULT NULL`, () => {})
db.run(`ALTER TABLE expenses ADD COLUMN paid_to_type TEXT DEFAULT NULL`, () => {})
db.run(`ALTER TABLE expenses ADD COLUMN paid_to_id INTEGER DEFAULT NULL`, () => {})
db.run(`ALTER TABLE expenses ADD COLUMN payment_mode TEXT DEFAULT 'cash'`, () => {})
db.run(`ALTER TABLE expenses ADD COLUMN upi_account TEXT DEFAULT NULL`, () => {})
db.run(`ALTER TABLE expenses ADD COLUMN utr_number TEXT DEFAULT NULL`, () => {})
db.run(`ALTER TABLE employee_salary_credits ADD COLUMN payment_mode TEXT DEFAULT 'cash'`, () => {})
db.run(`ALTER TABLE employee_salary_credits ADD COLUMN upi_account TEXT DEFAULT NULL`, () => {})
db.run(`ALTER TABLE cash_income ADD COLUMN payment_mode TEXT DEFAULT 'cash'`, () => {})
db.run(`ALTER TABLE cash_income ADD COLUMN upi_account TEXT DEFAULT NULL`, () => {})

// Create all tables if they don't exist
db.serialize(() => {

  db.run(`
    INSERT INTO customers (firm_name, contact_name, phone)
    SELECT 'Ghar Khata', 'Owner', 'internal'
    WHERE NOT EXISTS (
      SELECT 1 FROM customers WHERE firm_name = 'Ghar Khata'
    )
  `);

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
// Employee salary credits (for recording monthly salary payments)
db.run(`
CREATE TABLE IF NOT EXISTS employee_salary_credits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  month TEXT NOT NULL,
  year TEXT NOT NULL,
  salary_amount REAL NOT NULL,
  credited_date TEXT DEFAULT CURRENT_DATE,
  notes TEXT,
  FOREIGN KEY (employee_id) REFERENCES employees(id)
)
`)

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

  // 12. CHEQUES REGISTER
db.run(`CREATE TABLE IF NOT EXISTS cheques (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cheque_number TEXT,
  firm_name TEXT NOT NULL,
  customer_id INTEGER,
  bank_name TEXT,
  amount REAL NOT NULL,
  received_date TEXT DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'received',
  order_id INTEGER,
  notes TEXT,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (order_id) REFERENCES orders(id)
)`);

// 13. UPI TRANSACTIONS
db.run(`CREATE TABLE IF NOT EXISTS upi_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  upi_account TEXT NOT NULL,
  customer_name TEXT,
  customer_id INTEGER,
  amount REAL NOT NULL,
  transaction_date TEXT DEFAULT CURRENT_DATE,
  utr_number TEXT,
  order_id INTEGER,
  notes TEXT,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (order_id) REFERENCES orders(id)
)`);

// 14. VENDORS
db.run(`CREATE TABLE IF NOT EXISTS vendors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  shop_type TEXT,
  city TEXT,
  total_purchased REAL DEFAULT 0,
  total_paid REAL DEFAULT 0,
  balance_due REAL DEFAULT 0,
  notes TEXT
)`);

// 15. VENDOR TRANSACTIONS
db.run(`CREATE TABLE IF NOT EXISTS vendor_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  transaction_date TEXT DEFAULT CURRENT_DATE,
  description TEXT,
  FOREIGN KEY (vendor_id) REFERENCES vendors(id)
)`);

// NEW: cash_income table — links manual cash entries to a customer
  db.run(`CREATE TABLE IF NOT EXISTS cash_income (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    income_date TEXT DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS employee_salary_credits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  month TEXT NOT NULL,
  year TEXT NOT NULL,
  salary_amount REAL NOT NULL,
  credited_date TEXT DEFAULT CURRENT_DATE,
  notes TEXT,
  payment_mode TEXT DEFAULT 'cash',
  upi_account TEXT DEFAULT NULL,
  FOREIGN KEY (employee_id) REFERENCES employees(id)
)`)

// INVENTORY TABLES

// Flex Roll Stock
db.run(`CREATE TABLE IF NOT EXISTS inventory_flex (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand TEXT NOT NULL,
  size_ft REAL NOT NULL,
  quantity REAL DEFAULT 0,
  unit TEXT DEFAULT 'roll',
  notes TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// Stamp Inventory
db.run(`CREATE TABLE IF NOT EXISTS inventory_stamps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stamp_type TEXT NOT NULL,
  size TEXT,
  design_type TEXT,
  quantity INTEGER DEFAULT 0,
  notes TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// Chemical / Bond Inventory
db.run(`CREATE TABLE IF NOT EXISTS inventory_chemicals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chemical_name TEXT NOT NULL,
  quantity REAL DEFAULT 0,
  unit TEXT DEFAULT 'litre',
  minimum_stock REAL DEFAULT 0,
  notes TEXT,
  items_per_box INTEGER DEFAULT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// Photo Frame Inventory
db.run(`CREATE TABLE IF NOT EXISTS inventory_frames (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  frame_type TEXT NOT NULL,
  size TEXT,
  design TEXT,
  quantity INTEGER DEFAULT 0,
  notes TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// Ink & Solvent Inventory
db.run(`CREATE TABLE IF NOT EXISTS inventory_ink (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_name TEXT NOT NULL,
  item_type TEXT DEFAULT 'ink',
  quantity REAL DEFAULT 0,
  unit TEXT DEFAULT 'litre',
  minimum_level REAL DEFAULT 0,
  notes TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// Inventory transaction log (har add/use ka record)
db.run(`CREATE TABLE IF NOT EXISTS inventory_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  item_id INTEGER NOT NULL,
  item_name TEXT,
  action TEXT NOT NULL,
  quantity_changed REAL NOT NULL,
  quantity_before REAL,
  quantity_after REAL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

  console.log('All tables created successfully.');
});

module.exports = db;