const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js')
const qrcode = require('qrcode-terminal')
const fs = require('fs')
const path = require('path')

let client = null
let clientReady = false
let clientStatus = 'disconnected' // 'disconnected' | 'qr_pending' | 'ready'
let lastQR = null

function getClient() {
  return client
}

function getStatus() {
  return { status: clientStatus, ready: clientReady }
}

function getLastQR() {
  return lastQR
}

// Purana session delete karo (corrupted/detached frame ke baad) aur fresh QR ke liye reinit karo
function clearSessionAndReinit(oldClient) {
  // Purana client safely destroy karne ki koshish karo
  if (oldClient) {
    try { oldClient.destroy() } catch (e) { /* already dead, ignore */ }
  }

  setTimeout(() => {
    try {
      const authPath = path.join(__dirname, '.wwebjs_auth')
      const cachePath = path.join(__dirname, '.wwebjs_cache')
      if (fs.existsSync(authPath)) fs.rmSync(authPath, { recursive: true, force: true })
      if (fs.existsSync(cachePath)) fs.rmSync(cachePath, { recursive: true, force: true })
      console.log('Old WhatsApp session cleared.')
    } catch (e) {
      console.log('Could not clear session folders:', e.message)
    }

    console.log('Re-initializing WhatsApp — new QR will appear shortly...')
    initWhatsApp()
  }, 3000)
}

function initWhatsApp() {
  if (client) {
    console.log('WhatsApp already initialized, skipping.')
    return
  }

  console.log('Initializing WhatsApp client...')
  clientStatus = 'initializing'

  try {
    client = new Client({
      authStrategy: new LocalAuth({
        dataPath: path.join(__dirname, '.wwebjs_auth')
      }),
      puppeteer: {
        headless: true,
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      }
    })

    client.on('qr', (qr) => {
      console.log('WhatsApp QR ready — scan at localhost:5173/whatsapp')
      lastQR = qr
      clientStatus = 'qr_pending'
      clientReady = false
    })

    client.on('ready', () => {
      console.log('✅ WhatsApp ready')
      clientStatus = 'ready'
      clientReady = true
      lastQR = null
    })

    client.on('authenticated', () => {
      clientStatus = 'authenticated'
    })

    client.on('auth_failure', () => {
      console.log('WhatsApp auth failed — clearing session for fresh QR')
      clientStatus = 'auth_failed'
      clientReady = false
      const c = client
      client = null
      clearSessionAndReinit(c)
    })

    client.on('disconnected', (reason) => {
      console.log('WhatsApp disconnected:', reason)
      clientStatus = 'disconnected'
      clientReady = false
      const c = client
      client = null
      clearSessionAndReinit(c)
    })

    client.initialize().catch(err => {
      console.log('WhatsApp init crashed (detached frame / Chrome issue):', err.message)
      clientStatus = 'disconnected'
      clientReady = false
      const c = client
      client = null
      clearSessionAndReinit(c)
    })

  } catch (err) {
    console.log('WhatsApp unavailable:', err.message)
    clientStatus = 'unavailable'
    client = null
  }
}

async function sendBillToCustomer({ phone, customerName, orderId, totalAmount, advancePaid, balanceDue, pdfBuffer, upiId }) {
  if (!clientReady || !client) {
    throw new Error('WhatsApp not connected. Please scan QR code first.')
  }

  // Format phone number — Indian numbers need 91 prefix
  let formattedPhone = phone.replace(/\D/g, '') // remove non-digits
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '91' + formattedPhone.substring(1)
  }
  if (!formattedPhone.startsWith('91')) {
    formattedPhone = '91' + formattedPhone
  }
  const numberId = await client.getNumberId(formattedPhone)
  if (!numberId) {
    throw new Error(`WhatsApp account nahi mila: ${formattedPhone}`)
  }
  const chatId = numberId._serialized   

  // Compose message
  const paidSoFar = advancePaid + (totalAmount - advancePaid - balanceDue)
  const message = `🖨️ *VijayFlex Pro — Bill #${orderId}*

Dear *${customerName}*,

Your order bill is attached below.

💰 Order Total: ₹${totalAmount}
✅ Amount Paid: ₹${paidSoFar}
${balanceDue > 0 ? `⚠️ Balance Due: ₹${balanceDue}` : '✅ Fully Paid'}

Thank you for choosing us!
_VijayFlex Pro, Pilibangan_`

  // Send text message first
  await client.sendMessage(chatId, message)


  // UPI payment — deep link (>2000) ya QR (<=2000)
  if (balanceDue > 0 && upiId) {
    const upiString = `upi://pay?pa=${upiId}&pn=VijayFlex%20Pro&am=${balanceDue}&cu=INR&tn=Bill%20${orderId}`

    if (balanceDue > 2000) {
      await client.sendMessage(
        chatId,
        `💳 *Payment Request — Bill #${orderId}*\n\n` +
        `Balance Due: *₹${balanceDue}*\n\n` +
        `Use the link below to complete your payment 👇\n\n` +
        `${upiString}\n\n` +
        `_VijayFlex Pro, Pilibangan_`
      )
    } else {
      const QRCode = require('qrcode')
      const qrBuffer = await QRCode.toBuffer(upiString, { type: 'png', width: 400 })
      const qrMedia = new MessageMedia('image/png', qrBuffer.toString('base64'), `PayNow-${orderId}.png`)
      await client.sendMessage(chatId, qrMedia)
      await client.sendMessage(chatId, `📲 *Scan to Pay the Balance ₹${balanceDue}*`)
    }
  }

  // Send PDF if buffer provided
  if (pdfBuffer) {
    const media = new MessageMedia(
      'application/pdf',
      pdfBuffer.toString('base64'),
      `Bill-${orderId}.pdf`
    )
    await client.sendMessage(chatId, media)
  }

  return { success: true, phone: formattedPhone }
}

module.exports = { initWhatsApp, getClient, getStatus, getLastQR, sendBillToCustomer }