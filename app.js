const tiers = [
  { name: '基础' },
  { name: '初级' },
  { name: '中级' },
  { name: '上级' },
  { name: '最上级' },
  { name: '神将' },
];
const statMeta = [['hp','HP'],['str','力量'],['mag','魔力'],['spd','速度'],['dex','技巧'],['def','防守'],['res','魔防'],['lck','幸运'],['cha','魅力']];
const mountTypesByClass = {
  '飞鸵兵': ['飞鸵'], '骑甲鸵兵': ['飞鸵'], '神鸵兵': ['飞鸵'],
  '天翼兵': ['天马', '飞马'], '圣天翼兵': ['天马', '飞马'],
  '驭龙兵': ['飞龙'], '飞龙将领': ['飞龙'],
  '轻骑兵': ['马'], '战车兵': ['马'], '森林骑士': ['马'], '荣光骑士': ['马'],
  '重装骑兵': ['马'], '高阶墓志铭': ['马'], '弓骑士': ['马'], '奥利哈铁骑': ['马'],
  '英勇骑士': ['马'], '瓦尔基里姆': ['马'], '烈骏神将': ['马'], '游唱诗人': ['马'],
  '战象兵': ['战象'],
};
const mountStatKeys = { HP: 'hp', 力: 'str', 魔: 'mag', 速: 'spd', 技: 'dex', 防: 'def', 魔防: 'res', 幸: 'lck', 魅: 'cha' };
let characters = [], classes = [], chapterCharacters = {}, mounts = [], selectedMount = null, selected = null, selectedCase = null, level = 1, jobRoute = [], page = 'simulation';
const $ = id => document.getElementById(id);
const classMap = new Map();
const mapNodeTypes = [
  { id: 'explore', name: '探索点', shape: 'square' },
  { id: 'maze', name: '迷宫点', shape: 'triangle-down' },
  { id: 'camp', name: '露营点', shape: 'triangle-up' },
  { id: 'base', name: '据点', shape: 'diamond' },
  { id: 'open', name: '空地', shape: 'circle' },
];
let mapNodes = [], selectedMapNodeId = null;

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
    syncPageFromRoute();
    window.addEventListener('hashchange', syncPageFromRoute);
    selectCharacter(characters.find(c => chapterCharacters[c.name]?.length) || characters[0]);
  } catch (error) {
    $('simulationPage').innerHTML = `<div class="load-error"><span>✳</span><h2>资料暂时无法载入</h2><p>请通过本地网页服务器打开此页面。</p><small>${error.message}</small></div>`;
  }
}
function bind() {
  $('searchInput').addEventListener('input', renderRoster);
  document.querySelectorAll('.nav-item').forEach(button => button.addEventListener('click', () => navigateToPage(button.dataset.page)));
  $('levelDown').addEventListener('click', () => changeLevel(level - 1));
  $('levelUp').addEventListener('click', () => changeLevel(level + 1));
  $('levelSlider').addEventListener('input', e => changeLevel(Number(e.target.value)));
  $('resetRoute').addEventListener('click', () => resetRoute());
  $('mountSelect').addEventListener('change', e => {
    selectedMount = e.target.value === '' ? null : mounts[Number(e.target.value)] || null;
    const activeEntry = currentEntry();
    if (activeEntry) activeEntry.mountName = selectedMount?.name || null;
    renderAll();
  });
  $('scenarioSelect').addEventListener('change', e => {
    const cases = chapterCharacters[selected?.name] || [];
    selectedCase = cases[Number(e.target.value)] || null;
    resetRoute(true);
  });
  initMapEditor();
  document.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('searchInput').focus(); } });
}
function normalizePageRoute(hash = window.location.hash) {
  const route = hash.replace(/^#\/?/, '').split(/[/?#]/)[0];
  return ['simulation', 'skills', 'maps'].includes(route) ? route : 'simulation';
}

function navigateToPage(next) {
  if (!['simulation', 'skills', 'maps'].includes(next)) return;
  const route = `#/${next}`;
  if (window.location.hash === route) {
    setPage(next);
    return;
  }
  window.location.hash = route;
}

function syncPageFromRoute() {
  const route = normalizePageRoute();
  if (window.location.hash !== `#/${route}`) {
    window.history.replaceState(null, '', `#/${route}`);
  }
  setPage(route);
}

function setPage(next) {
  page = next;
  $('simulationPage').hidden = page !== 'simulation'; $('skillsPage').hidden = page !== 'skills'; $('mapsPage').hidden = page !== 'maps';
  $('characterSidebar').hidden = page !== 'simulation';
  document.querySelector('.layout').classList.toggle('single-page', page !== 'simulation');
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  if (page === 'maps') requestAnimationFrame(resizeMapCanvas);
}

function initMapEditor() {
  try { mapNodes = JSON.parse(localStorage.getItem('fortunes-weave-map-nodes') || '[]'); }
  catch { mapNodes = []; }
  if (!Array.isArray(mapNodes)) mapNodes = [];
  const visibleNodes = mapNodes.filter(node => Number.isFinite(node.x) && Number.isFinite(node.y)
    && node.x >= 12 && node.x <= 888 && node.y >= 12 && node.y <= 608);
  if (visibleNodes.length !== mapNodes.length) {
    mapNodes = visibleNodes;
    saveMapNodes();
  }
  mapNodes.forEach(node => {
    if (typeof node.name !== 'string') node.name = '';
    if (typeof node.remark !== 'string') node.remark = '';
  });
  const canvas = $('mapCanvas');
  canvas.addEventListener('pointerdown', handleMapPointer);
  $('nodeTypeSelect').innerHTML = mapNodeTypes.map(type => `<option value="${type.id}">${type.name}</option>`).join('');
  $('nodeTypeSelect').addEventListener('change', e => {
    const node = mapNodes.find(item => item.id === selectedMapNodeId);
    if (!node) return;
    node.type = e.target.value;
    saveMapNodes(); renderMapEditor();
  });
  $('nodeNameInput').addEventListener('input', e => updateSelectedNodeField('name', e.target.value));
  $('nodeRemarkInput').addEventListener('input', e => updateSelectedNodeField('remark', e.target.value));
  $('deleteNode').addEventListener('click', () => {
    if (!selectedMapNodeId) return;
    mapNodes = mapNodes.filter(node => node.id !== selectedMapNodeId);
    selectedMapNodeId = null;
    saveMapNodes(); renderMapEditor();
  });
  if ('ResizeObserver' in window) new ResizeObserver(resizeMapCanvas).observe($('mapStage'));
  else window.addEventListener('resize', resizeMapCanvas);
  renderMapEditor();
}

function updateSelectedNodeField(field, value) {
  const node = mapNodes.find(item => item.id === selectedMapNodeId);
  if (!node) return;
  node[field] = value;
  saveMapNodes();
  renderMapEditor({ syncFields: false });
}

function saveMapNodes() {
  try { localStorage.setItem('fortunes-weave-map-nodes', JSON.stringify(mapNodes)); }
  catch { /* Keep the current editing session usable when browser storage is unavailable. */ }
}

function handleMapPointer(event) {
  const canvas = $('mapCanvas');
  const bounds = canvas.getBoundingClientRect();
  const x = Math.max(40, Math.min(860, (event.clientX - bounds.left) / bounds.width * 900));
  const y = Math.max(30, Math.min(565, (event.clientY - bounds.top) / bounds.height * 620));
  const hit = [...mapNodes].reverse().find(node => Math.hypot(node.x - x, node.y - y) < 17);
  if (hit) {
    selectedMapNodeId = hit.id;
  } else {
    const node = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, x, y, type: 'explore', name: '', remark: '' };
    mapNodes.push(node);
    selectedMapNodeId = node.id;
    saveMapNodes();
  }
  renderMapEditor();
}

