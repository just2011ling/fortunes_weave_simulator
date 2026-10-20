import { loadGameData } from './js/data.js';
import { initRouter } from './js/router.js';
import { initSimulator } from './js/simulator.js';
import { $ } from './js/utils.js';

/** 加载游戏资料并初始化模拟器与页面路由。 */
async function startApp() {
  try {
    // data 保存全部载入后的角色、职业、章节和坐骑资料。
    const data = await loadGameData();
    initSimulator(data);
    initRouter();
  } catch (error) {
    showLoadError(error);
  }
}

/** 显示资料加载失败的提示，并附带错误信息供排查。 */
function showLoadError(error) {
  $('simulationPage').innerHTML = `
    <div class="load-error" role="alert">
      <span aria-hidden="true">✳</span>
      <h2>资料暂时无法载入</h2>
      <p>请通过本地网页服务器打开此页面。</p>
      <small>${error.message}</small>
    </div>`;
}

// 启动应用初始化流程。
startApp();
