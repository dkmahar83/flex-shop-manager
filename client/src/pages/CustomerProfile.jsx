import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getCustomerProfile } from '../services/api'

function CustomerProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCustomerProfile(id)
      .then(res => {
        setCustomer(res.data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  if (loading) return <p>Loading...</p>
  if (!customer) return <p>Customer not found.</p>

  const orders = customer.orders || []
  const totalBilled = orders.reduce((sum, o) => sum + o.total_amount, 0)
  const totalDue = orders.reduce((sum, o) => sum + o.balance_due, 0)
  const totalPaid = totalBilled - totalDue

  return (
    <div>
      {/* BACK BUTTON */}
      <button onClick={() => navigate('/customers')} style={styles.backBtn}>
        ← Back to Customers
      </button>

      {/* CUSTOMER HEADER */}
      <div style={styles.profileCard}>
        <div>
          <h2 style={{ marginBottom: '4px' }}>{customer.firm_name}</h2>
          <p style={{ color: '#888', fontSize: '14px' }}>
            {customer.contact_name && `Contact: ${customer.contact_name}`}
            {customer.phone && ` • 📞 ${customer.phone}`}
          </p>
        </div>
        <div style={styles.statsRow}>
          <div style={styles.statBox}>
            <div style={styles.statNum}>₹{totalBilled}</div>
            <div style={styles.statLabel}>Total Billed</div>
          </div>
          <div style={styles.statBox}>
            <div style={{ ...styles.statNum, color: '#27ae60' }}>₹{totalPaid}</div>
            <div style={styles.statLabel}>Total Paid</div>
          </div>
          <div style={styles.statBox}>
            <div style={{ ...styles.statNum, color: totalDue > 0 ? '#e74c3c' : '#27ae60' }}>
              ₹{totalDue}
            </div>
            <div style={styles.statLabel}>Total Due</div>
          </div>
          <div style={styles.statBox}>
            <div style={styles.statNum}>{orders.length}</div>
            <div style={styles.statLabel}>Total Orders</div>
          </div>
        </div>
      </div>

      {/* PENDING DUES ALERT */}
      {totalDue > 0 && (
        <div style={styles.dueAlert}>
          ⚠️ This customer has <strong>₹{totalDue}</strong> pending across{' '}
          <strong>{orders.filter(o => o.balance_due > 0).length}</strong> order(s).
        </div>
      )}

      {/* ALL ORDERS */}
      <h3 style={{ marginBottom: '12px' }}>All Orders</h3>
      {orders.length === 0 ? (
        <p style={{ color: '#888' }}>No orders yet.</p>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>#</th>
              <th style={styles.th}>Description</th>
              <th style={styles.th}>Total</th>
              <th style={styles.th}>Advance</th>
              <th style={styles.th}>Balance Due</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Follow-up</th>
              <th style={styles.th}>Date</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o, index) => (
              <tr key={o.id} style={styles.tr}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
              >
                <td style={styles.td}>{index + 1}</td>
                <td style={styles.td}>{o.description || '—'}</td>
                <td style={styles.td}>₹{o.total_amount}</td>
                <td style={styles.td}>₹{o.advance_paid}</td>
                <td style={styles.td}>
                  <span style={{
                    fontWeight: 'bold',
                    color: o.balance_due > 0 ? '#e74c3c' : '#27ae60'
                  }}>
                    ₹{o.balance_due}
                  </span>
                </td>
                <td style={styles.td}>
                  <span style={{
                    ...styles.badge,
                    backgroundColor: statusColor(o.status)
                  }}>
                    {o.status?.replace('_', ' ')}
                  </span>
                </td>
                <td style={styles.td}>
                  {o.follow_up_date
                    ? <span style={{ color: o.follow_up_date <= new Date().toISOString().split('T')[0] ? '#e74c3c' : '#333' }}>
                        {o.follow_up_date}
                      </span>
                    : '—'}
                </td>
                <td style={styles.td}>
                  {new Date(o.created_at).toLocaleDateString('en-IN')}
                </td>
              </tr>
            ))}
          </tbody>
          {/* TOTALS ROW */}
          <tfoot>
            <tr style={{ backgroundColor: '#f8f8f8' }}>
              <td colSpan="2" style={{ ...styles.td, fontWeight: 'bold' }}>Total</td>
              <td style={{ ...styles.td, fontWeight: 'bold' }}>₹{totalBilled}</td>
              <td style={{ ...styles.td, fontWeight: 'bold' }}>₹{totalPaid}</td>
              <td style={{ ...styles.td, fontWeight: 'bold', color: totalDue > 0 ? '#e74c3c' : '#27ae60' }}>
                ₹{totalDue}
              </td>
              <td colSpan="3"></td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  )
}

function statusColor(status) {
  const colors = { pending: '#f39c12', in_progress: '#3498db', ready: '#27ae60', delivered: '#95a5a6' }
  return colors[status] || '#ccc'
}

const styles = {
  backBtn: { backgroundColor: '#fff', border: '1px solid #ddd', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', marginBottom: '20px', fontSize: '14px' },
  profileCard: { backgroundColor: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '20px' },
  statsRow: { display: 'flex', gap: '16px', marginTop: '16px', flexWrap: 'wrap' },
  statBox: { backgroundColor: '#f8f8f8', padding: '16px 24px', borderRadius: '8px', textAlign: 'center', minWidth: '120px' },
  statNum: { fontSize: '22px', fontWeight: 'bold', color: '#1a1a2e' },
  statLabel: { fontSize: '12px', color: '#888', marginTop: '4px' },
  dueAlert: { backgroundColor: '#fff3cd', border: '1px solid #ffc107', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px' },
  table: { width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  th: { padding: '12px 16px', textAlign: 'left', backgroundColor: '#f8f8f8', fontSize: '13px', color: '#555', borderBottom: '1px solid #eee' },
  td: { padding: '12px 16px', fontSize: '14px', borderBottom: '1px solid #f0f0f0' },
  tr: { backgroundColor: '#fff' },
  badge: { padding: '3px 10px', borderRadius: '12px', color: '#fff', fontSize: '12px', textTransform: 'capitalize' }
}

export default CustomerProfile