function resizeMapCanvas() {
  const canvas = $('mapCanvas');
  if (!canvas) return;
  const bounds = canvas.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(bounds.width * dpr);
  canvas.height = Math.round(bounds.height * dpr);
  const context = canvas.getContext('2d');
  context.setTransform(canvas.width / 900, 0, 0, canvas.height / 620, 0, 0);
  drawMap(context);
}

function renderMapEditor({ syncFields = true } = {}) {
  const selectedNode = mapNodes.find(node => node.id === selectedMapNodeId);
  $('nodeCount').textContent = `${mapNodes.length} 个`;
  $('mapHint').textContent = selectedNode ? `已选中「${mapNodeTypes.find(type => type.id === selectedNode.type)?.name || '节点'}」。` : '点击地图上的空白位置添加节点。';
  $('deleteNode').disabled = !selectedNode;
  $('nodeTypeSelect').disabled = !selectedNode;
  $('nodeNameInput').disabled = !selectedNode;
  $('nodeRemarkInput').disabled = !selectedNode;
  if (syncFields) {
    $('nodeTypeSelect').value = selectedNode?.type || mapNodeTypes[0].id;
    $('nodeNameInput').value = selectedNode?.name || '';
    $('nodeRemarkInput').value = selectedNode?.remark || '';
  }
  $('mapInfoTitle').textContent = selectedNode?.name || '节点信息';
  $('mapInfoContent').textContent = selectedNode
    ? (selectedNode.remark || '该节点暂无备注。')
    : '选中地图节点后，这里会显示节点备注。';
  resizeMapCanvas();
}

function drawMap(ctx) {
  ctx.clearRect(0, 0, 900, 620);
  mapNodes.forEach(node => drawEditableNode(ctx, node, node.id === selectedMapNodeId));
}

