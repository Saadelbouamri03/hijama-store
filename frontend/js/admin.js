// Tableau de bord admin. Toutes les routes appelées ici sont protégées
// côté serveur (voir backend/middleware/auth.js) : même si quelqu'un
// ouvrait cette page sans être connecté, aucune donnée ne serait renvoyée.

let ADMIN_CURRENCY = 'DH';
let ADMIN_WHATSAPP = '';

// Résumé de commande prêt à envoyer sur WhatsApp (conversation avec soi-même,
// un seul clic — voir aussi backend/utils/notify.js pour la version email).
function whatsappOrderLink(o) {
  if (!ADMIN_WHATSAPP) return null;
  const productsLine = (o.items || [])
    .map((i) => `- ${i.product_name}${i.variant_label ? ' (' + i.variant_label + ')' : ''} x${i.quantity}`)
    .join('\n');
  const text = `Commande #${o.id}\n${o.customer_name} — ${o.phone}\n${o.address}, ${o.city}\n\n${productsLine}\n\nTotal : ${o.total} ${ADMIN_CURRENCY}`;
  return Api.whatsappLink(ADMIN_WHATSAPP, text);
}
const ORDER_STATUSES = ['Nouvelle commande', 'Confirmée', 'Préparation', 'Expédiée', 'Livrée', 'Annulée'];

// ---------- Notification ----------
// Même comportement que dans cart.js, redéfini ici car cart.js n'est pas
// chargé sur les pages admin (le panier n'a pas de sens côté admin).
function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('show'), 2600);
}

// ---------- Dates ----------
// SQLite (datetime('now')) renvoie l'heure UTC au format "AAAA-MM-JJ HH:MM:SS"
// sans fuseau horaire. On ajoute "T" + "Z" pour que le navigateur l'interprète
// correctement comme de l'UTC (sinon certains navigateurs supposent l'heure
// locale, ce qui décale l'affichage selon le fuseau du visiteur).
function toDate(sqliteDateStr) {
  return new Date(String(sqliteDateStr).replace(' ', 'T') + 'Z');
}
function formatDate(sqliteDateStr) {
  return toDate(sqliteDateStr).toLocaleDateString('fr-FR');
}
function formatDateTime(sqliteDateStr) {
  return toDate(sqliteDateStr).toLocaleString('fr-FR');
}

// ---------- Authentification / mise en place ----------
async function checkAuth() {
  const session = await Api.get('/api/admin/session');
  if (!session.isAdmin) {
    window.location.href = '/admin/login';
    return false;
  }
  return true;
}

document.getElementById('logout-btn').addEventListener('click', async () => {
  await Api.post('/api/admin/logout', {});
  window.location.href = '/admin/login';
});

function wireTabs() {
  document.querySelectorAll('.admin-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.admin-panel').forEach((p) => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`panel-${tab.dataset.panel}`).classList.add('active');
    });
  });
}

// ---------- Modale générique ----------
const backdrop = document.getElementById('modal-backdrop');
const modalBox = document.getElementById('modal-box');
function openModal(html) {
  modalBox.innerHTML = html;
  backdrop.classList.add('open');
}
function closeModal() {
  backdrop.classList.remove('open');
  modalBox.innerHTML = '';
}
backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });

// ================= VUE D'ENSEMBLE =================
async function loadOverview() {
  const s = await Api.get('/api/stats');
  document.getElementById('stat-grid').innerHTML = `
    <div class="stat-card"><span class="num">${s.totalOrders}</span><span class="label">Commandes totales</span></div>
    <div class="stat-card alert"><span class="num">${s.newOrders}</span><span class="label">Nouvelles commandes</span></div>
    <div class="stat-card"><span class="num">${s.confirmedOrders}</span><span class="label">Confirmées</span></div>
    <div class="stat-card"><span class="num">${s.deliveredOrders}</span><span class="label">Livrées</span></div>
    <div class="stat-card"><span class="num">${formatPrice(s.revenue, ADMIN_CURRENCY)}</span><span class="label">Chiffre d'affaires (hors annulées)</span></div>
    <div class="stat-card"><span class="num">${s.productCount}</span><span class="label">Produits actifs</span></div>
    <div class="stat-card"><span class="num">${s.preparingOrders}</span><span class="label">En préparation</span></div>
    <div class="stat-card"><span class="num">${s.shippedOrders}</span><span class="label">Expédiées</span></div>
  `;
  const lowStockBlock = document.getElementById('low-stock-block');
  if (s.lowStockCount > 0) {
    lowStockBlock.innerHTML = `
      <div class="admin-toolbar"><h2>Stock faible</h2></div>
      <div class="table-wrap"><table class="admin-table">
        <thead><tr><th>Produit</th><th>Stock restant</th></tr></thead>
        <tbody>${s.lowStockProducts.map((p) => `<tr><td>${escapeHtml(p.name)}</td><td>${p.stock}</td></tr>`).join('')}</tbody>
      </table></div>`;
  } else {
    lowStockBlock.innerHTML = '';
  }
}

