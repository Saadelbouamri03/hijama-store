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
      <aside class="minicart" id="minicart" role="dialog" aria-modal="true" aria-label="Votre panier" aria-hidden="true">
        <div class="minicart-head">
          <h2>Votre panier</h2>
          <button type="button" class="minicart-close" id="minicart-close" aria-label="Fermer le panier">
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
          <p>Votre panier est vide.</p>
          <a href="/produits" class="btn btn-primary btn-sm">Voir les produits</a>
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
          <span class="minicart-item-name">${escapeHtml(i.name)}</span>
          ${i.variantLabel ? `<span class="minicart-item-variant">${escapeHtml(i.variantLabel)}</span>` : ''}
          <span class="minicart-item-price">${formatPrice(i.price, currency)}</span>
          <div class="qty-control qty-control-sm">
            <button type="button" class="minicart-dec" aria-label="Diminuer la quantité">−</button>
            <span>${i.quantity}</span>
            <button type="button" class="minicart-inc" aria-label="Augmenter la quantité">+</button>
          </div>
        </div>
        <button type="button" class="minicart-remove" aria-label="Retirer ${escapeHtml(i.name)} du panier">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>`;
    }).join('');

    const subtotal = Cart.getSubtotal();
    foot.innerHTML = `
      <div class="summary-row"><span>Sous-total</span><span>${formatPrice(subtotal, currency)}</span></div>
      <p class="hint">Livraison calculée à l'étape suivante selon votre ville.</p>
      <a href="/panier" class="btn btn-outline btn-block">Voir le panier</a>
      <a href="/checkout" class="btn btn-primary btn-block">Commander</a>`;
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
    updateFloatBadge();
  }

  // Bouton panier flottant : accès au panier toujours à portée de main (bas
  // d'écran), pour ne jamais avoir à remonter en haut de page le rejoindre
  // dans le header — utile juste après avoir ajouté un produit, où que l'on
  // soit sur la page.
  function updateFloatBadge() {
    const badge = document.getElementById('cart-float-count');
    if (!badge) return;
    const count = Cart.getCount();
    badge.textContent = count;
    badge.hidden = count === 0;
  }

  function buildFloat() {
    if (document.getElementById('cart-float')) return;
    const el = document.createElement('button');
    el.type = 'button';
    el.id = 'cart-float';
    el.className = 'cart-float';
    el.setAttribute('aria-label', 'Voir le panier');
    el.setAttribute('aria-haspopup', 'dialog');
    el.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M6 7h12l1 13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L6 7z"/>
        <path d="M9 7V5a3 3 0 0 1 6 0v2"/>
      </svg>
      <span class="cart-float-count" id="cart-float-count" hidden>0</span>`;
    el.addEventListener('click', open);
    document.body.appendChild(el);
    updateFloatBadge();
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
    buildFloat();
  });

  return { open, close, sync };
})();
