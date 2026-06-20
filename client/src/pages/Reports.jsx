import { useState } from 'react'
import PageLock from '../components/PageLock'
import { getMonthlyReport, getYearlyReport } from '../services/api'

function Reports() {
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0')
  const currentYear = String(new Date().getFullYear())

  const [activeTab, setActiveTab] = useState('monthly')
  const [filterMonth, setFilterMonth] = useState(currentMonth)
  const [filterYear, setFilterYear] = useState(currentYear)
  const [report, setReport] = useState(null)
  const [yearlyReport, setYearlyReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  function loadMonthlyReport() {
    setLoading(true)
    setReport(null)
    getMonthlyReport(filterMonth, filterYear)
      .then(res => { setReport(res.data); setLoading(false) })
      .catch(() => { setMessage('Error loading report.'); setLoading(false) })
  }

  function loadYearlyReport() {
    setLoading(true)
    setYearlyReport(null)
    getYearlyReport(filterYear)
      .then(res => { setYearlyReport(res.data); setLoading(false) })
      .catch(() => { setMessage('Error loading report.'); setLoading(false) })
  }

  const monthName = (m) => new Date(2000, parseInt(m) - 1)
    .toLocaleString('en-IN', { month: 'long' })

  return (
  <PageLock pageKey="reports" pageTitle="Reports">
  <div>
    <div style={styles.header}>
        <h2>📊 Reports</h2>
      </div>

      {message && (
        <p style={styles.message} onClick={() => setMessage('')}>{message}</p>
      )}

      {/* TABS */}
      <div style={styles.tabRow}>
        {[
          { key: 'monthly', label: '📅 Monthly P&L' },
          { key: 'yearly', label: '📆 Yearly Summary' },
          { key: 'dues', label: '⚠️ All Dues' }
        ].map(t => (
          <button key={t.key}
            style={{ ...styles.tab, ...(activeTab === t.key ? styles.activeTab : {}) }}
            onClick={() => setActiveTab(t.key)}
          >{t.label}</button>
        ))}
      </div>

      {/* ── MONTHLY P&L ── */}
      {activeTab === 'monthly' && (
        <div>
          {/* Filter */}
          <div style={styles.filterRow}>
            <select style={{ ...styles.input, maxWidth: '150px' }}
              value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
              {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, i) => (
                <option key={m} value={m}>
                  {new Date(2000, i).toLocaleString('en-IN', { month: 'long' })}
                </option>
              ))}
            </select>
            <select style={{ ...styles.input, maxWidth: '100px' }}
              value={filterYear} onChange={e => setFilterYear(e.target.value)}>
              {['2024', '2025', '2026', '2027'].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button style={styles.loadBtn} onClick={loadMonthlyReport}>
              Load Report
            </button>
          </div>

          {loading && <p style={{ color: '#888' }}>Loading...</p>}

          {report && (
            <div>
              <h3 style={{ marginBottom: '20px', color: '#1a1a2e' }}>
                {monthName(report.month)} {report.year} — P&L Report
              </h3>

              {/* Summary cards */}
              <div style={styles.cardsRow}>
                <div style={{ ...styles.card, borderTop: '4px solid #27ae60' }}>
                  <div style={{ ...styles.cardNum, color: '#27ae60' }}>
                    ₹{report.income.total}
                  </div>
                  <div style={styles.cardLabel}>Total Income</div>
                  <div style={styles.cardSub}>
                    Orders: ₹{report.income.order_payments}<br />
                    Cash: ₹{report.income.cash_income}<br />
                    UPI: ₹{report.income.upi_income}
                  </div>
                </div>
                <div style={{ ...styles.card, borderTop: '4px solid #e74c3c' }}>
                  <div style={{ ...styles.cardNum, color: '#e74c3c' }}>
                    ₹{report.expenses.total}
                  </div>
                  <div style={styles.cardLabel}>Total Expenses</div>
                  <div style={styles.cardSub}>
                    {report.expenses.by_category.length} categories
                  </div>
                </div>
                <div style={{
                  ...styles.card,
                  borderTop: `4px solid ${report.net_profit >= 0 ? '#1a1a2e' : '#e74c3c'}`
                }}>
                  <div style={{
                    ...styles.cardNum,
                    color: report.net_profit >= 0 ? '#1a1a2e' : '#e74c3c'
                  }}>
                    ₹{report.net_profit}
                  </div>
                  <div style={styles.cardLabel}>Net Profit</div>
                  <div style={styles.cardSub}>
                    {report.net_profit >= 0 ? '✅ Profitable' : '❌ Loss'}
                  </div>
                </div>
                <div style={{ ...styles.card, borderTop: '4px solid #e74c3c' }}>
                  <div style={{ ...styles.cardNum, color: '#e74c3c' }}>
                    ₹{report.dues.total_outstanding}
                  </div>
                  <div style={styles.cardLabel}>Total Outstanding Dues</div>
                  <div style={styles.cardSub}>
                    {report.dues.list.length} orders pending
                  </div>
                </div>
              </div>

              {/* Expense breakdown */}
              <div style={styles.section}>
                <h4 style={styles.sectionTitle}>🧾 Expense Breakdown</h4>
                {report.expenses.by_category.length === 0 ? (
                  <p style={{ color: '#888' }}>No expenses this month.</p>
                ) : (
                  <div>
                    {report.expenses.by_category.map(cat => {
                      const pct = report.expenses.total > 0
                        ? Math.round((cat.total / report.expenses.total) * 100) : 0
                      return (
                        <div key={cat.category} style={styles.categoryRow}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                              {cat.category}
                            </div>
                            <div style={{ fontSize: '12px', color: '#888' }}>
                              {cat.count} transaction(s)
                            </div>
                          </div>
                          <div style={{ width: '200px' }}>
                            <div style={styles.progressBg}>
                              <div style={{
                                ...styles.progressBar,
                                width: `${pct}%`
                              }} />
                            </div>
                          </div>
                          <div style={{ minWidth: '60px', textAlign: 'right', color: '#888', fontSize: '13px' }}>
                            {pct}%
                          </div>
                          <div style={{ minWidth: '80px', textAlign: 'right', fontWeight: 'bold', color: '#e74c3c' }}>
                            ₹{cat.total}
                          </div>
                        </div>
                      )
                    })}
                    <div style={{ ...styles.categoryRow, backgroundColor: '#f8f8f8', borderRadius: '6px', marginTop: '8px' }}>
                      <div style={{ flex: 1, fontWeight: 'bold' }}>Total</div>
                      <div style={{ width: '200px' }}></div>
                      <div style={{ minWidth: '60px' }}></div>
                      <div style={{ minWidth: '80px', textAlign: 'right', fontWeight: 'bold', color: '#e74c3c', fontSize: '16px' }}>
                        ₹{report.expenses.total}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Dues list */}
              {report.dues.list.length > 0 && (
                <div style={styles.section}>
                  <h4 style={styles.sectionTitle}>⚠️ Pending Dues</h4>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Firm</th>
                        <th style={styles.th}>Phone</th>
                        <th style={styles.th}>Description</th>
                        <th style={styles.th}>Total</th>
                        <th style={styles.th}>Due</th>
                        <th style={styles.th}>Follow-up</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.dues.list.map(d => (
                        <tr key={d.id} style={styles.tr}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
                        >
                          <td style={styles.td}><strong>{d.firm_name}</strong></td>
                          <td style={styles.td}>{d.phone || '—'}</td>
                          <td style={{ ...styles.td, fontSize: '13px', color: '#555' }}>
                            {d.description || '—'}
                          </td>
                          <td style={styles.td}>₹{d.total_amount}</td>
                          <td style={styles.td}>
                            <strong style={{ color: '#e74c3c' }}>₹{d.balance_due}</strong>
                          </td>
                          <td style={styles.td}>
                            {d.follow_up_date ? (
                              <span style={{
                                color: d.follow_up_date <= new Date().toISOString().split('T')[0]
                                  ? '#e74c3c' : '#333',
                                fontWeight: d.follow_up_date <= new Date().toISOString().split('T')[0]
                                  ? 'bold' : 'normal'
                              }}>
                                {d.follow_up_date}
                                {d.follow_up_date <= new Date().toISOString().split('T')[0] &&
                                  ' ⚠️'}
                              </span>
                            ) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {!report && !loading && (
            <div style={styles.emptyState}>
              <p>Select a month and year, then click "Load Report"</p>
            </div>
          )}
        </div>
      )}

      {/* ── YEARLY SUMMARY ── */}
      {activeTab === 'yearly' && (
        <div>
          <div style={styles.filterRow}>
            <select style={{ ...styles.input, maxWidth: '100px' }}
              value={filterYear} onChange={e => setFilterYear(e.target.value)}>
              {['2024', '2025', '2026', '2027'].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button style={styles.loadBtn} onClick={loadYearlyReport}>
              Load Yearly Report
            </button>
          </div>

          {loading && <p style={{ color: '#888' }}>Loading...</p>}

          {yearlyReport && (
            <div>
              <h3 style={{ marginBottom: '20px' }}>
                {yearlyReport.year} — Yearly Summary
              </h3>

              {/* Year totals */}
              <div style={styles.cardsRow}>
                <div style={{ ...styles.card, borderTop: '4px solid #27ae60' }}>
                  <div style={{ ...styles.cardNum, color: '#27ae60' }}>
                    ₹{yearlyReport.total_income}
                  </div>
                  <div style={styles.cardLabel}>Total Income {yearlyReport.year}</div>
                </div>
                <div style={{ ...styles.card, borderTop: '4px solid #e74c3c' }}>
                  <div style={{ ...styles.cardNum, color: '#e74c3c' }}>
                    ₹{yearlyReport.total_expenses}
                  </div>
                  <div style={styles.cardLabel}>Total Expenses {yearlyReport.year}</div>
                </div>
                <div style={{
                  ...styles.card,
                  borderTop: `4px solid ${yearlyReport.net_profit >= 0 ? '#1a1a2e' : '#e74c3c'}`
                }}>
                  <div style={{
                    ...styles.cardNum,
                    color: yearlyReport.net_profit >= 0 ? '#1a1a2e' : '#e74c3c'
                  }}>
                    ₹{yearlyReport.net_profit}
                  </div>
                  <div style={styles.cardLabel}>Net Profit {yearlyReport.year}</div>
                </div>
              </div>

              {/* Monthly table */}
              <div style={styles.section}>
                <h4 style={styles.sectionTitle}>Month-wise Breakdown</h4>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Month</th>
                      <th style={styles.th}>Income</th>
                      <th style={styles.th}>Expenses</th>
                      <th style={styles.th}>Net Profit</th>
                      <th style={styles.th}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearlyReport.monthly_summary.map(m => (
                      <tr key={m.month} style={styles.tr}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
                      >
                        <td style={{ ...styles.td, fontWeight: 'bold' }}>{m.month_name}</td>
                        <td style={{ ...styles.td, color: '#27ae60', fontWeight: 'bold' }}>
                          {m.income > 0 ? `₹${m.income}` : '—'}
                        </td>
                        <td style={{ ...styles.td, color: '#e74c3c' }}>
                          {m.expenses > 0 ? `₹${m.expenses}` : '—'}
                        </td>
                        <td style={{
                          ...styles.td, fontWeight: 'bold',
                          color: m.net >= 0 ? '#1a1a2e' : '#e74c3c'
                        }}>
                          {m.income > 0 || m.expenses > 0 ? `₹${m.net}` : '—'}
                        </td>
                        <td style={styles.td}>
                          {m.income === 0 && m.expenses === 0 ? (
                            <span style={{ color: '#ccc', fontSize: '12px' }}>No data</span>
                          ) : m.net >= 0 ? (
                            <span style={{ color: '#27ae60', fontSize: '12px' }}>✅ Profit</span>
                          ) : (
                            <span style={{ color: '#e74c3c', fontSize: '12px' }}>❌ Loss</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: '#f8f8f8' }}>
                      <td style={{ ...styles.td, fontWeight: 'bold' }}>Total</td>
                      <td style={{ ...styles.td, fontWeight: 'bold', color: '#27ae60' }}>
                        ₹{yearlyReport.total_income}
                      </td>
                      <td style={{ ...styles.td, fontWeight: 'bold', color: '#e74c3c' }}>
                        ₹{yearlyReport.total_expenses}
                      </td>
                      <td style={{
                        ...styles.td, fontWeight: 'bold', fontSize: '16px',
                        color: yearlyReport.net_profit >= 0 ? '#1a1a2e' : '#e74c3c'
                      }}>
                        ₹{yearlyReport.net_profit}
                      </td>
                      <td style={styles.td}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {!yearlyReport && !loading && (
            <div style={styles.emptyState}>
              <p>Select a year and click "Load Yearly Report"</p>
            </div>
          )}
        </div>
      )}

      {/* ── ALL DUES ── */}
      {activeTab === 'dues' && <DuesTab />}
    </div>
  </PageLock>
  )
}

function DuesTab() {
  const [dues, setDues] = useState([])
  const [loading, setLoading] = useState(true)
  const [totalDue, setTotalDue] = useState(0)

  useState(() => {
    import('../services/api').then(({ getDues }) => {
      getDues()
        .then(res => {
          setDues(res.data)
          setTotalDue(res.data.reduce((s, d) => s + d.balance_due, 0))
          setLoading(false)
        })
        .catch(() => setLoading(false))
    })
  })

  if (loading) return <p style={{ color: '#888' }}>Loading dues...</p>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3>All Pending Dues</h3>
        <div style={{ backgroundColor: '#fff', padding: '12px 20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <span style={{ color: '#888', fontSize: '13px' }}>Total Outstanding: </span>
          <strong style={{ color: '#e74c3c', fontSize: '18px' }}>₹{totalDue}</strong>
        </div>
      </div>

      {dues.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#27ae60' }}>
          <p style={{ fontSize: '20px' }}>✅ No pending dues!</p>
          <p style={{ fontSize: '14px', color: '#888', marginTop: '8px' }}>
            All customers are up to date.
          </p>
        </div>
      ) : (
        <table style={tableStyles.table}>
          <thead>
            <tr>
              <th style={tableStyles.th}>#</th>
              <th style={tableStyles.th}>Firm</th>
              <th style={tableStyles.th}>Phone</th>
              <th style={tableStyles.th}>Description</th>
              <th style={tableStyles.th}>Total</th>
              <th style={tableStyles.th}>Balance Due</th>
              <th style={tableStyles.th}>Follow-up</th>
              <th style={tableStyles.th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {dues.map((d, i) => (
              <tr key={d.order_id} style={tableStyles.tr}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
              >
                <td style={tableStyles.td}>{i + 1}</td>
                <td style={tableStyles.td}><strong>{d.firm_name}</strong></td>
                <td style={tableStyles.td}>{d.phone || '—'}</td>
                <td style={{ ...tableStyles.td, fontSize: '13px', color: '#555' }}>
                  {d.description || '—'}
                </td>
                <td style={tableStyles.td}>₹{d.total_amount}</td>
                <td style={tableStyles.td}>
                  <strong style={{ color: '#e74c3c', fontSize: '16px' }}>
                    ₹{d.balance_due}
                  </strong>
                </td>
                <td style={tableStyles.td}>
                  {d.follow_up_date ? (
                    <span style={{
                      color: d.follow_up_date <= new Date().toISOString().split('T')[0]
                        ? '#e74c3c' : '#333',
                      fontWeight: 'bold'
                    }}>
                      {d.follow_up_date}
                      {d.follow_up_date <= new Date().toISOString().split('T')[0] && ' ⚠️'}
                    </span>
                  ) : '—'}
                </td>
                <td style={tableStyles.td}>
                  <span style={{
                    padding: '3px 10px', borderRadius: '12px', color: '#fff',
                    fontSize: '12px', backgroundColor:
                      d.status === 'pending' ? '#f39c12' :
                      d.status === 'in_progress' ? '#3498db' :
                      d.status === 'ready' ? '#27ae60' : '#95a5a6'
                  }}>
                    {d.status?.replace('_', ' ')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

const tableStyles = {
  table: { width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  th: { padding: '12px 16px', textAlign: 'left', backgroundColor: '#f8f8f8', fontSize: '13px', color: '#555', borderBottom: '1px solid #eee' },
  td: { padding: '12px 16px', fontSize: '14px', borderBottom: '1px solid #f0f0f0' },
  tr: { backgroundColor: '#fff' }
}

const styles = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  message: { backgroundColor: '#e8f5e9', color: '#2e7d32', padding: '10px 16px', borderRadius: '6px', marginBottom: '16px', cursor: 'pointer' },
  tabRow: { display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' },
  tab: { padding: '10px 20px', borderRadius: '8px', border: '1px solid #ddd', backgroundColor: '#fff', cursor: 'pointer', fontSize: '14px' },
  activeTab: { backgroundColor: '#1a1a2e', color: '#fff', border: '1px solid #1a1a2e' },
  filterRow: { display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'flex-end', flexWrap: 'wrap' },
  input: { padding: '10px 14px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', boxSizing: 'border-box' },
  loadBtn: { backgroundColor: '#1a1a2e', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' },
  cardsRow: { display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' },
  card: { flex: '1', minWidth: '180px', backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  cardNum: { fontSize: '26px', fontWeight: 'bold', marginBottom: '4px' },
  cardLabel: { fontSize: '13px', color: '#888', marginBottom: '8px' },
  cardSub: { fontSize: '12px', color: '#aaa', lineHeight: '1.6' },
  section: { backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '20px' },
  sectionTitle: { marginBottom: '16px', fontSize: '16px', color: '#1a1a2e' },
  categoryRow: { display: 'flex', alignItems: 'center', gap: '16px', padding: '10px 0', borderBottom: '1px solid #f0f0f0' },
  progressBg: { height: '8px', backgroundColor: '#f0f0f0', borderRadius: '4px', overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: '#e74c3c', borderRadius: '4px', transition: 'width 0.3s' },
  table: { width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  th: { padding: '12px 16px', textAlign: 'left', backgroundColor: '#f8f8f8', fontSize: '13px', color: '#555', borderBottom: '1px solid #eee' },
  td: { padding: '12px 16px', fontSize: '14px', borderBottom: '1px solid #f0f0f0' },
  tr: { backgroundColor: '#fff' },
  emptyState: { textAlign: 'center', padding: '60px', color: '#888', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }
}

export default Reports