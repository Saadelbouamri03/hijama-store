// Retours et notifications du paiement en ligne CMI (voir backend/utils/cmi.js
// pour le contexte complet et les points à vérifier avant mise en production).

const express = require('express');
const db = require('../db/database');
const { verifyCallback, isApproved, buildPaymentForm } = require('../utils/cmi');
const { sendPurchaseEventCapi } = require('../utils/meta-capi');
const { sendPurchaseEventTikTok } = require('../utils/tiktok-events');

const router = express.Router();

// GET /api/payments/cmi/form?order=123 — régénère le formulaire de paiement
// d'une commande en attente, pour la page /paiement (voir frontend/paiement.html).
// Volontairement public (pas de session requise) : un client qui reçoit ce
// lien par WhatsApp n'a pas de compte sur le site. Comme pour tout lien de
// paiement, la sécurité tient à ce que peu de monde connaît cet ID précis —
// acceptable à l'échelle actuelle de la boutique, à revoir si le volume de
// commandes grandit beaucoup (ajouter un jeton non devinable dans l'URL).
router.get('/cmi/form', (req, res) => {
  const orderId = parseInt(req.query.order, 10);
  if (!Number.isFinite(orderId)) return res.status(400).json({ error: 'Commande invalide.' });

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return res.status(404).json({ error: 'Commande introuvable.' });
  if (order.payment_status !== 'en_attente') {
    return res.status(400).json({ error: `Cette commande n'est plus en attente de paiement (statut : ${order.payment_status}).` });
  }

  try {
    const payment = buildPaymentForm(order);
    res.json(payment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function getOrderId(req) {
  const raw = req.query.order || (req.body && req.body.oid && req.body.oid.replace('order-', ''));
  const id = parseInt(raw, 10);
  return Number.isFinite(id) ? id : null;
}

// POST /api/payments/cmi/notification — appelé serveur-à-serveur par CMI,
// seule source fiable pour marquer une commande payée (le retour navigateur
// peut être fermé par le client avant la redirection).
router.post('/cmi/notification', express.urlencoded({ extended: true }), (req, res) => {
  const valid = verifyCallback(req.body);
  if (!valid) {
    console.error('CMI notification : signature invalide, ignorée.', req.body);
    return res.status(400).send('invalid signature');
  }

  const orderId = getOrderId(req);
  if (!orderId) return res.status(400).send('missing order id');

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return res.status(404).send('order not found');

  const approved = isApproved(req.body);
  db.prepare('UPDATE orders SET payment_status = ?, payment_ref = ? WHERE id = ?').run(
    approved ? 'payee' : 'echouee',
    req.body.TransId || req.body.transId || '',
    orderId
  );

  // Évènement "Purchase" envoyé seulement ici, maintenant que le paiement est
  // confirmé — req vient du serveur CMI (pas du navigateur du client), donc
  // l'IP/user-agent associés seront ceux de CMI plutôt que du client réel ;
  // acceptable pour ce cas (serveur-à-serveur), à garder à l'esprit si la
  // qualité de correspondance Meta semble plus faible sur ces commandes-là.
  if (approved && order.payment_status !== 'payee') {
    const updated = { ...order, payment_status: 'payee' };
    sendPurchaseEventCapi(updated, req);
    sendPurchaseEventTikTok(updated, req);
  }

  res.send('OK'); // CMI attend ce texte exact pour considérer la notification reçue
});

// GET /api/payments/cmi/retour — redirection navigateur après paiement
// (succès ou échec), renvoie simplement vers /merci ou le panier avec un état
// lisible côté front ; le statut réel de la commande vient de la notification
// ci-dessus, jamais de ce retour (que le client peut fermer avant d'y arriver).
router.get('/cmi/retour', (req, res) => {
  const orderId = req.query.order;
  if (req.query.status === 'ok') {
    res.redirect(`/merci?order=${encodeURIComponent(orderId || '')}`);
  } else {
    res.redirect(`/panier?paiement=echoue`);
  }
});

module.exports = router;
