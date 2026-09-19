// Remplit la base de données avec des données DE DÉMONSTRATION :
// catégories, produits, avis clients et frais de livraison.
// Tout ce contenu est un exemple à remplacer depuis l'espace /admin.
//
// Utilisation :   npm run seed
// Relancer ce script est sans danger : si des catégories existent déjà,
// il ne fait rien (pour éviter les doublons). Pour forcer un nouveau
// remplissage sur une base vide, supprimez d'abord backend/db/store.db.

const db = require('./database');

const existing = db.prepare('SELECT COUNT(*) AS n FROM categories').get();
if (existing.n > 0) {
  console.log('La base contient déjà des données — aucune donnée de démo ajoutée.');
  console.log('(Pour repartir de zéro : supprimez backend/db/store.db puis relancez "npm run seed".)');
  process.exit(0);
}

const insertCategory = db.prepare(`
  INSERT INTO categories (name, slug, description, image, display_order)
  VALUES (@name, @slug, @description, @image, @display_order)
`);

const categories = [
  {
    name: 'Produits Hijama',
    slug: 'hijama',
    description: 'Kits et ventouses pour la pratique de la hijama à domicile.',
    image: 'category-hijama.svg',
    display_order: 1,
  },
  {
    name: 'Produits de massage',
    slug: 'massage',
    description: 'Outils et accessoires pour un massage relaxant chez vous.',
    image: 'category-massage.svg',
    display_order: 2,
  },
  {
    name: 'Huiles',
    slug: 'huiles',
    description: 'Huiles naturelles et essentielles pour le soin et la détente.',
    image: 'category-huiles.svg',
    display_order: 3,
  },
  {
    name: 'Accessoires',
    slug: 'accessoires',
    description: 'Compléments pratiques pour votre rituel bien-être.',
    image: 'category-accessoires.svg',
    display_order: 4,
  },
];

const categoryIds = {};
for (const cat of categories) {
  const info = insertCategory.run(cat);
  categoryIds[cat.slug] = info.lastInsertRowid;
}

const insertProduct = db.prepare(`
  INSERT INTO products (name, slug, description, price, old_price, category_id, stock, images, badge_new, badge_bestseller, active)
  VALUES (@name, @slug, @description, @price, @old_price, @category_id, @stock, @images, @badge_new, @badge_bestseller, 1)
`);

const img = (file) => JSON.stringify([file]);

