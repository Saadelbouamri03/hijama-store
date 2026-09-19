// Fonctions de rendu HTML partagées entre les pages (accueil, produits,
// catégories, avis, détail produit). escapeHtml() protège contre l'injection
// de HTML/scripts dans les champs saisis depuis l'admin (nom, description...).

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function formatPrice(amount, currency) {
  const n = Number(amount) || 0;
  const formatted = Number.isInteger(n) ? n.toString() : n.toFixed(2);
  return `${formatted} ${currency || 'DH'}`;
}

function starString(rating) {
  const r = Math.max(0, Math.min(5, Math.round(rating)));
  return '★★★★★☆☆☆☆☆'.slice(5 - r, 10 - r);
}

function productImageSrc(product) {
  const first = product.images && product.images[0];
  return first ? `/images/products/${first}` : '/images/products/placeholder-hijama.svg';
}

function renderProductCard(product, currency) {
  const outOfStock = product.stock <= 0;
  const badges = [];
  if (outOfStock) badges.push('<span class="badge badge-outofstock">Épuisé</span>');
  else if (product.badge_bestseller) badges.push('<span class="badge badge-best">Meilleure vente</span>');
  if (product.badge_new && !outOfStock) badges.push('<span class="badge badge-new">Nouveau</span>');

  return `
    <article class="product-card" data-category-slug="${escapeHtml(product.category_slug || '')}">
      <a href="/produit/${encodeURIComponent(product.slug)}" class="product-media">
        <img src="${productImageSrc(product)}" alt="${escapeHtml(product.name)}" loading="lazy">
        ${badges.length ? `<div class="product-badges">${badges.join('')}</div>` : ''}
      </a>
      <div class="product-info">
        ${product.category_name ? `<span class="product-cat">${escapeHtml(product.category_name)}</span>` : ''}
        <h3><a href="/produit/${encodeURIComponent(product.slug)}">${escapeHtml(product.name)}</a></h3>
        <div class="price-row">
          <span class="price">${formatPrice(product.price, currency)}</span>
          ${product.old_price ? `<span class="price-old">${formatPrice(product.old_price, currency)}</span>` : ''}
        </div>
      </div>
      <div class="product-actions">
        <button class="btn btn-primary btn-add-cart" data-product-id="${product.id}" ${outOfStock ? 'disabled' : ''}>
          ${outOfStock ? 'Épuisé' : 'Ajouter au panier'}
        </button>
      </div>
    </article>`;
}

function renderCategoryCard(category) {
  const icon = category.image
    ? `<img src="/images/categories/${category.image}" alt="" width="64" height="64" loading="lazy">`
    : '';
  return `
    <a class="cat-card" href="/produits?categorie=${encodeURIComponent(category.slug)}" data-slug="${escapeHtml(category.slug)}">
      ${icon}
      <h3>${escapeHtml(category.name)}</h3>
      ${category.description ? `<p>${escapeHtml(category.description)}</p>` : ''}
      <span class="btn-text">Voir les produits</span>
    </a>`;
}

// Section "Univers produits" de l'accueil : traitement éditorial (grande
// photo réelle + titre + courte présentation), avec une composition en
// mosaïque pour éviter une suite de blocs identiques. Les indices 0 et 3
// reçoivent une tuile plus grande.
function renderUniverseCard(category, index) {
  const isLarge = index === 0 || index === 3;
  const img = category.image
    ? `<img src="/images/categories/${category.image}" alt="${escapeHtml(category.name)}" loading="lazy">`
    : '';
  return `
    <a class="universe-card ${isLarge ? 'universe-card-lg' : ''}" href="/produits?categorie=${encodeURIComponent(category.slug)}" data-slug="${escapeHtml(category.slug)}">
      <div class="universe-media">${img}</div>
      <div class="universe-copy">
        <h3>${escapeHtml(category.name)}</h3>
        ${category.description ? `<p>${escapeHtml(category.description)}</p>` : ''}
        <span class="btn-text">Voir les produits →</span>
      </div>
    </a>`;
}

function renderNouveautesCard() {
  return `
    <a class="cat-card" href="/produits?filter=nouveautes">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#183D32" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z"/></svg>
      <h3>Nouveautés</h3>
      <p>Les derniers produits ajoutés à la boutique.</p>
      <span class="btn-text">Voir les produits</span>
    </a>`;
}

function renderReviewCard(review) {
  return `
    <article class="review-card">
      <div class="stars" aria-label="${review.rating} sur 5">${starString(review.rating)}</div>
      <p>« ${escapeHtml(review.comment)} »</p>
      <div class="review-name">${escapeHtml(review.customer_name)}</div>
      ${review.is_demo ? '<span class="demo-tag">Avis DEMO — à remplacer par un vrai avis client</span>' : ''}
    </article>`;
}

// Délégation d'événement : gère "Ajouter au panier" sur n'importe quelle
// grille de produits injectée dynamiquement (accueil, liste produits...).
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-add-cart');
  if (!btn || btn.disabled) return;
  const id = Number(btn.dataset.productId);
  const card = btn.closest('.product-card');
  const name = card ? card.querySelector('h3 a')?.textContent : 'Produit';

  Api.get(`/api/products/${id}`).then((product) => {
    Cart.add(product, 1);
    showToast(`Ajouté ✓ — ${name}`);
  }).catch(() => showToast("Impossible d'ajouter ce produit pour le moment."));
});
