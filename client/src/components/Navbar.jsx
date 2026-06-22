import { Link, useLocation } from 'react-router-dom'
import BackupManager from './BackupManager'
function Navbar({ user, onLogout }) {
  const location = useLocation()

  const links = [
    { path: '/', label: 'Dashboard' },
    { path: '/daily-sales', label: '💰 Sales' },
    { path: '/customers', label: 'Customers' },
    { path: '/orders', label: 'Orders' },
    { path: '/upi-qr', label: '📲 UPI QR' },
    { path: '/whatsapp', label: '📱 WA Setup' },
    { path: '/employees', label: 'Employees' },
    { path: '/accounts', label: '🏦 Accounts' },
    { path: '/inventory', label: '📦 Inventory' },
    { path: '/reports', label: '📊 Reports' },
    { path: '/bin', label: '🗑️ Bin' }
  ]

  return (
    <nav style={styles.nav}>
      <div style={styles.brand}>
        🖨️ VijayFlex Pro
      </div>
      <div style={styles.links}>
        {links.map(link => (
          <Link
            key={link.path}
            to={link.path}
            style={{
              ...styles.link,
              ...(location.pathname === link.path ? styles.activeLink : {})
            }}
          >
            {link.label}
          </Link>
        ))}
      </div>

      {/* User + Logout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <BackupManager />
        <span style={{ color: '#aaa', fontSize: '13px' }}>
          👤 {user?.name || user?.username}
        </span>
        <button onClick={onLogout} style={styles.logoutBtn}>
          Logout
        </button>
      </div>
    </nav>
  )
}


const styles = {
  nav: {
    backgroundColor: '#1a1a2e',
    padding: '12px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    color: '#fff',
    fontSize: '20px',
    fontWeight: 'bold',
  },
  links: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap'
  },
  link: {
    color: '#aaa',
    textDecoration: 'none',
    padding: '8px 16px',
    borderRadius: '6px',
    fontSize: '14px',
  },
  activeLink: {
    backgroundColor: '#e94560',
    color: '#fff',
  },
  logoutBtn: {
    backgroundColor: 'transparent',
    border: '1px solid #e74c3c',
    color: '#e74c3c',
    padding: '6px 14px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px'
  }
}

export default Navbar