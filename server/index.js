require('dotenv').config();
const db = require('./db/database');
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── ROUTES ──
const authRoutes      = require('./routes/auth')
const customerRoutes  = require('./routes/customers')
const orderRoutes     = require('./routes/orders')
const paymentRoutes   = require('./routes/payments')
const employeeRoutes  = require('./routes/employees')
const dashboardRoutes = require('./routes/dashboard')
const dailyRoutes     = require('./routes/daily')
const expenseRoutes   = require('./routes/expenses')
const chequeRoutes    = require('./routes/cheques')
const upiRoutes       = require('./routes/upi')
const vendorRoutes    = require('./routes/vendors')
const inventoryRoutes = require('./routes/inventory')
const pdfRoutes       = require('./routes/pdf')
const whatsappRoutes  = require('./routes/whatsapp')
const commissionRoutes = require('./routes/commission')
const pageLockRoutes = require('./routes/pageLocks')


// ── AUTH MIDDLEWARE ──
const requireAuth = require('./middleware/auth')

// ── WHATSAPP ──
const { initWhatsApp } = require('./whatsapp')

// ── PUBLIC ROUTES ──
app.use('/api/auth', authRoutes)

// ── PROTECTED ROUTES ──
app.use('/api/customers',  requireAuth, customerRoutes)
app.use('/api/orders',     requireAuth, orderRoutes)
app.use('/api/payments',   requireAuth, paymentRoutes)
app.use('/api/employees',  requireAuth, employeeRoutes)
app.use('/api/dashboard',  requireAuth, dashboardRoutes)
app.use('/api/daily',      requireAuth, dailyRoutes)
app.use('/api/expenses',   requireAuth, expenseRoutes)
app.use('/api/cheques',    requireAuth, chequeRoutes)
app.use('/api/upi',        requireAuth, upiRoutes)
app.use('/api/vendors',    requireAuth, vendorRoutes)
app.use('/api/inventory',  requireAuth, inventoryRoutes)
app.use('/api/pdf',        requireAuth, pdfRoutes)
app.use('/api/whatsapp',   requireAuth, whatsappRoutes)
app.use('/api/commission', requireAuth, commissionRoutes)
app.use('/api/page-locks', requireAuth, pageLockRoutes)

app.get('/', (req, res) => {
  res.json({ message: 'VijayFlex Pro API is running!' })
})
// Global error handler — catches multer errors etc, always returns JSON
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  res.status(500).json({ error: err.message || 'Something went wrong' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  setTimeout(initWhatsApp, 3000)
})


