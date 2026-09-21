// Capture UTM/fbclid/ttclid/variante A-B dès l'arrivée sur le site (paramètres
// d'URL d'une pub), pour les renvoyer avec la commande même si le client
// visite plusieurs pages avant de commander. Persisté en sessionStorage
// (dure le temps de la visite) ; le premier lien cliqué "gagne" et n'est pas
// écrasé par une navigation interne sans paramètres.

const Attribution = (() => {
  const KEY = 'attribution_v1';

  function read() {
    try { return JSON.parse(sessionStorage.getItem(KEY) || '{}'); } catch { return {}; }
  }

  function capture() {
    const params = new URLSearchParams(window.location.search);
    const existing = read();
    const next = { ...existing };
    let changed = false;

    ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'ttclid'].forEach((key) => {
      const value = params.get(key);
      if (value && !existing[key]) { next[key] = value; changed = true; }
    });

    const variant = params.get('v');
    if (variant && !existing.ab_variant) { next.ab_variant = variant; changed = true; }

    if (!existing.landing_page) { next.landing_page = window.location.pathname; changed = true; }

    if (changed) {
      try { sessionStorage.setItem(KEY, JSON.stringify(next)); } catch { /* stockage indisponible, on continue sans */ }
    }
  }

  function toOrderFields() {
    const data = read();
    return {
      utmSource: data.utm_source || '',
      utmMedium: data.utm_medium || '',
      utmCampaign: data.utm_campaign || '',
      fbclid: data.fbclid || '',
      ttclid: data.ttclid || '',
      landingPage: data.landing_page || '',
      abVariant: data.ab_variant || '',
    };
  }

  capture();

  return { toOrderFields, getVariant: () => read().ab_variant || '' };
})();
