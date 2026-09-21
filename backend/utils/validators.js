// Fonctions de validation pures, sans dépendance externe.
// Utilisées côté serveur (obligatoire, pour la sécurité des données)
// et la même logique est reprise côté client en JavaScript pour un retour immédiat.

// Accepte les numéros marocains courants :
//   06XXXXXXXX / 07XXXXXXXX / 05XXXXXXXX
//   +2126XXXXXXXX / +2127XXXXXXXX / +2125XXXXXXXX
//   00212...
function isValidMoroccanPhone(raw) {
  if (typeof raw !== 'string') return false;
  const cleaned = raw.replace(/[\s.-]/g, '');
  const pattern = /^(?:\+212|00212|0)[5-7]\d{8}$/;
  return pattern.test(cleaned);
}

function isNonEmptyString(value, maxLength = 500) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;
}

function isPositiveNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

// Valide les champs du formulaire de commande envoyés par le client.
// Retourne { valid: boolean, errors: string[] }
function validateOrderInput(body) {
  const errors = [];

  if (!isNonEmptyString(body.customerName, 120)) errors.push('Le nom complet est requis.');
  if (!isValidMoroccanPhone(body.phone || '')) errors.push('Le numéro de téléphone n\'est pas valide.');
  if (!isNonEmptyString(body.city, 80)) errors.push('La ville est requise.');
  if (!isNonEmptyString(body.address, 300)) errors.push('L\'adresse complète est requise.');
  if (body.comment && typeof body.comment !== 'string') errors.push('Le commentaire est invalide.');
  if (!Array.isArray(body.items) || body.items.length === 0) errors.push('Le panier est vide.');

  if (Array.isArray(body.items)) {
    body.items.forEach((item, i) => {
      if (!isPositiveInteger(item.productId)) errors.push(`Article ${i + 1} : produit invalide.`);
      if (!isPositiveInteger(item.quantity) || item.quantity < 1) errors.push(`Article ${i + 1} : quantité invalide.`);
      if (item.variantId !== undefined && item.variantId !== null && !isPositiveInteger(item.variantId)) {
        errors.push(`Article ${i + 1} : variante invalide.`);
      }
    });
  }

  // Honeypot anti-bot : champ invisible pour un vrai visiteur, que seuls les
  // robots remplissent automatiquement. Rempli => on rejette sans détailler
  // pourquoi (ne pas indiquer aux robots qu'ils ont été détectés).
  if (isNonEmptyString(body.honeypot, 200)) errors.push('Requête invalide.');

  return { valid: errors.length === 0, errors };
}

module.exports = {
  isValidMoroccanPhone,
  isNonEmptyString,
  isPositiveNumber,
  isPositiveInteger,
  validateOrderInput,
};
