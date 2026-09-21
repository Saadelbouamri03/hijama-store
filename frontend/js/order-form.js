// Formulaire de commande rapide unique (nom/téléphone/ville), réutilisé sur
// les fiches produits et les landing pages — alternative courte au panier
// complet pour une commande "en un clic" typique du COD marocain. Plusieurs
// instances peuvent être montées sur une même page (ex: haut + bas d'une
// landing) sans collision d'id. La logique de calcul de livraison réutilise
// exactement Cart.estimateDeliveryFee (même règle que le checkout complet et
// que le serveur) — jamais de tarif recalculé séparément ici.

const MOROCCAN_CITIES = [
  'الدار البيضاء', 'الرباط', 'مراكش', 'فاس', 'طنجة', 'أكادير', 'مكناس', 'وجدة',
  'القنيطرة', 'تطوان', 'سلا', 'المحمدية', 'خريبكة', 'الجديدة', 'بني ملال',
  'تازة', 'الناظور', 'سطات', 'برشيد', 'خنيفرة', 'العيون', 'الصويرة',
  'ورزازات', 'إفران', 'شفشاون', 'العرائش', 'الحسيمة', 'تارودانت', 'آسفي',
  'قلعة السراغنة', 'أزيلال', 'تيزنيت', 'الفقيه بن صالح', 'زاكورة',
  'ميدلت', 'سيدي قاسم', 'سيدي سليمان', 'تاونات', 'بركان', 'تاوريرت',
];

const ORDER_FORM_LABELS_FR = {
  name: 'Nom complet', namePlaceholder: 'Ex : Mohamed Alami',
  phone: 'Téléphone', phonePlaceholder: '06XXXXXXXX',
  city: 'Ville', cityPlaceholder: 'Ex : Casablanca',
  nameError: 'Merci d\'indiquer votre nom complet.',
  phoneError: 'Numéro invalide — exemple : 0612345678.',
  cityError: 'Merci d\'indiquer votre ville.',
  subtotal: 'Sous-total', delivery: 'Livraison', total: 'Total à la livraison',
  submit: '🛒 Commander — paiement à la livraison',
  note: 'Vous ne payez rien maintenant. Vous payez uniquement à la réception.',
  sending: 'Envoi en cours…',
  genericError: 'Une erreur est survenue. Merci de réessayer.',
};

const ORDER_FORM_LABELS_AR = {
  name: 'الاسم الكامل', namePlaceholder: 'مثال: محمد العلمي',
  phone: 'رقم الهاتف', phonePlaceholder: '06XXXXXXXX',
  city: 'المدينة', cityPlaceholder: 'مثال: الدار البيضاء',
  nameError: 'عافاك دخّل الاسم الكامل.',
  phoneError: 'رقم الهاتف ماشي صحيح — مثال: 0612345678.',
  cityError: 'عافاك دخّل المدينة ديالك.',
  subtotal: 'الطقم', delivery: 'التوصيل', total: 'المجموع للأداء عند الاستلام',
  submit: '🛒 اطلب الآن — الدفع عند الاستلام',
  note: 'ما كتخلّص والو دابا. كتخلّص غير منين يوصلك الطلب ليدك.',
  sending: 'كيتصيفط…',
  genericError: 'وقع خطأ. عافاك عاود المحاولة.',
};

