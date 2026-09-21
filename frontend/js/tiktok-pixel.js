// Charge le pixel TikTok (code officiel TikTok) une fois l'ID récupéré via
// /api/config, plutôt que codé en dur dans chaque page : tant que
// TIKTOK_PIXEL_ID n'est pas renseigné dans .env, ce fichier ne fait rien
// (aucun script TikTok chargé, aucun appel réseau). Dès qu'il l'est, toutes
// les pages l'activent automatiquement sans autre changement de code.
document.addEventListener('config:ready', (e) => {
  const pixelId = e.detail.tiktokPixelId;
  if (!pixelId) return;

  !function (w, d, t) {
    w.TiktokAnalyticsObject = t;
    var ttq = w[t] = w[t] || [];
    ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie', 'holdConsent', 'revokeConsent', 'grantConsent'];
    ttq.setAndDefer = function (t, e) { t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))); }; };
    for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
    ttq.instance = function (t) {
      var e = ttq._i[t] || [];
      for (var n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(e, ttq.methods[n]);
      return e;
    };
    ttq.load = function (e, n) {
      var r = 'https://analytics.tiktok.com/i18n/pixel/events.js', o = n && n.partner;
      ttq._i = ttq._i || {}; ttq._i[e] = []; ttq._i[e]._u = r;
      ttq._t = ttq._t || {}; ttq._t[e] = +new Date();
      ttq._o = ttq._o || {}; ttq._o[e] = n || {};
      var s = d.createElement('script');
      s.type = 'text/javascript'; s.async = true; s.src = r + '?sdkid=' + e + '&lib=' + t;
      var a = d.getElementsByTagName('script')[0];
      a.parentNode.insertBefore(s, a);
    };
    ttq.load(pixelId);
    ttq.page();
  }(window, document, 'ttq');
});
