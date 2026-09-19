// Page /checkout — construit le résumé depuis le panier local, calcule les
// frais de livraison selon la ville saisie, valide le formulaire côté client
// (la validation définitive et le calcul du total restent faits par le
// serveur, voir backend/routes/orders.js) puis envoie la commande.

function isValidMoroccanPhoneClient(raw) {
  const cleaned = String(raw || '').replace(/[\s.-]/g, '');
  return /^(?:\+212|00212|0)[5-7]\d{8}$/.test(cleaned);
}

let deliveryFees = [];
let defaultFee = 30;
let currentCurrency = 'DH';

function findFeeForCity(city) {
  if (!city) return defaultFee;
  const match = deliveryFees.find((f) => f.city.toLowerCase() === city.trim().toLowerCase());
  return match ? match.fee : defaultFee;
}

function renderSummary() {
  const items = Cart.getItems();
  const linesEl = document.getElementById('order-lines');
  linesEl.innerHTML = items.map((i) =>
    `<div class="order-line"><span>${escapeHtml(i.name)}${i.variantLabel ? ' — ' + escapeHtml(i.variantLabel) : ''} × ${i.quantity}</span><span>${formatPrice(i.price * i.quantity, currentCurrency)}</span></div>`
  ).join('');

  const subtotal = Cart.getSubtotal();
  const city = document.getElementById('city').value;
  const fee = findFeeForCity(city);
  const total = subtotal + fee;

  document.getElementById('checkout-subtotal').textContent = formatPrice(subtotal, currentCurrency);
  document.getElementById('checkout-delivery').textContent = formatPrice(fee, currentCurrency);
  document.getElementById('checkout-total').textContent = formatPrice(total, currentCurrency);
}

function setFieldError(id, hasError) {
  const field = document.getElementById(id).closest('.field');
  field.classList.toggle('has-error', hasError);
}

function validateForm() {
  const name = document.getElementById('customerName').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const city = document.getElementById('city').value.trim();
  const address = document.getElementById('address').value.trim();

  const nameOk = name.length > 0;
  const phoneOk = isValidMoroccanPhoneClient(phone);
  const cityOk = city.length > 0;
  const addressOk = address.length > 0;

  setFieldError('customerName', !nameOk);
  setFieldError('phone', !phoneOk);
  setFieldError('city', !cityOk);
  setFieldError('address', !addressOk);

  return nameOk && phoneOk && cityOk && addressOk;
}

document.addEventListener('config:ready', async (e) => {
  const config = e.detail;
  currentCurrency = config.currency;
  defaultFee = config.defaultDeliveryFee;

  const items = Cart.getItems();
  if (items.length === 0) {
    document.getElementById('checkout-empty').hidden = false;
    document.getElementById('checkout-form').hidden = true;
    return;
  }

  try {
    const res = await Api.get('/api/delivery-fees');
    deliveryFees = res.fees || [];
    defaultFee = res.defaultFee ?? defaultFee;
  } catch (err) {
    console.error(err);
  }

  renderSummary();

  document.getElementById('city').addEventListener('input', renderSummary);

  document.getElementById('checkout-form').addEventListener('submit', async (evt) => {
    evt.preventDefault();
    const errorBanner = document.getElementById('form-error-banner');
    errorBanner.style.display = 'none';

    if (!validateForm()) {
      errorBanner.textContent = 'Merci de corriger les champs indiqués ci-dessous.';
      errorBanner.style.display = 'flex';
      return;
    }

    const submitBtn = document.getElementById('submit-order-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Envoi en cours…';

    const payload = {
      customerName: document.getElementById('customerName').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      city: document.getElementById('city').value.trim(),
      region: document.getElementById('region').value.trim(),
      address: document.getElementById('address').value.trim(),
      postalCode: document.getElementById('postalCode').value.trim(),
      comment: document.getElementById('comment').value.trim(),
      items: Cart.getItems().map((i) => ({ productId: i.productId, variantId: i.variantId || undefined, quantity: i.quantity })),
    };

    try {
      const order = await Api.post('/api/orders', payload);
      sessionStorage.setItem('lastOrder', JSON.stringify(order));
      Cart.clear();
      window.location.href = '/merci';
    } catch (err) {
      errorBanner.textContent = err.message || 'Une erreur est survenue. Merci de réessayer.';
      errorBanner.style.display = 'flex';
      submitBtn.disabled = false;
      submitBtn.textContent = 'CONFIRMER MA COMMANDE';
    }
  });
});
