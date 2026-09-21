const path = require('path');
const express = require('express');
const session = require('express-session');

const fs = require('fs');
const { config, checkConfig } = require('./config');
const db = require('./db/database');
const { injectProductMeta } = require('./utils/seo-meta');
const { generateSitemap } = require('./utils/sitemap');

const configRoute = require('./routes/config');
const authRoute = require('./routes/auth');
const statsRoute = require('./routes/stats');
const categoriesRoute = require('./routes/categories');
const productsRoute = require('./routes/products');
const ordersRoute = require('./routes/orders');
const reviewsRoute = require('./routes/reviews');
const deliveryRoute = require('./routes/delivery');

const app = express();
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');

const isProduction = config.nodeEnv === 'production';

app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

// Nécessaire en production derrière un reverse proxy (Render, Railway,
// Nginx...) pour que express-session détecte correctement le HTTPS et pose
// des cookies "secure" — sans ça, la session admin ne fonctionnerait pas.
if (isProduction) app.set('trust proxy', 1);

app.use(session({
  name: 'hijama.sid',
  secret: config.sessionSecret || 'dev-only-insecure-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    // true en production (le site DOIT alors être servi en HTTPS, sinon les
    // navigateurs refusent le cookie et /admin devient inaccessible) ; false
    // en développement local pour pouvoir tester sur http://localhost.
    secure: isProduction,
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 jours
  },
}));

// --- API ---------------------------------------------------------------
app.use('/api/config', configRoute);
app.use('/api/admin', authRoute);
app.use('/api/stats', statsRoute);
app.use('/api/categories', categoriesRoute);
app.use('/api/products', productsRoute);
app.use('/api/orders', ordersRoute);
app.use('/api/reviews', reviewsRoute);
app.use('/api/delivery-fees', deliveryRoute);

// --- Page produit à URL propre : /produit/mon-produit -------------------
// Le HTML de base est chargé une fois au démarrage (fichier statique, ne
// change jamais en cours de route) ; à chaque requête, si le produit existe,
// on y injecte ses vraies infos (titre, description, image, JSON-LD) avant
// envoi — indispensable pour que les liens partagés sur WhatsApp affichent
// le bon produit plutôt qu'un titre générique (voir utils/seo-meta.js).
const PRODUIT_TEMPLATE = fs.readFileSync(path.join(FRONTEND_DIR, 'produit.html'), 'utf8');
app.get('/produit/:slug', (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE slug = ? AND active = 1').get(req.params.slug);
  if (!row) return res.send(PRODUIT_TEMPLATE);

  let images = [];
  try { images = JSON.parse(row.images || '[]'); } catch { /* images reste vide */ }

  // AggregateRating : uniquement à partir de vrais avis liés à ce produit
  // (jamais de note affichée sans avis réels derrière).
  const reviewStats = db.prepare(
    'SELECT COUNT(*) AS count, AVG(rating) AS avg FROM reviews WHERE product_id = ? AND is_demo = 0 AND active = 1'
  ).get(row.id);

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.send(injectProductMeta(PRODUIT_TEMPLATE, { ...row, images, currency: config.currency, reviewStats }, baseUrl));
});

// --- sitemap.xml généré à la volée depuis le catalogue réel (voir utils/sitemap.js) ---
app.get('/sitemap.xml', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.type('application/xml').send(generateSitemap(baseUrl));
});

// --- Sous-domaine admin.<domaine> : raccourci facile à retenir/taper sur
// téléphone, redirige vers l'espace admin habituel (même app, même session).
// Fonctionne dès que ce sous-domaine est configuré chez l'hébergeur (DNS +
// domaine personnalisé sur Render) ; sans ça, personne n'y accède jamais,
// donc aucun impact si ce n'est pas mis en place.
app.get('/', (req, res, next) => {
  if (req.hostname.startsWith('admin.')) return res.redirect('/admin/login');
  next();
});

// --- /admin -> redirige vers le tableau de bord ---
app.get('/admin', (req, res) => res.redirect('/admin/dashboard'));

// --- Le tableau de bord lui-même exige une session valide avant même de
// servir la page (les appels API qu'il fait sont déjà protégés par
// requireAdmin, mais ceci évite d'envoyer la coquille HTML à un visiteur non
// connecté).
app.get(['/admin/dashboard', '/admin/dashboard.html'], (req, res, next) => {
  if (req.session && req.session.isAdmin) return next();
  res.redirect('/admin/login');
});

// --- Fichiers statiques (HTML/CSS/JS/images) -----------------------------
// "extensions: ['html']" permet des URLs propres : /produits sert produits.html
app.use(express.static(FRONTEND_DIR, { extensions: ['html'] }));

// --- 404 -----------------------------------------------------------------
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Route API introuvable.' });
  }
  res.status(404).sendFile(path.join(FRONTEND_DIR, '404.html'));
});

// --- Gestion centralisée des erreurs (dont les erreurs Multer) -----------
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 400;
  res.status(status).json({ error: err.message || 'Une erreur est survenue.' });
});

const warnings = checkConfig();

// En production, un mot de passe admin ou un secret de session manquant
// n'est plus un simple avertissement : le serveur refuse de démarrer, pour
// ne jamais exposer /admin avec des identifiants par défaut sur internet.
if (isProduction && (!config.admin.password || !config.sessionSecret)) {
  console.error('❌ Démarrage refusé en production : ADMIN_PASSWORD et SESSION_SECRET doivent être définis dans .env.');
  process.exit(1);
}

app.listen(config.port, () => {
  console.log('');
  console.log(`✅ ${config.storeName} est en ligne sur http://localhost:${config.port}`);
  console.log(`   Espace admin : http://localhost:${config.port}/admin/login`);
  console.log('');
  if (warnings.length) {
    console.log('⚠️  Pensez à compléter votre fichier .env :');
    warnings.forEach((w) => console.log('   - ' + w));
    console.log('');
  }
});
