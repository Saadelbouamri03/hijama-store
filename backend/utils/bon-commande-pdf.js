// Génère le "bon de commande" en PDF réel (pièce jointe email), avec pdfkit
// (pas de navigateur/Chromium nécessaire — léger, rapide, marche partout).
// Le rendu HTML équivalent (backend/utils/bon-commande.js) reste la version
// à l'écran/à imprimer depuis l'admin ; ce fichier ne fait que la mise en
// page façon PDF, plus sobre (pas de mise en page CSS possible avec pdfkit).

const PDFDocument = require('pdfkit');

const MOSS = '#183D32';
const CLAY = '#B58A45';
const INK = '#262D29';
const INK_SOFT = '#5B6560';
const SAND = '#D2DCCC';

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

// Retourne un Buffer contenant le PDF (utilisable en pièce jointe email ou
// envoyé directement en réponse HTTP).
function generateBonCommandePdf(order, config) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 44 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const currency = config.currency || 'DH';
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const left = doc.page.margins.left;

    // ---------- En-tête ----------
    doc.fillColor(MOSS).font('Helvetica-Bold').fontSize(20).text(config.storeName, left, 44);
    const storePhone = formatPhoneDisplay(config.whatsappNumber);
    if (storePhone) {
      doc.fillColor(INK_SOFT).font('Helvetica').fontSize(10).text(`Tél / WhatsApp : ${storePhone}`, left, 68);
    }

    doc.fillColor(INK).font('Helvetica-Bold').fontSize(13).text(`Bon de commande n° ${order.id}`, left, 44, { width: pageWidth, align: 'right' });
    doc.fillColor(INK_SOFT).font('Helvetica').fontSize(10)
      .text(formatDateTime(order.created_at), left, 62, { width: pageWidth, align: 'right' })
      .text(order.status, left, 76, { width: pageWidth, align: 'right' });

    doc.moveTo(left, 100).lineTo(left + pageWidth, 100).lineWidth(2).strokeColor(MOSS).stroke();

    // ---------- Client ----------
    let y = 118;
    doc.fillColor(INK_SOFT).font('Helvetica-Bold').fontSize(9).text('CLIENT', left, y);
    y += 16;
    doc.rect(left, y, pageWidth, 74).fillColor('#F7F4ED').fill();
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(12).text(order.customer_name, left + 12, y + 10);
    doc.font('Helvetica').fontSize(10).fillColor(INK)
      .text(`Tél : ${order.phone}`, left + 12, y + 28)
      .text(order.address, left + 12, y + 42)
      .text(`${order.city}${order.region ? ' — ' + order.region : ''}${order.postal_code ? ' — ' + order.postal_code : ''}`, left + 12, y + 56);
    y += 74 + 10;

    if (order.comment) {
      doc.fillColor(INK_SOFT).font('Helvetica-Oblique').fontSize(9).text(`Commentaire client : ${order.comment}`, left, y, { width: pageWidth });
      y += 24;
    }

    // ---------- Tableau produits ----------
    y += 10;
    doc.fillColor(INK_SOFT).font('Helvetica-Bold').fontSize(9).text('PRODUITS COMMANDÉS', left, y);
    y += 16;

    const cols = [
      { key: 'name', label: 'Produit', x: left, width: pageWidth * 0.38, align: 'left' },
      { key: 'variant', label: 'Option', x: left + pageWidth * 0.38, width: pageWidth * 0.18, align: 'left' },
      { key: 'qty', label: 'Qté', x: left + pageWidth * 0.56, width: pageWidth * 0.1, align: 'right' },
      { key: 'unit', label: 'Prix unit.', x: left + pageWidth * 0.66, width: pageWidth * 0.16, align: 'right' },
      { key: 'sub', label: 'Sous-total', x: left + pageWidth * 0.82, width: pageWidth * 0.18, align: 'right' },
    ];

    function drawRowBg(rowY, height, color) {
      doc.rect(left, rowY, pageWidth, height).fillColor(color).fill();
    }
    function ensureSpace(height) {
      if (y + height > doc.page.height - doc.page.margins.bottom - 140) {
        doc.addPage();
        y = doc.page.margins.top;
      }
    }

    ensureSpace(24);
    drawRowBg(y, 22, MOSS);
    cols.forEach((c) => {
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9)
        .text(c.label, c.x + 6, y + 6, { width: c.width - 10, align: c.align });
    });
    y += 22;

    order.items.forEach((item, i) => {
      ensureSpace(22);
      if (i % 2 === 1) drawRowBg(y, 22, '#F7F4ED');
      const rowData = {
        name: item.product_name,
        variant: item.variant_label || '—',
        qty: String(item.quantity),
        unit: formatPrice(item.unit_price, currency),
        sub: formatPrice(item.unit_price * item.quantity, currency),
      };
      cols.forEach((c) => {
        doc.fillColor(INK).font('Helvetica').fontSize(9.5)
          .text(rowData[c.key], c.x + 6, y + 6, { width: c.width - 10, align: c.align });
      });
      y += 22;
    });

    doc.moveTo(left, y).lineTo(left + pageWidth, y).lineWidth(1).strokeColor(SAND).stroke();
    y += 12;

    // ---------- Totaux ----------
    ensureSpace(70);
    const totalsWidth = 220;
    const totalsX = left + pageWidth - totalsWidth;
    function totalRow(label, value, bold) {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 12 : 10).fillColor(INK)
        .text(label, totalsX, y, { width: totalsWidth - 90 })
        .text(value, totalsX + totalsWidth - 90, y, { width: 90, align: 'right' });
      y += bold ? 20 : 16;
    }
    totalRow('Sous-total', formatPrice(order.subtotal, currency), false);
    totalRow('Livraison', formatPrice(order.delivery_fee, currency), false);
    doc.moveTo(totalsX, y).lineTo(totalsX + totalsWidth, y).lineWidth(1).strokeColor(INK).stroke();
    y += 6;
    totalRow('Total', formatPrice(order.total, currency), true);

    y += 8;
    doc.rect(left, y, 200, 26).fillColor('#F7F4ED').fill();
    doc.fillColor(MOSS).font('Helvetica-Bold').fontSize(10).text(order.payment_method, left + 10, y + 8);
    y += 26 + 40;

    // ---------- Signatures ----------
    ensureSpace(40);
    const half = pageWidth / 2;
    doc.moveTo(left, y).lineTo(left + half - 16, y).strokeColor(INK_SOFT).lineWidth(1).stroke();
    doc.moveTo(left + half + 16, y).lineTo(left + pageWidth, y).strokeColor(INK_SOFT).lineWidth(1).stroke();
    doc.fillColor(INK_SOFT).font('Helvetica').fontSize(8)
      .text('Confirmé par le client', left, y + 4, { width: half - 16 })
      .text('Préparé par le dépôt', left + half + 16, y + 4, { width: half - 16 });

    doc.end();
  });
}

module.exports = { generateBonCommandePdf };
