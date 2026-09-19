// Point d'extension pour être notifié lors d'une nouvelle commande.
//
// Par défaut, la notification se contente d'un message dans le terminal du
// serveur. En plus, si GOOGLE_SHEETS_WEBHOOK_URL est défini dans .env, chaque
// commande est automatiquement ajoutée comme nouvelle ligne dans une feuille
// Google Sheets (voir la section "Google Sheets" du README pour la mise en
// place, en 5 minutes, sans compte développeur Google).
//
// Aucune commande n'est jamais bloquée si une notification échoue : ces
// intégrations sont "best-effort" et ne doivent jamais empêcher une vente.

const https = require('https');
const nodemailer = require('nodemailer');
const { config } = require('../config');
const { renderBonCommande } = require('./bon-commande');

function notifyNewOrder(order) {
  console.log('\n📦 Nouvelle commande #' + order.id + ' — ' + order.customer_name + ' (' + order.city + ') — ' + order.total + ' DH\n');

  sendToGoogleSheets(order);
  sendOrderEmail(order);
}

// Lien WhatsApp "prêt à envoyer" : ouvre une conversation avec le numéro de
// la boutique elle-même (fonction "Vous" / message à soi-même de WhatsApp),
// message déjà rempli avec le résumé de la commande — un seul clic depuis le
// téléphone ou l'email de notification, sans compte API à configurer.
function whatsappSelfLink(order) {
  const number = (config.whatsappNumber || '').replace(/[^\d]/g, '');
  if (!number) return null;
  const productsLine = (order.items || [])
    .map((it) => `- ${it.product_name}${it.variant_label ? ' (' + it.variant_label + ')' : ''} x${it.quantity}`)
    .join('\n');
  const text = `Nouvelle commande #${order.id}\n${order.customer_name} — ${order.phone}\n${order.address}, ${order.city}\n\n${productsLine}\n\nTotal : ${order.total} ${config.currency}`;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

let cachedTransporter = null;
function getEmailTransporter() {
  if (!config.notifyEmail.user || !config.notifyEmail.appPassword) return null;
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: config.notifyEmail.user, pass: config.notifyEmail.appPassword },
    });
  }
  return cachedTransporter;
}

// Notification email "best-effort" : ne bloque jamais la commande si Gmail
// n'est pas configuré ou si l'envoi échoue (la commande est déjà enregistrée
// avant cet appel, voir routes/orders.js).
function sendOrderEmail(order) {
  const transporter = getEmailTransporter();
  if (!transporter) return; // fonctionnalité non activée (.env incomplet)

  const waLink = whatsappSelfLink(order);
  const html = renderBonCommande(order, config).replace(
    '</body>',
    waLink
      ? `<p class="no-print"><a href="${waLink}" style="display:inline-block;margin-top:16px;padding:10px 18px;background:#25D366;color:#fff;border-radius:8px;font-weight:700;text-decoration:none;font-family:sans-serif">Envoyer ce résumé sur WhatsApp</a></p></body>`
      : '</body>'
  );

  transporter.sendMail({
    from: `"${config.storeName}" <${config.notifyEmail.user}>`,
    to: config.notifyEmail.to,
    subject: `Nouvelle commande #${order.id} — ${order.customer_name} (${order.total} ${config.currency})`,
    html,
  }).catch((err) => console.error('Notification email échouée (commande tout de même enregistrée) :', err.message));
}

// Envoie la commande à un "Google Apps Script Web App" branché sur une
// feuille Google Sheets. C'est l'option la plus simple pour un compte
// Google personnel : pas de paquet npm, pas de fichier de clés à protéger,
// juste une URL secrète à coller dans .env (GOOGLE_SHEETS_WEBHOOK_URL).
function sendToGoogleSheets(order) {
  const url = config.googleSheetsWebhookUrl;
  if (!url) return; // fonctionnalité non activée, on ne fait rien

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    console.error('GOOGLE_SHEETS_WEBHOOK_URL invalide dans .env — envoi ignoré.');
    return;
  }

  const payload = JSON.stringify({
    orderId: order.id,
    date: order.created_at,
    customerName: order.customer_name,
    phone: order.phone,
    city: order.city,
    address: order.address,
    region: order.region || '',
    comment: order.comment || '',
    products: (order.items || [])
      .map((it) => `${it.product_name}${it.variant_label ? ' (' + it.variant_label + ')' : ''} x${it.quantity}`)
      .join(', '),
    subtotal: order.subtotal,
    deliveryFee: order.delivery_fee,
    total: order.total,
    status: order.status,
  });

  const req = https.request(
    {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 8000,
    },
    (res) => {
      // Google Apps Script répond souvent par une redirection (30x) même en
      // cas de succès : on ne traite que les vraies erreurs serveur.
      if (res.statusCode >= 500) {
        console.error('Google Sheets a répondu avec une erreur:', res.statusCode);
      }
      res.on('data', () => {});
    }
  );

  req.on('error', (err) => {
    console.error('Envoi vers Google Sheets échoué (commande tout de même enregistrée):', err.message);
  });
  req.on('timeout', () => req.destroy());
  req.write(payload);
  req.end();
}

module.exports = { notifyNewOrder };
