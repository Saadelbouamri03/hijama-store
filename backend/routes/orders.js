const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db/database');
const { requireAdmin } = require('../middleware/auth');
const { validateOrderInput } = require('../utils/validators');
const { ordersToCsv } = require('../utils/csv');
const { notifyNewOrder } = require('../utils/notify');
const { renderBonCommande } = require('../utils/bon-commande');
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

  const subtotal = lineItems.reduce((sum, li) => sum + (li.variant ? li.variant.price : li.product.price) * li.quantity, 0);
  const deliveryFee = findDeliveryFee(body.city);
  const total = subtotal + deliveryFee;

  const createOrder = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO orders (customer_name, phone, city, address, region, postal_code, comment, subtotal, delivery_fee, total, payment_method, status)
      VALUES (@customer_name, @phone, @city, @address, @region, @postal_code, @comment, @subtotal, @delivery_fee, @total, 'Paiement à la livraison', 'Nouvelle commande')
    `).run({
      customer_name: body.customerName.trim(),
      phone: body.phone.trim(),
      city: body.city.trim(),
      address: body.address.trim(),
      region: body.region || '',
      postal_code: body.postalCode || '',
      comment: body.comment || '',
      subtotal, delivery_fee: deliveryFee, total,
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

module.exports = router;
module.exports.ORDER_STATUSES = ORDER_STATUSES;
