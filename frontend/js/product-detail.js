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
        <img src="https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg" alt="Aperçu de la vidéo produit" loading="lazy">
        <button type="button" class="video-play-btn" aria-label="Lire la vidéo">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </button>
      </div>`;
  }
  if (vimeo) {
    return `
      <div class="product-video" data-embed="https://player.vimeo.com/video/${vimeo[1]}?autoplay=1" data-facade="true">
        <img src="${poster}" alt="Aperçu de la vidéo produit" loading="lazy">
        <button type="button" class="video-play-btn" aria-label="Lire la vidéo">
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
      iframe.title = 'Vidéo produit';
      iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
      iframe.allowFullscreen = true;
      iframe.loading = 'lazy';
      box.innerHTML = '';
      box.appendChild(iframe);
    });
  });
}

function stockLine(stock) {
  if (stock <= 0) return '<p class="stock-line stock-out">Rupture de stock</p>';
  if (stock <= 5) return `<p class="stock-line stock-low">Plus que ${stock} en stock</p>`;
  return '<p class="stock-line stock-ok">En stock</p>';
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
        <h2>Produit introuvable</h2>
        <p>Ce produit n'existe pas ou n'est plus disponible.</p>
        <a href="/produits" class="btn btn-primary">Voir tous les produits</a>
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

  const breadcrumb = document.getElementById('breadcrumb');
  breadcrumb.innerHTML = `<a href="/">Accueil</a> / <a href="/produits">Produits</a>` +
    (product.category_slug ? ` / <a href="/produits?categorie=${product.category_slug}">${escapeHtml(product.category_name)}</a>` : '') +
    ` / ${escapeHtml(product.name)}`;

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
        <div class="gallery-main"><img id="gallery-main-img" src="/images/products/${images[0]}" alt="${escapeHtml(product.name)}"></div>
        ${images.length > 1 ? `<div class="gallery-thumbs">${images.map((img, i) =>
          `<button data-src="/images/products/${img}" class="${i === 0 ? 'active' : ''}"><img src="/images/products/${img}" alt=""></button>`
        ).join('')}</div>` : ''}
      </div>
      <div>
        ${product.category_name ? `<span class="product-cat">${escapeHtml(product.category_name)}</span>` : ''}
        <h1>${escapeHtml(product.name)}</h1>
        <div class="price-row" style="margin-bottom: var(--space-3)">
          <span class="price" id="product-price">${formatPrice(currentPrice(), config.currency)}</span>
          ${!hasVariants && product.old_price ? `<span class="price-old">${formatPrice(product.old_price, config.currency)}</span>` : ''}
        </div>

        ${hasVariants ? `
        <div class="field" style="margin-bottom: var(--space-3)">
          <label id="variant-label">Choisissez une option</label>
          <div class="variant-pills" role="radiogroup" aria-labelledby="variant-label">
            ${variants.map((v) => `<button type="button" class="variant-pill ${selectedVariant && v.id === selectedVariant.id ? 'selected' : ''}" role="radio" aria-checked="${selectedVariant && v.id === selectedVariant.id ? 'true' : 'false'}" data-variant-id="${v.id}" ${v.stock <= 0 ? 'disabled' : ''}>
              ${escapeHtml(v.label)}${v.stock <= 0 ? ' · rupture' : ''}
            </button>`).join('')}
          </div>
        </div>` : ''}

        ${product.category_slug === 'koub-hijama' ? `<p><a href="/guide-tailles-ventouses" class="btn-text">📏 Voir le guide des tailles de ventouses</a></p>` : ''}
        ${(product.slug === 'produit-hs-114' || product.slug === 'produit-hs-115') ? `<p><a href="/comparer?a=produit-hs-114&b=produit-hs-115" class="btn-text">⇄ Comparer les coffrets Safaa et Al Assala</a></p>` : ''}

        <div id="stock-line">${stockLine(currentStock())}</div>
        <p>${escapeHtml(product.description || '')}</p>

        <div class="qty-selector">
          <span style="font-weight:700; font-size: var(--fs-sm)">Quantité</span>
          <div class="qty-control">
            <button type="button" id="qty-minus" aria-label="Diminuer la quantité">−</button>
            <span id="qty-value">1</span>
            <button type="button" id="qty-plus" aria-label="Augmenter la quantité">+</button>
          </div>
        </div>

        <div class="btn-group">
          <button class="btn btn-primary btn-block" id="add-to-cart-btn" ${isOutOfStock() ? 'disabled' : ''}>
            ${isOutOfStock() ? 'Indisponible' : 'Ajouter au panier'}
          </button>
          <a href="#" id="product-whatsapp" class="btn btn-whatsapp btn-block" target="_blank" rel="noopener">Commander sur WhatsApp</a>
        </div>
        <p class="product-question"><a href="#" id="product-whatsapp-question" target="_blank" rel="noopener">Une question sur ce produit ?</a></p>

        ${renderVideoSection(product)}
      </div>
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

  // Sélecteur de quantité
  let qty = 1;
  const qtyValueEl = document.getElementById('qty-value');
  document.getElementById('qty-minus').addEventListener('click', () => {
    qty = Math.max(1, qty - 1);
    qtyValueEl.textContent = qty;
  });
  document.getElementById('qty-plus').addEventListener('click', () => {
    qty = Math.min(currentStock() || 1, qty + 1);
    qtyValueEl.textContent = qty;
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
      addBtn.textContent = 'Indisponible';
    } else {
      addBtn.disabled = false;
      addBtn.textContent = 'Ajouter au panier';
    }
    const label = selectedVariant ? ` (${selectedVariant.label})` : '';
    const waMessage = `Bonjour, je suis intéressé par le produit ${product.name}${label} au prix de ${currentPrice()} ${config.currency}.`;
    waBtn.href = Api.whatsappLink(config.whatsappNumber, waMessage);

    if (waQuestionBtn) {
      const waQuestionMessage = `Bonjour, j'ai une question sur le produit ${product.name}${label}.\n${productUrl}`;
      waQuestionBtn.href = Api.whatsappLink(config.whatsappNumber, waQuestionMessage);
    }

    if (mobileBar) {
      mobileBar.querySelector('.mobile-add-bar-price').textContent = formatPrice(currentPrice(), config.currency);
      const mobileAddBtn = mobileBar.querySelector('.mobile-add-bar-btn');
      mobileAddBtn.disabled = isOutOfStock();
      mobileAddBtn.textContent = isOutOfStock() ? 'Indisponible' : 'Ajouter au panier';
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
    showToast(`Ajouté ✓ — ${product.name}${label}`);
  }

  // Ajouter au panier
  if (addBtn) addBtn.addEventListener('click', addToCart);

  // Barre mobile "Ajouter au panier" : discrète, apparaît une fois le bouton
  // principal (dans le contenu) sorti de l'écran, pour rester utile sans
  // dupliquer l'action visible ni masquer le panier/le bouton WhatsApp flottant.
  let mobileBar = null;
  if (window.matchMedia('(max-width: 719px)').matches && 'IntersectionObserver' in window) {
    mobileBar = document.createElement('div');
    mobileBar.className = 'mobile-add-bar';
    mobileBar.innerHTML = `
      <span class="price mobile-add-bar-price"></span>
      <button type="button" class="btn btn-primary mobile-add-bar-btn">Ajouter au panier</button>`;
    document.body.appendChild(mobileBar);
    mobileBar.querySelector('.mobile-add-bar-btn').addEventListener('click', () => {
      if (!isOutOfStock()) addToCart();
    });
    const observer = new IntersectionObserver(([entry]) => {
      const visible = !entry.isIntersecting;
      mobileBar.classList.toggle('visible', visible);
      // Le bouton WhatsApp flottant remonte tant que la barre occupe le bas
      // de l'écran, pour ne jamais se superposer à "Ajouter au panier".
      document.body.classList.toggle('has-mobile-add-bar', visible);
    }, { threshold: 0 });
    observer.observe(addBtn);
  }

  refreshForVariant();

  // Produits similaires
  if (product.related && product.related.length) {
    document.getElementById('related-section').hidden = false;
    document.getElementById('related-grid').innerHTML = product.related.map((p) => renderProductCard(p, config.currency)).join('');
  }
});
