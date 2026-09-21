// Injecte les balises meta réelles (titre, description, Open Graph, données
// structurées) dans la page produit AVANT de l'envoyer au navigateur/robot.
// Nécessaire car produit.html remplit normalement ces balises en JavaScript
// (voir frontend/js/product-detail.js) : ça marche pour un visiteur humain,
// mais un robot qui n'exécute pas JS (partages WhatsApp, Facebook,
// prévisualisations de liens, certains robots d'indexation) ne verrait que
// le titre générique "Produit" — jamais le vrai nom/prix/photo.

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function injectProductMeta(html, product, baseUrl) {
  const title = `${product.name} — ${product.price} ${product.currency || 'DH'}`;
  const description = (product.description || '').slice(0, 160) ||
    `${product.name} — livraison partout au Maroc, paiement à la livraison.`;
  const image = product.images && product.images[0]
    ? `${baseUrl}/images/products/${product.images[0]}`
    : `${baseUrl}/images/products/placeholder-hijama.svg`;
  const url = `${baseUrl}/produit/${product.slug}`;

  let out = html
    .replace(
      /<title id="page-title">[^<]*<\/title>/,
      `<title id="page-title">${escapeHtml(title)}</title>`
    )
    .replace(
      /<meta name="description" id="page-description" content="[^"]*">/,
      `<meta name="description" id="page-description" content="${escapeHtml(description)}">`
    );

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description,
    image,
    sku: product.slug,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'MAD',
      price: product.price,
      availability: product.stock > 0
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url,
    },
  };

  // AggregateRating uniquement si de vrais avis existent pour ce produit
  // précis (jamais de note affichée sans avis réels derrière).
  if (product.reviewStats && product.reviewStats.count > 0) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(product.reviewStats.avg).toFixed(1),
      reviewCount: product.reviewStats.count,
    };
  }

  const extraTags = `
<link rel="canonical" href="${url}">
<meta property="og:type" content="product">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta property="og:url" content="${escapeHtml(url)}">
<meta property="product:price:amount" content="${product.price}">
<meta property="product:price:currency" content="MAD">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>`;

  out = out.replace('</head>', extraTags);
  return out;
}

module.exports = { injectProductMeta, escapeHtml };