function drawEditableNode(ctx, node, selectedNode) {
  const type = mapNodeTypes.find(item => item.id === node.type) || mapNodeTypes[0];
  const size = type.id === 'open' ? 5 : 10;
  ctx.save(); ctx.translate(node.x, node.y);
  if (selectedNode) {
    ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.fillStyle = 'rgba(82,104,82,.16)'; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.strokeStyle = '#526852'; ctx.lineWidth = 1.4; ctx.stroke();
  }
  ctx.beginPath();
  if (type.id === 'explore') ctx.rect(-size / 2, -size / 2, size, size);
  else if (type.id === 'maze') { ctx.moveTo(-size / 2, -size / 3); ctx.lineTo(size / 2, -size / 3); ctx.lineTo(0, size / 2); ctx.closePath(); }
  else if (type.id === 'camp') { ctx.moveTo(0, -size / 2); ctx.lineTo(size / 2, size / 3); ctx.lineTo(-size / 2, size / 3); ctx.closePath(); }
  else if (type.id === 'base') { ctx.moveTo(0, -size / 2); ctx.lineTo(size / 2, 0); ctx.lineTo(0, size / 2); ctx.lineTo(-size / 2, 0); ctx.closePath(); }
  else ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = selectedNode ? '#526852' : '#fdfcf8'; ctx.strokeStyle = selectedNode ? '#fdfcf8' : '#526852';
  ctx.lineWidth = selectedNode ? 2 : 1.8; ctx.shadowColor = 'rgba(255,255,255,.9)'; ctx.shadowBlur = 5; ctx.fill(); ctx.stroke();
  if (node.name) {
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
    ctx.font = '12px "Noto Sans SC", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const labelWidth = ctx.measureText(node.name).width;
    const labelX = Math.max(labelWidth / 2 + 4 - node.x, Math.min(896 - labelWidth / 2 - node.x, 0));
    ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.strokeText(node.name, labelX, 16);
    ctx.fillStyle = '#353a32'; ctx.fillText(node.name, labelX, 16);
  }
  ctx.restore();
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
  jobRoute = [{ classId: originalClass?.id || null, level, initial: true, leveled: true, mountName: selectedMount?.name || null }];
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
  const activeEntry = currentEntry();
  if (activeEntry) activeEntry.mountName = selectedMount?.name || null;
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
    const mountLabel = entry.mountName ? `<small class="route-mount-name">${esc(entry.mountName)}</small>` : '';
    return `<button type="button" class="route-step available ${active ? 'has-job' : ''}" data-route-index="${entry.routeIndex}" title="回到 Lv.${entry.level} 并清除后续路线"><span class="route-dot"></span><span class="route-tier">${esc(cls?.tier || '基础')}</span><span class="route-job-info"><b>${esc(cls?.name || '未知职业')}</b>${mountLabel}</span><span class="route-level">Lv.${entry.level}</span></button>`;
  }).join('');
  $('routeList').querySelectorAll('.route-step').forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset.routeIndex);
    const checkpoint = jobRoute[index];
    if (!checkpoint) return;
    jobRoute = jobRoute.slice(0, index + 1);
    level = checkpoint.level;
    selectedMount = mounts.find(mount => mount.name === checkpoint.mountName) || null;
    $('levelSlider').value = level;
    renderAll();
  }));
}
function renderClassPicker() {
  const container = $('classCategories');
  if (container.dataset.ready === 'true') {
    container.querySelectorAll('.job-option').forEach(button => {
      const chosen = button.dataset.class === currentClass()?.id;
      button.classList.toggle('chosen', chosen);
      if (chosen) {
        button.disabled = true;
        button.setAttribute('aria-current', 'true');
      } else {
        button.disabled = false;
        button.removeAttribute('aria-current');
      }
    });
    return;
  }
  const categoryMarkup = (title, options) => `<section class="class-category category-open"><header><div><span class="category-tier">${title}</span></div><span class="category-status">可选择</span></header><div class="job-options">${options.map(cls => `<button class="job-option ${currentClass()?.id === cls.id ? 'chosen' : ''}" data-class="${cls.id}" ${currentClass()?.id === cls.id ? 'disabled aria-current="true"' : ''}><span>${esc(cls.name)}</span>${cls.growthTotal ? `<small>成长 ${fmtSigned(cls.growthTotal)}</small>` : ''}</button>`).join('') || '<span class="no-jobs">暂无职业资料</span>'}</div></section>`;
  const basicClasses = classes.filter(cls => cls.tier === '基础' && ['平民', '贵族'].includes(cls.name));
  container.innerHTML = categoryMarkup('基础职业', basicClasses) + tiers.slice(1).map(tier => {
    const options = classes.filter(c => c.tier === tier.name);
    return categoryMarkup(`${tier.name}职业`, options);
  }).join('');
  container.dataset.ready = 'true';
  container.addEventListener('click', e => {
    const button = e.target.closest('.job-option:not(:disabled)');
    if (!button) return;
    const cls = classMap.get(button.dataset.class);
    if (!cls || cls.id === currentClass()?.id) return;
    const retainedRoute = jobRoute.filter(event => event.level <= level);
    const lastEvent = retainedRoute[retainedRoute.length - 1];
    if (lastEvent?.classId === cls.id) return;
    jobRoute = retainedRoute;
    if (lastEvent && !lastEvent.initial && lastEvent.level === level) jobRoute.pop();
    if (selectedMount && !(mountTypesByClass[cls.name] || []).includes(selectedMount.type)) selectedMount = null;
    jobRoute.push({ classId: cls.id, level, initial: false, leveled: false, mountName: selectedMount?.name || null });
    renderAll();
  });
}
function fmtSigned(n) { n = Number(n) || 0; return `${n > 0 ? '+' : ''}${n}`; }
function esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
init();
