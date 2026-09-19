// Middleware de protection : bloque l'accès aux routes admin si la session
// n'est pas authentifiée. Utilisé sur toutes les routes de création/
// modification/suppression (produits, catégories, commandes, avis, livraison)
// et sur les statistiques du dashboard.

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  return res.status(401).json({ error: 'Authentification admin requise.' });
}

module.exports = { requireAdmin };
