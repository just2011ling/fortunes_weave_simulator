import { parseMountModifiers } from './utils.js';

// 游戏资料 JSON 的相对路径集中定义在这里。
const dataFiles = {
  characters: './data/characters.json',
  classes: './data/classes.json',
  chapters: './data/chapter_characters.json',
  mounts: './data/mount.json',
};

/** 从指定地址读取并解析 JSON 资料。 */
async function fetchJson(path) {
  // response 保存服务器返回结果，供状态检查和 JSON 解析使用。
  const response = await fetch(path);
  if (!response.ok) throw new Error(`无法读取资料：${path}`);
  return response.json();
}

/** 并行读取四类资料，并预先解析坐骑属性加成。 */
export async function loadGameData() {
  // 四类基础资料互不依赖，因此并行加载以缩短初始化时间。
  const [characters, classes, chapters, mounts] = await Promise.all(
    [
      fetchJson(dataFiles.characters),
      fetchJson(dataFiles.classes),
      fetchJson(dataFiles.chapters),
      fetchJson(dataFiles.mounts),
    ],
  );

  // 将坐骑的文字加成转换为计算面板可直接使用的属性对象。
  mounts.forEach(mount => {
    mount.bonusStats = parseMountModifiers(mount.bonus);
    mount.growthStats = parseMountModifiers(mount.growth);
  });

  return { characters, classes, chapters, mounts };
}
