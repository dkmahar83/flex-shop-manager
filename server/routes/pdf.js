const express = require('express')
const router = express.Router()
const db = require('../db/database')
const PDFDocument = require('pdfkit')

// ══════════════════════════════════════════
//  SHOP CONFIG — apni details yahan bharo
// ══════════════════════════════════════════
const SHOP = {
  name        : 'Vijay Flex & Offset',       // Shop ka naam
  ownerName   : 'Vijay Singh',    // Owner ka naam
  mobile      : '+91 9950580621',        // Mobile number
  mobile2     : '+91 8824387294',                       // 2nd number (optional, khali chhod do)
  address     : 'Near New Bus Stand, Pilibangan, Rajasthan (335803)',  // Address
  tagline     : 'All Type of Printing Solutions',  // Tagline (optional, khali chhod do)
  logoPath    : './assets/Logo.png',   // Logo file ka path, e.g. './assets/logo.png'
}

// GET /api/pdf/bill/:orderId
router.get('/bill/:orderId', (req, res) => {
  const { orderId } = req.params

  db.get(`
    SELECT orders.*, customers.firm_name, customers.contact_name, customers.phone
    FROM orders
    JOIN customers ON orders.customer_id = customers.id
    WHERE orders.id = ?
  `, [orderId], (err, order) => {
    if (err) return res.status(500).json({ error: err.message })
    if (!order) return res.status(404).json({ error: 'Order not found' })

    db.all(`SELECT * FROM order_items WHERE order_id = ?`, [orderId], (err, items) => {
      if (err) return res.status(500).json({ error: err.message })

      db.all(`SELECT * FROM payments WHERE order_id = ? ORDER BY payment_date ASC`, [orderId], (err, payments) => {
        if (err) return res.status(500).json({ error: err.message })

        const doc = new PDFDocument({ 
          size: 'A4', 
          margin: 50,
          bufferPages: true  // extra auto-pages rokta hai
        })

        res.setHeader('Content-Type', 'application/pdf')
        res.setHeader('Content-Disposition', `attachment; filename=bill-${orderId}.pdf`)
        doc.pipe(res)

        // ── COLORS ──
        const PRIMARY    = '#1a1a2e'
        const ACCENT     = '#2ecc71'
        const GREEN      = '#27ae60'
        const RED        = '#e74c3c'
        const GRAY       = '#888888'
        const LIGHT_GRAY = '#f4f4f4'
        const WHITE      = '#ffffff'

        const PAGE_W  = doc.page.width
        const MARGIN  = 50
        const CONTENT = PAGE_W - MARGIN * 2   // 495pt usable width

        // ── HELPER: currency (pdfkit built-in fonts don't render ₹) ──
        const rs = (val) => `Rs. ${parseFloat(val || 0).toFixed(0)}`

        // ── HELPER: draw horizontal rule ──
        const hRule = (y, color = '#dddddd', width = 1) => {
          doc.moveTo(MARGIN, y)
             .lineTo(MARGIN + CONTENT, y)
             .strokeColor(color)
             .lineWidth(width)
             .stroke()
        }

        // ── HELPER: safe text (truncate to fit column) ──
        const safeText = (text, maxChars) =>
          text && text.length > maxChars ? text.substring(0, maxChars - 1) + '…' : (text || '—')

        // ══════════════════════════════════════════
        //  HEADER BAND
        // ══════════════════════════════════════════
        doc.rect(0, 0, PAGE_W, 95).fill(PRIMARY)
        doc.rect(0, 92, PAGE_W, 3).fill(ACCENT)   // accent stripe

        // Logo (agar path set hai toh show karo)
        let textStartX = MARGIN
        if (SHOP.logoPath) {
          try {
            doc.image(SHOP.logoPath, MARGIN, 10, { width: 60, height: 60 })
            textStartX = MARGIN + 70   // text logo ke baad start hoga
          } catch (e) {
            // logo load na ho toh ignore karo, text se hi kaam chalega
          }
        }

        // Shop name
        doc.fill(WHITE)
           .fontSize(22)
           .font('Helvetica-Bold')
           .text(SHOP.name, textStartX, 14)

        // Owner name + mobile
        const contactLine = SHOP.mobile2
          ? `${SHOP.ownerName}  |  ${SHOP.mobile}  /  ${SHOP.mobile2}`
          : `${SHOP.ownerName}  |  ${SHOP.mobile}`

        doc.fill(ACCENT)
           .fontSize(9)
           .font('Helvetica-Bold')
           .text(contactLine, textStartX, 42)

        // Address + tagline
        doc.fill('#aaaaaa')
           .fontSize(9)
           .font('Helvetica')
           .text(`${SHOP.address}  |  ${SHOP.tagline}`, textStartX, 57)

        // Invoice number (top-right)
        doc.fill(ACCENT)
           .fontSize(13)
           .font('Helvetica-Bold')
           .text(`INVOICE #${orderId}`, 0, 18, { align: 'right', width: PAGE_W - MARGIN })

        // Date (top-right)
        const orderDate = order.created_at
          ? new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
          : new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

        doc.fill('#aaaaaa')
           .fontSize(9)
           .font('Helvetica')
           .text(orderDate, 0, 40, { align: 'right', width: PAGE_W - MARGIN })

        // ══════════════════════════════════════════
        //  CUSTOMER + ORDER INFO
        // ══════════════════════════════════════════
        const INFO_TOP = 110
        const INFO_H   = 95
        doc.rect(MARGIN, INFO_TOP, CONTENT, INFO_H)
           .fill(LIGHT_GRAY)
        hRule(INFO_TOP + INFO_H, '#dddddd')

        // Left: Bill To
        doc.fill(GRAY)
           .fontSize(8)
           .font('Helvetica-Bold')
           .text('BILL TO', MARGIN + 14, INFO_TOP + 12)

        doc.fill(PRIMARY)
           .fontSize(15)
           .font('Helvetica-Bold')
           .text(safeText(order.firm_name, 35), MARGIN + 14, INFO_TOP + 26)

        let infoLineY = INFO_TOP + 48
        if (order.contact_name) {
          doc.fill(GRAY).fontSize(9).font('Helvetica')
             .text(`Contact : ${order.contact_name}`, MARGIN + 14, infoLineY)
          infoLineY += 14
        }
        if (order.phone) {
          doc.fill(GRAY).fontSize(9)
             .text(`Phone   : ${order.phone}`, MARGIN + 14, infoLineY)
        }

        // Right: Order Details
        const META_X = MARGIN + CONTENT * 0.58
        doc.fill(GRAY)
           .fontSize(8)
           .font('Helvetica-Bold')
           .text('ORDER DETAILS', META_X, INFO_TOP + 12)

        const statusText = (order.status || 'pending').replace(/_/g, ' ').toUpperCase()
        const statusColor = order.status === 'delivered' ? GREEN
                          : order.status === 'cancelled' ? RED
                          : '#e67e22'

        doc.fill(PRIMARY).fontSize(10).font('Helvetica')
           .text(`Order # : ${orderId}`, META_X, INFO_TOP + 26)

        doc.fill(statusColor).fontSize(10).font('Helvetica-Bold')
           .text(`Status  : ${statusText}`, META_X, INFO_TOP + 40)

        doc.fill(GRAY).fontSize(9).font('Helvetica-Bold')
        if (order.description) {
          doc.fill(PRIMARY).fontSize(11).font('Helvetica-Bold')
             .text(safeText(order.description, 40), META_X, INFO_TOP + 56, { width: 180 })
        }

        // ══════════════════════════════════════════
        //  ITEMS TABLE
        // ══════════════════════════════════════════
        const TBL_TOP  = INFO_TOP + INFO_H + 18
        const ROW_H    = 28
        const COL_ITEM = MARGIN + 10
        const COL_QTY  = MARGIN + 240
        const COL_RATE = MARGIN + 330
        const COL_AMT  = MARGIN + 410

        // Table header band
        doc.rect(MARGIN, TBL_TOP, CONTENT, 28).fill(PRIMARY)

        doc.fill(WHITE).fontSize(9).font('Helvetica-Bold')
        doc.text('ITEM / DESCRIPTION',     COL_ITEM, TBL_TOP + 10)
        doc.text('QTY / SQ.FT',            COL_QTY,  TBL_TOP + 10)
        doc.text('RATE (Rs.)',              COL_RATE, TBL_TOP + 10)
        doc.text('AMOUNT (Rs.)',            COL_AMT,  TBL_TOP + 10)

        // Rows
        let rowY        = TBL_TOP + 28
        let totalAmount = 0

        items.forEach((item, index) => {
          const subtotal = parseFloat(item.subtotal) || (parseFloat(item.quantity) * parseFloat(item.unit_price))
          totalAmount += subtotal

          // Check if we need a new page
          if (rowY + ROW_H > doc.page.height - 180) {
            doc.addPage()
            rowY = 60
            // Redraw mini header on new page
            doc.rect(MARGIN, rowY - 28, CONTENT, 28).fill(PRIMARY)
            doc.fill(WHITE).fontSize(9).font('Helvetica-Bold')
            doc.text('ITEM / DESCRIPTION', COL_ITEM, rowY - 18)
            doc.text('QTY / SQ.FT',        COL_QTY,  rowY - 18)
            doc.text('RATE (Rs.)',          COL_RATE, rowY - 18)
            doc.text('AMOUNT (Rs.)',        COL_AMT,  rowY - 18)
          }

          // Alternating row background
          if (index % 2 === 0) {
            doc.rect(MARGIN, rowY, CONTENT, ROW_H).fill('#fafafa')
          }

          doc.fill(PRIMARY).fontSize(10).font('Helvetica-Bold')
             .text(safeText(item.item_name, 30), COL_ITEM, rowY + 9, { width: 220 })

          doc.fill(GRAY).fontSize(9).font('Helvetica')
             .text(String(item.quantity),                    COL_QTY,  rowY + 9)
             .text(`Rs. ${parseFloat(item.unit_price).toFixed(0)}`, COL_RATE, rowY + 9)

          doc.fill(PRIMARY).fontSize(10).font('Helvetica-Bold')
             .text(rs(subtotal), COL_AMT, rowY + 9)

          hRule(rowY + ROW_H, '#eeeeee')
          rowY += ROW_H
        })

        // ══════════════════════════════════════════
        //  TOTALS SECTION
        // ══════════════════════════════════════════
        const TOT_TOP  = rowY + 16
        const LBL_X    = MARGIN + CONTENT - 220
        const VAL_X    = MARGIN + CONTENT - 90

        const drawTotalRow = (label, value, y, bold = false, color = PRIMARY) => {
          doc.fill(GRAY)
             .fontSize(10)
             .font('Helvetica')
             .text(label, LBL_X, y, { width: 120, align: 'right' })

          doc.fill(color)
             .fontSize(bold ? 12 : 10)
             .font(bold ? 'Helvetica-Bold' : 'Helvetica')
             .text(value, VAL_X, y, { width: 85, align: 'right' })
        }

        drawTotalRow('Subtotal :', rs(totalAmount), TOT_TOP)
        let curY = TOT_TOP + 20

        // Advance payment
        if (parseFloat(order.advance_paid) > 0) {
          const modeLabel = order.advance_payment_mode === 'upi' ? ' (UPI)' : ' (Cash)'
          drawTotalRow(`Advance${modeLabel} :`, `- ${rs(order.advance_paid)}`, curY, false, GREEN)
          curY += 20
        }

        // Additional payments
        if (payments && payments.length > 0) {
          const paymentsTotal = payments.reduce((s, p) => s + parseFloat(p.amount || 0), 0)
          drawTotalRow('Payments :', `- ${rs(paymentsTotal)}`, curY, false, GREEN)
          curY += 20
        }

        // Discount / Round-off
        if (parseFloat(order.discount_amount) > 0) {
          const dLabel = order.discount_note
            ? `Discount (${order.discount_note}) :`
            : 'Discount / Round-off :'
          drawTotalRow(dLabel, `- ${rs(order.discount_amount)}`, curY, false, GREEN)
          curY += 20
        }

        // Divider before balance
        doc.moveTo(LBL_X, curY)
           .lineTo(MARGIN + CONTENT, curY)
           .strokeColor(PRIMARY)
           .lineWidth(1.2)
           .stroke()
        curY += 10

        // Balance due box
        const balanceDue   = parseFloat(order.balance_due || 0)
        const balanceColor = balanceDue > 0 ? RED : GREEN
        const balanceBg    = balanceDue > 0 ? '#fff0f0' : '#f0fff4'

        doc.rect(LBL_X - 10, curY, CONTENT - (LBL_X - MARGIN) + 10, 38)
           .fill(balanceBg)

        doc.fill(balanceColor)
           .fontSize(13)
           .font('Helvetica-Bold')
           .text('BALANCE DUE :', LBL_X, curY + 12, { width: 120, align: 'right' })
           .text(rs(balanceDue),  VAL_X,  curY + 12, { width: 85,  align: 'right' })

        curY += 56

        // ══════════════════════════════════════════
        //  NOTES
        // ══════════════════════════════════════════
        if (order.notes) {
          doc.fill(GRAY).fontSize(9).font('Helvetica-Bold')
             .text('NOTES:', MARGIN, curY)
          doc.fill(GRAY).fontSize(9).font('Helvetica')
             .text(order.notes, MARGIN, curY + 14, { width: CONTENT })
          curY += 40
        }

        // ══════════════════════════════════════════
        //  PAYMENT HISTORY
        // ══════════════════════════════════════════
        const hasAdvance  = parseFloat(order.advance_paid) > 0
        const hasPayments = payments && payments.length > 0

        if (hasAdvance || hasPayments) {
          curY += 10
          hRule(curY, '#dddddd')
          curY += 12

          doc.fill(PRIMARY).fontSize(10).font('Helvetica-Bold')
             .text('Payment History', MARGIN, curY)
          curY += 18

          if (hasAdvance) {
            doc.fill(GREEN).fontSize(9).font('Helvetica')
               .text(
                 `+  Advance : ${rs(order.advance_paid)}  [${(order.advance_payment_mode || 'cash').toUpperCase()}]`,
                 MARGIN + 14, curY
               )
            curY += 14
          }

          if (hasPayments) {
            payments.forEach(p => {
              const dateStr = p.payment_date
                ? new Date(p.payment_date).toLocaleDateString('en-IN')
                : '—'
              const note = p.note ? `  —  ${p.note}` : ''
              doc.fill(GREEN).fontSize(9).font('Helvetica')
                 .text(`+  ${dateStr} : ${rs(p.amount)}${note}`, MARGIN + 14, curY)
              curY += 14
            })
          }

          if (parseFloat(order.discount_amount) > 0) {
            doc.fill('#e67e22').fontSize(9).font('Helvetica')
               .text(
                 `✂  Discount : ${rs(order.discount_amount)}${order.discount_note ? '  —  ' + order.discount_note : '  (Round-off)'}`,
                 MARGIN + 14, curY
               )
            curY += 14
          }
        }

        // ══════════════════════════════════════════
        //  FOOTER — absolute bottom, no new page
        // ══════════════════════════════════════════
        const FOOTER_H = 72
        const FOOTER_Y = doc.page.height - FOOTER_H

        // Agar content footer se overlap kar raha hai toh upar compress karo
        // (sirf check — footer hamesha last page ke bottom pe rahega)
        doc.rect(0, FOOTER_Y, PAGE_W, FOOTER_H).fill(PRIMARY)
        doc.rect(0, FOOTER_Y, PAGE_W, 3).fill(ACCENT)

        doc.fill(WHITE).fontSize(12).font('Helvetica-Bold')
           .text('Thank you for your business!', MARGIN, FOOTER_Y + 14, { lineBreak: false })

        doc.fill(ACCENT).fontSize(9).font('Helvetica-Bold')
           .text(`${SHOP.name}  |  ${SHOP.ownerName}  |  ${SHOP.mobile}`, MARGIN, FOOTER_Y + 34, { lineBreak: false })

        doc.fill('#aaaaaa').fontSize(9).font('Helvetica')
           .text(SHOP.address, MARGIN, FOOTER_Y + 50, { lineBreak: false })

        doc.fill('#aaaaaa').fontSize(8)
           .text('Page 1', PAGE_W - MARGIN - 30, FOOTER_Y + 50, { lineBreak: false })

        doc.flushPages()
        doc.end()
      })
    })
  })
})

module.exports = router