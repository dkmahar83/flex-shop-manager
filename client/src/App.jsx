import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Customers from './pages/Customers'
import Orders from './pages/Orders'
import Employees from './pages/Employees'
import Navbar from './components/Navbar'
import RecycleBin from './pages/RecycleBin'
import CustomerProfile from './pages/CustomerProfile'
import DailySales from './pages/DailySales'
import Accounts from './pages/Accounts'
import Inventory from './pages/Inventory'
import Reports from './pages/Reports'
import WhatsAppSetup from './pages/WhatsAppSetup'


function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <div style={{ padding: '20px' }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/recycle-bin" element={<RecycleBin />} />
          <Route path="/customers/:id" element={<CustomerProfile />} />
          <Route path="/daily-sales" element={<DailySales />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/whatsapp" element={<WhatsAppSetup />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App