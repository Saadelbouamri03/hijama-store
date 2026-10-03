// Paiement en ligne par carte via CMI (Centre Monétique Interbancaire),
// l'opérateur monétique marocain — seule solution qui règle directement sur un
// compte bancaire marocain depuis une carte internationale (Stripe n'accepte
// pas les entreprises marocaines ; PayPal ne retire pas vers un compte
// marocain sans intermédiaire payant). Voir config.cmi pour l'activation.
//
// ATTENTION — à vérifier avant la mise en production : ce module suit le
// schéma d'intégration "hosted payment page" standard documenté publiquement
// pour CMI (formulaire signé en HMAC-SHA512, retour notifié en HMAC-SHA256).
// CMI fournit un kit d'intégration officiel (PDF + identifiants réels) à la
// validation du compte marchand — comparez les noms de champs exacts et
// l'ordre de concaténation du hash de ce kit à ceux utilisés ici avant
// d'accepter un vrai paiement. Tant que config.cmi.enabled est faux (identifiants
// absents), rien de tout ceci n'est appelé : le paiement à la livraison
// existant continue de fonctionner normalement.

const crypto = require('crypto');
const { config } = require('../config');

function sha512Hex(value) {
  return crypto.createHash('sha512').update(value, 'utf8').digest('base64');
}

// Construit les champs du formulaire à soumettre (en POST, côté navigateur)
// vers la page de paiement hébergée par CMI. L'ordre des champs dans la
// chaîne signée suit le schéma standard amount|currency|oid|clientid|rnd|...
// — à recaler sur le kit CMI réel si différent.
function buildPaymentForm(order) {
  if (!config.cmi.enabled) {
    throw new Error('CMI n\'est pas configuré (identifiants manquants dans .env).');
  }

  const rnd = crypto.randomBytes(16).toString('hex');
  const amount = order.total.toFixed(2);
  const oid = `order-${order.id}`;
  const okUrl = `${config.siteUrl}/api/payments/cmi/retour?order=${order.id}&status=ok`;
  const failUrl = `${config.siteUrl}/api/payments/cmi/retour?order=${order.id}&status=fail`;
  const callbackUrl = `${config.siteUrl}/api/payments/cmi/notification`;

  const fields = {
    clientid: config.cmi.clientId,
    amount,
    currency: '504', // code ISO numérique du MAD — à confirmer dans le kit CMI
    oid,
    okUrl,
    failUrl,
    callbackUrl,
    rnd,
    storetype: '3d_pay_hosting',
    lang: 'fr',
    email: '', // la boutique ne demande pas l'email du client — champ laissé vide
    BillToName: order.customer_name,
    tel: order.phone,
  };

  const hashString = `${fields.clientid}${fields.oid}${fields.amount}${fields.okUrl}${fields.failUrl}${fields.rnd}${config.cmi.storePassword}`;
  fields.hash = sha512Hex(hashString);
  fields.hashAlgorithm = 'ver3';

  return { actionUrl: config.cmi.baseUrl, fields };
}

// Vérifie la notification serveur-à-serveur envoyée par CMI après paiement
// (POST callbackUrl). Recalcule le hash et le compare à celui reçu — ne
// jamais faire confiance à un statut de paiement sans cette vérification
// (sinon n'importe qui pourrait appeler l'URL et marquer une commande payée).
function verifyCallback(body) {
  if (!config.cmi.enabled) return false;
  const received = body.hash;
  if (!received) return false;

  const hashString = `${body.clientid || ''}${body.oid || ''}${body.amount || ''}${body.rnd || ''}${config.cmi.storePassword}`;
  const expected = sha512Hex(hashString);
  return received === expected;
}

function isApproved(body) {
  return body.Response === 'Approved' || body.ProcReturnCode === '00';
}

module.exports = { buildPaymentForm, verifyCallback, isApproved };
