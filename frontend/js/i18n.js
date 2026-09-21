// Système de traduction minimal : dictionnaires JSON plats (ar/fr), un
// helper qui bascule le texte des éléments marqués data-i18n, pas de
// framework/build step (même style que le reste du site : IIFE + CustomEvent,
// voir include.js/api.js). Arabe par défaut ; le français reste disponible en
// langue secondaire via le sélecteur de langue du header.
//
// Usage HTML : <a data-i18n="nav.home">Accueil</a> (le texte français reste
// en dur comme fallback si le JS ne charge pas). Pour un attribut plutôt que
// le texte : <input data-i18n-attr="placeholder:form.namePlaceholder">
// (plusieurs paires séparées par des virgules).
// Usage JS : I18N.t('nav.home', 'Accueil') une fois `i18n:ready` déclenché.

const I18N = (() => {
  const DEFAULT_LOCALE = 'ar';
  const SUPPORTED = ['ar', 'fr'];
  let dict = {};
  let locale = DEFAULT_LOCALE;

  function resolveLocale() {
    try {
      const stored = localStorage.getItem('locale');
      if (SUPPORTED.includes(stored)) return stored;
    } catch { /* localStorage indisponible (navigation privée...) */ }
    return DEFAULT_LOCALE;
  }

  function t(key, fallback) {
    return (dict && dict[key] !== undefined) ? dict[key] : (fallback !== undefined ? fallback : key);
  }

  function applyDom(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (dict[key] !== undefined) el.textContent = dict[key];
    });
    scope.querySelectorAll('[data-i18n-attr]').forEach((el) => {
      el.getAttribute('data-i18n-attr').split(',').forEach((pair) => {
        const [attr, key] = pair.split(':').map((s) => s.trim());
        if (attr && key && dict[key] !== undefined) el.setAttribute(attr, dict[key]);
      });
    });
  }

  async function init() {
    locale = resolveLocale();
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    try {
      dict = await fetch(`/i18n/${locale}.json`).then((r) => r.json());
    } catch {
      dict = {};
    }
    applyDom();
    document.addEventListener('partials:ready', () => {
      applyDom();
      wireLangSwitch();
    });
    document.dispatchEvent(new CustomEvent('i18n:ready', { detail: { locale, t } }));
  }

  function wireLangSwitch() {
    const btn = document.getElementById('lang-switch');
    if (!btn) return;
    const other = locale === 'ar' ? 'fr' : 'ar';
    btn.textContent = other === 'ar' ? 'العربية' : 'FR';
    btn.addEventListener('click', () => setLocale(other));
  }

  function setLocale(newLocale) {
    if (!SUPPORTED.includes(newLocale)) return;
    try { localStorage.setItem('locale', newLocale); } catch { /* ignoré */ }
    window.location.reload();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { t, applyDom, setLocale, getLocale: () => locale };
})();
