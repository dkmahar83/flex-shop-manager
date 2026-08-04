const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const logger = require('../utils/logger');

const DB_PATH = path.join(__dirname, 'flexshop.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    logger.error('Error connecting to database: ' + err.message);
  } else {
    logger.info('Connected to SQLite database.');
  }
});

db.DB_PATH = DB_PATH;

db.serialize(() => {

  db.run('PRAGMA foreign_keys = ON');
  db.run('PRAGMA journal_mode = WAL;');
  db.run('PRAGMA busy_timeout = 5000;');

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

  db.run(`CREATE TABLE IF NOT EXISTS cash_drawer_baseline (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    denomination_counts TEXT NOT NULL,
    set_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Notification "read" tracker — notifications aren't stored anywhere
  // themselves (generated live per-request: follow-ups, low-stock,
  // attendance-reminder), so "read" state is tracked against a deterministic
  // key (e.g. "followup-42-2026-08-03"). The date is baked into the key, so
  // it automatically becomes unread again the next day unless the underlying
  // thing (e.g. balance due) has actually been resolved.
  db.run(`CREATE TABLE IF NOT EXISTS notification_reads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    notification_key TEXT NOT NULL UNIQUE,
    notif_date TEXT NOT NULL,
    read_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_notification_reads_date ON notification_reads(notif_date)`);
  db.run(`CREATE TABLE IF NOT EXISTS order_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    photo_path TEXT NOT NULL,
    caption TEXT DEFAULT NULL,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS upi_qr_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    upi_account TEXT NOT NULL,
    upi_id TEXT NOT NULL,
    payee_name TEXT,
    amount REAL NOT NULL,
    remarks TEXT,
    paid INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS order_activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    activity TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id)
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firm_name TEXT NOT NULL,
    contact_name TEXT,
    phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

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

db.run(`CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  item_name TEXT NOT NULL,
  quantity REAL DEFAULT 1,
  unit_price REAL DEFAULT 0,
  subtotal REAL DEFAULT 0,
  length REAL DEFAULT NULL,
  breadth REAL DEFAULT NULL,
  item_date TEXT DEFAULT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id)
)`);

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

  db.run(`CREATE TABLE IF NOT EXISTS customer_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    payment_mode TEXT DEFAULT 'cash',
    payment_date TEXT DEFAULT CURRENT_DATE,
    source TEXT,
    source_id INTEGER,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    monthly_salary REAL DEFAULT 0,
    join_date TEXT,
    is_active INTEGER DEFAULT 1
  )`);
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

  db.run(`CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    status TEXT DEFAULT 'present',
    FOREIGN KEY (employee_id) REFERENCES employees(id)
  )`);

  db.run(`
    DELETE FROM attendance
    WHERE id NOT IN (
      SELECT MAX(id) FROM attendance GROUP BY employee_id, date
    )
  `);

  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_employee_date ON attendance(employee_id, date)`);

  db.run(`CREATE TABLE IF NOT EXISTS daily_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_date TEXT UNIQUE,
    total_sales REAL DEFAULT 0,
    total_expenses REAL DEFAULT 0,
    notes TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    expense_date TEXT DEFAULT CURRENT_DATE,
    description TEXT,
    daily_record_id INTEGER,
    FOREIGN KEY (daily_record_id) REFERENCES daily_records(id)
  )`);

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

  db.run(`CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    city TEXT,
    notes TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS price_master (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_name TEXT NOT NULL,
    unit TEXT,
    default_price REAL DEFAULT 0,
    description TEXT
  )`);

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

  db.run(`CREATE TABLE IF NOT EXISTS vendor_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    transaction_date TEXT DEFAULT CURRENT_DATE,
    description TEXT,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id)
  )`);

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

  db.run(`CREATE TABLE IF NOT EXISTS inventory_flex (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand TEXT NOT NULL,
    size_ft REAL NOT NULL,
    quantity REAL DEFAULT 0,
    unit TEXT DEFAULT 'roll',
    notes TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS inventory_stamps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stamp_type TEXT NOT NULL,
    size TEXT,
    design_type TEXT,
    quantity INTEGER DEFAULT 0,
    notes TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

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

  db.run(`CREATE TABLE IF NOT EXISTS inventory_frames (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    frame_type TEXT NOT NULL,
    size TEXT,
    design TEXT,
    quantity INTEGER DEFAULT 0,
    notes TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

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

  db.run(`CREATE TABLE IF NOT EXISTS inventory_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,
    icon TEXT DEFAULT '📦',
    attr1_label TEXT DEFAULT 'Size',
    attr2_label TEXT DEFAULT 'Type',
    unit_default TEXT DEFAULT 'pcs',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS inventory_dynamic_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES inventory_categories(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    attr1 TEXT,
    attr2 TEXT,
    quantity REAL DEFAULT 0,
    unit TEXT DEFAULT 'pcs',
    minimum_stock REAL DEFAULT 0,
    notes TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // --- Tables used by routes (commission.js, pagelocks.js) but missing from this schema file ---
  db.run(`CREATE TABLE IF NOT EXISTS commission_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    return_mode TEXT DEFAULT NULL,
    return_upi_account TEXT DEFAULT NULL,
    cheque_number TEXT DEFAULT NULL,
    bank_name TEXT DEFAULT NULL,
    note TEXT,
    transaction_date TEXT DEFAULT CURRENT_DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS page_locks (
    page_key TEXT PRIMARY KEY,
    pin_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    is_locked INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`ALTER TABLE expenses ADD COLUMN paid_to_type TEXT DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE expenses ADD COLUMN paid_to_id INTEGER DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE expenses ADD COLUMN payment_mode TEXT DEFAULT 'cash'`, () => {})
  db.run(`ALTER TABLE expenses ADD COLUMN upi_account TEXT DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE expenses ADD COLUMN utr_number TEXT DEFAULT NULL`, () => {})

  db.run(`ALTER TABLE order_items ADD COLUMN length REAL DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE order_items ADD COLUMN breadth REAL DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE order_items ADD COLUMN item_date TEXT DEFAULT NULL`, () => {})

  db.run(`ALTER TABLE customers ADD COLUMN deleted_at DATETIME DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE customers ADD COLUMN photo_path TEXT DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE employees ADD COLUMN photo_path TEXT DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE customers ADD COLUMN opening_balance REAL DEFAULT 0`, () => {})
  db.run(`ALTER TABLE customers ADD COLUMN opening_balance_date TEXT DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE customers ADD COLUMN opening_balance_notes TEXT DEFAULT NULL`, () => {})
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
  db.run(`ALTER TABLE orders ADD COLUMN advance_payment_mode TEXT DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE orders ADD COLUMN advance_entry_table TEXT DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE orders ADD COLUMN advance_entry_id INTEGER DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE cash_income ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP`, () => {})
  db.run(`ALTER TABLE upi_transactions ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP`, () => {})
  db.run(`ALTER TABLE payments ADD COLUMN payment_mode TEXT DEFAULT 'cash'`, () => {})
  db.run(`ALTER TABLE payments ADD COLUMN upi_account TEXT DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE payments ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP`, () => {})
  db.run(`ALTER TABLE cash_income ADD COLUMN denomination_breakdown TEXT DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE orders ADD COLUMN advance_denomination_breakdown TEXT DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE payments ADD COLUMN denomination_breakdown TEXT DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE expenses ADD COLUMN denomination_breakdown TEXT DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE employee_salary_credits ADD COLUMN denomination_breakdown TEXT DEFAULT NULL`, () => {})

  db.run(`ALTER TABLE expenses ADD COLUMN customer_id INTEGER DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE expenses ADD COLUMN customer_name TEXT DEFAULT NULL`, () => {})

  db.run(`ALTER TABLE orders ADD COLUMN order_number TEXT DEFAULT NULL`, () => {})

  db.run(`ALTER TABLE vendor_transactions ADD COLUMN items_json TEXT DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE vendor_transactions ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP`, () => {})
  db.run(`ALTER TABLE vendor_transactions ADD COLUMN payment_method TEXT DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE vendor_transactions ADD COLUMN upi_account TEXT DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE vendor_transactions ADD COLUMN bank_transfer_type TEXT DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE vendor_transactions ADD COLUMN denomination_breakdown TEXT DEFAULT NULL`, () => {})

  // --- Fixes: columns that exist on production but were never added here (schema was out of sync) ---
  db.run(`ALTER TABLE inventory_chemicals ADD COLUMN items_per_box INTEGER DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE orders ADD COLUMN discount_amount REAL DEFAULT 0`, () => {})
  db.run(`ALTER TABLE orders ADD COLUMN discount_note TEXT DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE expenses ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP`, () => {})

});

module.exports = db;