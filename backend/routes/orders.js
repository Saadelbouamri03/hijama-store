const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db/database');
const { requireAdmin } = require('../middleware/auth');
const { validateOrderInput } = require('../utils/validators');
const { ordersToCsv } = require('../utils/csv');
const { notifyNewOrder } = require('../utils/notify');
const { sendPurchaseEventCapi } = require('../utils/meta-capi');
const { renderBonCommande } = require('../utils/bon-commande');
const { generateBonCommandePdf } = require('../utils/bon-commande-pdf');
const { config } = require('../config');

const router = express.Router();

const ORDER_STATUSES = ['Nouvelle commande', 'Confirmée', 'Préparation', 'Expédiée', 'Livrée', 'Annulée'];

// Empêche un robot d'inonder la boutique de fausses commandes (spam,
// épuisement du stock). Un vrai client ne passe jamais 20 commandes en
// 10 minutes depuis la même connexion.
const orderLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de commandes envoyées en peu de temps. Merci de réessayer dans quelques minutes.' },
});

function getOrderWithItems(id) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!order) return null;
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id);
  return { ...order, items };
}

function findDeliveryFee(city) {
  const row = db.prepare('SELECT fee FROM delivery_fees WHERE LOWER(city) = LOWER(?)').get((city || '').trim());
  return row ? row.fee : config.defaultDeliveryFee;
}

// Un produit vendu "par boîte" (ex. "كؤوس الصفاء للحجامة (100 كأس)") l'indique
// toujours ainsi dans son nom — sert à repérer ce type de produit sans le
// coder en dur par identifiant, pour que la règle s'applique aussi à toute
// future référence vendue de la même façon.
function isBoxedProduct(name) {
  return /\(\d+\s*(?:كأس|قطعة|pièces?|pcs?)\)/i.test(String(name || ''));
}

const BOX_UNITS_PER_PARCEL = 10;

// Calcule le nombre de "colis" que le transporteur va réellement manipuler,
// pour multiplier le frais de livraison de base (par ville) d'autant :
//  - Mobilier/équipement (catégorie "athath-tajhizat" : sièges, tables...) :
//    chaque unité part dans son propre carton, toujours (jamais mutualisé).
//  - Produits vendus par boîte (ex. coffrets de 100 ventouses) : les boîtes
//    s'empilent ensemble, 10 boîtes tenant dans un même colis.
//  - Tout le reste (accessoires, produits à l'unité...) : se glisse dans la
//    place restante du dernier colis de boîtes s'il en reste (nombre de
//    boîtes non multiple de 10), sinon nécessite son propre colis partagé.
function computeDeliveryFee(city, lineItems) {
  const baseFee = findDeliveryFee(city);
  const bulkyCategory = db.prepare("SELECT id FROM categories WHERE slug = 'athath-tajhizat'").get();
  const bulkyCategoryId = bulkyCategory ? bulkyCategory.id : null;

  let furnitureUnits = 0;
  let boxUnits = 0;
  let hasOtherItems = false;

  for (const li of lineItems) {
    if (bulkyCategoryId && li.product.category_id === bulkyCategoryId) {
      furnitureUnits += li.quantity;
    } else if (isBoxedProduct(li.product.name)) {
      boxUnits += li.quantity;
    } else {
      hasOtherItems = true;
    }
  }

  const boxParcels = boxUnits > 0 ? Math.ceil(boxUnits / BOX_UNITS_PER_PARCEL) : 0;
  const boxHasSpareRoom = boxUnits > 0 && boxUnits % BOX_UNITS_PER_PARCEL !== 0;
  const otherNeedsOwnParcel = hasOtherItems && !boxHasSpareRoom;

  const parcelCount = furnitureUnits + boxParcels + (otherNeedsOwnParcel ? 1 : 0);
  return baseFee * Math.max(1, parcelCount);
}

