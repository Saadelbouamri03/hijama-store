// Génère un export CSV des commandes, compatible avec Excel.
// - Séparateur ";" (le séparateur reconnu automatiquement par Excel en français,
//   la "," étant déjà utilisée comme séparateur décimal).
// - Un BOM UTF-8 est ajouté en tête de fichier pour que les accents
//   (é, è, à...) s'affichent correctement à l'ouverture dans Excel.

function escapeCsvField(value) {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[";\n\r]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function toCsv(rows, columns) {
  // columns: [{ key, label }]
  const header = columns.map((c) => escapeCsvField(c.label)).join(';');
  const lines = rows.map((row) =>
    columns.map((c) => escapeCsvField(row[c.key])).join(';')
  );
  return '\uFEFF' + [header, ...lines].join('\r\n') + '\r\n';
}

const ORDER_COLUMNS = [
  { key: 'id', label: 'ID commande' },
  { key: 'date', label: 'Date' },
  { key: 'name', label: 'Nom' },
  { key: 'phone', label: 'Téléphone' },
  { key: 'city', label: 'Ville' },
  { key: 'address', label: 'Adresse' },
  { key: 'products', label: 'Produits' },
  { key: 'quantities', label: 'Quantités' },
  { key: 'total', label: 'Total' },
  { key: 'payment', label: 'Paiement' },
  { key: 'status', label: 'Statut' },
  { key: 'comment', label: 'Commentaire' },
];

// ordersWithItems : tableau d'objets commande, chacun avec une propriété .items (tableau)
function ordersToCsv(ordersWithItems) {
  const rows = ordersWithItems.map((order) => ({
    id: order.id,
    date: order.created_at,
    name: order.customer_name,
    phone: order.phone,
    city: order.city,
    address: order.address,
    products: order.items.map((it) => it.product_name + (it.variant_label ? ` (${it.variant_label})` : '')).join(', '),
    quantities: order.items.map((it) => `${it.product_name}${it.variant_label ? ' (' + it.variant_label + ')' : ''} x${it.quantity}`).join(', '),
    total: order.total,
    payment: order.payment_method,
    status: order.status,
    comment: order.comment,
  }));
  return toCsv(rows, ORDER_COLUMNS);
}

module.exports = { toCsv, ordersToCsv, escapeCsvField };
