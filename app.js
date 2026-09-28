const tiers = [
  { name: '基础', level: 1 },
  { name: '初级', level: 10 },
  { name: '中级', level: 20 },
  { name: '上级', level: 35 },
  { name: '最上级', level: 45 },
];
const statMeta = [['hp','生命'],['str','力量'],['mag','魔力'],['spd','速度'],['dex','技巧'],['def','守备'],['res','魔防'],['lck','幸运'],['cha','魅力']];
let characters = [], classes = [], selected = null, level = 1, jobRoute = [], page = 'simulation';
const $ = id => document.getElementById(id);
const classMap = new Map();

async function init() {
  try {
    const [charRes, classRes] = await Promise.all([fetch('./data/characters.json'), fetch('./data/classes.json')]);
    if (!charRes.ok || !classRes.ok) throw new Error('无法读取本地资料');
    [characters, classes] = await Promise.all([charRes.json(), classRes.json()]);
    classes = classes.filter(c => c.tier !== '神将');
    classes.forEach(c => classMap.set(c.id, c));
    bind(); renderRoster();
    selectCharacter(characters.find(c => c.startClass === '平民') || characters[0]);
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
  $('resetRoute').addEventListener('click', resetRoute);
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
  level = Math.min(99, Math.max(1, Number(character.baseLevel) || 1));
  const start = classes.find(c => c.name === character.startClass) || classes.find(c => c.name === '平民') || classes.find(c => c.name === '贵族');
  jobRoute = [{ classId: start?.id || null, level: Number(character.baseLevel) || 1, initial: true, leveled: true }];
  renderRoster(); renderAll();
}
function resetRoute() {
  const originalClass = classes.find(c => c.name === selected?.startClass) || classes.find(c => c.name === '平民') || classes.find(c => c.name === '贵族');
  level = Math.min(99, Math.max(1, Number(selected?.baseLevel) || 1));
  jobRoute = [{ classId: originalClass?.id || null, level, initial: true, leveled: true }];
  renderAll();
}
function currentMinLevel() {
  const lastRecorded = [...jobRoute].reverse().find(entry => entry.initial || entry.leveled);
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
  return classMap.get(currentEntry()?.classId) || classes.find(c => c.name === selected?.startClass);
}
function currentEntry() { return [...jobRoute].reverse().find(item => item.level <= level) || jobRoute[0]; }
function renderAll() {
  if (!selected) return;
  $('levelValue').textContent = level;
  $('levelSlider').style.setProperty('--progress', `${((level - 1) / 98) * 100}%`);
  $('levelSlider').min = currentMinLevel(); $('levelSlider').max = 99;
  $('levelDown').disabled = level <= currentMinLevel(); $('levelUp').disabled = level >= 99;
  renderGrowth(); renderAbilities(); renderRoute(); renderClassPicker();
}
function renderGrowth() {
  const job = currentClass();
  $('growthCharacterName').textContent = selected.name;
  $('statsGrid').innerHTML = statMeta.map(([key,label]) => {
    const total = (Number(selected.growth?.[key]) || 0) + (Number(job?.growth?.[key]) || 0);
    const width = `${Math.min(100, Math.max(2, Math.max(0,total) / 1.3))}%`;
    return `<div class="growth-stat"><span class="growth-stat-name">${label}</span><div class="growth-bars"><div class="bar-row total-row"><i><b style="width:${width}"></b></i><em>${fmtSigned(total)}%</em></div></div></div>`;
  }).join('');
}
function renderAbilities() {
  const job = currentClass();
  $('abilityClassBadge').textContent = job?.name || '未知职业';
  $('abilityGrid').innerHTML = statMeta.map(([key,label]) => {
    const value = expectedStat(key);
    return `<div class="ability-stat"><span>${label}</span><b>${Number.isFinite(value) ? value.toFixed(1) : '—'}</b></div>`;
  }).join('');
}
function expectedStat(key) {
  const base = Number(selected.baseStats?.[key]);
  if (!Number.isFinite(base)) return NaN;
  const charGrowth = Number(selected.growth?.[key]) || 0;
  const baseLevel = Math.max(1, Number(selected.baseLevel) || 1);
  let value = base;
  if (level >= baseLevel) {
    for (let lv = baseLevel + 1; lv <= level; lv++) value += growthAt(key, lv, charGrowth);
  } else {
    for (let lv = level + 1; lv <= baseLevel; lv++) value -= growthAt(key, lv, charGrowth);
  }
  // Character base stats use the starting class. Each recorded transfer replaces its class correction.
  let previous = classMap.get(jobRoute[0]?.classId);
  for (const event of jobRoute.slice(1)) {
    if (event.level > level) continue;
    const next = classMap.get(event.classId);
    value += (Number(next?.baseStats?.[key]) || 0) - (Number(previous?.baseStats?.[key]) || 0);
    previous = next || previous;
  }
  return value;
}
function growthAt(key, gainedLevel, charGrowth) {
  const active = classAtLevel(gainedLevel);
  return (charGrowth + (Number(active?.growth?.[key]) || 0)) / 100;
}
function classAtLevel(gainedLevel) {
  const event = [...jobRoute].reverse().find(item => item.level < gainedLevel);
  return classMap.get(event?.classId) || classes.find(c => c.name === selected?.startClass);
}
function renderRoute() {
  const activeEntry = currentEntry();
  const routeEntries = jobRoute.map((entry, index) => ({ ...entry, routeIndex: index })).filter(entry => entry.initial || entry.leveled);
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
  $('classCategories').innerHTML = tiers.slice(1).map(tier => {
    const available = level >= tier.level;
    const options = classes.filter(c => c.tier === tier.name);
    return `<section class="class-category ${available ? 'category-open' : 'category-locked'}"><header><div><span class="category-tier">${tier.name}职业</span><span class="category-level">Lv.${tier.level} 解锁</span></div>${available ? '<span class="category-status">可选择</span>' : `<span class="category-lock">需 Lv.${tier.level}</span>`}</header><div class="job-options">${options.map(cls => `<button class="job-option ${currentClass()?.id === cls.id ? 'chosen' : ''}" data-class="${cls.id}" ${available ? '' : 'disabled'}><span>${esc(cls.name)}</span>${cls.growthTotal ? `<small>成长 ${fmtSigned(cls.growthTotal)}</small>` : ''}</button>`).join('') || '<span class="no-jobs">暂无职业资料</span>'}</div></section>`;
  }).join('');
  $('classCategories').querySelectorAll('.job-option:not(:disabled)').forEach(button => button.addEventListener('click', () => {
    const cls = classMap.get(button.dataset.class);
    if (!cls || level < (tiers.find(t => t.name === cls.tier)?.level || 1)) return;
    jobRoute = jobRoute.filter(event => event.level <= level);
    jobRoute.push({ classId: cls.id, level, initial: false });
    renderAll();
  }));
}
function fmtSigned(n) { n = Number(n) || 0; return `${n > 0 ? '+' : ''}${n}`; }
function esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
init();
