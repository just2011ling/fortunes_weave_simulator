export const tiers = [
  { name: '基础' },
  { name: '初级' },
  { name: '中级' },
  { name: '上级' },
  { name: '最上级' },
  { name: '神将' },
];

export const statMeta = [
  ['hp', 'HP'], ['str', '力量'], ['mag', '魔力'], ['spd', '速度'],
  ['dex', '技巧'], ['def', '防守'], ['res', '魔防'], ['lck', '幸运'], ['cha', '魅力'],
];

export const mountTypesByClass = {
  飞鸵兵: ['飞鸵'], 骑甲鸵兵: ['飞鸵'], 神鸵兵: ['飞鸵'],
  天翼兵: ['天马', '飞马'], 圣天翼兵: ['天马', '飞马'],
  驭龙兵: ['飞龙'], 飞龙将领: ['飞龙'],
  轻骑兵: ['马'], 战车兵: ['马'], 铁甲骑兵: ['马'], 森林骑士: ['马'], 荣光骑士: ['马'],
  重装骑兵: ['马'], 高阶墓志铭: ['马'], 弓骑士: ['马'], 奥利哈铁骑: ['马'],
  英勇骑士: ['马'], 瓦尔基里姆: ['马'], 烈骏神将: ['马'], 游唱诗人: ['马'],
  战象兵: ['战象'],
};

export const mountStatKeys = {
  HP: 'hp', 力: 'str', 魔: 'mag', 速: 'spd', 技: 'dex', 防: 'def', 魔防: 'res', 幸: 'lck', 魅: 'cha',
};

export const tankMidLevelGrowthBonus = {
  hp: 10, str: 5, mag: 5, spd: 5, dex: 5, def: 10, res: 0, lck: 0, cha: 5,
};

export const tankGrowthBonus = {
  hp: 10, str: 15, mag: 5, spd: 5, dex: 10, def: 20, res: 5, lck: 5, cha: 10,
};

