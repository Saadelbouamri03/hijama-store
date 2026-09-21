// "Composez votre kit" : parcours en une page (pas d'assistant forcé en
// étapes bloquantes) qui laisse choisir des ventouses puis des accessoires
// parmi les produits réels, avec quantités/variantes/stock respectés, et un
// ajout groupé au panier en une seule action.

const KitBuilder = (() => {
  let currency = 'DH';
  let config = null;
  // Clé "productId:variantId" -> { product, variant, quantity }
  const kitLines = new Map();

  function lineKey(productId, variantId) {
    return `${productId}:${variantId || ''}`;
  }

  function maxStockFor(product, variant) {
    return variant ? variant.stock : product.stock;
  }

  function priceFor(product, variant) {
    return variant ? variant.price : product.price;
  }

  function addLine(product, variant, quantity) {
    const key = lineKey(product.id, variant ? variant.id : null);
    const max = maxStockFor(product, variant);
    const existing = kitLines.get(key);
    const nextQty = Math.min((existing ? existing.quantity : 0) + quantity, max);
    if (nextQty <= 0) return;
    kitLines.set(key, { product, variant, quantity: nextQty });
    renderSummary();
    updateCardBadges();
  }

  function setLineQuantity(key, quantity) {
    const line = kitLines.get(key);
    if (!line) return;
    const max = maxStockFor(line.product, line.variant);
    if (quantity <= 0) { kitLines.delete(key); }
    else { line.quantity = Math.min(quantity, max); }
    renderSummary();
    updateCardBadges();
  }

  function currentQtyInKit(productId, variantId) {
    const line = kitLines.get(lineKey(productId, variantId));
    return line ? line.quantity : 0;
  }

  // ---------- Rendu des cartes de sélection (ventouses / accessoires) ----------

  function renderPickCard(product) {
    const variants = Array.isArray(product.variants) ? product.variants : [];
    const hasVariants = variants.length > 0;
    const priceLabel = hasVariants
      ? (() => {
          const prices = variants.map((v) => v.price);
          const min = Math.min(...prices), max = Math.max(...prices);
          return min === max ? formatPrice(min, currency) : `${formatPrice(min, currency)}–${formatPrice(max, currency)}`;
        })()
      : formatPrice(product.price, currency);
    const outOfStock = hasVariants ? variants.every((v) => v.stock <= 0) : product.stock <= 0;

    return `
      <div class="kit-pick-card" data-product-id="${product.id}" ${outOfStock ? 'data-out-of-stock="true"' : ''}>
        <img src="${productImageSrc(product)}" alt="" loading="lazy">
        <h4>${escapeHtml(product.name)}</h4>
        <span class="price">${priceLabel}</span>
        ${hasVariants ? `
          <select class="kit-variant-select" aria-label="${I18N.t('kit.chooseSizeOption', 'Choisir une taille/option')}">
            ${variants.map((v) => `<option value="${v.id}" ${v.stock <= 0 ? 'disabled' : ''}>${escapeHtml(v.label)}${v.stock <= 0 ? ' · ' + I18N.t('product.outOfStockShort', 'rupture') : ''}</option>`).join('')}
          </select>` : ''}
        <button type="button" class="btn btn-outline btn-sm kit-add-btn" ${outOfStock ? 'disabled' : ''}>
          ${outOfStock ? I18N.t('common.outOfStock', 'Épuisé') : I18N.t('kit.addToKit', 'Ajouter au kit')}
        </button>
      </div>`;
  }

  // Carte de sélection volontairement minimale : image, nom, prix, une
  // taille/option à choisir si besoin, un seul bouton. La quantité ne se
  // règle qu'une fois l'article dans le récapitulatif, pour ne pas multiplier
  // les champs visibles pendant le choix.
  function wirePickCard(cardEl, product) {
    const variants = Array.isArray(product.variants) ? product.variants : [];
    const select = cardEl.querySelector('.kit-variant-select');

    function currentVariant() {
      if (!select) return null;
      return variants.find((v) => v.id === Number(select.value)) || null;
    }

    function refreshHighlight() {
      const variant = currentVariant();
      const inKit = currentQtyInKit(product.id, variant ? variant.id : null);
      cardEl.classList.toggle('in-kit', inKit > 0);
    }
    cardEl._refreshBadge = refreshHighlight;

    if (select) select.addEventListener('change', refreshHighlight);

    const addBtn = cardEl.querySelector('.kit-add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        const variant = currentVariant();
        if (variants.length && !variant) return;
        addLine(product, variant, 1);
        showToast(`${I18N.t('common.added', 'Ajouté ✓')} — ${product.name}${variant ? ' (' + variant.label + ')' : ''}`);
      });
    }

    refreshHighlight();
  }

  function updateCardBadges() {
    document.querySelectorAll('.kit-pick-card').forEach((card) => {
      if (typeof card._refreshBadge === 'function') card._refreshBadge();
    });
  }

  async function loadProductsWithVariants(categorySlug) {
    const list = await Api.get(`/api/products?category=${encodeURIComponent(categorySlug)}`);
    return Promise.all(list.map((p) => Api.get(`/api/products/${encodeURIComponent(p.slug)}`).catch(() => null))).then((r) => r.filter(Boolean));
  }

  async function renderGrid(gridEl, categorySlug) {
    gridEl.innerHTML = `<p>${I18N.t('common.loadingProducts', 'Chargement des produits…')}</p>`;
    try {
      const products = await loadProductsWithVariants(categorySlug);
      if (!products.length) {
        gridEl.innerHTML = `<p>${I18N.t('kit.noProductsInCategory', 'Aucun produit disponible dans cette catégorie pour le moment.')}</p>`;
        return;
      }
      gridEl.innerHTML = products.map(renderPickCard).join('');
      gridEl.querySelectorAll('.kit-pick-card').forEach((cardEl, i) => wirePickCard(cardEl, products[i]));
    } catch (err) {
      console.error(err);
      gridEl.innerHTML = `<p>${I18N.t('kit.loadError', 'Impossible de charger ces produits pour le moment.')}</p>`;
    }
  }

  // ---------- Récapitulatif ----------

  function renderSummary() {
    const body = document.getElementById('kit-summary-body');
    const foot = document.getElementById('kit-summary-foot');
    const lines = Array.from(kitLines.entries());

    if (!lines.length) {
      body.innerHTML = `<p class="kit-summary-empty">${I18N.t('kit.noneSelected', 'Aucun article sélectionné pour le moment.')}</p>`;
      foot.innerHTML = '';
      return;
    }

    body.innerHTML = lines.map(([key, line]) => {
      const price = priceFor(line.product, line.variant);
      const img = productImageSrc(line.product);
      return `
        <div class="kit-summary-item" data-key="${key}">
          <img src="${img}" alt="">
          <div>
            <div class="kit-summary-item-name">${escapeHtml(line.product.name)}</div>
            ${line.variant ? `<div class="kit-summary-item-variant">${escapeHtml(line.variant.label)}</div>` : ''}
            <div class="qty-control qty-control-sm">
              <button type="button" class="kit-sum-dec" aria-label="${I18N.t('common.decreaseQty', 'Diminuer la quantité')}">−</button>
              <span>${line.quantity}</span>
              <button type="button" class="kit-sum-inc" aria-label="${I18N.t('common.increaseQty', 'Augmenter la quantité')}">+</button>
            </div>
          </div>
          <div style="text-align:end">
            <div style="font-weight:700; font-size: var(--fs-xs)">${formatPrice(price * line.quantity, currency)}</div>
            <button type="button" class="remove-link kit-sum-remove">${I18N.t('common.remove', 'Retirer')}</button>
          </div>
        </div>`;
    }).join('');

    const subtotal = lines.reduce((sum, [, line]) => sum + priceFor(line.product, line.variant) * line.quantity, 0);
    const itemCount = lines.reduce((sum, [, line]) => sum + line.quantity, 0);
    const deliveryFee = config ? config.defaultDeliveryFee : null;

    foot.innerHTML = `
      <div class="summary-row"><span>${I18N.t('cart.subtotal', 'Sous-total')}</span><span>${formatPrice(subtotal, currency)}</span></div>
      <div class="summary-row"><span>${I18N.t('checkout.delivery', 'Livraison')}</span><span>${deliveryFee != null ? I18N.t('kit.deliveryFrom', 'à partir de') + ' ' + formatPrice(deliveryFee, currency) : I18N.t('kit.deliveryTbd', 'à déterminer')}</span></div>
      <p class="hint">${I18N.t('kit.deliveryNote', 'La livraison exacte est calculée à l\'étape suivante selon votre ville.')}</p>
      <button type="button" class="btn btn-primary btn-block" id="kit-add-all-btn">${I18N.t('kit.addAllToCart', 'Ajouter le kit au panier')} (${itemCount})</button>`;

    document.getElementById('kit-add-all-btn').addEventListener('click', addAllToCart);
  }

  function onSummaryClick(e) {
    const row = e.target.closest('.kit-summary-item');
    if (!row) return;
    const key = row.dataset.key;
    const line = kitLines.get(key);
    if (!line) return;
    if (e.target.closest('.kit-sum-inc')) setLineQuantity(key, line.quantity + 1);
    else if (e.target.closest('.kit-sum-dec')) setLineQuantity(key, line.quantity - 1);
    else if (e.target.closest('.kit-sum-remove')) setLineQuantity(key, 0);
  }

  function addAllToCart() {
    const lines = Array.from(kitLines.values());
    if (!lines.length) return;
    lines.forEach((line) => Cart.add(line.product, line.quantity, line.variant));
    const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
    kitLines.clear();
    renderSummary();
    updateCardBadges();
    showToast(`${I18N.t('common.added', 'Ajouté ✓')} — ${I18N.t('kit.kitAddedToCart', 'votre kit')} (${itemCount} ${I18N.t('kit.items', 'articles')})`);
    if (typeof MiniCart !== 'undefined') MiniCart.open();
  }

  async function init(cfg) {
    config = cfg;
    currency = cfg.currency;
    document.getElementById('kit-summary-body').addEventListener('click', onSummaryClick);
    renderSummary();

    const cupsGrid = document.getElementById('kit-cups-grid');
    await renderGrid(cupsGrid, 'koub-hijama');

    const accessoryCategorySelect = document.getElementById('kit-accessory-category');
    const accessoriesGrid = document.getElementById('kit-accessories-grid');
    try {
      const categories = await Api.get('/api/categories');
      const accessoryCategories = categories.filter((c) => c.slug !== 'koub-hijama');
      accessoryCategorySelect.innerHTML = accessoryCategories.map((c) => `<option value="${escapeHtml(c.slug)}">${escapeHtml(c.name)}</option>`).join('');
      const defaultCategory = accessoryCategories.find((c) => c.slug === 'mostalzamat-adawat') || accessoryCategories[0];
      if (defaultCategory) {
        accessoryCategorySelect.value = defaultCategory.slug;
        await renderGrid(accessoriesGrid, defaultCategory.slug);
      }
      accessoryCategorySelect.addEventListener('change', () => renderGrid(accessoriesGrid, accessoryCategorySelect.value));
    } catch (err) {
      console.error(err);
      accessoriesGrid.innerHTML = `<p>${I18N.t('kit.accessoriesLoadError', 'Impossible de charger les accessoires pour le moment.')}</p>`;
    }
  }

  return { init };
})();

document.addEventListener('config:ready', (e) => KitBuilder.init(e.detail));
