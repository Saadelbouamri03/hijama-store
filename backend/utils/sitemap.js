// Génère sitemap.xml dynamiquement à partir du catalogue réel (produits +
// catégories en base), plutôt qu'un fichier statique à mettre à jour à la
// main à chaque produit ajouté — indispensable pour que Google découvre les
// 130+ fiches produits du site.

const db = require('../db/database');

const STATIC_PAGES = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/produits', changefreq: 'daily', priority: '0.9' },
  { path: '/categories', changefreq: 'weekly', priority: '0.7' },
  { path: '/composez-votre-kit', changefreq: 'weekly', priority: '0.6' },
  { path: '/guide-tailles-ventouses', changefreq: 'monthly', priority: '0.5' },
  { path: '/comparer', changefreq: 'monthly', priority: '0.4' },
  { path: '/avis', changefreq: 'weekly', priority: '0.5' },
  { path: '/a-propos', changefreq: 'monthly', priority: '0.5' },
  { path: '/contact', changefreq: 'monthly', priority: '0.5' },
];

function generateSitemap(baseUrl) {
  const urls = [];

  STATIC_PAGES.forEach((p) => {
    urls.push(`  <url><loc>${baseUrl}${p.path}</loc><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`);
  });

  const categories = db.prepare('SELECT slug FROM categories').all();
  categories.forEach((c) => {
    urls.push(`  <url><loc>${baseUrl}/produits?categorie=${encodeURIComponent(c.slug)}</loc><changefreq>weekly</changefreq><priority>0.6</priority></url>`);
  });

  const products = db.prepare('SELECT slug, created_at FROM products WHERE active = 1').all();
  products.forEach((p) => {
    const lastmod = (p.created_at || '').slice(0, 10);
    urls.push(`  <url><loc>${baseUrl}/produit/${encodeURIComponent(p.slug)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}<changefreq>weekly</changefreq><priority>0.7</priority></url>`);
  });

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

module.exports = { generateSitemap };
