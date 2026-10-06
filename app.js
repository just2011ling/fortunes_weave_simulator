const tiers = [
  { name: '基础' },
  { name: '初级' },
  { name: '中级' },
  { name: '上级' },
  { name: '最上级' },
  { name: '神将' },
];
const statMeta = [['hp','HP'],['str','力量'],['mag','魔力'],['spd','速度'],['dex','技巧'],['def','守备'],['res','魔防'],['lck','幸运'],['cha','魅力']];
const mountTypesByClass = {
  '飞鸵兵': ['飞鸵'], '骑甲鸵兵': ['飞鸵'], '神鸵兵': ['飞鸵'],
  '天翼兵': ['天马', '飞马'], '圣天翼兵': ['天马', '飞马'],
  '驭龙兵': ['飞龙'], '飞龙将领': ['飞龙'],
  '轻骑兵': ['马'], '战车兵': ['马'], '森林骑士': ['马'], '荣光骑士': ['马'],
  '重装骑兵': ['马'], '高阶墓志铭': ['马'], '弓骑士': ['马'], '奥利哈铁骑': ['马'],
  '英勇骑士': ['马'], '瓦尔基里姆': ['马'], '烈骏神将': ['马'],
  '战象兵': ['战象'],
};
const mountStatKeys = { HP: 'hp', 力: 'str', 魔: 'mag', 速: 'spd', 技: 'dex', 防: 'def', 魔防: 'res', 幸: 'lck', 魅: 'cha' };
let characters = [], classes = [], chapterCharacters = {}, mounts = [], selectedMount = null, selected = null, selectedCase = null, level = 1, jobRoute = [], page = 'simulation';
const $ = id => document.getElementById(id);
const classMap = new Map();