// ================= COMMANDES =================
async function loadOrders() {
  const status = document.getElementById('order-status-filter').value;
  const orders = await Api.get(`/api/orders${status ? `?status=${encodeURIComponent(status)}` : ''}`);
  const tbody = document.getElementById('orders-tbody');
  if (!orders.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="7">Aucune commande.</td></tr>';
    return;
  }
  tbody.innerHTML = orders.map((o) => `
    <tr>
      <td>#${o.id}</td>
      <td>${formatDate(o.created_at)}</td>
      <td>${escapeHtml(o.customer_name)}</td>
      <td>${escapeHtml(o.city)}</td>
      <td>${formatPrice(o.total, ADMIN_CURRENCY)}</td>
      <td>
        <select class="status-select" data-order-id="${o.id}" data-status="${o.status}">
          ${ORDER_STATUSES.map((s) => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </td>
      <td class="row-actions">
        <button class="icon-btn view-order-btn" data-order-id="${o.id}">Détail</button>
        <a class="icon-btn" href="/api/orders/${o.id}/bon-commande" target="_blank" rel="noopener">Bon de commande</a>
        <a class="icon-btn" href="/api/orders/${o.id}/bon-commande.pdf" target="_blank" rel="noopener">PDF</a>
        <button class="icon-btn danger delete-order-btn" data-order-id="${o.id}">Supprimer</button>
      </td>
    </tr>`).join('');

  tbody.querySelectorAll('.delete-order-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm(`Supprimer définitivement la commande #${btn.dataset.orderId} ? Cette action est irréversible.`)) return;
      try {
        await Api.del(`/api/orders/${btn.dataset.orderId}`);
        showToast(`Commande #${btn.dataset.orderId} supprimée`);
        loadOrders();
        loadOverview();
      } catch (err) {
        showToast(err.message);
      }
    });
  });

  tbody.querySelectorAll('.status-select').forEach((sel) => {
    sel.addEventListener('change', async () => {
      try {
        await Api.put(`/api/orders/${sel.dataset.orderId}/status`, { status: sel.value });
        sel.dataset.status = sel.value;
        showToast(`Commande #${sel.dataset.orderId} mise à jour`);
        loadOverview();
      } catch (err) {
        showToast(err.message);
      }
    });
  });
  tbody.querySelectorAll('.view-order-btn').forEach((btn) => {
    btn.addEventListener('click', () => openOrderDetail(btn.dataset.orderId));
  });
}

