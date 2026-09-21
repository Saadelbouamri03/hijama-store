// Panneau panier ("mini-cart") : un tiroir accessible depuis l'icône panier
// du header, sur toutes les pages. Sert de panneau latéral sur ordinateur et
// d'affichage plein écran adapté sur mobile (même composant, largeur fluide).
// Le lien /panier reste fonctionnel (dégradation propre si JS désactivé).

const MiniCart = (() => {
  let currency = 'DH';
  let lastFocused = null;
  let built = false;

  function build() {
    if (built) return;
    built = true;

    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="minicart-backdrop" id="minicart-backdrop"></div>
      <aside class="minicart" id="minicart" role="dialog" aria-modal="true" aria-label="${I18N.t('cart.title', 'Votre panier')}" aria-hidden="true">
        <div class="minicart-head">
          <h2>${I18N.t('cart.title', 'Votre panier')}</h2>
          <button type="button" class="minicart-close" id="minicart-close" aria-label="${I18N.t('minicart.close', 'Fermer le panier')}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="4" x2="20" y2="20"/><line x1="20" y1="4" x2="4" y2="20"/></svg>
          </button>
        </div>
        <div class="minicart-body" id="minicart-body"></div>
        <div class="minicart-foot" id="minicart-foot"></div>
      </aside>`;
    document.body.append(...wrap.childNodes);

    document.getElementById('minicart-close').addEventListener('click', close);
    document.getElementById('minicart-backdrop').addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.getElementById('minicart').classList.contains('open')) close();
    });

    document.getElementById('minicart-body').addEventListener('click', onBodyClick);
  }

  function onBodyClick(e) {
    const row = e.target.closest('.minicart-item');
    if (!row) return;
    const productId = Number(row.dataset.productId);
    const variantId = row.dataset.variantId ? Number(row.dataset.variantId) : null;
    const item = Cart.getItems().find((i) => i.productId === productId && (i.variantId || null) === variantId);

    if (e.target.closest('.minicart-inc')) {
      Cart.updateQuantity(productId, (item?.quantity || 1) + 1, variantId);
    } else if (e.target.closest('.minicart-dec')) {
      const newQty = (item?.quantity || 1) - 1;
      if (newQty < 1) Cart.remove(productId, variantId); else Cart.updateQuantity(productId, newQty, variantId);
    } else if (e.target.closest('.minicart-remove')) {
      Cart.remove(productId, variantId);
      showToast('Produit retiré du panier');
    }
  }

  function render() {
    const body = document.getElementById('minicart-body');
    const foot = document.getElementById('minicart-foot');
    if (!body || !foot) return;
    const items = Cart.getItems();

    if (!items.length) {
      body.innerHTML = `
        <div class="minicart-empty">
          <p>${I18N.t('cart.empty', 'Votre panier est vide.')}</p>
          <a href="/produits" class="btn btn-primary btn-sm">${I18N.t('common.seeProducts', 'Voir les produits')}</a>
        </div>`;
      foot.innerHTML = '';
      return;
    }

    body.innerHTML = items.map((i) => {
      const img = i.image ? `/images/products/${i.image}` : '/images/products/placeholder-hijama.svg';
      return `
      <div class="minicart-item" data-product-id="${i.productId}" data-variant-id="${i.variantId || ''}">
        <img src="${img}" alt="${escapeHtml(i.name)}">
        <div class="minicart-item-info">
          <span class="minicart-item-name"${bidiAttr(i.name)}>${escapeHtml(i.name)}</span>
          ${i.variantLabel ? `<span class="minicart-item-variant">${escapeHtml(i.variantLabel)}</span>` : ''}
          <span class="minicart-item-price">${formatPrice(i.price, currency)}</span>
          <div class="qty-control qty-control-sm">
            <button type="button" class="minicart-dec" aria-label="${I18N.t('common.decreaseQty', 'Diminuer la quantité')}">−</button>
            <span>${i.quantity}</span>
            <button type="button" class="minicart-inc" aria-label="${I18N.t('common.increaseQty', 'Augmenter la quantité')}">+</button>
          </div>
        </div>
        <button type="button" class="minicart-remove" aria-label="${I18N.t('minicart.removeItem', 'Retirer')} ${escapeHtml(i.name)} ${I18N.t('minicart.fromCart', 'du panier')}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>`;
    }).join('');

    const subtotal = Cart.getSubtotal();
    foot.innerHTML = `
      <div class="summary-row"><span>${I18N.t('cart.subtotal', 'Sous-total')}</span><span>${formatPrice(subtotal, currency)}</span></div>
      <p class="hint">${I18N.t('minicart.deliveryNote', 'Livraison calculée à l\'étape suivante selon votre ville.')}</p>
      <a href="/panier" class="btn btn-outline btn-block">${I18N.t('minicart.viewCart', 'Voir le panier')}</a>
      <a href="/checkout" class="btn btn-primary btn-block">${I18N.t('product.order', 'Commander')}</a>`;
  }

  function open() {
    build();
    render();
    lastFocused = document.activeElement;
    document.getElementById('minicart-backdrop').classList.add('open');
    document.getElementById('minicart').classList.add('open');
    document.getElementById('minicart').setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('no-scroll');
    document.getElementById('minicart-close').focus();
  }

  function close() {
    const panel = document.getElementById('minicart');
    if (!panel) return;
    panel.classList.remove('open');
    document.getElementById('minicart-backdrop').classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('no-scroll');
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  function sync() {
    if (built && document.getElementById('minicart')?.classList.contains('open')) render();
  }

  document.addEventListener('config:ready', (e) => { currency = e.detail.currency; });

  document.addEventListener('partials:ready', () => {
    const trigger = document.querySelector('.cart-link');
    if (trigger) {
      trigger.setAttribute('aria-haspopup', 'dialog');
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        open();
      });
    }
  });

  return { open, close, sync };
})();
