import { loadGameData } from './js/data.js';
import { initRouter } from './js/router.js';
import { initSimulator } from './js/simulator.js';
import { $ } from './js/utils.js';

async function startApp() {
  try {
    const data = await loadGameData();
    initSimulator(data);
    initRouter();
  } catch (error) {
    showLoadError(error);
  }
}

function showLoadError(error) {
  $('simulationPage').innerHTML = `
    <div class="load-error" role="alert">
      <span aria-hidden="true">✳</span>
      <h2>资料暂时无法载入</h2>
      <p>请通过本地网页服务器打开此页面。</p>
      <small>${error.message}</small>
    </div>`;
}

startApp();