async function openOrderDetail(id) {
  const o = await Api.get(`/api/orders/${id}`);
  openModal(`
    <button class="modal-close" data-close>&times;</button>
    <h2>Commande #${o.id}</h2>
    <p class="hint">${formatDateTime(o.created_at)}</p>
    <p><strong>${escapeHtml(o.customer_name)}</strong> — ${escapeHtml(o.phone)}</p>
    <p>${escapeHtml(o.address)}, ${escapeHtml(o.city)} ${o.region ? '(' + escapeHtml(o.region) + ')' : ''} ${o.postal_code ? escapeHtml(o.postal_code) : ''}</p>
    ${o.comment ? `<p class="hint">Commentaire : ${escapeHtml(o.comment)}</p>` : ''}
    <div class="table-wrap" style="margin: var(--space-4) 0">
      <table class="admin-table">
        <thead><tr><th>Produit</th><th>Qté</th><th>Prix</th></tr></thead>
        <tbody>${o.items.map((i) => `<tr><td>${escapeHtml(i.product_name)}${i.variant_label ? ' — ' + escapeHtml(i.variant_label) : ''}</td><td>${i.quantity}</td><td>${formatPrice(i.unit_price * i.quantity, ADMIN_CURRENCY)}</td></tr>`).join('')}</tbody>
      </table>
    </div>
    <div class="summary-row"><span>Sous-total</span><span>${formatPrice(o.subtotal, ADMIN_CURRENCY)}</span></div>
    <div class="summary-row"><span>Livraison</span><span>${formatPrice(o.delivery_fee, ADMIN_CURRENCY)}</span></div>
    <div class="summary-row total"><span>Total</span><span>${formatPrice(o.total, ADMIN_CURRENCY)}</span></div>
    <a href="/api/orders/${o.id}/bon-commande" target="_blank" rel="noopener" class="btn btn-primary btn-block" style="margin-top: var(--space-4)">Ouvrir le bon de commande (à imprimer / envoyer)</a>
    <a href="/api/orders/${o.id}/bon-commande.pdf" target="_blank" rel="noopener" class="btn btn-outline btn-block" style="margin-top: var(--space-2)">Télécharger en PDF</a>
    ${whatsappOrderLink(o) ? `<a href="${whatsappOrderLink(o)}" target="_blank" rel="noopener" class="btn btn-whatsapp btn-block" style="margin-top: var(--space-2)">Envoyer sur WhatsApp</a>` : ''}
    <button type="button" class="btn btn-outline btn-block danger" id="modal-delete-order-btn" style="margin-top: var(--space-4)">Supprimer cette commande</button>
  `);
  document.getElementById('modal-delete-order-btn').addEventListener('click', async () => {
    if (!confirm(`Supprimer définitivement la commande #${o.id} ? Cette action est irréversible.`)) return;
    try {
      await Api.del(`/api/orders/${o.id}`);
      showToast(`Commande #${o.id} supprimée`);
      closeModal();
      loadOrders();
      loadOverview();
    } catch (err) {
      showToast(err.message);
    }
  });
  wireModalClose();
}

function wireModalClose() {
  modalBox.querySelectorAll('[data-close]').forEach((btn) => btn.addEventListener('click', closeModal));
}

// ================= PRODUITS =================
let categoriesCache = [];

async function loadProducts() {
  const products = await Api.get('/api/products?includeInactive=1');
  const tbody = document.getElementById('products-tbody');
  if (!products.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="7">Aucun produit. Ajoutez votre premier produit ci-dessus.</td></tr>';
    return;
  }
  tbody.innerHTML = products.map((p) => `
    <tr>
      <td><img class="thumb" src="${productImageSrc(p)}" alt=""></td>
      <td>${escapeHtml(p.name)}</td>
      <td>${escapeHtml(p.category_name || '—')}</td>
      <td>${formatPrice(p.price, ADMIN_CURRENCY)}</td>
      <td>${p.stock}</td>
      <td>${p.active ? 'Actif' : 'Masqué'}</td>
      <td class="row-actions">
        <button class="icon-btn edit-product-btn" data-id="${p.id}">Modifier</button>
        <button class="icon-btn danger delete-product-btn" data-id="${p.id}">Supprimer</button>
      </td>
    </tr>`).join('');

  tbody.querySelectorAll('.edit-product-btn').forEach((btn) => btn.addEventListener('click', () => openProductForm(Number(btn.dataset.id))));
  tbody.querySelectorAll('.delete-product-btn').forEach((btn) => btn.addEventListener('click', () => deleteProduct(Number(btn.dataset.id))));
}

async function deleteProduct(id) {
  if (!confirm('Supprimer ce produit ? Cette action est définitive.')) return;
  try {
    await Api.del(`/api/products/${id}`);
    showToast('Produit supprimé');
    loadProducts();
  } catch (err) { showToast(err.message); }
}

