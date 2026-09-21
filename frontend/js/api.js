// Petite couche d'accès à l'API backend + application de la configuration
// (nom de la boutique, numéro WhatsApp, réseaux sociaux...) sur les éléments
// communs du header/footer/bouton flottant, une fois les partials chargés.

const Api = (() => {
  async function request(path, options = {}) {
    const res = await fetch(path, {
      credentials: 'same-origin',
      headers: options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
      ...options,
    });
    let data = null;
    try { data = await res.json(); } catch { /* réponse non-JSON (ex: export CSV) */ }
    if (!res.ok) {
      const message = (data && data.error) || `Erreur ${res.status}`;
      throw new Error(message);
    }
    return data;
  }

  let configCache = null;
  async function getConfig() {
    if (!configCache) configCache = await request('/api/config');
    return configCache;
  }

  function whatsappLink(number, message) {
    const clean = (number || '').replace(/[^\d]/g, '');
    return `https://wa.me/${clean}?text=${encodeURIComponent(message || '')}`;
  }

  // Numéros stockés en format international sans "+" (ex: 212612345678,
  // voir .env). phoneHref pour l'attribut href="tel:...", phoneDisplay pour
  // un affichage lisible façon marocaine (+212 6 12 34 56 78).
  function phoneHref(number) {
    const digits = (number || '').replace(/[^\d]/g, '');
    return digits ? `tel:+${digits}` : '';
  }
  function phoneDisplay(number) {
    const digits = (number || '').replace(/[^\d]/g, '');
    if (!digits) return '';
    const cc = digits.slice(0, 3);
    const rest = digits.slice(3);
    const grouped = rest ? `${rest.slice(0, 1)} ${rest.slice(1).match(/.{1,2}/g)?.join(' ') || ''}`.trim() : '';
    return `+${cc} ${grouped}`.trim();
  }

  return {
    get: (path) => request(path),
    post: (path, body) => request(path, { method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body) }),
    put: (path, body) => request(path, { method: 'PUT', body: body instanceof FormData ? body : JSON.stringify(body) }),
    del: (path) => request(path, { method: 'DELETE' }),
    getConfig,
    whatsappLink,
    phoneHref,
    phoneDisplay,
  };
})();

// Applique la config aux éléments communs injectés par include.js.
document.addEventListener('partials:ready', async () => {
  try {
    const config = await Api.getConfig();

    document.querySelectorAll('#header-store-name, #footer-store-name').forEach((el) => {
      el.textContent = config.storeName;
    });
    document.title = document.title.includes(' — ')
      ? document.title
      : `${document.title} — ${config.storeName}`;

    const year = document.getElementById('footer-year');
    if (year) year.textContent = new Date().getFullYear();
    const copy = document.getElementById('footer-copyright');
    if (copy) copy.innerHTML = `© <span id="footer-year">${new Date().getFullYear()}</span> ${config.storeName}. ${I18N.t('footer.rightsReserved', 'Tous droits réservés.')}`;

    // Le nom du pays (config.deliveryCountry, ex. "Maroc") reste en français
    // dans .env : plutôt que de le mélanger au texte arabe, on réutilise la
    // formulation déjà utilisée partout ailleurs sur le site ("توصيل لجميع
    // المدن"), correcte dans les deux langues sans dépendre de cette valeur.
    const deliveryCountry = document.getElementById('footer-delivery-country');
    if (deliveryCountry) deliveryCountry.textContent = I18N.t('common.deliveryAllCities', 'Livraison partout au ' + config.deliveryCountry);

    const phoneLink = document.getElementById('footer-phone-link');
    if (phoneLink && config.phoneNumber && !config.phoneNumber.startsWith('[')) {
      phoneLink.href = Api.phoneHref(config.phoneNumber);
      phoneLink.textContent = Api.phoneDisplay(config.phoneNumber);
      phoneLink.hidden = false;
    }
    const hoursEl = document.getElementById('footer-hours');
    if (hoursEl && config.storeHours) {
      hoursEl.textContent = config.storeHours;
      hoursEl.hidden = false;
    }

    const genericMsg = 'Bonjour, je souhaite avoir plus d\'informations sur vos produits.';
    const waLinks = [
      ['wa-float', genericMsg],
      ['footer-whatsapp-link', genericMsg],
    ];
    waLinks.forEach(([id, msg]) => {
      const el = document.getElementById(id);
      if (el) el.href = Api.whatsappLink(config.whatsappNumber, msg);
    });

    const socialMap = { 'social-instagram': config.socials.instagram, 'social-facebook': config.socials.facebook, 'social-tiktok': config.socials.tiktok };
    Object.entries(socialMap).forEach(([id, url]) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (!url || url.startsWith('[')) { el.style.display = 'none'; }
      else { el.href = url; }
    });

    document.dispatchEvent(new CustomEvent('config:ready', { detail: config }));
  } catch (err) {
    console.error('Impossible de charger la configuration de la boutique :', err);
  }
});
