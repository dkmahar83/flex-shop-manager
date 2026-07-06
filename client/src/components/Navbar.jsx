import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  TrendingUp,
  QrCode,
  ShoppingCart,
  Users,
  MessageSquare,
  UserCheck,
  Landmark,
  Package,
  BarChart2,
  Trash2,
  Printer,
  Menu,
  X,
  LogOut,
  ChevronDown,
  ChevronRight,
  Wallet,
  ClipboardList,
} from 'lucide-react'
import BackupManager from './BackupManager'

// ── Group definitions ──────────────────────────────────────────
const groups = [
  {
    id: 'accounts',
    label: 'Accounts',
    icon: Landmark,
    items: [
      { path: '/reports',   label: 'Reports',   icon: BarChart2 },
      { path: '/accounts',  label: 'Accounts',  icon: Wallet    },
      { path: '/employees', label: 'Employees', icon: UserCheck  },
    ],
  },
  {
    id: 'sales',
    label: 'Sales',
    icon: TrendingUp,
    items: [
      { path: '/daily-sales', label: 'Sales',   icon: TrendingUp },
      { path: '/upi-qr',      label: 'UPI QR',  icon: QrCode     },
    ],
  },
  {
    id: 'orders',
    label: 'Orders & CRM',
    icon: ShoppingCart,
    items: [
      { path: '/orders',    label: 'Orders',    icon: ClipboardList },
      { path: '/customers', label: 'Customers', icon: Users         },
      { path: '/whatsapp',  label: 'WA Setup',  icon: MessageSquare },
    ],
  },
  {
    id: 'stock',
    label: 'Stock',
    icon: Package,
    items: [
      { path: '/inventory', label: 'Inventory', icon: Package },
      { path: '/bin',       label: 'Bin',       icon: Trash2  },
    ],
  },
]

