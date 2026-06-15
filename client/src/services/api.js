import axios from 'axios'

const BASE_URL = 'http://localhost:5000/api'

const api = axios.create({
  baseURL: BASE_URL
})

// CUSTOMERS
export const getCustomers = (search) => 
  api.get(`/customers${search ? `?search=${search}` : ''}`)

export const getCustomer = (id) => api.get(`/customers/${id}`)
export const createCustomer = (data) => api.post('/customers', data)
export const updateCustomer = (id, data) => api.put(`/customers/${id}`, data)
export const deleteCustomer = (id) => api.delete(`/customers/${id}`)
export const getCustomerProfile = (id) => api.get(`/customers/${id}`)

// ORDERS
export const getOrders = (filters = {}) => {
  const params = new URLSearchParams(filters).toString()
  return api.get(`/orders${params ? `?${params}` : ''}`)
}
export const getOrder = (id) => api.get(`/orders/${id}`)
export const createOrder = (data) => api.post('/orders', data)
export const updateOrderStatus = (id, status) => 
  api.put(`/orders/${id}/status`, { status })

// PAYMENTS
export const createPayment = (data) => api.post('/payments', data)
export const getDues = () => api.get('/payments/dues')
export const getOrderDetail = (id) => api.get(`/orders/${id}`)
export const addPayment = (data) => api.post('/payments', data)

// EMPLOYEES
export const getEmployees = () => api.get('/employees')
export const createEmployee = (data) => api.post('/employees', data)
export const markAttendance = (data) => api.post('/employees/attendance', data)
export const getAttendance = (employeeId, month, year) =>
  api.get(`/employees/attendance/${employeeId}?month=${month}&year=${year}`)
export const getSalary = (id, month, year) => 
  api.get(`/employees/salary/${id}?month=${month}&year=${year}`)
export const getEmployeeProfile = (id) => api.get(`/employees/profile/${id}`)
export const generateSalary = (data) => api.post('/employees/generate-salary', data)

// DASHBOARD
export const getDashboard = () => api.get('/dashboard')

// DAILY SALES
export const getDailyRecords = (month, year) =>
  api.get(`/daily?month=${month}&year=${year}`)
export const getDailySummary = (month, year) =>
  api.get(`/daily/summary?month=${month}&year=${year}`)
export const saveDailyRecord = (data) => api.post('/daily', data)
export const getTodaySales = () => api.get('/daily/today')
export const getDailyLedger = (month, year) => api.get(`/daily/ledger?month=${month}&year=${year}`)

// CASH INCOME (linked to customers)
export const saveCashIncome = (data) => api.post('/daily/cash-income', data)

// EXPENSES
export const getExpenses = (month, year) =>
  api.get(`/expenses?month=${month}&year=${year}`)
export const addExpense = (data) => api.post('/expenses', data)
export const deleteExpense = (id) => api.delete(`/expenses/${id}`)
export const getExpensesByDate = (date) => api.get(`/expenses/daily?date=${date}`)
export const getExpenseSummary = (month, year) => api.get(`/expenses/summary?month=${month}&year=${year}`)

// CHEQUES
export const getCheques = (params = {}) => api.get('/cheques', { params })
export const addCheque = (data) => api.post('/cheques', data)
export const updateChequeStatus = (id, status) => api.put(`/cheques/${id}/status`, { status })
export const getChequeSummary = () => api.get('/cheques/summary')
export const getCheque = (id) => api.get(`/cheques/${id}`)
export const updateCheque = (id, data) => api.put(`/cheques/${id}`, data)

// UPI
export const getUpiTransactions = (params = {}) => api.get('/upi', { params })
export const getUpiSummary = (month, year) => api.get(`/upi/summary?month=${month}&year=${year}`)
export const addUpiTransaction = (data) => api.post('/upi', data)

// VENDORS
export const getVendors = () => api.get('/vendors')
export const getVendor = (id) => api.get(`/vendors/${id}`)
export const addVendor = (data) => api.post('/vendors', data)
export const addVendorPurchase = (id, data) => api.post(`/vendors/${id}/purchase`, data)
export const addVendorPayment = (id, data) => api.post(`/vendors/${id}/payment`, data)