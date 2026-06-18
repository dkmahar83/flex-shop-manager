import { useState, useEffect } from 'react'
import { getOrders, getCustomers, createOrder, updateOrderStatus, getOrderDetail, addPayment, deleteOrder, sendBillWhatsApp } from '../services/api'
import axios from 'axios'

const UPI_ACCOUNTS = [
  'BOI Shop Account',
  'Google Pay - Rampratap Painter',
  'PhonePe - Bhavya Printers',
  'Amazon Pay - Deepak'
]

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
  const [editingFollowUp, setEditingFollowUp] = useState(null) // order id
  const [followUpValue, setFollowUpValue]     = useState('')
  const [paymentForm, setPaymentForm] = useState({
      amount: '',
      note: '',
      payment_date: '',
      follow_up_date: '',
      payment_mode: 'cash',
      upi_account: '',
      showDiscount: false,
      discount_amount: '',
      discount_note: ''
    })
  const [waStatus, setWaStatus] = useState('disconnected')

  const [form, setForm] = useState({
    customer_id: '',
    description: '',
    advance_paid: '',
    advance_payment_mode: 'cash',   // 'cash' | 'upi'
    advance_upi_account: '',
    follow_up_date: '',
    notes: '',
    discount_amount: '',
    discount_note: ''
  })

  const [items, setItems] = useState([
    { item_name: '', length: '', breadth: '', quantity: '', unit_price: '', useSize: false }
  ])
  useEffect(() => {
      // Check WhatsApp status on load
      import('../services/api').then(({ getWhatsAppStatus }) => {
        getWhatsAppStatus()
          .then(res => setWaStatus(res.data.status))
          .catch(() => {})
      })
    }, [])
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
    const { name, value } = e.target
    setForm(prev => {
      const updated = { ...prev, [name]: value }
      // Reset UPI account if switching away from UPI
      if (name === 'advance_payment_mode' && value !== 'upi') {
        updated.advance_upi_account = ''
      }
      return updated
    })
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
      advance_payment_mode: order.advance_payment_mode || 'cash',
      advance_upi_account: order.advance_upi_account || '',
      follow_up_date: order.follow_up_date || '',
      notes: order.notes || '',
      discount_amount: order.discount_amount || '',
      discount_note: order.discount_note || ''
    })
    axios.get(`http://localhost:5000/api/orders/${order.id}`)
      .then(res => {
        if (res.data.items && res.data.items.length > 0) {
          setItems(res.data.items.map(i => ({
            item_name: i.item_name,
            quantity: i.quantity,
            unit_price: i.unit_price,
            length: '', breadth: '', useSize: false
          })))
        } else {
          setItems([{ item_name: '', length: '', breadth: '', quantity: '', unit_price: '', useSize: false }])
        }
      })
    setShowForm(true)
    window.scrollTo(0, 0)
  }

  function resetForm() {
    setForm({
      customer_id: '', description: '', advance_paid: '',
      advance_payment_mode: 'cash', advance_upi_account: '',
      follow_up_date: '', notes: '',
      discount_amount: '', discount_note: ''
    })
    setItems([{ item_name: '', length: '', breadth: '', quantity: '', unit_price: '', useSize: false }])
    setEditingOrder(null)
    setShowForm(false)
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.customer_id) return setMessage('Please select a customer.')

    const advanceAmt = parseFloat(form.advance_paid) || 0

    // Validate payment mode when advance > 0
    if (advanceAmt > 0 && form.advance_payment_mode === 'upi' && !form.advance_upi_account) {
      return setMessage('Please select a UPI account for the advance payment.')
    }

    if (editingOrder) {
      const validItems = items.filter(i => i.item_name && (parseFloat(i.quantity) > 0))
      if (validItems.length === 0) return setMessage('Add at least one valid item.')

      axios.put(`http://localhost:5000/api/orders/${editingOrder.id}/items`, {
        items: validItems.map(i => ({
          item_name: i.item_name,
          quantity: parseFloat(i.quantity) || 1,
          unit_price: parseFloat(i.unit_price) || 0
        }))
      }).then(() => {
        return axios.put(`http://localhost:5000/api/orders/${editingOrder.id}`, {
          description: form.description,
          notes: form.notes,
          follow_up_date: form.follow_up_date,
          advance_paid: advanceAmt,
          advance_payment_mode: advanceAmt > 0 ? form.advance_payment_mode : null,
          advance_upi_account: advanceAmt > 0 && form.advance_payment_mode === 'upi'
            ? form.advance_upi_account : null,
          discount_amount: parseFloat(form.discount_amount) || 0,
          discount_note: form.discount_note || null
        })
      }).then(() => {
        setMessage('Order updated successfully!')
        resetForm()
        fetchOrders()
      }).catch(() => setMessage('Error updating order.'))
      return
    }

    if (!items[0].item_name) return setMessage('Add at least one item.')

    const payload = {
      ...form,
      advance_paid: advanceAmt,
      advance_payment_mode: advanceAmt > 0 ? form.advance_payment_mode : null,
      advance_upi_account: advanceAmt > 0 && form.advance_payment_mode === 'upi'
        ? form.advance_upi_account : null,
      discount_amount: parseFloat(form.discount_amount) || 0,
      discount_note: form.discount_note || null,
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

  function handleDeleteOrder(order) {
    if (!window.confirm(`"${order.description || 'This order'}" delete karna chahte ho?\n(24 ghante tak restore ho sakta hai Bin se)`)) return
    deleteOrder(order.id)
      .then(() => {
        setMessage('Order deleted. Bin se restore ho sakta hai 24 ghante mein.')
        fetchOrders()
      })
      .catch(() => setMessage('Error deleting order.'))
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
    if (paymentForm.payment_mode === 'upi' && !paymentForm.upi_account) {
      return setMessage('UPI ke liye account select karo.')
    }
    const discountAmt = parseFloat(paymentForm.discount_amount) || 0

    // Discount pehle save karo order mein (agar hai to)
    const discountPromise = discountAmt > 0
      ? axios.put(`http://localhost:5000/api/orders/${orderDetail.id}`, {
          discount_amount: (parseFloat(orderDetail.discount_amount) || 0) + discountAmt,
          discount_note: paymentForm.discount_note || 'Round-off'
        })
      : Promise.resolve()

    discountPromise.then(() => addPayment({
      order_id: orderDetail.id,
      customer_id: orderDetail.customer_id,
      amount: parseFloat(paymentForm.amount),
      note: paymentForm.note,
      payment_mode: paymentForm.payment_mode,
      upi_account:  paymentForm.upi_account || null,
      payment_date: paymentForm.payment_date
        ? paymentForm.payment_date + ' ' + new Date().toLocaleTimeString('en-GB', { hour12: false })
        : new Date().toLocaleString('en-GB', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
          }).replace(',', '')
    }))
      .then(() => {
        if (paymentForm.follow_up_date) {
          axios.put(`http://localhost:5000/api/orders/${orderDetail.id}`, {
            follow_up_date: paymentForm.follow_up_date
          }).catch(() => {})
        }
        setMessage('Payment recorded!')
        setPaymentForm({ amount: '', note: '', payment_date: '', follow_up_date: '', payment_mode: 'cash', upi_account: '', showDiscount: false, discount_amount: '', discount_note: '' })
        getOrderDetail(orderDetail.id).then(res => {
          setOrderDetail(res.data)
          fetchOrders()
        })
      })
      .catch(() => setMessage('Error recording payment.'))
  }
  function handleFollowUpSave(orderId) {
    axios.put(`http://localhost:5000/api/orders/${orderId}`, {
      follow_up_date: followUpValue
    })
      .then(() => {
        setEditingFollowUp(null)
        fetchOrders()
        // Agar ye order expand hai to detail bhi refresh karo
        if (expandedOrder === orderId) {
          getOrderDetail(orderId).then(res => setOrderDetail(res.data))
        }
      })
      .catch(() => setMessage('Error updating follow-up date.'))
  }

  const total    = calculateTotal()
  const advance  = parseFloat(form.advance_paid) || 0
  const discount = parseFloat(form.discount_amount) || 0
  const balance  = total - advance - discount

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

            <div style={{ marginBottom: '12px' }}>
              <p style={{ fontSize: '13px', color: '#555', marginBottom: '8px', fontWeight: 'bold' }}>
                Line Items {editingOrder && (
                  <span style={{ fontSize: '11px', color: '#e74c3c' }}>(editing will recalculate total)</span>
                )}
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

            {/* ── Totals + Advance Section ── */}
            <div style={styles.totalsBox}>
              <div style={styles.totalRow}>
                <span>Total Amount:</span>
                <strong>₹{total.toFixed(2)}</strong>
              </div>

              <div style={styles.totalRow}>
                <span>Advance Paid:</span>
                <input
                  style={{ ...styles.input, width: '150px', flex: 'none' }}
                  placeholder="0" type="number" name="advance_paid"
                  value={form.advance_paid} onChange={handleFormChange}
                />
              </div>

              {/* ── Payment Mode — shown only when advance > 0 ── */}
              {advance > 0 && (
                <>
                  <div style={styles.totalRow}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Payment Mode
                      <span style={styles.requiredDot}>*</span>
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, advance_payment_mode: 'cash', advance_upi_account: '' }))}
                        style={{
                          ...styles.modeBtn,
                          ...(form.advance_payment_mode === 'cash' ? styles.modeBtnActive : {})
                        }}
                      >
                        💵 Cash
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, advance_payment_mode: 'upi' }))}
                        style={{
                          ...styles.modeBtn,
                          ...(form.advance_payment_mode === 'upi' ? styles.modeBtnActive : {})
                        }}
                      >
                        📱 UPI
                      </button>
                    </div>
                  </div>

                  {/* UPI account selector */}
                  {form.advance_payment_mode === 'upi' && (
                    <div style={styles.totalRow}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        UPI Account
                        <span style={styles.requiredDot}>*</span>
                      </span>
                      <select
                        name="advance_upi_account"
                        value={form.advance_upi_account}
                        onChange={handleFormChange}
                        style={{ ...styles.input, width: '220px', flex: 'none' }}
                        required
                      >
                        <option value="">Select UPI Account</option>
                        {UPI_ACCOUNTS.map(acc => (
                          <option key={acc} value={acc}>{acc}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}

              <div style={styles.totalRow}>
                <span>Discount / Round-off:</span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input
                    style={{ ...styles.input, width: '110px', flex: 'none' }}
                    placeholder="₹0" type="number" name="discount_amount"
                    value={form.discount_amount} onChange={handleFormChange}
                  />
                  <input
                    style={{ ...styles.input, width: '160px', flex: 'none' }}
                    placeholder="Note (e.g. round-off)"
                    name="discount_note"
                    value={form.discount_note} onChange={handleFormChange}
                  />
                </div>
              </div>

              <div style={styles.totalRow}>
                <span>Balance Due:</span>
                <strong style={{ color: balance > 0 ? '#e74c3c' : '#27ae60' }}>
                  ₹{balance.toFixed(2)}
                </strong>
              </div>
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
                    {editingFollowUp === o.id ? (
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <input
                          type="date"
                          value={followUpValue}
                          onChange={e => setFollowUpValue(e.target.value)}
                          style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #3498db', fontSize: '13px' }}
                          autoFocus
                        />
                        <button
                          onClick={() => handleFollowUpSave(o.id)}
                          style={{ backgroundColor: '#27ae60', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => setEditingFollowUp(null)}
                          style={{ backgroundColor: '#fff', color: '#888', border: '1px solid #ddd', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{ color: o.follow_up_date && o.follow_up_date <= new Date().toLocaleDateString('en-CA') ? '#e74c3c' : '#333', cursor: 'pointer' }}
                          onClick={() => { setEditingFollowUp(o.id); setFollowUpValue(o.follow_up_date || '') }}
                        >
                          {o.follow_up_date || '—'}
                        </span>
                        <button
                          onClick={() => { setEditingFollowUp(o.id); setFollowUpValue(o.follow_up_date || '') }}
                          style={{ backgroundColor: '#f0f0f0', border: '1px solid #ddd', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', color: '#555' }}
                        >
                          ✏️
                        </button>
                      </div>
                    )}
                  </td>
                  <td style={styles.td}>
                    <button onClick={() => toggleExpand(o)} style={styles.detailBtn}>
                      {expandedOrder === o.id ? '▲ Hide' : '▼ Details'}
                    </button>
                    <button onClick={() => openEditForm(o)} style={{ ...styles.editBtn, marginLeft: '6px' }}>
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        window.open(`http://localhost:5000/api/pdf/bill/${o.id}`, '_blank')
                      }}
                      style={{
                        backgroundColor: '#fff',
                        color: '#8e44ad',
                        border: '1px solid #8e44ad',
                        padding: '5px 12px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        marginLeft: '6px'
                      }}
                    >
                      📄 Bill
                    </button>
                    <button
                      onClick={() => {
                        if (!o.phone) return setMessage('Customer has no phone number.')
                        sendBillWhatsApp(o.id)
                          .then(res => setMessage(res.data.message))
                          .catch(err => setMessage('WhatsApp error: ' + (err.response?.data?.error || 'Not connected')))
                      }}
                      style={{
                        backgroundColor: waStatus === 'ready' ? '#25D366' : '#ccc',
                        color: '#fff',
                        border: 'none',
                        padding: '5px 12px',
                        borderRadius: '4px',
                        cursor: waStatus === 'ready' ? 'pointer' : 'not-allowed',
                        fontSize: '12px',
                        marginLeft: '6px'
                      }}
                      title={waStatus === 'ready' ? 'Send bill on WhatsApp' : 'WhatsApp not connected'}
                    >
                      📱 WA
                    </button>
                    <button onClick={() => handleDeleteOrder(o)} style={{ ...styles.deleteBtn, marginLeft: '6px' }}>
                      Delete
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
                              <tr style={{ backgroundColor: '#f0f7ff' }}>
                                <td colSpan="3" style={{ ...styles.innerTd, fontWeight: 'bold', textAlign: 'right' }}>Total:</td>
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
                              {orderDetail.advance_paid > 0 && (
                                <tr style={{ backgroundColor: '#fff9e6' }}>
                                  <td style={styles.innerTd}>1</td>
                                  <td style={styles.innerTd}>
                                    {orderDetail.created_at ? (() => {
                                      const d = new Date(orderDetail.created_at)
                                      const date = d.toLocaleDateString('en-GB').replace(/\//g, '.')
                                      const time = d.toLocaleTimeString('en-GB', { hour12: false })
                                      return <span>{time}<br /><span style={{ fontSize: '11px', color: '#888' }}>{date}</span></span>
                                    })() : '—'}
                                  </td>
                                  <td style={styles.innerTd}><strong>₹{orderDetail.advance_paid}</strong></td>
                                  <td style={styles.innerTd}>
                                    <span style={styles.advanceBadge}>Advance</span>
                                    {orderDetail.advance_payment_mode && (
                                      <span style={{
                                        ...styles.advanceBadge,
                                        marginLeft: '6px',
                                        backgroundColor: orderDetail.advance_payment_mode === 'upi' ? '#e3f2fd' : '#e8f5e9',
                                        color: orderDetail.advance_payment_mode === 'upi' ? '#1565c0' : '#2e7d32'
                                      }}>
                                        {orderDetail.advance_payment_mode === 'upi' ? '📱 UPI' : '💵 Cash'}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              )}
                              {orderDetail.payments && orderDetail.payments.map((p, i) => (
                                <tr key={p.id}>
                                  <td style={styles.innerTd}>{(orderDetail.advance_paid > 0 ? 2 : 1) + i}</td>
                                  <td style={styles.innerTd}>
                                    {(p.created_at || p.payment_date) ? (() => {
                                      const d = new Date(p.created_at || p.payment_date)
                                      if (isNaN(d)) return p.created_at || p.payment_date
                                      const date = d.toLocaleDateString('en-GB').replace(/\//g, '.')
                                      const time = d.toLocaleTimeString('en-GB', { hour12: false })
                                      return <span>{time}<br /><span style={{ fontSize: '11px', color: '#888' }}>{date}</span></span>
                                    })() : '—'}
                                  </td>
                                  <td style={styles.innerTd}><strong>₹{p.amount}</strong></td>
                                  <td style={styles.innerTd}>
                                    {p.note || '—'}
                                    {p.payment_mode && (
                                      <span style={{
                                        ...styles.advanceBadge,
                                        marginLeft: '6px',
                                        backgroundColor: p.payment_mode === 'upi' ? '#e3f2fd' : '#e8f5e9',
                                        color: p.payment_mode === 'upi' ? '#1565c0' : '#2e7d32'
                                      }}>
                                        {p.payment_mode === 'upi'
                                          ? `📱 ${p.upi_account || 'UPI'}`
                                          : '💵 Cash'}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                              {orderDetail.discount_amount > 0 && (
                                <tr style={{ backgroundColor: '#fff8e1' }}>
                                  <td colSpan="2" style={{ ...styles.innerTd, fontWeight: 'bold', color: '#e67e22' }}>
                                    ✂ Discount {orderDetail.discount_note ? `(${orderDetail.discount_note})` : '(Round-off)'}
                                  </td>
                                  <td colSpan="2" style={{ ...styles.innerTd, fontWeight: 'bold', color: '#e67e22' }}>
                                    - ₹{orderDetail.discount_amount}
                                  </td>
                                </tr>
                              )}
                              <tr style={{ backgroundColor: '#f0fff4' }}>
                                <td colSpan="2" style={{ ...styles.innerTd, fontWeight: 'bold' }}>Balance Due</td>
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

                              {/* Discount toggle */}
                              <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <label style={{ fontSize: '13px', color: '#888' }}>
                                  Kuch amount discount karna hai?
                                </label>
                                <button
                                  type="button"
                                  onClick={() => setPaymentForm(f => ({ ...f, showDiscount: !f.showDiscount, discount_amount: '', discount_note: '' }))}
                                  style={{
                                    padding: '4px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
                                    backgroundColor: paymentForm.showDiscount ? '#e67e22' : '#f0f0f0',
                                    color: paymentForm.showDiscount ? '#fff' : '#333',
                                    border: '1px solid #ddd'
                                  }}
                                >
                                  ✂ {paymentForm.showDiscount ? 'Discount ON' : 'Discount OFF'}
                                </button>
                              </div>

                              {paymentForm.showDiscount && (
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', alignItems: 'center', backgroundColor: '#fff8e1', padding: '10px', borderRadius: '8px' }}>
                                  <span style={{ fontSize: '13px', color: '#e67e22', fontWeight: 'bold', whiteSpace: 'nowrap' }}>✂ Discount:</span>
                                  <input
                                    style={{ ...styles.input, maxWidth: '130px' }}
                                    type="number" placeholder="Amount ₹"
                                    value={paymentForm.discount_amount || ''}
                                    onChange={e => setPaymentForm({ ...paymentForm, discount_amount: e.target.value })}
                                  />
                                  <input
                                    style={{ ...styles.input, flex: 2 }}
                                    placeholder="Note (e.g. round-off, 15 rs maafi)"
                                    value={paymentForm.discount_note || ''}
                                    onChange={e => setPaymentForm({ ...paymentForm, discount_note: e.target.value })}
                                  />
                                  <span style={{ fontSize: '13px', color: '#888', whiteSpace: 'nowrap' }}>
                                    Remaining: ₹{Math.max(0, orderDetail.balance_due - (parseFloat(paymentForm.discount_amount) || 0) - (parseFloat(paymentForm.amount) || 0))}
                                  </span>
                                </div>
                              )}

                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                
                                {/* Amount */}
                                <input
                                  style={{ ...styles.input, maxWidth: '150px' }}
                                  type="number" placeholder="Amount ₹"
                                  value={paymentForm.amount}
                                  onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                                />

                                {/* Date */}
                                <input
                                  style={{ ...styles.input, maxWidth: '160px' }}
                                  type="date"
                                  value={paymentForm.payment_date}
                                  onChange={e => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                                />

                                {/* Note */}
                                <input
                                  style={{ ...styles.input, flex: 2 }}
                                  placeholder="Note (e.g. final payment)"
                                  value={paymentForm.note}
                                  onChange={e => setPaymentForm({ ...paymentForm, note: e.target.value })}
                                />

                                {/* ✅ NEW: Payment Mode toggle */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <label style={{ fontSize: '11px', color: '#888' }}>Payment Mode</label>
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    <button
                                      type="button"
                                      onClick={() => setPaymentForm(f => ({ ...f, payment_mode: 'cash', upi_account: '' }))}
                                      style={{
                                        padding: '8px 14px', borderRadius: '6px', border: '1px solid #ddd',
                                        backgroundColor: paymentForm.payment_mode === 'cash' ? '#27ae60' : '#fff',
                                        color: paymentForm.payment_mode === 'cash' ? '#fff' : '#333',
                                        cursor: 'pointer', fontSize: '13px', fontWeight: '500'
                                      }}
                                    >
                                      💵 Cash
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setPaymentForm(f => ({ ...f, payment_mode: 'upi' }))}
                                      style={{
                                        padding: '8px 14px', borderRadius: '6px', border: '1px solid #ddd',
                                        backgroundColor: paymentForm.payment_mode === 'upi' ? '#1565c0' : '#fff',
                                        color: paymentForm.payment_mode === 'upi' ? '#fff' : '#333',
                                        cursor: 'pointer', fontSize: '13px', fontWeight: '500'
                                      }}
                                    >
                                      📱 UPI
                                    </button>
                                  </div>
                                </div>

                                {/* ✅ NEW: UPI account selector — sirf jab UPI select ho */}
                                {paymentForm.payment_mode === 'upi' && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <label style={{ fontSize: '11px', color: '#888' }}>UPI Account *</label>
                                    <select
                                      style={{ ...styles.input, minWidth: '200px' }}
                                      value={paymentForm.upi_account}
                                      onChange={e => setPaymentForm({ ...paymentForm, upi_account: e.target.value })}
                                      required
                                    >
                                      <option value="">Select Account</option>
                                      {UPI_ACCOUNTS.map(acc => (
                                        <option key={acc} value={acc}>{acc}</option>
                                      ))}
                                    </select>
                                  </div>
                                )}

                                {/* Next Follow-up */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <label style={{ fontSize: '11px', color: '#888' }}>Next Follow-up</label>
                                  <input
                                    style={{ ...styles.input, maxWidth: '160px' }}
                                    type="date"
                                    value={paymentForm.follow_up_date || ''}
                                    onChange={e => setPaymentForm({ ...paymentForm, follow_up_date: e.target.value })}
                                  />
                                </div>

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
  deleteBtn: { backgroundColor: '#fff', color: '#e74c3c', border: '1px solid #e74c3c', padding: '5px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' },
  addItemBtn: { backgroundColor: '#f0f0f0', border: '1px solid #ddd', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', marginTop: '4px' },
  totalsBox: { backgroundColor: '#f8f8f8', padding: '16px', borderRadius: '8px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '460px' },
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
  paymentForm: { marginTop: '12px', padding: '12px', backgroundColor: '#f9f9f9', borderRadius: '8px' },
  modeBtn: { padding: '8px 16px', borderRadius: '6px', border: '1px solid #ddd', backgroundColor: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '500' },
  modeBtnActive: { backgroundColor: '#1a1a2e', color: '#fff', border: '1px solid #1a1a2e' },
  requiredDot: { color: '#e74c3c', fontSize: '16px', lineHeight: 1 }
}

export default Orders
