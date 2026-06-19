const express = require('express')
const router = express.Router()
const db = require('../db/database')
const PDFDocument = require('pdfkit')
const axios = require('axios')
const { getStatus, getLastQR, sendBillToCustomer } = require('../whatsapp')

// GET /api/whatsapp/status
router.get('/status', (req, res) => {
  res.json(getStatus())
})

// GET /api/whatsapp/qr
router.get('/qr', (req, res) => {
  const qr = getLastQR()
  if (!qr) return res.json({ qr: null, message: 'No QR pending or already connected' })
  res.json({ qr })
})

// POST /api/whatsapp/send-bill/:orderId
router.post('/send-bill/:orderId', async (req, res) => {
  const { orderId } = req.params

  try {
    // Get order + customer for message text
    db.get(`
      SELECT orders.*, customers.firm_name, customers.contact_name, customers.phone
      FROM orders
      JOIN customers ON orders.customer_id = customers.id
      WHERE orders.id = ?
    `, [orderId], async (err, order) => {
      if (err) return res.status(500).json({ error: err.message })
      if (!order) return res.status(404).json({ error: 'Order not found' })
      if (!order.phone) return res.status(400).json({ error: 'Customer has no phone number. Add phone number in customer profile first.' })

      try {
        // Fetch the SAME PDF that the download button uses
        const pdfResponse = await axios.get(
          `http://localhost:5000/api/pdf/bill/${orderId}`,
          { responseType: 'arraybuffer' }
        )

        const pdfBuffer = Buffer.from(pdfResponse.data)

        // Calculate paid amount
        const paidAmount = (order.total_amount || 0) - (order.balance_due || 0)

        // Send via WhatsApp
        const result = await sendBillToCustomer({
          phone: order.phone,
          customerName: order.firm_name,
          orderId: order.id,
          totalAmount: order.total_amount,
          advancePaid: order.advance_paid || 0,
          balanceDue: order.balance_due || 0,
          pdfBuffer
        })

        res.json({
          success: true,
          message: `Bill sent to ${order.firm_name} (${result.phone}) on WhatsApp ✅`,
          phone: result.phone
        })

      } catch (innerErr) {
        res.status(500).json({ error: innerErr.message })
      }
    })

  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Shared PDF builder — same as pdf.js
function buildPDF(doc, order, items, payments) {
  const PRIMARY = '#1a1a2e'
  const GREEN = '#27ae60'
  const RED = '#e74c3c'
  const GRAY = '#888888'
  const LIGHT = '#f8f8f8'
  const pageWidth = doc.page.width - 100

  // Header
  doc.rect(0, 0, doc.page.width, 80).fill(PRIMARY)
  doc.fill('#ffffff').fontSize(22).font('Helvetica-Bold').text('VijayFlex Pro', 50, 20)
  doc.fill('#aaaaaa').fontSize(10).font('Helvetica').text('Pilibangan, Rajasthan', 50, 46).text('Professional Flex Printing Services', 50, 60)
  doc.fill('#ffffff').fontSize(12).font('Helvetica-Bold').text(`BILL #${order.id}`, 0, 28, { align: 'right', width: doc.page.width - 50 })
  doc.fill('#aaaaaa').fontSize(9).font('Helvetica').text(new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }), 0, 46, { align: 'right', width: doc.page.width - 50 })

  // Customer info
  const infoTop = 100
  doc.rect(50, infoTop, pageWidth, 90).fill(LIGHT).stroke('#eeeeee')
  doc.fill(PRIMARY).fontSize(9).font('Helvetica-Bold').text('BILL TO', 65, infoTop + 12)
  doc.fill(PRIMARY).fontSize(14).font('Helvetica-Bold').text(order.firm_name, 65, infoTop + 26)
  if (order.contact_name) doc.fill(GRAY).fontSize(10).font('Helvetica').text(`Contact: ${order.contact_name}`, 65, infoTop + 46)
  if (order.phone) doc.fill(GRAY).fontSize(10).text(`Phone: ${order.phone}`, 65, infoTop + 62)
  const metaX = 350
  doc.fill(GRAY).fontSize(9).font('Helvetica-Bold').text('ORDER DETAILS', metaX, infoTop + 12)
  doc.fill(PRIMARY).fontSize(10).font('Helvetica').text(`Order #: ${order.id}`, metaX, infoTop + 26).text(`Status: ${(order.status || 'pending').replace('_', ' ').toUpperCase()}`, metaX, infoTop + 40)
  if (order.description) doc.fill(GRAY).fontSize(9).text(order.description, metaX, infoTop + 68, { width: 180 })

  // Items table
  const tableTop = infoTop + 110
  doc.rect(50, tableTop, pageWidth, 28).fill(PRIMARY)
  doc.fill('#ffffff').fontSize(9).font('Helvetica-Bold')
  doc.text('ITEM', 65, tableTop + 10)
  doc.text('QTY', 290, tableTop + 10)
  doc.text('RATE', 360, tableTop + 10)
  doc.text('AMOUNT', 430, tableTop + 10)

  let rowY = tableTop + 28
  let totalAmount = 0
  items.forEach((item, i) => {
    const subtotal = parseFloat(item.subtotal) || (item.quantity * item.unit_price)
    totalAmount += subtotal
    if (i % 2 === 0) doc.rect(50, rowY, pageWidth, 28).fill('#fafafa')
    doc.fill(PRIMARY).fontSize(10).font('Helvetica-Bold').text(item.item_name || '—', 65, rowY + 9, { width: 220 })
    doc.fill(GRAY).fontSize(9).font('Helvetica').text(String(item.quantity), 290, rowY + 9).text(`₹${item.unit_price}`, 360, rowY + 9)
    doc.fill(PRIMARY).fontSize(10).font('Helvetica-Bold').text(`₹${subtotal.toFixed(0)}`, 430, rowY + 9)
    doc.moveTo(50, rowY + 28).lineTo(50 + pageWidth, rowY + 28).strokeColor('#eeeeee').stroke()
    rowY += 28
  })

  // Totals
  const totalsTop = rowY + 16
  const col4 = 430
  doc.fill(GRAY).fontSize(10).font('Helvetica').text('Subtotal:', 350, totalsTop, { width: 100, align: 'right' })
  doc.fill(PRIMARY).fontSize(10).font('Helvetica').text(`₹${totalAmount.toFixed(0)}`, col4, totalsTop)
  let currentY = totalsTop + 20
  if (order.advance_paid > 0) {
    doc.fill(GRAY).fontSize(10).text('Advance:', 350, currentY, { width: 100, align: 'right' })
    doc.fill(GREEN).fontSize(10).text(`- ₹${order.advance_paid}`, col4, currentY)
    currentY += 20
  }
  if (payments && payments.length > 0) {
    const paymentsTotal = payments.reduce((s, p) => s + p.amount, 0)
    doc.fill(GRAY).fontSize(10).text('Payments:', 350, currentY, { width: 100, align: 'right' })
    doc.fill(GREEN).fontSize(10).text(`- ₹${paymentsTotal}`, col4, currentY)
    currentY += 20
  }
  doc.moveTo(350, currentY).lineTo(50 + pageWidth, currentY).strokeColor(PRIMARY).lineWidth(1).stroke()
  currentY += 8
  const balColor = order.balance_due > 0 ? RED : GREEN
  doc.rect(340, currentY, pageWidth - 290, 36).fill(order.balance_due > 0 ? '#fff5f5' : '#f0fff4')
  doc.fill(balColor).fontSize(13).font('Helvetica-Bold').text('BALANCE DUE:', 350, currentY + 10, { width: 100, align: 'right' }).text(`₹${order.balance_due}`, col4, currentY + 10)

  // Footer
  const footerY = doc.page.height - 80
  doc.rect(0, footerY, doc.page.width, 80).fill(PRIMARY)
  doc.fill('#ffffff').fontSize(12).font('Helvetica-Bold').text('Thank you for your business!', 50, footerY + 18)
  doc.fill('#aaaaaa').fontSize(9).font('Helvetica').text('VijayFlex Pro — Pilibangan, Rajasthan', 50, footerY + 38)
}

module.exports = router