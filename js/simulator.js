import { tiers, statMeta, mountTypesByClass, tankMidLevelGrowthBonus, tankGrowthBonus } from './config.js';
import { $, fmtSigned, esc } from './utils.js';

let characters = [];
let classes = [];
let chapterCharacters = {};
let mounts = [];
let selected = null;
let selectedCase = null;
let level = 1;
let jobRoute = [];
let pickerTier = tiers[1].name;
let editingRouteIndex = null;
let pickerMode = 'job';
let pendingJobSelection = null;
const classMap = new Map();
const characterFilterStorageKey = 'fortunes-weave-character-filters';
let characterFilters = { gender: '', factions: [] };

export function initSimulator(data) {
  characters = data.characters;
  classes = data.classes;
  chapterCharacters = data.chapters;
  mounts = data.mounts;
  classes.forEach(job => classMap.set(job.id, job));
  initJobPicker();
  initCharacterPicker();
  bindSimulator();
  selectCharacter(characters.find(character => chapterCharacters[character.name]?.length) || characters[0]);
}

function bindSimulator() {
  $('openCharacterPicker').addEventListener('click', () => $('characterPickerDialog').showModal());
  $('closeCharacterPicker').addEventListener('click', closeCharacterPicker);
  $('genderFilterOptions').addEventListener('click', event => {
    const option = event.target.closest('[data-gender-filter]');
    if (!option) return;
    characterFilters.gender = option.dataset.genderFilter || '';
    saveCharacterFilters();
    renderCharacterPicker();
    $('genderFilterMenu').open = false;
  });
  $('factionFilterOptions').addEventListener('change', event => {
    const checkbox = event.target.closest('[data-faction-filter]');
    if (!checkbox) return;
    const faction = checkbox.dataset.factionFilter;
    characterFilters.factions = checkbox.checked
      ? [...new Set([...characterFilters.factions, faction])]
      : characterFilters.factions.filter(value => value !== faction);
    saveCharacterFilters();
    renderCharacterPicker();
  });
  $('characterPickerList').addEventListener('click', event => {
    const option = event.target.closest('[data-character-id]');
    if (!option) return;
    const character = characters.find(item => item.id === option.dataset.characterId);
    if (character) selectCharacter(character);
  });
  $('characterPickerDialog').addEventListener('click', event => {
    if (event.target === $('characterPickerDialog')) closeCharacterPicker();
  });
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
    if (routeNode && !routeNode.disabled) openJobPicker(Number(routeNode.dataset.routeIndex));
  });
  $('scenarioMenuOptions').addEventListener('click', event => {
    const option = event.target.closest('[data-scenario-index]');
    if (!option) return;
    const cases = chapterCharacters[selected?.name] || [];
    selectedCase = cases[Number(option.dataset.scenarioIndex)] || null;
    renderScenarioPicker();
    resetRoute(true);
    $('scenarioMenu').open = false;
  });
  $('scenarioMenu').addEventListener('click', event => {
    if (event.target.closest('summary') && $('scenarioMenu').classList.contains('disabled')) event.preventDefault();
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
      $('openCharacterPicker').focus();
    }
  });
}

function initCharacterPicker() {
  const factionOptions = [...new Set(characters.map(character => character.faction).filter(Boolean))].sort();
  const genderOptions = [...new Set(characters.map(character => character.sex).filter(value => value && value !== '男/女'))].sort();
  try {
    const stored = JSON.parse(localStorage.getItem(characterFilterStorageKey) || '{}');
    characterFilters = {
      gender: genderOptions.includes(stored.gender) ? stored.gender : '',
      factions: Array.isArray(stored.factions) ? stored.factions.filter(value => factionOptions.includes(value)) : [],
    };
  } catch {
    characterFilters = { gender: '', factions: [] };
  }
  $('genderFilterOptions').innerHTML = [
    `<button type="button" class="character-filter-option" data-gender-filter="" role="radio">全部</button>`,
    ...genderOptions.map(value => `<button type="button" class="character-filter-option" data-gender-filter="${esc(value)}" role="radio">${esc(value)}</button>`),
  ].join('');
  $('factionFilterOptions').innerHTML = factionOptions.map(value => `
    <label class="faction-filter-option"><input type="checkbox" data-faction-filter="${esc(value)}"><span>${esc(value)}</span></label>`).join('');
  renderCharacterPicker();
}

