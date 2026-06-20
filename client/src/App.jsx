import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Customers from './pages/Customers'
import CustomerProfile from './pages/CustomerProfile'
import Orders from './pages/Orders'
import Employees from './pages/Employees'
import DailySales from './pages/DailySales'
import Accounts from './pages/Accounts'
import RecycleBin from './pages/RecycleBin'
import Reports from './pages/Reports'
import Inventory from './pages/Inventory'
import WhatsAppSetup from './pages/WhatsAppSetup'
import { verifyToken } from './services/api'

function App() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('flexshop_token')
    const savedUser = localStorage.getItem('flexshop_user')

    if (token && savedUser) {
      verifyToken(token)
        .then(res => {
          if (res.data.valid) {
            setUser(JSON.parse(savedUser))
          } else {
            localStorage.removeItem('flexshop_token')
            localStorage.removeItem('flexshop_user')
          }
        })
        .catch(() => {
          localStorage.removeItem('flexshop_token')
          localStorage.removeItem('flexshop_user')
        })
        .finally(() => {
          setChecking(false)   // ✅ finally mein move kiya
        })
    } else {
        setTimeout(() => setChecking(false), 0)   // ✅ ye karo
      }
  }, [])

  function handleLogin(userData) {
    setUser(userData)
  }

  function handleLogout() {
    localStorage.removeItem('flexshop_token')
    localStorage.removeItem('flexshop_user')
    setUser(null)
  }

  if (checking) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#1a1a2e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ color: '#fff', fontSize: '18px' }}>
          🖨️ Loading VijayFlex Pro...
        </div>
      </div>
    )
  }

  if (!user) {
    return <Login onLogin={handleLogin} />
  }

  return (
    <BrowserRouter>
      <Navbar user={user} onLogout={handleLogout} />
      <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/customers/:id" element={<CustomerProfile />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/daily-sales" element={<DailySales />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/bin" element={<RecycleBin />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/whatsapp" element={<WhatsAppSetup />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App