async function openProductForm(id = null) {
  const isEdit = id !== null;
  const product = isEdit ? await Api.get(`/api/products/${id}`) : null;
  if (!categoriesCache.length) categoriesCache = await Api.get('/api/categories');
  let existingImages = isEdit ? [...product.images] : [];
  let variantRows = isEdit && Array.isArray(product.variants)
    ? product.variants.map((v) => ({ label: v.label, price: v.price, stock: v.stock }))
    : [];

  openModal(`
    <button class="modal-close" data-close>&times;</button>
    <h2>${isEdit ? 'Modifier le produit' : 'Ajouter un produit'}</h2>
    <form id="product-form">
      <div class="field"><label for="p-name">Nom du produit</label>
        <input type="text" id="p-name" required value="${isEdit ? escapeHtml(product.name) : ''}"></div>
      <div class="field"><label for="p-description">Description</label>
        <textarea id="p-description" rows="3">${isEdit ? escapeHtml(product.description) : ''}</textarea></div>
      <div class="field-row field-row-2">
        <div class="field"><label for="p-price">Prix (${ADMIN_CURRENCY})</label>
          <input type="number" id="p-price" min="0" step="0.01" required value="${isEdit ? product.price : ''}"></div>
        <div class="field"><label for="p-old-price">Ancien prix <span class="hint">(facultatif)</span></label>
          <input type="number" id="p-old-price" min="0" step="0.01" value="${isEdit && product.old_price ? product.old_price : ''}"></div>
      </div>
      <div class="field-row field-row-2">
        <div class="field"><label for="p-category">Catégorie</label>
          <select id="p-category">
            <option value="">— Aucune —</option>
            ${categoriesCache.map((c) => `<option value="${c.id}" ${isEdit && product.category_id === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
          </select></div>
        <div class="field"><label for="p-stock">Stock</label>
          <input type="number" id="p-stock" min="0" step="1" required value="${isEdit ? product.stock : 0}"></div>
      </div>

      <div class="field">
        <label>Photos</label>
        <div class="image-thumb-row" id="existing-images-row"></div>
        <input type="file" id="p-images" accept="image/png,image/jpeg,image/webp,image/gif" multiple>
        <p class="hint">Formats acceptés : jpg, png, webp, gif — 5 Mo max par image, 6 images max.</p>
      </div>

      <div class="field">
        <label for="p-video">Vidéo du produit <span class="hint">(facultatif — lien YouTube, Vimeo ou fichier .mp4)</span></label>
        <input type="text" id="p-video" placeholder="https://..." value="${isEdit ? escapeHtml(product.video_url || '') : ''}">
        <p class="hint">Laissez vide pour ne pas afficher de section vidéo sur la fiche produit.</p>
      </div>

      <div class="checkbox-row"><input type="checkbox" id="p-badge-new" ${isEdit && product.badge_new ? 'checked' : ''}><label for="p-badge-new">Marquer comme "Nouveau"</label></div>
      <div class="checkbox-row"><input type="checkbox" id="p-badge-best" ${isEdit && product.badge_bestseller ? 'checked' : ''}><label for="p-badge-best">Marquer comme "Meilleure vente"</label></div>
      <div class="checkbox-row"><input type="checkbox" id="p-active" ${!isEdit || product.active ? 'checked' : ''}><label for="p-active">Visible sur le site</label></div>

      <div class="field" style="margin-top: var(--space-4)">
        <label>Variantes <span class="hint">(facultatif — ex. tailles ou marques différentes, chacune avec son prix et son stock)</span></label>
        <div id="variant-rows"></div>
        <button type="button" class="btn btn-outline btn-sm" id="add-variant-row">+ Ajouter une variante</button>
        <p class="hint">Si vous ajoutez des variantes, mettez ici le prix "Prix" du produit au niveau le plus bas parmi elles : c'est ce prix qui s'affiche dans le catalogue avant que le client ait choisi une option.</p>
      </div>

      <button type="submit" class="btn btn-primary btn-block">${isEdit ? 'Enregistrer les modifications' : 'Ajouter le produit'}</button>
    </form>
  `);
  wireModalClose();

  function renderVariantRows() {
    const container = document.getElementById('variant-rows');
    if (!variantRows.length) {
      container.innerHTML = '<p class="hint">Aucune variante — le produit se vend au prix/stock ci-dessus.</p>';
      return;
    }
    container.innerHTML = variantRows.map((v, i) => `
      <div class="field-row field-row-3" data-variant-row="${i}" style="align-items:flex-end; margin-bottom: var(--space-2)">
        <div class="field"><label>Nom (ex. "6 cm")</label><input type="text" class="v-label" value="${escapeHtml(v.label || '')}"></div>
        <div class="field"><label>Prix (${ADMIN_CURRENCY})</label><input type="number" class="v-price" min="0" step="0.01" value="${v.price ?? ''}"></div>
        <div class="field"><label>Stock</label><input type="number" class="v-stock" min="0" step="1" value="${v.stock ?? 0}"></div>
        <button type="button" class="icon-btn danger remove-variant-row" data-idx="${i}" aria-label="Supprimer cette variante">&times;</button>
      </div>`).join('');

    container.querySelectorAll('[data-variant-row]').forEach((row) => {
      const i = Number(row.dataset.variantRow);
      row.querySelector('.v-label').addEventListener('input', (e) => { variantRows[i].label = e.target.value; });
      row.querySelector('.v-price').addEventListener('input', (e) => { variantRows[i].price = e.target.value; });
      row.querySelector('.v-stock').addEventListener('input', (e) => { variantRows[i].stock = e.target.value; });
    });
    container.querySelectorAll('.remove-variant-row').forEach((btn) => {
      btn.addEventListener('click', () => {
        variantRows.splice(Number(btn.dataset.idx), 1);
        renderVariantRows();
      });
    });
  }
  renderVariantRows();
  document.getElementById('add-variant-row').addEventListener('click', () => {
    variantRows.push({ label: '', price: '', stock: 0 });
    renderVariantRows();
  });

  function renderExistingThumbs() {
    document.getElementById('existing-images-row').innerHTML = existingImages.map((img, i) => `
      <div class="image-thumb"><img src="/images/products/${img}" alt=""><button type="button" data-remove-idx="${i}">&times;</button></div>
    `).join('');
    document.querySelectorAll('[data-remove-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        existingImages.splice(Number(btn.dataset.removeIdx), 1);
        renderExistingThumbs();
      });
    });
  }
  renderExistingThumbs();

  document.getElementById('product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append('name', document.getElementById('p-name').value.trim());
    fd.append('description', document.getElementById('p-description').value.trim());
    fd.append('price', document.getElementById('p-price').value);
    fd.append('old_price', document.getElementById('p-old-price').value);
    fd.append('category_id', document.getElementById('p-category').value);
    fd.append('stock', document.getElementById('p-stock').value);
    fd.append('video_url', document.getElementById('p-video').value.trim());
    fd.append('badge_new', document.getElementById('p-badge-new').checked ? '1' : '0');
    fd.append('badge_bestseller', document.getElementById('p-badge-best').checked ? '1' : '0');
    fd.append('active', document.getElementById('p-active').checked ? '1' : '0');
    fd.append('keepImages', JSON.stringify(existingImages));
    fd.append('variants', JSON.stringify(variantRows));
    const files = document.getElementById('p-images').files;
    for (const f of files) fd.append('images', f);

    try {
      if (isEdit) await Api.put(`/api/products/${id}`, fd);
      else await Api.post('/api/products', fd);
      showToast('Produit enregistré');
      closeModal();
      loadProducts();
      loadOverview();
    } catch (err) {
      showToast(err.message);
    }
  });
}

// ================= CATEGORIES =================
async function loadCategories() {
  categoriesCache = await Api.get('/api/categories');
  const tbody = document.getElementById('categories-tbody');
  if (!categoriesCache.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="4">Aucune catégorie.</td></tr>';
    return;
  }
  tbody.innerHTML = categoriesCache.map((c) => `
    <tr>
      <td>${escapeHtml(c.name)}</td>
      <td>${escapeHtml(c.description || '—')}</td>
      <td>${c.display_order}</td>
      <td class="row-actions">
        <button class="icon-btn edit-cat-btn" data-id="${c.id}">Modifier</button>
        <button class="icon-btn danger delete-cat-btn" data-id="${c.id}">Supprimer</button>
      </td>
    </tr>`).join('');

  tbody.querySelectorAll('.edit-cat-btn').forEach((btn) => btn.addEventListener('click', () => openCategoryForm(Number(btn.dataset.id))));
  tbody.querySelectorAll('.delete-cat-btn').forEach((btn) => btn.addEventListener('click', () => deleteCategory(Number(btn.dataset.id))));
}

async function deleteCategory(id) {
  if (!confirm('Supprimer cette catégorie ?')) return;
  try {
    await Api.del(`/api/categories/${id}`);
    showToast('Catégorie supprimée');
    loadCategories();
  } catch (err) { showToast(err.message); }
}

function openCategoryForm(id = null) {
  const isEdit = id !== null;
  const cat = isEdit ? categoriesCache.find((c) => c.id === id) : null;
  openModal(`
    <button class="modal-close" data-close>&times;</button>
    <h2>${isEdit ? 'Modifier la catégorie' : 'Ajouter une catégorie'}</h2>
    <form id="category-form">
      <div class="field"><label for="c-name">Nom</label><input type="text" id="c-name" required value="${isEdit ? escapeHtml(cat.name) : ''}"></div>
      <div class="field"><label for="c-description">Description</label><textarea id="c-description" rows="2">${isEdit ? escapeHtml(cat.description) : ''}</textarea></div>
      <div class="field"><label for="c-image">Fichier image <span class="hint">(facultatif, dans frontend/images/categories/)</span></label>
        <input type="text" id="c-image" placeholder="category-exemple.svg" value="${isEdit ? escapeHtml(cat.image || '') : ''}"></div>
      <div class="field"><label for="c-order">Ordre d'affichage</label><input type="number" id="c-order" value="${isEdit ? cat.display_order : 0}"></div>
      <button type="submit" class="btn btn-primary btn-block">Enregistrer</button>
    </form>
  `);
  wireModalClose();
  document.getElementById('category-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById('c-name').value.trim(),
      description: document.getElementById('c-description').value.trim(),
      image: document.getElementById('c-image').value.trim(),
      display_order: Number(document.getElementById('c-order').value) || 0,
    };
    try {
      if (isEdit) await Api.put(`/api/categories/${id}`, payload);
      else await Api.post('/api/categories', payload);
      showToast('Catégorie enregistrée');
      closeModal();
      loadCategories();
    } catch (err) { showToast(err.message); }
  });
}

// ================= AVIS =================
let reviewsCache = [];
async function loadReviews() {
  reviewsCache = await Api.get('/api/reviews?all=1');
  const tbody = document.getElementById('reviews-tbody');
  if (!reviewsCache.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="6">Aucun avis.</td></tr>';
    return;
  }
  tbody.innerHTML = reviewsCache.map((r) => `
    <tr>
      <td>${escapeHtml(r.customer_name)}</td>
      <td>${starString(r.rating)}</td>
      <td>${escapeHtml(r.comment).slice(0, 60)}${r.comment.length > 60 ? '…' : ''}</td>
      <td>${r.is_demo ? 'DEMO' : 'Réel'}</td>
      <td>${r.active ? 'Oui' : 'Non'}</td>
      <td class="row-actions">
        <button class="icon-btn edit-review-btn" data-id="${r.id}">Modifier</button>
        <button class="icon-btn danger delete-review-btn" data-id="${r.id}">Supprimer</button>
      </td>
    </tr>`).join('');
  tbody.querySelectorAll('.edit-review-btn').forEach((btn) => btn.addEventListener('click', () => openReviewForm(Number(btn.dataset.id))));
  tbody.querySelectorAll('.delete-review-btn').forEach((btn) => btn.addEventListener('click', () => deleteReview(Number(btn.dataset.id))));
}

async function deleteReview(id) {
  if (!confirm('Supprimer cet avis ?')) return;
  try {
    await Api.del(`/api/reviews/${id}`);
    showToast('Avis supprimé');
    loadReviews();
  } catch (err) { showToast(err.message); }
}

function openReviewForm(id = null) {
  const isEdit = id !== null;
  const review = isEdit ? reviewsCache.find((r) => r.id === id) : null;
  openModal(`
    <button class="modal-close" data-close>&times;</button>
    <h2>${isEdit ? "Modifier l'avis" : 'Ajouter un avis'}</h2>
    <form id="review-form">
      <div class="field"><label for="r-name">Nom du client</label><input type="text" id="r-name" required value="${isEdit ? escapeHtml(review.customer_name) : ''}"></div>
      <div class="field"><label for="r-rating">Note</label>
        <select id="r-rating">${[5, 4, 3, 2, 1].map((n) => `<option value="${n}" ${isEdit && review.rating === n ? 'selected' : ''}>${n} étoile${n > 1 ? 's' : ''}</option>`).join('')}</select></div>
      <div class="field"><label for="r-comment">Commentaire</label><textarea id="r-comment" rows="3" required>${isEdit ? escapeHtml(review.comment) : ''}</textarea></div>
      <div class="checkbox-row"><input type="checkbox" id="r-demo" ${!isEdit || review.is_demo ? 'checked' : ''}><label for="r-demo">Avis DEMO (contenu d'exemple, pas un vrai client)</label></div>
      <div class="checkbox-row"><input type="checkbox" id="r-active" ${!isEdit || review.active ? 'checked' : ''}><label for="r-active">Visible sur le site</label></div>
      <button type="submit" class="btn btn-primary btn-block">Enregistrer</button>
    </form>
  `);
  wireModalClose();
  document.getElementById('review-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      customer_name: document.getElementById('r-name').value.trim(),
      rating: Number(document.getElementById('r-rating').value),
      comment: document.getElementById('r-comment').value.trim(),
      is_demo: document.getElementById('r-demo').checked,
      active: document.getElementById('r-active').checked,
    };
    try {
      if (isEdit) await Api.put(`/api/reviews/${id}`, payload);
      else await Api.post('/api/reviews', payload);
      showToast('Avis enregistré');
      closeModal();
      loadReviews();
    } catch (err) { showToast(err.message); }
  });
}

// ================= LIVRAISON =================
let deliveryCache = [];
async function loadDelivery() {
  const res = await Api.get('/api/delivery-fees');
  deliveryCache = res.fees;
  const tbody = document.getElementById('delivery-tbody');
  if (!deliveryCache.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="3">Aucune ville personnalisée pour le moment.</td></tr>';
    return;
  }
  tbody.innerHTML = deliveryCache.map((f) => `
    <tr>
      <td>${escapeHtml(f.city)}</td>
      <td>${formatPrice(f.fee, ADMIN_CURRENCY)}</td>
      <td class="row-actions">
        <button class="icon-btn edit-fee-btn" data-id="${f.id}">Modifier</button>
        <button class="icon-btn danger delete-fee-btn" data-id="${f.id}">Supprimer</button>
      </td>
    </tr>`).join('');
  tbody.querySelectorAll('.edit-fee-btn').forEach((btn) => btn.addEventListener('click', () => openFeeForm(Number(btn.dataset.id))));
  tbody.querySelectorAll('.delete-fee-btn').forEach((btn) => btn.addEventListener('click', () => deleteFee(Number(btn.dataset.id))));
}

async function deleteFee(id) {
  if (!confirm('Supprimer cette ville ?')) return;
  try {
    await Api.del(`/api/delivery-fees/${id}`);
    showToast('Ville supprimée');
    loadDelivery();
  } catch (err) { showToast(err.message); }
}

function openFeeForm(id = null) {
  const isEdit = id !== null;
  const fee = isEdit ? deliveryCache.find((f) => f.id === id) : null;
  openModal(`
    <button class="modal-close" data-close>&times;</button>
    <h2>${isEdit ? 'Modifier la ville' : 'Ajouter une ville'}</h2>
    <form id="fee-form">
      <div class="field"><label for="f-city">Ville</label><input type="text" id="f-city" required value="${isEdit ? escapeHtml(fee.city) : ''}"></div>
      <div class="field"><label for="f-fee">Frais de livraison (${ADMIN_CURRENCY})</label><input type="number" id="f-fee" min="0" step="0.01" required value="${isEdit ? fee.fee : ''}"></div>
      <button type="submit" class="btn btn-primary btn-block">Enregistrer</button>
    </form>
  `);
  wireModalClose();
  document.getElementById('fee-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = { city: document.getElementById('f-city').value.trim(), fee: parseFloat(document.getElementById('f-fee').value) };
    try {
      if (isEdit) await Api.put(`/api/delivery-fees/${id}`, payload);
      else await Api.post('/api/delivery-fees', payload);
      showToast('Frais de livraison enregistrés');
      closeModal();
      loadDelivery();
    } catch (err) { showToast(err.message); }
  });
}

// ================= INITIALISATION =================
(async function init() {
  const ok = await checkAuth();
  if (!ok) return;

  const config = await Api.getConfig();
  ADMIN_CURRENCY = config.currency;
  ADMIN_WHATSAPP = config.whatsappNumber;
  document.getElementById('admin-store-name').textContent = config.storeName;

  wireTabs();
  document.getElementById('add-product-btn').addEventListener('click', () => openProductForm());
  document.getElementById('add-category-btn').addEventListener('click', () => openCategoryForm());
  document.getElementById('add-review-btn').addEventListener('click', () => openReviewForm());
  document.getElementById('add-fee-btn').addEventListener('click', () => openFeeForm());
  document.getElementById('order-status-filter').addEventListener('change', loadOrders);

  await Promise.all([loadOverview(), loadOrders(), loadProducts(), loadCategories(), loadReviews(), loadDelivery()]);
})();
