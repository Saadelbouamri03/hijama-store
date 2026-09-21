// Logique spécifique à la page d'accueil : charge catégories, produits et
// avis depuis l'API et les affiche dans les sections correspondantes.

document.addEventListener('config:ready', async (e) => {
  const config = e.detail;

  const heroWa = document.getElementById('hero-whatsapp');
  const ctaWa = document.getElementById('cta-whatsapp');
  const waMessage = 'Bonjour, je souhaite passer commande.';
  if (heroWa) heroWa.href = Api.whatsappLink(config.whatsappNumber, waMessage);
  if (ctaWa) ctaWa.href = Api.whatsappLink(config.whatsappNumber, waMessage);

  const socialsEl = document.getElementById('home-socials');
  if (socialsEl) {
    const icons = {
      instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>',
      facebook: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 8h2V4h-2a5 5 0 0 0-5 5v3H8v4h2v7h4v-7h3l1-4h-4V9a1 1 0 0 1 1-1z"/></svg>',
      tiktok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 4v10.5a3.5 3.5 0 1 1-3-3.46"/><path d="M14 4c0 2.5 2 4.5 4.5 4.5"/></svg>',
    };
    socialsEl.innerHTML = Object.entries(config.socials).map(([key, url]) => {
      if (!url || url.startsWith('[')) return '';
      return `<a href="${url}" target="_blank" rel="noopener" aria-label="${key}">${icons[key] || ''}</a>`;
    }).join('');
  }

  try {
    const categories = await Api.get('/api/categories');
    const grid = document.getElementById('home-universe-grid');
    if (grid) {
      grid.innerHTML = categories.map(renderUniverseCard).join('')
        || '<p>Ajoutez des catégories depuis l\'espace admin pour les voir apparaître ici.</p>';
    }
  } catch (err) {
    console.error(err);
  }

  try {
    const products = await Api.get('/api/products');
    const popularGrid = document.getElementById('home-popular-grid');
    if (popularGrid) {
      popularGrid.innerHTML = products.slice(0, 8).map((p) => renderProductCard(p, config.currency)).join('')
        || '<p>Aucun produit pour le moment. Ajoutez vos produits depuis l\'espace admin.</p>';
    }
    const bestsellers = products.filter((p) => p.badge_bestseller).slice(0, 4);
    const bestsellerGrid = document.getElementById('home-bestsellers-grid');
    if (bestsellerGrid) {
      bestsellerGrid.innerHTML = bestsellers.map((p) => renderProductCard(p, config.currency)).join('')
        || '<p>Marquez un produit comme "Meilleure vente" depuis l\'espace admin pour qu\'il apparaisse ici.</p>';
    }
  } catch (err) {
    console.error(err);
  }

  try {
    const reviews = await Api.get('/api/reviews');
    const reviewSection = document.getElementById('home-reviews-section');
    const reviewGrid = document.getElementById('home-reviews-grid');
    if (reviewSection && reviewGrid && reviews.length) {
      reviewGrid.innerHTML = reviews.slice(0, 3).map(renderReviewCard).join('');
      reviewSection.hidden = false;
    }
  } catch (err) {
    console.error(err);
  }
});
