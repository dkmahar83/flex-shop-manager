import { useState, useEffect } from 'react'
import { getCustomers, createCustomer, deleteCustomer } from '../services/api'

function Customers() {
  const [customers, setCustomers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ firm_name: '', contact_name: '', phone: '' })
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchCustomers()
  }, [search])

  function fetchCustomers() {
    setLoading(true)
    getCustomers(search)
      .then(res => {
        setCustomers(res.data)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }

  function handleFormChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  function handleAddCustomer(e) {
    e.preventDefault()
    if (!form.firm_name) {
      setMessage('Firm name is required.')
      return
    }
    setSubmitting(true)
    createCustomer(form)
      .then(() => {
        setMessage('Customer added successfully!')
        setForm({ firm_name: '', contact_name: '', phone: '' })
        setShowForm(false)
        fetchCustomers()
      })
      .catch(err => {
        setMessage('Error adding customer.')
        console.error(err)
      })
      .finally(() => setSubmitting(false))
  }

  function handleDelete(id, firmName) {
    if (!window.confirm(`Delete "${firmName}"? This cannot be undone.`)) return
    deleteCustomer(id)
      .then(() => {
        setMessage('Customer deleted.')
        fetchCustomers()
      })
      .catch(() => setMessage('Error deleting customer.'))
  }

  return (
    <div>
      {/* HEADER */}
      <div style={styles.header}>
        <h2>Customers</h2>
        <button style={styles.addBtn} onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Customer'}
        </button>
      </div>

      {/* MESSAGE */}
      {message && (
        <p style={styles.message} onClick={() => setMessage('')}>{message}</p>
      )}

      {/* ADD CUSTOMER FORM */}
      {showForm && (
        <div style={styles.formBox}>
          <h3 style={{ marginBottom: '16px' }}>New Customer</h3>
          <form onSubmit={handleAddCustomer}>
            <div style={styles.formRow}>
              <input
                style={styles.input}
                placeholder="Firm / Shop Name *"
                name="firm_name"
                value={form.firm_name}
                onChange={handleFormChange}
              />
              <input
                style={styles.input}
                placeholder="Contact Person Name"
                name="contact_name"
                value={form.contact_name}
                onChange={handleFormChange}
              />
              <input
                style={styles.input}
                placeholder="Phone Number"
                name="phone"
                value={form.phone}
                onChange={handleFormChange}
              />
            </div>
            <button style={styles.submitBtn} type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Customer'}
            </button>
          </form>
        </div>
      )}

      {/* SEARCH */}
      <input
        style={styles.searchInput}
        placeholder="Search by firm name, contact or phone..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {/* CUSTOMER LIST */}
      {loading ? (
        <p>Loading...</p>
      ) : customers.length === 0 ? (
        <p style={{ color: '#888' }}>No customers found.</p>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>#</th>
              <th style={styles.th}>Firm Name</th>
              <th style={styles.th}>Contact Person</th>
              <th style={styles.th}>Phone</th>
              <th style={styles.th}>Added On</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.map(c => (
              <tr
                key={c.id}
                style={styles.tr}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
              >
                <td style={styles.td}>{c.id}</td>
                <td style={styles.td}>
                  <strong>{c.firm_name}</strong>
                </td>
                <td style={styles.td}>{c.contact_name || '—'}</td>
                <td style={styles.td}>{c.phone || '—'}</td>
                <td style={styles.td}>
                  {new Date(c.created_at).toLocaleDateString('en-IN')}
                </td>
                <td style={styles.td}>
                  <button
                    onClick={() => handleDelete(c.id, c.firm_name)}
                    style={styles.deleteBtn}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

const styles = {
  header: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: '20px'
  },
  addBtn: {
    backgroundColor: '#e94560', color: '#fff',
    border: 'none', padding: '10px 20px',
    borderRadius: '6px', cursor: 'pointer', fontSize: '14px'
  },
  message: {
    backgroundColor: '#e8f5e9', color: '#2e7d32',
    padding: '10px 16px', borderRadius: '6px',
    marginBottom: '16px', cursor: 'pointer'
  },
  formBox: {
    backgroundColor: '#fff', padding: '20px',
    borderRadius: '8px', marginBottom: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
  },
  formRow: {
    display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px'
  },
  input: {
    padding: '10px 14px', borderRadius: '6px',
    border: '1px solid #ddd', fontSize: '14px',
    flex: '1', minWidth: '200px'
  },
  submitBtn: {
    backgroundColor: '#1a1a2e', color: '#fff',
    border: 'none', padding: '10px 24px',
    borderRadius: '6px', cursor: 'pointer', fontSize: '14px'
  },
  searchInput: {
    width: '100%', padding: '10px 14px',
    borderRadius: '6px', border: '1px solid #ddd',
    fontSize: '14px', marginBottom: '16px',
    boxSizing: 'border-box'
  },
  table: {
    width: '100%', borderCollapse: 'collapse',
    backgroundColor: '#fff', borderRadius: '8px',
    overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
  },
  th: {
    padding: '12px 16px', textAlign: 'left',
    backgroundColor: '#f8f8f8', fontSize: '13px',
    color: '#555', borderBottom: '1px solid #eee'
  },
  td: {
    padding: '12px 16px', fontSize: '14px',
    borderBottom: '1px solid #f0f0f0'
  },
  tr: { backgroundColor: '#fff', transition: 'background 0.15s' },
  deleteBtn: {
    backgroundColor: '#fff', color: '#e74c3c',
    border: '1px solid #e74c3c', padding: '5px 12px',
    borderRadius: '4px', cursor: 'pointer', fontSize: '12px'
  }
}

export default Customers