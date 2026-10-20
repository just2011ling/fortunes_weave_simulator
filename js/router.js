import { $ } from './utils.js';

const routes = ['simulation', 'skills'];

function routeFromHash(hash = window.location.hash) {
  const route = hash.replace(/^#\/?/, '').split(/[/?#]/)[0];
  return routes.includes(route) ? route : 'simulation';
}

function renderRoute(route) {
  $('simulationPage').hidden = route !== 'simulation';
  $('skillsPage').hidden = route !== 'skills';
  document.querySelectorAll('.nav-item').forEach(button => {
    const active = button.dataset.page === route;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });

}

function syncFromLocation() {
  const route = routeFromHash();
  if (window.location.hash !== `#/${route}`) {
    window.history.replaceState(null, '', `#/${route}`);
  }
  renderRoute(route);
}

export function initRouter() {
  document.querySelectorAll('.nav-item').forEach(button => {
    button.addEventListener('click', () => {
      const nextRoute = button.dataset.page;
      if (!routes.includes(nextRoute)) return;
      if (window.location.hash === `#/${nextRoute}`) renderRoute(nextRoute);
      else window.location.hash = `/${nextRoute}`;
    });
  });

  window.addEventListener('hashchange', syncFromLocation);
  syncFromLocation();
}
