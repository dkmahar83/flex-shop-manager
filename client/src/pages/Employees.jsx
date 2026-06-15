import { useState, useEffect } from 'react'
import { getEmployees, createEmployee, markAttendance, getSalary, getAttendance } from '../services/api'

function Employees() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [message, setMessage] = useState('')
  const [activeTab, setActiveTab] = useState('list')
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [salaryData, setSalaryData] = useState(null)
  const [attendanceCalendar, setAttendanceCalendar] = useState([])

  const [form, setForm] = useState({
    name: '', phone: '', monthly_salary: '', join_date: ''
  })

  const today = new Date().toISOString().split('T')[0]
  const [attendanceDate, setAttendanceDate] = useState(today)
  const [attendanceRecords, setAttendanceRecords] = useState({})

  const [salaryMonth, setSalaryMonth] = useState(
    String(new Date().getMonth() + 1).padStart(2, '0')
  )
  const [salaryYear, setSalaryYear] = useState(
    String(new Date().getFullYear())
  )
  const [calendarEmployee, setCalendarEmployee] = useState(null)
  const [calendarMonth, setCalendarMonth] = useState(
    String(new Date().getMonth() + 1).padStart(2, '0')
  )
  const [calendarYear, setCalendarYear] = useState(
    String(new Date().getFullYear())
  )

  useEffect(() => {
    fetchEmployees()
  }, [])

  function fetchEmployees() {
    setLoading(true)
    getEmployees()
      .then(res => {
        setEmployees(res.data)
        const initial = {}
        res.data.forEach(e => { initial[e.id] = 'present' })
        setAttendanceRecords(initial)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  function handleFormChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  function handleAddEmployee(e) {
    e.preventDefault()
    if (!form.name) return setMessage('Name is required.')
    createEmployee(form)
      .then(() => {
        setMessage('Employee added successfully!')
        setForm({ name: '', phone: '', monthly_salary: '', join_date: '' })
        setShowForm(false)
        fetchEmployees()
      })
      .catch(() => setMessage('Error adding employee.'))
  }

  function handleAttendanceChange(employeeId, status) {
    setAttendanceRecords({ ...attendanceRecords, [employeeId]: status })
  }

  function handleSubmitAttendance() {
    const records = Object.entries(attendanceRecords).map(([emp_id, status]) => ({
      employee_id: parseInt(emp_id), status
    }))
    markAttendance({ date: attendanceDate, records })
      .then(() => {
        setMessage(`Attendance marked for ${attendanceDate}`)
        // Refresh calendar if open
        if (calendarEmployee) {
          fetchCalendar(calendarEmployee.id, calendarMonth, calendarYear)
        }
      })
      .catch(() => setMessage('Error marking attendance.'))
  }

  function handleViewSalary(employee) {
    setSelectedEmployee(employee)
    setActiveTab('salary')
    fetchSalary(employee.id, salaryMonth, salaryYear)
  }

  function fetchSalary(empId, month, year) {
    getSalary(empId, month, year)
      .then(res => setSalaryData(res.data))
      .catch(() => setMessage('Error fetching salary.'))
  }

  function handleSalaryFilter() {
    if (selectedEmployee) fetchSalary(selectedEmployee.id, salaryMonth, salaryYear)
  }

  function fetchCalendar(empId, month, year) {
    getAttendance(empId, month, year)
      .then(res => setAttendanceCalendar(res.data))
      .catch(() => setMessage('Error loading calendar.'))
  }

  function handleCalendarLoad() {
    if (!calendarEmployee) return setMessage('Select an employee first.')
    fetchCalendar(calendarEmployee.id, calendarMonth, calendarYear)
  }

  // Build calendar grid for a given month/year
  function buildCalendar(month, year) {
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate()
    const firstDay = new Date(parseInt(year), parseInt(month) - 1, 1).getDay()
    return { daysInMonth, firstDay }
  }

  // Get attendance status for a specific day
  function getDayStatus(day) {
    const dateStr = `${calendarYear}-${calendarMonth}-${String(day).padStart(2, '0')}`
    const record = attendanceCalendar.find(r => r.date === dateStr)
    return record ? record.status : null
  }

  const { daysInMonth, firstDay } = buildCalendar(calendarMonth, calendarYear)

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div>
      <div style={styles.header}>
        <h2>Employees</h2>
        <button style={styles.addBtn} onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Employee'}
        </button>
      </div>

      {message && (
        <p style={styles.message} onClick={() => setMessage('')}>{message}</p>
      )}

      {showForm && (
        <div style={styles.formBox}>
          <h3 style={{ marginBottom: '16px' }}>New Employee</h3>
          <form onSubmit={handleAddEmployee}>
            <div style={styles.formRow}>
              <input style={styles.input} placeholder="Full Name *" name="name" value={form.name} onChange={handleFormChange} />
              <input style={styles.input} placeholder="Phone Number" name="phone" value={form.phone} onChange={handleFormChange} />
              <input style={styles.input} placeholder="Monthly Salary (₹)" name="monthly_salary" type="number" value={form.monthly_salary} onChange={handleFormChange} />
              <div style={{ flex: 1 }}>
                <label style={styles.label}>Joining Date</label>
                <input style={styles.input} type="date" name="join_date" value={form.join_date} onChange={handleFormChange} />
              </div>
            </div>
            <button style={styles.submitBtn} type="submit">Save Employee</button>
          </form>
        </div>
      )}

      {/* TABS */}
      <div style={styles.tabRow}>
        {['list', 'attendance', 'calendar', 'salary'].map(tab => (
          <button
            key={tab}
            style={{ ...styles.tab, ...(activeTab === tab ? styles.activeTab : {}) }}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'list' ? '👥 Employees'
              : tab === 'attendance' ? '📅 Mark Attendance'
              : tab === 'calendar' ? '🗓️ Calendar'
              : '💰 Salary'}
          </button>
        ))}
      </div>

      {/* TAB: LIST */}
      {activeTab === 'list' && (
        loading ? <p>Loading...</p> : employees.length === 0 ? (
          <p style={{ color: '#888' }}>No employees found.</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>#</th>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Phone</th>
                <th style={styles.th}>Monthly Salary</th>
                <th style={styles.th}>Per Day</th>
                <th style={styles.th}>Joining Date</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp, index) => (
                <tr key={emp.id} style={styles.tr}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
                >
                  <td style={styles.td}>{index + 1}</td>
                  <td style={styles.td}><strong>{emp.name}</strong></td>
                  <td style={styles.td}>{emp.phone || '—'}</td>
                  <td style={styles.td}>₹{emp.monthly_salary}</td>
                  <td style={styles.td}>₹{Math.round(emp.monthly_salary / 30)}</td>
                  <td style={styles.td}>{emp.join_date || '—'}</td>
                  <td style={styles.td}>
                    <button onClick={() => handleViewSalary(emp)} style={styles.salaryBtn}>
                      💰 Salary
                    </button>
                    <button
                      onClick={() => {
                        setCalendarEmployee(emp)
                        setActiveTab('calendar')
                        fetchCalendar(emp.id, calendarMonth, calendarYear)
                      }}
                      style={{ ...styles.salaryBtn, marginLeft: '6px', color: '#3498db', borderColor: '#3498db' }}
                    >
                      🗓️ Calendar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}

      {/* TAB: MARK ATTENDANCE */}
      {activeTab === 'attendance' && (
        <div style={styles.section}>
          <div style={styles.attendanceHeader}>
            <h3>Mark Attendance</h3>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <input
                style={{ ...styles.input, width: '180px', flex: 'none' }}
                type="date"
                value={attendanceDate}
                onChange={e => setAttendanceDate(e.target.value)}
              />
              <button style={styles.submitBtn} onClick={handleSubmitAttendance}>
                Save Attendance
              </button>
            </div>
          </div>

          {employees.length === 0 ? <p style={{ color: '#888' }}>No employees.</p> : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>#</th>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Salary/Day</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp, index) => (
                  <tr key={emp.id} style={styles.tr}>
                    <td style={styles.td}>{index + 1}</td>
                    <td style={styles.td}><strong>{emp.name}</strong></td>
                    <td style={styles.td}>₹{Math.round(emp.monthly_salary / 30)}</td>
                    <td style={styles.td}>
                      <div style={styles.statusBtns}>
                        {['present', 'absent', 'half_day'].map(s => (
                          <button key={s}
                            onClick={() => handleAttendanceChange(emp.id, s)}
                            style={{
                              ...styles.statusBtn,
                              backgroundColor: attendanceRecords[emp.id] === s ? attendanceColor(s) : '#fff',
                              color: attendanceRecords[emp.id] === s ? '#fff' : '#555',
                              border: `1px solid ${attendanceColor(s)}`
                            }}
                          >
                            {s === 'present' ? '✅ Present' : s === 'absent' ? '❌ Absent' : '½ Half Day'}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* TAB: CALENDAR */}
      {activeTab === 'calendar' && (
        <div style={styles.section}>
          <h3 style={{ marginBottom: '16px' }}>🗓️ Attendance Calendar</h3>

          {/* Filters */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={styles.label}>Employee</label>
              <select
                style={{ ...styles.input, minWidth: '180px' }}
                value={calendarEmployee?.id || ''}
                onChange={e => {
                  const emp = employees.find(em => em.id === parseInt(e.target.value))
                  setCalendarEmployee(emp)
                  setAttendanceCalendar([])
                }}
              >
                <option value="">Select Employee</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={styles.label}>Month</label>
              <select style={{ ...styles.input, minWidth: '130px' }} value={calendarMonth} onChange={e => setCalendarMonth(e.target.value)}>
                {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, i) => (
                  <option key={m} value={m}>{new Date(2000, i).toLocaleString('en-IN', { month: 'long' })}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={styles.label}>Year</label>
              <select style={{ ...styles.input, minWidth: '100px' }} value={calendarYear} onChange={e => setCalendarYear(e.target.value)}>
                {['2024', '2025', '2026', '2027'].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <button style={styles.submitBtn} onClick={handleCalendarLoad}>Load Calendar</button>
          </div>

          {calendarEmployee && (
            <>
              {/* Legend */}
              <div style={styles.legend}>
                <span style={styles.legendItem}><span style={{ ...styles.legendDot, backgroundColor: '#27ae60' }}></span> Present</span>
                <span style={styles.legendItem}><span style={{ ...styles.legendDot, backgroundColor: '#e74c3c' }}></span> Absent</span>
                <span style={styles.legendItem}><span style={{ ...styles.legendDot, backgroundColor: '#f39c12' }}></span> Half Day</span>
                <span style={styles.legendItem}><span style={{ ...styles.legendDot, backgroundColor: '#ecf0f1' }}></span> Not Marked</span>
              </div>

              {/* Calendar Grid */}
              <div style={styles.calendarBox}>
                <h4 style={{ marginBottom: '12px', textAlign: 'center', color: '#1a1a2e' }}>
                  {calendarEmployee.name} — {new Date(2000, parseInt(calendarMonth) - 1).toLocaleString('en-IN', { month: 'long' })} {calendarYear}
                </h4>

                {/* Day labels */}
                <div style={styles.calendarGrid}>
                  {dayLabels.map(d => (
                    <div key={d} style={styles.dayLabel}>{d}</div>
                  ))}

                  {/* Empty cells before first day */}
                  {Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`empty-${i}`} style={styles.emptyCell}></div>
                  ))}

                  {/* Day cells */}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1
                    const status = getDayStatus(day)
                    return (
                      <div key={day} style={{
                        ...styles.dayCell,
                        backgroundColor: status === 'present' ? '#27ae60'
                          : status === 'absent' ? '#e74c3c'
                          : status === 'half_day' ? '#f39c12'
                          : '#ecf0f1',
                        color: status ? '#fff' : '#888'
                      }}>
                        <div style={styles.dayNumber}>{day}</div>
                        {status && (
                          <div style={styles.dayStatus}>
                            {status === 'present' ? '✓' : status === 'absent' ? '✗' : '½'}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Monthly Summary */}
                {attendanceCalendar.length > 0 && (
                  <div style={styles.calendarSummary}>
                    <div style={styles.summaryItem}>
                      <span style={{ color: '#27ae60', fontWeight: 'bold', fontSize: '20px' }}>
                        {attendanceCalendar.filter(r => r.status === 'present').length}
                      </span>
                      <span style={styles.summaryLabel}>Present</span>
                    </div>
                    <div style={styles.summaryItem}>
                      <span style={{ color: '#e74c3c', fontWeight: 'bold', fontSize: '20px' }}>
                        {attendanceCalendar.filter(r => r.status === 'absent').length}
                      </span>
                      <span style={styles.summaryLabel}>Absent</span>
                    </div>
                    <div style={styles.summaryItem}>
                      <span style={{ color: '#f39c12', fontWeight: 'bold', fontSize: '20px' }}>
                        {attendanceCalendar.filter(r => r.status === 'half_day').length}
                      </span>
                      <span style={styles.summaryLabel}>Half Day</span>
                    </div>
                    <div style={styles.summaryItem}>
                      <span style={{ color: '#1a1a2e', fontWeight: 'bold', fontSize: '20px' }}>
                        {attendanceCalendar.length}
                      </span>
                      <span style={styles.summaryLabel}>Total Marked</span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB: SALARY */}
      {activeTab === 'salary' && (
        <div style={styles.section}>
          <h3 style={{ marginBottom: '16px' }}>Salary Calculator</h3>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={styles.label}>Employee</label>
              <select
                style={{ ...styles.input, minWidth: '200px' }}
                value={selectedEmployee?.id || ''}
                onChange={e => {
                  const emp = employees.find(em => em.id === parseInt(e.target.value))
                  setSelectedEmployee(emp)
                  setSalaryData(null)
                }}
              >
                <option value="">Select Employee</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={styles.label}>Month</label>
              <select style={{ ...styles.input, minWidth: '130px' }} value={salaryMonth} onChange={e => setSalaryMonth(e.target.value)}>
                {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, i) => (
                  <option key={m} value={m}>{new Date(2000, i).toLocaleString('en-IN', { month: 'long' })}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={styles.label}>Year</label>
              <select style={{ ...styles.input, minWidth: '100px' }} value={salaryYear} onChange={e => setSalaryYear(e.target.value)}>
                {['2024', '2025', '2026', '2027'].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <button style={styles.submitBtn} onClick={handleSalaryFilter}>Calculate</button>
          </div>

          {salaryData && (
            <div style={styles.salaryCard}>
              <h3 style={{ marginBottom: '16px', color: '#1a1a2e' }}>
                {salaryData.employee_name} — {new Date(2000, parseInt(salaryMonth) - 1).toLocaleString('en-IN', { month: 'long' })} {salaryYear}
              </h3>
              <div style={styles.salaryGrid}>
                <div style={styles.salaryItem}>
                  <div style={styles.salaryLabel}>Monthly Salary</div>
                  <div style={styles.salaryValue}>₹{salaryData.monthly_salary}</div>
                </div>
                <div style={styles.salaryItem}>
                  <div style={styles.salaryLabel}>Per Day Rate</div>
                  <div style={styles.salaryValue}>₹{salaryData.per_day_salary}</div>
                </div>
                <div style={styles.salaryItem}>
                  <div style={styles.salaryLabel}>Days Present</div>
                  <div style={{ ...styles.salaryValue, color: '#27ae60' }}>{salaryData.present_days}</div>
                </div>
                <div style={styles.salaryItem}>
                  <div style={styles.salaryLabel}>Half Days</div>
                  <div style={{ ...styles.salaryValue, color: '#f39c12' }}>{salaryData.half_days}</div>
                </div>
                <div style={styles.salaryItem}>
                  <div style={styles.salaryLabel}>Days Absent</div>
                  <div style={{ ...styles.salaryValue, color: '#e74c3c' }}>{salaryData.absent_days}</div>
                </div>
                <div style={styles.salaryItem}>
                  <div style={styles.salaryLabel}>Deduction</div>
                  <div style={{ ...styles.salaryValue, color: '#e74c3c' }}>- ₹{salaryData.deduction}</div>
                </div>
              </div>
              <div style={styles.salaryTotal}>
                <span>Payable Salary</span>
                <strong style={{ fontSize: '24px', color: '#27ae60' }}>₹{salaryData.calculated_salary}</strong>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function attendanceColor(status) {
  return status === 'present' ? '#27ae60' : status === 'absent' ? '#e74c3c' : '#f39c12'
}

const styles = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  addBtn: { backgroundColor: '#e94560', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' },
  message: { backgroundColor: '#e8f5e9', color: '#2e7d32', padding: '10px 16px', borderRadius: '6px', marginBottom: '16px', cursor: 'pointer' },
  formBox: { backgroundColor: '#fff', padding: '20px', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  formRow: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' },
  input: { padding: '10px 14px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', flex: '1', minWidth: '150px', boxSizing: 'border-box' },
  label: { fontSize: '12px', color: '#888', display: 'block', marginBottom: '4px' },
  submitBtn: { backgroundColor: '#1a1a2e', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' },
  tabRow: { display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' },
  tab: { padding: '10px 20px', borderRadius: '8px', border: '1px solid #ddd', backgroundColor: '#fff', cursor: 'pointer', fontSize: '14px' },
  activeTab: { backgroundColor: '#1a1a2e', color: '#fff', border: '1px solid #1a1a2e' },
  section: { backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  attendanceHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' },
  table: { width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  th: { padding: '12px 16px', textAlign: 'left', backgroundColor: '#f8f8f8', fontSize: '13px', color: '#555', borderBottom: '1px solid #eee' },
  td: { padding: '12px 16px', fontSize: '14px', borderBottom: '1px solid #f0f0f0' },
  tr: { backgroundColor: '#fff' },
  statusBtns: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  statusBtn: { padding: '6px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' },
  salaryBtn: { backgroundColor: '#fff', color: '#27ae60', border: '1px solid #27ae60', padding: '5px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' },
  legend: { display: 'flex', gap: '20px', marginBottom: '16px', flexWrap: 'wrap' },
  legendItem: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' },
  legendDot: { width: '14px', height: '14px', borderRadius: '3px', display: 'inline-block' },
  calendarBox: { backgroundColor: '#f8f8f8', padding: '20px', borderRadius: '12px' },
  calendarGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', marginBottom: '16px' },
  dayLabel: { textAlign: 'center', fontSize: '12px', fontWeight: 'bold', color: '#888', padding: '8px 0' },
  emptyCell: { height: '60px' },
  dayCell: { height: '60px', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'default', transition: 'transform 0.1s' },
  dayNumber: { fontSize: '14px', fontWeight: 'bold' },
  dayStatus: { fontSize: '16px', marginTop: '2px' },
  calendarSummary: { display: 'flex', justifyContent: 'space-around', backgroundColor: '#fff', padding: '16px', borderRadius: '8px', flexWrap: 'wrap', gap: '12px' },
  summaryItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' },
  summaryLabel: { fontSize: '12px', color: '#888' },
  salaryCard: { backgroundColor: '#f8f8f8', padding: '24px', borderRadius: '12px' },
  salaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' },
  salaryItem: { backgroundColor: '#fff', padding: '16px', borderRadius: '8px', textAlign: 'center' },
  salaryLabel: { fontSize: '12px', color: '#888', marginBottom: '6px' },
  salaryValue: { fontSize: '20px', fontWeight: 'bold', color: '#1a1a2e' },
  salaryTotal: { backgroundColor: '#fff', padding: '20px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '18px' }
}

export default Employees