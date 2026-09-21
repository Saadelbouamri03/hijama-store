// Route publique : expose au frontend les informations de configuration
// qui ne sont pas secrètes (le numéro WhatsApp et les liens sociaux sont
// de toute façon destinés à être visibles publiquement sur le site).
// Les vraies valeurs viennent du fichier .env (voir backend/config.js).

const express = require('express');
const { config } = require('../config');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    storeName: config.storeName,
    storeTagline: config.storeTagline,
    whatsappNumber: config.whatsappNumber,
    phoneNumber: config.phoneNumber,
    storeHours: config.storeHours,
    socials: config.socials,
    currency: config.currency,
    deliveryCountry: config.deliveryCountry,
    defaultDeliveryFee: config.defaultDeliveryFee,
    // L'ID du pixel n'est pas secret (visible dans le code de n'importe quel
    // site qui l'utilise) ; le token d'accès Events API, lui, reste côté
    // serveur uniquement (voir backend/utils/tiktok-events.js).
    tiktokPixelId: config.tiktokPixel.id,
  });
});

// GET /api/config/pack - valeurs nécessaires à la landing page /pack-hajjam-pro
// (montant de la remise 2e unité, id du produit d'upsell) : séparé du reste
// de la config générale, chargé uniquement par cette page.
router.get('/pack', (req, res) => {
  res.json({
    productSlug: config.pack.productSlug,
    secondUnitDiscount: config.pack.secondUnitDiscount,
    upsellProductId: config.pack.upsellProductId,
  });
});

module.exports = router;
