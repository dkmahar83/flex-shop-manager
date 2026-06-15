import { useState, useEffect } from 'react'
import { getOrders, getCustomers, createOrder, updateOrderStatus, getOrderDetail, addPayment } from '../services/api'
import axios from 'axios'

function Orders() {
  const [orders, setOrders] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [message, setMessage] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [editingOrder, setEditingOrder] = useState(null)
  const [expandedOrder, setExpandedOrder] = useState(null)
  const [orderDetail, setOrderDetail] = useState(null)
  const [paymentForm, setPaymentForm] = useState({ amount: '', note: '', payment_date: '' })

  const [form, setForm] = useState({
    customer_id: '', description: '', advance_paid: '', follow_up_date: '', notes: ''
  })

  const [items, setItems] = useState([
    { item_name: '', length: '', breadth: '', quantity: '', unit_price: '', useSize: false }
  ])

  useEffect(() => {
    fetchOrders()
    getCustomers().then(res => setCustomers(res.data))
  }, [filterStatus]) // eslint-disable-line react-hooks/exhaustive-deps

  function fetchOrders() {
    setLoading(true)
    const filters = filterStatus ? { status: filterStatus } : {}
    getOrders(filters)
      .then(res => { setOrders(res.data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  function handleFormChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  function handleItemChange(index, field, value) {
    const updated = [...items]
    updated[index][field] = value
    if (field === 'length' || field === 'breadth') {
      const l = parseFloat(field === 'length' ? value : updated[index].length) || 0
      const b = parseFloat(field === 'breadth' ? value : updated[index].breadth) || 0
      updated[index].quantity = (l * b).toFixed(2)
    }
    setItems(updated)
  }

  function toggleSizeMode(index) {
    const updated = [...items]
    updated[index].useSize = !updated[index].useSize
    updated[index].length = ''
    updated[index].breadth = ''
    if (!updated[index].useSize) updated[index].quantity = ''
    setItems(updated)
  }

  function addItemRow() {
    setItems([...items, { item_name: '', length: '', breadth: '', quantity: '', unit_price: '', useSize: false }])
  }

  function removeItemRow(index) {
    if (items.length === 1) return
    setItems(items.filter((_, i) => i !== index))
  }

  function calculateTotal() {
    return items.reduce((sum, item) => {
      return sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0)
    }, 0)
  }

  function openEditForm(order) {
    setEditingOrder(order)
    setForm({
      customer_id: order.customer_id,
      description: order.description || '',
      advance_paid: order.advance_paid,
      follow_up_date: order.follow_up_date || '',
      notes: order.notes || ''
    })
    setShowForm(true)
    window.scrollTo(0, 0)
  }

  function resetForm() {
    setForm({ customer_id: '', description: '', advance_paid: '', follow_up_date: '', notes: '' })
    setItems([{ item_name: '', length: '', breadth: '', quantity: '', unit_price: '', useSize: false }])
    setEditingOrder(null)
    setShowForm(false)
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.customer_id) return setMessage('Please select a customer.')

    if (editingOrder) {
      axios.put(`http://localhost:5000/api/orders/${editingOrder.id}`, {
        description: form.description,
        notes: form.notes,
        follow_up_date: form.follow_up_date,
        advance_paid: parseFloat(form.advance_paid) || 0
      })
        .then(() => {
          setMessage('Order updated successfully!')
          resetForm()
          fetchOrders()
        })
        .catch(() => setMessage('Error updating order.'))
      return
    }

    if (!items[0].item_name) return setMessage('Add at least one item.')

    const payload = {
      ...form,
      advance_paid: parseFloat(form.advance_paid) || 0,
      items: items.map(i => ({
        item_name: i.item_name,
        quantity: parseFloat(i.quantity) || 1,
        unit_price: parseFloat(i.unit_price) || 0
      }))
    }

    createOrder(payload)
      .then(() => {
        setMessage('Order created successfully!')
        resetForm()
        fetchOrders()
      })
      .catch(() => setMessage('Error creating order.'))
  }

  function handleStatusChange(orderId, newStatus) {
    updateOrderStatus(orderId, newStatus)
      .then(() => fetchOrders())
      .catch(() => setMessage('Error updating status.'))
  }

  function toggleExpand(order) {
    if (expandedOrder === order.id) {
      setExpandedOrder(null)
      setOrderDetail(null)
      return
    }
    setExpandedOrder(order.id)
    getOrderDetail(order.id)
      .then(res => setOrderDetail(res.data))
      .catch(() => setMessage('Could not load order detail.'))
  }

  function handleAddPayment(e) {
    e.preventDefault()
    if (!paymentForm.amount) return setMessage('Enter payment amount.')

    addPayment({
      order_id: orderDetail.id,
      customer_id: orderDetail.customer_id,
      amount: parseFloat(paymentForm.amount),
      note: paymentForm.note,
      payment_date: paymentForm.payment_date || new Date().toISOString().split('T')[0]
    })
      .then(() => {
        setMessage('Payment recorded!')
        setPaymentForm({ amount: '', note: '', payment_date: '' })
        getOrderDetail(orderDetail.id).then(res => {
          setOrderDetail(res.data)
          fetchOrders()
        })
      })
      .catch(() => setMessage('Error recording payment.'))
  }

  const total = calculateTotal()
  const advance = parseFloat(form.advance_paid) || 0
  const balance = total - advance

  return (
    <div>
      <div style={styles.header}>
        <h2>Orders</h2>
        <button style={styles.addBtn} onClick={() => showForm ? resetForm() : setShowForm(true)}>
          {showForm ? 'Cancel' : '+ New Order'}
        </button>
      </div>

      {message && (
        <p style={styles.message} onClick={() => setMessage('')}>{message}</p>
      )}

      {showForm && (
        <div style={styles.formBox}>
          <h3 style={{ marginBottom: '16px' }}>
            {editingOrder ? `Edit Order #${editingOrder.id}` : 'New Order'}
          </h3>
          <form onSubmit={handleSubmit}>

            <div style={styles.formRow}>
              <select
                style={styles.input}
                name="customer_id"
                value={form.customer_id}
                onChange={handleFormChange}
                disabled={!!editingOrder}
              >
                <option value="">Select Customer *</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.firm_name} {c.contact_name ? `(${c.contact_name})` : ''}
                  </option>
                ))}
              </select>
              <input
                style={styles.input}
                placeholder="Description (e.g. Dukan ka flex)"
                name="description"
                value={form.description}
                onChange={handleFormChange}
              />
            </div>

            {!editingOrder && (
              <div style={{ marginBottom: '12px' }}>
                <p style={{ fontSize: '13px', color: '#555', marginBottom: '8px', fontWeight: 'bold' }}>
                  Line Items
                </p>
                {items.map((item, index) => (
                  <div key={index} style={{ marginBottom: '10px', backgroundColor: '#f9f9f9', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                      <input
                        style={{ ...styles.input, flex: 3 }}
                        placeholder="Item name (e.g. Flex 180GSM, Pipe 3kg, Labour)"
                        value={item.item_name}
                        onChange={e => handleItemChange(index, 'item_name', e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => toggleSizeMode(index)}
                        style={{
                          ...styles.toggleBtn,
                          backgroundColor: item.useSize ? '#1a1a2e' : '#fff',
                          color: item.useSize ? '#fff' : '#333'
                        }}
                      >
                        {item.useSize ? '📐 Size ON' : '📐 L×B'}
                      </button>
                      <button type="button" onClick={() => removeItemRow(index)} style={styles.removeBtn}>✕</button>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {item.useSize ? (
                        <>
                          <div style={{ flex: 1 }}>
                            <label style={styles.label}>Length (ft)</label>
                            <input style={styles.input} type="number" placeholder="e.g. 10"
                              value={item.length} onChange={e => handleItemChange(index, 'length', e.target.value)} />
                          </div>
                          <div style={{ paddingTop: '16px', fontSize: '18px' }}>×</div>
                          <div style={{ flex: 1 }}>
                            <label style={styles.label}>Breadth (ft)</label>
                            <input style={styles.input} type="number" placeholder="e.g. 4"
                              value={item.breadth} onChange={e => handleItemChange(index, 'breadth', e.target.value)} />
                          </div>
                          <div style={{ paddingTop: '16px', fontSize: '18px' }}>=</div>
                          <div style={{ flex: 1 }}>
                            <label style={styles.label}>Sq.ft (auto)</label>
                            <input style={{ ...styles.input, backgroundColor: '#e8f5e9' }} value={item.quantity} readOnly />
                          </div>
                        </>
                      ) : (
                        <div style={{ flex: 1 }}>
                          <label style={styles.label}>Quantity / Sq.ft</label>
                          <input style={styles.input} type="number" placeholder="0"
                            value={item.quantity} onChange={e => handleItemChange(index, 'quantity', e.target.value)} />
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <label style={styles.label}>Rate (₹)</label>
                        <input style={styles.input} type="number" placeholder="0"
                          value={item.unit_price} onChange={e => handleItemChange(index, 'unit_price', e.target.value)} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={styles.label}>Subtotal</label>
                        <div style={{ padding: '10px', fontWeight: 'bold', fontSize: '16px' }}>
                          ₹{((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0)).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={addItemRow} style={styles.addItemBtn}>+ Add Item</button>
              </div>
            )}

            <div style={styles.totalsBox}>
              {!editingOrder && (
                <div style={styles.totalRow}>
                  <span>Total Amount:</span>
                  <strong>₹{total.toFixed(2)}</strong>
                </div>
              )}
              <div style={styles.totalRow}>
                <span>Advance Paid:</span>
                <input
                  style={{ ...styles.input, width: '150px', flex: 'none' }}
                  placeholder="0" type="number" name="advance_paid"
                  value={form.advance_paid} onChange={handleFormChange}
                />
              </div>
              {!editingOrder && (
                <div style={styles.totalRow}>
                  <span>Balance Due:</span>
                  <strong style={{ color: balance > 0 ? '#e74c3c' : '#27ae60' }}>
                    ₹{balance.toFixed(2)}
                  </strong>
                </div>
              )}
            </div>

            <div style={styles.formRow}>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>Follow-up Date</label>
                <input style={styles.input} type="date" name="follow_up_date"
                  value={form.follow_up_date} onChange={handleFormChange} />
              </div>
              <div style={{ flex: 2 }}>
                <label style={styles.label}>Notes</label>
                <input style={styles.input} placeholder="Size, GSM, special notes..."
                  name="notes" value={form.notes} onChange={handleFormChange} />
              </div>
            </div>

            <button style={styles.submitBtn} type="submit">
              {editingOrder ? 'Update Order' : 'Create Order'}
            </button>
          </form>
        </div>
      )}

      <div style={styles.filterRow}>
        {['', 'pending', 'in_progress', 'ready', 'delivered'].map(s => (
          <button key={s}
            style={{ ...styles.filterBtn, ...(filterStatus === s ? styles.filterActive : {}) }}
            onClick={() => setFilterStatus(s)}
          >
            {s === '' ? 'All' : s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {loading ? <p>Loading...</p> : orders.length === 0 ? (
        <p style={{ color: '#888' }}>No orders found.</p>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>#</th>
              <th style={styles.th}>Firm</th>
              <th style={styles.th}>Description</th>
              <th style={styles.th}>Total</th>
              <th style={styles.th}>Balance</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Follow-up</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o, index) => (
              <>
                <tr key={o.id} style={styles.tr}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
                >
                  <td style={styles.td}>{index + 1}</td>
                  <td style={styles.td}>
                    <strong>{o.firm_name}</strong><br />
                    <span style={{ fontSize: '12px', color: '#888' }}>{o.phone}</span>
                  </td>
                  <td style={styles.td}>{o.description || '—'}</td>
                  <td style={styles.td}>₹{o.total_amount}</td>
                  <td style={styles.td}>
                    <span style={{ color: o.balance_due > 0 ? '#e74c3c' : '#27ae60', fontWeight: 'bold' }}>
                      ₹{o.balance_due}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <select
                      value={o.status}
                      onChange={e => handleStatusChange(o.id, e.target.value)}
                      style={{ ...styles.statusSelect, backgroundColor: statusColor(o.status) }}
                    >
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="ready">Ready</option>
                      <option value="delivered">Delivered</option>
                    </select>
                  </td>
                  <td style={styles.td}>
                    {o.follow_up_date
                      ? <span style={{ color: o.follow_up_date <= new Date().toISOString().split('T')[0] ? '#e74c3c' : '#333' }}>
                          {o.follow_up_date}
                        </span>
                      : '—'}
                  </td>
                  <td style={styles.td}>
                    <button onClick={() => toggleExpand(o)} style={styles.detailBtn}>
                      {expandedOrder === o.id ? '▲ Hide' : '▼ Details'}
                    </button>
                    <button onClick={() => openEditForm(o)} style={{ ...styles.editBtn, marginLeft: '6px' }}>
                      Edit
                    </button>
                  </td>
                </tr>

                {expandedOrder === o.id && orderDetail && (
                  <tr key={`detail-${o.id}`}>
                    <td colSpan="8" style={styles.detailCell}>
                      <div style={styles.detailBox}>

                        <div style={styles.detailSection}>
                          <h4 style={styles.detailTitle}>📦 Order Items</h4>
                          <table style={styles.innerTable}>
                            <thead>
                              <tr>
                                <th style={styles.innerTh}>Item</th>
                                <th style={styles.innerTh}>Qty/Sq.ft</th>
                                <th style={styles.innerTh}>Rate</th>
                                <th style={styles.innerTh}>Subtotal</th>
                              </tr>
                            </thead>
                            <tbody>
                              {orderDetail.items && orderDetail.items.map(item => (
                                <tr key={item.id}>
                                  <td style={styles.innerTd}>{item.item_name}</td>
                                  <td style={styles.innerTd}>{item.quantity}</td>
                                  <td style={styles.innerTd}>₹{item.unit_price}</td>
                                  <td style={styles.innerTd}>₹{item.subtotal}</td>
                                </tr>
                              ))}
                              {/* TOTAL ROW */}
                              <tr style={{ backgroundColor: '#f0f7ff' }}>
                                <td colSpan="3" style={{ ...styles.innerTd, fontWeight: 'bold', textAlign: 'right' }}>
                                  Total:
                                </td>
                                <td style={{ ...styles.innerTd, fontWeight: 'bold', fontSize: '16px', color: '#1a1a2e' }}>
                                  ₹{orderDetail.total_amount}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        <div style={styles.detailSection}>
                          <h4 style={styles.detailTitle}>💰 Payment History</h4>
                          <table style={styles.innerTable}>
                            <thead>
                              <tr>
                                <th style={styles.innerTh}>#</th>
                                <th style={styles.innerTh}>Date</th>
                                <th style={styles.innerTh}>Amount</th>
                                <th style={styles.innerTh}>Note</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr style={{ backgroundColor: '#fff9e6' }}>
                                <td style={styles.innerTd}>1</td>
                                <td style={styles.innerTd}>{orderDetail.created_at?.split('T')[0]}</td>
                                <td style={styles.innerTd}><strong>₹{orderDetail.advance_paid}</strong></td>
                                <td style={styles.innerTd}>
                                  <span style={styles.advanceBadge}>Advance</span>
                                </td>
                              </tr>
                              {orderDetail.payments && orderDetail.payments.map((p, i) => (
                                <tr key={p.id}>
                                  <td style={styles.innerTd}>{i + 2}</td>
                                  <td style={styles.innerTd}>{p.payment_date}</td>
                                  <td style={styles.innerTd}><strong>₹{p.amount}</strong></td>
                                  <td style={styles.innerTd}>{p.note || '—'}</td>
                                </tr>
                              ))}
                              <tr style={{ backgroundColor: '#f0fff4' }}>
                                <td colSpan="2" style={{ ...styles.innerTd, fontWeight: 'bold' }}>
                                  Balance Due
                                </td>
                                <td colSpan="2" style={{
                                  ...styles.innerTd, fontWeight: 'bold', fontSize: '16px',
                                  color: orderDetail.balance_due > 0 ? '#e74c3c' : '#27ae60'
                                }}>
                                  ₹{orderDetail.balance_due}
                                  {orderDetail.follow_up_date && (
                                    <span style={{ fontSize: '12px', color: '#888', marginLeft: '10px' }}>
                                      Follow-up: {orderDetail.follow_up_date}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            </tbody>
                          </table>

                          {orderDetail.balance_due > 0 && (
                            <form onSubmit={handleAddPayment} style={styles.paymentForm}>
                              <h5 style={{ marginBottom: '8px', color: '#555' }}>+ Record New Payment</h5>
                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                <input
                                  style={{ ...styles.input, maxWidth: '150px' }}
                                  type="number" placeholder="Amount ₹"
                                  value={paymentForm.amount}
                                  onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                                />
                                <input
                                  style={{ ...styles.input, maxWidth: '160px' }}
                                  type="date"
                                  value={paymentForm.payment_date}
                                  onChange={e => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                                />
                                <input
                                  style={{ ...styles.input, flex: 2 }}
                                  placeholder="Note (e.g. delivery payment, cash)"
                                  value={paymentForm.note}
                                  onChange={e => setPaymentForm({ ...paymentForm, note: e.target.value })}
                                />
                                <button type="submit" style={styles.submitBtn}>Save Payment</button>
                              </div>
                            </form>
                          )}
                        </div>

                        {orderDetail.notes && (
                          <div style={styles.detailSection}>
                            <h4 style={styles.detailTitle}>📝 Notes</h4>
                            <p style={{ fontSize: '14px', color: '#555' }}>{orderDetail.notes}</p>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
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
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  addBtn: { backgroundColor: '#e94560', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' },
  message: { backgroundColor: '#e8f5e9', color: '#2e7d32', padding: '10px 16px', borderRadius: '6px', marginBottom: '16px', cursor: 'pointer' },
  formBox: { backgroundColor: '#fff', padding: '20px', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  formRow: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' },
  input: { padding: '10px 14px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', flex: '1', minWidth: '120px', boxSizing: 'border-box' },
  label: { fontSize: '12px', color: '#888', display: 'block', marginBottom: '4px' },
  toggleBtn: { padding: '8px 12px', borderRadius: '6px', border: '1px solid #ddd', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' },
  removeBtn: { width: '32px', height: '32px', backgroundColor: '#fee', color: '#e74c3c', border: '1px solid #e74c3c', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' },
  addItemBtn: { backgroundColor: '#f0f0f0', border: '1px solid #ddd', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', marginTop: '4px' },
  totalsBox: { backgroundColor: '#f8f8f8', padding: '16px', borderRadius: '8px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '400px' },
  totalRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '15px' },
  submitBtn: { backgroundColor: '#1a1a2e', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' },
  filterRow: { display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' },
  filterBtn: { padding: '7px 16px', borderRadius: '20px', border: '1px solid #ddd', backgroundColor: '#fff', cursor: 'pointer', fontSize: '13px', textTransform: 'capitalize' },
  filterActive: { backgroundColor: '#1a1a2e', color: '#fff', border: '1px solid #1a1a2e' },
  table: { width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  th: { padding: '12px 16px', textAlign: 'left', backgroundColor: '#f8f8f8', fontSize: '13px', color: '#555', borderBottom: '1px solid #eee' },
  td: { padding: '12px 16px', fontSize: '14px', borderBottom: '1px solid #f0f0f0' },
  tr: { backgroundColor: '#fff' },
  statusSelect: { border: 'none', padding: '5px 10px', borderRadius: '12px', color: '#fff', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' },
  editBtn: { backgroundColor: '#fff', color: '#3498db', border: '1px solid #3498db', padding: '5px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' },
  detailBtn: { backgroundColor: '#fff', color: '#555', border: '1px solid #ddd', padding: '5px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' },
  detailCell: { padding: '0', backgroundColor: '#f0f7ff', borderBottom: '2px solid #ddd' },
  detailBox: { padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' },
  detailSection: { backgroundColor: '#fff', padding: '16px', borderRadius: '8px' },
  detailTitle: { marginBottom: '10px', fontSize: '14px', color: '#333' },
  innerTable: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  innerTh: { padding: '8px 12px', backgroundColor: '#f8f8f8', textAlign: 'left', borderBottom: '1px solid #eee', color: '#666' },
  innerTd: { padding: '8px 12px', borderBottom: '1px solid #f0f0f0' },
  advanceBadge: { backgroundColor: '#fff3cd', color: '#856404', padding: '2px 8px', borderRadius: '10px', fontSize: '11px' },
  paymentForm: { marginTop: '12px', padding: '12px', backgroundColor: '#f9f9f9', borderRadius: '8px' }
}

export default Orders