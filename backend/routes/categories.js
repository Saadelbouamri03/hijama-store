const express = require('express');
const db = require('../db/database');
const { requireAdmin } = require('../middleware/auth');
const { slugify } = require('../utils/slugify');
const { isNonEmptyString } = require('../utils/validators');

const router = express.Router();

// GET /api/categories - liste publique, triée par ordre d'affichage
router.get('/', (req, res) => {
  const categories = db.prepare('SELECT * FROM categories ORDER BY display_order ASC, id ASC').all();
  res.json(categories);
});

// GET /api/categories/:idOrSlug
router.get('/:idOrSlug', (req, res) => {
  const { idOrSlug } = req.params;
  const category = /^\d+$/.test(idOrSlug)
    ? db.prepare('SELECT * FROM categories WHERE id = ?').get(idOrSlug)
    : db.prepare('SELECT * FROM categories WHERE slug = ?').get(idOrSlug);

  if (!category) return res.status(404).json({ error: 'Catégorie introuvable.' });
  res.json(category);
});

// POST /api/categories - admin uniquement
router.post('/', requireAdmin, (req, res) => {
  const { name, description, image, display_order } = req.body || {};
  if (!isNonEmptyString(name, 100)) {
    return res.status(400).json({ error: 'Le nom de la catégorie est requis.' });
  }

  // slugify() ne garde que les caractères latins : un nom entièrement en
  // arabe (le cas courant ici) donnerait sinon un slug vide.
  let slug = slugify(name) || 'categorie';
  const slugExists = db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug);
  if (slugExists) slug = `${slug}-${Date.now().toString().slice(-4)}`;

  const info = db.prepare(`
    INSERT INTO categories (name, slug, description, image, display_order)
    VALUES (?, ?, ?, ?, ?)
  `).run(name.trim(), slug, description || '', image || '', Number(display_order) || 0);

  const created = db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(created);
});

// PUT /api/categories/:id - admin uniquement
router.put('/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Catégorie introuvable.' });

  const { name, description, image, display_order } = req.body || {};
  const updated = {
    name: isNonEmptyString(name, 100) ? name.trim() : existing.name,
    description: description !== undefined ? description : existing.description,
    image: image !== undefined ? image : existing.image,
    display_order: display_order !== undefined ? Number(display_order) : existing.display_order,
  };

  db.prepare(`
    UPDATE categories SET name = ?, description = ?, image = ?, display_order = ? WHERE id = ?
  `).run(updated.name, updated.description, updated.image, updated.display_order, req.params.id);

  res.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id));
});

// DELETE /api/categories/:id - admin uniquement
router.delete('/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Catégorie introuvable.' });

  const productCount = db.prepare('SELECT COUNT(*) AS n FROM products WHERE category_id = ?').get(req.params.id).n;
  if (productCount > 0) {
    return res.status(400).json({
      error: `Impossible de supprimer : ${productCount} produit(s) utilisent encore cette catégorie.`,
    });
  }

  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
