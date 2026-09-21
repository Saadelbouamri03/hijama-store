// Page /produit/:slug — le slug est lu depuis le chemin de l'URL.

function getSlugFromPath() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  return parts[parts.length - 1];
}

// Vidéo produit : lecture uniquement au clic, rien n'est chargé avant (ni
// iframe YouTube/Vimeo, ni fichier vidéo). N'affiche rien si aucune vidéo
// n'est configurée pour ce produit.
function renderVideoSection(product) {
  const url = (product.video_url || '').trim();
  if (!url) return '';
  const poster = (product.images && product.images[0]) ? `/images/products/${product.images[0]}` : '/images/products/placeholder-hijama.svg';
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{6,})/);
  const vimeo = url.match(/vimeo\.com\/(\d+)/);

  if (yt) {
    return `
      <div class="product-video" data-embed="https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=1&rel=0" data-facade="true">
        <img src="https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg" alt="${I18N.t('product.videoPreview', 'Aperçu de la vidéo produit')}" loading="lazy">
        <button type="button" class="video-play-btn" aria-label="${I18N.t('product.playVideo', 'Lire la vidéo')}">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </button>
      </div>`;
  }
  if (vimeo) {
    return `
      <div class="product-video" data-embed="https://player.vimeo.com/video/${vimeo[1]}?autoplay=1" data-facade="true">
        <img src="${poster}" alt="${I18N.t('product.videoPreview', 'Aperçu de la vidéo produit')}" loading="lazy">
        <button type="button" class="video-play-btn" aria-label="${I18N.t('product.playVideo', 'Lire la vidéo')}">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </button>
      </div>`;
  }
  // Fichier vidéo direct (.mp4...) : preload="none" suffit à ne rien charger
  // avant le clic sur lecture, avec les contrôles natifs du navigateur.
  return `
    <div class="product-video-native">
      <video controls preload="none" poster="${poster}"><source src="${escapeHtml(url)}"></video>
    </div>`;
}

function wireVideoFacades(root) {
  root.querySelectorAll('.product-video[data-facade="true"]').forEach((box) => {
    box.querySelector('.video-play-btn').addEventListener('click', () => {
      const iframe = document.createElement('iframe');
      iframe.src = box.dataset.embed;
      iframe.title = I18N.t('product.videoTitle', 'Vidéo produit');
      iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
      iframe.allowFullscreen = true;
      iframe.loading = 'lazy';
      box.innerHTML = '';
      box.appendChild(iframe);
    });
  });
}

// Fiche technique : faits réels dérivés du catalogue (même logique que le
// comparateur/guide des tailles), jamais de champ inventé (usage, entretien...)
// pour lequel aucune donnée réelle n'existe. Une ligne n'apparaît que si une
// vraie valeur a été trouvée — pas de "Non renseigné" ici (contrairement au
// comparateur, où l'alignement entre produits le justifie).
function renderSpecSheet(product, variants) {
  const rows = [];
  const ref = extractRef(product.description);
  if (ref) rows.push([I18N.t('compare.reference', 'Référence'), ref]);

  const material = materialOrBrandLabel(product.name);
  if (material) rows.push([I18N.t('compare.materialBrand', 'Matière / marque'), material]);

  rows.push([I18N.t('compare.conditioning', 'Conditionnement'), conditioningLabel(product)]);

  const sizeVariants = variants.filter((v) => isSizeVariantLabel(v.label));
  const sizesText = sizeVariants.length
    ? sizeVariants.map((v) => v.label).join(', ')
    : extractSizesParenthetical(product.description);
  if (sizesText) rows.push([I18N.t('compare.availableSizes', 'Tailles disponibles'), sizesText]);

  if (!rows.length) return '';
  return `
    <div class="spec-sheet">
      ${rows.map(([label, value]) => `<div class="spec-row"><span class="spec-label">${escapeHtml(label)}</span><span class="spec-value"${bidiAttr(value)}>${escapeHtml(value)}</span></div>`).join('')}
    </div>`;
}

