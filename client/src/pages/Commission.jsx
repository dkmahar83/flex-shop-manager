import { useState, useEffect } from 'react'
import { getCustomers, getCommissionHistory, getCommissionBalance, creditCommission, returnCommission } from '../services/api'

const UPI_ACCOUNTS = [
  'BOI Shop Account',
  'Google Pay - Rampratap Painter',
  'PhonePe - Bhavya Printers',
  'Amazon Pay - Deepak'
]

function Commission() {
  const [customers, setCustomers] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState({ text: '', type: 'success' })
  const [activeTab, setActiveTab] = useState('credit')

  // Credit form
  const [creditForm, setCreditForm] = useState({
    customer_id: '', amount: '', note: '', transaction_date: todayDate()
  })

  // Return form
  const [returnForm, setReturnForm] = useState({
    customer_id: '', amount: '', return_mode: 'cash',
    return_upi_account: '', cheque_number: '', bank_name: '',
    note: '', transaction_date: todayDate()
  })
  const [returnBalance, setReturnBalance] = useState(null)

  function todayDate() {
    return new Date().toLocaleDateString('en-CA')
  }

  function showMsg(text, type = 'success') {
    setMessage({ text, type })
    setTimeout(() => setMessage({ text: '', type: 'success' }), 4000)
  }

  function fetchHistory() {
    setLoading(true)
    getCommissionHistory()
      .then(res => { setHistory(res.data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    getCustomers().then(res => setCustomers(res.data))
    getCommissionHistory()
      .then(res => { setHistory(res.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // Jab return form me customer change ho, balance fetch karo
  useEffect(() => {
    if (!returnForm.customer_id) return
    let cancelled = false
    getCommissionBalance(returnForm.customer_id)
      .then(res => { if (!cancelled) setReturnBalance(res.data.balance) })
      .catch(() => { if (!cancelled) setReturnBalance(null) })
    return () => { cancelled = true }
  }, [returnForm.customer_id])

  function handleCredit(e) {
    e.preventDefault()
    if (!creditForm.customer_id || !creditForm.amount)
      return showMsg('Customer aur amount required hai', 'error')

    creditCommission(creditForm)
      .then(() => {
        showMsg(`₹${creditForm.amount} commission credit ho gaya!`)
        setCreditForm({ customer_id: '', amount: '', note: '', transaction_date: todayDate() })
        fetchHistory()
      })
      .catch(err => showMsg(err.response?.data?.error || 'Error', 'error'))
  }

  function handleReturn(e) {
    e.preventDefault()
    if (!returnForm.customer_id || !returnForm.amount)
      return showMsg('Customer aur amount required hai', 'error')
    if (returnForm.return_mode === 'upi' && !returnForm.return_upi_account)
      return showMsg('UPI account select karo', 'error')

    returnCommission(returnForm)
      .then(() => {
        showMsg(`₹${returnForm.amount} commission return ho gaya!`)
        setReturnForm({ customer_id: '', amount: '', return_mode: 'cash', return_upi_account: '', note: '', transaction_date: todayDate() })
        setReturnBalance(null)
        fetchHistory()
      })
      .catch(err => showMsg(err.response?.data?.error || 'Error', 'error'))
  }

  // Net balance per customer (summary cards)
  const customerBalances = customers.map(c => {
    const txns = history.filter(h => h.customer_id === c.id)
    const balance = txns.reduce((sum, t) => t.type === 'credit' ? sum + t.amount : sum - t.amount, 0)
    return { ...c, balance }
  }).filter(c => c.balance !== 0)

  return (
    <div>
      <div style={styles.header}>
        <h2>💰 Commission</h2>
      </div>

      {message.text && (
        <div style={{ ...styles.msg, backgroundColor: message.type === 'error' ? '#fdecea' : '#e8f5e9', color: message.type === 'error' ? '#c0392b' : '#2e7d32' }}
          onClick={() => setMessage({ text: '', type: 'success' })}>
          {message.text}
        </div>
      )}

      {/* BALANCE SUMMARY CARDS */}
      {customerBalances.length > 0 && (
        <div style={styles.balanceGrid}>
          {customerBalances.map(c => (
            <div key={c.id} style={{ ...styles.balanceCard, borderLeft: `4px solid ${c.balance > 0 ? '#e67e22' : '#27ae60'}` }}>
              <div style={{ fontSize: '13px', color: '#555', fontWeight: '600' }}>{c.firm_name}</div>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: c.balance > 0 ? '#e67e22' : '#27ae60' }}>
                ₹{c.balance}
              </div>
              <div style={{ fontSize: '11px', color: '#aaa' }}>
                {c.balance > 0 ? 'Wapas karna baaki' : 'Cleared'}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TABS */}
      <div style={styles.tabRow}>
        {[
          { key: 'credit', label: '➕ Credit Commission' },
          { key: 'return', label: '↩️ Return to Customer' },
          { key: 'history', label: '📋 Full History' }
        ].map(t => (
          <button key={t.key}
            style={{ ...styles.tab, ...(activeTab === t.key ? styles.tabActive : {}) }}
            onClick={() => setActiveTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB: CREDIT */}
      {activeTab === 'credit' && (
        <div style={styles.formBox}>
          <h3 style={{ marginBottom: '16px' }}>➕ Commission Credit — Customer ne zyada diya</h3>
          <form onSubmit={handleCredit}>
            <div style={styles.formGrid}>
              <div>
                <label style={styles.label}>Customer *</label>
                <select style={styles.input} value={creditForm.customer_id}
                  onChange={e => setCreditForm(f => ({ ...f, customer_id: e.target.value }))}>
                  <option value="">Customer select karo</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.firm_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={styles.label}>Amount (₹) *</label>
                <input style={styles.input} type="number" placeholder="e.g. 50"
                  value={creditForm.amount}
                  onChange={e => setCreditForm(f => ({ ...f, amount: e.target.value }))} />
              </div>

              <div>
                <label style={styles.label}>Date</label>
                <input style={styles.input} type="date" value={creditForm.transaction_date}
                  onChange={e => setCreditForm(f => ({ ...f, transaction_date: e.target.value }))} />
              </div>

              <div>
                <label style={styles.label}>Note (optional)</label>
                <input style={styles.input} placeholder="e.g. ₹50 zyada mila round-off mein"
                  value={creditForm.note}
                  onChange={e => setCreditForm(f => ({ ...f, note: e.target.value }))} />
              </div>
            </div>

            <button type="submit" style={styles.submitBtn}>✅ Credit Commission</button>
          </form>
        </div>
      )}

      {/* TAB: RETURN */}
      {activeTab === 'return' && (
        <div style={styles.formBox}>
          <h3 style={{ marginBottom: '16px' }}>↩️ Commission Return — Customer ko wapas karo</h3>
          <form onSubmit={handleReturn}>
            <div style={styles.formGrid}>
              <div>
                <label style={styles.label}>Customer *</label>
                <select style={styles.input} value={returnForm.customer_id}
                  onChange={e => setReturnForm(f => ({ ...f, customer_id: e.target.value, amount: '' }))}>
                  <option value="">Customer select karo</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.firm_name}</option>
                  ))}
                </select>
                {returnBalance !== null && (
                  <p style={{ fontSize: '13px', marginTop: '6px', color: returnBalance > 0 ? '#e67e22' : '#27ae60', fontWeight: '600' }}>
                    Available Commission: ₹{returnBalance}
                  </p>
                )}
              </div>

              <div>
                <label style={styles.label}>Amount to Return (₹) *</label>
                <input style={styles.input} type="number" placeholder="e.g. 50"
                  value={returnForm.amount}
                  onChange={e => setReturnForm(f => ({ ...f, amount: e.target.value }))} />
              </div>

              <div>
                <label style={styles.label}>Return Mode *</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button type="button"
                    onClick={() => setReturnForm(f => ({ ...f, return_mode: 'cash', return_upi_account: '', cheque_number: '', bank_name: '' }))}
                    style={{ ...styles.modeBtn, ...(returnForm.return_mode === 'cash' ? styles.modeBtnActive : {}) }}>
                    💵 Cash
                  </button>
                  <button type="button"
                    onClick={() => setReturnForm(f => ({ ...f, return_mode: 'upi', cheque_number: '', bank_name: '' }))}
                    style={{ ...styles.modeBtn, ...(returnForm.return_mode === 'upi' ? { ...styles.modeBtnActive, backgroundColor: '#1565c0' } : {}) }}>
                    📱 UPI
                  </button>
                  <button type="button"
                    onClick={() => setReturnForm(f => ({ ...f, return_mode: 'cheque', return_upi_account: '' }))}
                    style={{ ...styles.modeBtn, ...(returnForm.return_mode === 'cheque' ? { ...styles.modeBtnActive, backgroundColor: '#8e44ad' } : {}) }}>
                    🧾 Cheque
                  </button>
                </div>
              </div>

              {returnForm.return_mode === 'upi' && (
                <div>
                  <label style={styles.label}>UPI Account *</label>
                  <select style={styles.input} value={returnForm.return_upi_account}
                    onChange={e => setReturnForm(f => ({ ...f, return_upi_account: e.target.value }))}>
                    <option value="">Account select karo</option>
                    {UPI_ACCOUNTS.map(acc => (
                      <option key={acc} value={acc}>{acc}</option>
                    ))}
                  </select>
                </div>
              )}

              {returnForm.return_mode === 'cheque' && (
                <>
                  <div>
                    <label style={styles.label}>Cheque Number</label>
                    <input style={styles.input} placeholder="e.g. 004521"
                      value={returnForm.cheque_number || ''}
                      onChange={e => setReturnForm(f => ({ ...f, cheque_number: e.target.value }))} />
                  </div>
                  <div>
                    <label style={styles.label}>Bank Name</label>
                    <input style={styles.input} placeholder="e.g. SBI, BOI"
                      value={returnForm.bank_name || ''}
                      onChange={e => setReturnForm(f => ({ ...f, bank_name: e.target.value }))} />
                  </div>
                </>
              )}

              <div>
                <label style={styles.label}>Date</label>
                <input style={styles.input} type="date" value={returnForm.transaction_date}
                  onChange={e => setReturnForm(f => ({ ...f, transaction_date: e.target.value }))} />
              </div>

              <div>
                <label style={styles.label}>Note (optional)</label>
                <input style={styles.input} placeholder="e.g. commission wapas kiya UPI se"
                  value={returnForm.note}
                  onChange={e => setReturnForm(f => ({ ...f, note: e.target.value }))} />
              </div>
            </div>

            <button type="submit" style={styles.submitBtn}>↩️ Return Commission</button>
          </form>
        </div>
      )}

      {/* TAB: HISTORY */}
      {activeTab === 'history' && (
        <div style={styles.formBox}>
          <h3 style={{ marginBottom: '16px' }}>📋 Commission History</h3>
          {loading ? <p style={{ color: '#888' }}>Loading...</p> : history.length === 0 ? (
            <p style={{ color: '#aaa' }}>Koi commission transaction nahi mili.</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Customer</th>
                  <th style={styles.th}>Type</th>
                  <th style={styles.th}>Amount</th>
                  <th style={styles.th}>Mode / Note</th>
                </tr>
              </thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.id}>
                    <td style={styles.td}>{h.transaction_date}</td>
                    <td style={styles.td}><strong>{h.firm_name}</strong></td>
                    <td style={styles.td}>
                      <span style={{
                        padding: '3px 10px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold',
                        backgroundColor: h.type === 'credit' ? '#fff3cd' : '#e8f5e9',
                        color: h.type === 'credit' ? '#856404' : '#2e7d32'
                      }}>
                        {h.type === 'credit' ? '➕ Credit' : '↩️ Return'}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <strong style={{ color: h.type === 'credit' ? '#e67e22' : '#27ae60' }}>
                        {h.type === 'credit' ? '+' : '−'}₹{h.amount}
                      </strong>
                    </td>
                    <td style={styles.td}>
                      {h.type === 'return' && (
                        <span style={{
                          padding: '2px 8px', borderRadius: '8px', fontSize: '11px', marginRight: '6px',
                          backgroundColor: h.return_mode === 'upi' ? '#e3f2fd' : h.return_mode === 'cheque' ? '#f3e5f5' : '#e8f5e9',
                          color: h.return_mode === 'upi' ? '#1565c0' : h.return_mode === 'cheque' ? '#6a1b9a' : '#2e7d32'
                        }}>
                          {h.return_mode === 'upi'
                            ? `📱 ${h.return_upi_account || 'UPI'}`
                            : h.return_mode === 'cheque'
                            ? `🧾 ${h.bank_name || 'Cheque'}${h.cheque_number ? ` #${h.cheque_number}` : ''}`
                            : '💵 Cash'}
                        </span>
                      )}
                      {h.note || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

const styles = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  msg: { padding: '10px 16px', borderRadius: '6px', marginBottom: '16px', cursor: 'pointer', fontSize: '14px' },
  balanceGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' },
  balanceCard: { backgroundColor: '#fff', padding: '14px 16px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  tabRow: { display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' },
  tab: { padding: '8px 18px', borderRadius: '20px', border: '1px solid #ddd', backgroundColor: '#fff', cursor: 'pointer', fontSize: '13px' },
  tabActive: { backgroundColor: '#1a1a2e', color: '#fff', border: '1px solid #1a1a2e' },
  formBox: { backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px', marginBottom: '16px' },
  label: { fontSize: '12px', color: '#888', display: 'block', marginBottom: '4px' },
  input: { width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', boxSizing: 'border-box' },
  submitBtn: { backgroundColor: '#1a1a2e', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' },
  modeBtn: { padding: '8px 16px', borderRadius: '6px', border: '1px solid #ddd', backgroundColor: '#fff', cursor: 'pointer', fontSize: '13px' },
  modeBtnActive: { backgroundColor: '#27ae60', color: '#fff', border: '1px solid #27ae60' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 14px', textAlign: 'left', backgroundColor: '#f8f8f8', fontSize: '13px', color: '#555', borderBottom: '1px solid #eee' },
  td: { padding: '10px 14px', fontSize: '13px', borderBottom: '1px solid #f5f5f5' }
}

export default Commission