// Configuration centrale de l'application.
// Toutes les valeurs modifiables (nom de la boutique, WhatsApp, réseaux sociaux...)
// se trouvent dans le fichier .env à la racine du projet, PAS dans ce fichier.
// Ce module se contente de les lire et de fournir des valeurs par défaut sûres.

require('dotenv').config();

function required(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  return value;
}

const config = {
  port: parseInt(required('PORT', '3000'), 10),
  nodeEnv: required('NODE_ENV', 'development'),

  storeName: required('STORE_NAME', '[NOM DE LA BOUTIQUE]'),
  storeTagline: required('STORE_TAGLINE', 'Produits de hijama, massage et bien-être'),

  whatsappNumber: required('WHATSAPP_NUMBER', '[NUMERO WHATSAPP]'),
  // Numéro affiché comme lien "tel:" cliquable (footer, page contact) ;
  // même numéro que WhatsApp par défaut, sauf si un numéro d'appel dédié est renseigné.
  phoneNumber: required('PHONE_NUMBER', required('WHATSAPP_NUMBER', '[NUMERO WHATSAPP]')),
  storeHours: required('STORE_HOURS', ''),

  socials: {
    instagram: required('INSTAGRAM_URL', '[LIEN INSTAGRAM]'),
    facebook: required('FACEBOOK_URL', '[LIEN FACEBOOK]'),
    tiktok: required('TIKTOK_URL', '[LIEN TIKTOK]'),
  },

  currency: required('CURRENCY', 'DH'),
  deliveryCountry: required('DELIVERY_COUNTRY', 'Maroc'),
  defaultDeliveryFee: parseFloat(required('DEFAULT_DELIVERY_FEE', '30')),

  admin: {
    username: required('ADMIN_USERNAME', 'admin'),
    password: required('ADMIN_PASSWORD', null),
  },

  sessionSecret: required('SESSION_SECRET', null),

  // URL du "Google Apps Script Web App" pour l'export automatique des
  // commandes vers Google Sheets (voir section "Google Sheets" du README).
  // Laissez vide pour désactiver cette fonctionnalité (aucun impact ailleurs).
  googleSheetsWebhookUrl: required('GOOGLE_SHEETS_WEBHOOK_URL', ''),

  // Notification automatique par email à chaque nouvelle commande (via Gmail
  // + mot de passe d'application). Laissez NOTIFY_EMAIL_USER vide pour
  // désactiver cette fonctionnalité (aucun impact ailleurs).
  notifyEmail: {
    user: required('NOTIFY_EMAIL_USER', ''),
    appPassword: required('NOTIFY_EMAIL_APP_PASSWORD', ''),
    to: required('NOTIFY_EMAIL_TO', required('NOTIFY_EMAIL_USER', '')),
  },

  // Avis "DEMO" livrés avec le site au premier lancement (voir backend/db/seed.js) :
  // masqués aux visiteurs par défaut tant qu'aucun vrai avis n'a été saisi dans
  // l'admin. Mettre SHOW_DEMO_REVIEWS=true pour les réafficher temporairement
  // (ex. pour visualiser la mise en page avant d'avoir de vrais avis).
  reviews: {
    showDemo: required('SHOW_DEMO_REVIEWS', 'false') === 'true',
  },

  // Meta Pixel + Conversions API (suivi des commandes pour les publicités
  // Facebook/Instagram). META_CAPI_ACCESS_TOKEN active l'envoi côté serveur
  // (recommandé, contourne les bloqueurs de pub) ; laissez-le vide pour
  // n'utiliser que le pixel navigateur.
  metaPixel: {
    id: required('META_PIXEL_ID', '8482376721812747'),
    capiAccessToken: required('META_CAPI_ACCESS_TOKEN', ''),
  },

  tiktokPixel: {
    id: required('TIKTOK_PIXEL_ID', ''),
    accessToken: required('TIKTOK_ACCESS_TOKEN', ''),
  },

  // Landing page /pack-hajjam-pro : le pack lui-même est un produit normal du
  // catalogue (créé une fois via l'admin, voir son slug ci-dessous) — ceci ne
  // configure que la règle de remise sur la 2e unité et le produit d'upsell,
  // pour ne rien coder en dur dans les routes de commande.
  pack: {
    productSlug: required('PACK_PRODUCT_SLUG', 'pack-hajjam-pro'),
    secondUnitDiscount: parseFloat(required('PACK_SECOND_UNIT_DISCOUNT', '49')),
    upsellProductId: parseInt(required('PACK_UPSELL_PRODUCT_ID', '95'), 10),
  },
};

// Avertissements de sécurité au démarrage si la config par défaut n'a pas été changée.
function checkConfig() {
  const warnings = [];
  if (!config.admin.password) {
    warnings.push('ADMIN_PASSWORD n\'est pas défini dans .env — /admin sera inaccessible tant que ce n\'est pas fait.');
  }
  if (!config.sessionSecret) {
    warnings.push('SESSION_SECRET n\'est pas défini dans .env — une valeur temporaire non sécurisée est utilisée.');
  }
  if (config.whatsappNumber.startsWith('[')) {
    warnings.push('WHATSAPP_NUMBER n\'a pas été renseigné dans .env (placeholder détecté).');
  }
  return warnings;
}

module.exports = { config, checkConfig };
