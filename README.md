# 万缕千丝 · 转职模拟器

一个使用原生 JavaScript 模块构建的响应式网页。界面采用移动端优先布局，包含转职与能力值模拟、凹点辅助入口，以及角色和职业资料浏览。

## 启动

在项目目录运行本地服务器：

```bash
node server.js
```

然后打开 <http://127.0.0.1:8000>。浏览器需要通过 HTTP 加载 JavaScript 模块和 JSON 数据，不能直接双击 `index.html`。

## 目录结构

```text
app.js                 应用入口与初始化
js/
  config.js            职业、属性、坐骑和模拟规则配置
  data.js              JSON 数据加载与坐骑属性解析
  router.js            哈希路由与页面切换
  simulator.js         角色选择、转职路线和能力值计算
  utils.js             DOM、格式化和数据解析工具
styles/
  tokens.css           颜色、字体和布局变量
  base.css             全局基础样式与无障碍焦点
  layout.css           页头、导航、角色列表和通用页面布局
  simulator.css        模拟器组件样式
  responsive.css       从窄屏到宽屏的布局断点
data/                  角色、职业、章节与坐骑 JSON 数据
```

`data/` 中的资料文件独立于界面代码，本次结构调整不会改写这些数据。
