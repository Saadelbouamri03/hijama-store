const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db/database');
const { requireAdmin } = require('../middleware/auth');
const { upload, UPLOAD_DIR } = require('../middleware/upload');
const { slugify } = require('../utils/slugify');
const { isNonEmptyString, isPositiveNumber } = require('../utils/validators');

const router = express.Router();

function parseImages(row) {
  try {
    return { ...row, images: JSON.parse(row.images || '[]') };
  } catch {
    return { ...row, images: [] };
  }
}

function getVariants(productId) {
  return db.prepare('SELECT * FROM product_variants WHERE product_id = ? ORDER BY display_order, id').all(productId);
}

// Remplace toutes les variantes d'un produit par la liste fournie (tableau
// d'objets { label, price, stock }). Approche simple et sûre : on supprime
// puis on réinsère, plutôt que de comparer ligne à ligne — la liste reste
// courte (quelques tailles/marques par produit) donc aucun impact de perf.
function replaceVariants(productId, rawVariants) {
  db.prepare('DELETE FROM product_variants WHERE product_id = ?').run(productId);
  if (!Array.isArray(rawVariants)) return;

  const insert = db.prepare(`
    INSERT INTO product_variants (product_id, label, price, stock, display_order)
    VALUES (?, ?, ?, ?, ?)
  `);
  rawVariants.forEach((v, i) => {
    const label = typeof v.label === 'string' ? v.label.trim() : '';
    const price = parseFloat(v.price);
    const stock = Number.isFinite(Number(v.stock)) ? Math.max(0, Math.trunc(Number(v.stock))) : 0;
    if (!label || !isPositiveNumber(price)) return; // ligne incomplète, ignorée
    insert.run(productId, label, price, stock, i);
  });
}

