// Gère l'upload des photos produits depuis l'espace admin.
// Les fichiers sont enregistrés directement dans frontend/images/products/
// afin d'être servis comme fichiers statiques, sans étape supplémentaire.

const path = require('path');
const fs = require('fs');
const multer = require('multer');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'frontend', 'images', 'products');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const base = path.basename(file.originalname, ext)
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
    cb(null, `${Date.now()}-${base}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 6 }, // 5 Mo par image, 6 images max
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Format d\'image non supporté (jpg, png, webp ou gif uniquement).'));
  },
});

module.exports = { upload, UPLOAD_DIR };
