import { tiers, statMeta, mountTypesByClass, tankMidLevelGrowthBonus, tankGrowthBonus } from './config.js';
import { $, fmtSigned, esc } from './utils.js';

let characters = [];
let classes = [];
let chapterCharacters = {};
let mounts = [];
let selectedMount = null;
let selected = null;
let selectedCase = null;
let level = 1;
let jobRoute = [];
let pickerTier = tiers[1].name;
let editingRouteIndex = null;
let pickerMode = 'job';
let pendingJobSelection = null;
const classMap = new Map();

export function initSimulator(data) {
  characters = data.characters;
  classes = data.classes;
  chapterCharacters = data.chapters;
  mounts = data.mounts;
  classes.forEach(job => classMap.set(job.id, job));
  initJobPicker();
  bindSimulator();
  renderRoster();
  selectCharacter(characters.find(character => chapterCharacters[character.name]?.length) || characters[0]);
}

function bindSimulator() {
  $('searchInput').addEventListener('input', renderRoster);
  $('levelDown').addEventListener('click', () => changeLevel(level - 1));
  $('levelDownFive').addEventListener('click', () => changeLevel(level - 5));
  $('levelUp').addEventListener('click', () => changeLevel(level + 1));
  $('levelUpFive').addEventListener('click', () => changeLevel(level + 5));
  $('resetRoute').addEventListener('click', () => resetRoute());
  $('routeList').addEventListener('click', event => {
    if (event.target.closest('.route-add-button')) {
      openJobPicker();
      return;
    }

    const routeNode = event.target.closest('[data-route-index]');
    if (routeNode) openJobPicker(Number(routeNode.dataset.routeIndex));
  });
  $('scenarioSelect').addEventListener('change', event => {
    const cases = chapterCharacters[selected?.name] || [];
    selectedCase = cases[Number(event.target.value)] || null;
    resetRoute(true);
  });
  $('closeJobPicker').addEventListener('click', closeJobPicker);
  $('jobPickerDialog').addEventListener('close', () => {
    editingRouteIndex = null;
    pickerMode = 'job';
    pendingJobSelection = null;
    $('jobPickerTabs').hidden = false;
  });
  $('jobPickerDialog').addEventListener('click', event => {
    if (event.target === $('jobPickerDialog')) closeJobPicker();
  });
  document.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      $('searchInput').focus();
    }
  });
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

function initJobPicker() {
  const tabs = $('jobPickerTabs');
  tabs.innerHTML = tiers.map((tier, index) => `
    <button class="job-picker-tab ${tier.name === pickerTier ? 'active' : ''}"
      id="jobTab-${index}" type="button" role="tab" data-tier="${esc(tier.name)}"
      aria-selected="${tier.name === pickerTier}" aria-controls="jobPickerPanel">
      ${esc(tier.name)}
    </button>`).join('');

  tabs.addEventListener('click', event => {
    const tab = event.target.closest('[data-tier]');
    if (!tab) return;
    pickerTier = tab.dataset.tier;
    renderJobPicker();
  });
  tabs.addEventListener('keydown', event => {
    const tabNames = tiers.map(tier => tier.name);
    const currentIndex = tabNames.indexOf(pickerTier);
    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabNames.length;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabNames.length) % tabNames.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabNames.length - 1;
    else return;

    event.preventDefault();
    pickerTier = tabNames[nextIndex];
    renderJobPicker();
    $('jobPickerTabs').querySelector('[aria-selected="true"]')?.focus();
  });

  $('jobPickerPanel').addEventListener('click', event => {
    const mountOption = event.target.closest('[data-mount-choice]');
    if (mountOption) {
      chooseMount(mountOption.dataset.mountChoice || null);
      return;
    }
    const option = event.target.closest('[data-class-id]');
    if (!option) return;
    const job = classMap.get(option.dataset.classId);
    if (job) chooseJob(job);
  });

  renderJobPicker();
}

