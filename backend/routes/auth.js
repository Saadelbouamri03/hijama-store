// Authentification de l'espace admin.
// Un seul compte admin, défini dans .env (ADMIN_USERNAME / ADMIN_PASSWORD).
// Pas de mot de passe stocké dans la base de données : c'est volontairement
// simple, adapté à une petite boutique gérée par une seule personne.

const express = require('express');
const rateLimit = require('express-rate-limit');
const { config } = require('../config');

const router = express.Router();

// Limite les tentatives de connexion admin pour empêcher un robot de
// deviner le mot de passe par essais successifs (brute-force).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 tentatives par IP sur la fenêtre
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives de connexion. Réessayez dans quelques minutes.' },
});

router.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body || {};

  if (!config.admin.password) {
    return res.status(500).json({ error: "ADMIN_PASSWORD n'est pas configuré dans .env." });
  }

  // L'identifiant n'est pas sensible à la casse (facilite la saisie sur
  // téléphone/autofill) ; le mot de passe reste comparé strictement.
  const usernameMatches = String(username || '').toLowerCase() === config.admin.username.toLowerCase();
  if (usernameMatches && password === config.admin.password) {
    req.session.isAdmin = true;
    req.session.username = username;
    return res.json({ success: true });
  }

  return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect.' });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

router.get('/session', (req, res) => {
  res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

module.exports = router;
