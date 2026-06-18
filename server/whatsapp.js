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
      clientStatus = 'auth_failed'
      clientReady = false
      client = null
    })

    client.on('disconnected', (reason) => {
      console.log('WhatsApp disconnected:', reason)
      clientStatus = 'disconnected'
      clientReady = false
      client = null
      // Wait 10 seconds before reconnecting — prevent rapid restart loops
      setTimeout(() => {
        console.log('Attempting WhatsApp reconnect...')
        initWhatsApp()
      }, 10000)
    })

    client.initialize().catch(err => {
      console.log('WhatsApp init failed (Chrome not found):', err.message)
      clientStatus = 'unavailable'
      client = null
    })

  } catch (err) {
    console.log('WhatsApp unavailable:', err.message)
    clientStatus = 'unavailable'
    client = null
  }
}

async function sendBillToCustomer({ phone, customerName, orderId, totalAmount, advancePaid, balanceDue, pdfBuffer }) {
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
  const chatId = `${formattedPhone}@c.us`

  // Compose message
  const paidSoFar = advancePaid + (totalAmount - advancePaid - balanceDue)
  const message = `🖨️ *FlexShop Manager — Bill #${orderId}*

Dear *${customerName}*,

Your order bill is attached below.

💰 Order Total: ₹${totalAmount}
✅ Amount Paid: ₹${paidSoFar}
${balanceDue > 0 ? `⚠️ Balance Due: ₹${balanceDue}` : '✅ Fully Paid'}

Thank you for choosing us!
_FlexShop Manager, Pilibangan_`

  // Send text message first
  await client.sendMessage(chatId, message)

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