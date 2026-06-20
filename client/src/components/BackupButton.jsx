import { useState } from 'react'
import { downloadBackup } from '../services/api'

export default function BackupButton() {
  const [downloading, setDownloading] = useState(false)

  async function handleBackup() {
    setDownloading(true)
    try {
      const res = await downloadBackup()
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      const today = new Date().toISOString().slice(0, 10)
      a.href = url
      a.download = `VijayFlexPro-Backup-${today}.db`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      alert('Backup download mein error: ' + (e.response?.data?.error || e.message))
    }
    setDownloading(false)
  }

  return (
    <button onClick={handleBackup} disabled={downloading} style={{
      padding: '8px 16px', borderRadius: '8px', border: 'none',
      background: '#1a1a2e', color: '#fff', fontSize: '13px', fontWeight: 600,
      cursor: downloading ? 'not-allowed' : 'pointer', opacity: downloading ? 0.7 : 1
    }}>
      {downloading ? '⏳ Downloading…' : '💾 Download Backup'}
    </button>
  )
}