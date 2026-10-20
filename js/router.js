import { $ } from './utils.js';

// 应用当前支持的页面路由名称。
const routes = ['simulation', 'skills'];

/** 从地址栏 hash 中解析有效路由，无效时回到转职模拟页。 */
function routeFromHash(hash = window.location.hash) {
  // route 是去除 hash 与后续参数后的首段路由名称。
  const route = hash.replace(/^#\/?/, '').split(/[/?#]/)[0];
  return routes.includes(route) ? route : 'simulation';
}

/** 根据路由切换页面可见状态和导航选中状态。 */
function renderRoute(route) {
  $('simulationPage').hidden = route !== 'simulation';
  $('skillsPage').hidden = route !== 'skills';
  document.querySelectorAll('.nav-item').forEach(button => {
    // active 表示该菜单对应当前页面。
    const active = button.dataset.page === route;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });

}

/** 让页面状态与地址栏中的路由保持一致。 */
function syncFromLocation() {
  // route 是当前 hash 对应的有效页面。
  const route = routeFromHash();
  if (window.location.hash !== `#/${route}`) {
    window.history.replaceState(null, '', `#/${route}`);
  }
  renderRoute(route);
}

/** 绑定菜单点击与浏览器前进后退的路由更新事件。 */
export function initRouter() {
  document.querySelectorAll('.nav-item').forEach(button => {
    button.addEventListener('click', () => {
      // nextRoute 是用户点击菜单所请求的目标页面。
      const nextRoute = button.dataset.page;
      if (!routes.includes(nextRoute)) return;
      if (window.location.hash === `#/${nextRoute}`) renderRoute(nextRoute);
      else window.location.hash = `/${nextRoute}`;
    });
  });

  window.addEventListener('hashchange', syncFromLocation);
  syncFromLocation();
}
