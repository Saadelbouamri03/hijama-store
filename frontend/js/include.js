// Injecte les fragments HTML partagés (header, footer, bouton WhatsApp)
// dans chaque page, pour éviter de dupliquer ce code partout.
// Une fois injecté, l'événement "partials:ready" est déclenché : les autres
// scripts de page (main.js, cart.js...) attendent cet événement avant
// de manipuler le header/footer (compteur panier, liens sociaux, etc.)

(function () {
  async function includePartial(selector, url) {
    const el = document.querySelector(selector);
    if (!el) return;
    const res = await fetch(url);
    el.innerHTML = await res.text();
  }

  function highlightActiveNav() {
    const path = window.location.pathname === '/' ? '/' : window.location.pathname.replace(/\/$/, '');
    document.querySelectorAll('.main-nav a, .mobile-nav a').forEach((a) => {
      const href = a.getAttribute('href');
      if (href === path || (href !== '/' && path.startsWith(href))) {
        a.setAttribute('aria-current', 'page');
      }
    });
  }

  function wireMobileMenu() {
    const toggle = document.getElementById('nav-toggle');
    const menu = document.getElementById('mobile-nav');
    if (!toggle || !menu) return;
    toggle.addEventListener('click', () => {
      const open = menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => {
      menu.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }));
  }

  // Apparition douce des sections au défilement (une seule fois chacune,
  // fondu + légère montée de 10-15px — voir .reveal dans style.css).
  // Si IntersectionObserver n'est pas supporté, tout reste simplement visible.
  function wireScrollReveal() {
    const items = document.querySelectorAll('.reveal');
    if (!items.length) return;
    if (!('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    items.forEach((el) => observer.observe(el));
  }

  async function init() {
    await Promise.all([
      includePartial('[data-include="header"]', '/partials/header.html'),
      includePartial('[data-include="footer"]', '/partials/footer.html'),
      includePartial('[data-include="whatsapp"]', '/partials/whatsapp-button.html'),
    ]);
    highlightActiveNav();
    wireMobileMenu();
    wireScrollReveal();
    document.dispatchEvent(new CustomEvent('partials:ready'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
