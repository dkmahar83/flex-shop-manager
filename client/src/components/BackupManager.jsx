// client/src/components/BackupManager.jsx
// Navbar mein "💾 Backup" button — panel khulta hai
// Replaces purana BackupButton.jsx

import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'

export default function BackupManager() {
  const [showPanel, setShowPanel]       = useState(false)
  const [backups, setBackups]           = useState([])
  const [loading, setLoading]           = useState(false)
  const [runningBackup, setRunningBackup] = useState(false)
  const [msg, setMsg]                   = useState('')

  const fetchBackups = useCallback(() => {
    setLoading(true)
    api.get('/backup/list')
      .then(r => setBackups(r.data.backups || []))
      .catch(() => setMsg('❌ List load nahi hui'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
  if (!showPanel) return
  fetchBackups() // eslint-disable-line react-hooks/set-state-in-effect
}, [showPanel, fetchBackups])

  function handleManualBackup() {
    setRunningBackup(true)
    setMsg('')
    api.post('/backup/run')
      .then(() => { setMsg('✅ Backup complete ho gaya!'); fetchBackups() })
      .catch(e => setMsg('❌ ' + (e.response?.data?.error || 'Backup fail hua')))
      .finally(() => setRunningBackup(false))
  }

  function handleDownload(filename) {
    api.get(`/backup/download/${filename}`, { responseType: 'blob' })
      .then(r => {
        const url = window.URL.createObjectURL(new Blob([r.data]))
        const a   = document.createElement('a')
        a.href     = url
        a.download = filename
        a.click()
        window.URL.revokeObjectURL(url)
      })
      .catch(() => setMsg('❌ Download fail hua'))
  }

  // ── Styles (inline — koi extra CSS file nahi chahiye) ──────────────────────
  const btn = {
    background: 'transparent', border: '1px solid #444', color: '#ccc',
    padding: '6px 12px', borderRadius: '6px', cursor: 'pointer',
    fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px'
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Navbar button */}
      <button onClick={() => setShowPanel(s => !s)} style={btn}>
        💾 Backup
      </button>

      {showPanel && (
        <>
          {/* Click-outside overlay */}
          <div
            onClick={() => setShowPanel(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 998 }}
          />

          {/* Panel */}
          <div style={{
            position: 'absolute', top: '44px', right: 0, zIndex: 999,
            background: '#fff', borderRadius: '12px', padding: '18px',
            boxShadow: '0 4px 32px rgba(0,0,0,0.18)', width: '320px',
            border: '1px solid #eee'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ fontWeight: '700', fontSize: '15px', color: '#1a1a2e' }}>💾 Database Backup</div>
              <button onClick={() => setShowPanel(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#888' }}>
                ×
              </button>
            </div>

            {/* Info box */}
            <div style={{
              background: '#f0fff4', border: '1px solid #c3e6cb', borderRadius: '8px',
              padding: '10px 12px', fontSize: '12px', color: '#2e7d32',
              marginBottom: '14px', lineHeight: '1.6'
            }}>
              🕙 <strong>Auto backup:</strong> Har raat 11:00 PM IST<br/>
              ✅ <strong>Backup mein kya hai:</strong> Orders, payments, customers, ledger, cash, expenses, employees — sab kuch!<br/>
              🗑️ 30 din purane backups auto-delete
            </div>

            {/* Manual backup button */}
            <button
              onClick={handleManualBackup}
              disabled={runningBackup}
              style={{
                width: '100%', padding: '10px',
                background: runningBackup ? '#ccc' : '#1a1a2e',
                color: '#fff', border: 'none', borderRadius: '8px',
                cursor: runningBackup ? 'not-allowed' : 'pointer',
                fontWeight: '600', fontSize: '13px', marginBottom: '12px'
              }}
            >
              {runningBackup ? '⏳ Backup ho raha hai...' : '📦 Abhi Backup Lo'}
            </button>

            {/* Message */}
            {msg && (
              <div style={{
                fontSize: '12px', padding: '8px 10px', borderRadius: '6px', marginBottom: '10px',
                background: msg.startsWith('✅') ? '#f0fff4' : '#fff5f5',
                color: msg.startsWith('✅') ? '#2e7d32' : '#c62828'
              }}>
                {msg}
              </div>
            )}

            {/* Backup list header */}
            <div style={{ fontSize: '12px', color: '#888', fontWeight: '600', marginBottom: '8px' }}>
              Saved Backups ({backups.length})
            </div>

            {/* List */}
            {loading ? (
              <div style={{ textAlign: 'center', color: '#888', padding: '12px', fontSize: '13px' }}>Loading...</div>
            ) : backups.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#aaa', padding: '12px', fontSize: '12px' }}>
                Koi backup nahi hai.<br/>Upar se "Abhi Backup Lo" karo.
              </div>
            ) : (
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {backups.map(b => (
                  <div key={b.filename} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 0', borderBottom: '1px solid #f5f5f5'
                  }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: '#333' }}>📅 {b.date}</div>
                      <div style={{ fontSize: '11px', color: '#aaa' }}>{b.size_mb} MB</div>
                    </div>
                    <button
                      onClick={() => handleDownload(b.filename)}
                      style={{
                        background: '#e3f2fd', border: '1px solid #90caf9', color: '#1565c0',
                        borderRadius: '6px', padding: '4px 10px', cursor: 'pointer',
                        fontSize: '11px', fontWeight: '600'
                      }}
                    >
                      ⬇ Download
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ fontSize: '11px', color: '#bbb', marginTop: '10px', textAlign: 'center' }}>
              Recovery: backup file ko flexshop.db naam se replace karo, server restart karo
            </div>
          </div>
        </>
      )}
    </div>
  )
}
