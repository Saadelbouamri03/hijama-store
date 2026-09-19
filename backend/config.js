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
