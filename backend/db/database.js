// Connexion unique à la base de données SQLite (better-sqlite3 est synchrone,
// ce qui simplifie beaucoup le code par rapport à des appels asynchrones).
// Le fichier store.db est créé automatiquement ici si besoin :
//   backend/db/store.db

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// En production sur un hébergeur avec disque persistant (ex. Render), DB_PATH
// pointe vers ce disque (voir render.yaml) pour que la base survive aux
// redéploiements. En local, aucune variable n'est définie : on garde le
// fichier ici, dans backend/db/, comme avant.
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'store.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

const db = new Database(DB_PATH);

// Bonnes pratiques SQLite recommandées par better-sqlite3.
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Applique le schéma (CREATE TABLE IF NOT EXISTS -> sans danger pour les données existantes).
const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
db.exec(schema);

// Petites migrations additives : SQLite n'a pas de "ADD COLUMN IF NOT EXISTS",
// donc on vérifie la colonne avant de l'ajouter (sans risque sur les données).
function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
ensureColumn('products', 'video_url', "TEXT DEFAULT ''");

module.exports = db;
