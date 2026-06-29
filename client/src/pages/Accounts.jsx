import { useState, useEffect } from 'react'
import PageLock from '../components/PageLock'
import {
  getCheques, addCheque, updateChequeStatus, getChequeSummary, getCheque, updateCheque,
  getUpiTransactions, getUpiSummary, addUpiTransaction,
  getVendors, getVendor, addVendor, updateVendor, deleteVendor,
  addVendorPurchase, addVendorPayment,
  getCustomers, getExpenses, deleteLedgerEntry
} from '../services/api'

const UPI_ACCOUNTS = [
  'BOI Shop Account',
  'Google Pay - Rampratap Painter',
  'PhonePe - Bhavya Printers',
  'Amazon Pay - Deepak'
]

const BANK_TYPES = ['NEFT', 'RTGS', 'IMPS', 'NACH']

// ─── Small reusable modal ───────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 2000, padding: '16px'
    }}>
      <div style={{
        background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '520px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 20px', borderBottom: '1px solid #eee', background: '#f8f8f8'
        }}>
          <span style={{ fontWeight: 700, fontSize: '16px' }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#888', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '20px' }}>{children}</div>
      </div>
    </div>
  )
}

// ─── Vendor form (add / edit) ───────────────────────────────────────────────
function VendorForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial || { name: '', phone: '', shop_type: '', city: '', notes: '' })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const fields = [
    { key: 'name',      label: 'Vendor Name *',      placeholder: 'e.g. SV Traders' },
    { key: 'phone',     label: 'Phone',               placeholder: '9876543210' },
    { key: 'shop_type', label: 'Shop Type / Products',placeholder: 'e.g. Flex Supplier, Ink' },
    { key: 'city',      label: 'City',                placeholder: 'e.g. Chandigarh' },
    { key: 'notes',     label: 'Notes',               placeholder: 'Any extra details' },
  ]
  return (
    <div>
      {fields.map(({ key, label, placeholder }) => (
        <div key={key} style={{ marginBottom: '12px' }}>
          <label style={styles.label}>{label}</label>
          <input style={styles.input} placeholder={placeholder}
            value={form[key]} onChange={e => set(key, e.target.value)} />
        </div>
      ))}
      <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
        <button onClick={onCancel} style={{ flex: 1, padding: '10px', border: '1px solid #ddd', borderRadius: '6px', background: '#fff', cursor: 'pointer' }}>
          Cancel
        </button>
        <button
          onClick={() => form.name.trim() && onSave(form)}
          disabled={!form.name.trim() || saving}
          style={{ flex: 2, ...styles.submitBtn, opacity: form.name.trim() ? 1 : 0.5 }}
        >
          {saving ? 'Saving…' : initial ? 'Save Changes' : 'Add Vendor'}
        </button>
      </div>
    </div>
  )
}

// ─── Purchase items table editor ────────────────────────────────────────────
function PurchaseItemsEditor({ items, setItems }) {
  const addRow = () => setItems(p => [...p, { id: Date.now(), name: '', qty: '', unit: '', rate: '', amount: '' }])
  const update = (id, key, val) => setItems(p => p.map(r => {
    if (r.id !== id) return r
    const upd = { ...r, [key]: val }
    if (key === 'qty' || key === 'rate') {
      const q = parseFloat(key === 'qty' ? val : r.qty) || 0
      const rt = parseFloat(key === 'rate' ? val : r.rate) || 0
      upd.amount = (q * rt).toFixed(2)
    }
    return upd
  }))
  const remove = id => setItems(p => p.filter(r => r.id !== id))
  const total = items.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)

  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <label style={{ ...styles.label, marginBottom: 0 }}>Purchase Items</label>
        <button onClick={addRow} style={{
          padding: '4px 12px', background: '#eff6ff', border: '1px solid #bfdbfe',
          borderRadius: '6px', color: '#1d4ed8', fontWeight: 700, fontSize: '12px', cursor: 'pointer'
        }}>+ Add Item</button>
      </div>

      {items.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '14px', border: '2px dashed #e5e7eb',
          borderRadius: '8px', color: '#9ca3af', fontSize: '13px'
        }}>
          Click "+ Add Item" to list what was purchased
        </div>
      ) : (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 28px',
            background: '#f3f4f6', padding: '7px 10px',
            fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase'
          }}>
            <span>Item</span><span>Qty</span><span>Unit</span><span>Rate (₹)</span><span>Amount</span><span></span>
          </div>
          {items.map((row, i) => (
            <div key={row.id} style={{
              display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 28px',
              padding: '6px 10px', borderTop: i > 0 ? '1px solid #f3f4f6' : 'none',
              alignItems: 'center', background: i % 2 === 0 ? '#fff' : '#fafafa'
            }}>
              {[
                { k: 'name', ph: 'Flex roll, Ink…' },
                { k: 'qty',  ph: '2', tp: 'number' },
                { k: 'unit', ph: 'rolls' },
                { k: 'rate', ph: '0', tp: 'number' },
              ].map(({ k, ph, tp }) => (
                <input key={k} type={tp || 'text'} value={row[k]} placeholder={ph}
                  onChange={e => update(row.id, k, e.target.value)}
                  style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '13px', outline: 'none', padding: '2px 4px' }} />
              ))}
              <span style={{ fontSize: '13px', fontWeight: 600, paddingLeft: '4px' }}>
                {row.amount || '0'}
              </span>
              <button onClick={() => remove(row.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}>×</button>
            </div>
          ))}
          <div style={{
            display: 'flex', justifyContent: 'flex-end', padding: '8px 12px',
            borderTop: '2px solid #e5e7eb', background: '#f9fafb',
            fontSize: '14px', fontWeight: 700
          }}>
            Total: ₹{total.toFixed(2)}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Payment method selector ─────────────────────────────────────────────────
