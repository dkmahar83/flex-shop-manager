import { useState, useEffect } from 'react'
import {
  getDailyRecords, getDailySummary,
  getExpenses, addExpense, deleteExpense, getTodaySales,
  saveCashIncome, getCustomers , getDailyLedger, getVendors, getEmployees
} from '../services/api'

const CATEGORIES = [
  'Raw Material (Pipe/Flex)',
  'Employee Advance',
  'Tea / Refreshments',
  'Petrol / Transport',
  'Electricity Bill',
  'Vendor Payment',
  'Ink Purchase',
  'Rent',
  'Miscellaneous'
]

function DailySales() {
  const today = new Date().toISOString().split('T')[0]
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0')
  const currentYear = String(new Date().getFullYear())

  const [activeTab, setActiveTab] = useState('today')
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('success')
  const [todayData, setTodayData] = useState(null)
  const [ledgerRows, setLedgerRows] = useState([])

  // Cash income form
  const [cashForm, setCashForm] = useState({
  customer_id: '',
  amount: '',
  income_date: today,
  notes: '',
  payment_mode: 'cash',
  upi_account: ''
})
  const [customers, setCustomers] = useState([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState(null)

  const [expenseForm, setExpenseForm] = useState({
  category: '',
  amount: '',
  description: '',
  expense_date: today,
  payment_mode: 'cash',
  upi_account: ''
})

  const [expenses, setExpenses] = useState([])
  const [dailyRecords, setDailyRecords] = useState([])
  const [summary, setSummary] = useState(null)
  const [filterMonth, setFilterMonth] = useState(currentMonth)
  const [filterYear, setFilterYear] = useState(currentYear)
  const [vendors, setVendors] = useState([])
  const [employees, setEmployees] = useState([])

  useEffect(() => {
    fetchAll()
    fetchCustomers()
    getVendors().then(res => setVendors(res.data)).catch(() => {})
    getEmployees().then(res => setEmployees(res.data)).catch(() => {})
  }, [filterMonth, filterYear]) // eslint-disable-line react-hooks/exhaustive-deps

  function showMsg(text, type = 'success') {
    setMessage(text)
    setMessageType(type)
  }
  
  function fetchAll() {
    fetchExpenses()
    fetchSummary()
    fetchDailyRecords()
    fetchTodayData()
    fetchLedger()
  }

  function fetchLedger() {
    getDailyLedger(filterMonth, filterYear)
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : []
        setLedgerRows(data)
      })
      .catch(() => setLedgerRows([]))
  }
  function fetchCustomers() {
    getCustomers()
      .then(res => setCustomers(res.data))
      .catch(() => {})
  }

  function fetchTodayData() {
    getTodaySales()
      .then(res => setTodayData(res.data))
      .catch(() => {})
  }

  function fetchExpenses() {
    getExpenses(filterMonth, filterYear)
      .then(res => setExpenses(res.data))
      .catch(() => {})
  }

  function fetchDailyRecords() {
    getDailyRecords(filterMonth, filterYear)
      .then(res => setDailyRecords(res.data))
      .catch(() => {})
  }

  function fetchSummary() {
    getDailySummary(filterMonth, filterYear)
      .then(res => setSummary(res.data))
      .catch(() => {})
  }

  // Customer search filter
  const filteredCustomers = customers.filter(c =>
    c.firm_name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.contact_name || '').toLowerCase().includes(customerSearch.toLowerCase())
  )

  function handleSelectCustomer(c) {
    setSelectedCustomer(c)
    setCashForm(f => ({ ...f, customer_id: c.id }))
    setCustomerSearch(c.firm_name)
    setShowDropdown(false)
  }

  function handleSaveCashIncome(e) {
    e.preventDefault()
    if (!cashForm.customer_id) return showMsg('Please select a customer.', 'error')
    if ( cashForm.payment_mode === 'upi' && !cashForm.upi_account )
      return showMsg('Please select UPI account.', 'error')
    if (!cashForm.amount || isNaN(cashForm.amount) || Number(cashForm.amount) <= 0)
      return showMsg('Enter a valid amount.', 'error')

    saveCashIncome(cashForm)
      .then(() => {
        showMsg(`₹${cashForm.amount} cash income saved for ${selectedCustomer?.firm_name}`)
        setCashForm({ customer_id: '', amount: '', income_date: today, notes: '' })
        setSelectedCustomer(null)
        setCustomerSearch('')
        fetchAll()
      })
      .catch(() => showMsg('Error saving cash income.', 'error'))
  }

  function handleAddExpense(e) {
    e.preventDefault()
    if (!expenseForm.category || !expenseForm.amount)
  return showMsg('Category and amount are required.', 'error')

if (
  expenseForm.payment_mode === 'upi' &&
  !expenseForm.upi_account
)
  return showMsg('Please select UPI account.', 'error')

if (expenseForm.category === 'Vendor Payment' && !expenseForm.paid_to_id)
  return showMsg('Please select a vendor.', 'error')
if (expenseForm.category === 'Employee Advance' && !expenseForm.paid_to_id)
  return showMsg('Please select an employee.', 'error')

    addExpense(expenseForm)
      .then(() => {
        showMsg(`Expense of ₹${expenseForm.amount} added.`)
        setExpenseForm({
          category: '',
          amount: '',
          description: '',
          expense_date: today,
          payment_mode: 'cash',
          upi_account: '',
          paid_to_type: '', paid_to_id: ''
        })
        fetchAll()
      })
      .catch(() => showMsg('Error adding expense.', 'error'))
  }

  function handleDeleteExpense(id) {
    if (!window.confirm('Delete this expense?')) return
    deleteExpense(id)
      .then(() => { showMsg('Expense deleted.'); fetchAll() })
      .catch(() => showMsg('Error deleting expense.', 'error'))
  }

  const groupedExpenses = expenses.reduce((groups, exp) => {
    const date = exp.expense_date
    if (!groups[date]) groups[date] = []
    groups[date].push(exp)
    return groups
  }, {})

  return (
    <div>
      <div style={styles.header}>
        <h2>💰 Daily Sales & Expenses</h2>
      </div>

      {message && (
        <p
          style={{ ...styles.message, ...(messageType === 'error' ? styles.messageError : {}) }}
          onClick={() => setMessage('')}
        >
          {message}
        </p>
      )}

      {/* MONTH FILTER */}
      <div style={styles.filterRow}>
        <select
          style={{ ...styles.input, maxWidth: '150px' }}
          value={filterMonth}
          onChange={e => setFilterMonth(e.target.value)}
        >
          {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, i) => (
            <option key={m} value={m}>
              {new Date(2000, i).toLocaleString('en-IN', { month: 'long' })}
            </option>
          ))}
        </select>
        <select
          style={{ ...styles.input, maxWidth: '100px' }}
          value={filterYear}
          onChange={e => setFilterYear(e.target.value)}
        >
          {['2024', '2025', '2026', '2027'].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* MONTHLY SUMMARY CARDS */}
      {summary && (
        <div style={styles.summaryRow}>
          <div style={styles.summaryCard}>
            <div style={{ ...styles.summaryNum, color: '#27ae60' }}>₹{summary.total_sales || 0}</div>
            <div style={styles.summaryLabel}>Total Sales</div>
            <div style={{ fontSize: '11px', color: '#aaa', marginTop: '4px' }}>
              incl. ₹{summary.payments_total || 0} from orders
            </div>
          </div>
          <div style={styles.summaryCard}>
            <div style={{ ...styles.summaryNum, color: '#e74c3c' }}>₹{summary.total_expenses || 0}</div>
            <div style={styles.summaryLabel}>Total Expenses</div>
          </div>
          <div style={styles.summaryCard}>
            <div style={{ ...styles.summaryNum, color: (summary.net_profit || 0) >= 0 ? '#1a1a2e' : '#e74c3c' }}>
              ₹{summary.net_profit || 0}
            </div>
            <div style={styles.summaryLabel}>Net Profit</div>
          </div>
          <div style={styles.summaryCard}>
            <div style={styles.summaryNum}>{summary.days_recorded || 0}</div>
            <div style={styles.summaryLabel}>Days Recorded</div>
          </div>
        </div>
      )}

      {/* TABS */}
      <div style={styles.tabRow}>
        {['today', 'history', 'expenses', 'ledger'].map(tab => (
          <button
            key={tab}
            style={{ ...styles.tab, ...(activeTab === tab ? styles.activeTab : {}) }}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'today' ? '📝 Record Entry'
            : tab === 'history' ? '📅 Daily History'
            : tab === 'expenses' ? '🧾 Expense List'
            : '📒 Daily Ledger'}
          </button>
        ))}
      </div>

      {/* TAB: RECORD ENTRY */}
      {activeTab === 'today' && (
        <div>
          {/* TODAY'S SUMMARY BOX */}
          {todayData && (
            <div style={styles.todayBox}>
              <h3 style={{ marginBottom: '16px' }}>
                📊 Today's Summary — {new Date(today).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h3>
              <div style={styles.todayRow}>

                {/* Payments from orders */}
                <div style={styles.todayCard}>
                  <div style={styles.todayCardLabel}>💳 Payments from Orders</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#27ae60' }}>
                    ₹{todayData.payments_total || 0}
                  </div>
                  {todayData.payments_received && todayData.payments_received.length > 0 ? (
                    <div style={{ marginTop: '10px' }}>
                      {todayData.payments_received.map(p => (
                        <div key={p.id} style={styles.paymentLine}>
                          <span style={{ color: '#555' }}>{p.firm_name}</span>
                          <span style={{ fontWeight: 'bold', color: '#27ae60' }}>₹{p.amount}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: '#aaa', marginTop: '8px' }}>No order payments today</div>
                  )}
                </div>

                {/* Cash income today */}
                <div style={styles.todayCard}>
                  <div style={styles.todayCardLabel}>💵 Other Cash Received</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3498db' }}>
                    ₹{todayData.cash_income_total || 0}
                  </div>
                  {todayData.cash_income_today && todayData.cash_income_today.length > 0 ? (
                    <div style={{ marginTop: '10px' }}>
                      {todayData.cash_income_today.map(c => (
                        <div key={c.id} style={styles.paymentLine}>
                          <span style={{ color: '#555' }}>{c.firm_name}</span>
                          <span style={{ fontWeight: 'bold', color: '#3498db' }}>₹{c.amount}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: '#aaa', marginTop: '8px' }}>No cash income today</div>
                  )}
                </div>

                {/* Total cash in */}
                <div style={{ ...styles.todayCard, backgroundColor: '#1a1a2e' }}>
                  <div style={{ ...styles.todayCardLabel, color: '#aaa' }}>Total Cash In Today</div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#fff' }}>
                    ₹{todayData.total_cash_in || 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#aaa', marginTop: '8px' }}>
                    orders + cash income + UPI
                  </div>
                </div>

                {/* Expenses today */}
                <div style={{ ...styles.todayCard, backgroundColor: '#fff5f5', border: '1px solid #fdd' }}>
                  <div style={styles.todayCardLabel}>🧾 Expenses Today</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#e74c3c' }}>
                    ₹{todayData.total_expenses || 0}
                  </div>
                </div>
              </div>

              {/* UPI breakdown */}
              {todayData.upi_by_account && todayData.upi_by_account.length > 0 && (
                <div style={{ ...styles.todayCard, marginTop: '8px' }}>
                  <div style={styles.todayCardLabel}>📱 UPI Received Today — ₹{todayData.upi_total}</div>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '8px' }}>
                    {todayData.upi_by_account.map(u => (
                      <div key={u.upi_account} style={{ backgroundColor: '#fff', padding: '10px 14px', borderRadius: '6px', minWidth: '160px' }}>
                        <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#27ae60' }}>₹{u.total}</div>
                        <div style={{ fontSize: '11px', color: '#555' }}>{u.upi_account}</div>
                        <div style={{ fontSize: '11px', color: '#aaa' }}>{u.count} transaction(s)</div>
                      </div>
                    ))}
                  </div>
                  {todayData.upi_detail && todayData.upi_detail.length > 0 && (
                    <div style={{ marginTop: '10px' }}>
                      {todayData.upi_detail.map(t => (
                        <div key={t.id} style={styles.paymentLine}>
                          <span>{t.customer_name || t.customer_firm || 'Unknown'} → {t.upi_account}</span>
                          <span style={{ fontWeight: 'bold', color: '#27ae60' }}>₹{t.amount}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Cheques received today */}
              {todayData.cheques_today && todayData.cheques_today.length > 0 && (
                <div style={{ ...styles.todayCard, marginTop: '8px', backgroundColor: '#f5f0ff' }}>
                  <div style={styles.todayCardLabel}>🧾 Cheques Received Today — ₹{todayData.cheque_total}</div>
                  {todayData.cheques_today.map(c => (
                    <div key={c.id} style={{ ...styles.paymentLine, marginTop: '6px' }}>
                      <span>{c.firm_name} • {c.bank_name || 'Unknown Bank'} • #{c.cheque_number || 'No number'}</span>
                      <span style={{ fontWeight: 'bold', color: '#8e44ad' }}>₹{c.amount}</span>
                    </div>
                  ))}
                  <div style={{ fontSize: '11px', color: '#888', marginTop: '6px' }}>
                    Note: Cheque amounts are NOT counted in cash total until cleared
                  </div>
                </div>
              )}

              {/* Net today */}
              <div style={styles.netToday}>
                <span style={{ fontSize: '16px', color: '#555' }}>Net Today (Cash In - Expenses):</span>
                <strong style={{
                  fontSize: '22px',
                  color: ((todayData.total_cash_in || 0) - (todayData.total_expenses || 0)) >= 0
                    ? '#27ae60' : '#e74c3c'
                }}>
                  ₹{(todayData.total_cash_in || 0) - (todayData.total_expenses || 0)}
                </strong>
              </div>
            </div>
          )}

          {/* FORMS ROW */}
          <div style={styles.twoCol}>

            {/* CASH INCOME ENTRY — mandatory customer */}
            <div style={styles.formBox}>
              <h3 style={{ marginBottom: '4px', color: '#27ae60' }}>💵 Record Other Payment</h3>
              <p style={{ fontSize: '12px', color: '#888', marginBottom: '16px' }}>
                Cash received from a customer — not linked to a specific order
              </p>
              <form onSubmit={handleSaveCashIncome}>

                {/* Customer selector */}
                <div style={{ marginBottom: '12px', position: 'relative' }}>
                  <label style={styles.label}>Customer *</label>
                  <input
                    style={{
                      ...styles.input,
                      borderColor: !selectedCustomer && customerSearch ? '#e74c3c' : '#ddd'
                    }}
                    type="text"
                    placeholder="Search customer name..."
                    value={customerSearch}
                    onChange={e => {
                      setCustomerSearch(e.target.value)
                      setShowDropdown(true)
                      if (selectedCustomer && e.target.value !== selectedCustomer.firm_name) {
                        setSelectedCustomer(null)
                        setCashForm(f => ({ ...f, customer_id: '' }))
                      }
                    }}
                    onFocus={() => setShowDropdown(true)}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                    autoComplete="off"
                  />
                  {showDropdown && filteredCustomers.length > 0 && (
                    <div style={styles.dropdown}>
                      {filteredCustomers.map(c => (
                        <div
                          key={c.id}
                          style={styles.dropdownItem}
                          onMouseDown={() => handleSelectCustomer(c)}
                        >
                          <span style={{ fontWeight: 'bold' }}>{c.firm_name}</span>
                          {c.contact_name && (
                            <span style={{ fontSize: '12px', color: '#888', marginLeft: '8px' }}>
                              {c.contact_name}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedCustomer && (
                    <div style={styles.selectedCustomerBadge}>
                      ✅ {selectedCustomer.firm_name}
                      {selectedCustomer.phone && (
                        <span style={{ color: '#888', fontSize: '11px', marginLeft: '8px' }}>
                          📞 {selectedCustomer.phone}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={styles.label}>Date</label>
                  <input
                    style={styles.input}
                    type="date"
                    value={cashForm.income_date}
                    onChange={e => setCashForm(f => ({ ...f, income_date: e.target.value }))}
                  />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={styles.label}>Payment Mode *</label>

                  <select
                    style={styles.input}
                    value={cashForm.payment_mode}
                    onChange={e =>
                      setCashForm({
                        ...cashForm,
                        payment_mode: e.target.value,
                        upi_account:
                          e.target.value === 'cash'
                            ? ''
                            : cashForm.upi_account
                      })
                    }
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                  </select>
                </div>

                {cashForm.payment_mode === 'upi' && (
                  <div style={{ marginBottom: '12px' }}>
                    <label style={styles.label}>UPI Account *</label>

                    <select
                      style={styles.input}
                      value={cashForm.upi_account}
                      onChange={e =>
                        setCashForm({
                          ...cashForm,
                          upi_account: e.target.value
                        })
                      }
                    >
                      <option value="">Select UPI Account</option>
                      <option value="BOI Shop Account">
                        BOI Shop Account
                      </option>
                      <option value="Google Pay - Rampratap Painter">
                        Google Pay - Rampratap Painter
                      </option>
                      <option value="PhonePe - Bhavya Printers">
                        PhonePe - Bhavya Printers
                      </option>
                      <option value="Amazon Pay - Deepak">
                        Amazon Pay - Deepak
                      </option>
                    </select>
                  </div>
                )}
                  
                <div style={{ marginBottom: '12px' }}>
                  <label style={styles.label}>Amount (₹) *</label>
                  <input
                    style={{ ...styles.input, fontSize: '20px', fontWeight: 'bold' }}
                    type="number"
                    placeholder="e.g. 500"
                    value={cashForm.amount}
                    onChange={e => setCashForm(f => ({ ...f, amount: e.target.value }))}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={styles.label}>Notes (optional)</label>
                  <input
                    style={styles.input}
                    placeholder="e.g. Partial payment for banner"
                    value={cashForm.notes}
                    onChange={e => setCashForm(f => ({ ...f, notes: e.target.value }))}
                  />
                </div>

                <button
                  style={{
                    ...styles.greenBtn,
                    opacity: !selectedCustomer ? 0.6 : 1,
                    cursor: !selectedCustomer ? 'not-allowed' : 'pointer'
                  }}
                  type="submit"
                >
                  Save Entry
                </button>
              </form>
            </div>

            {/* EXPENSE ENTRY */}
            <div style={styles.formBox}>
              <h3 style={{ marginBottom: '4px', color: '#e74c3c' }}>🧾 Add Expense</h3>
              <p style={{ fontSize: '12px', color: '#888', marginBottom: '16px' }}>
                Record any cash going out of shop today
              </p>
              <form onSubmit={handleAddExpense}>
                <div style={{ marginBottom: '12px' }}>
                  <label style={styles.label}>Date</label>
                  <input
                    style={styles.input}
                    type="date"
                    value={expenseForm.expense_date}
                    onChange={e => setExpenseForm({ ...expenseForm, expense_date: e.target.value })}
                  />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={styles.label}>Category *</label>
                  <select
                    style={styles.input}
                    value={expenseForm.category}
                    onChange={e => {
                      const cat = e.target.value
                      const paid_to_type = cat === 'Vendor Payment' ? 'vendor'
                        : cat === 'Employee Advance' ? 'employee' : ''
                      setExpenseForm({ ...expenseForm, category: cat, paid_to_type, paid_to_id: '' })
                    }}
                  >
                    <option value="">Select Category</option>
                    {expenseForm.category === 'Vendor Payment' && (
                    <div style={{ marginBottom: '12px' }}>
                      <label style={styles.label}>Vendor *</label>
                      <select style={styles.input} value={expenseForm.paid_to_id}
                        onChange={e => setExpenseForm({ ...expenseForm, paid_to_id: e.target.value })}>
                        <option value="">Select Vendor</option>
                        {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                      </select>
                    </div>
                  )}

                  {expenseForm.category === 'Employee Advance' && (
                    <div style={{ marginBottom: '12px' }}>
                      <label style={styles.label}>Employee *</label>
                      <select style={styles.input} value={expenseForm.paid_to_id}
                        onChange={e => setExpenseForm({ ...expenseForm, paid_to_id: e.target.value })}>
                        <option value="">Select Employee</option>
                        {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                      </select>
                    </div>
                  )}
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div style={{ marginBottom: '12px' }}>
                <label style={styles.label}>Payment Mode *</label>

                <select
                  style={styles.input}
                  value={expenseForm.payment_mode}
                  onChange={e =>
                    setExpenseForm({
                      ...expenseForm,
                      payment_mode: e.target.value,
                      upi_account:
                        e.target.value === 'cash'
                          ? ''
                          : expenseForm.upi_account
                    })
                  }
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                </select>
              </div>

              {expenseForm.payment_mode === 'upi' && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={styles.label}>UPI Account *</label>

                  <select
                    style={styles.input}
                    value={expenseForm.upi_account}
                    onChange={e =>
                      setExpenseForm({
                        ...expenseForm,
                        upi_account: e.target.value
                      })
                    }
                  >
                    <option value="">Select UPI Account</option>
                    <option value="BOI Shop Account">
                      BOI Shop Account
                    </option>
                    <option value="Google Pay - Rampratap Painter">
                      Google Pay - Rampratap Painter
                    </option>
                    <option value="PhonePe - Bhavya Printers">
                      PhonePe - Bhavya Printers
                    </option>
                    <option value="Amazon Pay - Deepak">
                      Amazon Pay - Deepak
                    </option>
                  </select>
                </div>
              )}
                <div style={{ marginBottom: '12px' }}>
                  <label style={styles.label}>Amount (₹) *</label>
                  <input
                    style={{ ...styles.input, fontSize: '18px' }}
                    type="number"
                    placeholder="e.g. 500"
                    value={expenseForm.amount}
                    onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={styles.label}>Description</label>
                  <input
                    style={styles.input}
                    placeholder="e.g. Suresh advance, 2 pipes bought"
                    value={expenseForm.description}
                    onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  />
                </div>
                <button style={styles.redBtn} type="submit">
                  Add Expense
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* TAB: DAILY HISTORY */}
      {activeTab === 'history' && (
        <div>
          {dailyRecords.length === 0 ? (
            <p style={{ color: '#888' }}>No records for this month.</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Sales</th>
                  <th style={styles.th}>Expenses</th>
                  <th style={styles.th}>Net</th>
                  <th style={styles.th}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {dailyRecords.map(r => {
                  const net = r.total_sales - r.total_expenses
                  return (
                    <tr key={r.id} style={styles.tr}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
                    >
                      <td style={styles.td}>
                        <strong>
                          {new Date(r.record_date).toLocaleDateString('en-IN', {
                            weekday: 'short', day: 'numeric', month: 'short'
                          })}
                        </strong>
                      </td>
                      <td style={{ ...styles.td, color: '#27ae60', fontWeight: 'bold' }}>₹{r.total_sales}</td>
                      <td style={{ ...styles.td, color: '#e74c3c', fontWeight: 'bold' }}>₹{r.total_expenses}</td>
                      <td style={{ ...styles.td, fontWeight: 'bold', color: net >= 0 ? '#1a1a2e' : '#e74c3c' }}>₹{net}</td>
                      <td style={{ ...styles.td, color: '#888', fontSize: '13px' }}>{r.notes || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* TAB: EXPENSE LIST */}
      {activeTab === 'expenses' && (
        <div>
          {Object.keys(groupedExpenses).length === 0 ? (
            <p style={{ color: '#888' }}>No expenses for this month.</p>
          ) : (
            Object.entries(groupedExpenses).map(([date, exps]) => (
              <div key={date} style={styles.expenseGroup}>
                <div style={styles.expenseDateHeader}>
                  <span>
                    {new Date(date).toLocaleDateString('en-IN', {
                      weekday: 'long', day: 'numeric', month: 'long'
                    })}
                  </span>
                  <span style={{ color: '#e74c3c', fontWeight: 'bold' }}>
                    Total: ₹{exps.reduce((s, e) => s + e.amount, 0)}
                  </span>
                </div>
                {exps.map(exp => (
                  <div key={exp.id} style={styles.expenseRow}>
                    <div style={styles.expenseCategoryDot(exp.category)} />
                    <div style={{ flex: 1 }}>
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                          {exp.category}
                        </div>

                        {exp.paid_to_name && (
                          <div style={{
                            fontSize: '12px',
                            color: '#555',
                            marginTop: '2px'
                          }}>
                            {exp.paid_to_type === 'employee'
                              ? `👤 ${exp.paid_to_name}`
                              : `🏪 ${exp.paid_to_name}`}
                          </div>
                        )}

                        <div style={{
                          fontSize: '11px',
                          color: '#888',
                          marginTop: '3px'
                        }}>
                          {exp.payment_mode === 'upi'
                            ? `📱 UPI • ${exp.upi_account || 'Unknown'}`
                            : '💵 Cash'}
                        </div>

                        {exp.description && (
                          <div style={{
                            fontSize: '12px',
                            color: '#888',
                            marginTop: '4px'
                          }}>
                            {exp.description}
                          </div>
                        )}
                      </div>
                      {exp.description && (
                        <div style={{ fontSize: '12px', color: '#888' }}>{exp.description}</div>
                      )}
                    </div>
                    <div style={{ fontWeight: 'bold', color: '#e74c3c', fontSize: '16px', marginRight: '16px' }}>
                      ₹{exp.amount}
                    </div>
                    <button onClick={() => handleDeleteExpense(exp.id)} style={styles.deleteBtn}>✕</button>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}
      {/* TAB: DAILY LEDGER */}
        {activeTab === 'ledger' && (
    <div>
      {ledgerRows.length === 0 ? (
        <p style={{ color: '#888' }}>No ledger entries for this month.</p>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Date</th>
              <th style={styles.th}>Type</th>
              <th style={styles.th}>Party</th>
              <th style={styles.th}>Mode</th>
              <th style={styles.th}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {ledgerRows.map((row, i) => (
              <tr key={i} style={styles.tr}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
              >
                <td style={styles.td}>
                  {new Date(row.date).toLocaleDateString('en-IN', {
                    weekday: 'short', day: 'numeric', month: 'short'
                  })}
                </td>
                <td style={styles.td}>
                  <span style={{
                    padding: '3px 10px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    backgroundColor:
                      row.type === 'Expense' ? '#fff0f0'
                      : row.type === 'Order Payment' ? '#f0fff4'
                      : '#f0f4ff',
                    color:
                      row.type === 'Expense' ? '#e74c3c'
                      : row.type === 'Order Payment' ? '#27ae60'
                      : '#3498db'
                  }}>
                    {row.type}
                  </span>
                </td>
                <td style={styles.td}>{row.party_name || '—'}</td>
                <td style={styles.td}>
                  {row.payment_mode === 'upi' ? '📱 UPI' : '💵 Cash'}
                </td>
                <td style={{
                  ...styles.td,
                  fontWeight: 'bold',
                  color: Number(row.amount) < 0 ? '#e74c3c' : '#27ae60',
                  fontSize: '15px'
                }}>
                  {Number(row.amount) < 0  ? `- ₹${Math.abs(Number(row.amount))}`  : `₹${Number(row.amount)}`}
                </td>
              </tr>
            ))}
          </tbody>

          {/* Running total footer */}
          <tfoot>
            <tr style={{ backgroundColor: '#f8f8f8' }}>
              <td colSpan={4} style={{ ...styles.td, fontWeight: 'bold' }}>
                Net Total
              </td>
              <td style={{
                ...styles.td,
                fontWeight: 'bold',
                fontSize: '16px',
                color: ledgerRows.reduce((s, r) => s + Number(r.amount), 0) >= 0
                  ? '#27ae60' : '#e74c3c'
              }}>
                ₹{ledgerRows.reduce((s, r) => s + Number(r.amount), 0)}
              </td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  )}
    </div>
  )
}

const categoryColors = {
  'Raw Material (Pipe/Flex)': '#8e44ad',
  'Employee Advance': '#2980b9',
  'Tea / Refreshments': '#e67e22',
  'Petrol / Transport': '#16a085',
  'Electricity Bill': '#f39c12',
  'Vendor Payment': '#c0392b',
  'Ink Purchase': '#1a1a2e',
  'Rent': '#7f8c8d',
  'Miscellaneous': '#95a5a6'
}

const styles = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  message: { backgroundColor: '#e8f5e9', color: '#2e7d32', padding: '10px 16px', borderRadius: '6px', marginBottom: '16px', cursor: 'pointer' },
  messageError: { backgroundColor: '#fff3f3', color: '#c0392b' },
  filterRow: { display: 'flex', gap: '12px', marginBottom: '20px' },
  summaryRow: { display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' },
  summaryCard: { backgroundColor: '#fff', padding: '20px 28px', borderRadius: '8px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', flex: '1', minWidth: '140px' },
  summaryNum: { fontSize: '26px', fontWeight: 'bold', marginBottom: '4px' },
  summaryLabel: { fontSize: '12px', color: '#888' },
  tabRow: { display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' },
  tab: { padding: '10px 20px', borderRadius: '8px', border: '1px solid #ddd', backgroundColor: '#fff', cursor: 'pointer', fontSize: '14px' },
  activeTab: { backgroundColor: '#1a1a2e', color: '#fff', border: '1px solid #1a1a2e' },
  todayBox: { backgroundColor: '#fff', padding: '20px', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  todayRow: { display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' },
  todayCard: { flex: '1', minWidth: '180px', backgroundColor: '#f8f8f8', padding: '16px', borderRadius: '8px' },
  todayCardLabel: { fontSize: '12px', color: '#888', marginBottom: '8px', fontWeight: 'bold' },
  paymentLine: { display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '5px 0', borderBottom: '1px solid #eee' },
  netToday: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0fff4', padding: '16px', borderRadius: '8px', border: '1px solid #d4edda' },
  twoCol: { display: 'flex', gap: '20px', flexWrap: 'wrap' },
  formBox: { backgroundColor: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', flex: '1', minWidth: '280px' },
  input: { width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', boxSizing: 'border-box' },
  label: { fontSize: '12px', color: '#888', display: 'block', marginBottom: '6px' },
  greenBtn: { backgroundColor: '#27ae60', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '6px', fontSize: '15px', width: '100%' },
  redBtn: { backgroundColor: '#e74c3c', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '6px', cursor: 'pointer', fontSize: '15px', width: '100%' },
  dropdown: { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 100, maxHeight: '200px', overflowY: 'auto' },
  dropdownItem: { padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0', fontSize: '14px' },
  selectedCustomerBadge: { marginTop: '8px', padding: '8px 12px', backgroundColor: '#e8f5e9', borderRadius: '6px', fontSize: '13px', color: '#27ae60', fontWeight: 'bold', border: '1px solid #c3e6cb' },
  table: { width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  th: { padding: '12px 16px', textAlign: 'left', backgroundColor: '#f8f8f8', fontSize: '13px', color: '#555', borderBottom: '1px solid #eee' },
  td: { padding: '12px 16px', fontSize: '14px', borderBottom: '1px solid #f0f0f0' },
  tr: { backgroundColor: '#fff' },
  expenseGroup: { backgroundColor: '#fff', borderRadius: '8px', marginBottom: '16px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  expenseDateHeader: { display: 'flex', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: '#f8f8f8', fontSize: '14px', fontWeight: 'bold', borderBottom: '1px solid #eee' },
  expenseRow: { display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #f0f0f0', gap: '12px' },
  expenseCategoryDot: (category) => ({
    width: '12px', height: '12px', borderRadius: '50%',
    backgroundColor: categoryColors[category] || '#95a5a6',
    flexShrink: 0
  }),
  deleteBtn: { backgroundColor: '#fff', color: '#e74c3c', border: '1px solid #e74c3c', width: '28px', height: '28px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }
}

export default DailySales