function renderJobPicker() {
  if (pickerMode === 'mount') {
    $('jobPickerTitle').textContent = '选择坐骑';
    $('jobPickerTabs').hidden = true;
    $('jobPickerPanel').setAttribute('aria-labelledby', 'jobPickerTitle');
    const job = pendingJobSelection?.job || currentClass();
    renderMountOptions(job, pendingJobSelection?.preferredMount || selectedMount);
    return;
  }

  $('jobPickerTitle').textContent = '选择职业';
  $('jobPickerTabs').hidden = false;
  let selectedTabId = '';
  $('jobPickerTabs').querySelectorAll('[role="tab"]').forEach(tab => {
    const active = tab.dataset.tier === pickerTier;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    if (active) selectedTabId = tab.id;
  });
  $('jobPickerPanel').setAttribute('aria-labelledby', selectedTabId);

  const jobs = pickerTier === '基础'
    ? classes.filter(job => job.tier === '基础' && ['平民', '贵族'].includes(job.name))
    : classes.filter(job => job.tier === pickerTier);
  $('jobPickerPanel').innerHTML = jobs.length
    ? `<div class="job-picker-options">${jobs.map(job => `
        <button class="job-option" type="button" data-class-id="${esc(job.id)}">
          <span>${esc(job.name)}</span>
          ${job.growthTotal ? `<small>成长 ${fmtSigned(job.growthTotal)}</small>` : ''}
        </button>`).join('')}</div>`
    : '<p class="job-picker-empty">这个分类暂无职业资料。</p>';
}

function openJobPicker(routeIndex = null) {
  pickerMode = 'job';
  pendingJobSelection = null;
  editingRouteIndex = routeIndex;
  const targetJob = routeIndex === null
    ? currentClass()
    : classMap.get(jobRoute[routeIndex]?.classId);
  pickerTier = targetJob?.tier || tiers[1].name;
  renderJobPicker();

  const dialog = $('jobPickerDialog');
  if (!dialog.open) dialog.showModal();
}

function closeJobPicker() {
  const dialog = $('jobPickerDialog');
  if (dialog.open) dialog.close();
  editingRouteIndex = null;
  pickerMode = 'job';
  pendingJobSelection = null;
}

function chooseJob(job) {
  const routeIndex = editingRouteIndex;
  if (routeIndex !== null && jobRoute[routeIndex]?.classId === job.id) return closeJobPicker();
  if (routeIndex === null) {
    const lastEvent = [...jobRoute].filter(event => event.level <= level).at(-1);
    if (lastEvent?.classId === job.id) return closeJobPicker();
  }
  const compatibleTypes = mountTypesByClass[job.name] || [];
  const compatible = mounts.filter(mount => compatibleTypes.includes(mount.type));
  if (compatible.length) {
    const candidate = routeIndex === null ? selectedMount : mounts.find(mount => mount.name === jobRoute[routeIndex]?.mountName);
    pendingJobSelection = { job, routeIndex, preferredMount: compatible.includes(candidate) ? candidate : null };
    pickerMode = 'mount';
    renderJobPicker();
    return;
  }
  applyJobSelection(job, routeIndex, null);
}

function applyJobSelection(job, routeIndex, mount) {
  selectedMount = mount;
  if (routeIndex !== null) {
    const routeEntry = jobRoute[routeIndex];
    if (!routeEntry) return closeJobPicker();
    jobRoute = jobRoute.slice(0, routeIndex + 1);
    routeEntry.classId = job.id;
    routeEntry.mountName = selectedMount?.name || null;
    level = routeEntry.level;
  } else {
    const retainedRoute = jobRoute.filter(event => event.level <= level);
    const lastEvent = retainedRoute[retainedRoute.length - 1];
    if (lastEvent && !lastEvent.initial && lastEvent.level === level) retainedRoute.pop();
    jobRoute = retainedRoute;
    jobRoute.push({
      classId: job.id,
      level,
      initial: false,
      leveled: false,
      mountName: selectedMount?.name || null,
    });
  }

  closeJobPicker();
  renderAll();
}

function renderMountOptions(job, preferredMount) {
  const compatibleTypes = mountTypesByClass[job?.name] || [];
  const compatible = mounts.filter(mount => compatibleTypes.includes(mount.type));
  $('jobPickerPanel').innerHTML = `<div class="job-picker-options">
    <button class="job-option mount-option ${preferredMount ? '' : 'selected'}" type="button" data-mount-choice=""><span>无配属</span></button>
    ${compatible.map(mount => `<button class="job-option mount-option ${preferredMount === mount ? 'selected' : ''}" type="button" data-mount-choice="${esc(mount.name)}"><span class="mount-option-name">${esc(mount.name)}</span><small class="mount-option-growth">成长率：${esc(mount.growth || '无')}</small></button>`).join('')}
  </div>`;
}

