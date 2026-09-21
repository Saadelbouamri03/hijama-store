document.addEventListener('config:ready', (e) => {
  const config = e.detail;

  const link = document.getElementById('contact-whatsapp-link');
  if (link) link.href = Api.whatsappLink(config.whatsappNumber, I18N.t('contact.waDefaultMessage', "Bonjour, j'aurais une question à propos de vos produits."));

  const phoneWrap = document.getElementById('contact-phone');
  const phoneLink = document.getElementById('contact-phone-link');
  if (phoneWrap && phoneLink && config.phoneNumber && !config.phoneNumber.startsWith('[')) {
    phoneLink.href = Api.phoneHref(config.phoneNumber);
    phoneLink.textContent = `${I18N.t('contact.call', 'Appeler le')} ${Api.phoneDisplay(config.phoneNumber)}`;
    phoneWrap.hidden = false;
  }
  const hoursEl = document.getElementById('contact-hours');
  if (hoursEl && config.storeHours) {
    hoursEl.textContent = config.storeHours;
    hoursEl.hidden = false;
  }

  const deliveryEl = document.getElementById('contact-delivery');
  if (deliveryEl) deliveryEl.textContent = `${I18N.t('common.deliveryAllCities', 'Livraison partout au ' + config.deliveryCountry)} — ${I18N.t('common.cod', 'paiement à la livraison')}.`;

  const socialsEl = document.getElementById('contact-socials');
  const icons = {
    instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 8h2V4h-2a5 5 0 0 0-5 5v3H8v4h2v7h4v-7h3l1-4h-4V9a1 1 0 0 1 1-1z"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 4v10.5a3.5 3.5 0 1 1-3-3.46"/><path d="M14 4c0 2.5 2 4.5 4.5 4.5"/></svg>',
  };
  if (socialsEl) {
    socialsEl.innerHTML = Object.entries(config.socials).map(([key, url]) => {
      if (!url || url.startsWith('[')) return '';
      return `<a href="${url}" target="_blank" rel="noopener" aria-label="${key}">${icons[key] || ''}</a>`;
    }).join('');
  }

  document.getElementById('contact-form').addEventListener('submit', (evt) => {
    evt.preventDefault();
    const name = document.getElementById('contactName').value.trim();
    const message = document.getElementById('contactMessage').value.trim();
    if (!name || !message) return;
    const fullMessage = `${I18N.t('contact.waIntro', "Bonjour, je m'appelle")} ${name}. ${message}`;
    window.open(Api.whatsappLink(config.whatsappNumber, fullMessage), '_blank', 'noopener');
  });
});
