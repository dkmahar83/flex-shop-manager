import { useState, useEffect } from 'react'
import {
  getFlexStock, addFlexStock, useFlexStock as consumeFlexStock, updateFlexStock, deleteFlexStock,
  getStamps, addStamp, updateStamp, deleteStamp,
  getChemicals, addChemical, updateChemical, deleteChemical,
  getFrames, addFrame, updateFrame, deleteFrame,
  getInkStock, addInkStock, updateInkStock, deleteInkStock
} from '../services/api'

const FLEX_BRANDS = [
  'Normal (180 GSM)', 'Jindal (220 GSM)', 'Black Back', 'Star (300 GSM)',
  'Vinayal', 'One Way Vision', 'Radium', 'Retro Flex', 'Retro Gumming', 'Other'
]
const INK_COLOR_MAP = {
  'Cyan': '#00bcd4',
  'Magenta': '#e91e93',
  'Yellow': '#f5c518',
  'Black': '#333333',
  'Solvent': '#27ae60',
  'Other': '#9b59b6'
}
const FLEX_SIZES = [3, 4, 5, 6, 8, 10]
const INK_COLORS = ['Cyan', 'Magenta', 'Yellow', 'Black']

function Inventory() {
  const [activeTab, setActiveTab] = useState('flex')
  const [message, setMessage] = useState('')
  const [msgType, setMsgType] = useState('success')

  // Flex
  const [flexStock, setFlexStock] = useState([])
  const [showFlexForm, setShowFlexForm] = useState(false)
  const [flexForm, setFlexForm] = useState({ brand: '', size_ft: '', quantity: '', notes: '' })
  const [useForm, setUseForm] = useState({ id: null, quantity: '', notes: '' })
  const [showUseModal, setShowUseModal] = useState(false)
  const [editFlex, setEditFlex] = useState(null)

  // Stamps — separate restock form from edit form
  const [stamps, setStamps] = useState([])
  const [showStampForm, setShowStampForm] = useState(false)
  const [stampForm, setStampForm] = useState({ stamp_type: '', size: '', design_type: '', quantity_to_add: '', notes: '' })
  const [editStamp, setEditStamp] = useState(null)

  // Chemicals — separate restock form from edit form
  const [chemicals, setChemicals] = useState([])
  const [showChemForm, setShowChemForm] = useState(false)
  const [chemForm, setChemForm] = useState({ chemical_name: '', quantity_to_add: '', unit: 'litre', items_per_box: '', minimum_stock: '', notes: '' })
  const [editChem, setEditChem] = useState(null)

  // Frames — separate restock form from edit form
  const [frames, setFrames] = useState([])
  const [showFrameForm, setShowFrameForm] = useState(false)
  const [frameForm, setFrameForm] = useState({ frame_type: '', size: '', design: '', quantity_to_add: '', notes: '' })
  const [editFrame, setEditFrame] = useState(null)

  // Ink — separate restock form from edit form
  const [inkStock, setInkStock] = useState([])
  const [showInkForm, setShowInkForm] = useState(false)
  const [inkForm, setInkForm] = useState({ item_name: '', item_type: 'ink', quantity_to_add: '', unit: 'litre', minimum_level: '', notes: '' })
  const [editInk, setEditInk] = useState(null)

  function fetchAll() {
    getFlexStock().then(r => setFlexStock(r.data)).catch(() => {})
    getStamps().then(r => setStamps(r.data)).catch(() => {})
    getChemicals().then(r => setChemicals(r.data)).catch(() => {})
    getFrames().then(r => setFrames(r.data)).catch(() => {})
    getInkStock().then(r => setInkStock(r.data)).catch(() => {})
  }

  useEffect(() => { fetchAll() }, [])

  function showMsg(text, type = 'success') {
    setMessage(text); setMsgType(type)
    setTimeout(() => setMessage(''), 3000)
  }

  // ── FLEX (unchanged — reference implementation) ──
  function handleAddFlex(e) {
    e.preventDefault()
    if (!flexForm.brand || !flexForm.size_ft || !flexForm.quantity) return showMsg('All fields required', 'error')
    addFlexStock(flexForm).then(() => {
      showMsg('Flex stock added/updated')
      setFlexForm({ brand: '', size_ft: '', quantity: '', notes: '' })
      setShowFlexForm(false)
      getFlexStock().then(r => setFlexStock(r.data))
    }).catch(() => showMsg('Error adding flex stock', 'error'))
  }

  function handleUseFlex(e) {
    e.preventDefault()
    if (!useForm.quantity) return showMsg('Enter quantity to use', 'error')
    consumeFlexStock(useForm.id, { quantity: useForm.quantity, notes: useForm.notes })
      .then(() => {
        showMsg('Stock reduced')
        setShowUseModal(false)
        setUseForm({ id: null, quantity: '', notes: '' })
        getFlexStock().then(r => setFlexStock(r.data))
      }).catch(err => showMsg(err.response?.data?.error || 'Error', 'error'))
  }

  function handleUpdateFlex(e) {
    e.preventDefault()
    updateFlexStock(editFlex.id, editFlex).then(() => {
      showMsg('Updated'); setEditFlex(null)
      getFlexStock().then(r => setFlexStock(r.data))
    }).catch(() => showMsg('Error', 'error'))
  }

  const flexByBrand = flexStock.reduce((acc, item) => {
    if (!acc[item.brand]) acc[item.brand] = {}
    acc[item.brand][item.size_ft] = item
    return acc
  }, {})

  // ── STAMPS ──
  // Restock: upsert by stamp_type + size + design_type
  function handleStampRestock(e) {
    e.preventDefault()
    const { stamp_type, size, design_type, quantity_to_add, notes } = stampForm
    if (!stamp_type || !quantity_to_add) return showMsg('Stamp type and quantity required', 'error')
    const qty = parseFloat(quantity_to_add)
    if (isNaN(qty) || qty <= 0) return showMsg('Enter a valid quantity', 'error')

    const existing = stamps.find(s =>
      s.stamp_type.trim().toLowerCase() === stamp_type.trim().toLowerCase() &&
      (s.size || '').trim().toLowerCase() === (size || '').trim().toLowerCase() &&
      (s.design_type || '').trim().toLowerCase() === (design_type || '').trim().toLowerCase()
    )

    if (existing) {
      updateStamp(existing.id, { ...existing, quantity: existing.quantity + qty, notes: notes || existing.notes })
        .then(() => {
          showMsg(`✅ ${stamp_type} updated: ${existing.quantity} → ${existing.quantity + qty}`)
          setStampForm({ stamp_type: '', size: '', design_type: '', quantity_to_add: '', notes: '' })
          setShowStampForm(false)
          getStamps().then(r => setStamps(r.data))
        }).catch(() => showMsg('Error updating stamp', 'error'))
    } else {
      addStamp({ stamp_type, size, design_type, quantity: qty, notes })
        .then(() => {
          showMsg(`✅ New stamp added: ${stamp_type}`)
          setStampForm({ stamp_type: '', size: '', design_type: '', quantity_to_add: '', notes: '' })
          setShowStampForm(false)
          getStamps().then(r => setStamps(r.data))
        }).catch(() => showMsg('Error adding stamp', 'error'))
    }
  }

  // Edit: direct update of existing stamp details/quantity
  function handleStampEdit(e) {
    e.preventDefault()
    updateStamp(editStamp.id, editStamp).then(() => {
      showMsg('Stamp updated')
      setEditStamp(null)
      getStamps().then(r => setStamps(r.data))
    }).catch(() => showMsg('Error', 'error'))
  }

  // ── CHEMICALS ──
  // Restock: upsert by chemical_name
  function handleChemRestock(e) {
    e.preventDefault()
    const { chemical_name, quantity_to_add, unit, items_per_box, minimum_stock, notes } = chemForm
    if (!chemical_name || !quantity_to_add) return showMsg('Chemical name and quantity required', 'error')
    const qty = parseFloat(quantity_to_add)
    if (isNaN(qty) || qty <= 0) return showMsg('Enter a valid quantity', 'error')

    const existing = chemicals.find(c =>
      c.chemical_name.trim().toLowerCase() === chemical_name.trim().toLowerCase()
    )

    if (existing) {
      const payload = {
        ...existing,
        quantity: existing.quantity + qty,
        notes: notes || existing.notes,
        minimum_stock: minimum_stock || existing.minimum_stock,
        items_per_box: unit === 'box' ? items_per_box : existing.items_per_box
      }
      updateChemical(existing.id, payload)
        .then(() => {
          showMsg(`✅ ${chemical_name} updated: ${existing.quantity} → ${existing.quantity + qty}`)
          setChemForm({ chemical_name: '', quantity_to_add: '', unit: 'litre', items_per_box: '', minimum_stock: '', notes: '' })
          setShowChemForm(false)
          getChemicals().then(r => setChemicals(r.data))
        }).catch(() => showMsg('Error updating chemical', 'error'))
    } else {
      const payload = {
        chemical_name, quantity: qty, unit,
        items_per_box: unit === 'box' ? items_per_box : null,
        minimum_stock, notes
      }
      addChemical(payload)
        .then(() => {
          showMsg(`✅ New chemical added: ${chemical_name}`)
          setChemForm({ chemical_name: '', quantity_to_add: '', unit: 'litre', items_per_box: '', minimum_stock: '', notes: '' })
          setShowChemForm(false)
          getChemicals().then(r => setChemicals(r.data))
        }).catch(() => showMsg('Error adding chemical', 'error'))
    }
  }

  // Edit: direct update of existing chemical details/quantity
  function handleChemEdit(e) {
    e.preventDefault()
    const payload = { ...editChem, items_per_box: editChem.unit === 'box' ? editChem.items_per_box : null }
    updateChemical(editChem.id, payload).then(() => {
      showMsg('Chemical updated')
      setEditChem(null)
      getChemicals().then(r => setChemicals(r.data))
    }).catch(() => showMsg('Error', 'error'))
  }

  function chemQtyDisplay(c) {
    if (c.unit === 'box' && c.items_per_box && c.items_per_box > 0) {
      return `${c.quantity} Box (${c.quantity * c.items_per_box} pcs)`
    }
    return `${c.quantity}`
  }

  // ── FRAMES ──
  // Restock: upsert by frame_type + size + design
  function handleFrameRestock(e) {
    e.preventDefault()
    const { frame_type, size, design, quantity_to_add, notes } = frameForm
    if (!frame_type || !quantity_to_add) return showMsg('Frame type and quantity required', 'error')
    const qty = parseFloat(quantity_to_add)
    if (isNaN(qty) || qty <= 0) return showMsg('Enter a valid quantity', 'error')

    const existing = frames.find(f =>
      f.frame_type.trim().toLowerCase() === frame_type.trim().toLowerCase() &&
      (f.size || '').trim().toLowerCase() === (size || '').trim().toLowerCase() &&
      (f.design || '').trim().toLowerCase() === (design || '').trim().toLowerCase()
    )

    if (existing) {
      updateFrame(existing.id, { ...existing, quantity: existing.quantity + qty, notes: notes || existing.notes })
        .then(() => {
          showMsg(`✅ ${frame_type} updated: ${existing.quantity} → ${existing.quantity + qty}`)
          setFrameForm({ frame_type: '', size: '', design: '', quantity_to_add: '', notes: '' })
          setShowFrameForm(false)
          getFrames().then(r => setFrames(r.data))
        }).catch(() => showMsg('Error updating frame', 'error'))
    } else {
      addFrame({ frame_type, size, design, quantity: qty, notes })
        .then(() => {
          showMsg(`✅ New frame added: ${frame_type}`)
          setFrameForm({ frame_type: '', size: '', design: '', quantity_to_add: '', notes: '' })
          setShowFrameForm(false)
          getFrames().then(r => setFrames(r.data))
        }).catch(() => showMsg('Error adding frame', 'error'))
    }
  }

  // Edit: direct update of existing frame details/quantity
  function handleFrameEdit(e) {
    e.preventDefault()
    updateFrame(editFrame.id, editFrame).then(() => {
      showMsg('Frame updated')
      setEditFrame(null)
      getFrames().then(r => setFrames(r.data))
    }).catch(() => showMsg('Error', 'error'))
  }

  // ── INK & SOLVENT ──
  // Restock: upsert by item_type + item_name
  function handleInkRestock(e) {
    e.preventDefault()
    const { item_name, item_type, quantity_to_add, unit, minimum_level, notes } = inkForm
    if (!item_name || !quantity_to_add) return showMsg('Item name and quantity required', 'error')
    const qty = parseFloat(quantity_to_add)
    if (isNaN(qty) || qty <= 0) return showMsg('Enter a valid quantity', 'error')

    const existing = inkStock.find(i =>
      i.item_type === item_type &&
      i.item_name.trim().toLowerCase() === item_name.trim().toLowerCase()
    )

    if (existing) {
      updateInkStock(existing.id, {
        ...existing,
        quantity: existing.quantity + qty,
        notes: notes || existing.notes,
        minimum_level: minimum_level || existing.minimum_level
      })
        .then(() => {
          showMsg(`✅ ${item_name} updated: ${existing.quantity} → ${existing.quantity + qty}`)
          setInkForm({ item_name: '', item_type: 'ink', quantity_to_add: '', unit: 'litre', minimum_level: '', notes: '' })
          setShowInkForm(false)
          getInkStock().then(r => setInkStock(r.data))
        }).catch(() => showMsg('Error updating ink', 'error'))
    } else {
      addInkStock({ item_name, item_type, quantity: qty, unit, minimum_level, notes })
        .then(() => {
          showMsg(`✅ New item added: ${item_name}`)
          setInkForm({ item_name: '', item_type: 'ink', quantity_to_add: '', unit: 'litre', minimum_level: '', notes: '' })
          setShowInkForm(false)
          getInkStock().then(r => setInkStock(r.data))
        }).catch(() => showMsg('Error adding ink', 'error'))
    }
  }

  // Edit: direct update of existing ink details/quantity
  function handleInkEdit(e) {
    e.preventDefault()
    updateInkStock(editInk.id, editInk).then(() => {
      showMsg('Updated')
      setEditInk(null)
      getInkStock().then(r => setInkStock(r.data))
    }).catch(() => showMsg('Error', 'error'))
  }

  const inkItems = inkStock.filter(i => i.item_type === 'ink')
  const solventItems = inkStock.filter(i => i.item_type === 'solvent')

  return (
    <div>
      <div style={styles.header}>
        <h2>📦 Inventory</h2>
      </div>

      {message && (
        <p style={{ ...styles.msg, ...(msgType === 'error' ? styles.msgErr : {}) }}
          onClick={() => setMessage('')}>{message}</p>
      )}

      {/* TABS */}
      <div style={styles.tabRow}>
        {[
          ['flex', '🖼️ Flex Rolls'],
          ['stamps', '🔖 Stamps'],
          ['chemicals', '🧪 Chemicals'],
          ['frames', '🖼 Photo Frames'],
          ['ink', '🖨️ Ink & Solvent']
        ].map(([key, label]) => (
          <button key={key}
            style={{ ...styles.tab, ...(activeTab === key ? styles.activeTab : {}) }}
            onClick={() => setActiveTab(key)}
          >{label}</button>
        ))}
      </div>

      {/* ══ FLEX ROLLS TAB ══ */}
      {activeTab === 'flex' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '16px' }}>
            <button style={styles.addBtn} onClick={() => setShowFlexForm(!showFlexForm)}>
              {showFlexForm ? 'Cancel' : '+ Add Stock'}
            </button>
          </div>

          {showFlexForm && (
            <div style={styles.formBox}>
              <h3 style={{ marginBottom: '16px' }}>Add / Restock Flex Roll</h3>
              <form onSubmit={handleAddFlex}>
                <div style={styles.formRow}>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Brand / Type *</label>
                    <select style={styles.input} value={flexForm.brand}
                      onChange={e => setFlexForm({ ...flexForm, brand: e.target.value })}>
                      <option value="">Select Brand</option>
                      {FLEX_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Size (ft) *</label>
                    <select style={styles.input} value={flexForm.size_ft}
                      onChange={e => setFlexForm({ ...flexForm, size_ft: e.target.value })}>
                      <option value="">Select Size</option>
                      {FLEX_SIZES.map(s => <option key={s} value={s}>{s} ft</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Rolls to Add *</label>
                    <input style={styles.input} type="number" placeholder="0"
                      value={flexForm.quantity}
                      onChange={e => setFlexForm({ ...flexForm, quantity: e.target.value })} />
                  </div>
                  <div style={{ flex: 2 }}>
                    <label style={styles.label}>Notes</label>
                    <input style={styles.input} placeholder="e.g. New batch from Delhi"
                      value={flexForm.notes}
                      onChange={e => setFlexForm({ ...flexForm, notes: e.target.value })} />
                  </div>
                </div>
                <button style={styles.submitBtn} type="submit">Save Stock</button>
              </form>
            </div>
          )}

          {editFlex && (
            <div style={{ ...styles.formBox, borderLeft: '4px solid #f39c12' }}>
              <h3 style={{ marginBottom: '12px' }}>✏️ Edit: {editFlex.brand} {editFlex.size_ft}ft</h3>
              <form onSubmit={handleUpdateFlex}>
                <div style={styles.formRow}>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Quantity (Rolls)</label>
                    <input style={styles.input} type="number" value={editFlex.quantity}
                      onChange={e => setEditFlex({ ...editFlex, quantity: e.target.value })} />
                  </div>
                  <div style={{ flex: 2 }}>
                    <label style={styles.label}>Notes</label>
                    <input style={styles.input} value={editFlex.notes || ''}
                      onChange={e => setEditFlex({ ...editFlex, notes: e.target.value })} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button style={styles.submitBtn} type="submit">Save</button>
                  <button style={{ ...styles.submitBtn, backgroundColor: '#888' }} type="button" onClick={() => setEditFlex(null)}>Cancel</button>
                </div>
              </form>
            </div>
          )}

          {showUseModal && (
            <div style={styles.modal}>
              <div style={styles.modalBox}>
                <h3 style={{ marginBottom: '16px' }}>📤 Use Flex Stock</h3>
                <form onSubmit={handleUseFlex}>
                  <label style={styles.label}>Rolls Used *</label>
                  <input style={{ ...styles.input, marginBottom: '12px' }} type="number" placeholder="e.g. 2"
                    value={useForm.quantity}
                    onChange={e => setUseForm({ ...useForm, quantity: e.target.value })} />
                  <label style={styles.label}>Notes</label>
                  <input style={{ ...styles.input, marginBottom: '16px' }} placeholder="e.g. Used for Vijay Flex order"
                    value={useForm.notes}
                    onChange={e => setUseForm({ ...useForm, notes: e.target.value })} />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button style={styles.submitBtn} type="submit">Confirm Use</button>
                    <button style={{ ...styles.submitBtn, backgroundColor: '#888' }} type="button"
                      onClick={() => { setShowUseModal(false); setUseForm({ id: null, quantity: '', notes: '' }) }}>
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {Object.keys(flexByBrand).length === 0 ? (
            <p style={{ color: '#888', padding: '20px' }}>No flex stock added yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Brand / Type</th>
                    {FLEX_SIZES.map(s => <th key={s} style={{ ...styles.th, textAlign: 'center' }}>{s} ft</th>)}
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(flexByBrand).map(([brand, sizes]) => (
                    <tr key={brand} style={styles.tr}>
                      <td style={{ ...styles.td, fontWeight: 'bold' }}>{brand}</td>
                      {FLEX_SIZES.map(s => {
                        const item = sizes[s]
                        return (
                          <td key={s} style={{ ...styles.td, textAlign: 'center' }}>
                            {item ? (
                              <div>
                                <span style={{
                                  fontWeight: 'bold', fontSize: '16px',
                                  color: item.quantity === 0 ? '#e74c3c' : item.quantity === 1 ? '#f39c12' : '#27ae60'
                                }}>
                                  {item.quantity}
                                </span>
                                <div style={{ fontSize: '10px', color: '#aaa' }}>rolls</div>
                              </div>
                            ) : (
                              <span style={{ color: '#ddd' }}>—</span>
                            )}
                          </td>
                        )
                      })}
                      <td style={styles.td}>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {Object.values(sizes).map(item => (
                            <div key={item.id} style={{ display: 'flex', gap: '4px', marginBottom: '2px' }}>
                              <button style={styles.useBtn}
                                onClick={() => { setUseForm({ id: item.id, quantity: '', notes: '' }); setShowUseModal(true) }}>
                                📤 {item.size_ft}ft
                              </button>
                              <button style={{ backgroundColor: '#3e88dd', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                                onClick={() => {
                                  if (item.quantity <= 0) return
                                  updateFlexStock(item.id, { ...item, quantity: item.quantity - 1 })
                                    .then(() => getFlexStock().then(r => setFlexStock(r.data)))
                                }}>−1</button>
                              <button style={styles.editBtn} onClick={() => setEditFlex({ ...item })}>✏️</button>
                              <button style={styles.delBtn} onClick={() => {
                                if (window.confirm('Delete?')) deleteFlexStock(item.id).then(() => getFlexStock().then(r => setFlexStock(r.data)))
                              }}>✕</button>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {flexStock.filter(f => f.quantity === 1).length > 0 && (
            <div style={styles.warningBox}>
              ⚠️ Low Stock: {flexStock.filter(f => f.quantity === 1)
                .map(f => `${f.brand} ${f.size_ft}ft (${f.quantity} left)`).join(', ')}
            </div>
          )}
          {flexStock.filter(f => f.quantity === 0).length > 0 && (
            <div style={{ ...styles.warningBox, backgroundColor: '#fff0f0', borderColor: '#e74c3c', color: '#c0392b' }}>
              🚨 Out of Stock: {flexStock.filter(f => f.quantity === 0)
                .map(f => `${f.brand} ${f.size_ft}ft`).join(', ')}
            </div>
          )}
        </div>
      )}

      {/* ══ STAMPS TAB ══ */}
      {activeTab === 'stamps' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button style={styles.addBtn} onClick={() => { setShowStampForm(!showStampForm); setEditStamp(null) }}>
              {showStampForm ? 'Cancel' : '+ Add / Restock'}
            </button>
          </div>

          {/* ADD / RESTOCK FORM */}
          {showStampForm && !editStamp && (
            <div style={styles.formBox}>
              <h3 style={{ marginBottom: '16px' }}>Add / Restock Stamp</h3>
              <p style={styles.formHint}>If this stamp type already exists, quantity will be added to existing stock.</p>
              <form onSubmit={handleStampRestock}>
                <div style={styles.formRow}>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Stamp Type *</label>
                    <input style={styles.input} placeholder="e.g. Pre-Inked, Self-Inking, Wooden"
                      value={stampForm.stamp_type}
                      onChange={e => setStampForm({ ...stampForm, stamp_type: e.target.value })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Size</label>
                    <input style={styles.input} placeholder="e.g. 38x14mm, 47x18mm"
                      value={stampForm.size}
                      onChange={e => setStampForm({ ...stampForm, size: e.target.value })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Design Type</label>
                    <input style={styles.input} placeholder="e.g. Round, Square, Custom"
                      value={stampForm.design_type}
                      onChange={e => setStampForm({ ...stampForm, design_type: e.target.value })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Quantity to Add *</label>
                    <input style={styles.input} type="number" placeholder="0"
                      value={stampForm.quantity_to_add}
                      onChange={e => setStampForm({ ...stampForm, quantity_to_add: e.target.value })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Notes</label>
                    <input style={styles.input} placeholder="Optional"
                      value={stampForm.notes}
                      onChange={e => setStampForm({ ...stampForm, notes: e.target.value })} />
                  </div>
                </div>
                <button style={styles.submitBtn} type="submit">Save Stock</button>
              </form>
            </div>
          )}

          {/* EDIT FORM (correction only) */}
          {editStamp && (
            <div style={{ ...styles.formBox, borderLeft: '4px solid #f39c12' }}>
              <h3 style={{ marginBottom: '12px' }}>✏️ Edit: {editStamp.stamp_type}</h3>
              <p style={styles.formHint}>Use this only to correct details or fix quantity. For stock arrivals, use Add / Restock.</p>
              <form onSubmit={handleStampEdit}>
                <div style={styles.formRow}>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Stamp Type</label>
                    <input style={styles.input} value={editStamp.stamp_type}
                      onChange={e => setEditStamp({ ...editStamp, stamp_type: e.target.value })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Size</label>
                    <input style={styles.input} value={editStamp.size || ''}
                      onChange={e => setEditStamp({ ...editStamp, size: e.target.value })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Design Type</label>
                    <input style={styles.input} value={editStamp.design_type || ''}
                      onChange={e => setEditStamp({ ...editStamp, design_type: e.target.value })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Quantity (actual)</label>
                    <input style={styles.input} type="number" value={editStamp.quantity}
                      onChange={e => setEditStamp({ ...editStamp, quantity: e.target.value })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Notes</label>
                    <input style={styles.input} value={editStamp.notes || ''}
                      onChange={e => setEditStamp({ ...editStamp, notes: e.target.value })} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button style={styles.submitBtn} type="submit">Save Changes</button>
                  <button style={{ ...styles.submitBtn, backgroundColor: '#888' }} type="button" onClick={() => setEditStamp(null)}>Cancel</button>
                </div>
              </form>
            </div>
          )}

          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Stamp Type</th>
                <th style={styles.th}>Size</th>
                <th style={styles.th}>Design</th>
                <th style={styles.th}>Quantity</th>
                <th style={styles.th}>Notes</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {stamps.length === 0 ? (
                <tr><td colSpan="6" style={{ ...styles.td, textAlign: 'center', color: '#888' }}>No stamps added yet.</td></tr>
              ) : stamps.map(s => (
                <tr key={s.id} style={styles.tr}>
                  <td style={{ ...styles.td, fontWeight: 'bold' }}>{s.stamp_type}</td>
                  <td style={styles.td}>{s.size || '—'}</td>
                  <td style={styles.td}>{s.design_type || '—'}</td>
                  <td style={styles.td}>
                    <span style={{ fontWeight: 'bold', color: s.quantity === 0 ? '#e74c3c' : '#27ae60', fontSize: '16px' }}>
                      {s.quantity}
                    </span>
                  </td>
                  <td style={{ ...styles.td, fontSize: '12px', color: '#888' }}>{s.notes || '—'}</td>
                  <td style={styles.td}>
                    <button style={styles.reduceBtn}
                      onClick={() => {
                        if (s.quantity <= 0) return
                        updateStamp(s.id, { ...s, quantity: s.quantity - 1 })
                          .then(() => getStamps().then(r => setStamps(r.data)))
                      }}>−1</button>
                    <button style={{ ...styles.editBtn, marginLeft: '4px' }} onClick={() => { setEditStamp({ ...s }); setShowStampForm(false) }}>✏️</button>
                    <button style={{ ...styles.delBtn, marginLeft: '4px' }} onClick={() => {
                      if (window.confirm('Delete?')) deleteStamp(s.id).then(() => getStamps().then(r => setStamps(r.data)))
                    }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ══ CHEMICALS TAB ══ */}
      {activeTab === 'chemicals' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button style={styles.addBtn} onClick={() => { setShowChemForm(!showChemForm); setEditChem(null) }}>
              {showChemForm ? 'Cancel' : '+ Add / Restock'}
            </button>
          </div>

          {/* ADD / RESTOCK FORM */}
          {showChemForm && !editChem && (
            <div style={styles.formBox}>
              <h3 style={{ marginBottom: '16px' }}>Add / Restock Chemical</h3>
              <p style={styles.formHint}>If this chemical already exists, quantity will be added to existing stock.</p>
              <form onSubmit={handleChemRestock}>
                <div style={styles.formRow}>
                  <div style={{ flex: 2 }}>
                    <label style={styles.label}>Chemical Name *</label>
                    <input style={styles.input} placeholder="e.g. Bond, Hardener, Cleaning Liquid"
                      value={chemForm.chemical_name}
                      onChange={e => setChemForm({ ...chemForm, chemical_name: e.target.value })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Quantity to Add *</label>
                    <input style={styles.input} type="number" placeholder="0"
                      value={chemForm.quantity_to_add}
                      onChange={e => setChemForm({ ...chemForm, quantity_to_add: e.target.value })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Unit</label>
                    <select style={styles.input}
                      value={chemForm.unit}
                      onChange={e => setChemForm({ ...chemForm, unit: e.target.value, items_per_box: '' })}>
                      <option value="litre">Litre</option>
                      <option value="kg">KG</option>
                      <option value="bottle">Bottle</option>
                      <option value="tin">Tin</option>
                      <option value="pcs">Pcs</option>
                      <option value="box">📦 Box</option>
                    </select>
                  </div>
                  {chemForm.unit === 'box' && (
                    <div style={{ flex: 1 }}>
                      <label style={styles.label}>Items per Box *</label>
                      <input style={{ ...styles.input, borderColor: '#e94560' }}
                        type="number" placeholder="e.g. 25"
                        value={chemForm.items_per_box}
                        onChange={e => setChemForm({ ...chemForm, items_per_box: e.target.value })} />
                      {(chemForm.quantity_to_add && chemForm.items_per_box) && (
                        <div style={{ fontSize: '11px', color: '#27ae60', marginTop: '4px' }}>
                          ✅ Total: {chemForm.quantity_to_add * chemForm.items_per_box} pcs
                        </div>
                      )}
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Min Stock Alert</label>
                    <input style={styles.input} type="number" placeholder="0"
                      value={chemForm.minimum_stock}
                      onChange={e => setChemForm({ ...chemForm, minimum_stock: e.target.value })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Notes</label>
                    <input style={styles.input} placeholder="Optional"
                      value={chemForm.notes}
                      onChange={e => setChemForm({ ...chemForm, notes: e.target.value })} />
                  </div>
                </div>
                <button style={styles.submitBtn} type="submit">Save Stock</button>
              </form>
            </div>
          )}

          {/* EDIT FORM (correction only) */}
          {editChem && (
            <div style={{ ...styles.formBox, borderLeft: '4px solid #f39c12' }}>
              <h3 style={{ marginBottom: '12px' }}>✏️ Edit: {editChem.chemical_name}</h3>
              <p style={styles.formHint}>Use this only to correct details or fix quantity. For stock arrivals, use Add / Restock.</p>
              <form onSubmit={handleChemEdit}>
                <div style={styles.formRow}>
                  <div style={{ flex: 2 }}>
                    <label style={styles.label}>Chemical Name</label>
                    <input style={styles.input} value={editChem.chemical_name}
                      onChange={e => setEditChem({ ...editChem, chemical_name: e.target.value })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Quantity (actual)</label>
                    <input style={styles.input} type="number" value={editChem.quantity}
                      onChange={e => setEditChem({ ...editChem, quantity: e.target.value })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Unit</label>
                    <select style={styles.input} value={editChem.unit}
                      onChange={e => setEditChem({ ...editChem, unit: e.target.value, items_per_box: '' })}>
                      <option value="litre">Litre</option>
                      <option value="kg">KG</option>
                      <option value="bottle">Bottle</option>
                      <option value="tin">Tin</option>
                      <option value="pcs">Pcs</option>
                      <option value="box">📦 Box</option>
                    </select>
                  </div>
                  {editChem.unit === 'box' && (
                    <div style={{ flex: 1 }}>
                      <label style={styles.label}>Items per Box</label>
                      <input style={styles.input} type="number"
                        value={editChem.items_per_box || ''}
                        onChange={e => setEditChem({ ...editChem, items_per_box: e.target.value })} />
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Min Stock Alert</label>
                    <input style={styles.input} type="number" value={editChem.minimum_stock}
                      onChange={e => setEditChem({ ...editChem, minimum_stock: e.target.value })} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button style={styles.submitBtn} type="submit">Save Changes</button>
                  <button style={{ ...styles.submitBtn, backgroundColor: '#888' }} type="button" onClick={() => setEditChem(null)}>Cancel</button>
                </div>
              </form>
            </div>
          )}

          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Chemical</th>
                <th style={styles.th}>Quantity</th>
                <th style={styles.th}>Unit</th>
                <th style={styles.th}>Min Level</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {chemicals.length === 0 ? (
                <tr><td colSpan="6" style={{ ...styles.td, textAlign: 'center', color: '#888' }}>No chemicals added yet.</td></tr>
              ) : chemicals.map(c => (
                <tr key={c.id} style={styles.tr}>
                  <td style={{ ...styles.td, fontWeight: 'bold' }}>{c.chemical_name}</td>
                  <td style={{ ...styles.td, fontWeight: 'bold', fontSize: '15px', color: c.quantity <= c.minimum_stock ? '#e74c3c' : '#27ae60' }}>
                    {chemQtyDisplay(c)}
                  </td>
                  <td style={styles.td}>
                    {c.unit === 'box' ? '📦 Box' : c.unit}
                    {c.unit === 'box' && c.items_per_box && (
                      <div style={{ fontSize: '11px', color: '#888' }}>{c.items_per_box} pcs/box</div>
                    )}
                  </td>
                  <td style={styles.td}>{c.minimum_stock}</td>
                  <td style={styles.td}>
                    {c.quantity === 0
                      ? <span style={{ ...styles.badge, backgroundColor: '#e74c3c' }}>Out of Stock</span>
                      : c.quantity <= c.minimum_stock
                        ? <span style={{ ...styles.badge, backgroundColor: '#f39c12' }}>Low Stock</span>
                        : <span style={{ ...styles.badge, backgroundColor: '#27ae60' }}>OK</span>
                    }
                  </td>
                  <td style={styles.td}>
                    <button style={styles.reduceBtn}
                      onClick={() => {
                        if (c.quantity <= 0) return
                        updateChemical(c.id, { ...c, quantity: c.quantity - 1 })
                          .then(() => getChemicals().then(r => setChemicals(r.data)))
                      }}>−1</button>
                    <button style={{ ...styles.editBtn, marginLeft: '4px' }} onClick={() => { setEditChem({ ...c }); setShowChemForm(false) }}>✏️</button>
                    <button style={{ ...styles.delBtn, marginLeft: '4px' }} onClick={() => {
                      if (window.confirm('Delete?')) deleteChemical(c.id).then(() => getChemicals().then(r => setChemicals(r.data)))
                    }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ══ FRAMES TAB ══ */}
      {activeTab === 'frames' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button style={styles.addBtn} onClick={() => { setShowFrameForm(!showFrameForm); setEditFrame(null) }}>
              {showFrameForm ? 'Cancel' : '+ Add / Restock'}
            </button>
          </div>

          {/* ADD / RESTOCK FORM */}
          {showFrameForm && !editFrame && (
            <div style={styles.formBox}>
              <h3 style={{ marginBottom: '16px' }}>Add / Restock Photo Frame</h3>
              <p style={styles.formHint}>If this frame type + size + design already exists, quantity will be added to existing stock.</p>
              <form onSubmit={handleFrameRestock}>
                <div style={styles.formRow}>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Frame Type *</label>
                    <input style={styles.input} placeholder="e.g. Wooden, Premium, Basic"
                      value={frameForm.frame_type}
                      onChange={e => setFrameForm({ ...frameForm, frame_type: e.target.value })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Size</label>
                    <input style={styles.input} placeholder="e.g. 4x6, 5x7, 8x10"
                      value={frameForm.size}
                      onChange={e => setFrameForm({ ...frameForm, size: e.target.value })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Design</label>
                    <input style={styles.input} placeholder="e.g. Classic, Modern, Floral"
                      value={frameForm.design}
                      onChange={e => setFrameForm({ ...frameForm, design: e.target.value })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Quantity to Add *</label>
                    <input style={styles.input} type="number" placeholder="0"
                      value={frameForm.quantity_to_add}
                      onChange={e => setFrameForm({ ...frameForm, quantity_to_add: e.target.value })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Notes</label>
                    <input style={styles.input} placeholder="Optional"
                      value={frameForm.notes}
                      onChange={e => setFrameForm({ ...frameForm, notes: e.target.value })} />
                  </div>
                </div>
                <button style={styles.submitBtn} type="submit">Save Stock</button>
              </form>
            </div>
          )}

          {/* EDIT FORM (correction only) */}
          {editFrame && (
            <div style={{ ...styles.formBox, borderLeft: '4px solid #f39c12' }}>
              <h3 style={{ marginBottom: '12px' }}>✏️ Edit: {editFrame.frame_type}</h3>
              <p style={styles.formHint}>Use this only to correct details or fix quantity. For stock arrivals, use Add / Restock.</p>
              <form onSubmit={handleFrameEdit}>
                <div style={styles.formRow}>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Frame Type</label>
                    <input style={styles.input} value={editFrame.frame_type}
                      onChange={e => setEditFrame({ ...editFrame, frame_type: e.target.value })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Size</label>
                    <input style={styles.input} value={editFrame.size || ''}
                      onChange={e => setEditFrame({ ...editFrame, size: e.target.value })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Design</label>
                    <input style={styles.input} value={editFrame.design || ''}
                      onChange={e => setEditFrame({ ...editFrame, design: e.target.value })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Quantity (actual)</label>
                    <input style={styles.input} type="number" value={editFrame.quantity}
                      onChange={e => setEditFrame({ ...editFrame, quantity: e.target.value })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Notes</label>
                    <input style={styles.input} value={editFrame.notes || ''}
                      onChange={e => setEditFrame({ ...editFrame, notes: e.target.value })} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button style={styles.submitBtn} type="submit">Save Changes</button>
                  <button style={{ ...styles.submitBtn, backgroundColor: '#888' }} type="button" onClick={() => setEditFrame(null)}>Cancel</button>
                </div>
              </form>
            </div>
          )}

          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Frame Type</th>
                <th style={styles.th}>Size</th>
                <th style={styles.th}>Design</th>
                <th style={styles.th}>Quantity</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {frames.length === 0 ? (
                <tr><td colSpan="5" style={{ ...styles.td, textAlign: 'center', color: '#888' }}>No frames added yet.</td></tr>
              ) : frames.map(f => (
                <tr key={f.id} style={styles.tr}>
                  <td style={{ ...styles.td, fontWeight: 'bold' }}>{f.frame_type}</td>
                  <td style={styles.td}>{f.size || '—'}</td>
                  <td style={styles.td}>{f.design || '—'}</td>
                  <td style={{ ...styles.td, fontWeight: 'bold', fontSize: '16px', color: f.quantity === 0 ? '#e74c3c' : '#27ae60' }}>
                    {f.quantity}
                  </td>
                  <td style={styles.td}>
                    <button style={styles.reduceBtn}
                      onClick={() => {
                        if (f.quantity <= 0) return
                        updateFrame(f.id, { ...f, quantity: f.quantity - 1 })
                          .then(() => getFrames().then(r => setFrames(r.data)))
                      }}>−1</button>
                    <button style={{ ...styles.editBtn, marginLeft: '4px' }} onClick={() => { setEditFrame({ ...f }); setShowFrameForm(false) }}>✏️</button>
                    <button style={{ ...styles.delBtn, marginLeft: '4px' }} onClick={() => {
                      if (window.confirm('Delete?')) deleteFrame(f.id).then(() => getFrames().then(r => setFrames(r.data)))
                    }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {frames.filter(f => f.quantity < 5 && f.quantity > 0).length > 0 && (
            <div style={styles.warningBox}>
              ⚠️ Low Stock: {frames.filter(f => f.quantity < 5 && f.quantity > 0)
                .map(f => `${f.frame_type} ${f.size ? f.size + ' ' : ''}${f.design || ''} (${f.quantity} left)`).join(', ')}
            </div>
          )}
          {frames.filter(f => f.quantity === 0).length > 0 && (
            <div style={{ ...styles.warningBox, backgroundColor: '#fff0f0', borderColor: '#e74c3c', color: '#c0392b' }}>
              🚨 Out of Stock: {frames.filter(f => f.quantity === 0)
                .map(f => `${f.frame_type} ${f.size ? f.size + ' ' : ''}${f.design || ''}`).join(', ')}
            </div>
          )}
        </div>
      )}

      {/* ══ INK & SOLVENT TAB ══ */}
      {activeTab === 'ink' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button style={styles.addBtn} onClick={() => { setShowInkForm(!showInkForm); setEditInk(null) }}>
              {showInkForm ? 'Cancel' : '+ Add / Restock'}
            </button>
          </div>

          {/* ADD / RESTOCK FORM */}
          {showInkForm && !editInk && (
            <div style={styles.formBox}>
              <h3 style={{ marginBottom: '16px' }}>Add / Restock Ink & Solvent</h3>
              <p style={styles.formHint}>If this item already exists, quantity will be added to existing stock.</p>
              <form onSubmit={handleInkRestock}>
                <div style={styles.formRow}>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Type</label>
                    <select style={styles.input}
                      value={inkForm.item_type}
                      onChange={e => {
                        const newType = e.target.value
                        setInkForm({ ...inkForm, item_type: newType, item_name: newType === 'solvent' ? 'Cleaning Solvent' : '' })
                      }}>
                      <option value="ink">🎨 Ink</option>
                      <option value="solvent">🧴 Solvent</option>
                    </select>
                  </div>
                  <div style={{ flex: 2 }}>
                    <label style={styles.label}>Item Name *</label>
                    {inkForm.item_type === 'ink' ? (
                      <select style={styles.input}
                        value={inkForm.item_name}
                        onChange={e => setInkForm({ ...inkForm, item_name: e.target.value })}>
                        <option value="">Select Color</option>
                        {INK_COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    ) : (
                      <input style={styles.input} placeholder="e.g. Cleaning Solvent, Maintenance Fluid"
                        value={inkForm.item_name}
                        onChange={e => setInkForm({ ...inkForm, item_name: e.target.value })} />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Quantity to Add *</label>
                    <input style={styles.input} type="number" step="0.1" placeholder="0"
                      value={inkForm.quantity_to_add}
                      onChange={e => setInkForm({ ...inkForm, quantity_to_add: e.target.value })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Unit</label>
                    <select style={styles.input}
                      value={inkForm.unit}
                      onChange={e => setInkForm({ ...inkForm, unit: e.target.value })}>
                      <option value="litre">Litre</option>
                      <option value="ml">ML</option>
                      <option value="bottle">Bottle</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Min Level Alert</label>
                    <input style={styles.input} type="number" step="0.1" placeholder="0"
                      value={inkForm.minimum_level}
                      onChange={e => setInkForm({ ...inkForm, minimum_level: e.target.value })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Notes</label>
                    <input style={styles.input} placeholder="Optional"
                      value={inkForm.notes}
                      onChange={e => setInkForm({ ...inkForm, notes: e.target.value })} />
                  </div>
                </div>
                <button style={styles.submitBtn} type="submit">Save Stock</button>
              </form>
            </div>
          )}

          {/* EDIT FORM (correction only) */}
          {editInk && (
            <div style={{ ...styles.formBox, borderLeft: '4px solid #f39c12' }}>
              <h3 style={{ marginBottom: '12px' }}>✏️ Edit: {editInk.item_name}</h3>
              <p style={styles.formHint}>Use this only to correct details or fix quantity. For stock arrivals, use Add / Restock.</p>
              <form onSubmit={handleInkEdit}>
                <div style={styles.formRow}>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Type</label>
                    <select style={styles.input} value={editInk.item_type}
                      onChange={e => setEditInk({ ...editInk, item_type: e.target.value })}>
                      <option value="ink">🎨 Ink</option>
                      <option value="solvent">🧴 Solvent</option>
                    </select>
                  </div>
                  <div style={{ flex: 2 }}>
                    <label style={styles.label}>Item Name</label>
                    <input style={styles.input} value={editInk.item_name}
                      onChange={e => setEditInk({ ...editInk, item_name: e.target.value })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Quantity (actual)</label>
                    <input style={styles.input} type="number" step="0.1" value={editInk.quantity}
                      onChange={e => setEditInk({ ...editInk, quantity: e.target.value })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Unit</label>
                    <select style={styles.input} value={editInk.unit}
                      onChange={e => setEditInk({ ...editInk, unit: e.target.value })}>
                      <option value="litre">Litre</option>
                      <option value="ml">ML</option>
                      <option value="bottle">Bottle</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Min Level Alert</label>
                    <input style={styles.input} type="number" step="0.1" value={editInk.minimum_level}
                      onChange={e => setEditInk({ ...editInk, minimum_level: e.target.value })} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button style={styles.submitBtn} type="submit">Save Changes</button>
                  <button style={{ ...styles.submitBtn, backgroundColor: '#888' }} type="button" onClick={() => setEditInk(null)}>Cancel</button>
                </div>
              </form>
            </div>
          )}

          {/* Ink Cards */}
          {inkItems.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ marginBottom: '12px', color: '#1a1a2e' }}>🎨 Ink Colors</h3>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {inkItems.map(item => (
                  <div key={item.id} style={{
                    backgroundColor: '#fff', padding: '16px', borderRadius: '10px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)', minWidth: '140px', textAlign: 'center',
                    borderTop: `4px solid ${INK_COLOR_MAP[item.item_name] || '#3498db'}`
                  }}>
                    <div style={{ fontSize: '22px', fontWeight: 'bold', color: item.quantity <= item.minimum_level ? '#e74c3c' : '#1a1a2e' }}>
                      {item.quantity}
                    </div>
                    <div style={{ fontSize: '11px', color: '#888' }}>{item.unit}</div>
                    <div style={{ fontWeight: 'bold', marginTop: '6px', fontSize: '13px' }}>{item.item_name}</div>
                    {item.quantity <= item.minimum_level && (
                      <div style={{ fontSize: '10px', color: '#e74c3c', marginTop: '4px' }}>⚠️ Low</div>
                    )}
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', marginTop: '10px' }}>
                      <button style={styles.reduceBtn}
                        onClick={() => {
                          if (item.quantity <= 0) return
                          updateInkStock(item.id, { ...item, quantity: item.quantity - 1 })
                            .then(() => getInkStock().then(r => setInkStock(r.data)))
                        }}>−1</button>
                      <button style={styles.editBtn} onClick={() => { setEditInk({ ...item }); setShowInkForm(false) }}>✏️</button>
                      <button style={styles.delBtn} onClick={() => {
                        if (window.confirm('Delete?')) deleteInkStock(item.id).then(() => getInkStock().then(r => setInkStock(r.data)))
                      }}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Solvent Table */}
          {solventItems.length > 0 && (
            <div>
              <h3 style={{ marginBottom: '12px', color: '#1a1a2e' }}>🧴 Solvent</h3>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Item</th>
                    <th style={styles.th}>Quantity</th>
                    <th style={styles.th}>Unit</th>
                    <th style={styles.th}>Min Level</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {solventItems.map(item => (
                    <tr key={item.id} style={styles.tr}>
                      <td style={{ ...styles.td, fontWeight: 'bold' }}>{item.item_name}</td>
                      <td style={{ ...styles.td, fontWeight: 'bold', color: item.quantity <= item.minimum_level ? '#e74c3c' : '#27ae60' }}>
                        {item.quantity}
                      </td>
                      <td style={styles.td}>{item.unit}</td>
                      <td style={styles.td}>{item.minimum_level}</td>
                      <td style={styles.td}>
                        <span style={{ ...styles.badge, backgroundColor: item.quantity <= item.minimum_level ? '#e74c3c' : '#27ae60' }}>
                          {item.quantity <= item.minimum_level ? 'Low' : 'OK'}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <button style={styles.reduceBtn}
                          onClick={() => {
                            if (item.quantity <= 0) return
                            updateInkStock(item.id, { ...item, quantity: item.quantity - 1 })
                              .then(() => getInkStock().then(r => setInkStock(r.data)))
                          }}>−1</button>
                        <button style={{ ...styles.editBtn, marginLeft: '4px' }} onClick={() => { setEditInk({ ...item }); setShowInkForm(false) }}>✏️</button>
                        <button style={{ ...styles.delBtn, marginLeft: '4px' }} onClick={() => {
                          if (window.confirm('Delete?')) deleteInkStock(item.id).then(() => getInkStock().then(r => setInkStock(r.data)))
                        }}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {inkStock.length === 0 && (
            <p style={{ color: '#888', padding: '20px' }}>No ink or solvent added yet.</p>
          )}
        </div>
      )}
    </div>
  )
}

const styles = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  msg: { backgroundColor: '#e8f5e9', color: '#2e7d32', padding: '10px 16px', borderRadius: '6px', marginBottom: '16px', cursor: 'pointer' },
  msgErr: { backgroundColor: '#fff3f3', color: '#c0392b' },
  tabRow: { display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' },
  tab: { padding: '10px 18px', borderRadius: '8px', border: '1px solid #ddd', backgroundColor: '#fff', cursor: 'pointer', fontSize: '14px' },
  activeTab: { backgroundColor: '#1a1a2e', color: '#fff', border: '1px solid #1a1a2e' },
  addBtn: { backgroundColor: '#e94560', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' },
  formBox: { backgroundColor: '#fff', padding: '20px', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  formHint: { fontSize: '12px', color: '#27ae60', backgroundColor: '#f0faf0', padding: '8px 12px', borderRadius: '4px', marginBottom: '12px', border: '1px solid #c8e6c9' },
  formRow: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' },
  input: { width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', boxSizing: 'border-box' },
  label: { fontSize: '12px', color: '#888', display: 'block', marginBottom: '4px' },
  submitBtn: { backgroundColor: '#1a1a2e', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' },
  table: { width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '20px' },
  th: { padding: '10px 14px', textAlign: 'left', backgroundColor: '#f8f8f8', fontSize: '13px', color: '#555', borderBottom: '1px solid #eee' },
  td: { padding: '10px 14px', fontSize: '14px', borderBottom: '1px solid #f0f0f0' },
  tr: { backgroundColor: '#fff' },
  badge: { padding: '3px 10px', borderRadius: '12px', color: '#fff', fontSize: '11px' },
  useBtn: { backgroundColor: '#27ae60', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' },
  reduceBtn: { backgroundColor: '#7792ea', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' },
  editBtn: { backgroundColor: '#f39c12', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' },
  delBtn: { backgroundColor: '#e74c3c', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' },
  warningBox: { backgroundColor: '#fff9e6', border: '1px solid #f39c12', color: '#856404', padding: '12px 16px', borderRadius: '8px', marginTop: '12px', fontSize: '13px' },
  modal: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalBox: { backgroundColor: '#fff', padding: '24px', borderRadius: '12px', minWidth: '320px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }
}

export default Inventory
