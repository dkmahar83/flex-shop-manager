const express = require('express')
const router = express.Router()
const fs = require('fs')
const db = require('../db/database')
const requireAuth = require('../middleware/auth')

// GET /api/backup/download
router.get('/download', requireAuth, (req, res) => {
  const dbPath = db.DB_PATH
  if (!dbPath || !fs.existsSync(dbPath)) {
    return res.status(404).json({ error: 'Database file nahi mili.' })
  }
  const today = new Date().toISOString().slice(0, 10)
  const filename = `VijayFlexPro-Backup-${today}.db`

  res.download(dbPath, filename, (err) => {
    if (err && !res.headersSent) {
      console.error('Backup download error:', err)
      res.status(500).json({ error: 'Backup download fail hua.' })
    }
  })
})

module.exports = router