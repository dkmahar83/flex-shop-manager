import { useState, useEffect } from 'react'
import {
  getCheques, addCheque, updateChequeStatus, getChequeSummary,
  getUpiTransactions, getUpiSummary, addUpiTransaction,
  getVendors, getVendor, addVendor, addVendorPurchase, addVendorPayment,
  getCustomers
} from '../services/api'

const UPI_ACCOUNTS = [
  'BOI Shop Account',
  'Google Pay - Rampratap Painter',
  'PhonePe - Bhavya Printers',
  'Amazon Pay - Deepak'
]

const CHEQUE_STATUSES = ['received', 'deposited', 'cleared', 'bounced']

function Accounts() {
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0')
  const currentYear = String(new Date().getFullYear())

  const [activeTab, setActiveTab] = useState('cheques')
  const [message, setMessage] = useState('')
  const [filterMonth, setFilterMonth] = useState(currentMonth)
  const [filterYear, setFilterYear] = useState(currentYear)

  // Cheques
  const [cheques, setCheques] = useState([])
  const [chequeSummary, setChequeSummary] = useState([])
  const [chequeForm, setChequeForm] = useState({
    cheque_number: '', firm_name: '', customer_id: '',
    bank_name: '', amount: '', received_date: '', order_id: '', notes: ''
  })
  const [showChequeForm, setShowChequeForm] = useState(false)

  // UPI
  const [upiTransactions, setUpiTransactions] = useState([])
  const [upiSummary, setUpiSummary] = useState([])
  const [upiForm, setUpiForm] = useState({
    upi_account: '', customer_name: '', customer_id: '',
    amount: '', transaction_date: '', utr_number: '', order_id: '', notes: ''
  })
  const [showUpiForm, setShowUpiForm] = useState(false)
  const [upiFilter, setUpiFilter] = useState('')

  // Vendors
  const [vendors, setVendors] = useState([])
  const [selectedVendor, setSelectedVendor] = useState(null)
  const [vendorDetail, setVendorDetail] = useState(null)
  const [vendorForm, setVendorForm] = useState({ name: '', phone: '', shop_type: '', city: '', notes: '' })
  const [showVendorForm, setShowVendorForm] = useState(false)
  const [txnForm, setTxnForm] = useState({ amount: '', description: '', transaction_date: '' })
  const [txnType, setTxnType] = useState('purchase')

  // Customers for dropdown
  const [customers, setCustomers] = useState([])

  useEffect(() => {
    fetchAll()
    getCustomers().then(res => setCustomers(res.data)).catch(() => {})
  }, [filterMonth, filterYear]) // eslint-disable-line react-hooks/exhaustive-deps

  function fetchAll() {
    fetchCheques()
    fetchUpi()
    fetchVendors()
  }

  function fetchCheques() {
    getCheques({ month: filterMonth, year: filterYear })
      .then(res => setCheques(res.data)).catch(() => {})
    getChequeSummary()
      .then(res => setChequeSummary(res.data)).catch(() => {})
  }

  function fetchUpi() {
    getUpiTransactions({ month: filterMonth, year: filterYear, upi_account: upiFilter || undefined })
      .then(res => setUpiTransactions(res.data)).catch(() => {})
    getUpiSummary(filterMonth, filterYear)
      .then(res => setUpiSummary(res.data.summary || [])).catch(() => {})
  }

  function fetchVendors() {
    getVendors().then(res => setVendors(res.data)).catch(() => {})
  }

  function fetchVendorDetail(id) {
    getVendor(id).then(res => {
      setVendorDetail(res.data)
      setSelectedVendor(res.data)
    }).catch(() => {})
  }

  function handleAddCheque(e) {
    e.preventDefault()
    if (!chequeForm.firm_name || !chequeForm.amount) return setMessage('Firm name and amount required.')
    addCheque(chequeForm)
      .then(() => {
        setMessage('Cheque recorded successfully.')
        setChequeForm({ cheque_number: '', firm_name: '', customer_id: '', bank_name: '', amount: '', received_date: '', order_id: '', notes: '' })
        setShowChequeForm(false)
        fetchCheques()
      })
      .catch(() => setMessage('Error recording cheque.'))
  }

  function handleChequeStatusUpdate(id, status) {
    updateChequeStatus(id, status)
      .then(() => { setMessage(`Cheque marked as ${status}`); fetchCheques() })
      .catch(() => setMessage('Error updating cheque.'))
  }

  function handleAddUpi(e) {
    e.preventDefault()
    if (!upiForm.upi_account || !upiForm.amount) return setMessage('UPI account and amount required.')
    addUpiTransaction(upiForm)
      .then(() => {
        setMessage('UPI transaction recorded.')
        setUpiForm({ upi_account: '', customer_name: '', customer_id: '', amount: '', transaction_date: '', utr_number: '', order_id: '', notes: '' })
        setShowUpiForm(false)
        fetchUpi()
      })
      .catch(() => setMessage('Error recording UPI transaction.'))
  }

  function handleAddVendor(e) {
    e.preventDefault()
    if (!vendorForm.name) return setMessage('Vendor name required.')
    addVendor(vendorForm)
      .then(() => {
        setMessage('Vendor added.')
        setVendorForm({ name: '', phone: '', shop_type: '', city: '', notes: '' })
        setShowVendorForm(false)
        fetchVendors()
      })
      .catch(() => setMessage('Error adding vendor.'))
  }

  function handleVendorTxn(e) {
    e.preventDefault()
    if (!txnForm.amount) return setMessage('Amount required.')
    const fn = txnType === 'purchase' ? addVendorPurchase : addVendorPayment
    fn(selectedVendor.id, txnForm)
      .then(() => {
        setMessage(`${txnType === 'purchase' ? 'Purchase' : 'Payment'} recorded.`)
        setTxnForm({ amount: '', description: '', transaction_date: '' })
        fetchVendorDetail(selectedVendor.id)
        fetchVendors()
      })
      .catch(() => setMessage('Error recording transaction.'))
  }

  const statusColor = (s) => ({
    received: '#f39c12', deposited: '#3498db', cleared: '#27ae60', bounced: '#e74c3c'
  }[s] || '#ccc')

  const upiColor = (acc) => ({
    'BOI Shop Account': '#1a237e',
    'Google Pay - Rampratap Painter': '#1a73e8',
    'PhonePe - Bhavya Printers': '#5f259f',
    'Amazon Pay - Deepak': '#ff9900'
  }[acc] || '#888')

  return (
    <div>
      <div style={styles.header}>
        <h2>🏦 Accounts</h2>
      </div>

      {message && <p style={styles.message} onClick={() => setMessage('')}>{message}</p>}

      {/* MONTH FILTER */}
      <div style={styles.filterRow}>
        <select style={{ ...styles.input, maxWidth: '150px' }} value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
          {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, i) => (
            <option key={m} value={m}>{new Date(2000, i).toLocaleString('en-IN', { month: 'long' })}</option>
          ))}
        </select>
        <select style={{ ...styles.input, maxWidth: '100px' }} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
          {['2024', '2025', '2026', '2027'].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* TABS */}
      <div style={styles.tabRow}>
        {['cheques', 'upi', 'vendors'].map(tab => (
          <button key={tab}
            style={{ ...styles.tab, ...(activeTab === tab ? styles.activeTab : {}) }}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'cheques' ? '🧾 Cheque Register'
              : tab === 'upi' ? '📱 UPI Accounts'
              : '🏪 Vendor Accounts'}
          </button>
        ))}
      </div>

      {/* ─── CHEQUES TAB ─── */}
      {activeTab === 'cheques' && (
        <div>
          {/* Cheque summary cards */}
          <div style={styles.summaryRow}>
            {chequeSummary.map(s => (
              <div key={s.status} style={{ ...styles.summaryCard, borderTop: `4px solid ${statusColor(s.status)}` }}>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: statusColor(s.status) }}>₹{s.total}</div>
                <div style={{ fontSize: '12px', color: '#888', marginTop: '4px', textTransform: 'capitalize' }}>{s.status} ({s.count})</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button style={styles.addBtn} onClick={() => setShowChequeForm(!showChequeForm)}>
              {showChequeForm ? 'Cancel' : '+ Add Cheque'}
            </button>
          </div>

          {showChequeForm && (
            <div style={styles.formBox}>
              <h3 style={{ marginBottom: '16px' }}>Record New Cheque</h3>
              <form onSubmit={handleAddCheque}>
                <div style={styles.formRow}>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Cheque Number</label>
                    <input style={styles.input} placeholder="e.g. 123456" value={chequeForm.cheque_number}
                      onChange={e => setChequeForm({ ...chequeForm, cheque_number: e.target.value })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Firm / Person Name *</label>
                    <input style={styles.input} placeholder="Who gave the cheque" value={chequeForm.firm_name}
                      onChange={e => setChequeForm({ ...chequeForm, firm_name: e.target.value })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Link to Customer (optional)</label>
                    <select style={styles.input} value={chequeForm.customer_id}
                      onChange={e => setChequeForm({ ...chequeForm, customer_id: e.target.value })}>
                      <option value="">Select Customer</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.firm_name}</option>)}
                    </select>
                  </div>
                </div>
                <div style={styles.formRow}>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Bank Name</label>
                    <input style={styles.input} placeholder="e.g. SBI, PNB, BOI" value={chequeForm.bank_name}
                      onChange={e => setChequeForm({ ...chequeForm, bank_name: e.target.value })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Amount (₹) *</label>
                    <input style={styles.input} type="number" placeholder="0" value={chequeForm.amount}
                      onChange={e => setChequeForm({ ...chequeForm, amount: e.target.value })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Received Date</label>
                    <input style={styles.input} type="date" value={chequeForm.received_date}
                      onChange={e => setChequeForm({ ...chequeForm, received_date: e.target.value })} />
                  </div>
                </div>
                <div style={styles.formRow}>
                  <div style={{ flex: 2 }}>
                    <label style={styles.label}>Notes</label>
                    <input style={styles.input} placeholder="e.g. Against order #5, payment for flex printing"
                      value={chequeForm.notes}
                      onChange={e => setChequeForm({ ...chequeForm, notes: e.target.value })} />
                  </div>
                </div>
                <button style={styles.submitBtn} type="submit">Save Cheque</button>
              </form>
            </div>
          )}

          {/* Cheque list */}
          {cheques.length === 0 ? (
            <p style={{ color: '#888' }}>No cheques for this period.</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Cheque No.</th>
                  <th style={styles.th}>Firm</th>
                  <th style={styles.th}>Bank</th>
                  <th style={styles.th}>Amount</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Notes</th>
                  <th style={styles.th}>Update</th>
                </tr>
              </thead>
              <tbody>
                {cheques.map(c => (
                  <tr key={c.id} style={styles.tr}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
                  >
                    <td style={styles.td}>{c.received_date}</td>
                    <td style={styles.td}><strong>{c.cheque_number || '—'}</strong></td>
                    <td style={styles.td}>{c.firm_name}</td>
                    <td style={styles.td}>{c.bank_name || '—'}</td>
                    <td style={styles.td}><strong>₹{c.amount}</strong></td>
                    <td style={styles.td}>
                      <span style={{ ...styles.badge, backgroundColor: statusColor(c.status) }}>
                        {c.status}
                      </span>
                    </td>
                    <td style={{ ...styles.td, fontSize: '12px', color: '#888' }}>{c.notes || '—'}</td>
                    <td style={styles.td}>
                      <select
                        value={c.status}
                        onChange={e => handleChequeStatusUpdate(c.id, e.target.value)}
                        style={{ ...styles.input, padding: '4px 8px', fontSize: '12px' }}
                      >
                        {CHEQUE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ─── UPI TAB ─── */}
      {activeTab === 'upi' && (
        <div>
          {/* UPI account summary */}
          <div style={styles.summaryRow}>
            {UPI_ACCOUNTS.map(acc => {
              const s = upiSummary.find(x => x.upi_account === acc)
              return (
                <div key={acc} style={{ ...styles.summaryCard, borderTop: `4px solid ${upiColor(acc)}`, cursor: 'pointer',
                  outline: upiFilter === acc ? `2px solid ${upiColor(acc)}` : 'none' }}
                  onClick={() => { setUpiFilter(upiFilter === acc ? '' : acc); fetchUpi() }}
                >
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: upiColor(acc) }}>
                    ₹{s ? s.total : 0}
                  </div>
                  <div style={{ fontSize: '11px', color: '#555', marginTop: '4px' }}>{acc}</div>
                  <div style={{ fontSize: '11px', color: '#aaa' }}>{s ? s.count : 0} transactions</div>
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button style={styles.addBtn} onClick={() => setShowUpiForm(!showUpiForm)}>
              {showUpiForm ? 'Cancel' : '+ Record UPI Payment'}
            </button>
          </div>

          {showUpiForm && (
            <div style={styles.formBox}>
              <h3 style={{ marginBottom: '16px' }}>Record UPI Transaction</h3>
              <form onSubmit={handleAddUpi}>
                <div style={styles.formRow}>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>UPI Account Received In *</label>
                    <select style={styles.input} value={upiForm.upi_account}
                      onChange={e => setUpiForm({ ...upiForm, upi_account: e.target.value })}>
                      <option value="">Select UPI Account</option>
                      {UPI_ACCOUNTS.map(acc => <option key={acc} value={acc}>{acc}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Amount (₹) *</label>
                    <input style={styles.input} type="number" placeholder="0" value={upiForm.amount}
                      onChange={e => setUpiForm({ ...upiForm, amount: e.target.value })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Date</label>
                    <input style={styles.input} type="date" value={upiForm.transaction_date}
                      onChange={e => setUpiForm({ ...upiForm, transaction_date: e.target.value })} />
                  </div>
                </div>
                <div style={styles.formRow}>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Customer Name</label>
                    <input style={styles.input} placeholder="Who paid" value={upiForm.customer_name}
                      onChange={e => setUpiForm({ ...upiForm, customer_name: e.target.value })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Link to Customer (optional)</label>
                    <select style={styles.input} value={upiForm.customer_id}
                      onChange={e => setUpiForm({ ...upiForm, customer_id: e.target.value })}>
                      <option value="">Select Customer</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.firm_name}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>UTR / Reference Number</label>
                    <input style={styles.input} placeholder="e.g. 123456789012" value={upiForm.utr_number}
                      onChange={e => setUpiForm({ ...upiForm, utr_number: e.target.value })} />
                  </div>
                </div>
                <div style={styles.formRow}>
                  <div style={{ flex: 2 }}>
                    <label style={styles.label}>Notes</label>
                    <input style={styles.input} placeholder="e.g. Payment for flex order, advance for visiting cards"
                      value={upiForm.notes}
                      onChange={e => setUpiForm({ ...upiForm, notes: e.target.value })} />
                  </div>
                </div>
                <button style={styles.submitBtn} type="submit">Save UPI Transaction</button>
              </form>
            </div>
          )}

          {/* UPI transaction list */}
          {upiTransactions.length === 0 ? (
            <p style={{ color: '#888' }}>No UPI transactions for this period.</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>UPI Account</th>
                  <th style={styles.th}>From</th>
                  <th style={styles.th}>Amount</th>
                  <th style={styles.th}>UTR No.</th>
                  <th style={styles.th}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {upiTransactions.map(t => (
                  <tr key={t.id} style={styles.tr}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
                  >
                    <td style={styles.td}>{t.transaction_date}</td>
                    <td style={styles.td}>
                      <span style={{ ...styles.badge, backgroundColor: upiColor(t.upi_account), fontSize: '11px' }}>
                        {t.upi_account}
                      </span>
                    </td>
                    <td style={styles.td}>{t.customer_name || t.customer_firm || '—'}</td>
                    <td style={styles.td}><strong style={{ color: '#27ae60' }}>₹{t.amount}</strong></td>
                    <td style={styles.td}><span style={{ fontSize: '12px', color: '#888' }}>{t.utr_number || '—'}</span></td>
                    <td style={styles.td}><span style={{ fontSize: '12px', color: '#888' }}>{t.notes || '—'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ─── VENDORS TAB ─── */}
      {activeTab === 'vendors' && (
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>

          {/* Vendor list */}
          <div style={{ flex: '1', minWidth: '280px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3>Vendors</h3>
              <button style={styles.addBtn} onClick={() => setShowVendorForm(!showVendorForm)}>
                {showVendorForm ? 'Cancel' : '+ Add Vendor'}
              </button>
            </div>

            {showVendorForm && (
              <div style={{ ...styles.formBox, marginBottom: '16px' }}>
                <h4 style={{ marginBottom: '12px' }}>New Vendor</h4>
                <form onSubmit={handleAddVendor}>
                  <div style={{ marginBottom: '10px' }}>
                    <label style={styles.label}>Name *</label>
                    <input style={styles.input} placeholder="Vendor / Shop name" value={vendorForm.name}
                      onChange={e => setVendorForm({ ...vendorForm, name: e.target.value })} />
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <label style={styles.label}>Phone</label>
                    <input style={styles.input} placeholder="Phone number" value={vendorForm.phone}
                      onChange={e => setVendorForm({ ...vendorForm, phone: e.target.value })} />
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <label style={styles.label}>Shop Type</label>
                    <input style={styles.input} placeholder="e.g. Flex Supplier, Pipe Shop, Ink" value={vendorForm.shop_type}
                      onChange={e => setVendorForm({ ...vendorForm, shop_type: e.target.value })} />
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <label style={styles.label}>City</label>
                    <input style={styles.input} placeholder="e.g. Delhi, Jaipur, Pilibangan" value={vendorForm.city}
                      onChange={e => setVendorForm({ ...vendorForm, city: e.target.value })} />
                  </div>
                  <button style={styles.submitBtn} type="submit">Save Vendor</button>
                </form>
              </div>
            )}

            {vendors.map(v => (
              <div key={v.id}
                style={{
                  ...styles.vendorCard,
                  border: selectedVendor?.id === v.id ? '2px solid #1a1a2e' : '1px solid #eee'
                }}
                onClick={() => fetchVendorDetail(v.id)}
              >
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{v.name}</div>
                <div style={{ fontSize: '12px', color: '#888' }}>{v.shop_type} • {v.city}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#27ae60' }}>Purchased: ₹{v.total_purchased}</span>
                  <span style={{ fontSize: '12px', color: '#e74c3c', fontWeight: 'bold' }}>
                    Due: ₹{v.balance_due}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Vendor detail */}
          {vendorDetail && (
            <div style={{ flex: '2', minWidth: '300px' }}>
              <div style={styles.formBox}>
                <h3 style={{ marginBottom: '4px' }}>{vendorDetail.name}</h3>
                <p style={{ fontSize: '13px', color: '#888', marginBottom: '16px' }}>
                  {vendorDetail.shop_type} • {vendorDetail.city} • {vendorDetail.phone}
                </p>

                {/* Vendor stats */}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
                  <div style={styles.vendorStat}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#e74c3c' }}>₹{vendorDetail.total_purchased}</div>
                    <div style={{ fontSize: '11px', color: '#888' }}>Total Purchased</div>
                  </div>
                  <div style={styles.vendorStat}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#27ae60' }}>₹{vendorDetail.total_paid}</div>
                    <div style={{ fontSize: '11px', color: '#888' }}>Total Paid</div>
                  </div>
                  <div style={{ ...styles.vendorStat, backgroundColor: vendorDetail.balance_due > 0 ? '#fff5f5' : '#f0fff4' }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: vendorDetail.balance_due > 0 ? '#e74c3c' : '#27ae60' }}>
                      ₹{vendorDetail.balance_due}
                    </div>
                    <div style={{ fontSize: '11px', color: '#888' }}>Balance Due</div>
                  </div>
                </div>

                {/* Add transaction */}
                <div style={{ marginBottom: '20px', backgroundColor: '#f8f8f8', padding: '16px', borderRadius: '8px' }}>
                  <h4 style={{ marginBottom: '12px' }}>Record Transaction</h4>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    <button
                      type="button"
                      onClick={() => setTxnType('purchase')}
                      style={{ ...styles.txnTypeBtn, backgroundColor: txnType === 'purchase' ? '#e74c3c' : '#fff', color: txnType === 'purchase' ? '#fff' : '#e74c3c', border: '1px solid #e74c3c' }}
                    >
                      📦 Purchase (We Bought)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTxnType('payment')}
                      style={{ ...styles.txnTypeBtn, backgroundColor: txnType === 'payment' ? '#27ae60' : '#fff', color: txnType === 'payment' ? '#fff' : '#27ae60', border: '1px solid #27ae60' }}
                    >
                      💵 Payment (We Paid)
                    </button>
                  </div>
                  <form onSubmit={handleVendorTxn}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1 }}>
                        <label style={styles.label}>Amount (₹)</label>
                        <input style={styles.input} type="number" placeholder="0" value={txnForm.amount}
                          onChange={e => setTxnForm({ ...txnForm, amount: e.target.value })} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={styles.label}>Date</label>
                        <input style={styles.input} type="date" value={txnForm.transaction_date}
                          onChange={e => setTxnForm({ ...txnForm, transaction_date: e.target.value })} />
                      </div>
                    </div>
                    <div style={{ marginTop: '8px' }}>
                      <label style={styles.label}>Description</label>
                      <input style={styles.input} placeholder="e.g. 2 rolls 180GSM flex, pipe purchase"
                        value={txnForm.description}
                        onChange={e => setTxnForm({ ...txnForm, description: e.target.value })} />
                    </div>
                    <button style={{ ...styles.submitBtn, marginTop: '10px', backgroundColor: txnType === 'purchase' ? '#e74c3c' : '#27ae60' }} type="submit">
                      Save {txnType === 'purchase' ? 'Purchase' : 'Payment'}
                    </button>
                  </form>
                </div>

                {/* Transaction history */}
                <h4 style={{ marginBottom: '10px' }}>Transaction History</h4>
                {vendorDetail.transactions && vendorDetail.transactions.length === 0 ? (
                  <p style={{ color: '#888', fontSize: '14px' }}>No transactions yet.</p>
                ) : (
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Date</th>
                        <th style={styles.th}>Type</th>
                        <th style={styles.th}>Amount</th>
                        <th style={styles.th}>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vendorDetail.transactions && vendorDetail.transactions.map(t => (
                        <tr key={t.id} style={styles.tr}>
                          <td style={styles.td}>{t.transaction_date}</td>
                          <td style={styles.td}>
                            <span style={{ ...styles.badge, backgroundColor: t.type === 'purchase' ? '#e74c3c' : '#27ae60' }}>
                              {t.type === 'purchase' ? '📦 Purchase' : '💵 Payment'}
                            </span>
                          </td>
                          <td style={styles.td}>
                            <strong style={{ color: t.type === 'purchase' ? '#e74c3c' : '#27ae60' }}>
                              ₹{t.amount}
                            </strong>
                          </td>
                          <td style={{ ...styles.td, fontSize: '13px', color: '#555' }}>{t.description || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const styles = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  message: { backgroundColor: '#e8f5e9', color: '#2e7d32', padding: '10px 16px', borderRadius: '6px', marginBottom: '16px', cursor: 'pointer' },
  filterRow: { display: 'flex', gap: '12px', marginBottom: '20px' },
  summaryRow: { display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' },
  summaryCard: { flex: '1', minWidth: '140px', backgroundColor: '#fff', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', cursor: 'pointer' },
  tabRow: { display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' },
  tab: { padding: '10px 20px', borderRadius: '8px', border: '1px solid #ddd', backgroundColor: '#fff', cursor: 'pointer', fontSize: '14px' },
  activeTab: { backgroundColor: '#1a1a2e', color: '#fff', border: '1px solid #1a1a2e' },
  addBtn: { backgroundColor: '#e94560', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' },
  formBox: { backgroundColor: '#fff', padding: '20px', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  formRow: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' },
  input: { width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', boxSizing: 'border-box' },
  label: { fontSize: '12px', color: '#888', display: 'block', marginBottom: '4px' },
  submitBtn: { backgroundColor: '#1a1a2e', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' },
  table: { width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  th: { padding: '10px 14px', textAlign: 'left', backgroundColor: '#f8f8f8', fontSize: '13px', color: '#555', borderBottom: '1px solid #eee' },
  td: { padding: '10px 14px', fontSize: '14px', borderBottom: '1px solid #f0f0f0' },
  tr: { backgroundColor: '#fff' },
  badge: { padding: '3px 10px', borderRadius: '12px', color: '#fff', fontSize: '12px', textTransform: 'capitalize' },
  vendorCard: { backgroundColor: '#fff', padding: '14px 16px', borderRadius: '8px', marginBottom: '10px', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  vendorStat: { flex: '1', minWidth: '100px', backgroundColor: '#f8f8f8', padding: '12px', borderRadius: '8px', textAlign: 'center' },
  txnTypeBtn: { padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }
}

export default Accounts