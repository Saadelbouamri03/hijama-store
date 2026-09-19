// Transforme un nom ("Huile d'Argan Bio") en slug URL ("huile-d-argan-bio").
// Utilisé pour générer automatiquement les identifiants d'URL des produits
// et catégories créés depuis l'espace admin.

function slugify(text) {
  return String(text)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // retire les accents
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

module.exports = { slugify };
