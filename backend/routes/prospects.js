// Prospection B2B : liste des centres de hijama/massage à démarcher.
// Entièrement réservée à l'admin — ce sont des coordonnées professionnelles
// de tiers, elles ne doivent jamais être exposées publiquement.

const express = require('express');
const db = require('../db/database');
const { requireAdmin } = require('../middleware/auth');
const { isNonEmptyString } = require('../utils/validators');

const router = express.Router();

const STATUSES = [
  'À contacter', 'Contacté', 'Répondu', 'Intéressé',
  'Commande passée', 'Pas intéressé', 'Faux numéro',
];

router.use(requireAdmin);

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM prospects ORDER BY status = \'Commande passée\' DESC, id ASC').all());
});

router.post('/', (req, res) => {
  const { name, city, phone } = req.body || {};
  if (!isNonEmptyString(name, 120)) return res.status(400).json({ error: 'Le nom du centre est requis.' });
  if (!isNonEmptyString(phone, 30)) return res.status(400).json({ error: 'Le numéro est requis.' });

  const info = db.prepare('INSERT INTO prospects (name, city, phone) VALUES (?, ?, ?)')
    .run(name.trim(), (city || '').trim(), phone.trim());
  res.status(201).json(db.prepare('SELECT * FROM prospects WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM prospects WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Centre introuvable.' });

  const b = req.body || {};
  if (b.status !== undefined && !STATUSES.includes(b.status)) {
    return res.status(400).json({ error: `Statut invalide. Valeurs possibles : ${STATUSES.join(', ')}` });
  }

  // Première bascule vers "Contacté" : on horodate automatiquement, pour ne
  // pas avoir à saisir la date à la main depuis le téléphone.
  const nowContacted = b.status && b.status !== 'À contacter' && !existing.contacted_at;

  const updated = {
    name: isNonEmptyString(b.name, 120) ? b.name.trim() : existing.name,
    city: b.city !== undefined ? String(b.city).trim() : existing.city,
    phone: isNonEmptyString(b.phone, 30) ? b.phone.trim() : existing.phone,
    status: b.status !== undefined ? b.status : existing.status,
    notes: b.notes !== undefined ? String(b.notes).trim() : existing.notes,
    contacted_at: nowContacted ? new Date().toISOString().slice(0, 10) : existing.contacted_at,
  };

  db.prepare(`
    UPDATE prospects SET name=?, city=?, phone=?, status=?, notes=?, contacted_at=? WHERE id=?
  `).run(updated.name, updated.city, updated.phone, updated.status, updated.notes, updated.contacted_at, req.params.id);

  res.json(db.prepare('SELECT * FROM prospects WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM prospects WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Centre introuvable.' });
  db.prepare('DELETE FROM prospects WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
module.exports.PROSPECT_STATUSES = STATUSES;
