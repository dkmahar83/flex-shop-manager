// server/routes/backup.js
const express  = require('express')
const router   = express.Router()
const fs       = require('fs')
const path     = require('path')
const { runBackup, getBackupList, BACKUP_DIR } = require('../backup')

// GET /api/backup/list
router.get('/list', (req, res) => {
  const backups = getBackupList()
  res.json({ backups, count: backups.length })
})

// POST /api/backup/run
router.post('/run', (req, res) => {
  try {
    runBackup()
    const backups = getBackupList()
    res.json({ success: true, message: 'Backup complete!', latest: backups[0] || null })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/backup/download/:filename
router.get('/download/:filename', (req, res) => {
  const { filename } = req.params
  const safeName = path.basename(filename)
  if (!safeName.startsWith('VijayFlexPro-Backup-') || !safeName.endsWith('.db')) {
    return res.status(400).json({ error: 'Invalid filename' })
  }
  const backupRoot = path.resolve(BACKUP_DIR)
  const filePath = path.resolve(BACKUP_DIR, safeName)
  if (!filePath.startsWith(backupRoot + path.sep) && filePath !== backupRoot) {
    return res.status(400).json({ error: 'Invalid filename' })
  }
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Backup file nahi mila' })
  }
  res.download(filePath, safeName)
})

module.exports = router