const express = require('express');
const crypto = require('crypto');
const db = require('../db/database');

const router = express.Router();

// ── Ensure table exists ──
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS page_locks (
      page_key   TEXT PRIMARY KEY,
      pin_hash   TEXT NOT NULL,
      salt       TEXT NOT NULL,
      is_locked  INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// ── helpers ──
function hashPin(pin, salt) {
  return crypto.scryptSync(String(pin), salt, 64).toString('hex');
}

function getRow(pageKey) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM page_locks WHERE page_key = ?', [pageKey], (err, row) => {
      if (err) reject(err); else resolve(row);
    });
  });
}

// ── GET status ──
// returns { has_pin, is_locked }
router.get('/:pageKey', async (req, res) => {
  try {
    const row = await getRow(req.params.pageKey);
    if (!row) {
      return res.json({ has_pin: false, is_locked: false });
    }
    res.json({ has_pin: true, is_locked: !!row.is_locked });
  } catch (e) {
    console.error('page-locks GET error:', e.message);
    res.status(500).json({ error: 'Kuch gadbad ho gayi' });
  }
});

// ── POST verify PIN → unlocks page ──
router.post('/:pageKey/verify', async (req, res) => {
  const { pin } = req.body;
  if (!pin) return res.status(400).json({ error: 'PIN daalo' });

  try {
    const row = await getRow(req.params.pageKey);
    if (!row) return res.status(400).json({ error: 'PIN set nahi hai' });

    const hash = hashPin(pin, row.salt);
    if (hash !== row.pin_hash) {
      return res.status(401).json({ error: 'Galat PIN' });
    }

    db.run(
      'UPDATE page_locks SET is_locked = 0, updated_at = CURRENT_TIMESTAMP WHERE page_key = ?',
      [req.params.pageKey],
      (err) => {
        if (err) {
          console.error('page-locks verify update error:', err.message);
          return res.status(500).json({ error: 'Kuch gadbad ho gayi' });
        }
        res.json({ success: true });
      }
    );
  } catch (e) {
    console.error('page-locks verify error:', e.message);
    res.status(500).json({ error: 'Kuch gadbad ho gayi' });
  }
});

// ── POST set-pin (first time set OR change pin) ──
// body: { pin, current_pin? }
router.post('/:pageKey/set-pin', async (req, res) => {
  const { pin, current_pin } = req.body;
  const pageKey = req.params.pageKey;

  if (!pin || String(pin).length < 4) {
    return res.status(400).json({ error: 'Kam se kam 4 digits ka PIN chahiye' });
  }

  try {
    const existing = await getRow(pageKey);

    if (existing) {
      // changing an existing PIN requires current_pin to match
      const currentHash = hashPin(current_pin || '', existing.salt);
      if (currentHash !== existing.pin_hash) {
        return res.status(401).json({ error: 'Current PIN galat hai' });
      }

      const newSalt = crypto.randomBytes(16).toString('hex');
      const newHash = hashPin(pin, newSalt);

      db.run(
        'UPDATE page_locks SET pin_hash = ?, salt = ?, updated_at = CURRENT_TIMESTAMP WHERE page_key = ?',
        [newHash, newSalt, pageKey],
        (err) => {
          if (err) {
            console.error('page-locks set-pin update error:', err.message);
            return res.status(500).json({ error: 'Kuch gadbad ho gayi' });
          }
          res.json({ success: true });
        }
      );
    } else {
      // first time setup
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = hashPin(pin, salt);

      db.run(
        'INSERT INTO page_locks (page_key, pin_hash, salt, is_locked) VALUES (?, ?, ?, 1)',
        [pageKey, hash, salt],
        (err) => {
          if (err) {
            console.error('page-locks set-pin insert error:', err.message);
            return res.status(500).json({ error: 'Kuch gadbad ho gayi' });
          }
          res.json({ success: true });
        }
      );
    }
  } catch (e) {
    console.error('page-locks set-pin error:', e.message);
    res.status(500).json({ error: 'Kuch gadbad ho gayi' });
  }
});

// ── POST toggle lock state ──
// body: { is_locked: true|false }
router.post('/:pageKey/toggle', async (req, res) => {
  const { is_locked } = req.body;
  const pageKey = req.params.pageKey;

  try {
    const existing = await getRow(pageKey);
    if (!existing) return res.status(400).json({ error: 'Pehle PIN set karo' });

    db.run(
      'UPDATE page_locks SET is_locked = ?, updated_at = CURRENT_TIMESTAMP WHERE page_key = ?',
      [is_locked ? 1 : 0, pageKey],
      (err) => {
        if (err) {
          console.error('page-locks toggle error:', err.message);
          return res.status(500).json({ error: 'Kuch gadbad ho gayi' });
        }
        res.json({ success: true, is_locked: !!is_locked });
      }
    );
  } catch (e) {
    console.error('page-locks toggle error:', e.message);
    res.status(500).json({ error: 'Kuch gadbad ho gayi' });
  }
});

module.exports = router;