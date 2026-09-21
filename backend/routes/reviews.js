const express = require('express');
const db = require('../db/database');
const { requireAdmin } = require('../middleware/auth');
const { isNonEmptyString } = require('../utils/validators');
const { config } = require('../config');

const router = express.Router();

// GET /api/reviews - public, avis actifs uniquement (?all=1 pour l'admin -> tous, actifs et inactifs)
// Les avis DEMO (voir seed.js) ne sont jamais envoyés aux visiteurs, sauf si
// SHOW_DEMO_REVIEWS=true dans .env (test de mise en page uniquement) : on ne
// montre jamais un faux avis à un vrai client.
router.get('/', (req, res) => {
  if (req.query.all === '1' && req.session && req.session.isAdmin) {
    return res.json(db.prepare('SELECT * FROM reviews ORDER BY display_order ASC, id DESC').all());
  }
  const query = config.reviews.showDemo
    ? 'SELECT * FROM reviews WHERE active = 1 ORDER BY display_order ASC, id DESC'
    : 'SELECT * FROM reviews WHERE active = 1 AND is_demo = 0 ORDER BY display_order ASC, id DESC';
  res.json(db.prepare(query).all());
});

// POST /api/reviews - admin
router.post('/', requireAdmin, (req, res) => {
  const { customer_name, rating, comment, is_demo, display_order } = req.body || {};
  if (!isNonEmptyString(customer_name, 80)) return res.status(400).json({ error: 'Le nom du client est requis.' });
  if (!isNonEmptyString(comment, 500)) return res.status(400).json({ error: "Le commentaire est requis." });
  const r = Number(rating);
  if (!Number.isInteger(r) || r < 1 || r > 5) return res.status(400).json({ error: 'La note doit être entre 1 et 5.' });

  const info = db.prepare(`
    INSERT INTO reviews (customer_name, rating, comment, is_demo, active, display_order)
    VALUES (?, ?, ?, ?, 1, ?)
  `).run(customer_name.trim(), r, comment.trim(), is_demo ? 1 : 0, Number(display_order) || 0);

  res.status(201).json(db.prepare('SELECT * FROM reviews WHERE id = ?').get(info.lastInsertRowid));
});

// PUT /api/reviews/:id - admin
router.put('/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Avis introuvable.' });

  const b = req.body || {};
  const updated = {
    customer_name: isNonEmptyString(b.customer_name, 80) ? b.customer_name.trim() : existing.customer_name,
    rating: b.rating !== undefined ? Number(b.rating) : existing.rating,
    comment: isNonEmptyString(b.comment, 500) ? b.comment.trim() : existing.comment,
    is_demo: b.is_demo !== undefined ? (b.is_demo ? 1 : 0) : existing.is_demo,
    active: b.active !== undefined ? (b.active ? 1 : 0) : existing.active,
    display_order: b.display_order !== undefined ? Number(b.display_order) : existing.display_order,
  };

  db.prepare(`
    UPDATE reviews SET customer_name=?, rating=?, comment=?, is_demo=?, active=?, display_order=? WHERE id=?
  `).run(updated.customer_name, updated.rating, updated.comment, updated.is_demo, updated.active, updated.display_order, req.params.id);

  res.json(db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id));
});

// DELETE /api/reviews/:id - admin
router.delete('/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Avis introuvable.' });
  db.prepare('DELETE FROM reviews WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