// POST /api/orders - création publique d'une commande.
// IMPORTANT : les prix et le total sont toujours recalculés côté serveur à
// partir de la base de données (jamais depuis les valeurs envoyées par le
// navigateur), pour que personne ne puisse falsifier un prix.
router.post('/', orderLimiter, (req, res) => {
  const body = req.body || {};
  const { valid, errors } = validateOrderInput(body);
  if (!valid) return res.status(400).json({ error: errors.join(' ') });

  // Vérifie chaque produit (et sa variante éventuelle : taille, marque...) et le stock disponible.
  const lineItems = [];
  for (const item of body.items) {
    const product = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(item.productId);
    if (!product) {
      return res.status(400).json({ error: `Un produit du panier n'est plus disponible.` });
    }

    let variant = null;
    if (item.variantId) {
      variant = db.prepare('SELECT * FROM product_variants WHERE id = ? AND product_id = ?').get(item.variantId, item.productId);
      if (!variant) {
        return res.status(400).json({ error: `Cette option de "${product.name}" n'est plus disponible.` });
      }
    }

    const label = variant ? ` (${variant.label})` : '';
    const availableStock = variant ? variant.stock : product.stock;
    if (availableStock < item.quantity) {
      return res.status(400).json({ error: `Stock insuffisant pour "${product.name}"${label} (${availableStock} disponible(s)).` });
    }
    lineItems.push({ product, variant, quantity: item.quantity });
  }

  // Anti-doublon : un même téléphone qui recommande un produit déjà commandé
  // il y a moins de 10 minutes est presque toujours un double clic / un
  // rechargement de page plutôt qu'une vraie 2e commande volontaire.
  const cleanPhone = body.phone.trim();
  const productIds = [...new Set(lineItems.map((li) => li.product.id))];
  const duplicatePlaceholders = productIds.map(() => '?').join(',');
  const duplicate = db.prepare(`
    SELECT o.id FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    WHERE o.phone = ? AND oi.product_id IN (${duplicatePlaceholders})
      AND o.created_at >= datetime('now', '-10 minutes')
    LIMIT 1
  `).get(cleanPhone, ...productIds);
  if (duplicate) {
    return res.status(429).json({ error: 'Une commande avec ce numéro et ce(s) produit(s) vient déjà d\'être envoyée. Nous vous contactons très vite — merci de ne pas renvoyer.' });
  }

  // Remise pack : 2e unité du pack "Hajjam Pro" moins chère (voir config.pack).
  // Ne s'applique qu'à ce produit précis, jamais inventée pour un autre.
  const packLine = lineItems.find((li) => li.product.slug === config.pack.productSlug);
  const packDiscount = (packLine && packLine.quantity >= 2) ? config.pack.secondUnitDiscount : 0;

  const subtotal = lineItems.reduce((sum, li) => sum + (li.variant ? li.variant.price : li.product.price) * li.quantity, 0) - packDiscount;
  const deliveryFee = computeDeliveryFee(body.city, lineItems);
  const total = subtotal + deliveryFee;

  const createOrder = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO orders (customer_name, phone, city, address, region, postal_code, comment, subtotal, delivery_fee, total, payment_method, status, utm_source, utm_medium, utm_campaign, fbclid, ttclid, landing_page, ab_variant)
      VALUES (@customer_name, @phone, @city, @address, @region, @postal_code, @comment, @subtotal, @delivery_fee, @total, 'Paiement à la livraison', 'Nouvelle commande', @utm_source, @utm_medium, @utm_campaign, @fbclid, @ttclid, @landing_page, @ab_variant)
    `).run({
      customer_name: body.customerName.trim(),
      phone: cleanPhone,
      city: body.city.trim(),
      address: body.address && body.address.trim() ? body.address.trim() : 'Adresse à confirmer par téléphone',
      region: body.region || '',
      postal_code: body.postalCode || '',
      comment: body.comment || '',
      subtotal, delivery_fee: deliveryFee, total,
      utm_source: body.utmSource || '',
      utm_medium: body.utmMedium || '',
      utm_campaign: body.utmCampaign || '',
      fbclid: body.fbclid || '',
      ttclid: body.ttclid || '',
      landing_page: body.landingPage || '',
      ab_variant: body.abVariant || '',
    });

    const orderId = info.lastInsertRowid;
    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, product_id, product_name, variant_label, unit_price, quantity)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const decrementProductStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');
    const decrementVariantStock = db.prepare('UPDATE product_variants SET stock = stock - ? WHERE id = ?');

    for (const li of lineItems) {
      const unitPrice = li.variant ? li.variant.price : li.product.price;
      insertItem.run(orderId, li.product.id, li.product.name, li.variant ? li.variant.label : '', unitPrice, li.quantity);
      // Le stock se décrémente sur la variante choisie si le produit en a, sinon sur le produit lui-même.
      if (li.variant) decrementVariantStock.run(li.quantity, li.variant.id);
      else decrementProductStock.run(li.quantity, li.product.id);
    }

    return orderId;
  });

  const orderId = createOrder();
  const order = getOrderWithItems(orderId);
  notifyNewOrder(order);
  sendPurchaseEventCapi(order, req);
  res.status(201).json(order);
});

// GET /api/orders - admin, liste (avec filtre optionnel ?status=)
router.get('/', requireAdmin, (req, res) => {
  const { status } = req.query;
  const orders = status
    ? db.prepare('SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC').all(status)
    : db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
  res.json(orders);
});

// GET /api/orders/export/csv - admin, export CSV (placé avant "/:id" pour éviter tout conflit de route)
router.get('/export/csv', requireAdmin, (req, res) => {
  const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
  const withItems = orders.map((o) => ({
    ...o,
    items: db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id),
  }));
  const csv = ordersToCsv(withItems);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="commandes-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
});

// GET /api/orders/:id - admin, détail avec articles
router.get('/:id', requireAdmin, (req, res) => {
  const order = getOrderWithItems(req.params.id);
  if (!order) return res.status(404).json({ error: 'Commande introuvable.' });
  res.json(order);
});

// GET /api/orders/:id/bon-commande - admin, document imprimable (HTML) à
// envoyer au client pour confirmation et/ou au dépôt pour la préparation.
// Ouvert directement dans un nouvel onglet depuis le tableau de bord (la
// session admin passe par le cookie, pas besoin d'appel API séparé).
router.get('/:id/bon-commande', requireAdmin, (req, res) => {
  const order = getOrderWithItems(req.params.id);
  if (!order) return res.status(404).send('Commande introuvable.');
  res.send(renderBonCommande(order, config));
});

// GET /api/orders/:id/bon-commande.pdf - admin, même document en PDF réel
// (téléchargeable directement, même fichier que celui joint à l'email).
router.get('/:id/bon-commande.pdf', requireAdmin, async (req, res) => {
  const order = getOrderWithItems(req.params.id);
  if (!order) return res.status(404).send('Commande introuvable.');
  const pdfBuffer = await generateBonCommandePdf(order, config);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="bon-de-commande-${order.id}.pdf"`);
  res.send(pdfBuffer);
});

