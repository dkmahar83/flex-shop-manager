// Load environment variables from .env file
require('dotenv').config();
const db = require('./db/database');

const express = require('express');
const cors = require('cors');

// Create the Express application
const app = express();
const PORT = process.env.PORT || 5000;

// MIDDLEWARE — runs on every request
app.use(cors());           // Allow frontend to talk to this backend
app.use(express.json());   // Allow reading JSON from request body

// TEST ROUTE — just to confirm server is working
app.get('/', (req, res) => {
  res.json({ message: 'FlexShop Manager API is running!' });
});

// START SERVER
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});