const express = require('express');
const router = express.Router();
const db = require('../db/database');

// ─── HELPER: log inventory change ───
function logChange(table_name, item_id, item_name, action, qty_changed, qty_before, qty_after, notes) {
  db.run(`INSERT INTO inventory_log 
    (table_name, item_id, item_name, action, quantity_changed, quantity_before, quantity_after, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [table_name, item_id, item_name, action, qty_changed, qty_before, qty_after, notes || null],
    () => {}
  );
}

// ════════════════════════════════════
// FLEX INVENTORY
// ════════════════════════════════════

router.get('/flex', (req, res) => {
  db.all(`SELECT * FROM inventory_flex ORDER BY brand ASC, size_ft ASC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.post('/flex', (req, res) => {
  const { brand, size_ft, quantity, unit, notes } = req.body;
  if (!brand || !size_ft) return res.status(400).json({ error: 'brand and size_ft required' });

  // Check if same brand+size exists
  db.get(`SELECT * FROM inventory_flex WHERE brand = ? AND size_ft = ?`, [brand, size_ft], (err, existing) => {
    if (err) return res.status(500).json({ error: err.message });

    if (existing) {
      // Add to existing stock
      const newQty = existing.quantity + Number(quantity || 0);
      db.run(`UPDATE inventory_flex SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [newQty, existing.id], function(err) {
          if (err) return res.status(500).json({ error: err.message });
          logChange('inventory_flex', existing.id, `${brand} ${size_ft}ft`, 'add', Number(quantity), existing.quantity, newQty, notes);
          res.json({ id: existing.id, message: 'Stock updated', quantity: newQty });
        }
      );
    } else {
      // New entry
      const qty = Number(quantity || 0);
      db.run(`INSERT INTO inventory_flex (brand, size_ft, quantity, unit, notes) VALUES (?, ?, ?, ?, ?)`,
        [brand, size_ft, qty, unit || 'roll', notes || null],
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          logChange('inventory_flex', this.lastID, `${brand} ${size_ft}ft`, 'add', qty, 0, qty, notes);
          res.status(201).json({ id: this.lastID, message: 'Flex stock added' });
        }
      );
    }
  });
});

router.put('/flex/:id/use', (req, res) => {
  const { quantity, notes } = req.body;
  db.get(`SELECT * FROM inventory_flex WHERE id = ?`, [req.params.id], (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'Not found' });
    const use = Number(quantity || 0);
    if (use > row.quantity) return res.status(400).json({ error: 'Insufficient stock' });
    const newQty = row.quantity - use;
    db.run(`UPDATE inventory_flex SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [newQty, row.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        logChange('inventory_flex', row.id, `${row.brand} ${row.size_ft}ft`, 'use', use, row.quantity, newQty, notes);
        res.json({ message: 'Stock reduced', quantity: newQty });
      }
    );
  });
});

router.put('/flex/:id', (req, res) => {
  const { brand, size_ft, quantity, unit, notes } = req.body;
  db.run(`UPDATE inventory_flex SET brand=?, size_ft=?, quantity=?, unit=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    [brand, size_ft, quantity, unit, notes, req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Updated' });
    }
  );
});

router.delete('/flex/:id', (req, res) => {
  db.run(`DELETE FROM inventory_flex WHERE id = ?`, [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Deleted' });
  });
});

// ════════════════════════════════════
// STAMPS
// ════════════════════════════════════

router.get('/stamps', (req, res) => {
  db.all(`SELECT * FROM inventory_stamps ORDER BY stamp_type ASC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.post('/stamps', (req, res) => {
  const { stamp_type, size, design_type, quantity, notes } = req.body;
  if (!stamp_type) return res.status(400).json({ error: 'stamp_type required' });
  const qty = Number(quantity || 0);
  db.run(`INSERT INTO inventory_stamps (stamp_type, size, design_type, quantity, notes) VALUES (?, ?, ?, ?, ?)`,
    [stamp_type, size || null, design_type || null, qty, notes || null],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      logChange('inventory_stamps', this.lastID, stamp_type, 'add', qty, 0, qty, notes);
      res.status(201).json({ id: this.lastID, message: 'Stamp added' });
    }
  );
});

router.put('/stamps/:id', (req, res) => {
  const { stamp_type, size, design_type, quantity, notes } = req.body;
  db.get(`SELECT * FROM inventory_stamps WHERE id = ?`, [req.params.id], (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'Not found' });
    const newQty = Number(quantity ?? row.quantity);
    db.run(`UPDATE inventory_stamps SET stamp_type=?, size=?, design_type=?, quantity=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [stamp_type || row.stamp_type, size ?? row.size, design_type ?? row.design_type, newQty, notes ?? row.notes, row.id],
      (err) => {
        if (err) return res.status(500).json({ error: err.message });
        logChange('inventory_stamps', row.id, stamp_type || row.stamp_type, 'update', newQty - row.quantity, row.quantity, newQty, notes);
        res.json({ message: 'Updated' });
      }
    );
  });
});

router.delete('/stamps/:id', (req, res) => {
  db.run(`DELETE FROM inventory_stamps WHERE id = ?`, [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Deleted' });
  });
});

// ════════════════════════════════════
// CHEMICALS
// ════════════════════════════════════

router.get('/chemicals', (req, res) => {
  db.all(`SELECT * FROM inventory_chemicals ORDER BY chemical_name ASC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.post('/chemicals', (req, res) => {
  const { chemical_name, quantity, unit, minimum_stock, notes } = req.body;
  if (!chemical_name) return res.status(400).json({ error: 'chemical_name required' });
  const qty = Number(quantity || 0);
  db.run(`INSERT INTO inventory_chemicals (chemical_name, quantity, unit, minimum_stock, notes) VALUES (?, ?, ?, ?, ?)`,
    [chemical_name, qty, unit || 'litre', Number(minimum_stock || 0), notes || null],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      logChange('inventory_chemicals', this.lastID, chemical_name, 'add', qty, 0, qty, notes);
      res.status(201).json({ id: this.lastID, message: 'Chemical added' });
    }
  );
});

router.put('/chemicals/:id', (req, res) => {
  const { chemical_name, quantity, unit, minimum_stock, notes } = req.body;
  db.get(`SELECT * FROM inventory_chemicals WHERE id = ?`, [req.params.id], (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'Not found' });
    const newQty = Number(quantity ?? row.quantity);
    db.run(`UPDATE inventory_chemicals SET chemical_name=?, quantity=?, unit=?, minimum_stock=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [chemical_name || row.chemical_name, newQty, unit || row.unit, Number(minimum_stock ?? row.minimum_stock), notes ?? row.notes, row.id],
      (err) => {
        if (err) return res.status(500).json({ error: err.message });
        logChange('inventory_chemicals', row.id, chemical_name || row.chemical_name, 'update', newQty - row.quantity, row.quantity, newQty, notes);
        res.json({ message: 'Updated' });
      }
    );
  });
});

router.delete('/chemicals/:id', (req, res) => {
  db.run(`DELETE FROM inventory_chemicals WHERE id = ?`, [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Deleted' });
  });
});

// ════════════════════════════════════
// PHOTO FRAMES
// ════════════════════════════════════

router.get('/frames', (req, res) => {
  db.all(`SELECT * FROM inventory_frames ORDER BY frame_type ASC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.post('/frames', (req, res) => {
  const { frame_type, size, design, quantity, notes } = req.body;
  if (!frame_type) return res.status(400).json({ error: 'frame_type required' });
  const qty = Number(quantity || 0);
  db.run(`INSERT INTO inventory_frames (frame_type, size, design, quantity, notes) VALUES (?, ?, ?, ?, ?)`,
    [frame_type, size || null, design || null, qty, notes || null],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      logChange('inventory_frames', this.lastID, frame_type, 'add', qty, 0, qty, notes);
      res.status(201).json({ id: this.lastID, message: 'Frame added' });
    }
  );
});

router.put('/frames/:id', (req, res) => {
  const { frame_type, size, design, quantity, notes } = req.body;
  db.get(`SELECT * FROM inventory_frames WHERE id = ?`, [req.params.id], (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'Not found' });
    const newQty = Number(quantity ?? row.quantity);
    db.run(`UPDATE inventory_frames SET frame_type=?, size=?, design=?, quantity=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [frame_type || row.frame_type, size ?? row.size, design ?? row.design, newQty, notes ?? row.notes, row.id],
      (err) => {
        if (err) return res.status(500).json({ error: err.message });
        logChange('inventory_frames', row.id, frame_type || row.frame_type, 'update', newQty - row.quantity, row.quantity, newQty, notes);
        res.json({ message: 'Updated' });
      }
    );
  });
});

router.delete('/frames/:id', (req, res) => {
  db.run(`DELETE FROM inventory_frames WHERE id = ?`, [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Deleted' });
  });
});

// ════════════════════════════════════
// INK & SOLVENT
// ════════════════════════════════════

router.get('/ink', (req, res) => {
  db.all(`SELECT * FROM inventory_ink ORDER BY item_type ASC, item_name ASC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.post('/ink', (req, res) => {
  const { item_name, item_type, quantity, unit, minimum_level, notes } = req.body;
  if (!item_name) return res.status(400).json({ error: 'item_name required' });
  const qty = Number(quantity || 0);
  db.run(`INSERT INTO inventory_ink (item_name, item_type, quantity, unit, minimum_level, notes) VALUES (?, ?, ?, ?, ?, ?)`,
    [item_name, item_type || 'ink', qty, unit || 'litre', Number(minimum_level || 0), notes || null],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      logChange('inventory_ink', this.lastID, item_name, 'add', qty, 0, qty, notes);
      res.status(201).json({ id: this.lastID, message: 'Ink/Solvent added' });
    }
  );
});

router.put('/ink/:id', (req, res) => {
  const { item_name, item_type, quantity, unit, minimum_level, notes } = req.body;
  db.get(`SELECT * FROM inventory_ink WHERE id = ?`, [req.params.id], (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'Not found' });
    const newQty = Number(quantity ?? row.quantity);
    db.run(`UPDATE inventory_ink SET item_name=?, item_type=?, quantity=?, unit=?, minimum_level=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [item_name || row.item_name, item_type || row.item_type, newQty, unit || row.unit, Number(minimum_level ?? row.minimum_level), notes ?? row.notes, row.id],
      (err) => {
        if (err) return res.status(500).json({ error: err.message });
        logChange('inventory_ink', row.id, item_name || row.item_name, 'update', newQty - row.quantity, row.quantity, newQty, notes);
        res.json({ message: 'Updated' });
      }
    );
  });
});

router.delete('/ink/:id', (req, res) => {
  db.run(`DELETE FROM inventory_ink WHERE id = ?`, [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Deleted' });
  });
});

// ════════════════════════════════════
// INVENTORY LOG
// ════════════════════════════════════
router.get('/log', (req, res) => {
  db.all(`SELECT * FROM inventory_log ORDER BY created_at DESC LIMIT 100`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

module.exports = router;