// PUT /api/orders/:id/status - admin, changement de statut
router.put('/:id/status', requireAdmin, (req, res) => {
  const { status } = req.body || {};
  if (!ORDER_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Statut invalide. Valeurs possibles : ${ORDER_STATUSES.join(', ')}` });
  }
  const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Commande introuvable.' });

  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json(getOrderWithItems(req.params.id));
});

// DELETE /api/orders/:id - admin, suppression définitive (ex. commandes de test).
// Restaure le stock consommé par la commande : supprimer une commande doit
// annuler tout son effet, sinon le stock réel se désynchronise petit à petit
// à chaque nettoyage de commande de test.
router.delete('/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Commande introuvable.' });

  const deleteOrder = db.transaction(() => {
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(req.params.id);
    const restoreVariantStock = db.prepare('UPDATE product_variants SET stock = stock + ? WHERE product_id = ? AND label = ?');
    const restoreProductStock = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?');
    for (const item of items) {
      if (item.variant_label) restoreVariantStock.run(item.quantity, item.product_id, item.variant_label);
      else if (item.product_id) restoreProductStock.run(item.quantity, item.product_id);
    }
    db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id); // order_items suit via ON DELETE CASCADE
  });
  deleteOrder();

  res.json({ success: true });
});

module.exports = router;
module.exports.ORDER_STATUSES = ORDER_STATUSES;