function renderCharacterPicker() {
  const genderSummary = characterFilters.gender || '全部';
  $('genderFilterSummary').textContent = genderSummary;
  $('genderFilterOptions').querySelectorAll('[data-gender-filter]').forEach(option => {
    const active = option.dataset.genderFilter === characterFilters.gender;
    option.setAttribute('aria-checked', String(active));
    option.classList.toggle('active', active);
  });
  $('factionFilterOptions').querySelectorAll('[data-faction-filter]').forEach(option => {
    option.checked = characterFilters.factions.includes(option.dataset.factionFilter);
  });
  $('factionFilterSummary').textContent = characterFilters.factions.length
    ? `已选 ${characterFilters.factions.length} 个阵营`
    : '全部阵营';

  const list = characters.filter(character => {
    const isAlwaysVisible = character.name === '救世主';
    const matchesGender = !characterFilters.gender || isAlwaysVisible || character.sex === characterFilters.gender;
    const matchesFaction = !characterFilters.factions.length || characterFilters.factions.includes(character.faction);
    return matchesGender && matchesFaction;
  });
  $('characterPickerList').innerHTML = list.map(character => `
    <button class="character-picker-option ${selected?.id === character.id ? 'selected' : ''}" type="button"
      role="option" aria-selected="${selected?.id === character.id}" data-character-id="${esc(character.id)}">
      <b>${esc(character.name)}</b><small>${esc(character.sex || '性别未知')} · ${esc(character.faction || '无 faction')}</small>
    </button>`).join('') || '<p class="character-picker-empty">没有符合筛选条件的角色。</p>';
}

function saveCharacterFilters() {
  try {
    localStorage.setItem(characterFilterStorageKey, JSON.stringify(characterFilters));
  } catch {
    // Storage may be unavailable in private browsing; filtering still works in memory.
  }
}

function closeCharacterPicker() {
  const dialog = $('characterPickerDialog');
  if (dialog.open) dialog.close();
}

function selectCharacter(character) {
  selected = character;
  selectedCase = (chapterCharacters[character.name] || [])[0] || null;
  renderScenarioPicker();
  resetRoute(true);
  $('openCharacterPicker').textContent = character.name;
  $('openCharacterPicker').setAttribute('aria-label', `选择角色：${character.name}`);
  renderCharacterPicker();
  closeCharacterPicker();
  renderAll();
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
    const preferredMount = pendingJobSelection ? pendingJobSelection.preferredMount : currentMount();
    renderMountOptions(job, preferredMount);
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
  let sameJob = routeIndex !== null && jobRoute[routeIndex]?.classId === job.id;
  if (routeIndex === null) {
    const lastEvent = [...jobRoute].filter(event => event.level <= level).at(-1);
    sameJob = lastEvent?.classId === job.id;
  }
  const compatibleTypes = mountTypesByClass[job.name] || [];
  const compatible = mounts.filter(mount => compatibleTypes.includes(mount.type));
  if (compatible.length) {
    const targetEntry = routeIndex === null ? currentEntry() : jobRoute[routeIndex];
    const preferredMount = mounts.find(mount => mount.name === targetEntry?.mountName) || null;
    pendingJobSelection = { job, routeIndex, sameJob, preferredMount: compatible.includes(preferredMount) ? preferredMount : null };
    pickerMode = 'mount';
    renderJobPicker();
    return;
  }
  if (sameJob) return closeJobPicker();
  applyJobSelection(job, routeIndex, null);
}

function applyJobSelection(job, routeIndex, mount) {
  if (routeIndex !== null) {
    const routeEntry = jobRoute[routeIndex];
    if (!routeEntry) return closeJobPicker();
    jobRoute = jobRoute.slice(0, routeIndex + 1);
    routeEntry.classId = job.id;
    routeEntry.mountName = mount?.name || null;
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
      mountName: mount?.name || null,
    });
  }

  closeJobPicker();
  renderAll();
}

function renderMountOptions(job, preferredMount) {
  const compatibleTypes = mountTypesByClass[job?.name] || [];
  const compatible = mounts.filter(mount => compatibleTypes.includes(mount.type));
  const availabilityNotes = mountAvailabilityNotes(compatibleTypes);
  $('jobPickerPanel').innerHTML = `<div class="job-picker-options">
    <button class="job-option mount-option ${preferredMount ? '' : 'selected'}" type="button" data-mount-choice=""><span>无配属</span></button>
    ${compatible.map(mount => `<button class="job-option mount-option ${preferredMount === mount ? 'selected' : ''}" type="button" data-mount-choice="${esc(mount.name)}"><span class="mount-option-name">${esc(mount.name)}</span><small class="mount-option-growth">成长率：${esc(mount.growth || '无')}</small></button>`).join('')}
  </div>${availabilityNotes.length ? `<div class="mount-availability-notes">${availabilityNotes.map(note => `<p>${esc(note)}</p>`).join('')}</div>` : ''}`;
}

function mountAvailabilityNotes(compatibleTypes) {
  const notes = [];
  if (compatibleTypes.includes('马')) notes.push('凯伊篇第一部无法获取黑马。');
  if (compatibleTypes.includes('天马') || compatibleTypes.includes('飞马')) notes.push('凯伊篇第一部无法获取红圣飞马。');
  if (compatibleTypes.includes('飞龙')) notes.push('凯伊篇第一部只能获取野生巴乌。');
  return notes;
}

