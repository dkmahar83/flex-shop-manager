import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Customers from './pages/Customers'
import Orders from './pages/Orders'
import Employees from './pages/Employees'
import Navbar from './components/Navbar'
import RecycleBin from './pages/RecycleBin'

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
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App