function stockLine(stock) {
  if (stock <= 0) return `<p class="stock-line stock-out">${I18N.t('product.outOfStock', 'Rupture de stock')}</p>`;
  if (stock <= 5) return `<p class="stock-line stock-low">${I18N.t('product.lowStock', 'Plus que')} ${stock} ${I18N.t('product.inStockSuffix', 'en stock')}</p>`;
  return `<p class="stock-line stock-ok">${I18N.t('product.inStock', 'En stock')}</p>`;
}

document.addEventListener('config:ready', async (e) => {
  const config = e.detail;
  const slug = getSlugFromPath();
  const content = document.getElementById('product-content');

  let product;
  try {
    product = await Api.get(`/api/products/${encodeURIComponent(slug)}`);
  } catch (err) {
    content.innerHTML = `
      <div class="empty-state">
        <h2>${I18N.t('product.notFound', 'Produit introuvable')}</h2>
        <p>${I18N.t('product.notFoundText', "Ce produit n'existe pas ou n'est plus disponible.")}</p>
        <a href="/produits" class="btn btn-primary">${I18N.t('product.seeAllProducts', 'Voir tous les produits')}</a>
      </div>`;
    return;
  }

  document.title = `${product.name} — ${config.storeName}`;
  document.getElementById('page-title').textContent = `${product.name}`;
  document.getElementById('page-description').setAttribute('content', (product.description || '').slice(0, 155));

  if (typeof fbq === 'function') {
    fbq('track', 'ViewContent', {
      value: product.price,
      currency: 'MAD',
      content_ids: [product.id],
      content_type: 'product',
      content_name: product.name,
    });
  }
  if (typeof ttq !== 'undefined' && ttq && typeof ttq.track === 'function') {
    ttq.track('ViewContent', {
      content_id: String(product.id),
      content_type: 'product',
      content_name: product.name,
      value: product.price,
      currency: 'MAD',
    });
  }

  const breadcrumb = document.getElementById('breadcrumb');
  breadcrumb.innerHTML = `<a href="/">${I18N.t('nav.home', 'Accueil')}</a> / <a href="/produits">${I18N.t('nav.products', 'Produits')}</a>` +
    (product.category_slug ? ` / <a href="/produits?categorie=${product.category_slug}"${bidiAttr(product.category_name)}>${escapeHtml(product.category_name)}</a>` : '') +
    ` / <span${bidiAttr(product.name)}>${escapeHtml(product.name)}</span>`;

  const images = product.images && product.images.length ? product.images : ['placeholder-hijama.svg'];
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const hasVariants = variants.length > 0;

  // Sans variantes : le stock/prix vient directement du produit. Avec
  // variantes, on démarre sur la première en stock (sinon la première tout
  // court, pour montrer "rupture" plutôt que de cacher l'option).
  let selectedVariant = hasVariants ? (variants.find((v) => v.stock > 0) || variants[0]) : null;

  function currentPrice() {
    return selectedVariant ? selectedVariant.price : product.price;
  }
  function currentStock() {
    return selectedVariant ? selectedVariant.stock : product.stock;
  }
  function isOutOfStock() {
    return currentStock() <= 0;
  }

  content.innerHTML = `
    <div class="product-detail" data-category-slug="${escapeHtml(product.category_slug || '')}">
      <div>
        <button type="button" class="gallery-main" id="gallery-zoom-trigger" aria-label="${I18N.t('product.zoomImage', "Agrandir l'image")}"><img id="gallery-main-img" src="/images/products/${images[0]}" alt="${escapeHtml(product.name)}"></button>
        ${images.length > 1 ? `<div class="gallery-thumbs">${images.map((img, i) =>
          `<button data-src="/images/products/${img}" class="${i === 0 ? 'active' : ''}"><img src="/images/products/${img}" alt=""></button>`
        ).join('')}</div>` : ''}
      </div>
      <div>
        ${product.category_name ? `<span class="product-cat"${bidiAttr(product.category_name)}>${escapeHtml(product.category_name)}</span>` : ''}
        <h1${bidiAttr(product.name)}>${escapeHtml(product.name)}</h1>
        <div class="price-row" style="margin-bottom: var(--space-3)">
          <span class="price" id="product-price">${formatPrice(currentPrice(), config.currency)}</span>
          ${!hasVariants && product.old_price ? `<span class="price-old">${formatPrice(product.old_price, config.currency)}</span>` : ''}
        </div>

        ${hasVariants ? `
        <div class="field" style="margin-bottom: var(--space-3)">
          <label id="variant-label">${I18N.t('product.chooseOption', 'Choisissez une option')}</label>
          <div class="variant-pills" role="radiogroup" aria-labelledby="variant-label">
            ${variants.map((v) => `<button type="button" class="variant-pill ${selectedVariant && v.id === selectedVariant.id ? 'selected' : ''}" role="radio" aria-checked="${selectedVariant && v.id === selectedVariant.id ? 'true' : 'false'}" data-variant-id="${v.id}" ${v.stock <= 0 ? 'disabled' : ''}>
              ${escapeHtml(v.label)}${v.stock <= 0 ? ' · ' + I18N.t('product.outOfStockShort', 'rupture') : ''}
            </button>`).join('')}
          </div>
        </div>` : ''}

        ${product.category_slug === 'koub-hijama' ? `<p><a href="/guide-tailles-ventouses" class="btn-text">📏 ${I18N.t('product.sizeGuideLink', 'Voir le guide des tailles de ventouses')}</a></p>` : ''}
        ${(product.slug === 'produit-hs-114' || product.slug === 'produit-hs-115') ? `<p><a href="/comparer?a=produit-hs-114&b=produit-hs-115" class="btn-text">⇄ ${I18N.t('product.compareSafaaAssala', 'Comparer les coffrets Safaa et Al Assala')}</a></p>` : ''}

        <div id="stock-line">${stockLine(currentStock())}</div>
        <p${bidiAttr(product.description)}>${escapeHtml(product.description || '')}</p>
        ${renderSpecSheet(product, variants)}

        <div class="qty-selector">
          <span style="font-weight:700; font-size: var(--fs-sm)">${I18N.t('product.quantity', 'Quantité')}</span>
          <div class="qty-control">
            <button type="button" id="qty-minus" aria-label="${I18N.t('common.decreaseQty', 'Diminuer la quantité')}">−</button>
            <span id="qty-value">1</span>
            <button type="button" id="qty-plus" aria-label="${I18N.t('common.increaseQty', 'Augmenter la quantité')}">+</button>
          </div>
        </div>

        <div class="btn-group">
          <button class="btn btn-primary btn-block" id="add-to-cart-btn" ${isOutOfStock() ? 'disabled' : ''}>
            ${isOutOfStock() ? I18N.t('product.unavailable', 'Indisponible') : I18N.t('common.addToCart', 'Ajouter au panier')}
          </button>
          <a href="#" id="product-whatsapp" class="btn btn-whatsapp btn-block" target="_blank" rel="noopener">${I18N.t('common.orderWhatsapp', 'Commander sur WhatsApp')}</a>
        </div>
        <p class="product-question"><a href="#" id="product-whatsapp-question" target="_blank" rel="noopener">${I18N.t('product.questionLink', 'Une question sur ce produit ?')}</a></p>

        ${!isOutOfStock() ? `
        <div class="divider-motif" aria-hidden="true" style="margin: var(--space-5) 0">
          <svg width="120" height="16" viewBox="0 0 120 16"><path d="M0 8 H45 M75 8 H120" stroke="currentColor" stroke-width="1.5"/><circle cx="60" cy="8" r="4" fill="#B58A45"/></svg>
        </div>
        <div id="order-form-mount"></div>` : ''}

        ${renderVideoSection(product)}

        <div class="product-faq">
          <h2>${I18N.t('product.faqTitle', 'Questions fréquentes')}</h2>
          ${renderFaqItem(I18N.t('product.faqDeliveryQ', 'Quel est le délai de livraison ?'), I18N.t('product.faqDeliveryA', '24 à 48 heures après confirmation de la commande.'))}
          ${renderFaqItem(I18N.t('product.faqPaymentQ', 'Dois-je payer maintenant ?'), I18N.t('product.faqPaymentA', "Non. Vous payez uniquement à la réception, en espèces."))}
          ${renderFaqItem(I18N.t('product.faqReturnQ', 'Puis-je retourner ce produit ?'), I18N.t('product.faqReturnA', "S'il est défectueux, endommagé ou différent de votre commande, contactez-nous sur WhatsApp dans les 48h suivant la réception avec une photo."))}
        </div>

        <div class="product-reviews" id="product-reviews-section" hidden>
          <h2>${I18N.t('product.reviewsTitle', 'Avis sur ce produit')}</h2>
          <div class="grid grid-reviews" id="product-reviews-grid"></div>
        </div>
      </div>
    </div>
    <div class="gallery-lightbox" id="gallery-lightbox">
      <button type="button" class="gallery-lightbox-close" id="gallery-lightbox-close" aria-label="${I18N.t('common.close', 'Fermer')}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="4" x2="20" y2="20"/><line x1="20" y1="4" x2="4" y2="20"/></svg>
      </button>
      <img id="gallery-lightbox-img" src="" alt="${escapeHtml(product.name)}">
    </div>`;

  // Vidéo produit : n'attache l'iframe qu'au clic (voir renderVideoSection)
  wireVideoFacades(content);

  // Galerie : changement de vignette
  content.querySelectorAll('.gallery-thumbs button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById('gallery-main-img').src = btn.dataset.src;
      content.querySelectorAll('.gallery-thumbs button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Zoom : ouverture au clic uniquement (jamais automatique), image courante
  // de la galerie affichée en plein écran.
  const lightbox = document.getElementById('gallery-lightbox');
  const lightboxImg = document.getElementById('gallery-lightbox-img');
  function openLightbox() {
    lightboxImg.src = document.getElementById('gallery-main-img').src;
    lightbox.classList.add('open');
  }
  function closeLightbox() {
    lightbox.classList.remove('open');
  }
  document.getElementById('gallery-zoom-trigger').addEventListener('click', openLightbox);
  document.getElementById('gallery-lightbox-close').addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });

  // Sélecteur de quantité
  let qty = 1;
  let orderFormInstance = null;
  const qtyValueEl = document.getElementById('qty-value');
  document.getElementById('qty-minus').addEventListener('click', () => {
    qty = Math.max(1, qty - 1);
    qtyValueEl.textContent = qty;
    if (orderFormInstance) orderFormInstance.refresh();
  });
  document.getElementById('qty-plus').addEventListener('click', () => {
    qty = Math.min(currentStock() || 1, qty + 1);
    qtyValueEl.textContent = qty;
    if (orderFormInstance) orderFormInstance.refresh();
  });

  const addBtn = document.getElementById('add-to-cart-btn');
  const priceEl = document.getElementById('product-price');
  const stockLineEl = document.getElementById('stock-line');
  const waBtn = document.getElementById('product-whatsapp');
  const waQuestionBtn = document.getElementById('product-whatsapp-question');
  const productUrl = window.location.href;

  function refreshForVariant() {
    priceEl.textContent = formatPrice(currentPrice(), config.currency);
    stockLineEl.innerHTML = stockLine(currentStock());
    qty = 1;
    qtyValueEl.textContent = qty;
    if (isOutOfStock()) {
      addBtn.disabled = true;
      addBtn.textContent = I18N.t('product.unavailable', 'Indisponible');
    } else {
      addBtn.disabled = false;
      addBtn.textContent = I18N.t('common.addToCart', 'Ajouter au panier');
    }
    const label = selectedVariant ? ` (${selectedVariant.label})` : '';
    const waMessage = `${I18N.t('product.waInterested', 'Bonjour, je suis intéressé par le produit')} ${product.name}${label} ${I18N.t('product.waPriceOf', 'au prix de')} ${currentPrice()} ${config.currency}.`;
    waBtn.href = Api.whatsappLink(config.whatsappNumber, waMessage);

    if (waQuestionBtn) {
      const waQuestionMessage = `${I18N.t('product.waQuestion', "Bonjour, j'ai une question sur le produit")} ${product.name}${label}.\n${productUrl}`;
      waQuestionBtn.href = Api.whatsappLink(config.whatsappNumber, waQuestionMessage);
    }

    if (orderFormInstance) orderFormInstance.refresh();

    if (mobileBar) {
      mobileBar.querySelector('.mobile-add-bar-price').textContent = formatPrice(currentPrice(), config.currency);
      const mobileAddBtn = mobileBar.querySelector('.mobile-add-bar-btn');
      mobileAddBtn.disabled = isOutOfStock();
      mobileAddBtn.textContent = isOutOfStock() ? I18N.t('product.unavailable', 'Indisponible') : I18N.t('common.addToCart', 'Ajouter au panier');
    }
  }

  // Changement de variante (taille, marque...) : pastilles sélectionnables.
  content.querySelectorAll('.variant-pill').forEach((pill) => {
    if (pill.disabled) return;
    pill.addEventListener('click', () => {
      selectedVariant = variants.find((v) => v.id === Number(pill.dataset.variantId)) || null;
      content.querySelectorAll('.variant-pill').forEach((p) => {
        const isSelected = p === pill;
        p.classList.toggle('selected', isSelected);
        p.setAttribute('aria-checked', isSelected ? 'true' : 'false');
      });
      refreshForVariant();
    });
  });

  function addToCart() {
    Cart.add(product, qty, selectedVariant);
    const label = selectedVariant ? ` (${selectedVariant.label})` : '';
    showToast(`${I18N.t('common.added', 'Ajouté ✓')} — ${product.name}${label}`);
  }

  // Ajouter au panier
  if (addBtn) addBtn.addEventListener('click', addToCart);

  // Barre mobile collante : discrète, apparaît une fois le bouton principal
  // (dans le contenu) sorti de l'écran. Mène directement au formulaire de
  // commande rapide (voir OrderForm) plutôt que d'ajouter au panier en
  // silence, pour rester cohérent avec le chemin d'achat principal du produit.
  let mobileBar = null;
  const orderFormMountEl = document.getElementById('order-form-mount');
  if (window.matchMedia('(max-width: 719px)').matches && 'IntersectionObserver' in window) {
    mobileBar = document.createElement('div');
    mobileBar.className = 'mobile-add-bar';
    mobileBar.innerHTML = `
      <span class="price mobile-add-bar-price"></span>
      <button type="button" class="btn btn-primary mobile-add-bar-btn">${orderFormMountEl ? I18N.t('product.order', 'Commander') : I18N.t('common.addToCart', 'Ajouter au panier')}</button>`;
    document.body.appendChild(mobileBar);
    mobileBar.querySelector('.mobile-add-bar-btn').addEventListener('click', () => {
      if (isOutOfStock()) return;
      if (orderFormMountEl) {
        orderFormMountEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        orderFormMountEl.querySelector('input')?.focus({ preventScroll: true });
      } else {
        addToCart();
      }
    });
    const observer = new IntersectionObserver(([entry]) => {
      const visible = !entry.isIntersecting;
      mobileBar.classList.toggle('visible', visible);
      // Le bouton WhatsApp flottant remonte tant que la barre occupe le bas
      // de l'écran, pour ne jamais se superposer à "Commander"/"Ajouter au panier".
      document.body.classList.toggle('has-mobile-add-bar', visible);
    }, { threshold: 0 });
    observer.observe(addBtn);
  }

  if (orderFormMountEl) {
    OrderForm.mount(orderFormMountEl, {
      lang: I18N.getLocale(),
      getLineItems: () => [{
        productId: product.id,
        variantId: selectedVariant ? selectedVariant.id : null,
        quantity: qty,
        name: product.name,
        categorySlug: product.category_slug || '',
      }],
      getSubtotal: () => currentPrice() * qty,
    }).then((instance) => { orderFormInstance = instance; });
  }

  refreshForVariant();

  // Produits similaires
  if (product.related && product.related.length) {
    document.getElementById('related-section').hidden = false;
    document.getElementById('related-grid').innerHTML = product.related.map((p) => renderProductCard(p, config.currency)).join('');
  }

  // Avis sur ce produit précis (masqués tant qu'aucun vrai avis n'existe,
  // même logique que la section avis de l'accueil).
  try {
    const reviews = await Api.get(`/api/reviews?productId=${product.id}`);
    if (reviews.length) {
      document.getElementById('product-reviews-grid').innerHTML = reviews.map(renderReviewCard).join('');
      document.getElementById('product-reviews-section').hidden = false;
    }
  } catch (err) { console.error(err); }
});
