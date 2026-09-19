const express = require('express');
const db = require('../db/database');
const { requireAdmin } = require('../middleware/auth');
const { isNonEmptyString, isPositiveNumber } = require('../utils/validators');
const { config } = require('../config');

const router = express.Router();

// GET /api/delivery-fees - public (utilisé par le panier/checkout pour calculer la livraison)
router.get('/', (req, res) => {
  const fees = db.prepare('SELECT * FROM delivery_fees ORDER BY city ASC').all();
  res.json({ fees, defaultFee: config.defaultDeliveryFee });
});

// POST /api/delivery-fees - admin
router.post('/', requireAdmin, (req, res) => {
  const { city, fee } = req.body || {};
  if (!isNonEmptyString(city, 80)) return res.status(400).json({ error: 'Le nom de la ville est requis.' });
  const f = parseFloat(fee);
  if (!isPositiveNumber(f)) return res.status(400).json({ error: 'Le frais de livraison est invalide.' });

  const exists = db.prepare('SELECT id FROM delivery_fees WHERE LOWER(city) = LOWER(?)').get(city.trim());
  if (exists) return res.status(400).json({ error: 'Cette ville existe déjà dans la liste.' });

  const info = db.prepare('INSERT INTO delivery_fees (city, fee) VALUES (?, ?)').run(city.trim(), f);
  res.status(201).json(db.prepare('SELECT * FROM delivery_fees WHERE id = ?').get(info.lastInsertRowid));
});

// PUT /api/delivery-fees/:id - admin
router.put('/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM delivery_fees WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Ville introuvable.' });

  const { city, fee } = req.body || {};
  const updated = {
    city: isNonEmptyString(city, 80) ? city.trim() : existing.city,
    fee: fee !== undefined && isPositiveNumber(parseFloat(fee)) ? parseFloat(fee) : existing.fee,
  };
  db.prepare('UPDATE delivery_fees SET city = ?, fee = ? WHERE id = ?').run(updated.city, updated.fee, req.params.id);
  res.json(db.prepare('SELECT * FROM delivery_fees WHERE id = ?').get(req.params.id));
});

// DELETE /api/delivery-fees/:id - admin
router.delete('/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM delivery_fees WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Ville introuvable.' });
  db.prepare('DELETE FROM delivery_fees WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
