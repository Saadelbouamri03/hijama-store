// Petits utilitaires partagés pour dériver des informations d'affichage à
// partir des données réelles du catalogue (nom, description, variantes),
// sans jamais inventer de valeur : si rien n'est trouvé, on renvoie null et
// l'appelant affiche "Non renseigné".

// Le champ description contient systématiquement "(Réf. HS-XXX)" quand la
// référence existe — on l'extrait telle quelle, jamais reformulée.
function extractRef(description) {
  const m = String(description || '').match(/Réf\.?\s*([A-Za-z0-9-]+)/i);
  return m ? m[1] : null;
}

// Certains noms de produit indiquent explicitement une quantité par boîte,
// ex. "كؤوس الصفاء للحجامة (100 كأس)" -> 100. Sert à afficher un
// conditionnement honnête ("Boîte de 100") plutôt qu'un chiffre inventé.
function extractBoxQty(name) {
  const m = String(name || '').match(/\((\d+)\s*(?:كأس|قطعة|pièces?|pcs?)\)/i);
  return m ? Number(m[1]) : null;
}

// Une variante n'est une "taille" (diamètre) que si son libellé contient une
// unité de longueur (cm / سم). Les variantes de forme ("مستطيل", "قلب"...)
// sont ignorées : ce ne sont pas des dimensions.
function isSizeVariantLabel(label) {
  return /سم|cm\b/i.test(String(label || ''));
}

// Table de correspondance fermée : chaque entrée est un mot du nom RÉEL du
// produit tel qu'écrit en base, jamais une supposition. Si aucun mot connu
// n'apparaît dans le nom, on renvoie null ("Non renseigné" côté affichage).
const MATERIAL_BRAND_KEYWORDS = [
  [/الصفاء/, 'Marque Safaa'],
  [/الأصالة/, 'Marque Al Assala'],
  [/بامبو/, 'Bambou naturel'],
  [/نحاس أحمر/, 'Cuivre rouge'],
  [/نحاس أصفر/, 'Cuivre jaune (laiton)'],
  [/نحاس/, 'Cuivre'],
  [/زجاج/, 'Verre'],
  [/سيليكون/, 'Silicone'],
  [/بلاستيك/, 'Plastique'],
  [/مغناطيس/, 'Magnétique'],
  [/خشب/, 'Bois'],
];

function materialOrBrandLabel(name) {
  const found = MATERIAL_BRAND_KEYWORDS.find(([re]) => re.test(String(name || '')));
  return found ? found[1] : null;
}

function conditioningLabel(product) {
  const boxQty = extractBoxQty(product.name);
  if (boxQty) return `Boîte de ${boxQty}`;
  return 'À l\'unité';
}

// Certaines fiches décrivent les tailles en texte libre plutôt qu'en
// variantes structurées, ex. "بـ3 مقاسات (5، 6، 7 سم)". On extrait le
// contenu réel entre parenthèses (jamais de valeur devinée), et on colle
// "cm" à CHAQUE chiffre individuellement — "5cm, 6cm, 7cm" plutôt que
// "5, 6, 7 cm" où l'unité, partagée en fin de liste, se retrouve séparée
// du chiffre auquel elle correspond.
function extractSizesParenthetical(description) {
  const m = String(description || '').match(/مقاسات\s*\(([^)]+)\)/);
  if (!m) return null;
  let text = m[1]
    .replace(/٠/g, '0').replace(/١/g, '1').replace(/٢/g, '2').replace(/٣/g, '3').replace(/٤/g, '4')
    .replace(/٥/g, '5').replace(/٦/g, '6').replace(/٧/g, '7').replace(/٨/g, '8').replace(/٩/g, '9')
    .replace(/إلى/g, 'à')
    .replace(/سم/g, '')
    .replace(/،/g, ',')
    .trim();
  text = text.replace(/(\d+(?:[.,]\d+)?)/g, (num) => `${num.replace(',', '.')}cm`);
  return text.replace(/\s*,\s*/g, ', ').replace(/\s+/g, ' ').trim();
}

function availabilityLabel(stock) {
  if (stock <= 0) return { text: 'Rupture de stock', cls: 'stock-out' };
  if (stock <= 5) return { text: `Stock limité (${stock})`, cls: 'stock-low' };
  return { text: 'En stock', cls: 'stock-ok' };
}
