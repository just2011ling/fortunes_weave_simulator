import { tiers, statMeta, mountTypesByClass, tankMidLevelGrowthBonus, tankGrowthBonus } from './config.js';
import { $, fmtSigned, esc } from './utils.js';

// 当前载入的角色资料。
let characters = [];
// 当前载入的职业资料。
let classes = [];
// 按角色名称索引的章节加入情况。
let chapterCharacters = {};
// 当前载入并已解析加成的坐骑资料。
let mounts = [];
// 当前正在模拟的角色。
let selected = null;
// 当前角色选中的章节情况及其基础状态。
let selectedCase = null;
// 当前模拟等级。
let level = 1;
// 按转职顺序保存的职业节点列表，每个节点也保存自己的坐骑。
let jobRoute = [];
// 职业选择弹窗当前显示的阶级。
let pickerTier = tiers[1].name;
// 正在编辑的路线节点索引；null 表示从末尾添加职业。
let editingRouteIndex = null;
// 选择弹窗当前模式：职业或坐骑。
let pickerMode = 'job';
// 用户选定职业后、尚待坐骑选择完成的临时数据。
let pendingJobSelection = null;
// 通过职业 id 快速查找职业资料。
const classMap = new Map();
// 角色筛选条件在本地存储中使用的键名。
const characterFilterStorageKey = 'fortunes-weave-character-filters';
// 角色弹窗当前生效的性别和阵营筛选条件。
let characterFilters = { gender: '', factions: [] };

/** 初始化模拟器资料、选择器和默认角色。 */
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

