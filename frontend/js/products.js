// Page /produits : filtre par catégorie (chips), par "nouveautés"/"meilleures
// ventes", et recherche texte. L'état du filtre est reflété dans l'URL
// (?categorie=... ou ?filter=...) pour que les liens soient partageables.

let currentCurrency = 'DH';

function getQueryParams() {
  return new URLSearchParams(window.location.search);
}

async function loadProducts() {
  const params = getQueryParams();
  const apiParams = new URLSearchParams();
  if (params.get('categorie')) apiParams.set('category', params.get('categorie'));
  if (params.get('filter')) apiParams.set('filter', params.get('filter'));
  if (params.get('q')) apiParams.set('search', params.get('q'));

  const banner = document.getElementById('hijama-context-banner');
  if (banner) banner.hidden = params.get('categorie') !== 'koub-hijama';

  const grid = document.getElementById('products-grid');
  grid.innerHTML = `<p>${I18N.t('common.loadingProducts', 'Chargement des produits…')}</p>`;
  try {
    const products = await Api.get(`/api/products?${apiParams.toString()}`);
    grid.innerHTML = products.length
      ? products.map((p) => renderProductCard(p, currentCurrency)).join('')
      : `<p>${I18N.t('products.noResults', 'Aucun produit ne correspond à votre recherche.')}</p>`;
  } catch (err) {
    grid.innerHTML = `<p>${I18N.t('products.loadError', 'Impossible de charger les produits pour le moment.')}</p>`;
  }
}

function setActiveChip() {
  const params = getQueryParams();
  const activeValue = params.get('categorie') ? `cat:${params.get('categorie')}` : (params.get('filter') ? `filter:${params.get('filter')}` : '');
  document.querySelectorAll('#category-chips .chip').forEach((chip) => {
    chip.setAttribute('aria-pressed', chip.dataset.value === activeValue ? 'true' : 'false');
  });
}

async function buildChips() {
  const container = document.getElementById('category-chips');
  try {
    const categories = await Api.get('/api/categories');
    const chipsHtml = categories.map((c) =>
      `<button class="chip" data-value="cat:${c.slug}" data-categorie="${c.slug}">${escapeHtml(c.name)}</button>`
    ).join('');
    container.innerHTML =
      `<button class="chip" data-value="">${I18N.t('products.all', 'Tous les produits')}</button>` +
      chipsHtml +
      `<button class="chip" data-value="filter:nouveautes" data-filter="nouveautes">${I18N.t('common.newArrivals', 'Nouveautés')}</button>` +
      `<button class="chip" data-value="filter:bestsellers" data-filter="bestsellers">${I18N.t('common.bestsellerPlural', 'Meilleures ventes')}</button>`;
  } catch (err) {
    console.error(err);
  }
  setActiveChip();

  container.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('categorie');
    url.searchParams.delete('filter');
    if (chip.dataset.categorie) url.searchParams.set('categorie', chip.dataset.categorie);
    if (chip.dataset.filter) url.searchParams.set('filter', chip.dataset.filter);
    window.history.pushState({}, '', url);
    setActiveChip();
    loadProducts();
  });
}

document.addEventListener('config:ready', async (e) => {
  currentCurrency = e.detail.currency;

  const params = getQueryParams();
  const searchInput = document.getElementById('search-input');
  if (params.get('q')) searchInput.value = params.get('q');

  let searchTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const url = new URL(window.location.href);
      if (searchInput.value.trim()) url.searchParams.set('q', searchInput.value.trim());
      else url.searchParams.delete('q');
      window.history.pushState({}, '', url);
      loadProducts();
    }, 350);
  });

  await buildChips();
  await loadProducts();
});
