import { useState, useEffect } from 'react'
import { getDashboard } from '../services/api'

function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDashboard()
      .then(res => {
        setData(res.data)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }, [])

  if (loading) return <p>Loading...</p>
  if (!data) return <p>Could not load dashboard.</p>

  return (
    <div>
      <h2 style={styles.heading}>Dashboard — {data.date}</h2>

      {/* STATS ROW */}
      <div style={styles.statsRow}>
        <div style={styles.card}>
          <div style={styles.cardNumber}>{data.pending_orders}</div>
          <div style={styles.cardLabel}>Pending Orders</div>
        </div>
        <div style={styles.card}>
          <div style={styles.cardNumber}>₹{data.total_outstanding}</div>
          <div style={styles.cardLabel}>Total Outstanding</div>
        </div>
        <div style={styles.card}>
          <div style={styles.cardNumber}>{data.due_reminders.length}</div>
          <div style={styles.cardLabel}>Due Reminders Today</div>
        </div>
        <div style={styles.card}>
          <div style={styles.cardNumber}>{data.today_orders_list.length}</div>
          <div style={styles.cardLabel}>Today's Orders</div>
        </div>
      </div>

      {/* DUE REMINDERS */}
      {data.due_reminders.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>🔔 Due Reminders</h3>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Firm</th>
                <th style={styles.th}>Phone</th>
                <th style={styles.th}>Amount Due</th>
                <th style={styles.th}>Follow Up</th>
              </tr>
            </thead>
            <tbody>
              {data.due_reminders.map(r => (
                <tr key={r.order_id} style={styles.tr}>
                  <td style={styles.td}>{r.firm_name}</td>
                  <td style={styles.td}>{r.phone}</td>
                  <td style={styles.td}>₹{r.balance_due}</td>
                  <td style={styles.td}>{r.follow_up_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TODAY'S ORDERS */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>📋 Today's Orders</h3>
        {data.today_orders_list.length === 0 ? (
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
              </tr>
            </thead>
            <tbody>
              {data.today_orders_list.map(o => (
                <tr key={o.id} style={styles.tr}>
                  <td style={styles.td}>#{o.id}</td>
                  <td style={styles.td}>{o.firm_name}</td>
                  <td style={styles.td}>{o.description}</td>
                  <td style={styles.td}>
                    <span style={{
                      ...styles.badge,
                      backgroundColor: statusColor(o.status)
                    }}>
                      {o.status}
                    </span>
                  </td>
                  <td style={styles.td}>₹{o.total_amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function statusColor(status) {
  const colors = {
    pending: '#f39c12',
    in_progress: '#3498db',
    ready: '#27ae60',
    delivered: '#95a5a6'
  }
  return colors[status] || '#ccc'
}

const styles = {
  heading: { marginBottom: '20px', fontSize: '22px' },
  statsRow: {
    display: 'flex', gap: '16px', marginBottom: '30px', flexWrap: 'wrap'
  },
  card: {
    backgroundColor: '#fff', borderRadius: '8px',
    padding: '20px 28px', minWidth: '160px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)', textAlign: 'center'
  },
  cardNumber: { fontSize: '28px', fontWeight: 'bold', color: '#e94560' },
  cardLabel: { fontSize: '13px', color: '#888', marginTop: '4px' },
  section: { marginBottom: '30px' },
  sectionTitle: { marginBottom: '12px', fontSize: '18px' },
  table: { width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff',
    borderRadius: '8px', overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  th: { padding: '12px 16px', textAlign: 'left', backgroundColor: '#f8f8f8',
    fontSize: '13px', color: '#555', borderBottom: '1px solid #eee' },
  td: { padding: '12px 16px', fontSize: '14px', borderBottom: '1px solid #f0f0f0' },
  tr: { cursor: 'pointer' },
  badge: { padding: '3px 10px', borderRadius: '12px', color: '#fff', fontSize: '12px' }
}

export default Dashboard