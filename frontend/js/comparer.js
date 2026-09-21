// Comparateur générique : compare 2 à 3 produits d'une même catégorie sur
// les seules informations réellement présentes au catalogue. Toute donnée
// absente affiche "Non renseigné" plutôt qu'une valeur devinée.

function getQueryParams() {
  return new URLSearchParams(window.location.search);
}

function sizesLine(product, variants) {
  const sizeVariants = variants.filter((v) => isSizeVariantLabel(v.label));
  if (sizeVariants.length) return sizeVariants.map((v) => v.label).join(', ');
  const freeText = extractSizesParenthetical(product.description);
  return freeText || I18N.t('compare.notSpecified', 'Non renseigné');
}

function priceLine(product, variants, currency) {
  if (variants.length) {
    const prices = variants.map((v) => v.price);
    const min = Math.min(...prices), max = Math.max(...prices);
    return min === max ? formatPrice(min, currency) : `${formatPrice(min, currency)} – ${formatPrice(max, currency)}`;
  }
  return formatPrice(product.price, currency);
}

function availabilityLine(product, variants) {
  if (variants.length) {
    const anyInStock = variants.some((v) => v.stock > 0);
    return anyInStock ? I18N.t('compare.inStockBySize', 'En stock (selon la taille choisie)') : I18N.t('product.outOfStock', 'Rupture de stock');
  }
  return availabilityLabel(product.stock).text;
}

const ROWS = () => [
  { key: 'ref', label: I18N.t('compare.reference', 'Référence'), get: (p) => extractRef(p.description) || I18N.t('compare.notSpecified', 'Non renseigné') },
  { key: 'sizes', label: I18N.t('compare.availableSizes', 'Tailles disponibles'), get: (p, v) => sizesLine(p, v) },
  { key: 'material', label: I18N.t('compare.materialBrand', 'Matière / marque'), get: (p) => materialOrBrandLabel(p.name) || I18N.t('compare.notSpecified', 'Non renseigné') },
  { key: 'conditioning', label: I18N.t('compare.conditioning', 'Conditionnement'), get: (p) => conditioningLabel(p) },
  { key: 'price', label: I18N.t('compare.priceUnit', 'Prix et unité de vente'), get: (p, v, currency) => priceLine(p, v, currency) },
  { key: 'availability', label: I18N.t('compare.availability', 'Disponibilité'), get: (p, v) => availabilityLine(p, v) },
];

function renderCompareTable(products, currency) {
  const rowDefs = ROWS();
  const head = `<tr><th class="compare-row-label"></th>${products.map((p) => `
    <th><img src="${productImageSrc(p)}" alt="">${escapeHtml(p.name)}</th>`).join('')}</tr>`;

  const rows = rowDefs.map((row) => `
    <tr>
      <th class="compare-row-label">${row.label}</th>
      ${products.map((p) => `<td>${escapeHtml(String(row.get(p, p.variants || [], currency)))}</td>`).join('')}
    </tr>`).join('');

  const linksRow = `
    <tr>
      <th class="compare-row-label"></th>
      ${products.map((p) => `<td><a href="/produit/${encodeURIComponent(p.slug)}" class="btn btn-primary btn-sm">${I18N.t('compare.seeProduct', 'Voir le produit')}</a></td>`).join('')}
    </tr>`;

  const cards = products.map((p) => `
    <div class="compare-card">
      <h3>${escapeHtml(p.name)}</h3>
      ${rowDefs.map((row) => `
        <div class="compare-card-row"><span>${row.label}</span><span>${escapeHtml(String(row.get(p, p.variants || [], currency)))}</span></div>
      `).join('')}
      <p class="mt-6"><a href="/produit/${encodeURIComponent(p.slug)}" class="btn btn-primary btn-block">${I18N.t('compare.seeProduct', 'Voir le produit')}</a></p>
    </div>`).join('');

  return `
    <div class="compare-table-wrap">
      <table class="compare-table">
        <thead>${head}</thead>
        <tbody>${rows}${linksRow}</tbody>
      </table>
    </div>
    <div class="compare-cards">${cards}</div>`;
}

document.addEventListener('config:ready', async (e) => {
  const config = e.detail;
  const params = getQueryParams();
  const categorySelect = document.getElementById('compare-category');
  const selectA = document.getElementById('compare-a');
  const selectB = document.getElementById('compare-b');
  const selectC = document.getElementById('compare-c');
  const result = document.getElementById('compare-result');

  let categories = [];
  let productsByCategory = {};

  async function loadProductsFor(categorySlug) {
    if (!productsByCategory[categorySlug]) {
      productsByCategory[categorySlug] = await Api.get(`/api/products?category=${encodeURIComponent(categorySlug)}`);
    }
    return productsByCategory[categorySlug];
  }

  function fillProductSelect(select, products, keepValue, placeholder) {
    const current = keepValue || select.value;
    select.innerHTML = (placeholder ? `<option value="">${placeholder}</option>` : '') +
      products.map((p) => `<option value="${escapeHtml(p.slug)}">${escapeHtml(p.name)}</option>`).join('');
    if (current && products.some((p) => p.slug === current)) select.value = current;
  }

  async function runComparison() {
    const slugs = [selectA.value, selectB.value, selectC.value].filter(Boolean);
    if (slugs.length < 2) {
      result.innerHTML = `<p>${I18N.t('compare.selectPrompt', 'Sélectionnez au moins deux produits pour lancer la comparaison.')}</p>`;
      return;
    }
    result.innerHTML = `<p>${I18N.t('compare.loading', 'Comparaison en cours…')}</p>`;
    try {
      const products = await Promise.all(slugs.map((s) => Api.get(`/api/products/${encodeURIComponent(s)}`)));
      result.innerHTML = renderCompareTable(products, config.currency);
    } catch (err) {
      result.innerHTML = `<p>${I18N.t('compare.loadError', 'Impossible de charger la comparaison pour le moment.')}</p>`;
    }
  }

  async function onCategoryChange(preselectSlugs = []) {
    const products = await loadProductsFor(categorySelect.value);
    fillProductSelect(selectA, products, preselectSlugs[0]);
    fillProductSelect(selectB, products, preselectSlugs[1] || products[1]?.slug);
    fillProductSelect(selectC, products, '', '—');
    runComparison();
  }

  try {
    categories = await Api.get('/api/categories');
    categorySelect.innerHTML = categories.map((c) => `<option value="${escapeHtml(c.slug)}">${escapeHtml(c.name)}</option>`).join('');

    let initialCategory = categories[0]?.slug;
    let preselect = [];
    if (params.get('a')) {
      const productA = await Api.get(`/api/products/${encodeURIComponent(params.get('a'))}`).catch(() => null);
      if (productA?.category_slug) {
        initialCategory = productA.category_slug;
        preselect = [params.get('a'), params.get('b')].filter(Boolean);
      }
    }
    categorySelect.value = initialCategory;
    await onCategoryChange(preselect);
  } catch (err) {
    console.error(err);
    result.innerHTML = `<p>${I18N.t('categories.loadError', 'Impossible de charger les catégories pour le moment.')}</p>`;
  }

  categorySelect.addEventListener('change', () => onCategoryChange());
  [selectA, selectB, selectC].forEach((sel) => sel.addEventListener('change', runComparison));
});
