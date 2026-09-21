// Landing page /pack-hajjam-pro : un seul produit (le pack, créé comme
// produit standalone dans le catalogue), pas de panier multi-articles. Le
// prix barré et l'économie sont calculés depuis les vrais prix catalogue des
// 4 composants (jamais saisis à la main) ; la livraison utilise le vrai
// tarif par défaut du site (config.defaultDeliveryFee), pas un montant fixe
// écrit en dur — si des tarifs par ville sont ajoutés plus tard dans
// l'admin, le résumé du formulaire de commande affichera le tarif exact dès
// que la ville est saisie.

// IDs réels des 4 composants du pack (voir catalogue admin) : boîte de 100
// ventouses Al Assala (choix de taille, ici on prend le prix de base),
// pompe noire, huile de paraffine, kit magnétique en boîte.
const PACK_COMPONENT_IDS = [38, 29, 55, 24];

const TITLE_VARIANTS = {
  a: 'طقم الحجّام المحترف<br>كل ما تحتاجه لجلسة حجامة ف علبة وحدة',
  b: 'كأس جديد لكل زبون<br>بأقل من 2 دراهم للكأس',
  c: '100 كأس + مضخة + زيت + طقم مغناطيسي<br>كامل ف طقم واحد',
  d: 'واش باغي تجهّز الكابينة ديالك؟<br>بدا من هنا',
};

