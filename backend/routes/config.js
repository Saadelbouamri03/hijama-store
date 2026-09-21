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
  });
});

module.exports = router;
