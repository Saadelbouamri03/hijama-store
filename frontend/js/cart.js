// Panier client, stocké dans le navigateur (localStorage) : pas besoin de
// compte ni de base de données pour ajouter au panier. Le panier n'est
// envoyé au serveur qu'au moment de la commande (voir checkout.js).

const Cart = (() => {
  const KEY = 'boutique_cart_v1';

  function getItems() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveItems(items, bump = true) {
    localStorage.setItem(KEY, JSON.stringify(items));
    refreshBadge(bump);
  }

  // Une "ligne" de panier est identifiée par productId + variantId (null si
  // le produit n'a pas de variantes), pour que deux tailles/marques du même
  // produit apparaissent comme deux lignes distinctes.
  function sameLine(item, productId, variantId) {
    return item.productId === productId && (item.variantId || null) === (variantId || null);
  }

  function add(product, quantity = 1, variant = null) {
    const items = getItems();
    const variantId = variant ? variant.id : null;
    const existing = items.find((i) => sameLine(i, product.id, variantId));
    const unitPrice = variant ? variant.price : product.price;
    const maxQty = (variant ? variant.stock : product.stock) ?? 99;
    if (existing) {
      existing.quantity = Math.min(existing.quantity + quantity, maxQty);
    } else {
      items.push({
        productId: product.id,
        variantId,
        variantLabel: variant ? variant.label : '',
        name: product.name,
        slug: product.slug,
        price: unitPrice,
        image: (product.images && product.images[0]) || '',
        stock: maxQty,
        quantity: Math.min(quantity, maxQty),
      });
    }
    saveItems(items);
    return items;
  }

  function updateQuantity(productId, quantity, variantId = null) {
    let items = getItems();
    items = items.map((i) => {
      if (!sameLine(i, productId, variantId)) return i;
      return { ...i, quantity: Math.max(1, Math.min(quantity, i.stock ?? 99)) };
    });
    saveItems(items);
    return items;
  }

  function remove(productId, variantId = null) {
    const items = getItems().filter((i) => !sameLine(i, productId, variantId));
    saveItems(items);
    return items;
  }

  function clear() {
    localStorage.removeItem(KEY);
    refreshBadge();
  }

  function getCount() {
    return getItems().reduce((sum, i) => sum + i.quantity, 0);
  }

  function getSubtotal() {
    return getItems().reduce((sum, i) => sum + i.price * i.quantity, 0);
  }

  function refreshBadge(bump = false) {
    const badge = document.getElementById('cart-count');
    if (badge) {
      const count = getCount();
      badge.textContent = count;
      badge.hidden = count === 0;
      if (bump) {
        // relance la petite pulsation même si la classe était déjà posée
        badge.classList.remove('bump');
        void badge.offsetWidth;
        badge.classList.add('bump');
      }
    }
    if (window.MiniCart) window.MiniCart.sync();
  }

  document.addEventListener('partials:ready', () => refreshBadge(false));

  return { getItems, add, updateQuantity, remove, clear, getCount, getSubtotal, refreshBadge };
})();

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('show'), 2600);
}
