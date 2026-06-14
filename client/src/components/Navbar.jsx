import { Link, useLocation } from 'react-router-dom'

function Navbar() {
  const location = useLocation()

  const links = [
    { path: '/', label: 'Dashboard' },
    { path: '/customers', label: 'Customers' },
    { path: '/orders', label: 'Orders' },
    { path: '/employees', label: 'Employees' },
  ]

  return (
    <nav style={styles.nav}>
      <div style={styles.brand}>
        🖨️ FlexShop Manager
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
  }
}

export default Navbar