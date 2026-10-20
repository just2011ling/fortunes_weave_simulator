import { parseMountModifiers } from './utils.js';

const dataFiles = {
  characters: './data/characters.json',
  classes: './data/classes.json',
  chapters: './data/chapter_characters.json',
  mounts: './data/mount.json',
};

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`无法读取资料：${path}`);
  return response.json();
}

export async function loadGameData() {
  const [characters, classes, chapters, mounts] = await Promise.all(
    [
      fetchJson(dataFiles.characters),
      fetchJson(dataFiles.classes),
      fetchJson(dataFiles.chapters),
      fetchJson(dataFiles.mounts),
    ],
  );

  mounts.forEach(mount => {
    mount.bonusStats = parseMountModifiers(mount.bonus);
    mount.growthStats = parseMountModifiers(mount.growth);
  });

  return { characters, classes, chapters, mounts };
}