function PaymentMethodSelector({ method, setMethod, upiAccount, setUpiAccount, bankType, setBankType }) {
  const btn = (label, val, color) => (
    <button onClick={() => setMethod(val)} style={{
      flex: 1, padding: '8px 4px', borderRadius: '8px',
      border: `2px solid ${method === val ? color : '#e5e7eb'}`,
      background: method === val ? color + '18' : '#fff',
      color: method === val ? color : '#6b7280',
      fontWeight: 700, fontSize: '13px', cursor: 'pointer', transition: 'all .15s'
    }}>{label}</button>
  )
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={styles.label}>Payment Method</label>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
        {btn('💵 Cash', 'cash', '#16a34a')}
        {btn('📱 UPI',  'upi',  '#7c3aed')}
        {btn('🏦 Bank', 'bank', '#1d4ed8')}
      </div>

      {method === 'upi' && (
        <div>
          <label style={styles.label}>Select UPI Account</label>
          <select value={upiAccount} onChange={e => setUpiAccount(e.target.value)} style={styles.input}>
            <option value="">-- Select Account --</option>
            {UPI_ACCOUNTS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      )}

      {method === 'bank' && (
        <div>
          <label style={styles.label}>Transfer Type</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {BANK_TYPES.map(t => (
              <button key={t} onClick={() => setBankType(t)} style={{
                padding: '6px 16px', borderRadius: '20px', border: '2px solid',
                borderColor: bankType === t ? '#1d4ed8' : '#e5e7eb',
                background: bankType === t ? '#1d4ed8' : '#fff',
                color: bankType === t ? '#fff' : '#374151',
                fontWeight: 700, fontSize: '13px', cursor: 'pointer'
              }}>{t}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Accounts component ─────────────────────────────────────────────────
function Accounts() {
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0')
  const currentYear  = String(new Date().getFullYear())

  const [activeTab, setActiveTab]     = useState('cheques')
  const [message, setMessage]         = useState('')
  const [filterMonth, setFilterMonth] = useState(currentMonth)
  const [filterYear, setFilterYear]   = useState(currentYear)

  // ── Cheques ──
  const [cheques, setCheques]             = useState([])
  const [chequeSummary, setChequeSummary] = useState([])
  const [chequeForm, setChequeForm]       = useState({ cheque_number: '', firm_name: '', customer_id: '', bank_name: '', amount: '', received_date: '', order_id: '', notes: '' })
  const [showChequeForm, setShowChequeForm] = useState(false)
  const [selectedCheque, setSelectedCheque] = useState(null)
  const [chequeDetail, setChequeDetail]     = useState(null)
  const [editingCheque, setEditingCheque]   = useState(false)
  const [chequeEditForm, setChequeEditForm] = useState({})

  // ── UPI ──
  const [upiTransactions, setUpiTransactions] = useState([])
  const [upiSummary, setUpiSummary]           = useState([])
  const [upiForm, setUpiForm]                 = useState({ upi_account: '', customer_name: '', customer_id: '', amount: '', transaction_date: '', utr_number: '', order_id: '', notes: '' })
  const [showUpiForm, setShowUpiForm]         = useState(false)
  const [upiFilter, setUpiFilter]             = useState('')
  const [upiDeleteModal, setUpiDeleteModal]       = useState(null) // { type, id, label }
  const [upiDeletePassword, setUpiDeletePassword] = useState('')
  const [upiDeleteLoading, setUpiDeleteLoading]   = useState(false)

  // ── Vendors ──
  const [vendors, setVendors]               = useState([])
  const [selectedVendor, setSelectedVendor] = useState(null)
  const [vendorDetail, setVendorDetail]     = useState(null)

  // Vendor add/edit/delete modals
  const [showAddVendor, setShowAddVendor]       = useState(false)
  const [editVendorData, setEditVendorData]     = useState(null)   // null = closed
  const [deleteConfirmV, setDeleteConfirmV]     = useState(null)   // vendor obj
  const [vendorSaving, setVendorSaving]         = useState(false)

  // Transaction form
  const [txnType, setTxnType]   = useState('purchase')
  const [txnDate, setTxnDate]   = useState('')
  const [txnDesc, setTxnDesc]   = useState('')

  // Purchase-specific
  const [purchaseItems, setPurchaseItems] = useState([])

  // Payment-specific
  const [payAmount, setPayAmount]       = useState('')
  const [payMethod, setPayMethod]       = useState('cash')
  const [payUpiAcc, setPayUpiAcc]       = useState('')
  const [payBankType, setPayBankType]   = useState('NEFT')

  // Customers
  const [customers, setCustomers] = useState([])
  const [commissionEntries, setCommissionEntries] = useState([])
  const [commissionLoading, setCommissionLoading] = useState(false)

  useEffect(() => { fetchAll(); getCustomers().then(r => setCustomers(r.data)).catch(() => {}) }, [filterMonth, filterYear]) // eslint-disable-line

  function fetchAll()    { fetchCheques(); fetchUpi(); fetchVendors() }
  function fetchCommission() {
    setCommissionLoading(true)
    getExpenses(filterMonth, filterYear)
      .then(r => {
        setCommissionEntries((r.data || []).filter(e => e.category === 'Commission'))
        setCommissionLoading(false)
      })
      .catch(() => setCommissionLoading(false))
  }
  function fetchCheques() {
    getCheques({ month: filterMonth, year: filterYear }).then(r => setCheques(r.data)).catch(() => {})
    getChequeSummary().then(r => setChequeSummary(r.data)).catch(() => {})
  }
  function fetchUpi() {
    getUpiTransactions({ month: filterMonth, year: filterYear, upi_account: upiFilter || undefined }).then(r => setUpiTransactions(r.data)).catch(() => {})
    getUpiSummary(filterMonth, filterYear).then(r => setUpiSummary(r.data.summary || [])).catch(() => {})
  }
  function fetchVendors() { getVendors().then(r => setVendors(r.data)).catch(() => {}) }
  function fetchVendorDetail(id) {
    getVendor(id).then(r => { setVendorDetail(r.data); setSelectedVendor(r.data) }).catch(() => {})
  }

  function notify(msg) { setMessage(msg); setTimeout(() => setMessage(''), 3000) }

  // ── Cheque handlers ──
  function handleAddCheque(e) {
    e.preventDefault()
    if (!chequeForm.firm_name || !chequeForm.amount) return notify('Firm name and amount required.')
    addCheque(chequeForm).then(() => {
      notify('Cheque recorded.')
      setChequeForm({ cheque_number: '', firm_name: '', customer_id: '', bank_name: '', amount: '', received_date: '', order_id: '', notes: '' })
      setShowChequeForm(false); fetchCheques()
    }).catch(() => notify('Error recording cheque.'))
  }
  function handleChequeStatusUpdate(id, status) {
    updateChequeStatus(id, status).then(() => { notify(`Cheque marked as ${status}`); fetchCheques() }).catch(() => notify('Error updating cheque.'))
  }

  // ── UPI handler ──
  function handleAddUpi(e) {
    e.preventDefault()
    if (!upiForm.upi_account || !upiForm.amount) return notify('UPI account and amount required.')
    addUpiTransaction(upiForm).then(() => {
      notify('UPI transaction recorded.')
      setUpiForm({ upi_account: '', customer_name: '', customer_id: '', amount: '', transaction_date: '', utr_number: '', order_id: '', notes: '' })
      setShowUpiForm(false); fetchUpi()
    }).catch(() => notify('Error recording UPI transaction.'))
  }

  function handleUpiDelete(e) {
    e.preventDefault()
    if (!upiDeletePassword) return notify('Password daalo.')
    setUpiDeleteLoading(true)
    deleteLedgerEntry(upiDeletePassword, upiDeleteModal.type, upiDeleteModal.id)
      .then(() => {
        notify('Entry delete ho gayi ✅')
        setUpiDeleteModal(null)
        setUpiDeletePassword('')
        fetchUpi()
      })
      .catch(err => notify(err.response?.data?.error || 'Delete failed.'))
      .finally(() => setUpiDeleteLoading(false))
  }

  // ── Vendor handlers ──
  function handleAddVendor(form) {
    setVendorSaving(true)
    addVendor(form).then(() => {
      notify('Vendor added.'); setShowAddVendor(false); setVendorSaving(false); fetchVendors()
    }).catch(() => { notify('Error adding vendor.'); setVendorSaving(false) })
  }

  function handleEditVendor(form) {
    setVendorSaving(true)
    updateVendor(editVendorData.id, form).then(() => {
      notify('Vendor updated.')
      setEditVendorData(null); setVendorSaving(false)
      fetchVendors()
      if (selectedVendor?.id === editVendorData.id) fetchVendorDetail(editVendorData.id)
    }).catch(() => { notify('Error updating vendor.'); setVendorSaving(false) })
  }

  function handleDeleteVendor() {
    deleteVendor(deleteConfirmV.id).then(() => {
      notify('Vendor deleted.')
      setDeleteConfirmV(null)
      if (selectedVendor?.id === deleteConfirmV.id) { setSelectedVendor(null); setVendorDetail(null) }
      fetchVendors()
    }).catch(() => notify('Error deleting vendor.'))
  }

  function resetTxnForm() {
    setTxnDate(''); setTxnDesc(''); setPurchaseItems([])
    setPayAmount(''); setPayMethod('cash'); setPayUpiAcc(''); setPayBankType('NEFT')
  }

  function handleVendorPurchase(e) {
    e.preventDefault()
    const total = purchaseItems.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
    if (!total && !txnDesc.trim()) return notify('Add items or a description.')
    const payload = {
      amount: total,
      description: txnDesc,
      transaction_date: txnDate,
      items: purchaseItems.filter(i => i.name.trim())
    }
    addVendorPurchase(selectedVendor.id, payload).then(() => {
      notify('Purchase recorded.'); resetTxnForm(); fetchVendorDetail(selectedVendor.id); fetchVendors()
    }).catch(() => notify('Error recording purchase.'))
  }

  function handleVendorPayment(e) {
    e.preventDefault()
    if (!payAmount || parseFloat(payAmount) <= 0) return notify('Amount required.')
    const payload = {
      amount: parseFloat(payAmount),
      description: txnDesc,
      transaction_date: txnDate,
      payment_method: payMethod,
      upi_account: payMethod === 'upi' ? payUpiAcc : null,
      bank_transfer_type: payMethod === 'bank' ? payBankType : null
    }
    addVendorPayment(selectedVendor.id, payload).then(() => {
      notify('Payment recorded — ledger & expenses updated.')
      resetTxnForm(); fetchVendorDetail(selectedVendor.id); fetchVendors()
    }).catch(() => notify('Error recording payment.'))
  }

  function fmtDT(dateStr) {
  if (!dateStr) return '—'
  // Database se IST string aati hai "2026-06-19 12:33:15" — T laga ke parse karo
  const normalized = dateStr.replace(' ', 'T')
  const d = new Date(normalized); if (isNaN(d)) return dateStr
  const ist = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const pad = n => String(n).padStart(2, '0')
  return `${pad(ist.getHours())}:${pad(ist.getMinutes())}:${pad(ist.getSeconds())}  ${pad(ist.getDate())}.${pad(ist.getMonth()+1)}.${ist.getFullYear()}`
}

  const statusColor = s => ({ received: '#f39c12', deposited: '#3498db', cleared: '#27ae60', bounced: '#e74c3c' }[s] || '#ccc')
  const upiColor    = acc => ({ 'BOI Shop Account': '#1a237e', 'Google Pay - Rampratap Painter': '#1a73e8', 'PhonePe - Bhavya Printers': '#5f259f', 'Amazon Pay - Deepak': '#ff9900' }[acc] || '#888')

  const payMethodBadge = (t) => {
    if (t.type !== 'payment') return null
    const m = t.payment_method || 'cash'
    const label = m === 'upi'  ? `📱 ${(t.upi_account || 'UPI').split('-')[0].trim()}`
                : m === 'bank' ? `🏦 ${t.bank_transfer_type || 'NEFT'}`
                : '💵 Cash'
    const bg = m === 'upi' ? '#7c3aed' : m === 'bank' ? '#1d4ed8' : '#16a34a'
    return <span style={{ ...styles.badge, backgroundColor: bg, fontSize: '11px', marginLeft: '6px' }}>{label}</span>
  }

  return (
    <PageLock pageKey="accounts" pageTitle="Accounts">
    <div>
      <div style={styles.header}><h2>🏦 Accounts</h2></div>

      {message && <p style={styles.message} onClick={() => setMessage('')}>{message}</p>}

      {/* Month filter */}
      <div style={styles.filterRow}>
        <select style={{ ...styles.input, maxWidth: '150px' }} value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
          {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, i) => (
            <option key={m} value={m}>{new Date(2000, i).toLocaleString('en-IN', { month: 'long' })}</option>
          ))}
        </select>
        <select style={{ ...styles.input, maxWidth: '100px' }} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
          {['2024','2025','2026','2027'].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Tabs */}
      <div style={styles.tabRow}>
        {['cheques','upi','vendors','commission'].map(tab => (
        <button key={tab} style={{ ...styles.tab, ...(activeTab === tab ? styles.activeTab : {}) }} onClick={() => {
          setActiveTab(tab)
          if (tab === 'commission') fetchCommission()
        }}>
          {tab === 'cheques' ? '🧾 Cheque Register'
            : tab === 'upi' ? '📱 UPI Accounts'
            : tab === 'vendors' ? '🏪 Vendor Accounts'
            : '💸 Commission'}
        </button>
      ))}
      </div>

      {/* ─── CHEQUES TAB ─── */}
      {activeTab === 'cheques' && (
        <div>
          <div style={styles.summaryRow}>
            {chequeSummary.map(s => (
              <div key={s.status} style={{ ...styles.summaryCard, borderTop: `4px solid ${statusColor(s.status)}` }}>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: statusColor(s.status) }}>₹{s.total}</div>
                <div style={{ fontSize: '12px', color: '#888', marginTop: '4px', textTransform: 'capitalize' }}>{s.status} ({s.count})</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button style={styles.addBtn} onClick={() => setShowChequeForm(!showChequeForm)}>{showChequeForm ? 'Cancel' : '+ Add Cheque'}</button>
          </div>
          {showChequeForm && (
            <div style={styles.formBox}>
              <h3 style={{ marginBottom: '16px' }}>Record New Cheque</h3>
              <form onSubmit={handleAddCheque}>
                <div style={styles.formRow}>
                  <div style={{ flex: 1 }}><label style={styles.label}>Cheque Number</label><input style={styles.input} placeholder="e.g. 123456" value={chequeForm.cheque_number} onChange={e => setChequeForm({ ...chequeForm, cheque_number: e.target.value })} /></div>
                  <div style={{ flex: 1 }}><label style={styles.label}>Firm / Person Name *</label><input style={styles.input} placeholder="Who gave the cheque" value={chequeForm.firm_name} onChange={e => setChequeForm({ ...chequeForm, firm_name: e.target.value })} /></div>
                  <div style={{ flex: 1 }}><label style={styles.label}>Link to Customer (optional)</label>
                    <select style={styles.input} value={chequeForm.customer_id} onChange={e => setChequeForm({ ...chequeForm, customer_id: e.target.value })}>
                      <option value="">Select Customer</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.firm_name}</option>)}
                    </select>
                  </div>
                </div>
                <div style={styles.formRow}>
                  <div style={{ flex: 1 }}><label style={styles.label}>Bank Name</label><input style={styles.input} placeholder="e.g. SBI, PNB, BOI" value={chequeForm.bank_name} onChange={e => setChequeForm({ ...chequeForm, bank_name: e.target.value })} /></div>
                  <div style={{ flex: 1 }}><label style={styles.label}>Amount (₹) *</label><input style={styles.input} type="number" placeholder="0" value={chequeForm.amount} onChange={e => setChequeForm({ ...chequeForm, amount: e.target.value })} /></div>
                  <div style={{ flex: 1 }}><label style={styles.label}>Received Date</label><input style={styles.input} type="date" value={chequeForm.received_date} onChange={e => setChequeForm({ ...chequeForm, received_date: e.target.value })} /></div>
                </div>
                <div style={styles.formRow}>
                  <div style={{ flex: 2 }}><label style={styles.label}>Notes</label><input style={styles.input} placeholder="e.g. Against order #5" value={chequeForm.notes} onChange={e => setChequeForm({ ...chequeForm, notes: e.target.value })} /></div>
                </div>
                <button style={styles.submitBtn} type="submit">Save Cheque</button>
              </form>
            </div>
          )}
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1', minWidth: '300px' }}>
              {cheques.length === 0 ? <p style={{ color: '#888' }}>No cheques for this period.</p> : (
                <table style={styles.table}>
                  <thead><tr><th style={styles.th}>Date</th><th style={styles.th}>Cheque No.</th><th style={styles.th}>Firm</th><th style={styles.th}>Amount</th><th style={styles.th}>Status</th></tr></thead>
                  <tbody>
                    {cheques.map(c => (
                      <tr key={c.id} style={{ ...styles.tr, cursor: 'pointer', backgroundColor: selectedCheque?.id === c.id ? '#f0f7ff' : '#fff', borderLeft: selectedCheque?.id === c.id ? '3px solid #1a1a2e' : '3px solid transparent' }}
                        onClick={() => { setSelectedCheque(c); getCheque(c.id).then(r => { setChequeDetail(r.data); setChequeEditForm({ cheque_number: r.data.cheque_number || '', bank_name: r.data.bank_name || '', notes: r.data.notes || '', received_date: r.data.received_date || '' }) }) }}
                        onMouseEnter={e => { if (selectedCheque?.id !== c.id) e.currentTarget.style.backgroundColor = '#f9f9f9' }}
                        onMouseLeave={e => { if (selectedCheque?.id !== c.id) e.currentTarget.style.backgroundColor = '#fff' }}
                      >
                        <td style={styles.td}>{c.received_date}</td>
                        <td style={styles.td}><strong>{c.cheque_number || '—'}</strong></td>
                        <td style={styles.td}>{c.firm_name}</td>
                        <td style={styles.td}><strong>₹{c.amount}</strong></td>
                        <td style={styles.td}><span style={{ ...styles.badge, backgroundColor: statusColor(c.status) }}>{c.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {chequeDetail && (
              <div style={{ flex: '1', minWidth: '280px' }}>
                <div style={styles.formBox}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <h3>Cheque Details</h3>
                    <button onClick={() => setEditingCheque(!editingCheque)} style={{ ...styles.addBtn, padding: '6px 14px', fontSize: '13px' }}>{editingCheque ? 'Cancel Edit' : '✏️ Edit'}</button>
                  </div>
                  {!editingCheque ? (
                    <div>
                      {[['Cheque Number', chequeDetail.cheque_number || '—'],['Firm / Person', chequeDetail.firm_name],['Bank', chequeDetail.bank_name || '—'],['Amount', `₹${chequeDetail.amount}`],['Received Date', chequeDetail.received_date],['Notes', chequeDetail.notes || '—']].map(([l,v]) => (
                        <div key={l} style={styles.detailRow}><span style={styles.detailLabel}>{l}</span><span style={styles.detailValue}>{v}</span></div>
                      ))}
                      {chequeDetail.customer_firm && chequeDetail.customer_firm !== chequeDetail.firm_name && (
                        <div style={styles.detailRow}><span style={styles.detailLabel}>Linked Customer</span><span style={styles.detailValue}>{chequeDetail.customer_firm}</span></div>
                      )}
                      <div style={{ marginTop: '20px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '13px', color: '#888', fontWeight: 'bold' }}>Current Status:</span>
                        <span style={{ ...styles.badge, backgroundColor: statusColor(chequeDetail.status), fontSize: '13px', padding: '5px 14px' }}>{chequeDetail.status}</span>
                      </div>
                      <div style={{ fontSize: '13px', color: '#555', marginBottom: '10px', fontWeight: 'bold' }}>Update Status:</div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {['received','deposited','cleared','bounced'].map(s => (
                          <button key={s} onClick={() => { handleChequeStatusUpdate(chequeDetail.id, s); setChequeDetail({ ...chequeDetail, status: s }); setCheques(cheques.map(c => c.id === chequeDetail.id ? { ...c, status: s } : c)) }}
                            style={{ padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: chequeDetail.status === s ? 'bold' : 'normal', backgroundColor: chequeDetail.status === s ? statusColor(s) : '#fff', color: chequeDetail.status === s ? '#fff' : '#555', border: `1px solid ${statusColor(s)}` }}>
                            {s === 'received' ? '📬 Received' : s === 'deposited' ? '🏦 In Bank' : s === 'cleared' ? '✅ Cleared' : '❌ Bounced'}
                          </button>
                        ))}
                      </div>
                      <div style={{ marginTop: '12px', padding: '10px', backgroundColor: '#f8f8f8', borderRadius: '6px', fontSize: '12px', color: '#666' }}>
                        {chequeDetail.status === 'received' && '📬 Cheque is with you, not yet deposited.'}
                        {chequeDetail.status === 'deposited' && '🏦 Deposited in bank, waiting to clear.'}
                        {chequeDetail.status === 'cleared' && '✅ Payment received. Counted in customer dues.'}
                        {chequeDetail.status === 'bounced' && '❌ Cheque bounced. Follow up with customer.'}
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={e => { e.preventDefault(); updateCheque(chequeDetail.id, chequeEditForm).then(() => { notify('Cheque updated.'); setEditingCheque(false); getCheque(chequeDetail.id).then(r => setChequeDetail(r.data)); fetchCheques() }).catch(() => notify('Error updating cheque.')) }}>
                      {[['Cheque Number','cheque_number'],['Bank Name','bank_name'],['Notes','notes']].map(([l,k]) => (
                        <div key={k} style={{ marginBottom: '12px' }}><label style={styles.label}>{l}</label><input style={styles.input} value={chequeEditForm[k]} onChange={e => setChequeEditForm({ ...chequeEditForm, [k]: e.target.value })} /></div>
                      ))}
                      <div style={{ marginBottom: '16px' }}><label style={styles.label}>Received Date</label><input style={styles.input} type="date" value={chequeEditForm.received_date} onChange={e => setChequeEditForm({ ...chequeEditForm, received_date: e.target.value })} /></div>
                      <button style={styles.submitBtn} type="submit">Save Changes</button>
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── UPI TAB ─── */}
      {activeTab === 'upi' && (
        <div>
          <div style={styles.summaryRow}>
            {UPI_ACCOUNTS.map(acc => {
              const s = upiSummary.find(x => x.upi_account === acc)
              return (
                <div key={acc} style={{ ...styles.summaryCard, borderTop: `4px solid ${upiColor(acc)}`, cursor: 'pointer', outline: upiFilter === acc ? `2px solid ${upiColor(acc)}` : 'none' }}
                  onClick={() => { setUpiFilter(upiFilter === acc ? '' : acc); fetchUpi() }}>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: upiColor(acc) }}>₹{s ? s.total : 0}</div>
                  <div style={{ fontSize: '11px', color: '#555', marginTop: '4px' }}>{acc}</div>
                  <div style={{ fontSize: '11px', color: '#aaa' }}>{s ? s.count : 0} transactions</div>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button style={styles.addBtn} onClick={() => setShowUpiForm(!showUpiForm)}>{showUpiForm ? 'Cancel' : '+ Record UPI Payment'}</button>
          </div>
          {showUpiForm && (
            <div style={styles.formBox}>
              <h3 style={{ marginBottom: '16px' }}>Record UPI Transaction</h3>
              <form onSubmit={handleAddUpi}>
                <div style={styles.formRow}>
                  <div style={{ flex: 1 }}><label style={styles.label}>UPI Account Received In *</label><select style={styles.input} value={upiForm.upi_account} onChange={e => setUpiForm({ ...upiForm, upi_account: e.target.value })}><option value="">Select UPI Account</option>{UPI_ACCOUNTS.map(a => <option key={a} value={a}>{a}</option>)}</select></div>
                  <div style={{ flex: 1 }}><label style={styles.label}>Amount (₹) *</label><input style={styles.input} type="number" placeholder="0" value={upiForm.amount} onChange={e => setUpiForm({ ...upiForm, amount: e.target.value })} /></div>
                  <div style={{ flex: 1 }}><label style={styles.label}>Date</label><input style={styles.input} type="date" value={upiForm.transaction_date} onChange={e => setUpiForm({ ...upiForm, transaction_date: e.target.value })} /></div>
                </div>
                <div style={styles.formRow}>
                  <div style={{ flex: 1 }}><label style={styles.label}>Customer Name</label><input style={styles.input} placeholder="Who paid" value={upiForm.customer_name} onChange={e => setUpiForm({ ...upiForm, customer_name: e.target.value })} /></div>
                  <div style={{ flex: 1 }}><label style={styles.label}>Link to Customer (optional)</label><select style={styles.input} value={upiForm.customer_id} onChange={e => setUpiForm({ ...upiForm, customer_id: e.target.value })}><option value="">Select Customer</option>{customers.map(c => <option key={c.id} value={c.id}>{c.firm_name}</option>)}</select></div>
                  <div style={{ flex: 1 }}><label style={styles.label}>UTR / Reference Number</label><input style={styles.input} placeholder="e.g. 123456789012" value={upiForm.utr_number} onChange={e => setUpiForm({ ...upiForm, utr_number: e.target.value })} /></div>
                </div>
                <div style={styles.formRow}><div style={{ flex: 2 }}><label style={styles.label}>Notes</label><input style={styles.input} placeholder="e.g. Payment for flex order" value={upiForm.notes} onChange={e => setUpiForm({ ...upiForm, notes: e.target.value })} /></div></div>
                <button style={styles.submitBtn} type="submit">Save UPI Transaction</button>
              </form>
            </div>
          )}
          {upiTransactions.length === 0 ? <p style={{ color: '#888' }}>No UPI transactions for this period.</p> : (
            <table style={styles.table}>
              <thead><tr><th style={styles.th}>Date</th><th style={styles.th}>UPI Account</th><th style={styles.th}>From</th><th style={styles.th}>Amount</th><th style={styles.th}>UTR No.</th><th style={styles.th}>Notes</th><th style={styles.th}>Type</th><th style={styles.th}>Action</th></tr></thead>
              <tbody>
                {upiTransactions.map(t => (
                  <tr key={`${t.direction}-${t.id}`} style={styles.tr} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f9f9f9'} onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}>
                    <td style={styles.td}>{t.transaction_date}</td>
                    <td style={styles.td}><span style={{ ...styles.badge, backgroundColor: upiColor(t.upi_account), fontSize: '11px' }}>{t.upi_account}</span></td>
                    <td style={styles.td}>{t.customer_name || '—'}</td>
                    <td style={styles.td}><strong style={{ color: t.direction === 'debit' ? '#e74c3c' : '#27ae60' }}>{t.direction === 'debit' ? '-' : '+'}₹{Math.abs(t.amount)}</strong></td>
                    <td style={styles.td}><span style={{ fontSize: '12px', color: '#888' }}>{t.utr_number || '—'}</span></td>
                    <td style={styles.td}><span style={{ fontSize: '12px', color: '#888' }}>{t.notes || '—'}</span></td>
                    <td style={styles.td}><span style={{ ...styles.badge, backgroundColor: t.direction === 'debit' ? '#e74c3c' : '#27ae60' }}>{t.direction === 'debit' ? '↑ Paid Out' : '↓ Received'}</span></td>
                    <td style={styles.td}>
                      {t.direction === 'credit' && (
                        <button
                          onClick={() => setUpiDeleteModal({
                            type: t.source === 'cash_income' ? 'cash_income' : 'upi_income',
                            id: t.id,
                            label: `${t.customer_name || 'Unknown'} — ₹${t.amount} (${t.upi_account})`
                          })}
                          style={{
                            backgroundColor: '#fff', color: '#e74c3c', border: '1px solid #e74c3c',
                            borderRadius: '4px', padding: '3px 8px', fontSize: '11px', cursor: 'pointer'
                          }}
                          title="Delete this entry"
                        >🗑</button>
                      )}
                    </td>
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

          {/* LEFT: vendor list */}
          <div style={{ flex: '1', minWidth: '280px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0 }}>Vendors <span style={{ color: '#aaa', fontWeight: 400, fontSize: '14px' }}>({vendors.length})</span></h3>
              <button style={styles.addBtn} onClick={() => setShowAddVendor(true)}>+ Add Vendor</button>
            </div>

            {vendors.map(v => (
              <div key={v.id}
                style={{ ...styles.vendorCard, border: selectedVendor?.id === v.id ? '2px solid #1a1a2e' : '1px solid #eee' }}
                onClick={() => fetchVendorDetail(v.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>{v.name}</div>
                    <div style={{ fontSize: '12px', color: '#888' }}>{v.shop_type} • {v.city}</div>
                  </div>
                  {/* Edit / Delete buttons */}
                  <div style={{ display: 'flex', gap: '4px' }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => setEditVendorData(v)} title="Edit vendor" style={{
                      background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8',
                      borderRadius: '6px', padding: '4px 9px', fontSize: '12px', cursor: 'pointer', fontWeight: 700
                    }}>✏️</button>
                    <button onClick={() => setDeleteConfirmV(v)} title="Delete vendor" style={{
                      background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626',
                      borderRadius: '6px', padding: '4px 9px', fontSize: '12px', cursor: 'pointer', fontWeight: 700
                    }}>🗑️</button>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#27ae60' }}>Purchased: ₹{v.total_purchased}</span>
                  <span style={{ fontSize: '12px', color: '#e74c3c', fontWeight: 'bold' }}>Due: ₹{v.balance_due}</span>
                </div>
              </div>
            ))}
          </div>

          {/* RIGHT: vendor detail */}
          {vendorDetail && (
            <div style={{ flex: '2', minWidth: '300px' }}>
              <div style={styles.formBox}>
                <h3 style={{ marginBottom: '4px' }}>{vendorDetail.name}</h3>
                <p style={{ fontSize: '13px', color: '#888', marginBottom: '16px' }}>
                  {vendorDetail.shop_type} • {vendorDetail.city}{vendorDetail.phone ? ` • ${vendorDetail.phone}` : ''}
                </p>

                {/* Stats */}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
                  {[
                    { label: 'Total Purchased', val: vendorDetail.total_purchased, color: '#e74c3c' },
                    { label: 'Total Paid',       val: vendorDetail.total_paid,      color: '#27ae60' },
                    { label: 'Balance Due',      val: vendorDetail.balance_due,     color: vendorDetail.balance_due > 0 ? '#e74c3c' : '#27ae60', bg: vendorDetail.balance_due > 0 ? '#fff5f5' : '#f0fff4' }
                  ].map(({ label, val, color, bg }) => (
                    <div key={label} style={{ ...styles.vendorStat, ...(bg ? { backgroundColor: bg } : {}) }}>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color }}>₹{val}</div>
                      <div style={{ fontSize: '11px', color: '#888' }}>{label}</div>
                    </div>
                  ))}
                </div>

                {/* Transaction form */}
                <div style={{ marginBottom: '20px', backgroundColor: '#f8f8f8', padding: '16px', borderRadius: '8px' }}>
                  <h4 style={{ marginBottom: '12px' }}>Record Transaction</h4>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                    {[
                      { key: 'purchase', label: '📦 Purchase (We Bought)', color: '#e74c3c' },
                      { key: 'payment',  label: '💵 Payment (We Paid)',     color: '#27ae60' }
                    ].map(({ key, label, color }) => (
                      <button key={key} type="button" onClick={() => { setTxnType(key); resetTxnForm() }} style={{ ...styles.txnTypeBtn, backgroundColor: txnType === key ? color : '#fff', color: txnType === key ? '#fff' : color, border: `1px solid ${color}` }}>{label}</button>
                    ))}
                  </div>

                  {/* ── Purchase form ── */}
                  {txnType === 'purchase' && (
                    <form onSubmit={handleVendorPurchase}>
                      <PurchaseItemsEditor items={purchaseItems} setItems={setPurchaseItems} />
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <label style={styles.label}>Date</label>
                          <input style={styles.input} type="date" value={txnDate} onChange={e => setTxnDate(e.target.value)} />
                        </div>
                        <div style={{ flex: 2 }}>
                          <label style={styles.label}>Note (optional)</label>
                          <input style={styles.input} placeholder="Any additional note" value={txnDesc} onChange={e => setTxnDesc(e.target.value)} />
                        </div>
                      </div>
                      <button style={{ ...styles.submitBtn, backgroundColor: '#e74c3c' }} type="submit">Save Purchase</button>
                    </form>
                  )}

                  {/* ── Payment form ── */}
                  {txnType === 'payment' && (
                    <form onSubmit={handleVendorPayment}>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <label style={styles.label}>Amount (₹) *</label>
                          <input style={styles.input} type="number" placeholder="0" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={styles.label}>Date</label>
                          <input style={styles.input} type="date" value={txnDate} onChange={e => setTxnDate(e.target.value)} />
                        </div>
                      </div>
                      <PaymentMethodSelector
                        method={payMethod}   setMethod={setPayMethod}
                        upiAccount={payUpiAcc}  setUpiAccount={setPayUpiAcc}
                        bankType={payBankType}  setBankType={setPayBankType}
                      />
                      <div style={{ marginBottom: '10px' }}>
                        <label style={styles.label}>Description (optional)</label>
                        <input style={styles.input} placeholder="e.g. Paid for last month's flex order" value={txnDesc} onChange={e => setTxnDesc(e.target.value)} />
                      </div>
                      <button style={{ ...styles.submitBtn, backgroundColor: '#27ae60' }} type="submit">Save Payment</button>
                    </form>
                  )}
                </div>

                {/* Transaction history */}
                <h4 style={{ marginBottom: '10px' }}>Transaction History</h4>
                {(!vendorDetail.transactions || vendorDetail.transactions.length === 0) ? (
                  <p style={{ color: '#888', fontSize: '14px' }}>No transactions yet.</p>
                ) : (
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Date</th>
                        <th style={styles.th}>Type</th>
                        <th style={styles.th}>Amount</th>
                        <th style={styles.th}>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vendorDetail.transactions.map(t => (
                        <tr key={t.id} style={styles.tr}>
                          <td style={styles.td}>
                            <div>{t.transaction_date}</div>
                            {t.created_at && <div style={{ fontSize: '11px', color: '#aaa' }}>🕐 {fmtDT(t.created_at)}</div>}
                          </td>
                          <td style={styles.td}>
                            <div>
                              <span style={{ ...styles.badge, backgroundColor: t.type === 'purchase' ? '#e74c3c' : '#27ae60' }}>
                                {t.type === 'purchase' ? '📦 Purchase' : '💵 Payment'}
                              </span>
                              {payMethodBadge(t)}
                            </div>
                          </td>
                          <td style={styles.td}>
                            <strong style={{ color: t.type === 'purchase' ? '#e74c3c' : '#27ae60' }}>₹{t.amount}</strong>
                          </td>
                          <td style={{ ...styles.td, fontSize: '13px', color: '#555' }}>
                            {t.description && <div>{t.description}</div>}
                            {/* Items chips */}
                            {t.items && t.items.length > 0 && (
                              <div style={{ marginTop: '4px' }}>
                                {t.items.map((it, i) => (
                                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: '#f3f4f6', borderRadius: '5px', padding: '2px 7px', margin: '2px 3px 2px 0', fontSize: '12px' }}>
                                    <span>{it.name}</span>
                                    {it.qty && <span style={{ color: '#9ca3af' }}>×{it.qty}{it.unit}</span>}
                                    {it.amount && <span style={{ fontWeight: 700 }}> ₹{it.amount}</span>}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
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
      {/* ─── COMMISSION TAB ─── */}
      {activeTab === 'commission' && (
        <div>
          <div style={{ marginBottom: '16px', padding: '12px 16px', backgroundColor: '#fff3e0', borderRadius: '8px', border: '1px solid #ff9800', fontSize: '13px', color: '#e65100' }}>
            💡 Commission entries sirf <strong>Daily Sales → Add Expense → Category: Commission</strong> se add hoti hain.
            Yahan sirf history dikhti hai.
          </div>

          {commissionLoading ? (
            <p style={{ color: '#888' }}>Loading...</p>
          ) : commissionEntries.length === 0 ? (
            <p style={{ color: '#aaa' }}>Is mahine koi commission entry nahi hai.</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Date & Time</th>
                  <th style={styles.th}>Customer</th>
                  <th style={styles.th}>Amount</th>
                  <th style={styles.th}>Payment Mode</th>
                  <th style={styles.th}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {commissionEntries.map(e => (
                  <tr key={e.id} style={styles.tr}
                    onMouseEnter={ev => ev.currentTarget.style.backgroundColor = '#f9f9f9'}
                    onMouseLeave={ev => ev.currentTarget.style.backgroundColor = '#fff'}
                  >
                    <td style={styles.td}>
                      <div>{e.expense_date}</div>
                      {e.created_at && <div style={{ fontSize: '11px', color: '#aaa' }}>🕐 {fmtDT(e.created_at)}</div>}
                    </td>
                    <td style={styles.td}>
                      <strong>{e.customer_name || '—'}</strong>
                    </td>
                    <td style={styles.td}>
                      <strong style={{ color: '#e65100', fontSize: '16px' }}>₹{e.amount}</strong>
                    </td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.badge,
                        backgroundColor: e.payment_mode === 'upi' ? '#1565c0' : '#2e7d32'
                      }}>
                        {e.payment_mode === 'upi' ? `📱 ${e.upi_account || 'UPI'}` : '💵 Cash'}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={{ fontSize: '13px', color: '#666' }}>{e.description || '—'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: '#fff3e0' }}>
                  <td colSpan="2" style={{ ...styles.td, fontWeight: 'bold' }}>Total Commission</td>
                  <td style={{ ...styles.td, fontWeight: 'bold', color: '#e65100', fontSize: '16px' }}>
                    ₹{commissionEntries.reduce((s, e) => s + e.amount, 0)}
                  </td>
                  <td colSpan="2"></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}

      {/* ── UPI Entry Delete Modal ── */}
      {upiDeleteModal && (
        <Modal title="🗑 Entry Delete Karo" onClose={() => { setUpiDeleteModal(null); setUpiDeletePassword('') }}>
          <p style={{ fontSize: '13px', color: '#555', marginBottom: '4px' }}>Entry:</p>
          <div style={{ backgroundColor: '#fff5f5', border: '1px solid #fdd', borderRadius: '6px', padding: '10px 14px', fontSize: '13px', color: '#c0392b', marginBottom: '16px', fontWeight: 'bold' }}>
            {upiDeleteModal.label}
          </div>
          <p style={{ fontSize: '12px', color: '#e74c3c', marginBottom: '16px' }}>
            ⚠️ Ye entry permanently delete hogi aur sab jagah se hat jaegi. Password daalo:
          </p>
          <form onSubmit={handleUpiDelete}>
            <input
              type="password"
              placeholder="Enter password"
              value={upiDeletePassword}
              onChange={e => setUpiDeletePassword(e.target.value)}
              autoFocus
              style={{ ...styles.input, marginBottom: '16px', fontSize: '18px', letterSpacing: '4px', textAlign: 'center' }}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => { setUpiDeleteModal(null); setUpiDeletePassword('') }}
                style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #ddd', backgroundColor: '#fff', cursor: 'pointer', fontSize: '14px' }}
              >Cancel</button>
              <button
                type="submit"
                disabled={upiDeleteLoading}
                style={{ flex: 1, padding: '10px', borderRadius: '6px', border: 'none', backgroundColor: '#e74c3c', color: '#fff', cursor: upiDeleteLoading ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 'bold', opacity: upiDeleteLoading ? 0.6 : 1 }}
              >{upiDeleteLoading ? 'Deleting...' : '🗑 Delete'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Add Vendor Modal ── */}
      {showAddVendor && (
        <Modal title="Add New Vendor" onClose={() => setShowAddVendor(false)}>
          <VendorForm saving={vendorSaving} onSave={handleAddVendor} onCancel={() => setShowAddVendor(false)} />
        </Modal>
      )}

      {/* ── Edit Vendor Modal ── */}
      {editVendorData && (
        <Modal title="Edit Vendor" onClose={() => setEditVendorData(null)}>
          <VendorForm initial={editVendorData} saving={vendorSaving} onSave={handleEditVendor} onCancel={() => setEditVendorData(null)} />
        </Modal>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteConfirmV && (
        <Modal title="Delete Vendor" onClose={() => setDeleteConfirmV(null)}>
          <p style={{ color: '#374151', fontSize: '14px', marginTop: 0 }}>
            Are you sure you want to delete <strong>{deleteConfirmV.name}</strong>?<br />
            <span style={{ color: '#e74c3c', fontSize: '13px' }}>This will permanently remove all their transactions.</span>
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setDeleteConfirmV(null)} style={{ flex: 1, padding: '10px', border: '1px solid #ddd', borderRadius: '6px', background: '#fff', cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleDeleteVendor} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '6px', background: '#e74c3c', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>Yes, Delete</button>
          </div>
        </Modal>
      )}
    </div>
    </PageLock>
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
  detailRow: { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f0f0f0' },
  detailLabel: { fontSize: '12px', color: '#888', fontWeight: 'bold' },
  detailValue: { fontSize: '14px', color: '#333', textAlign: 'right' },
  vendorCard: { backgroundColor: '#fff', padding: '14px 16px', borderRadius: '8px', marginBottom: '10px', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  vendorStat: { flex: '1', minWidth: '100px', backgroundColor: '#f8f8f8', padding: '12px', borderRadius: '8px', textAlign: 'center' },
  txnTypeBtn: { padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }
}

export default Accounts
