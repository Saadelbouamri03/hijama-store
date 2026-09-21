// Envoie l'évènement "Purchase" côté serveur à l'API Conversions de Meta,
// en complément du pixel navigateur (voir frontend/merci.html) : ceci
// permet à la commande d'être comptée même si le navigateur du client
// bloque le pixel (Safari ITP, bloqueurs de pub...).
// Le même event_id ("purchase_<id commande>") est utilisé des deux côtés
// pour que Meta dédoublonne l'évènement au lieu de le compter deux fois :
// https://developers.facebook.com/docs/marketing-api/conversions-api/deduplicate-pixel-and-server-events

const crypto = require('crypto');
const { config } = require('../config');

function sha256(value) {
  return crypto.createHash('sha256').update(String(value).trim().toLowerCase()).digest('hex');
}

// Convertit un numéro marocain saisi sous n'importe quel format usuel
// (0612345678, +212612345678, 00212612345678) vers 212612345678, seul
// format que Meta reconnaît de façon fiable pour le hachage.
function normalizePhone(raw) {
  let digits = String(raw || '').replace(/[\s.\-()]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = '212' + digits.slice(1);
  return digits;
}

function getCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function sendEventCapi(eventName, eventId, order, req) {
  if (!config.metaPixel.capiAccessToken) return;

  const nameParts = String(order.customer_name || '').trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ');

  const userData = {
    ph: [sha256(normalizePhone(order.phone))],
    country: [sha256('ma')],
    client_ip_address: req.ip,
    client_user_agent: req.headers['user-agent'] || '',
  };
  if (order.city) userData.ct = [sha256(order.city)];
  if (firstName) userData.fn = [sha256(firstName)];
  if (lastName) userData.ln = [sha256(lastName)];
  const fbp = getCookie(req, '_fbp');
  const fbc = getCookie(req, '_fbc');
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;

  const payload = {
    data: [{
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      action_source: 'website',
      event_source_url: 'https://hijamastore.com/merci',
      user_data: userData,
      custom_data: {
        currency: 'MAD',
        value: order.total,
        content_type: 'product',
        contents: (order.items || []).map((i) => ({ id: i.product_id, quantity: i.quantity })),
      },
    }],
  };

  try {
    const url = `https://graph.facebook.com/v21.0/${config.metaPixel.id}/events?access_token=${encodeURIComponent(config.metaPixel.capiAccessToken)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`Meta CAPI: échec envoi évènement ${eventName} —`, res.status, text);
    }
  } catch (err) {
    console.error(`Meta CAPI: erreur réseau (${eventName}) —`, err.message);
  }
}

function sendPurchaseEventCapi(order, req) {
  return sendEventCapi('Purchase', `purchase_${order.id}`, order, req);
}

// Évènement custom envoyé quand une commande passe au statut "Confirmée"
// dans l'admin (donc après un vrai appel de confirmation), plutôt qu'à la
// simple création — sert plus tard à optimiser les campagnes publicitaires
// sur les commandes confirmées plutôt que sur les commandes brutes.
function sendConfirmedOrderEventCapi(order, req) {
  return sendEventCapi('ConfirmedOrder', `confirmed_${order.id}`, order, req);
}

module.exports = { sendPurchaseEventCapi, sendConfirmedOrderEventCapi };
