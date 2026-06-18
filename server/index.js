require('dotenv').config();
const db = require('./db/database');

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// MIDDLEWARE
app.use(cors());
app.use(express.json());

// ROUTES
const customerRoutes = require('./routes/customers');
const orderRoutes = require('./routes/orders');
const paymentRoutes = require('./routes/payments');
const employeeRoutes = require('./routes/employees');
const dashboardRoutes = require('./routes/dashboard');
const dailyRoutes = require('./routes/daily');
const expenseRoutes = require('./routes/expenses');
const chequeRoutes = require('./routes/cheques');
const upiRoutes = require('./routes/upi');
const vendorRoutes = require('./routes/vendors');
const pdfRoutes = require('./routes/pdf')
app.use('/api/pdf', pdfRoutes)

app.use('/api/cheques', chequeRoutes);
app.use('/api/upi', upiRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/daily', dailyRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/inventory', require('./routes/inventory'));

// TEST ROUTE
app.get('/', (req, res) => {
  res.json({ message: 'FlexShop Manager API is running!' });
});

// START SERVER
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});