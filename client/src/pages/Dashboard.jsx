import { useState, useEffect } from 'react'
import { getDashboard, sendBillWhatsApp, getWhatsAppStatus } from '../services/api'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight } from 'lucide-react'

function Dashboard() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [dueDateFilter, setDueDateFilter] = useState('all') // 'overdue' | 'today' | 'week' | 'all'
  const [waStatus, setWaStatus] = useState('disconnected')
  const [waSendModal, setWaSendModal] = useState(null)
  const [selectedUpiForWA, setSelectedUpiForWA] = useState('')
  const [waMessage, setWaMessage] = useState('')
  const [collapsed, setCollapsed] = useState({ stats: true, lowStock: true, todayOrders: true, dues: true })
  const navigate = useNavigate()

  const toggleSection = (key) =>
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))

  useEffect(() => {
    getDashboard()
      .then(res => { setData(res.data); setLoading(false) })
      .catch(() => setLoading(false))
    getWhatsAppStatus()
      .then(res => setWaStatus(res.data.status))
      .catch(() => {})
  }, [])

  if (loading) return <p style={{ padding: '20px' }}>Loading...</p>
  if (!data)   return <p style={{ padding: '20px' }}>Could not load dashboard.</p>

  const today = data.date

  // Filter due payments
  const allDues = data.all_dues || []
  const filteredDues = allDues.filter(d => {
    if (dueDateFilter === 'overdue') return d.follow_up_date && d.follow_up_date < today
    if (dueDateFilter === 'today')   return d.follow_up_date === today
    if (dueDateFilter === 'week') {
      const weekLater = new Date(today)
      weekLater.setDate(weekLater.getDate() + 7)
      return d.follow_up_date && d.follow_up_date <= weekLater.toLocaleDateString('en-CA')
    }
    return true // 'all'
  }).sort((a, b) => b.balance_due - a.balance_due) // descending by amount

  return (
    <div>
      <h2 style={styles.heading}>Dashboard — {data.date}</h2>

      {/* STATS ROW */}
      <div style={{ marginBottom: collapsed.stats ? '20px' : '12px' }}>
        <button
          onClick={() => toggleSection('stats')}
          style={styles.sectionHeaderBtn}
          aria-expanded={!collapsed.stats}
        >
          <span style={styles.sectionTitle}>📊 Summary Stats</span>
          {collapsed.stats ? <ChevronRight size={17} /> : <ChevronDown size={17} />}
        </button>
      </div>

      {!collapsed.stats && (
        <div style={styles.statsRow}>
          <div style={styles.card}>
            <div style={styles.cardNumber}>{data.pending_orders}</div>
            <div style={styles.cardLabel}>Pending Orders</div>
          </div>
          <div style={{ ...styles.card, cursor: 'pointer' }} onClick={() => { setCollapsed(prev => ({ ...prev, dues: false })); document.getElementById('dues-section').scrollIntoView({ behavior: 'smooth' }) }}>
            <div style={{ ...styles.cardNumber, color: '#e74c3c' }}>₹{data.total_outstanding}</div>
            <div style={styles.cardLabel}>Total Outstanding</div>
          </div>
          <div style={styles.card}>
            <div style={{ ...styles.cardNumber, color: data.due_reminders.length > 0 ? '#e74c3c' : '#27ae60' }}>
              {data.due_reminders.length}
            </div>
            <div style={styles.cardLabel}>Due Reminders Today</div>
          </div>
          <div style={styles.card}>
            <div style={styles.cardNumber}>{data.today_orders_list.length}</div>
            <div style={styles.cardLabel}>Today's Orders</div>
          </div>
          <div
            style={{ ...styles.card, cursor: 'pointer' }}
            onClick={() => { setCollapsed(prev => ({ ...prev, lowStock: false })); document.getElementById('low-stock-section')?.scrollIntoView({ behavior: 'smooth' }) }}
          >
            <div style={{ ...styles.cardNumber, color: (data.low_stock_alerts?.length || 0) > 0 ? '#e74c3c' : '#27ae60' }}>
              {data.low_stock_alerts?.length || 0}
            </div>
            <div style={styles.cardLabel}>Low Stock Items</div>
          </div>
        </div>
      )}

      {/* LOW STOCK ALERTS */}
      {data.low_stock_alerts && data.low_stock_alerts.length > 0 && (
        <div style={styles.section} id="low-stock-section">
          <div style={{ marginBottom: collapsed.lowStock ? 0 : '12px' }}>
            <button
              onClick={() => toggleSection('lowStock')}
              style={styles.sectionHeaderBtn}
              aria-expanded={!collapsed.lowStock}
            >
              <span style={styles.sectionTitle}>📦 Low Stock Alerts ({data.low_stock_alerts.length})</span>
              {collapsed.lowStock ? <ChevronRight size={17} /> : <ChevronDown size={17} />}
            </button>
          </div>

          {!collapsed.lowStock && (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Category</th>
                  <th style={styles.th}>Item</th>
                  <th style={styles.th}>Remaining</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.low_stock_alerts.map((item, i) => (
                  <tr key={i} style={styles.tr}
                    onClick={() => navigate('/inventory')}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
                  >
                    <td style={styles.td}>{item.category}</td>
                    <td style={{ ...styles.td, fontWeight: 'bold' }}>{item.item_name}</td>
                    <td style={styles.td}>{item.quantity} {item.unit}</td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.badge,
                        backgroundColor: item.status === 'out' ? '#e74c3c' : '#f39c12'
                      }}>
                        {item.status === 'out' ? '🚨 Out of Stock' : '⚠️ Low Stock'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* TODAY'S ORDERS */}
      <div style={styles.section}>
        <div style={{ marginBottom: collapsed.todayOrders ? 0 : '12px' }}>
          <button
            onClick={() => toggleSection('todayOrders')}
            style={styles.sectionHeaderBtn}
            aria-expanded={!collapsed.todayOrders}
          >
            <span style={styles.sectionTitle}>📋 Today's Orders ({data.today_orders_list.length})</span>
            {collapsed.todayOrders ? <ChevronRight size={17} /> : <ChevronDown size={17} />}
          </button>
        </div>

        {!collapsed.todayOrders && (
          data.today_orders_list.length === 0 ? (
            <p style={{ color: '#888' }}>No orders today yet.</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Order ID</th>
                  <th style={styles.th}>Firm</th>
                  <th style={styles.th}>Description</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Amount</th>
                  <th style={styles.th}>Balance Due</th>
                </tr>
              </thead>
              <tbody>
                {data.today_orders_list.map(o => (
                  <tr key={o.id} style={styles.tr}
                    onClick={() => navigate('/orders')}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
                  >
                    <td style={styles.td}>#{o.id}</td>
                    <td style={styles.td}>{o.firm_name}</td>
                    <td style={styles.td}>{o.description}</td>
                    <td style={styles.td}>
                      <span style={{ ...styles.badge, backgroundColor: statusColor(o.status) }}>
                        {o.status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={styles.td}>₹{o.total_amount}</td>
                    <td style={styles.td}>
                      <span style={{ color: o.balance_due > 0 ? '#e74c3c' : '#27ae60', fontWeight: 'bold' }}>
                        ₹{o.balance_due}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>

      {/* DUE PAYMENTS */}
      <div style={styles.section} id="dues-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: collapsed.dues ? 0 : '12px', flexWrap: 'wrap', gap: '10px' }}>
          <button
            onClick={() => toggleSection('dues')}
            style={styles.sectionHeaderBtn}
            aria-expanded={!collapsed.dues}
          >
            <span style={styles.sectionTitle}>💰 Due Payments — ₹{data.total_outstanding}</span>
            {collapsed.dues ? <ChevronRight size={17} /> : <ChevronDown size={17} />}
          </button>

          {/* Filter buttons — sirf tab dikhein jab expanded ho */}
          {!collapsed.dues && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[
                { key: 'overdue', label: '🔴 Overdue' },
                { key: 'today',   label: '🟡 Today' },
                { key: 'week',    label: '📅 This Week' },
                { key: 'all',     label: '📋 All' }
              ].map(f => (
                <button key={f.key}
                  onClick={() => setDueDateFilter(f.key)}
                  style={{
                    padding: '6px 14px', borderRadius: '6px', border: '1px solid #ddd',
                    backgroundColor: dueDateFilter === f.key ? '#1a1a2e' : '#fff',
                    color: dueDateFilter === f.key ? '#fff' : '#555',
                    cursor: 'pointer', fontSize: '13px', fontWeight: dueDateFilter === f.key ? 'bold' : 'normal'
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {!collapsed.dues && (filteredDues.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#888', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            ✅ No dues for this filter.
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>#</th>
                <th style={styles.th}>Firm</th>
                <th style={styles.th}>Phone</th>
                <th style={styles.th}>Description</th>
                <th style={styles.th}>Total</th>
                <th style={styles.th}>Balance Due ↓</th>
                <th style={styles.th}>Follow-up</th>
                <th style={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredDues.map((r, i) => {
                const isOverdue = r.follow_up_date && r.follow_up_date < today
                const isToday   = r.follow_up_date === today
                return (
                  <tr key={r.order_id}
                    style={styles.tr}
                    onClick={() => navigate(`/customers/${r.customer_id}`)}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = isOverdue ? '#fff8f8' : '#fff'}
                  >
                    <td style={styles.td}>{i + 1}</td>
                    <td style={{ ...styles.td, fontWeight: 'bold' }}>{r.firm_name}</td>
                    <td style={styles.td}>{r.phone || '—'}</td>
                    <td style={styles.td}>{r.description}</td>
                    <td style={styles.td}>₹{r.total_amount}</td>
                    <td style={styles.td}>
                      <span style={{ fontWeight: 'bold', fontSize: '16px', color: '#e74c3c' }}>
                        ₹{r.balance_due}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={{
                        padding: '3px 8px', borderRadius: '10px', fontSize: '12px',
                        backgroundColor: isOverdue ? '#fff0f0' : isToday ? '#fff8e1' : '#f0f8ff',
                        color: isOverdue ? '#e74c3c' : isToday ? '#f39c12' : '#3498db',
                        fontWeight: 'bold'
                      }}>
                        {isOverdue ? '⚠️ ' : isToday ? '🔔 ' : ''}{r.follow_up_date || '—'}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={{ ...styles.badge, backgroundColor: statusColor(r.status) }}>
                        {r.status?.replace('_', ' ')}
                      </span>
                      {r.balance_due > 0 && (
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            if (!r.phone) return setWaMessage('Customer ka phone number nahi hai.')
                            setSelectedUpiForWA('')
                            setWaSendModal(r)
                          }}
                          style={{
                            marginLeft: '8px',
                            backgroundColor: waStatus === 'ready' ? '#25D366' : '#ccc',
                            color: '#fff', border: 'none', padding: '3px 10px',
                            borderRadius: '4px', cursor: waStatus === 'ready' ? 'pointer' : 'not-allowed',
                            fontSize: '11px'
                          }}
                          title={waStatus === 'ready' ? 'Payment reminder bhejo' : 'WhatsApp connected nahi'}
                        >
                          📱 WA
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: '#f8f8f8' }}>
                <td colSpan="5" style={{ ...styles.td, fontWeight: 'bold' }}>
                  Total ({filteredDues.length} orders)
                </td>
                <td style={{ ...styles.td, fontWeight: 'bold', color: '#e74c3c', fontSize: '16px' }}>
                  ₹{filteredDues.reduce((s, d) => s + d.balance_due, 0)}
                </td>
                <td colSpan="2"></td>
              </tr>
            </tfoot>
          </table>
        ))}
      </div>
    {waMessage && (
        <p
          onClick={() => setWaMessage('')}
          style={{ position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
            backgroundColor: '#1a1a2e', color: '#fff', padding: '10px 20px',
            borderRadius: '8px', cursor: 'pointer', zIndex: 2000, fontSize: '14px' }}
        >
          {waMessage}
        </p>
      )}

      {waSendModal && (
        <div
          onClick={() => setWaSendModal(null)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '28px',
              width: '380px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}
          >
            <h3 style={{ marginBottom: '6px', fontSize: '16px' }}>📱 Payment Reminder</h3>
            <p style={{ fontSize: '13px', color: '#888', marginBottom: '12px' }}>
              {waSendModal.firm_name} — Order #{waSendModal.order_id}
            </p>
            <p style={{ fontSize: '13px', color: '#e74c3c', marginBottom: '16px', fontWeight: 'bold' }}>
              ⚠️ Balance Due: ₹{waSendModal.balance_due}
            </p>
            <label style={{ fontSize: '13px', color: '#555', display: 'block', marginBottom: '6px' }}>
              UPI QR bhejna hai? Account select karo:
            </label>
            <select
              value={selectedUpiForWA}
              onChange={e => setSelectedUpiForWA(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '6px',
                border: '1px solid #ddd', fontSize: '14px', marginBottom: '20px' }}
            >
              <option value="">❌ QR mat bhejo</option>
              {[
                { label: 'BOI Shop Account', upiId: 'boism-9950580621@boi' },
                { label: 'Google Pay - Rampratap Painter', upiId: 'gpay-11263065173@okbizaxis' },
                { label: 'PhonePe - Bhavya Printers', upiId: 'q214575569@ybl' },
                { label: 'Amazon Pay - Deepak', upiId: '7073580621@yapl' }
              ].map(acc => (
                <option key={acc.upiId} value={acc.upiId}>{acc.label}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setWaSendModal(null)}
                style={{ flex: 1, padding: '10px', borderRadius: '6px',
                  border: '1px solid #ddd', backgroundColor: '#fff',
                  cursor: 'pointer', fontSize: '14px' }}
              >Cancel</button>
              <button
                onClick={() => {
                  sendBillWhatsApp(waSendModal.order_id, selectedUpiForWA)
                    .then(res => {
                      setWaMessage(res.data.message)
                      setWaSendModal(null)
                    })
                    .catch(err => {
                      setWaMessage('WhatsApp error: ' + (err.response?.data?.error || 'Not connected'))
                      setWaSendModal(null)
                    })
                }}
                style={{ flex: 1, padding: '10px', borderRadius: '6px',
                  border: 'none', backgroundColor: '#25D366', color: '#fff',
                  cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}
              >📤 Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function statusColor(status) {
  const colors = { pending: '#f39c12', in_progress: '#3498db', ready: '#27ae60', delivered: '#95a5a6' }
  return colors[status] || '#ccc'
}

const styles = {
  heading:    { marginBottom: '20px', fontSize: '22px' },
  statsRow:   { display: 'flex', gap: '16px', marginBottom: '30px', flexWrap: 'wrap' },
  card:       { backgroundColor: '#fff', borderRadius: '8px', padding: '20px 28px', minWidth: '160px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', textAlign: 'center' },
  cardNumber: { fontSize: '28px', fontWeight: 'bold', color: '#e94560' },
  cardLabel:  { fontSize: '13px', color: '#888', marginTop: '4px' },
  section:    { marginBottom: '30px' },
  sectionTitle: { fontSize: '18px', fontWeight: 'bold', flex: 1, textAlign: 'left' },
  sectionHeaderBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    background: 'none', border: 'none', cursor: 'pointer',
    padding: 0, color: '#1a1a2e', fontFamily: 'inherit',
  },
  table:      { width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  th:         { padding: '12px 16px', textAlign: 'left', backgroundColor: '#f8f8f8', fontSize: '13px', color: '#555', borderBottom: '1px solid #eee' },
  td:         { padding: '12px 16px', fontSize: '14px', borderBottom: '1px solid #f0f0f0' },
  tr:         { backgroundColor: '#fff', cursor: 'pointer' },
  badge:      { padding: '3px 10px', borderRadius: '12px', color: '#fff', fontSize: '12px' }
}

export default Dashboard