// Logique de filtrage des produits, partagée entre GET /api/products (API,
// utilisée par le JS client) et la route SSR-lite de /produits (voir
// server.js) — pour que les deux ne puissent jamais renvoyer des résultats
// différents pour les mêmes filtres.

const db = require('../db/database');

function parseImages(row) {
  try {
    return { ...row, images: JSON.parse(row.images || '[]') };
  } catch {
    return { ...row, images: [] };
  }
}

// query: { category, filter, search, includeInactive }, isAdmin: session admin ?
function queryProducts(query, isAdmin) {
  const { category, filter, search, includeInactive } = query || {};
  const conditions = [];
  const params = {};

  if (!(includeInactive === '1' && isAdmin)) {
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

  return rows.map(parseImages);
}

module.exports = { queryProducts, parseImages };
