// Envoie les évènements "Purchase" et "ConfirmedOrder" côté serveur à
// l'Events API de TikTok, sur le même principe que meta-capi.js : contourne
// les bloqueurs de tracking navigateur, dédoublonné avec le pixel via le
// même event_id des deux côtés.
// https://business-api.tiktok.com/portal/docs?id=1771101186666498

const crypto = require('crypto');
const { config } = require('../config');

function sha256(value) {
  return crypto.createHash('sha256').update(String(value).trim().toLowerCase()).digest('hex');
}

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

async function sendEventTikTok(eventName, eventId, order, req) {
  if (!config.tiktokPixel.id || !config.tiktokPixel.accessToken) return;

  const userData = {
    phone_number: [sha256(normalizePhone(order.phone))],
    ip: req.ip,
    user_agent: req.headers['user-agent'] || '',
  };
  const ttclid = getCookie(req, 'ttclid') || order.ttclid;
  if (ttclid) userData.ttclid = ttclid;

  const payload = {
    event_source: 'web',
    event_source_id: config.tiktokPixel.id,
    data: [{
      event: eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      user: userData,
      properties: {
        currency: 'MAD',
        value: order.total,
        contents: (order.items || []).map((i) => ({ content_id: String(i.product_id), quantity: i.quantity })),
      },
      page: { url: 'https://hijamastore.com/merci' },
    }],
  };

  try {
    const res = await fetch('https://business-api.tiktok.com/open_api/v1.3/event/track/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Access-Token': config.tiktokPixel.accessToken },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`TikTok Events API: échec envoi évènement ${eventName} —`, res.status, text);
    }
  } catch (err) {
    console.error(`TikTok Events API: erreur réseau (${eventName}) —`, err.message);
  }
}

function sendPurchaseEventTikTok(order, req) {
  return sendEventTikTok('Purchase', `purchase_${order.id}`, order, req);
}

function sendConfirmedOrderEventTikTok(order, req) {
  return sendEventTikTok('ConfirmedOrder', `confirmed_${order.id}`, order, req);
}

module.exports = { sendPurchaseEventTikTok, sendConfirmedOrderEventTikTok };
