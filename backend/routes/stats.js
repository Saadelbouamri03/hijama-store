const express = require('express');
const db = require('../db/database');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

const LOW_STOCK_THRESHOLD = 5;

// GET /api/admin/stats - admin uniquement
router.get('/', requireAdmin, (req, res) => {
  const countByStatus = (status) =>
    db.prepare('SELECT COUNT(*) AS n FROM orders WHERE status = ?').get(status).n;

  const totalOrders = db.prepare('SELECT COUNT(*) AS n FROM orders').get().n;
  const revenue = db.prepare("SELECT COALESCE(SUM(total), 0) AS s FROM orders WHERE status != 'Annulée'").get().s;
  const productCount = db.prepare('SELECT COUNT(*) AS n FROM products WHERE active = 1').get().n;
  const lowStock = db.prepare('SELECT id, name, stock FROM products WHERE active = 1 AND stock <= ? ORDER BY stock ASC').all(LOW_STOCK_THRESHOLD);

  res.json({
    totalOrders,
    newOrders: countByStatus('Nouvelle commande'),
    confirmedOrders: countByStatus('Confirmée'),
    preparingOrders: countByStatus('Préparation'),
    shippedOrders: countByStatus('Expédiée'),
    deliveredOrders: countByStatus('Livrée'),
    cancelledOrders: countByStatus('Annulée'),
    revenue,
    productCount,
    lowStockCount: lowStock.length,
    lowStockProducts: lowStock,
  });
});

module.exports = router;
