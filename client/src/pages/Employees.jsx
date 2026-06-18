import { useState, useEffect } from 'react'
import {
  getEmployees, createEmployee, markAttendance,
  getSalary, getAttendance, getEmployeeProfile
} from '../services/api'

function Employees() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [message, setMessage] = useState('')
  const [activeTab, setActiveTab] = useState('list')
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [salaryData, setSalaryData] = useState(null)
  const [attendanceCalendar, setAttendanceCalendar] = useState([])
  const [employeeProfile, setEmployeeProfile] = useState(null)
  const [profileError, setProfileError] = useState('')

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

  const [genMonth, setGenMonth] = useState(
    String(new Date().getMonth() + 1).padStart(2, '0')
  )
  const [genYear, setGenYear] = useState(
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
        if (calendarEmployee) fetchCalendar(calendarEmployee.id, calendarMonth, calendarYear)
      })
      .catch(() => setMessage('Error marking attendance.'))
  }

  function fetchSalary(empId, month, year) {
    getSalary(empId, month, year)
      .then(res => setSalaryData(res.data))
      .catch(() => setMessage('Error fetching salary.'))
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

  // ── FIX: loadEmployeeProfile now shows real error instead of generic message ──
  function loadEmployeeProfile(emp, month, year) {
    setSelectedEmployee(emp)
    setEmployeeProfile(null)
    setProfileError('')

    const m = month || genMonth
    const y = year  || genYear

    getEmployeeProfile(emp.id, m, y)
      .then(res => {
        setEmployeeProfile(res.data)
      })
      .catch(err => {
        // Show the actual server error so we can debug it
        const msg = err?.response?.data?.error || err?.message || 'Unknown error'
        setProfileError(`Error loading profile: ${msg}`)
        console.error('Profile load failed:', err)
      })
  }

  // ── FIX: fmtDT — display stored timestamp as-is, no Date() re-parsing
  // The DB stores "2026-06-17 14:52:58" (IST). Passing this through new Date()
  // re-interprets it as UTC and adds +5:30 offset, showing the wrong time.
  // Instead we just format the stored string directly.
  function fmtDT(dateStr) {
    if (!dateStr) return '—'
    // Try to parse YYYY-MM-DD HH:MM:SS or ISO format
    // We display as-is without timezone conversion
    const clean = dateStr.replace('T', ' ').substring(0, 19)
    // clean = "2026-06-17 14:52:58"
    const parts = clean.split(' ')
    if (parts.length === 2) {
      const [datePart, timePart] = parts
      const [yyyy, mm, dd] = datePart.split('-')
      return `${timePart}  ${dd}.${mm}.${yyyy}`
    }
    return clean
  }

  function buildCalendar(month, year) {
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate()
    const firstDay = new Date(parseInt(year), parseInt(month) - 1, 1).getDay()
    return { daysInMonth, firstDay }
  }

  function getDayStatus(day) {
    const dateStr = `${calendarYear}-${calendarMonth}-${String(day).padStart(2, '0')}`
    const record = attendanceCalendar.find(r => r.date === dateStr)
    return record ? record.status : null
  }

  const { daysInMonth, firstDay } = buildCalendar(calendarMonth, calendarYear)
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const TABS = [
    { key: 'list',       label: '👥 Employees' },
    { key: 'attendance', label: '📅 Mark Attendance' },
    { key: 'calendar',  label: '🗓️ Calendar' },
    { key: 'salary',    label: '💰 Salary' },
    { key: 'profile',   label: '👤 Profile' }
  ]

  return (
    <div>
      {/* HEADER */}
      <div style={styles.header}>
        <h2>Employees</h2>
        <button style={styles.addBtn} onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Employee'}
        </button>
      </div>

      {message && (
        <p style={styles.message} onClick={() => setMessage('')}>{message}</p>
      )}

      {/* ADD FORM */}
      {showForm && (
        <div style={styles.formBox}>
          <h3 style={{ marginBottom: '16px' }}>New Employee</h3>
          <form onSubmit={handleAddEmployee}>
            <div style={styles.formRow}>
              <input style={styles.input} placeholder="Full Name *" name="name"
                value={form.name} onChange={handleFormChange} />
              <input style={styles.input} placeholder="Phone Number" name="phone"
                value={form.phone} onChange={handleFormChange} />
              <input style={styles.input} placeholder="Monthly Salary (₹)"
                name="monthly_salary" type="number"
                value={form.monthly_salary} onChange={handleFormChange} />
              <div style={{ flex: 1 }}>
                <label style={styles.label}>Joining Date</label>
                <input style={styles.input} type="date" name="join_date"
                  value={form.join_date} onChange={handleFormChange} />
              </div>
            </div>
            <button style={styles.submitBtn} type="submit">Save Employee</button>
          </form>
        </div>
      )}

      {/* TABS */}
      <div style={styles.tabRow}>
        {TABS.map(t => (
          <button key={t.key}
            style={{ ...styles.tab, ...(activeTab === t.key ? styles.activeTab : {}) }}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: LIST ── */}
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
                    <button onClick={() => {
                      setSelectedEmployee(emp)
                      setSalaryData(null)
                      setActiveTab('salary')
                    }} style={styles.actionBtn}>
                      💰 Salary
                    </button>
                    <button onClick={() => {
                      setCalendarEmployee(emp)
                      setActiveTab('calendar')
                      fetchCalendar(emp.id, calendarMonth, calendarYear)
                    }} style={{ ...styles.actionBtn, color: '#3498db', borderColor: '#3498db', marginLeft: '6px' }}>
                      🗓️ Calendar
                    </button>
                    <button onClick={() => {
                      loadEmployeeProfile(emp)
                      setActiveTab('profile')
                    }} style={{ ...styles.actionBtn, color: '#8e44ad', borderColor: '#8e44ad', marginLeft: '6px' }}>
                      👤 Profile
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}

      {/* ── TAB: MARK ATTENDANCE ── */}
      {activeTab === 'attendance' && (
        <div style={styles.section}>
          <div style={styles.attendanceHeader}>
            <h3>Mark Attendance</h3>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <input
                style={{ ...styles.input, width: '180px', flex: 'none' }}
                type="date" value={attendanceDate}
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
                  <th style={styles.th}>Per Day</th>
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

      {/* ── TAB: CALENDAR ── */}
      {activeTab === 'calendar' && (
        <div style={styles.section}>
          <h3 style={{ marginBottom: '16px' }}>🗓️ Attendance Calendar</h3>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={styles.label}>Employee</label>
              <select style={{ ...styles.input, minWidth: '180px' }}
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
              <select style={{ ...styles.input, minWidth: '130px' }} value={calendarMonth}
                onChange={e => setCalendarMonth(e.target.value)}>
                {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, i) => (
                  <option key={m} value={m}>
                    {new Date(2000, i).toLocaleString('en-IN', { month: 'long' })}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={styles.label}>Year</label>
              <select style={{ ...styles.input, minWidth: '100px' }} value={calendarYear}
                onChange={e => setCalendarYear(e.target.value)}>
                {['2024', '2025', '2026', '2027'].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <button style={styles.submitBtn} onClick={handleCalendarLoad}>
              Load Calendar
            </button>
          </div>

          {calendarEmployee && (
            <>
              <div style={styles.legend}>
                <span style={styles.legendItem}>
                  <span style={{ ...styles.legendDot, backgroundColor: '#27ae60' }}></span> Present
                </span>
                <span style={styles.legendItem}>
                  <span style={{ ...styles.legendDot, backgroundColor: '#e74c3c' }}></span> Absent
                </span>
                <span style={styles.legendItem}>
                  <span style={{ ...styles.legendDot, backgroundColor: '#f39c12' }}></span> Half Day
                </span>
                <span style={styles.legendItem}>
                  <span style={{ ...styles.legendDot, backgroundColor: '#ecf0f1' }}></span> Not Marked
                </span>
              </div>

              <div style={styles.calendarBox}>
                <h4 style={{ marginBottom: '12px', textAlign: 'center', color: '#1a1a2e' }}>
                  {calendarEmployee.name} — {new Date(2000, parseInt(calendarMonth) - 1)
                    .toLocaleString('en-IN', { month: 'long' })} {calendarYear}
                </h4>
                <div style={styles.calendarGrid}>
                  {dayLabels.map(d => (
                    <div key={d} style={styles.dayLabel}>{d}</div>
                  ))}
                  {Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`empty-${i}`} style={styles.emptyCell}></div>
                  ))}
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

      {/* ── TAB: SALARY ── */}
      {activeTab === 'salary' && (
        <div style={styles.section}>
          <h3 style={{ marginBottom: '16px' }}>💰 Salary Calculator</h3>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={styles.label}>Employee</label>
              <select style={{ ...styles.input, minWidth: '200px' }}
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
              <select style={{ ...styles.input, minWidth: '130px' }} value={salaryMonth}
                onChange={e => setSalaryMonth(e.target.value)}>
                {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, i) => (
                  <option key={m} value={m}>
                    {new Date(2000, i).toLocaleString('en-IN', { month: 'long' })}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={styles.label}>Year</label>
              <select style={{ ...styles.input, minWidth: '100px' }} value={salaryYear}
                onChange={e => setSalaryYear(e.target.value)}>
                {['2024', '2025', '2026', '2027'].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <button style={styles.submitBtn}
              onClick={() => { if (selectedEmployee) fetchSalary(selectedEmployee.id, salaryMonth, salaryYear) }}>
              Calculate
            </button>
          </div>

          {salaryData && (
            <div style={styles.salaryCard}>
              <h3 style={{ marginBottom: '16px', color: '#1a1a2e' }}>
                {salaryData.employee_name} — {new Date(2000, parseInt(salaryMonth) - 1)
                  .toLocaleString('en-IN', { month: 'long' })} {salaryYear}
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
                  <div style={styles.salaryLabel}>Present Days</div>
                  <div style={{ ...styles.salaryValue, color: '#27ae60' }}>{salaryData.present_days}</div>
                </div>
                <div style={styles.salaryItem}>
                  <div style={styles.salaryLabel}>Half Days</div>
                  <div style={{ ...styles.salaryValue, color: '#f39c12' }}>{salaryData.half_days}</div>
                </div>
                <div style={styles.salaryItem}>
                  <div style={styles.salaryLabel}>Absent Days</div>
                  <div style={{ ...styles.salaryValue, color: '#e74c3c' }}>{salaryData.absent_days}</div>
                </div>
                <div style={styles.salaryItem}>
                  <div style={styles.salaryLabel}>Deduction</div>
                  <div style={{ ...styles.salaryValue, color: '#e74c3c' }}>- ₹{salaryData.deduction}</div>
                </div>
              </div>
              <div style={styles.salaryTotal}>
                <span>Payable Salary</span>
                <strong style={{ fontSize: '24px', color: '#27ae60' }}>
                  ₹{salaryData.calculated_salary}
                </strong>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: PROFILE ── */}
      {activeTab === 'profile' && (
        <div>
          {/* Employee selector buttons */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {employees.map(emp => (
              <button key={emp.id}
                onClick={() => loadEmployeeProfile(emp)}
                style={{
                  padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px',
                  backgroundColor: selectedEmployee?.id === emp.id ? '#1a1a2e' : '#fff',
                  color: selectedEmployee?.id === emp.id ? '#fff' : '#333',
                  border: selectedEmployee?.id === emp.id ? '1px solid #1a1a2e' : '1px solid #ddd'
                }}
              >
                👤 {emp.name}
              </button>
            ))}
          </div>

          {/* FIX: Show real error message instead of generic "Error loading profile" */}
          {profileError && (
            <p style={{ color: '#c0392b', backgroundColor: '#fdf2f2', padding: '10px 16px', borderRadius: '6px', marginBottom: '12px' }}>
              {profileError}
            </p>
          )}

          {!employeeProfile && selectedEmployee && !profileError && (
            <p style={{ color: '#888' }}>Loading profile...</p>
          )}

          {!selectedEmployee && (
            <p style={{ color: '#888' }}>Select an employee above to view their profile.</p>
          )}

          {employeeProfile && (
            <div style={styles.section}>
              {/* Header */}
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ marginBottom: '4px' }}>{employeeProfile.employee.name}</h3>
                <p style={{ color: '#888', fontSize: '13px' }}>
                  📞 {employeeProfile.employee.phone || '—'} &nbsp;•&nbsp;
                  Salary: ₹{employeeProfile.employee.monthly_salary}/month &nbsp;•&nbsp;
                  Per day: ₹{Math.round(employeeProfile.employee.monthly_salary / 30)}
                </p>
              </div>

              {/* Month/Year selector */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <div>
                  <label style={styles.label}>Month</label>
                  <select style={{ ...styles.input, minWidth: '130px' }}
                    value={genMonth}
                    onChange={e => {
                      const newMonth = e.target.value
                      setGenMonth(newMonth)
                      loadEmployeeProfile(selectedEmployee, newMonth, genYear)
                    }}>
                    {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, i) => (
                      <option key={m} value={m}>{new Date(2000, i).toLocaleString('en-IN', { month: 'long' })}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={styles.label}>Year</label>
                  <select style={{ ...styles.input, minWidth: '90px' }}
                    value={genYear}
                    onChange={e => {
                      const newYear = e.target.value
                      setGenYear(newYear)
                      loadEmployeeProfile(selectedEmployee, genMonth, newYear)
                    }}>
                    {['2024','2025','2026','2027'].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>

              {/* Stats */}
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
                <div style={styles.statBox}>
                  <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>
                    💰 Salary Earned ({employeeProfile.effective_days} days)
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#27ae60' }}>
                    + ₹{Math.abs(employeeProfile.salary_earned)}
                  </div>
                </div>

                <div style={styles.statBox}>
                  <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>
                    📤 Advance Given
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#e74c3c' }}>
                    - ₹{Math.abs(employeeProfile.total_advance_paid)}
                  </div>
                </div>

                <div style={{
                  ...styles.statBox,
                  backgroundColor: employeeProfile.net_payable >= 0 ? '#f0fff4' : '#fff5f5',
                  border: `1px solid ${employeeProfile.net_payable >= 0 ? '#c3e6cb' : '#fdd'}`
                }}>
                  <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>
                    {employeeProfile.net_payable >= 0 ? '✅ Net Payable to Employee' : '⚠️ Employee Owes Back'}
                  </div>
                  <div style={{
                    fontSize: '26px', fontWeight: 'bold',
                    color: employeeProfile.net_payable >= 0 ? '#27ae60' : '#e74c3c'
                  }}>
                    {employeeProfile.net_payable >= 0 ? '+' : '-'} ₹{Math.abs(employeeProfile.net_payable)}
                  </div>
                </div>
              </div>

              {/* Payment history */}
              <h4 style={{ marginBottom: '12px' }}>Payment History</h4>
              {employeeProfile.payment_history.length === 0 ? (
                <p style={{ color: '#888' }}>No payments recorded yet.</p>
              ) : (
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Date</th>
                      <th style={styles.th}>Type</th>
                      <th style={styles.th}>Description</th>
                      <th style={styles.th}>Mode</th>
                      <th style={styles.th}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employeeProfile.payment_history.map((p, i) => (
                      <tr key={i} style={styles.tr}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
                      >
                        <td style={styles.td}>
                          {/* FIX: display stored timestamp directly without re-parsing through Date() */}
                          <div>{p.date || '—'}</div>
                          {p.created_at && (
                            <div style={{ fontSize: '11px', color: '#aaa' }}>
                              🕐 {fmtDT(p.created_at)}
                            </div>
                          )}
                        </td>
                        <td style={styles.td}>
                          <span style={{
                            ...styles.badge,
                            backgroundColor: p.type === 'advance' ? '#f39c12' : '#27ae60'
                          }}>
                            {p.type === 'advance' ? '💵 Advance' : '💰 Salary'}
                          </span>
                        </td>
                        <td style={styles.td}>{p.description || '—'}</td>
                        <td style={styles.td}>
                          <span style={{ fontSize: '13px' }}>
                            {p.payment_mode === 'cash' ? '💵 Cash'
                              : p.upi_account ? `📱 ${p.upi_account}`
                              : '💵 Cash'}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <strong style={{ color: p.type === 'advance' ? '#e74c3c' : '#27ae60' }}>
                            {p.type === 'advance' ? '- ' : '+ '}₹{p.amount}
                          </strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
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
  input: { width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', boxSizing: 'border-box' },
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
  actionBtn: { backgroundColor: '#fff', color: '#27ae60', border: '1px solid #27ae60', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' },
  badge: { padding: '3px 10px', borderRadius: '12px', color: '#fff', fontSize: '12px' },
  legend: { display: 'flex', gap: '20px', marginBottom: '16px', flexWrap: 'wrap' },
  legendItem: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' },
  legendDot: { width: '14px', height: '14px', borderRadius: '3px', display: 'inline-block' },
  calendarBox: { backgroundColor: '#f8f8f8', padding: '20px', borderRadius: '12px' },
  calendarGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', marginBottom: '16px' },
  dayLabel: { textAlign: 'center', fontSize: '12px', fontWeight: 'bold', color: '#888', padding: '8px 0' },
  emptyCell: { height: '60px' },
  dayCell: { height: '60px', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
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
  salaryTotal: { backgroundColor: '#fff', padding: '20px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '18px' },
  statBox: { backgroundColor: '#f8f8f8', padding: '16px 20px', borderRadius: '8px', minWidth: '160px' },
}

export default Employees