function chooseMount(mountName) {
  const mount = mounts.find(item => item.name === mountName) || null;
  if (pendingJobSelection) {
    applyJobSelection(pendingJobSelection.job, pendingJobSelection.routeIndex, mount);
    return;
  }
  selectedMount = mount;
  const activeEntry = currentEntry();
  if (activeEntry) activeEntry.mountName = selectedMount?.name || null;
  closeJobPicker();
  renderAll();
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
  renderAll();
}
function currentClass() {
  return classMap.get(currentEntry()?.classId) || classes.find(c => c.name === profileClassName());
}
function currentEntry() { return [...jobRoute].reverse().find(item => item.level <= level) || jobRoute[0]; }
function renderAll() {
  if (!selected) return;
  $('levelValue').textContent = level;
  $('levelDown').disabled = level <= currentMinLevel(); $('levelUp').disabled = level >= 99;
  $('levelDownFive').disabled = level <= currentMinLevel(); $('levelUpFive').disabled = level >= 99;
  renderMountPicker(); renderGrowth(); renderAbilities(); renderRoute();
}
function renderMountPicker() {
  const types = mountTypesByClass[currentClass()?.name] || [];
  if (!selectedMount || !types.includes(selectedMount.type)) selectedMount = null;
  const activeEntry = currentEntry();
  if (activeEntry) activeEntry.mountName = selectedMount?.name || null;
}
function renderGrowth() {
  const job = currentClass();
  $('growthCharacterName').textContent = selected.name;
  $('growthTotalCaption').hidden = ['平民', '贵族'].includes(job?.name);
  $('statsGrid').innerHTML = statMeta.map(([key,label]) => {
    const mountGrowthMultiplier = job?.name === '战车兵' ? 2 : 1;
    const bonus = job?.name === '战车兵'
      ? level >= 45 ? tankGrowthBonus[key] : level >= 35 ? tankMidLevelGrowthBonus[key] : 0
      : 0;
    const total = (Number(selected.growth?.[key]) || 0) + (Number(job?.growth?.[key]) || 0) + bonus + (Number(selectedMount?.growthStats?.[key]) || 0) * mountGrowthMultiplier;
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
  const startingClass = classMap.get(jobRoute.find(event => event.initial)?.classId)
    || classes.find(job => job.name === profileClassName());
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
  const bonus = active?.name === '战车兵'
    ? gainedLevel >= 45 ? tankGrowthBonus[key] : gainedLevel >= 35 ? tankMidLevelGrowthBonus[key] : 0
    : 0;
  return (charGrowth + (Number(active?.growth?.[key]) || 0) + bonus + (Number(selectedMount?.growthStats?.[key]) || 0) * mountGrowthMultiplier) / 100;
}
function classAtLevel(gainedLevel) {
  const event = [...jobRoute].reverse().find(item => item.level < gainedLevel);
  return classMap.get(event?.classId) || classes.find(c => c.name === profileClassName());
}
function renderRoute() {
  const activeEntry = currentEntry();
  const routeMarkup = jobRoute.map((entry, index) => {
    const job = classMap.get(entry.classId);
    const active = activeEntry === entry;
    const mountLabel = entry.mountName
      ? `<small class="route-mount-name">${esc(entry.mountName)}</small>`
      : '';
    return `
      <button type="button" class="route-step ${active ? 'has-job' : ''}"
        data-route-index="${index}" title="点击重新选择职业">
        <span class="route-step-heading">
          <span class="route-dot" aria-hidden="true"></span>
          <span class="route-tier">${esc(job?.tier || '基础')}</span>
        </span>
        <span class="route-level"><small>Lv.</small><b>${entry.level}</b></span>
        <span class="route-job-info">
          <b>${esc(job?.name || '未知职业')}</b>${mountLabel}
        </span>
      </button>`;
  }).join('');

  $('routeList').innerHTML = `${routeMarkup}
    <button type="button" class="route-add-button" aria-label="添加职业">＋</button>`;
}
