-- Schéma de la base de données de la boutique.
-- Exécuté automatiquement au démarrage du serveur (voir backend/db/database.js).
-- CREATE TABLE IF NOT EXISTS : ne recrée jamais une table déjà existante,
-- donc vos données ne sont jamais effacées par un redémarrage du serveur.

CREATE TABLE IF NOT EXISTS categories (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  description   TEXT DEFAULT '',
  image         TEXT DEFAULT '',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  name              TEXT NOT NULL,
  slug              TEXT NOT NULL UNIQUE,
  description       TEXT DEFAULT '',
  price             REAL NOT NULL,
  old_price         REAL,
  category_id       INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  stock             INTEGER NOT NULL DEFAULT 0,
  images            TEXT NOT NULL DEFAULT '[]',
  video_url         TEXT DEFAULT '',
  badge_new         INTEGER NOT NULL DEFAULT 0,
  badge_bestseller  INTEGER NOT NULL DEFAULT 0,
  active            INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);

-- Variantes d'un produit (ex. "taille 6cm" / "taille 7cm", ou "marque Safaa" /
-- "marque Al Assala"), chacune avec son propre prix et son propre stock.
-- Un produit SANS ligne ici se vend simplement au prix/stock de la table
-- products (cas le plus courant) ; un produit AVEC des lignes ici affiche un
-- menu de choix sur sa fiche, et le prix/stock affiché suit la variante
-- choisie par le client.
CREATE TABLE IF NOT EXISTS product_variants (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label         TEXT NOT NULL,
  price         REAL NOT NULL,
  stock         INTEGER NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);

CREATE TABLE IF NOT EXISTS orders (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  customer_name   TEXT NOT NULL,
  phone           TEXT NOT NULL,
  city            TEXT NOT NULL,
  address         TEXT NOT NULL,
  region          TEXT DEFAULT '',
  postal_code     TEXT DEFAULT '',
  comment         TEXT DEFAULT '',
  subtotal        REAL NOT NULL,
  delivery_fee    REAL NOT NULL,
  total           REAL NOT NULL,
  payment_method  TEXT NOT NULL DEFAULT 'Paiement à la livraison',
  status          TEXT NOT NULL DEFAULT 'Nouvelle commande'
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);

CREATE TABLE IF NOT EXISTS order_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id      INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id    INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_name  TEXT NOT NULL,
  variant_label TEXT DEFAULT '',
  unit_price    REAL NOT NULL,
  quantity      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

CREATE TABLE IF NOT EXISTS reviews (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name  TEXT NOT NULL,
  rating         INTEGER NOT NULL DEFAULT 5,
  comment        TEXT NOT NULL,
  is_demo        INTEGER NOT NULL DEFAULT 1,
  active         INTEGER NOT NULL DEFAULT 1,
  display_order  INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS delivery_fees (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  city  TEXT NOT NULL UNIQUE,
  fee   REAL NOT NULL
);
