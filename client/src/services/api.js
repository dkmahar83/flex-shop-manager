import axios from 'axios'

// Your backend URL — change this if port is different
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

// EMPLOYEES
export const getEmployees = () => api.get('/employees')
export const createEmployee = (data) => api.post('/employees', data)
export const markAttendance = (data) => api.post('/employees/attendance', data)
export const getSalary = (id, month, year) => 
  api.get(`/employees/salary/${id}?month=${month}&year=${year}`)

// DASHBOARD
export const getDashboard = () => api.get('/dashboard')