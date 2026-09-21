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
        categorySlug: product.category_slug || '',
      });
    }
    saveItems(items);

    if (typeof fbq === 'function') {
      fbq('track', 'AddToCart', {
        value: unitPrice * quantity,
        currency: 'MAD',
        contents: [{ id: product.id, quantity }],
        content_type: 'product',
        content_name: product.name,
      });
    }

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

  // Même règle que le calcul définitif côté serveur (voir computeDeliveryFee
  // dans backend/routes/orders.js) : mobilier (chaque unité = son propre
  // colis), produits vendus par boîte (10 boîtes par colis, le reste du
  // panier profite de la place libre du dernier colis s'il en reste), sinon
  // 1 colis partagé pour tout le reste. Affichée en estimation avant
  // validation (panier, checkout) ; le total qui compte reste celui renvoyé
  // par le serveur à la création de la commande.
  const BOX_UNITS_PER_PARCEL = 10;
  function isBoxedItem(name) {
    return /\(\d+\s*(?:كأس|قطعة|pièces?|pcs?)\)/i.test(String(name || ''));
  }
  function estimateDeliveryFee(baseFee, itemsOverride = null) {
    let furnitureUnits = 0;
    let boxUnits = 0;
    let hasOtherItems = false;

    (itemsOverride || getItems()).forEach((i) => {
      if (i.categorySlug === 'athath-tajhizat') furnitureUnits += i.quantity;
      else if (isBoxedItem(i.name)) boxUnits += i.quantity;
      else hasOtherItems = true;
    });

    const boxParcels = boxUnits > 0 ? Math.ceil(boxUnits / BOX_UNITS_PER_PARCEL) : 0;
    const boxHasSpareRoom = boxUnits > 0 && boxUnits % BOX_UNITS_PER_PARCEL !== 0;
    const otherNeedsOwnParcel = hasOtherItems && !boxHasSpareRoom;

    const parcelCount = furnitureUnits + boxParcels + (otherNeedsOwnParcel ? 1 : 0);
    return baseFee * Math.max(1, parcelCount);
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
    // "MiniCart" (déclaré avec const dans mini-cart.js) est visible ici par
    // son nom simple — les scripts classiques d'une même page partagent le
    // même environnement global pour let/const — mais jamais via window.MiniCart
    // (const n'attache rien à window) : c'était le bug, sync() n'était donc
    // jamais réellement appelée.
    if (typeof MiniCart !== 'undefined') MiniCart.sync();
  }

  document.addEventListener('partials:ready', () => refreshBadge(false));

  return { getItems, add, updateQuantity, remove, clear, getCount, getSubtotal, estimateDeliveryFee, refreshBadge };
})();

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('show'), 2600);
}