const OrderForm = (() => {
  let instanceCounter = 0;
  let deliveryFeesPromise = null;
  let currency = 'DH';
  let defaultFee = 30;

  document.addEventListener('config:ready', (e) => { currency = e.detail.currency; defaultFee = e.detail.defaultDeliveryFee ?? defaultFee; });

  function loadDeliveryFees() {
    if (!deliveryFeesPromise) {
      deliveryFeesPromise = Api.get('/api/delivery-fees').catch(() => ({ fees: [], defaultFee }));
    }
    return deliveryFeesPromise;
  }

  function findFeeForCity(fees, city) {
    if (!city) return defaultFee;
    const match = fees.find((f) => f.city.toLowerCase() === city.trim().toLowerCase());
    return match ? match.fee : defaultFee;
  }

  function isValidMoroccanPhoneClient(raw) {
    const cleaned = String(raw || '').replace(/[\s.-]/g, '');
    return /^(?:\+212|00212|0)[5-7]\d{8}$/.test(cleaned);
  }

  // opts: { getLineItems(): [{productId, variantId, quantity, name, categorySlug}],
  //         getSubtotal(): number, lang: 'ar'|'fr', onSuccess(order), title?: string }
  async function mount(container, opts) {
    const id = 'of' + (++instanceCounter);
    const t = opts.lang === 'ar' ? ORDER_FORM_LABELS_AR : ORDER_FORM_LABELS_FR;
    const dir = opts.lang === 'ar' ? ' dir="rtl"' : '';

    const feesData = await loadDeliveryFees();
    const fees = feesData.fees || [];
    defaultFee = feesData.defaultFee ?? defaultFee;

    container.innerHTML = `
      <form class="order-form" id="${id}-form" novalidate${dir}>
        ${opts.title ? `<h3 class="order-form-title">${opts.title}</h3>` : ''}
        <div class="order-form-honeypot" aria-hidden="true">
          <label for="${id}-hp">Laisser vide</label>
          <input type="text" id="${id}-hp" tabindex="-1" autocomplete="off">
        </div>
        <div class="field">
          <label for="${id}-name">${t.name}</label>
          <input type="text" id="${id}-name" required placeholder="${t.namePlaceholder}">
          <p class="error-msg">${t.nameError}</p>
        </div>
        <div class="field">
          <label for="${id}-phone">${t.phone}</label>
          <input type="tel" inputmode="tel" id="${id}-phone" required placeholder="${t.phonePlaceholder}">
          <p class="error-msg">${t.phoneError}</p>
        </div>
        <div class="field">
          <label for="${id}-city">${t.city}</label>
          <input type="text" id="${id}-city" required placeholder="${t.cityPlaceholder}" list="${id}-cities" autocomplete="off">
          <datalist id="${id}-cities">${MOROCCAN_CITIES.map((c) => `<option value="${escapeHtml(c)}">`).join('')}</datalist>
          <p class="error-msg">${t.cityError}</p>
        </div>
        <div class="order-form-summary">
          <div class="summary-row"><span>${t.subtotal}</span><span id="${id}-subtotal">—</span></div>
          <div class="summary-row"><span>${t.delivery}</span><span id="${id}-delivery">—</span></div>
          <div class="summary-row total"><span>${t.total}</span><span id="${id}-total">—</span></div>
        </div>
        <button type="submit" class="btn btn-primary btn-block order-form-submit" id="${id}-submit">${t.submit}</button>
        <p class="hint" style="text-align:center">${t.note}</p>
      </form>`;

    const form = document.getElementById(`${id}-form`);
    const nameEl = document.getElementById(`${id}-name`);
    const phoneEl = document.getElementById(`${id}-phone`);
    const cityEl = document.getElementById(`${id}-city`);
    const submitBtn = document.getElementById(`${id}-submit`);

    let tracked = false;
    function trackInitiateCheckout() {
      if (tracked) return;
      tracked = true;
      const items = opts.getLineItems();
      const value = opts.getSubtotal();
      if (typeof fbq === 'function') {
        fbq('track', 'InitiateCheckout', {
          value, currency: 'MAD', content_type: 'product',
          contents: items.map((i) => ({ id: i.productId, quantity: i.quantity })),
        });
      }
      if (typeof ttq !== 'undefined' && ttq && typeof ttq.track === 'function') {
        ttq.track('InitiateCheckout', {
          value, currency: 'MAD',
          contents: items.map((i) => ({ content_id: String(i.productId), quantity: i.quantity })),
        });
      }
    }
    [nameEl, phoneEl, cityEl].forEach((el) => el.addEventListener('focus', trackInitiateCheckout, { once: true }));

    function renderSummary() {
      const items = opts.getLineItems();
      const subtotal = opts.getSubtotal();
      const fee = Cart.estimateDeliveryFee(findFeeForCity(fees, cityEl.value), items);
      document.getElementById(`${id}-subtotal`).textContent = formatPrice(subtotal, currency);
      document.getElementById(`${id}-delivery`).textContent = formatPrice(fee, currency);
      document.getElementById(`${id}-total`).textContent = formatPrice(subtotal + fee, currency);
    }
    cityEl.addEventListener('input', renderSummary);
    renderSummary();

    function setFieldError(el, hasError) {
      el.closest('.field').classList.toggle('has-error', hasError);
    }
    function validate() {
      const nameOk = nameEl.value.trim().length >= 3;
      const phoneOk = isValidMoroccanPhoneClient(phoneEl.value);
      const cityOk = cityEl.value.trim().length > 0;
      setFieldError(nameEl, !nameOk);
      setFieldError(phoneEl, !phoneOk);
      setFieldError(cityEl, !cityOk);
      return nameOk && phoneOk && cityOk;
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!validate()) return;

      submitBtn.disabled = true;
      const originalLabel = submitBtn.textContent;
      submitBtn.innerHTML = `<span class="spinner"></span> ${t.sending}`;

      const items = opts.getLineItems();
      const payload = {
        customerName: nameEl.value.trim(),
        phone: phoneEl.value.trim(),
        city: cityEl.value.trim(),
        honeypot: document.getElementById(`${id}-hp`).value,
        items: items.map((i) => ({ productId: i.productId, variantId: i.variantId || undefined, quantity: i.quantity })),
        ...Attribution.toOrderFields(),
      };

      try {
        const order = await Api.post('/api/orders', payload);
        sessionStorage.setItem('lastOrder', JSON.stringify(order));
        if (typeof opts.onSuccess === 'function') opts.onSuccess(order);
        else window.location.href = '/merci';
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
        showToast(err.message || t.genericError);
      }
    });

    return { refresh: renderSummary };
  }

  return { mount };
})();