async function init() {
  try {
    const [charRes, classRes, chapterRes, mountRes] = await Promise.all([fetch('./data/characters.json'), fetch('./data/classes.json'), fetch('./data/chapter_characters.json'), fetch('./data/mount.json')]);
    if (!charRes.ok || !classRes.ok || !chapterRes.ok || !mountRes.ok) throw new Error('无法读取本地资料');
    [characters, classes, chapterCharacters, mounts] = await Promise.all([charRes.json(), classRes.json(), chapterRes.json(), mountRes.json()]);
    mounts.forEach(mount => {
      mount.bonusStats = parseMountModifiers(mount.bonus);
      mount.growthStats = parseMountModifiers(mount.growth);
    });
    classes.forEach(c => classMap.set(c.id, c));
    bind(); renderRoster();
    selectCharacter(characters.find(c => chapterCharacters[c.name]?.length) || characters[0]);
  } catch (error) {
    $('simulationPage').innerHTML = `<div class="load-error"><span>✳</span><h2>资料暂时无法载入</h2><p>请通过本地网页服务器打开此页面。</p><small>${error.message}</small></div>`;
  }
}
function bind() {
  $('searchInput').addEventListener('input', renderRoster);
  document.querySelectorAll('.nav-item').forEach(button => button.addEventListener('click', () => setPage(button.dataset.page)));
  $('levelDown').addEventListener('click', () => changeLevel(level - 1));
  $('levelUp').addEventListener('click', () => changeLevel(level + 1));
  $('levelSlider').addEventListener('input', e => changeLevel(Number(e.target.value)));
  $('resetRoute').addEventListener('click', () => resetRoute());
  $('mountSelect').addEventListener('change', e => {
    selectedMount = e.target.value === '' ? null : mounts[Number(e.target.value)] || null;
    renderAll();
  });
  $('scenarioSelect').addEventListener('change', e => {
    const cases = chapterCharacters[selected?.name] || [];
    selectedCase = cases[Number(e.target.value)] || null;
    resetRoute(true);
  });
  document.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('searchInput').focus(); } });
}
function setPage(next) {
  page = next;
  $('simulationPage').hidden = page !== 'simulation'; $('skillsPage').hidden = page !== 'skills';
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === page));
}
function renderRoster() {
  const query = $('searchInput').value.trim().toLowerCase();
  const list = characters.filter(c => c.name.toLowerCase().includes(query));
  $('shownCount').textContent = list.length;
  const items = $('characterList').querySelector('.character-list-items');
  items.innerHTML = list.map(c => `<button class="character-item ${selected?.id === c.id ? 'selected' : ''}" role="option" aria-selected="${selected?.id === c.id}" data-id="${c.id}"><span class="avatar">${esc(c.name.slice(0,1))}</span><span class="character-copy"><b>${esc(c.name)}</b></span><span class="roster-arrow">↗</span></button>`).join('') || '<div class="empty-list">没有找到这位角色</div>';
  items.querySelectorAll('.character-item').forEach(btn => btn.addEventListener('click', () => selectCharacter(characters.find(c => c.id === btn.dataset.id))));
}
function selectCharacter(character) {
  selected = character;
  selectedCase = (chapterCharacters[character.name] || [])[0] || null;
  renderScenarioPicker();
  resetRoute(true);
  renderRoster(); renderAll();
}
function profileClassName() { return selectedCase?.startClass || null; }
function profileLevel() { return Math.max(1, Number(selectedCase?.baseLevel) || 1); }
function profileStats() { return selectedCase?.baseStats || null; }
function renderScenarioPicker() {
  const cases = chapterCharacters[selected?.name] || [];
  const picker = $('scenarioSelect');
  picker.innerHTML = cases.length
    ? cases.map((item, index) => `<option value="${index}" ${item === selectedCase ? 'selected' : ''}>${esc(item.chapter || `情况 ${index + 1}`)} · Lv.${Number(item.baseLevel) || 1} ${esc(item.startClass || '')}</option>`).join('')
    : '<option value="">暂无章节数据</option>';
  picker.disabled = cases.length < 2;
}
function defaultMountForSelection() {
  const startClass = profileClassName();
  let mountName = null;
  if (selected?.name === '伊欧' && ['骑兵', '轻骑兵'].includes(startClass)) mountName = '罗西南';
  if (selected?.name === '亚历珊德拉' && ['天翼兵', '圣天翼兵'].includes(startClass)) mountName = '布克发拉斯';
  return mounts.find(mount => mount.name === mountName) || null;
}
function resetRoute(useDefaultMount = false) {
  const originalClass = classes.find(c => c.name === profileClassName()) || classes.find(c => c.name === '平民') || classes.find(c => c.name === '贵族');
  selectedMount = useDefaultMount ? defaultMountForSelection() : null;
  level = Math.min(99, profileLevel());
  jobRoute = [{ classId: originalClass?.id || null, level, initial: true, leveled: true }];
  renderAll();
}
function currentMinLevel() {
  const lastRecorded = jobRoute[jobRoute.length - 1];
  return Math.max(1, Number(lastRecorded?.level) || 1);
}
function changeLevel(next) {
  const previousLevel = level;
  level = Math.max(currentMinLevel(), Math.min(99, Number(next)));
  const activeBefore = currentEntry();
  if (level > previousLevel && activeBefore && level > activeBefore.level) activeBefore.leveled = true;
  $('levelSlider').value = level;
  renderAll();
}
function currentClass() {
  return classMap.get(currentEntry()?.classId) || classes.find(c => c.name === profileClassName());
}
function currentEntry() { return [...jobRoute].reverse().find(item => item.level <= level) || jobRoute[0]; }
function renderAll() {
  if (!selected) return;
  $('levelValue').textContent = level;
  $('levelSlider').style.setProperty('--progress', `${((level - 1) / 98) * 100}%`);
  $('levelSlider').min = currentMinLevel(); $('levelSlider').max = 99;
  $('levelDown').disabled = level <= currentMinLevel(); $('levelUp').disabled = level >= 99;
  renderMountPicker(); renderGrowth(); renderAbilities(); renderRoute(); renderClassPicker();
}
function parseMountModifiers(text) {
  const result = {};
  const modifierPattern = /(\d+)\s*(HP|魔防|魔|力|技|速|防|幸|魅)\s*%?|(HP|魔防|魔|力|技|速|防|幸|魅)\s*(\d+)\s*%?/g;
  for (const match of String(text || '').matchAll(modifierPattern)) {
    const code = match[2] || match[3];
    const value = Number(match[1] || match[4]);
    const key = mountStatKeys[code];
    if (key) result[key] = (result[key] || 0) + value;
  }
  return result;
}
function renderMountPicker() {
  const picker = $('mountPicker');
  const select = $('mountSelect');
  const stats = $('mountStats');
  const types = mountTypesByClass[currentClass()?.name] || [];
  const compatible = mounts.map((mount, index) => ({ mount, index })).filter(({ mount }) => types.includes(mount.type));
  if (!selectedMount || !types.includes(selectedMount.type)) selectedMount = null;
  picker.hidden = compatible.length === 0;
  stats.hidden = !selectedMount;
  stats.textContent = selectedMount ? `${selectedMount.bonus} / ${selectedMount.growth}` : '';
  if (!compatible.length) return;
  select.innerHTML = '<option value="">无配属</option>' + compatible.map(({ mount, index }) => `<option value="${index}" ${selectedMount === mount ? 'selected' : ''}>${esc(mount.name)}</option>`).join('');
  select.value = selectedMount ? String(mounts.indexOf(selectedMount)) : '';
}
function renderGrowth() {
  const job = currentClass();
  $('growthCharacterName').textContent = selected.name;
  $('growthTotalCaption').hidden = ['平民', '贵族'].includes(job?.name);
  $('statsGrid').innerHTML = statMeta.map(([key,label]) => {
    const mountGrowthMultiplier = job?.name === '战车兵' ? 2 : 1;
    const total = (Number(selected.growth?.[key]) || 0) + (Number(job?.growth?.[key]) || 0) + (Number(selectedMount?.growthStats?.[key]) || 0) * mountGrowthMultiplier;
    return `<div class="ability-stat"><span>${label}</span><b>${fmtSigned(total)}%</b></div>`;
  }).join('');
}
function renderAbilities() {
  const job = currentClass();
  $('abilityClassBadge').textContent = `Lv.${level} ${job?.name || '未知职业'}`;
  $('abilityGrid').innerHTML = statMeta.map(([key,label]) => {
    const value = expectedStat(key);
    return `<div class="ability-stat"><span>${label}</span><b>${Number.isFinite(value) ? value.toFixed(1) : '—'}</b></div>`;
  }).join('');
}
function expectedStat(key) {
  const base = Number(profileStats()?.[key]);
  if (!Number.isFinite(base)) return NaN;
  const charGrowth = Number(selected.growth?.[key]) || 0;
  const baseLevel = profileLevel();
  const startingClass = classes.find(c => c.name === profileClassName()) || classMap.get(jobRoute.find(event => event.initial)?.classId);
  let value = base + (Number(startingClass?.baseStats?.[key]) || 0);
  if (level >= baseLevel) {
    for (let lv = baseLevel + 1; lv <= level; lv++) value += growthAt(key, lv, charGrowth);
  } else {
    for (let lv = level + 1; lv <= baseLevel; lv++) value -= growthAt(key, lv, charGrowth);
  }
  // Add the starting class correction above; each transfer replaces the previous class correction.
  let previous = startingClass;
  for (const event of jobRoute.filter(item => !item.initial)) {
    if (event.level > level) continue;
    const next = classMap.get(event.classId);
    value += (Number(next?.baseStats?.[key]) || 0) - (Number(previous?.baseStats?.[key]) || 0);
    previous = next || previous;
  }
  return value + (Number(selectedMount?.bonusStats?.[key]) || 0);
}
function growthAt(key, gainedLevel, charGrowth) {
  const active = classAtLevel(gainedLevel);
  const mountGrowthMultiplier = active?.name === '战车兵' ? 2 : 1;
  return (charGrowth + (Number(active?.growth?.[key]) || 0) + (Number(selectedMount?.growthStats?.[key]) || 0) * mountGrowthMultiplier) / 100;
}
function classAtLevel(gainedLevel) {
  const event = [...jobRoute].reverse().find(item => item.level < gainedLevel);
  return classMap.get(event?.classId) || classes.find(c => c.name === profileClassName());
}
function renderRoute() {
  const activeEntry = currentEntry();
  const routeEntries = jobRoute.map((entry, index) => ({ ...entry, routeIndex: index }));
  $('routeList').innerHTML = routeEntries.map(entry => {
    const cls = classMap.get(entry.classId);
    const active = activeEntry === jobRoute[entry.routeIndex];
    return `<button type="button" class="route-step available ${active ? 'has-job' : ''}" data-route-index="${entry.routeIndex}" title="回到 Lv.${entry.level} 并清除后续路线"><span class="route-dot"></span><span class="route-tier">${esc(cls?.tier || '基础')}</span><b>${esc(cls?.name || '未知职业')}</b><span class="route-level">Lv.${entry.level}</span></button>`;
  }).join('');
  $('routeList').querySelectorAll('.route-step').forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset.routeIndex);
    const checkpoint = jobRoute[index];
    if (!checkpoint) return;
    jobRoute = jobRoute.slice(0, index + 1);
    level = checkpoint.level;
    $('levelSlider').value = level;
    renderAll();
  }));
}
function renderClassPicker() {
  const categoryMarkup = (title, options) => `<section class="class-category category-open"><header><div><span class="category-tier">${title}</span></div><span class="category-status">可选择</span></header><div class="job-options">${options.map(cls => `<button class="job-option ${currentClass()?.id === cls.id ? 'chosen' : ''}" data-class="${cls.id}" ${currentClass()?.id === cls.id ? 'disabled aria-current="true"' : ''}><span>${esc(cls.name)}</span>${cls.growthTotal ? `<small>成长 ${fmtSigned(cls.growthTotal)}</small>` : ''}</button>`).join('') || '<span class="no-jobs">暂无职业资料</span>'}</div></section>`;
  const basicClasses = classes.filter(cls => cls.tier === '基础' && ['平民', '贵族'].includes(cls.name));
  $('classCategories').innerHTML = categoryMarkup('基础职业', basicClasses) + tiers.slice(1).map(tier => {
    const options = classes.filter(c => c.tier === tier.name);
    return categoryMarkup(`${tier.name}职业`, options);
  }).join('');
  $('classCategories').querySelectorAll('.job-option:not(:disabled)').forEach(button => button.addEventListener('click', () => {
    const cls = classMap.get(button.dataset.class);
    if (!cls || cls.id === currentClass()?.id) return;
    const retainedRoute = jobRoute.filter(event => event.level <= level);
    const lastEvent = retainedRoute[retainedRoute.length - 1];
    if (lastEvent?.classId === cls.id) return;
    jobRoute = retainedRoute;
    if (lastEvent && !lastEvent.initial && lastEvent.level === level) jobRoute.pop();
    jobRoute.push({ classId: cls.id, level, initial: false, leveled: false });
    renderAll();
  }));
}
function fmtSigned(n) { n = Number(n) || 0; return `${n > 0 ? '+' : ''}${n}`; }
function esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
init();