/** 为角色、章节、等级、路线和弹窗控件绑定交互事件。 */
function bindSimulator() {
  $('openCharacterPicker').addEventListener('click', () => $('characterPickerDialog').showModal());
  $('closeCharacterPicker').addEventListener('click', closeCharacterPicker);
  $('genderFilterOptions').addEventListener('click', event => {
    // option 是用户点击的性别筛选项。
    const option = event.target.closest('[data-gender-filter]');
    if (!option) return;
    characterFilters.gender = option.dataset.genderFilter || '';
    saveCharacterFilters();
    renderCharacterPicker();
    $('genderFilterMenu').open = false;
  });
  $('factionFilterOptions').addEventListener('change', event => {
    // checkbox 是发生变化的阵营选项，faction 是该选项对应的阵营名称。
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
    // option 和 character 分别是点击项及其对应角色资料。
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

    // routeNode 是被点击的职业节点。
    const routeNode = event.target.closest('[data-route-index]');
    if (routeNode && !routeNode.disabled) openJobPicker(Number(routeNode.dataset.routeIndex));
  });
  $('scenarioMenuOptions').addEventListener('click', event => {
    // option 是章节选项；cases 是当前角色可选的章节情况。
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

/** 读取已保存的筛选条件并创建角色筛选菜单。 */
function initCharacterPicker() {
  // factionOptions 和 genderOptions 分别是资料中出现过的阵营与性别选项。
  const factionOptions = [...new Set(characters.map(character => character.faction).filter(Boolean))].sort();
  const genderOptions = [...new Set(characters.map(character => character.sex).filter(value => value && value !== '男/女'))].sort();
  try {
    // stored 是上次访问时保存在本地的筛选条件。
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

/** 根据当前筛选条件更新菜单状态和角色列表。 */
function renderCharacterPicker() {
  // genderSummary 是性别菜单按钮上显示的当前筛选名称。
  const genderSummary = characterFilters.gender || '全部';
  $('genderFilterSummary').textContent = genderSummary;
  $('genderFilterOptions').querySelectorAll('[data-gender-filter]').forEach(option => {
    // active 标记当前生效的性别选项。
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

  // list 是同时满足性别和阵营条件的角色；救世主不受性别筛选影响。
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

/** 将当前性别和阵营筛选条件写入本地存储。 */
function saveCharacterFilters() {
  try {
    localStorage.setItem(characterFilterStorageKey, JSON.stringify(characterFilters));
  } catch {
    // Storage may be unavailable in private browsing; filtering still works in memory.
  }
}

/** 关闭角色选择弹窗。 */
function closeCharacterPicker() {
  const dialog = $('characterPickerDialog');
  if (dialog.open) dialog.close();
}

/** 切换当前角色，并根据其默认章节重置模拟路线。 */
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

/** 创建职业阶级菜单，并绑定职业与坐骑选项事件。 */
function initJobPicker() {
  const tabs = $('jobPickerTabs');
  tabs.innerHTML = tiers.map((tier, index) => `
    <button class="job-picker-tab ${tier.name === pickerTier ? 'active' : ''}"
      id="jobTab-${index}" type="button" role="tab" data-tier="${esc(tier.name)}"
      aria-selected="${tier.name === pickerTier}" aria-controls="jobPickerPanel">
      ${esc(tier.name)}
    </button>`).join('');

  tabs.addEventListener('click', event => {
    // tab 是用户点击的职业阶级菜单项。
    const tab = event.target.closest('[data-tier]');
    if (!tab) return;
    pickerTier = tab.dataset.tier;
    renderJobPicker();
  });
  tabs.addEventListener('keydown', event => {
    // tabNames 保存阶级顺序，用于键盘方向键切换。
    const tabNames = tiers.map(tier => tier.name);
    // currentIndex 与 nextIndex 用于计算键盘切换后的阶级位置。
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
    // mountOption 与 option 分别代表坐骑项和职业项。
    const mountOption = event.target.closest('[data-mount-choice]');
    if (mountOption) {
      chooseMount(mountOption.dataset.mountChoice || null);
      return;
    }
    // option 是用户选择的职业项；job 是其职业资料。
    const option = event.target.closest('[data-class-id]');
    if (!option) return;
    const job = classMap.get(option.dataset.classId);
    if (job) chooseJob(job);
  });

  renderJobPicker();
}

/** 按当前弹窗模式渲染职业列表或坐骑列表。 */
function renderJobPicker() {
  if (pickerMode === 'mount') {
    $('jobPickerTitle').textContent = '选择坐骑';
    $('jobPickerTabs').hidden = true;
    $('jobPickerPanel').setAttribute('aria-labelledby', 'jobPickerTitle');
    // job 是待确认职业，preferredMount 是该节点当前已配属的坐骑。
    const job = pendingJobSelection?.job || currentClass();
    const preferredMount = pendingJobSelection ? pendingJobSelection.preferredMount : currentMount();
    renderMountOptions(job, preferredMount);
    return;
  }

  $('jobPickerTitle').textContent = '选择职业';
  $('jobPickerTabs').hidden = false;
  let selectedTabId = '';
  $('jobPickerTabs').querySelectorAll('[role="tab"]').forEach(tab => {
    // active 表示当前显示的阶级标签。
    const active = tab.dataset.tier === pickerTier;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    if (active) selectedTabId = tab.id;
  });
  $('jobPickerPanel').setAttribute('aria-labelledby', selectedTabId);

  // 基础阶级只列出可选的平民和贵族，其余阶级按资料完整展示。
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

/** 打开职业弹窗；提供索引时表示重新选择该路线节点。 */
function openJobPicker(routeIndex = null) {
  pickerMode = 'job';
  pendingJobSelection = null;
  editingRouteIndex = routeIndex;
  // targetJob 用于将弹窗定位到当前或被编辑节点所属的阶级。
  const targetJob = routeIndex === null
    ? currentClass()
    : classMap.get(jobRoute[routeIndex]?.classId);
  pickerTier = targetJob?.tier || tiers[1].name;
  renderJobPicker();

  const dialog = $('jobPickerDialog');
  if (!dialog.open) dialog.showModal();
}

/** 关闭职业/坐骑弹窗并清理临时编辑状态。 */
function closeJobPicker() {
  const dialog = $('jobPickerDialog');
  if (dialog.open) dialog.close();
  editingRouteIndex = null;
  pickerMode = 'job';
  pendingJobSelection = null;
}

/** 处理职业选择，并在职业可配属坐骑时转入坐骑选择。 */
function chooseJob(job) {
  // routeIndex 指定编辑节点；sameJob 标记职业未变化、只需修改该节点坐骑。
  const routeIndex = editingRouteIndex;
  let sameJob = routeIndex !== null && jobRoute[routeIndex]?.classId === job.id;
  if (routeIndex === null) {
    const lastEvent = [...jobRoute].filter(event => event.level <= level).at(-1);
    sameJob = lastEvent?.classId === job.id;
  }
  // compatibleTypes 和 compatible 是该职业可配属的坐骑类型及具体坐骑。
  const compatibleTypes = mountTypesByClass[job.name] || [];
  const compatible = mounts.filter(mount => compatibleTypes.includes(mount.type));
  if (compatible.length) {
    // targetEntry 用于保留该节点当前坐骑作为弹窗默认选项。
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

/** 将确认后的职业和坐骑写入目标节点，必要时裁剪后续路线。 */
function applyJobSelection(job, routeIndex, mount) {
  if (routeIndex !== null) {
    // routeEntry 是正在重选职业的节点。
    const routeEntry = jobRoute[routeIndex];
    if (!routeEntry) return closeJobPicker();
    jobRoute = jobRoute.slice(0, routeIndex + 1);
    routeEntry.classId = job.id;
    routeEntry.mountName = mount?.name || null;
    level = routeEntry.level;
  } else {
    // retainedRoute 只保留当前等级及之前的路线节点。
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

/** 渲染职业可配属的坐骑，并显示对应获取提示。 */
function renderMountOptions(job, preferredMount) {
  // compatibleTypes 与 compatible 分别是允许的类型和筛选后的坐骑资料。
  const compatibleTypes = mountTypesByClass[job?.name] || [];
  const compatible = mounts.filter(mount => compatibleTypes.includes(mount.type));
  const availabilityNotes = mountAvailabilityNotes(compatibleTypes);
  $('jobPickerPanel').innerHTML = `<div class="job-picker-options">
    <button class="job-option mount-option ${preferredMount ? '' : 'selected'}" type="button" data-mount-choice=""><span>无配属</span></button>
    ${compatible.map(mount => `<button class="job-option mount-option ${preferredMount === mount ? 'selected' : ''}" type="button" data-mount-choice="${esc(mount.name)}"><span class="mount-option-name">${esc(mount.name)}</span><small class="mount-option-growth">成长率：${esc(mount.growth || '无')}</small></button>`).join('')}
  </div>${availabilityNotes.length ? `<div class="mount-availability-notes">${availabilityNotes.map(note => `<p>${esc(note)}</p>`).join('')}</div>` : ''}`;
}

/** 按可配属坐骑类型生成凯伊篇第一部的获取提示。 */
function mountAvailabilityNotes(compatibleTypes) {
  const notes = [];
  if (compatibleTypes.includes('马')) notes.push('凯伊篇第一部无法获取黑马。');
  if (compatibleTypes.includes('天马') || compatibleTypes.includes('飞马')) notes.push('凯伊篇第一部无法获取红圣飞马。');
  if (compatibleTypes.includes('飞龙')) notes.push('凯伊篇第一部只能获取野生巴乌。');
  return notes;
}

/** 将坐骑名称写入对应职业节点并刷新模拟结果。 */
function chooseMount(mountName) {
  const mount = mounts.find(item => item.name === mountName) || null;
  if (pendingJobSelection) {
    if (pendingJobSelection.sameJob) {
      // targetEntry 是待比较或更新的职业节点；添加节点时职业与坐骑都相同才算重复。
      const targetEntry = pendingJobSelection.routeIndex === null
        ? currentEntry()
        : jobRoute[pendingJobSelection.routeIndex];
      const sameMount = (targetEntry?.mountName || null) === (mount?.name || null);
      if (pendingJobSelection.routeIndex === null) {
        if (sameMount) {
          closeJobPicker();
          return;
        }
        applyJobSelection(pendingJobSelection.job, null, mount);
        return;
      }
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

/** 返回当前章节情况的初始职业名称。 */
function profileClassName() { return selectedCase?.startClass || null; }
/** 返回当前章节情况的基础等级，最低为 1 级。 */
function profileLevel() { return Math.max(1, Number(selectedCase?.baseLevel) || 1); }
/** 返回当前章节情况的基础能力值。 */
function profileStats() { return selectedCase?.baseStats || null; }
/** 更新当前角色可选章节菜单及已选章节摘要。 */
function renderScenarioPicker() {
  // cases 保存当前角色的所有章节情况；selectedIndex 和 chosen 确定当前项。
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
/** 根据特定角色和初始职业查找默认配属坐骑。 */
function defaultMountForSelection() {
  // startClass 是章节初始职业；mountName 暂存对应角色的专属默认坐骑。
  const startClass = profileClassName();
  let mountName = null;
  if (selected?.name === '伊欧' && ['骑兵', '轻骑兵'].includes(startClass)) mountName = '罗西南';
  if (selected?.name === '亚历珊德拉' && ['天翼兵', '圣天翼兵'].includes(startClass)) mountName = '布克发拉斯';
  return mounts.find(mount => mount.name === mountName) || null;
}
/** 清空转职历史，并用当前章节情况重建初始职业节点。 */
function resetRoute(useDefaultMount = false) {
  // originalClass 是章节资料指定的职业，缺失时回退到基础职业。
  const originalClass = classes.find(c => c.name === profileClassName()) || classes.find(c => c.name === '平民') || classes.find(c => c.name === '贵族');
  // defaultMount 仅在切换角色或章节时按规则初始化。
  const defaultMount = useDefaultMount ? defaultMountForSelection() : null;
  level = Math.min(99, profileLevel());
  jobRoute = [{ classId: originalClass?.id || null, level, initial: true, leveled: true, mountName: defaultMount?.name || null }];
  renderAll();
}
/** 返回路线中最后一个职业节点的等级下限。 */
function currentMinLevel() {
  // lastRecorded 是最近一次发生转职的节点。
  const lastRecorded = jobRoute[jobRoute.length - 1];
  return Math.max(1, Number(lastRecorded?.level) || 1);
}
/** 将模拟等级限制在路线下限与 99 级之间，并更新升级标记。 */
function changeLevel(next) {
  // previousLevel 用于判断本次操作是否跨过升级节点。
  const previousLevel = level;
  level = Math.max(currentMinLevel(), Math.min(99, Number(next)));
  // activeBefore 是等级变更前所在的职业节点。
  const activeBefore = currentEntry();
  if (level > previousLevel && activeBefore && level > activeBefore.level) activeBefore.leveled = true;
  renderAll();
}
/** 返回当前等级生效的职业资料。 */
function currentClass() {
  return classMap.get(currentEntry()?.classId) || classes.find(c => c.name === profileClassName());
}
/** 返回当前等级生效的职业路线节点。 */
function currentEntry() { return [...jobRoute].reverse().find(item => item.level <= level) || jobRoute[0]; }
/** 刷新等级控件、坐骑兼容性、成长率、能力值和路线视图。 */
function renderAll() {
  if (!selected) return;
  // 将当前模拟等级同步到界面，并按等级边界禁用操作按钮。
  $('levelValue').textContent = level;
  $('levelDown').disabled = level <= currentMinLevel(); $('levelUp').disabled = level >= 99;
  $('levelDownFive').disabled = level <= currentMinLevel(); $('levelUpFive').disabled = level >= 99;
  syncCurrentMount(); renderGrowth(); renderAbilities(); renderRoute();
}
/** 清除当前职业节点上不兼容的坐骑配属。 */
function syncCurrentMount() {
  // types 是当前职业允许配属的坐骑类型。
  const types = mountTypesByClass[currentClass()?.name] || [];
  // entry 和 mount 分别是当前职业节点与其对应的坐骑资料。
  const entry = currentEntry();
  const mount = mounts.find(item => item.name === entry?.mountName) || null;
  if (mount && !types.includes(mount.type)) entry.mountName = null;
}
/** 返回当前等级所在节点上配属的坐骑资料。 */
function currentMount() {
  const mountName = currentEntry()?.mountName;
  return mounts.find(mount => mount.name === mountName) || null;
}
/** 计算并渲染角色与当前职业、坐骑合计的成长率。 */
function renderGrowth() {
  // job 和 mount 是当前等级对应的职业及节点坐骑。
  const job = currentClass();
  const mount = currentMount();
  $('growthCharacterName').textContent = selected.name;
  $('growthTotalCaption').hidden = ['平民', '贵族'].includes(job?.name);
  $('statsGrid').innerHTML = statMeta.map(([key,label]) => {
    // 战车兵的坐骑成长加成按两倍计入。
    const mountGrowthMultiplier = job?.name === '战车兵' ? 2 : 1;
    // bonus 是战车兵按等级获得的额外职业成长率。
    const bonus = job?.name === '战车兵'
      ? level >= 45 ? tankGrowthBonus[key] : level >= 35 ? tankMidLevelGrowthBonus[key] : 0
      : 0;
    // total 汇总角色、职业、战车兵特例和坐骑成长率。
    const total = (Number(selected.growth?.[key]) || 0) + (Number(job?.growth?.[key]) || 0) + bonus + (Number(mount?.growthStats?.[key]) || 0) * mountGrowthMultiplier;
    return `<div class="ability-stat"><span>${label}</span><b>${fmtSigned(total)}%</b></div>`;
  }).join('');
}
/** 渲染当前等级和路线对应的预期能力值。 */
function renderAbilities() {
  // job 用于显示职业标签，value 是每项属性的计算结果。
  const job = currentClass();
  $('abilityClassBadge').textContent = `Lv.${level} ${job?.name || '未知职业'}`;
  $('abilityGrid').innerHTML = statMeta.map(([key,label]) => {
    // value 是角色在当前等级的预期属性值。
    const value = expectedStat(key);
    return `<div class="ability-stat"><span>${label}</span><b>${Number.isFinite(value) ? value.toFixed(1) : '—'}</b></div>`;
  }).join('');
}
/** 计算指定属性在当前等级的预期值，包含职业转换与当前坐骑。 */
function expectedStat(key) {
  // base、charGrowth 和 baseLevel 是章节基础值、角色成长率和起始等级。
  const base = Number(profileStats()?.[key]);
  if (!Number.isFinite(base)) return NaN;
  const charGrowth = Number(selected.growth?.[key]) || 0;
  const baseLevel = profileLevel();
  // startingClass 用于将初始职业基础能力值纳入计算。
  const startingClass = classMap.get(jobRoute.find(event => event.initial)?.classId)
    || classes.find(job => job.name === profileClassName());
  // value 从章节基础能力值和初始职业修正开始逐级累计。
  let value = base + (Number(startingClass?.baseStats?.[key]) || 0);
  if (level >= baseLevel) {
    for (let lv = baseLevel + 1; lv <= level; lv++) value += growthAt(key, lv, charGrowth);
  } else {
    for (let lv = level + 1; lv <= baseLevel; lv++) value -= growthAt(key, lv, charGrowth);
  }
  // Add the starting class correction above; each transfer replaces the previous class correction.
  // previous 和 next 用于计算每次转职带来的职业基础值变化。
  let previous = startingClass;
  for (const event of jobRoute.filter(item => !item.initial)) {
    if (event.level > level) continue;
    const next = classMap.get(event.classId);
    value += (Number(next?.baseStats?.[key]) || 0) - (Number(previous?.baseStats?.[key]) || 0);
    previous = next || previous;
  }
  return value + (Number(currentMount()?.bonusStats?.[key]) || 0);
}
/** 返回某次升级时有效职业与该职业节点坐骑共同贡献的成长率。 */
function growthAt(key, gainedLevel, charGrowth) {
  // activeEntry、active 和 mount 分别代表升级前节点、职业和节点坐骑。
  const activeEntry = entryAtLevel(gainedLevel);
  const active = classMap.get(activeEntry?.classId) || classes.find(c => c.name === profileClassName());
  const mount = mounts.find(item => item.name === activeEntry?.mountName) || null;
  // 战车兵的坐骑成长率加成按两倍计入。
  const mountGrowthMultiplier = active?.name === '战车兵' ? 2 : 1;
  // bonus 是战车兵按升级后等级获得的额外成长率。
  const bonus = active?.name === '战车兵'
    ? gainedLevel >= 45 ? tankGrowthBonus[key] : gainedLevel >= 35 ? tankMidLevelGrowthBonus[key] : 0
    : 0;
  return (charGrowth + (Number(active?.growth?.[key]) || 0) + bonus + (Number(mount?.growthStats?.[key]) || 0) * mountGrowthMultiplier) / 100;
}
/** 查找指定升级发生前已经生效的路线节点。 */
function entryAtLevel(gainedLevel) { return [...jobRoute].reverse().find(item => item.level < gainedLevel) || jobRoute[0]; }
/** 按路线数据重建职业节点，并锁定初始职业节点。 */
function renderRoute() {
  // routeMarkup 是按节点顺序生成的可点击路线界面。
  const routeMarkup = jobRoute.map((entry, index) => {
    // job、initial 和 mountLabel 用于生成该节点的职业、锁定状态与坐骑信息。
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