function parseVariantsField(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// GET /api/products - liste publique avec filtres optionnels
//   ?category=slug      -> produits d'une catégorie
//   ?filter=nouveautes  -> produits marqués "Nouveau"
//   ?filter=bestsellers -> produits marqués "Meilleure vente"
//   ?search=texte       -> recherche dans le nom
//   ?includeInactive=1  -> (admin) inclut aussi les produits désactivés
router.get('/', (req, res) => {
  const { category, filter, search, includeInactive } = req.query;
  const conditions = [];
  const params = {};

  if (!(includeInactive === '1' && req.session && req.session.isAdmin)) {
    conditions.push('p.active = 1');
  }
  if (category) {
    conditions.push('c.slug = @category');
    params.category = category;
  }
  if (filter === 'nouveautes') conditions.push('p.badge_new = 1');
  if (filter === 'bestsellers') conditions.push('p.badge_bestseller = 1');
  if (search) {
    conditions.push('LOWER(p.name) LIKE @search');
    params.search = `%${String(search).toLowerCase()}%`;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db.prepare(`
    SELECT p.*, c.name AS category_name, c.slug AS category_slug
    FROM products p LEFT JOIN categories c ON c.id = p.category_id
    ${where}
    ORDER BY p.created_at DESC
  `).all(params);

  res.json(rows.map(parseImages));
});

// GET /api/products/:idOrSlug - détail public + produits similaires
router.get('/:idOrSlug', (req, res) => {
  const { idOrSlug } = req.params;
  const row = /^\d+$/.test(idOrSlug)
    ? db.prepare(`SELECT p.*, c.name AS category_name, c.slug AS category_slug FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?`).get(idOrSlug)
    : db.prepare(`SELECT p.*, c.name AS category_name, c.slug AS category_slug FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.slug = ?`).get(idOrSlug);

  if (!row || (row.active !== 1 && !(req.session && req.session.isAdmin))) {
    return res.status(404).json({ error: 'Produit introuvable.' });
  }

  const product = parseImages(row);
  const related = db.prepare(`
    SELECT * FROM products WHERE category_id = ? AND id != ? AND active = 1 LIMIT 4
  `).all(product.category_id, product.id).map(parseImages);

  res.json({ ...product, variants: getVariants(product.id), related });
});

// POST /api/products - admin, multipart/form-data (champ fichiers : images)
router.post('/', requireAdmin, upload.array('images', 6), (req, res) => {
  const b = req.body || {};
  if (!isNonEmptyString(b.name, 150)) return res.status(400).json({ error: 'Le nom du produit est requis.' });
  const price = parseFloat(b.price);
  if (!isPositiveNumber(price)) return res.status(400).json({ error: 'Le prix est invalide.' });

  // slugify() ne garde que les caractères latins : un nom entièrement en
  // arabe (le cas courant ici) donnerait sinon un slug vide, d'où le
  // fallback 'produit'. Un slug explicite (b.slug) permet de choisir une
  // URL lisible pour ces cas plutôt que de subir "produit"/"produit-1234".
  let slug = (isNonEmptyString(b.slug, 150) ? slugify(b.slug) : '') || slugify(b.name) || 'produit';
  if (db.prepare('SELECT id FROM products WHERE slug = ?').get(slug)) {
    slug = `${slug}-${Date.now().toString().slice(-4)}`;
  }

  const images = (req.files || []).map((f) => f.filename);

  const info = db.prepare(`
    INSERT INTO products (name, slug, description, price, old_price, category_id, stock, images, video_url, badge_new, badge_bestseller, active)
    VALUES (@name, @slug, @description, @price, @old_price, @category_id, @stock, @images, @video_url, @badge_new, @badge_bestseller, @active)
  `).run({
    name: b.name.trim(),
    slug,
    description: b.description || '',
    price,
    old_price: b.old_price ? parseFloat(b.old_price) : null,
    category_id: b.category_id ? Number(b.category_id) : null,
    stock: Number(b.stock) || 0,
    images: JSON.stringify(images),
    video_url: b.video_url || '',
    badge_new: b.badge_new === '1' || b.badge_new === 'true' ? 1 : 0,
    badge_bestseller: b.badge_bestseller === '1' || b.badge_bestseller === 'true' ? 1 : 0,
    active: b.active === '0' || b.active === 'false' ? 0 : 1,
  });

  replaceVariants(info.lastInsertRowid, parseVariantsField(b.variants));

  const created = parseImages(db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid));
  res.status(201).json({ ...created, variants: getVariants(info.lastInsertRowid) });
});

// PUT /api/products/:id - admin, multipart/form-data
// Le champ "keepImages" (JSON) liste les images existantes à conserver ;
// les nouveaux fichiers envoyés sont ajoutés à la suite.
router.put('/:id', requireAdmin, upload.array('images', 6), (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Produit introuvable.' });

  const b = req.body || {};
  let keepImages;
  try {
    keepImages = b.keepImages ? JSON.parse(b.keepImages) : JSON.parse(existing.images || '[]');
  } catch {
    keepImages = JSON.parse(existing.images || '[]');
  }

  // Supprime du disque les images qui ne sont plus utilisées par ce produit.
  const previousImages = JSON.parse(existing.images || '[]');
  const removedImages = previousImages.filter((img) => !keepImages.includes(img));
  for (const img of removedImages) {
    const filePath = path.join(UPLOAD_DIR, img);
    fs.unlink(filePath, () => {}); // best-effort, on ignore l'erreur si le fichier n'existe plus
  }

  const newImages = (req.files || []).map((f) => f.filename);
  const images = [...keepImages, ...newImages];

  const updated = {
    name: isNonEmptyString(b.name, 150) ? b.name.trim() : existing.name,
    description: b.description !== undefined ? b.description : existing.description,
    price: b.price !== undefined && isPositiveNumber(parseFloat(b.price)) ? parseFloat(b.price) : existing.price,
    old_price: b.old_price !== undefined ? (b.old_price === '' ? null : parseFloat(b.old_price)) : existing.old_price,
    category_id: b.category_id !== undefined ? (b.category_id === '' ? null : Number(b.category_id)) : existing.category_id,
    stock: b.stock !== undefined ? Number(b.stock) : existing.stock,
    images: JSON.stringify(images),
    video_url: b.video_url !== undefined ? b.video_url : existing.video_url,
    badge_new: b.badge_new !== undefined ? (b.badge_new === '1' || b.badge_new === 'true' ? 1 : 0) : existing.badge_new,
    badge_bestseller: b.badge_bestseller !== undefined ? (b.badge_bestseller === '1' || b.badge_bestseller === 'true' ? 1 : 0) : existing.badge_bestseller,
    active: b.active !== undefined ? (b.active === '1' || b.active === 'true' ? 1 : 0) : existing.active,
  };

  db.prepare(`
    UPDATE products SET name=@name, description=@description, price=@price, old_price=@old_price,
      category_id=@category_id, stock=@stock, images=@images, video_url=@video_url, badge_new=@badge_new,
      badge_bestseller=@badge_bestseller, active=@active WHERE id=@id
  `).run({ ...updated, id: req.params.id });

  // Les variantes ne sont remplacées que si le champ a été envoyé, pour ne
  // jamais les effacer par accident lors d'une modification qui ne les
  // concerne pas (ex. changer juste la description).
  if (b.variants !== undefined) {
    replaceVariants(req.params.id, parseVariantsField(b.variants));
  }

  const saved = parseImages(db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id));
  res.json({ ...saved, variants: getVariants(req.params.id) });
});

// DELETE /api/products/:id - admin
router.delete('/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Produit introuvable.' });

  for (const img of JSON.parse(existing.images || '[]')) {
    fs.unlink(path.join(UPLOAD_DIR, img), () => {});
  }

  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
