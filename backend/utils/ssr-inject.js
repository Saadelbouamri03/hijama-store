// Injection de données initiales dans une page statique avant envoi, pour
// éviter le flash "Chargement…" le temps que le JS client fasse son propre
// fetch (voir frontend/js/main.js, products.js, categories.html, avis.html,
// qui lisent window.__INITIAL__ en priorité et ne fetchent que s'il est
// absent). Même principe que seo-meta.js#injectProductMeta (lecture du
// fichier HTML une fois au démarrage, `.replace()` par requête) mais générique
// : pas de balises meta ici, juste un objet de données sérialisé.
//
// Le contenu de `data` vient de la base de données (jamais de saisie
// utilisateur), donc pas de risque d'injection ; JSON.stringify échappe déjà
// correctement les guillemets. Seule précaution : échapper "</script>" pour
// qu'une chaîne du catalogue ne puisse pas terminer la balise prématurément.
function injectInitialData(html, data) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  const tag = `<script>window.__INITIAL__ = ${json};</script>\n</head>`;
  return html.replace('</head>', tag);
}

module.exports = { injectInitialData };