document.addEventListener('config:ready', async (e) => {
  const config = e.detail;

  document.getElementById('landing-footer-year').textContent = new Date().getFullYear();

  // Variante de titre pour tests A/B (?v=b/c/d), sans dupliquer la page.
  const variant = Attribution.getVariant();
  if (variant && TITLE_VARIANTS[variant]) {
    document.getElementById('hero-title').innerHTML = TITLE_VARIANTS[variant];
  }

  let packProduct, components, upsellProduct, packConfig;
  try {
    packConfig = await Api.get('/api/config/pack');
    const results = await Promise.all([
      Api.get(`/api/products/${encodeURIComponent(packConfig.productSlug)}`),
      ...PACK_COMPONENT_IDS.map((id) => Api.get(`/api/products/${id}`)),
      Api.get(`/api/products/${packConfig.upsellProductId}`).catch(() => null),
    ]);
    packProduct = results[0];
    components = results.slice(1, 1 + PACK_COMPONENT_IDS.length);
    upsellProduct = results[results.length - 1];
  } catch (err) {
    document.getElementById('main').innerHTML = `
      <section class="section-cream"><div class="container empty-state">
        <h2>Cette offre n'est pas encore disponible</h2>
        <p>Revenez bientôt, ou découvrez le reste de la boutique.</p>
        <a href="/produits" class="btn btn-primary">Voir tous les produits</a>
      </div></section>`;
    return;
  }

  if (typeof fbq === 'function') {
    fbq('track', 'ViewContent', { value: packProduct.price, currency: 'MAD', content_ids: [packProduct.id], content_type: 'product', content_name: packProduct.name });
  }
  if (typeof ttq !== 'undefined' && ttq && typeof ttq.track === 'function') {
    ttq.track('ViewContent', { content_id: String(packProduct.id), content_type: 'product', content_name: packProduct.name, value: packProduct.price, currency: 'MAD' });
  }

  const componentsSum = components.reduce((sum, c) => sum + c.price, 0);
  const savings = Math.max(0, componentsSum - packProduct.price);

  // ---------- État partagé entre les 2 formulaires (haut/bas) ----------
  let packQty = 1;
  let upsellChecked = false;
  let orderFormTop = null;
  let orderFormBottom = null;

  function getLineItems() {
    const items = [{
      productId: packProduct.id,
      quantity: packQty,
      name: packProduct.name,
      categorySlug: packProduct.category_slug || '',
    }];
    if (upsellChecked && upsellProduct) {
      items.push({
        productId: upsellProduct.id,
        quantity: 1,
        name: upsellProduct.name,
        categorySlug: upsellProduct.category_slug || '',
      });
    }
    return items;
  }

  function getSubtotal() {
    let subtotal = packProduct.price * packQty;
    if (packQty >= 2) subtotal -= packConfig.secondUnitDiscount;
    if (upsellChecked && upsellProduct) subtotal += upsellProduct.price;
    return subtotal;
  }

  function refreshForms() {
    if (orderFormTop) orderFormTop.refresh();
    if (orderFormBottom) orderFormBottom.refresh();
    renderStickyBar();
  }

  // ---------- Bloc prix (hero) ----------
  function renderPriceBox() {
    const twoPacksPrice = packProduct.price * 2 - packConfig.secondUnitDiscount;
    document.getElementById('landing-price-box').innerHTML = `
      <div class="landing-price-row">
        <span class="landing-price-old">${formatPrice(componentsSum, config.currency)}</span>
        <span class="landing-price-now">${formatPrice(packProduct.price, config.currency)}</span>
      </div>
      ${savings > 0 ? `<p class="landing-savings">توفّر ${formatPrice(savings, config.currency)}</p>` : ''}
      <p class="landing-delivery-line">🚚 التوصيل: ${formatPrice(config.defaultDeliveryFee, config.currency)} لجميع المدن</p>
      <p class="hint">جوج طقم بـ${formatPrice(twoPacksPrice, config.currency)} (توفّر ${formatPrice(packConfig.secondUnitDiscount, config.currency)} إضافية)</p>`;
  }

  // ---------- Sélecteur quantité / upsell ----------
  function wireOptions() {
    const optionsEl = document.getElementById('landing-options');
    optionsEl.hidden = false;
    optionsEl.querySelectorAll('.landing-qty-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        packQty = Number(pill.dataset.qty);
        optionsEl.querySelectorAll('.landing-qty-pill').forEach((p) => {
          const selected = p === pill;
          p.classList.toggle('selected', selected);
          p.setAttribute('aria-checked', selected ? 'true' : 'false');
        });
        refreshForms();
      });
    });
    if (upsellProduct) {
      document.getElementById('landing-upsell-label').textContent = `زيد ${upsellProduct.name} بـ${formatPrice(upsellProduct.price, config.currency)}`;
      document.getElementById('landing-upsell-checkbox').addEventListener('change', (ev) => {
        upsellChecked = ev.target.checked;
        refreshForms();
      });
    } else {
      document.getElementById('landing-upsell-checkbox').closest('.landing-upsell-check').hidden = true;
    }
  }

  // ---------- Contenu du pack (4 vrais articles) ----------
  function renderContents() {
    document.getElementById('pack-contents-grid').innerHTML = components.map((c) => `
      <div class="landing-content-card">
        <img src="${productImageSrc(c)}" alt="${escapeHtml(c.name)}" loading="lazy">
        <h3${bidiAttr(c.name)}>${escapeHtml(c.name)}</h3>
        <p${bidiAttr(c.description)}>${escapeHtml((c.description || '').split('.')[0])}</p>
      </div>`).join('');
  }

  // ---------- Argument chiffré (prix par ventouse) ----------
  function renderMath() {
    const cupsProduct = components[0]; // PACK_COMPONENT_IDS[0] = 38, boîte de 100 ventouses
    const pricePerCup = cupsProduct.price / 100;
    if (pricePerCup > 2) return; // l'argument ne tient plus, on masque plutôt que d'afficher un chiffre qui n'aide plus
    document.getElementById('landing-math-text').innerHTML = `
      100 كأس ف الطقم<br>
      الكأس الواحد كيطلع عليك بأقل من ${pricePerCup.toFixed(2)} درهم<br>
      يعني تقدر تخدم بكأس جديد لكل زبون — نظافة أكثر وثقة أكبر`;
    document.getElementById('landing-math-section').hidden = false;
  }

  // ---------- FAQ ----------
  function renderFaq() {
    const faqItems = [
      ['شحال ديال الوقت كياخد التوصيل؟', '24 إلى 48 ساعة من تأكيد الطلب.'],
      ['واش خاصني نخلّص دابا؟', 'لا. كتخلّص منين يوصلك الطقم ليدك، ما كاين حتى أداء مسبق.'],
      ['شحال ثمن التوصيل؟', `كيتحدد حسب المدينة ديالك — غادي يبان ليك بالضبط ملي تعمر الفورم (حاليا ${formatPrice(config.defaultDeliveryFee, config.currency)} فمعظم المدن).`],
      ['واش نقدر نعاود نستعمل الكؤوس؟', 'الكؤوس خاصها تتغسل وتتعقم مزيان من بعد كل استعمال. ف الحجامة بالتشريط، استعمل كأس جديد لكل شخص.'],
      ['واش المضخة كتمشي مع كاع الكؤوس؟', 'إيه، مع جميع الكؤوس اللي ف الطقم.'],
      ['كيفاش نرجّع الطقم إلا ما عجبنيش؟', 'إلا وصلك معيوب أو مختلف عن الطلب، تواصل معانا على واتساب فـ48 ساعة من التوصيل وغادي نعاونوك بتبديل أو استرجاع.'],
    ];
    document.getElementById('landing-faq').innerHTML = faqItems.map(([q, a]) => renderFaqItem(q, a)).join('');
  }

  // ---------- Avis (masqués tant qu'aucun vrai avis n'existe) ----------
  async function renderReviews() {
    try {
      const reviews = await Api.get(`/api/reviews?productId=${packProduct.id}`);
      if (reviews.length) {
        document.getElementById('landing-reviews-grid').innerHTML = reviews.map(renderReviewCard).join('');
        document.getElementById('landing-reviews-section').hidden = false;
      }
    } catch (err) { /* section reste masquée */ }
  }

  // ---------- Barre collante mobile ----------
  function renderStickyBar() {
    document.getElementById('landing-sticky-price').textContent = formatPrice(getSubtotal(), config.currency);
  }
  function wireStickyBar() {
    const bar = document.getElementById('landing-sticky-bar');
    const heroEl = document.querySelector('.landing-hero');
    if ('IntersectionObserver' in window && heroEl) {
      const observer = new IntersectionObserver(([entry]) => {
        bar.hidden = entry.isIntersecting;
      }, { threshold: 0 });
      observer.observe(heroEl);
    }
    document.getElementById('landing-sticky-btn').addEventListener('click', () => {
      const target = bar.hidden ? null : document.getElementById('order-form-bottom');
      const mount = document.getElementById('order-form-top').offsetParent ? document.getElementById('order-form-top') : document.getElementById('order-form-bottom');
      (target || mount).scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    renderStickyBar();
  }

  // ---------- Rendu initial ----------
  renderPriceBox();
  wireOptions();
  renderContents();
  renderMath();
  renderFaq();
  renderReviews();
  wireStickyBar();

  orderFormTop = await OrderForm.mount(document.getElementById('order-form-top'), {
    lang: 'ar', getLineItems, getSubtotal,
    title: 'عمّر المعلومات وغادي نتاصلو بيك باش نأكدو الطلب',
  });
  orderFormBottom = await OrderForm.mount(document.getElementById('order-form-bottom'), {
    lang: 'ar', getLineItems, getSubtotal,
  });
});
