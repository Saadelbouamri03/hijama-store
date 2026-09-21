// Page /panier — lit et modifie le panier stocké dans le navigateur (Cart).

function renderCartItem(item, currency) {
  const img = item.image ? `/images/products/${item.image}` : '/images/products/placeholder-hijama.svg';
  return `
    <div class="cart-item" data-product-id="${item.productId}" data-variant-id="${item.variantId || ''}">
      <img src="${img}" alt="${escapeHtml(item.name)}">
      <div>
        <h3><a href="/produit/${item.slug}"${bidiAttr(item.name)}>${escapeHtml(item.name)}</a></h3>
        ${item.variantLabel ? `<div class="hint">${escapeHtml(item.variantLabel)}</div>` : ''}
        <div>${formatPrice(item.price, currency)}</div>
        <div class="qty-control mt-6" style="margin-top:8px">
          <button type="button" class="qty-dec" aria-label="${I18N.t('common.decreaseQty', 'Diminuer la quantité')}">−</button>
          <span>${item.quantity}</span>
          <button type="button" class="qty-inc" aria-label="${I18N.t('common.increaseQty', 'Augmenter la quantité')}">+</button>
        </div>
      </div>
      <div style="text-align:end">
        <div style="font-weight:700">${formatPrice(item.price * item.quantity, currency)}</div>
        <button type="button" class="remove-link remove-item">${I18N.t('common.remove', 'Retirer')}</button>
      </div>
    </div>`;
}

function renderCart(currency, defaultDeliveryFee) {
  const items = Cart.getItems();
  const emptyEl = document.getElementById('cart-empty');
  const fullEl = document.getElementById('cart-full');

  if (items.length === 0) {
    emptyEl.hidden = false;
    fullEl.hidden = true;
    return;
  }
  emptyEl.hidden = true;
  fullEl.hidden = false;

  document.getElementById('cart-items-list').innerHTML = items.map((i) => renderCartItem(i, currency)).join('');

  const subtotal = Cart.getSubtotal();
  const deliveryFee = Cart.estimateDeliveryFee(defaultDeliveryFee);
  const total = subtotal + deliveryFee;
  document.getElementById('summary-subtotal').textContent = formatPrice(subtotal, currency);
  document.getElementById('summary-delivery').textContent = formatPrice(deliveryFee, currency);
  document.getElementById('summary-total').textContent = formatPrice(total, currency);
}

document.addEventListener('config:ready', (e) => {
  const config = e.detail;
  renderCart(config.currency, config.defaultDeliveryFee);

  document.getElementById('cart-items-list').addEventListener('click', (evt) => {
    const row = evt.target.closest('.cart-item');
    if (!row) return;
    const productId = Number(row.dataset.productId);
    const variantId = row.dataset.variantId ? Number(row.dataset.variantId) : null;
    const findItem = () => Cart.getItems().find((i) => i.productId === productId && (i.variantId || null) === variantId);

    if (evt.target.closest('.qty-inc')) {
      const item = findItem();
      Cart.updateQuantity(productId, (item?.quantity || 1) + 1, variantId);
      renderCart(config.currency, config.defaultDeliveryFee);
    } else if (evt.target.closest('.qty-dec')) {
      const item = findItem();
      const newQty = (item?.quantity || 1) - 1;
      if (newQty < 1) { Cart.remove(productId, variantId); } else { Cart.updateQuantity(productId, newQty, variantId); }
      renderCart(config.currency, config.defaultDeliveryFee);
    } else if (evt.target.closest('.remove-item')) {
      Cart.remove(productId, variantId);
      renderCart(config.currency, config.defaultDeliveryFee);
      showToast(I18N.t('cart.itemRemoved', 'Produit retiré du panier'));
    }
  });
});
