import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:5000/api'
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('flexshop_token')
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('flexshop_token')
      localStorage.removeItem('flexshop_user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Auth
export const login = (username, password) =>
  axios.post('http://localhost:5000/api/auth/login', { username, password })
export const verifyToken = (token) =>
  axios.post('http://localhost:5000/api/auth/verify', { token })

// Dashboard
export const getDashboard = () => api.get('/dashboard')

// Customers
export const getCustomers = (search) => api.get('/customers', { params: search ? { search } : {} })
export const createCustomer = (data) => api.post('/customers', data)
export const updateCustomer = (id, data) => api.put(`/customers/${id}`, data)
export const deleteCustomer = (id) => api.delete(`/customers/${id}`)
export const getCustomerProfile = (id) => api.get(`/customers/${id}`)
export const addOpeningBalance = (id, data) => api.post(`/customers/${id}/opening-balance`, data)

// Orders
export const getOrders = (params) => api.get('/orders', { params })
export const createOrder = (data) => api.post('/orders', data)
export const updateOrder = (id, data) => api.put(`/orders/${id}`, data)
export const updateOrderStatus = (id, status) => api.put(`/orders/${id}/status`, { status })
export const getOrderDetail = (id) => api.get(`/orders/${id}`)
export const deleteOrder = (id) => api.delete(`/orders/${id}`)
export const addPayment = (data) => api.post('/payments', data)

// Employees
export const getEmployees = () => api.get('/employees')
export const createEmployee = (data) => api.post('/employees', data)
export const updateEmployee = (id, data) => api.put(`/employees/${id}`, data)
export const deleteEmployee = (id) => api.delete(`/employees/${id}`)
export const getEmployeeProfile = (id) => api.get(`/employees/profile/${id}`)
export const markAttendance = (data) => api.post('/employees/attendance', data)
export const getAttendance = (employeeId, params) => api.get(`/employees/attendance/${employeeId}`, { params })
export const getSalary = (employeeId, params) => api.get(`/employees/salary/${employeeId}`, { params })
export const generateSalary = (data) => api.post('/employees/generate-salary', data)

// Daily Sales
export const getDailySales = (params) => api.get('/daily', { params })
export const createDailySale = (data) => api.post('/daily', data)
export const updateDailySale = (id, data) => api.put(`/daily/${id}`, data)
export const deleteDailySale = (id) => api.delete(`/daily/${id}`)
export const getDailySummary = (month, year) => api.get('/daily/summary', { params: { month, year } })
export const getTodaySales = () => api.get('/daily/today')
export const getDailyLedgerByDate = (date) => api.get(`/daily/ledger/date?date=${date}`)
export const saveCashIncome = (data) => api.post('/daily/cash-income', data)
export const getCashDrawer = (date) => api.get(`/daily/cash-drawer?date=${date}`)

// Expenses
export const getExpenses = (month, year) => api.get('/expenses', { params: { month, year } })
export const createExpense = (data) => api.post('/expenses', data)
export const addExpense = (data) => api.post('/expenses', data)
export const deleteExpense = (id) => api.delete(`/expenses/${id}`)

// Cheques
export const getCheques = (params) => api.get('/cheques', { params })
export const getCheque = (id) => api.get(`/cheques/${id}`)
export const addCheque = (data) => api.post('/cheques', data)
export const updateCheque = (id, data) => api.put(`/cheques/${id}`, data)
export const updateChequeStatus = (id, status) => api.put(`/cheques/${id}/status`, { status })
export const deleteCheque = (id) => api.delete(`/cheques/${id}`)
export const getChequeSummary = () => api.get('/cheques/summary')

// UPI
export const getUPI = () => api.get('/upi')
export const getUpiTransactions = (params) => api.get('/upi', { params })
export const getUpiSummary = (month, year) => api.get('/upi/summary', { params: { month, year } })
export const addUpiTransaction = (data) => api.post('/upi', data)
export const createUPI = (data) => api.post('/upi', data)
export const deleteUPI = (id) => api.delete(`/upi/${id}`)

// Vendors
export const getVendors = () => api.get('/vendors')
export const getVendor = (id) => api.get(`/vendors/${id}`)
export const addVendor = (data) => api.post('/vendors', data)
export const updateVendor = (id, data) => api.put(`/vendors/${id}`, data)
export const deleteVendor = (id) => api.delete(`/vendors/${id}`)
export const addVendorPurchase = (id, data) => api.post(`/vendors/${id}/purchase`, data)
export const addVendorPayment = (id, data) => api.post(`/vendors/${id}/payment`, data)

// Inventory
export const getInventory = () => api.get('/inventory')
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

// Reports
export const getReports = (params) => api.get('/reports', { params })
export const getMonthlyReport = (month, year) => api.get('/daily/report', { params: { month, year } })
export const getYearlyReport = (year) => api.get('/daily/report/yearly', { params: { year } })
export const getDues = () => api.get('/payments/dues')

// WhatsApp
export const getWhatsAppStatus = () => api.get('/whatsapp/status')
export const sendBillWhatsApp = (orderId) => api.post(`/whatsapp/send-bill/${orderId}`)
export const getWhatsAppQR = () => api.get('/whatsapp/qr')

// PDF
export const generatePDF = (orderId) => api.get(`/pdf/bill/${orderId}`, { responseType: 'blob' })

// Recycle Bin
export const getRecycleBin = () => api.get('/customers/deleted/recent')
export const restoreCustomer = (id) => api.put(`/customers/${id}/restore`)

export default api