function chooseMount(mountName) {
  const mount = mounts.find(item => item.name === mountName) || null;
  if (pendingJobSelection) {
    if (pendingJobSelection.sameJob) {
      const targetEntry = pendingJobSelection.routeIndex === null
        ? currentEntry()
        : jobRoute[pendingJobSelection.routeIndex];
      if (targetEntry) targetEntry.mountName = mount?.name || null;
      closeJobPicker();
      renderAll();
      return;
    }
    applyJobSelection(pendingJobSelection.job, pendingJobSelection.routeIndex, mount);
    return;
  }
  const activeEntry = currentEntry();
  if (activeEntry) activeEntry.mountName = mount?.name || null;
  closeJobPicker();
  renderAll();
}

function profileClassName() { return selectedCase?.startClass || null; }
function profileLevel() { return Math.max(1, Number(selectedCase?.baseLevel) || 1); }
function profileStats() { return selectedCase?.baseStats || null; }
function renderScenarioPicker() {
  const cases = chapterCharacters[selected?.name] || [];
  const selectedIndex = cases.indexOf(selectedCase);
  const chosen = cases[selectedIndex];
  $('scenarioMenu').classList.toggle('disabled', cases.length < 2);
  $('scenarioMenuSummary').textContent = chosen
    ? `${chosen.chapter || `情况 ${selectedIndex + 1}`} · Lv.${Number(chosen.baseLevel) || 1} ${chosen.startClass || ''}`
    : '暂无章节数据';
  $('scenarioMenuOptions').innerHTML = cases.length
    ? cases.map((item, index) => `<button type="button" class="character-filter-option ${item === selectedCase ? 'active' : ''}" data-scenario-index="${index}" role="radio" aria-checked="${item === selectedCase}">${esc(item.chapter || `情况 ${index + 1}`)} · Lv.${Number(item.baseLevel) || 1} ${esc(item.startClass || '')}</button>`).join('')
    : '<p class="character-picker-empty">暂无章节数据。</p>';
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
  const defaultMount = useDefaultMount ? defaultMountForSelection() : null;
  level = Math.min(99, profileLevel());
  jobRoute = [{ classId: originalClass?.id || null, level, initial: true, leveled: true, mountName: defaultMount?.name || null }];
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
  syncCurrentMount(); renderGrowth(); renderAbilities(); renderRoute();
}
function syncCurrentMount() {
  const types = mountTypesByClass[currentClass()?.name] || [];
  const entry = currentEntry();
  const mount = mounts.find(item => item.name === entry?.mountName) || null;
  if (mount && !types.includes(mount.type)) entry.mountName = null;
}
function currentMount() {
  const mountName = currentEntry()?.mountName;
  return mounts.find(mount => mount.name === mountName) || null;
}
function renderGrowth() {
  const job = currentClass();
  const mount = currentMount();
  $('growthCharacterName').textContent = selected.name;
  $('growthTotalCaption').hidden = ['平民', '贵族'].includes(job?.name);
  $('statsGrid').innerHTML = statMeta.map(([key,label]) => {
    const mountGrowthMultiplier = job?.name === '战车兵' ? 2 : 1;
    const bonus = job?.name === '战车兵'
      ? level >= 45 ? tankGrowthBonus[key] : level >= 35 ? tankMidLevelGrowthBonus[key] : 0
      : 0;
    const total = (Number(selected.growth?.[key]) || 0) + (Number(job?.growth?.[key]) || 0) + bonus + (Number(mount?.growthStats?.[key]) || 0) * mountGrowthMultiplier;
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
  return value + (Number(currentMount()?.bonusStats?.[key]) || 0);
}
function growthAt(key, gainedLevel, charGrowth) {
  const activeEntry = entryAtLevel(gainedLevel);
  const active = classMap.get(activeEntry?.classId) || classes.find(c => c.name === profileClassName());
  const mount = mounts.find(item => item.name === activeEntry?.mountName) || null;
  const mountGrowthMultiplier = active?.name === '战车兵' ? 2 : 1;
  const bonus = active?.name === '战车兵'
    ? gainedLevel >= 45 ? tankGrowthBonus[key] : gainedLevel >= 35 ? tankMidLevelGrowthBonus[key] : 0
    : 0;
  return (charGrowth + (Number(active?.growth?.[key]) || 0) + bonus + (Number(mount?.growthStats?.[key]) || 0) * mountGrowthMultiplier) / 100;
}
function entryAtLevel(gainedLevel) { return [...jobRoute].reverse().find(item => item.level < gainedLevel) || jobRoute[0]; }
function renderRoute() {
  const routeMarkup = jobRoute.map((entry, index) => {
    const job = classMap.get(entry.classId);
    const initial = entry.initial;
    const mountLabel = `<small class="route-mount-name">${entry.mountName ? esc(entry.mountName) : '&nbsp;'}</small>`;
    return `
      <button type="button" class="route-step" ${initial ? 'disabled aria-disabled="true"' : ''}
        data-route-index="${index}" title="${initial ? '初始职业不可更改' : '点击重新选择职业'}">
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