// ── Component ──────────────────────────────────────────────────
function Navbar({ user, onLogout }) {
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  // Which group is the active route in? Auto-expand that one.
  const defaultOpen = groups.reduce((acc, g) => {
    acc[g.id] = g.items.some(i => i.path === location.pathname)
    return acc
  }, {})
  const [openGroups, setOpenGroups] = useState(defaultOpen)

  const toggleGroup = id =>
    setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }))

  const isActive = path => location.pathname === path

  return (
    <>
      {/* ── Mobile top bar ── */}
      <div style={styles.mobileTopBar}>
        <span style={styles.mobileBrand}>
          <Printer size={18} style={{ marginRight: 6 }} />
          VijayFlex Pro
        </span>
        <button
          style={styles.hamburger}
          onClick={() => setMobileOpen(o => !o)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* ── Overlay ── */}
      {mobileOpen && (
        <div style={styles.overlay} onClick={() => setMobileOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <div
        style={{
          ...styles.sidebar,
          ...(mobileOpen ? styles.sidebarMobileOpen : {}),
        }}
      >
        {/* Brand */}
        <div style={styles.brand}>
          <Printer size={22} color="#e94560" />
          <span style={styles.brandText}>VijayFlex Pro</span>
        </div>

        {/* Dashboard — standalone link */}
        <div style={styles.dashboardWrap}>
          <Link
            to="/"
            style={{
              ...styles.navLink,
              ...(isActive('/') ? styles.navLinkActive : {}),
            }}
            onClick={() => setMobileOpen(false)}
          >
            <LayoutDashboard size={16} style={styles.linkIcon} />
            <span>Dashboard</span>
            {isActive('/') && <span style={styles.activeDot} />}
          </Link>
        </div>

        {/* Nav Groups */}
        <nav style={styles.navLinks}>
          {groups.map(group => {
            const GroupIcon = group.icon
            const isGroupOpen = !!openGroups[group.id]
            const hasActive = group.items.some(i => isActive(i.path))

            return (
              <div key={group.id} style={styles.group}>
                {/* Group header */}
                <button
                  style={{
                    ...styles.groupHeader,
                    ...(hasActive ? styles.groupHeaderActive : {}),
                  }}
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={isGroupOpen}
                >
                  <GroupIcon size={15} style={styles.groupIcon} />
                  <span style={styles.groupLabel}>{group.label}</span>
                  {isGroupOpen
                    ? <ChevronDown size={13} style={styles.chevron} />
                    : <ChevronRight size={13} style={styles.chevron} />}
                </button>

                {/* Group items */}
                {isGroupOpen && (
                  <div style={styles.groupItems}>
                    {group.items.map(item => {
                      const ItemIcon = item.icon
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          style={{
                            ...styles.navLink,
                            ...styles.childLink,
                            ...(isActive(item.path) ? styles.navLinkActive : {}),
                          }}
                          onClick={() => setMobileOpen(false)}
                        >
                          <ItemIcon size={15} style={styles.linkIcon} />
                          <span>{item.label}</span>
                          {isActive(item.path) && <span style={styles.activeDot} />}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* Bottom: user + actions */}
        <div style={styles.sidebarBottom}>
          <div style={styles.userRow}>
            <div style={styles.userAvatar}>
              {(user?.name || user?.username || 'U')[0].toUpperCase()}
            </div>
            <div>
              <div style={styles.userName}>{user?.name || user?.username}</div>
              <div style={styles.userRole}>Admin</div>
            </div>
          </div>
          <div style={styles.bottomActions}>
            <BackupManager />
            <button onClick={onLogout} style={styles.logoutBtn}>
              <LogOut size={14} style={{ marginRight: 6 }} />
              Logout
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Styles ─────────────────────────────────────────────────────
const SIDEBAR_WIDTH = '220px'

const styles = {
  mobileTopBar: {
    display: 'none',
    position: 'fixed',
    top: 0, left: 0, right: 0,
    height: '56px',
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    zIndex: 200,
  },
  mobileBrand: {
    color: '#fff',
    fontSize: '17px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
  },
  hamburger: {
    background: 'none',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    padding: '4px 8px',
    display: 'flex',
    alignItems: 'center',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 299,
  },
  sidebar: {
    position: 'fixed',
    top: 0, left: 0, bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: '#1a1a2e',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 300,
    boxShadow: '2px 0 12px rgba(0,0,0,0.2)',
    transition: 'transform 0.25s ease',
  },
  sidebarMobileOpen: {
    transform: 'translateX(0)',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '24px 20px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  brandText: {
    color: '#fff',
    fontSize: '17px',
    fontWeight: 'bold',
    letterSpacing: '0.3px',
  },
  dashboardWrap: {
    padding: '10px 10px 4px',
  },
  navLinks: {
    flex: 1,
    overflowY: 'auto',
    padding: '4px 10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },

  // ── Groups ──
  group: {
    marginBottom: '2px',
  },
  groupHeader: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '9px 12px',
    borderRadius: '8px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#6b7280',
    fontSize: '11px',
    fontWeight: '700',
    letterSpacing: '0.6px',
    textTransform: 'uppercase',
    transition: 'background 0.15s, color 0.15s',
  },
  groupHeaderActive: {
    color: '#c0c8d4',
  },
  groupIcon: {
    flexShrink: 0,
    opacity: 0.7,
  },
  groupLabel: {
    flex: 1,
    textAlign: 'left',
  },
  chevron: {
    flexShrink: 0,
    opacity: 0.5,
  },
  groupItems: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
    marginBottom: '4px',
  },

  // ── Links ──
  navLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '9px 12px',
    borderRadius: '8px',
    color: '#9aa3b0',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: '500',
    position: 'relative',
    transition: 'background 0.15s, color 0.15s',
  },
  childLink: {
    paddingLeft: '16px',
    fontSize: '13.5px',
  },
  navLinkActive: {
    backgroundColor: '#2563eb',
    color: '#fff',
  },
  linkIcon: {
    flexShrink: 0,
    width: '18px',
  },
  activeDot: {
    position: 'absolute',
    right: '10px',
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#fff',
    opacity: 0.7,
  },

  // ── Bottom ──
  sidebarBottom: {
    padding: '16px 12px',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  userRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  userAvatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: '#e94560',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    fontSize: '15px',
    flexShrink: 0,
  },
  userName: {
    color: '#fff',
    fontSize: '13px',
    fontWeight: '600',
  },
  userRole: {
    color: '#6b7280',
    fontSize: '11px',
  },
  bottomActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  logoutBtn: {
    backgroundColor: 'transparent',
    border: '1px solid rgba(231,76,60,0.4)',
    color: '#e74c3c',
    padding: '8px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center',
  },
}

export default Navbar