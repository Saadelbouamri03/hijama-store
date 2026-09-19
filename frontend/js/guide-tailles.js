// Guide des tailles de ventouses : construit dynamiquement à partir des
// produits réels de la catégorie "koub-hijama" et de leurs variantes/texte
// de description — jamais de dimension inventée. Un produit qui ne fournit
// aucune donnée de taille exploitable n'apparaît simplement pas ici.

function renderSizeSwatches(product, variants, currency) {
  const sizeVariants = variants.filter((v) => isSizeVariantLabel(v.label));
  return `
    <div class="size-swatches">
      ${sizeVariants.map((v) => `
        <a class="size-swatch ${v.stock <= 0 ? 'out' : ''}" href="/produit/${encodeURIComponent(product.slug)}">
          <span class="dot" style="width:${Math.min(38, 16 + Number(parseFloat(v.label)) * 2.6)}px; height:${Math.min(38, 16 + Number(parseFloat(v.label)) * 2.6)}px"></span>
          <span class="label">${escapeHtml(v.label)}</span>
          <span class="stock-note">${formatPrice(v.price, currency)}${v.stock <= 0 ? ' · rupture' : ''}</span>
        </a>`).join('')}
    </div>`;
}

function renderSizeGuideCard(product, variants, currency) {
  const ref = extractRef(product.description);
  const brand = materialOrBrandLabel(product.name);
  const sizeVariants = variants.filter((v) => isSizeVariantLabel(v.label));
  const hasStructuredSizes = sizeVariants.length > 0;
  const freeTextSizes = !hasStructuredSizes ? extractSizesParenthetical(product.description) : null;
  if (!hasStructuredSizes && !freeTextSizes) return '';

  return `
    <article class="size-guide-card">
      <div class="size-guide-card-head">
        <img src="${productImageSrc(product)}" alt="" loading="lazy">
        <div>
          <h3>${escapeHtml(product.name)}</h3>
          <div class="size-guide-meta">
            Réf. ${ref ? escapeHtml(ref) : 'Non renseigné'} ·
            ${brand ? escapeHtml(brand) : 'Non renseigné'} ·
            ${escapeHtml(conditioningLabel(product))}
          </div>
        </div>
      </div>
      ${hasStructuredSizes
        ? renderSizeSwatches(product, variants, currency)
        : `<p class="size-guide-meta">Tailles indiquées par le fournisseur : ${escapeHtml(freeTextSizes)}</p>`}
      <a href="/produit/${encodeURIComponent(product.slug)}" class="btn btn-outline btn-sm">Voir le produit</a>
    </article>`;
}

document.addEventListener('config:ready', async (e) => {
  const config = e.detail;
  const container = document.getElementById('size-guide-content');

  try {
    const products = await Api.get('/api/products?category=koub-hijama');
    const detailed = await Promise.all(
      products.map((p) => Api.get(`/api/products/${encodeURIComponent(p.slug)}`).catch(() => null))
    );

    const cards = detailed
      .filter(Boolean)
      .map((p) => renderSizeGuideCard(p, p.variants || [], config.currency))
      .filter(Boolean);

    container.innerHTML = cards.length
      ? `<div class="size-guide-grid">${cards.join('')}</div>`
      : `<p>Aucune référence avec des tailles renseignées pour le moment. Écrivez-nous sur WhatsApp pour connaître les dimensions disponibles.</p>`;
  } catch (err) {
    console.error(err);
    container.innerHTML = '<p>Impossible de charger le guide des tailles pour le moment.</p>';
  }
});