const products = [
  // Hijama
  {
    name: 'Kit de hijama complet avec pompe',
    slug: 'kit-hijama-complet-pompe',
    description: "Kit complet pour la pratique de la hijama à domicile : ventouses de plusieurs tailles, pompe manuelle et étui de rangement. Idéal pour bien débuter.",
    price: 249, old_price: 299,
    category_id: categoryIds.hijama, stock: 18,
    images: img('placeholder-hijama.svg'), badge_new: 0, badge_bestseller: 1,
  },
  {
    name: 'Ventouses en verre (lot de 6)',
    slug: 'ventouses-verre-lot-6',
    description: "Ventouses traditionnelles en verre épais, résistantes à la chaleur. Lot de 6 tailles adaptées à toutes les zones du corps.",
    price: 129, old_price: null,
    category_id: categoryIds.hijama, stock: 32,
    images: img('placeholder-hijama.svg'), badge_new: 0, badge_bestseller: 0,
  },
  {
    name: 'Ventouses professionnelles en silicone (lot de 4)',
    slug: 'ventouses-silicone-lot-4',
    description: "Ventouses en silicone souple, sans pompe nécessaire, faciles à utiliser et à nettoyer. Lot de 4 tailles.",
    price: 99, old_price: null,
    category_id: categoryIds.hijama, stock: 25,
    images: img('placeholder-hijama.svg'), badge_new: 1, badge_bestseller: 0,
  },
  // Massage
  {
    name: 'Pierres de massage chaudes (set de 6)',
    slug: 'pierres-massage-chaudes-set-6',
    description: "Set de 6 pierres de basalte pour un massage relaxant à chaud, avec pochette de rangement.",
    price: 179, old_price: null,
    category_id: categoryIds.massage, stock: 14,
    images: img('placeholder-massage.svg'), badge_new: 0, badge_bestseller: 0,
  },
  {
    name: 'Rouleau de massage en bois',
    slug: 'rouleau-massage-bois',
    description: "Rouleau en bois naturel pour soulager les tensions musculaires, facile à utiliser au quotidien.",
    price: 89, old_price: null,
    category_id: categoryIds.massage, stock: 40,
    images: img('placeholder-massage.svg'), badge_new: 0, badge_bestseller: 1,
  },
  {
    name: 'Appareil de massage électrique portable',
    slug: 'appareil-massage-electrique-portable',
    description: "Appareil de massage compact et rechargeable, plusieurs intensités, idéal pour le dos et les épaules.",
    price: 249, old_price: 289,
    category_id: categoryIds.massage, stock: 9,
    images: img('placeholder-massage.svg'), badge_new: 1, badge_bestseller: 0,
  },
  // Huiles
  {
    name: "Huile de massage à l'huile d'argan",
    slug: 'huile-massage-argan',
    description: "Huile d'argan pure du Maroc, idéale pour les massages et le soin quotidien de la peau.",
    price: 79, old_price: null,
    category_id: categoryIds.huiles, stock: 50,
    images: img('placeholder-huiles.svg'), badge_new: 0, badge_bestseller: 1,
  },
  {
    name: 'Huile essentielle de lavande relaxante',
    slug: 'huile-essentielle-lavande',
    description: "Huile essentielle de lavande apaisante, parfaite en diffusion ou en massage léger.",
    price: 59, old_price: null,
    category_id: categoryIds.huiles, stock: 3,
    images: img('placeholder-huiles.svg'), badge_new: 0, badge_bestseller: 0,
  },
  {
    name: 'Huile de nigelle pressée à froid (Habba Sawda)',
    slug: 'huile-nigelle-habba-sawda',
    description: "Huile de nigelle 100% pure, première pression à froid, en flacon en verre teinté.",
    price: 69, old_price: null,
    category_id: categoryIds.huiles, stock: 27,
    images: img('placeholder-huiles.svg'), badge_new: 1, badge_bestseller: 0,
  },
  // Accessoires
  {
    name: 'Serviettes de bien-être en coton (lot de 2)',
    slug: 'serviettes-bien-etre-coton',
    description: "Serviettes douces 100% coton, format pratique pour vos séances de soin à domicile.",
    price: 69, old_price: null,
    category_id: categoryIds.accessoires, stock: 35,
    images: img('placeholder-accessoires.svg'), badge_new: 0, badge_bestseller: 0,
  },
  {
    name: 'Sac de rangement pour kit hijama',
    slug: 'sac-rangement-kit-hijama',
    description: "Pochette de rangement compacte pour transporter et organiser votre matériel de hijama.",
    price: 49, old_price: null,
    category_id: categoryIds.accessoires, stock: 22,
    images: img('placeholder-accessoires.svg'), badge_new: 0, badge_bestseller: 0,
  },
  {
    name: 'Coussin de massage chauffant',
    slug: 'coussin-massage-chauffant',
    description: "Coussin chauffant avec fonction massante, pour détendre nuque, dos et épaules.",
    price: 159, old_price: null,
    category_id: categoryIds.accessoires, stock: 11,
    images: img('placeholder-accessoires.svg'), badge_new: 1, badge_bestseller: 0,
  },
];

for (const p of products) insertProduct.run(p);

const insertReview = db.prepare(`
  INSERT INTO reviews (customer_name, rating, comment, is_demo, active, display_order)
  VALUES (@customer_name, @rating, @comment, 1, 1, @display_order)
`);

const reviews = [
  { customer_name: 'Fatima Z.', rating: 5, comment: 'Très bon produit, livraison rapide et service sérieux.', display_order: 1 },
  { customer_name: 'Youssef B.', rating: 5, comment: 'Kit de hijama complet, exactement comme décrit. Je recommande.', display_order: 2 },
  { customer_name: 'Salma K.', rating: 4, comment: 'Bonne qualité, la livraison a pris un jour de plus que prévu mais le produit est top.', display_order: 3 },
  { customer_name: 'Karim El.', rating: 5, comment: "Huile d'argan excellente, envoi soigné. Merci !", display_order: 4 },
  { customer_name: 'Amina R.', rating: 5, comment: 'Service client très réactif sur WhatsApp, je repasserai commande.', display_order: 5 },
];

for (const r of reviews) insertReview.run(r);

const insertFee = db.prepare(`INSERT INTO delivery_fees (city, fee) VALUES (@city, @fee)`);
const fees = [
  { city: 'Marrakech', fee: 25 },
  { city: 'Casablanca', fee: 35 },
  { city: 'Rabat', fee: 35 },
  { city: 'Tanger', fee: 40 },
  { city: 'Fès', fee: 40 },
];
for (const f of fees) insertFee.run(f);

console.log('Données de démonstration ajoutées :');
console.log(`  - ${categories.length} catégories`);
console.log(`  - ${products.length} produits`);
console.log(`  - ${reviews.length} avis (DEMO)`);
console.log(`  - ${fees.length} villes avec frais de livraison`);
console.log('');
console.log('Rappel : ce sont des exemples. Remplacez-les depuis /admin.');
