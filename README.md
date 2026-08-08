# 🖨️ VijayFlex Pro

### A complete shop management system built for real printing-shop workflows

**Orders • Billing • Payments • Inventory • Employees • Accounts — all in one place**

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![SQLite](https://img.shields.io/badge/Database-SQLite3-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Vite](https://img.shields.io/badge/Bundler-Vite-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tests](https://img.shields.io/badge/Tests-Jest-C21325?logo=jest&logoColor=white)](https://jestjs.io/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](#license)

---

## 📖 About

**VijayFlex Pro** was built for **Vijay Flex & Offset**, a printing shop in Pilibangan, Rajasthan, to replace a fragmented, paper-based system: a separate order register, a daily ledger for sales/expenses, and manual notes for customer dues — all kept in different places.

That setup created real, recurring problems:

- Cash and online payments had to be written down separately, then reconciled by hand.
- Customer dues lived in someone's memory or a notebook, so follow-ups were late — and by the time payment was actually requested, the customer had often already moved on to other work.
- Finding a specific pending order meant flipping through the entire order book.
- There was no single source of truth — the same information (a payment, an order, a due amount) had to be written in three or four different places, and any mismatch between them was a mismatch nobody would notice until it was too late.

VijayFlex Pro was designed around one core principle:

> **"A single wrong due or amount can destroy a customer's trust."**

Every feature — from the recycle bin to cheque tracking to password-gated ledger edits to the cash-balance guard that stops a payout the drawer can't actually cover — exists to make sure that never happens.

---

## ✨ Key Features

### 🧾 Orders & Billing
- Create orders with multiple line items (size/L×B calculator, quantity, rate, auto subtotal)
- Track advance payment, discount/round-off, and balance due — all computed live
- Generate branded, print-ready **PDF invoices** in one click
- Order status pipeline: `Pending → In Progress → Ready → Delivered`
- Follow-up date system — set a reminder date for when a customer is expected to pay
- Full activity log per order, including every payment request sent
- Photo attachments per order (with a full-screen lightbox viewer)

### 👥 Customers & CRM
- Per-customer profile with total billed, total paid, and total due at a glance
- Customer + employee **photo uploads**, shown as the avatar everywhere they appear in the app
- **Multi-order account statements** — one PDF that summarizes every order, payment, and cheque for a customer
- One-click **WhatsApp delivery** of invoices, statements, and payment requests
- Opening balance support for onboarding existing customers with pre-existing dues
- Global header search across customers and orders, with live results as you type

### 💳 Payments & Accounts
- **UPI QR generation** from any of multiple pre-configured UPI IDs, sent directly with the bill — with the due amount pre-filled and non-editable
- **Payment links** for larger dues (e.g. ≥ ₹2,000), also with the amount locked in
- **Cheque Register** with a full lifecycle: `Received → In Bank → Cleared / Bounced`
  - A cheque is **never counted toward a customer's balance until it clears** — so a bounced cheque never silently creates a wrong "due" anywhere in the system
- **Vendor accounts** for tracking purchases and payments to suppliers
- **Commission** is tracked as its own fully independent ledger — recorded once (Daily Sales → Add Expense → Commission) and visible only in Accounts → Commission tab. It never touches a customer's profile, balance, or dues, and never appears in any customer-facing report.

### 💰 Daily Sales & Cash Management
- **Daily Ledger** — every day's income and expenses in one view (cash, UPI, cheque)
- **Cash Drawer** — opening balance carried forward automatically, with cash-in/cash-out breakdown and a computed closing balance, including a note-by-note breakdown on click
- **Galla Hisaab** (physical note-count reconciliation) — count actual notes in the drawer (₹500, ₹200, ₹100, …) and compare against the system's expected cash total, so shortfalls are caught the same day
- **Live cash-balance guard** — any cash expense or cash salary payout is checked against what's actually counted in the drawer before it's allowed to save. A shop can't accidentally record paying out cash it doesn't have; UPI payments are unaffected since they don't touch the physical drawer.
- Expense entries by category, with cash-drawer impact tracked automatically

### 📦 Inventory Management
- Category-based stock tracking (Flex Rolls, Ink & Solvent, Stamps, Chemicals, Photo Frames, and more)
- Fully **custom categories** — add a new stock type with its own unit and attributes without touching code
- Size/variant-level tracking (e.g. roll width × GSM)
- **Low-stock alerts**, surfaced directly on the dashboard and in the notification bell

### 🧑‍💼 Employee Management
- Attendance marking (Present / Absent / Half Day) with a visual monthly calendar
- Automatic **salary calculation** based on present/absent/half days and per-day rate
- Salary crediting via cash or UPI, with full payment history per employee, gated by the same cash-balance guard as expenses

### 📊 Reports
- **Monthly P&L** — income, expenses, net profit, and category-wise expense breakdown
- **Yearly summary** — month-by-month income/expense/profit table
- **All Pending Dues** report — every outstanding balance across all customers, sorted and filterable, with total outstanding shown up front

### 🔔 Notifications
A bell in the header surfaces three kinds of live alerts, generated fresh on every load rather than stored as static records:
- **Follow-ups** — orders due today or overdue with a balance still outstanding
- **Low stock** — combined across all inventory categories, using the same thresholds as the Inventory page
- **Attendance reminders** — shown after 10 AM IST if any active employee's attendance for the day hasn't been marked yet, and disappears the moment it is

Each alert can be marked read individually or all at once. Because the "read" state is tracked against a date-scoped key, anything still unresolved (a due still unpaid, stock still low) automatically reappears as unread the next day — this is "seen for today," not "dismissed forever."

### 🔐 Data Safety & Trust
- **Soft delete** for customers and orders — deleted items go to a **Recycle Bin** and stay recoverable for 30 days before permanent deletion
- **Password-protected** deletion of ledger/payment entries — not everyone can rewrite financial history
- **Page locks** on sensitive sections (Accounts, Reports, Employees, Customer profiles)
- Login-gated app access
- **Manual + scheduled automatic backups** (daily, 11 PM)
- **Automated test coverage** on the highest-risk financial logic — see [Testing](#-testing) below

### One Entry, Everywhere
This is the design principle that ties the whole system together: record a payment **once**, and it automatically reflects in the customer's profile, the daily ledger, the cash drawer (if cash), the order's own payment history, and any relevant report — with zero duplicate data entry.

---

## 🎨 Interface

The entire client was rebuilt on a single Tailwind CSS design system — one consistent dark UI across every page (Dashboard, Orders, Customers, Customer Profile, Employees, Inventory, Reports, UPI QR, Daily Sales, Accounts, WhatsApp Setup, Recycle Bin), replacing what used to be page-by-page inline styling. A shared component library (`Card`, `Badge`, `Button` variants, `Table`, `Modal`, `PageHeader`, `SectionCard`, `StatCard`, `StatusDropdown`) means every page's spacing, typography, and color language now come from the same source instead of being reinvented per page.

| | |
|---|---|
| **Login**<br>![Login screen](screenshots/login.png) | **Dashboard**<br>![Dashboard](screenshots/dashboard.png) |
| **Create Order**<br>![New order form](screenshots/new-order.png) | **Invoice PDF**<br>![Generated invoice PDF](screenshots/invoice-pdf.png) |
| **Customer Profile**<br>![Customer profile with dues and payment history](screenshots/customer-profile.png) | **WhatsApp Delivery**<br>![Statement and payment link delivered via WhatsApp](screenshots/whatsapp-delivery.png) |
| **Cheque Register**<br>![Cheque tracking with status lifecycle](screenshots/cheque-register.png) | **UPI Accounts**<br>![UPI accounts and transaction log](screenshots/upi-accounts.png) |
| **Inventory**<br>![Category-based inventory with low stock warnings](screenshots/inventory.png) | **Galla Hisaab (Cash Reconciliation)**<br>![Physical cash note-count reconciliation](screenshots/galla-hisaab.png) |
| **Employees & Salary**<br>![Employee salary calculator](screenshots/employee-salary.png) | **Monthly P&L Report**<br>![Monthly profit and loss report](screenshots/reports-plnl.png) |
| **Recycle Bin**<br>![Soft-deleted customers and orders, recoverable for 30 days](screenshots/recycle-bin.png) | **Employees**<br>![Employee list](screenshots/employees.png) |

---

## 🛠️ Tech Stack

**Client**
| | |
|---|---|
| Framework | React 19 |
| Styling | Tailwind CSS v4 |
| Build tool | Vite |
| Routing | React Router v7 |
| HTTP | Axios |
| Icons | lucide-react |
| QR generation | `qrcode` |

**Server**
| | |
|---|---|
| Runtime | Node.js + Express |
| Database | SQLite3 (single-file, zero-config) |
| Auth | JSON Web Tokens + bcryptjs |
| File uploads | Multer |
| PDF generation | PDFKit |
| WhatsApp automation | whatsapp-web.js |
| Scheduled jobs | node-cron |
| Testing | Jest + Supertest, in-memory SQLite fixtures |
| Process management | PM2 |

---

## 🏗️ Architecture & Design Decisions

VijayFlex Pro is intentionally built as a **local-first, single-shop system** rather than a multi-tenant SaaS product, because that's what actually fits the problem it solves:

- **SQLite over a client-server database** — one shop, one machine, one dataset. SQLite gives a zero-config, single-file database that's trivial to back up (it's just a file) and requires no separate database server to install or maintain.
- **Runs on `localhost`, managed by PM2** — the app runs on the shop's own computer. This keeps all financial and customer data physically on-site rather than on third-party servers, with no ongoing hosting cost. A separate demo build is deployed on Vercel purely for showcasing the UI — the production app is not meant to be a hosted multi-user service.
- **`whatsapp-web.js` instead of the official WhatsApp Business API** — this was a deliberate cost/practicality trade-off. The official API is a paid product and requires a dedicated phone number that isn't linked to WhatsApp anywhere else — not a realistic ask for a small shop's existing number. `whatsapp-web.js` works with the shop's regular WhatsApp account at no extra cost, in exchange for being a community-maintained library rather than an official, guaranteed-stable API.
- **Idempotent, additive migrations** — every schema change is a `CREATE TABLE IF NOT EXISTS` or `ALTER TABLE ... ADD COLUMN`, run on every startup with errors swallowed for columns that already exist. New features never require a manual migration step or risk existing data.
- **Notifications are computed, not stored** — follow-ups, low-stock, and attendance alerts are generated fresh from live data on every request rather than written to a table when they occur. Only the "read" state is persisted, keyed by a value that includes the date — so an unresolved issue naturally resurfaces as a new alert instead of staying silently dismissed.

---

## 📁 Project Structure

```
flex-shop-manager/
├── client/                    # React frontend
│   └── src/
│       ├── components/
│       │   ├── ui/             # Shared design-system primitives: Card, Badge,
│       │   │                   # Button, Table, Modal, PageHeader, StatCard, ...
│       │   ├── AppLayout.jsx   # Sidebar + header + page shell
│       │   ├── Header.jsx      # Search, clock, notifications, quick actions
│       │   ├── Navbar.jsx      # Sidebar navigation
│       │   ├── BackupManager, PageLock, DenominationCounter, ...
│       ├── pages/               # Dashboard, Orders, Customers, Accounts, Inventory, ...
│       └── services/            # API client
│
└── server/                    # Express backend
    ├── db/                     # SQLite database + schema
    ├── middleware/              # auth, upload, validate
    ├── schemas/                  # request validation schemas
    ├── utils/                     # cashBalance, orderBalance, logger
    ├── routes/                    # orders, customers, payments, cheques, upi, vendors,
    │                              # inventory, employees, notifications, whatsapp, pdf, ...
    ├── tests/                      # Jest test suite + in-memory DB fixtures
    ├── assets/                     # invoice fonts, logo, watermark, signature
    ├── backups/                    # scheduled + manual backup snapshots
    ├── whatsapp.js                  # WhatsApp session handling
    ├── backup.js                     # backup scheduler
    ├── ecosystem.config.js            # PM2 process configuration
    └── index.js                       # app entry point
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm

### 1. Clone the repository
```bash
git clone https://github.com/<your-username>/vijayflex-pro.git
cd vijayflex-pro
```

### 2. Set up the backend
```bash
cd server
npm install
```

Create a `.env` file inside `server/`:
```env
PORT=5000
JWT_SECRET=your_jwt_secret_here
ALLOWED_ORIGINS=http://localhost:3000
DELETE_PASSWORD=choose_a_password
PAGE_LOCK_PIN=choose_a_pin
UPI_ACCOUNTS_JSON=[{"upiId":"yourupi@bank","name":"Your Shop Account"}]
```

Start the backend:
```bash
npm run dev        # development, with nodemon
# or
npm start          # production
```

On first run, scan the WhatsApp QR code from the **WA Setup** page in the app to link your WhatsApp account.

### 3. Set up the frontend
```bash
cd client
npm install
npm run dev
```

The app will be available at `http://localhost:5173` (frontend) with the API running on `http://localhost:5000`.

### 4. (Optional) Run with PM2 for production
```bash
cd server
pm2 start ecosystem.config.js
```

---

## 🧪 Testing

The server has an automated Jest test suite focused on the highest-risk logic in the app: money moving in and out. Coverage includes salary calculation, the cash-balance guard, cash-drawer baseline math, password-protected deletes with cascading balance recalculation, vendor-payment reversal on delete, and the commission/customer-ledger separation.

```bash
cd server
npm install -D jest supertest   # if not already installed
npx jest
```

Tests run against an in-memory SQLite database seeded from the real schema — no risk to any real data, and no external database required.

This suite currently covers Daily Sales, Employees, Expenses, and Customers route logic. Orders, Inventory, Vendors, Cheques, UPI, WhatsApp, PDF generation, and Auth are not yet covered — see [Roadmap](#️-roadmap).

---

## 🔒 Security Notes

- Passwords are hashed with `bcryptjs`; sessions are authenticated via JWT.
- Sensitive pages (Accounts, Reports, Employees, Customer profiles) are individually lockable with a password, independent of the main login.
- Deleting entries from the daily ledger requires a separate password — this is intentionally more restrictive than regular navigation, since it touches financial history.
- Cash-affecting actions (expenses, salary payouts) are checked against the live cash-drawer balance before they're allowed to save.
- This project is built for trusted, single-shop, local-network use. If you plan to expose it beyond `localhost`, review and tighten the CORS configuration and secrets management before doing so.

---

## 🗺️ Roadmap

- [ ] Environment variable template (`.env.example`) for easier onboarding
- [ ] WhatsApp connection health indicator on the dashboard
- [ ] Broaden backend test coverage to Orders, Inventory, Vendors, Cheques, UPI, and Auth
- [ ] Frontend test coverage (currently none — component and end-to-end tests)
- [ ] Finish the visual redesign on the remaining light-themed widgets (BackupManager, DenominationCounter, PageLock, Login)
- [ ] Automated pre-action backup snapshots (in addition to the daily scheduled backup)
- [ ] Fix a filename-casing mismatch between `index.js`'s `pageLocks` require and the actual `pagelocks.js` file — currently harmless only if the deployment filesystem is case-insensitive

---

## 📄 License

This project is licensed under the MIT License.

---

Built for **Vijay Flex & Offset** — Pilibangan, Rajasthan 🖨️