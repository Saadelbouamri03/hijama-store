// Génère le "bon de commande" imprimable pour une commande donnée : un
// document HTML autonome (aucune dépendance externe), pensé pour être
// imprimé ou enregistré en PDF depuis le navigateur (Cmd/Ctrl+P), envoyé au
// client pour confirmation et/ou au dépôt pour la préparation.

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function formatPrice(amount, currency) {
  const n = Number(amount) || 0;
  const formatted = Number.isInteger(n) ? n.toString() : n.toFixed(2);
  return `${formatted} ${currency || 'DH'}`;
}

function formatPhoneDisplay(raw) {
  const digits = String(raw || '').replace(/[^\d]/g, '');
  return digits ? `+${digits}` : '';
}

function formatDateTime(iso) {
  try {
    return new Date(iso.replace(' ', 'T') + 'Z').toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function renderBonCommande(order, config) {
  const currency = config.currency || 'DH';
  const storePhone = formatPhoneDisplay(config.whatsappNumber);

  const rows = order.items.map((item) => `
    <tr>
      <td>${escapeHtml(item.product_name)}</td>
      <td>${item.variant_label ? escapeHtml(item.variant_label) : '—'}</td>
      <td class="num">${item.quantity}</td>
      <td class="num">${formatPrice(item.unit_price, currency)}</td>
      <td class="num">${formatPrice(item.unit_price * item.quantity, currency)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Bon de commande #${order.id}</title>
<style>
  :root { --moss: #183D32; --clay: #B58A45; --ink: #262D29; --ink-soft: #5B6560; --sand-deep: #D2DCCC; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    color: var(--ink); max-width: 780px; margin: 0 auto; padding: 32px 24px 64px;
    line-height: 1.5;
  }
  .toolbar { display: flex; justify-content: flex-end; gap: 12px; margin-bottom: 24px; }
  .toolbar button {
    font: inherit; font-weight: 700; font-size: 0.9rem; padding: 0.6rem 1.2rem;
    border-radius: 8px; border: 1.5px solid var(--moss); background: var(--moss); color: #fff; cursor: pointer;
  }
  .doc-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 3px solid var(--moss); padding-bottom: 16px; margin-bottom: 24px; }
  .doc-head h1 { font-size: 1.5rem; margin: 0 0 4px; color: var(--moss); }
  .doc-head .tag { font-size: 0.85rem; color: var(--ink-soft); }
  .doc-title { text-align: right; }
  .doc-title .num { font-size: 1.3rem; font-weight: 700; }
  .doc-title .date { font-size: 0.85rem; color: var(--ink-soft); }
  .status-pill {
    display: inline-block; margin-top: 6px; padding: 3px 10px; border-radius: 999px;
    background: var(--sand-deep); font-size: 0.75rem; font-weight: 700; color: var(--ink);
  }
  .block { margin-bottom: 24px; }
  .block h2 { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-soft); margin: 0 0 8px; }
  .block p { margin: 0 0 2px; }
  .client-box { background: #F7F4ED; border-radius: 10px; padding: 16px 18px; }
  .client-box .name { font-weight: 700; font-size: 1.05rem; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th, td { padding: 10px 8px; border-bottom: 1px solid var(--sand-deep); text-align: left; font-size: 0.92rem; }
  th { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.03em; color: var(--ink-soft); border-bottom: 2px solid var(--ink); }
  td.num, th.num { text-align: right; }
  .totals { margin-left: auto; width: 260px; }
  .totals .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 0.92rem; }
  .totals .row.total { border-top: 2px solid var(--ink); font-weight: 700; font-size: 1.1rem; padding-top: 10px; }
  .payment-note {
    background: #F7F4ED; border-radius: 8px; padding: 10px 14px; font-weight: 700; font-size: 0.9rem;
    display: inline-block; margin-top: 8px;
  }
  .comment-box { font-size: 0.9rem; color: var(--ink-soft); font-style: italic; }
  .signoff { display: flex; justify-content: space-between; margin-top: 56px; gap: 24px; }
  .signoff div { flex: 1; border-top: 1px solid var(--ink-soft); padding-top: 6px; font-size: 0.8rem; color: var(--ink-soft); }
  @media print {
    .toolbar { display: none; }
    body { padding: 0; max-width: none; }
  }
</style>
</head>
<body>
  <div class="toolbar no-print">
    <button type="button" onclick="window.print()">Imprimer / Enregistrer en PDF</button>
  </div>

  <div class="doc-head">
    <div>
      <h1>${escapeHtml(config.storeName)}</h1>
      <p class="tag">${storePhone ? `Tél / WhatsApp : ${escapeHtml(storePhone)}` : ''}</p>
    </div>
    <div class="doc-title">
      <div class="num">Bon de commande n° ${order.id}</div>
      <div class="date">${escapeHtml(formatDateTime(order.created_at))}</div>
      <span class="status-pill">${escapeHtml(order.status)}</span>
    </div>
  </div>

  <div class="block">
    <h2>Client</h2>
    <div class="client-box">
      <p class="name">${escapeHtml(order.customer_name)}</p>
      <p>Tél : ${escapeHtml(order.phone)}</p>
      <p>${escapeHtml(order.address)}</p>
      <p>${escapeHtml(order.city)}${order.region ? ' — ' + escapeHtml(order.region) : ''}${order.postal_code ? ' — ' + escapeHtml(order.postal_code) : ''}</p>
    </div>
    ${order.comment ? `<p class="comment-box" style="margin-top:8px">Commentaire client : ${escapeHtml(order.comment)}</p>` : ''}
  </div>

  <div class="block">
    <h2>Produits commandés</h2>
    <table>
      <thead>
        <tr><th>Produit</th><th>Option</th><th class="num">Qté</th><th class="num">Prix unitaire</th><th class="num">Sous-total</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals">
      <div class="row"><span>Sous-total</span><span>${formatPrice(order.subtotal, currency)}</span></div>
      <div class="row"><span>Livraison</span><span>${formatPrice(order.delivery_fee, currency)}</span></div>
      <div class="row total"><span>Total</span><span>${formatPrice(order.total, currency)}</span></div>
    </div>
    <div class="payment-note">${escapeHtml(order.payment_method)}</div>
  </div>

  <div class="signoff">
    <div>Confirmé par le client (signature / accord téléphonique)</div>
    <div>Préparé par le dépôt</div>
  </div>
</body>
</html>`;
}

module.exports = { renderBonCommande };
