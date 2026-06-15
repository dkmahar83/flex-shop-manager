import { useState, useEffect } from 'react'
import {
  getDailyRecords, getDailySummary, saveDailyRecord,
  getExpenses, addExpense, deleteExpense, getTodaySales
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
  const [todayData, setTodayData] = useState(null)
  const [salesAmount, setSalesAmount] = useState('')
  const [salesNote, setSalesNote] = useState('')
  const [salesDate, setSalesDate] = useState(today)

  const [expenseForm, setExpenseForm] = useState({
    category: '', amount: '', description: '', expense_date: today
  })

  const [expenses, setExpenses] = useState([])
  const [dailyRecords, setDailyRecords] = useState([])
  const [summary, setSummary] = useState(null)
  const [filterMonth, setFilterMonth] = useState(currentMonth)
  const [filterYear, setFilterYear] = useState(currentYear)

  useEffect(() => {
    fetchAll()
  }, [filterMonth, filterYear]) // eslint-disable-line react-hooks/exhaustive-deps

  function fetchAll() {
    fetchExpenses()
    fetchSummary()
    fetchDailyRecords()
    fetchTodayData()
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

  function handleSaveSales(e) {
    e.preventDefault()
    if (!salesAmount) return setMessage('Enter sales amount.')
    saveDailyRecord({
      record_date: salesDate,
      total_sales: parseFloat(salesAmount),
      notes: salesNote
    })
      .then(() => {
        setMessage(`Sales of ₹${salesAmount} saved for ${salesDate}`)
        setSalesAmount('')
        setSalesNote('')
        fetchAll()
      })
      .catch(() => setMessage('Error saving sales.'))
  }

  function handleAddExpense(e) {
    e.preventDefault()
    if (!expenseForm.category || !expenseForm.amount) {
      return setMessage('Category and amount are required.')
    }
    addExpense(expenseForm)
      .then(() => {
        setMessage(`Expense of ₹${expenseForm.amount} added.`)
        setExpenseForm({ category: '', amount: '', description: '', expense_date: today })
        fetchAll()
      })
      .catch(() => setMessage('Error adding expense.'))
  }

  function handleDeleteExpense(id) {
    if (!window.confirm('Delete this expense?')) return
    deleteExpense(id)
      .then(() => {
        setMessage('Expense deleted.')
        fetchAll()
      })
      .catch(() => setMessage('Error deleting expense.'))
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
        <p style={styles.message} onClick={() => setMessage('')}>{message}</p>
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
        {['today', 'history', 'expenses'].map(tab => (
          <button
            key={tab}
            style={{ ...styles.tab, ...(activeTab === tab ? styles.activeTab : {}) }}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'today' ? '📝 Record Entry'
              : tab === 'history' ? '📅 Daily History'
              : '🧾 Expense List'}
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
                    <div style={{ fontSize: '12px', color: '#aaa', marginTop: '8px' }}>
                      No order payments today
                    </div>
                  )}
                </div>

                {/* Manual cash */}
                <div style={styles.todayCard}>
                  <div style={styles.todayCardLabel}>💵 Other Cash (manual entry)</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3498db' }}>
                    ₹{todayData.manual_sales || 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#aaa', marginTop: '8px' }}>
                    Cash not linked to any order
                  </div>
                </div>

                {/* Total cash in */}
                <div style={{ ...styles.todayCard, backgroundColor: '#1a1a2e' }}>
                  <div style={{ ...styles.todayCardLabel, color: '#aaa' }}>Total Cash In Today</div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#fff' }}>
                    ₹{todayData.total_cash_in || 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#aaa', marginTop: '8px' }}>
                    orders + manual
                  </div>
                </div>

                {/* Expenses today */}
                <div style={{ ...styles.todayCard, backgroundColor: '#fff5f5', border: '1px solid #fdd' }}>
                  <div style={styles.todayCardLabel}>🧾 Expenses Today</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#e74c3c' }}>
                    ₹{todayData.total_expenses || 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#aaa', marginTop: '8px' }}>
                    from expense entries
                  </div>
                </div>
              </div>

              {/* UPI breakdown */}
                {todayData.upi_by_account && todayData.upi_by_account.length > 0 && (
                <div style={{ ...styles.todayCard, gridColumn: '1/-1', marginTop: '8px' }}>
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
                <div style={{ ...styles.todayCard, gridColumn: '1/-1', marginTop: '8px', backgroundColor: '#f5f0ff' }}>
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

            {/* SALES ENTRY */}
            <div style={styles.formBox}>
              <h3 style={{ marginBottom: '4px', color: '#27ae60' }}>💵 Record Other Cash</h3>
              <p style={{ fontSize: '12px', color: '#888', marginBottom: '16px' }}>
                Cash received NOT linked to any order (walk-in, misc income)
              </p>
              <form onSubmit={handleSaveSales}>
                <div style={{ marginBottom: '12px' }}>
                  <label style={styles.label}>Date</label>
                  <input
                    style={styles.input}
                    type="date"
                    value={salesDate}
                    onChange={e => setSalesDate(e.target.value)}
                  />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={styles.label}>Amount (₹)</label>
                  <input
                    style={{ ...styles.input, fontSize: '20px', fontWeight: 'bold' }}
                    type="number"
                    placeholder="e.g. 500"
                    value={salesAmount}
                    onChange={e => setSalesAmount(e.target.value)}
                  />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={styles.label}>Notes (optional)</label>
                  <input
                    style={styles.input}
                    placeholder="e.g. Walk-in customer paid cash"
                    value={salesNote}
                    onChange={e => setSalesNote(e.target.value)}
                  />
                </div>
                <button style={styles.greenBtn} type="submit">
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
                    onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })}
                  >
                    <option value="">Select Category</option>
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
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
                      <td style={{ ...styles.td, color: '#27ae60', fontWeight: 'bold' }}>
                        ₹{r.total_sales}
                      </td>
                      <td style={{ ...styles.td, color: '#e74c3c', fontWeight: 'bold' }}>
                        ₹{r.total_expenses}
                      </td>
                      <td style={{ ...styles.td, fontWeight: 'bold', color: net >= 0 ? '#1a1a2e' : '#e74c3c' }}>
                        ₹{net}
                      </td>
                      <td style={{ ...styles.td, color: '#888', fontSize: '13px' }}>
                        {r.notes || '—'}
                      </td>
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
                      <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{exp.category}</div>
                      {exp.description && (
                        <div style={{ fontSize: '12px', color: '#888' }}>{exp.description}</div>
                      )}
                    </div>
                    <div style={{ fontWeight: 'bold', color: '#e74c3c', fontSize: '16px', marginRight: '16px' }}>
                      ₹{exp.amount}
                    </div>
                    <button onClick={() => handleDeleteExpense(exp.id)} style={styles.deleteBtn}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ))
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
  greenBtn: { backgroundColor: '#27ae60', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '6px', cursor: 'pointer', fontSize: '15px', width: '100%' },
  redBtn: { backgroundColor: '#e74c3c', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '6px', cursor: 'pointer', fontSize: '15px', width: '100%' },
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