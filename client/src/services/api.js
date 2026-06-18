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
export const addOpeningBalance = (customerId, data) =>
  api.post(`/customers/${customerId}/opening-balance`, data)

// ORDERS
export const getOrders = (filters = {}) => {
  const params = new URLSearchParams(filters).toString()
  return api.get(`/orders${params ? `?${params}` : ''}`)
}
export const getOrder = (id) => api.get(`/orders/${id}`)
export const createOrder = (data) => api.post('/orders', data)
export const updateOrderStatus = (id, status) => 
  api.put(`/orders/${id}/status`, { status })
export const deleteOrder = (id) => axios.delete(`http://localhost:5000/api/orders/${id}`)

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
export const getEmployeeProfile = (id, month, year) => 
  api.get(`/employees/profile/${id}?month=${month}&year=${year}`)
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
export const getCashDrawer = (date) => api.get(`/daily/cash-drawer?date=${date}`)
// Daily Ledger
export const getDailyLedger = (month, year) => api.get(`/daily/ledger?month=${month}&year=${year}`)
export const getDailyLedgerByDate = (date) => api.get(`/daily/ledger/date?date=${date}`)
// Report
export const getMonthlyReport = (month, year) => api.get(`/daily/report?month=${month}&year=${year}`)
export const getYearlyReport = (year) => api.get(`/daily/report/yearly?year=${year}`)

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

// INVENTORY
export const getFlexStock = () => api.get('/inventory/flex')
export const addFlexStock = (data) => api.post('/inventory/flex', data)
export const useFlexStock = (id, data) => api.put(`/inventory/flex/${id}/use`, data)
export const updateFlexStock = (id, data) => api.put(`/inventory/flex/${id}`, data)
export const deleteFlexStock = (id) => api.delete(`/inventory/flex/${id}`)

export const getStamps = () => api.get('/inventory/stamps')
export const addStamp = (data) => api.post('/inventory/stamps', data)
export const updateStamp = (id, data) => api.put(`/inventory/stamps/${id}`, data)
export const deleteStamp = (id) => api.delete(`/inventory/stamps/${id}`)

export const getChemicals = () => api.get('/inventory/chemicals')
export const addChemical = (data) => api.post('/inventory/chemicals', data)
export const updateChemical = (id, data) => api.put(`/inventory/chemicals/${id}`, data)
export const deleteChemical = (id) => api.delete(`/inventory/chemicals/${id}`)

export const getFrames = () => api.get('/inventory/frames')
export const addFrame = (data) => api.post('/inventory/frames', data)
export const updateFrame = (id, data) => api.put(`/inventory/frames/${id}`, data)
export const deleteFrame = (id) => api.delete(`/inventory/frames/${id}`)

export const getInkStock = () => api.get('/inventory/ink')
export const addInkStock = (data) => api.post('/inventory/ink', data)
export const updateInkStock = (id, data) => api.put(`/inventory/ink/${id}`, data)
export const deleteInkStock = (id) => api.delete(`/inventory/ink/${id}`)

export const getInventoryLog = () => api.get('/inventory/log')