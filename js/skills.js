import { tiers, statMeta } from './config.js';
import { $, esc } from './utils.js';

// 当前凹点辅助页面可选择的角色与职业资料。
let characters = [];
let classes = [];
// 当前角色、记录弹窗所选职业和职业列表分类。
let selectedCharacter = null;
let selectedJob = null;
let selectedTier = tiers[1].name;
// 当前正在编辑的记录索引；null 表示新增记录。
let editingRecordIndex = null;
// 按角色 id 保存本次页面会话中的凹点记录。
const recordsByCharacter = new Map();
// 本地存储中保存所选角色 id 和所有角色的凹点记录。
const skillsStorageKey = 'fortunes-weave-skill-assist';
// 与转职模拟共用的角色筛选条件存储键和当前筛选状态。
const characterFilterStorageKey = 'fortunes-weave-character-filters';
let characterFilters = { gender: '', factions: [] };
// 凹点辅助只开放基础至上级职业。
const supportedTiers = tiers.slice(0, tiers.findIndex(tier => tier.name === '上级') + 1);

/** 初始化凹点辅助页面及其角色、职业和属性选择控件。 */
export function initSkillAssist(data) {
  characters = data.characters;
  classes = data.classes;
  selectedJob = classes.find(job => job.name === '平民') || classes[0] || null;
  restoreSkillState();
  restoreCharacterFilters();
  renderStats();
  renderInferenceFields();
  renderJobTabs();
  renderJobs();
  bindSkillAssist();
  renderRecords();
}

/** 为页面按钮、弹窗、筛选项和记录表单绑定事件。 */
function bindSkillAssist() {
  $('skillsCharacterButton').addEventListener('click', openCharacterPicker);
  $('closeSkillsCharacter').addEventListener('click', () => $('skillsCharacterDialog').close());
  $('skillsCharacterList').addEventListener('click', event => {
    // option 是用户选择的角色按钮。
    const option = event.target.closest('[data-character-id]');
    if (!option) return;
    selectedCharacter = characters.find(character => character.id === option.dataset.characterId) || null;
    $('skillsCharacterButton').textContent = selectedCharacter?.name || '选择角色';
    saveSkillState();
    $('skillsCharacterDialog').close();
    renderRecords();
    renderInferenceFields();
  });
  $('skillsCharacterDialog').addEventListener('click', event => {
    if (event.target === $('skillsCharacterDialog')) $('skillsCharacterDialog').close();
  });
  $('skillsGenderFilterOptions').addEventListener('click', event => {
    // option 是用户点击的性别筛选项。
    const option = event.target.closest('[data-skills-gender-filter]');
    if (!option) return;
    characterFilters.gender = option.dataset.skillsGenderFilter || '';
    saveCharacterFilters();
    renderSkillsCharacterPicker();
    $('skillsGenderFilterMenu').open = false;
  });
  $('skillsFactionFilterOptions').addEventListener('change', event => {
    // checkbox 与 faction 分别是阵营复选框和其对应阵营名称。
    const checkbox = event.target.closest('[data-skills-faction-filter]');
    if (!checkbox) return;
    const faction = checkbox.dataset.skillsFactionFilter;
    characterFilters.factions = checkbox.checked
      ? [...new Set([...characterFilters.factions, faction])]
      : characterFilters.factions.filter(value => value !== faction);
    saveCharacterFilters();
    renderSkillsCharacterPicker();
  });
  $('addSkillRecord').addEventListener('click', openRecordDialog);
  $('inferBestJob').addEventListener('click', renderBestJobInference);
  $('resetSkillRecords').addEventListener('click', resetSkillRecords);
  $('closeInferenceResult').addEventListener('click', () => $('inferenceResultDialog').close());
  $('inferenceResultDialog').addEventListener('click', event => {
    if (event.target === $('inferenceResultDialog')) $('inferenceResultDialog').close();
  });
  $('closeSkillRecord').addEventListener('click', () => $('skillRecordDialog').close());
  $('chooseSkillJob').addEventListener('click', () => $('skillsJobDialog').showModal());
  $('closeSkillsJob').addEventListener('click', () => $('skillsJobDialog').close());
  $('skillsJobTabs').addEventListener('click', event => {
    // tab 是用户切换的职业分类。
    const tab = event.target.closest('[data-tier]');
    if (!tab) return;
    selectedTier = tab.dataset.tier;
    renderJobTabs();
    renderJobs();
  });
  $('skillsJobPanel').addEventListener('click', event => {
    // option 是用户选择的职业项。
    const option = event.target.closest('[data-class-id]');
    if (!option) return;
    selectedJob = classes.find(job => job.id === option.dataset.classId) || selectedJob;
    $('skillRecordJobName').textContent = selectedJob?.name || '平民';
    $('skillsJobDialog').close();
  });
  $('skillRecordForm').addEventListener('submit', event => {
    event.preventDefault();
    if (!selectedCharacter) return;
    // stats 收集本次勾选的凹点属性键。
    const stats = [...$('skillStatGrid').querySelectorAll('input:checked')].map(input => input.value);
    // records 是当前角色已有的记录数组，新增项保留职业资料和所选属性。
    const records = recordsByCharacter.get(selectedCharacter.id) || [];
    if (editingRecordIndex === null) records.push({ job: selectedJob, stats });
    else records[editingRecordIndex] = { job: selectedJob, stats };
    recordsByCharacter.set(selectedCharacter.id, records);
    saveSkillState();
    editingRecordIndex = null;
    $('skillRecordDialog').close();
    renderRecords();
  });
  $('skillsRecordList').addEventListener('click', event => {
    // editButton 与 deleteButton 分别触发记录编辑和删除。
    const editButton = event.target.closest('[data-edit-record]');
    const deleteButton = event.target.closest('[data-delete-record]');
    const index = Number(editButton?.dataset.editRecord ?? deleteButton?.dataset.deleteRecord);
    if (!Number.isInteger(index)) return;
    const records = recordsByCharacter.get(selectedCharacter?.id) || [];
    if (!records[index]) return;
    if (deleteButton) {
      records.splice(index, 1);
      recordsByCharacter.set(selectedCharacter.id, records);
      saveSkillState();
      renderRecords();
      return;
    }
    editingRecordIndex = index;
    $('skillRecordTitle').textContent = '编辑记录';
    selectedJob = records[index].job;
    $('skillRecordJobName').textContent = selectedJob?.name || '平民';
    $('skillStatGrid').querySelectorAll('input').forEach(input => {
      input.checked = records[index].stats.includes(input.value);
    });
    $('skillRecordDialog').showModal();
  });
  $('skillRecordDialog').addEventListener('click', event => {
    if (event.target === $('skillRecordDialog')) $('skillRecordDialog').close();
  });
}

/** 打开角色列表弹窗，并按角色资料生成可选项。 */
function openCharacterPicker() {
  restoreCharacterFilters();
  renderSkillsCharacterPicker();
  $('skillsCharacterDialog').showModal();
}

/** 从共享本地存储恢复转职模拟使用的性别和阵营筛选条件。 */
function restoreCharacterFilters() {
  try {
    // storedFilters 是转职模拟角色弹窗保存的筛选状态。
    const storedFilters = JSON.parse(localStorage.getItem(characterFilterStorageKey) || '{}');
    const validGenders = [...new Set(characters.map(character => character.sex).filter(value => value && value !== '男/女'))];
    const validFactions = [...new Set(characters.map(character => character.faction).filter(Boolean))];
    characterFilters = {
      gender: validGenders.includes(storedFilters.gender) ? storedFilters.gender : '',
      factions: Array.isArray(storedFilters.factions) ? storedFilters.factions.filter(value => validFactions.includes(value)) : [],
    };
  } catch {
    characterFilters = { gender: '', factions: [] };
  }
}

/** 将凹点辅助中的筛选选择写回转职模拟共用的本地存储。 */
function saveCharacterFilters() {
  try {
    localStorage.setItem(characterFilterStorageKey, JSON.stringify(characterFilters));
  } catch {
    // 本地存储不可用时，筛选仍在当前页面会话中有效。
  }
}

/** 按性别和阵营筛选角色，并同步两个菜单的当前选中状态。 */
function renderSkillsCharacterPicker() {
  // genderOptions 排除男/女合并选项；救世主仍始终显示。
  const genderOptions = [...new Set(characters.map(character => character.sex).filter(value => value && value !== '男/女'))].sort();
  const factionOptions = [...new Set(characters.map(character => character.faction).filter(Boolean))].sort();
  $('skillsGenderFilterOptions').innerHTML = [
    '<button type="button" class="character-filter-option" data-skills-gender-filter="" role="radio">全部</button>',
    ...genderOptions.map(value => `<button type="button" class="character-filter-option" data-skills-gender-filter="${esc(value)}" role="radio">${esc(value)}</button>`),
  ].join('');
  $('skillsFactionFilterOptions').innerHTML = factionOptions.map(value => `
    <label class="faction-filter-option"><input type="checkbox" data-skills-faction-filter="${esc(value)}"><span>${esc(value)}</span></label>`).join('');
  $('skillsGenderFilterSummary').textContent = characterFilters.gender || '全部';
  $('skillsGenderFilterOptions').querySelectorAll('[data-skills-gender-filter]').forEach(option => {
    // active 标记当前生效的性别选项。
    const active = option.dataset.skillsGenderFilter === characterFilters.gender;
    option.setAttribute('aria-checked', String(active));
    option.classList.toggle('active', active);
  });
  $('skillsFactionFilterOptions').querySelectorAll('[data-skills-faction-filter]').forEach(option => {
    option.checked = characterFilters.factions.includes(option.dataset.skillsFactionFilter);
  });
  $('skillsFactionFilterSummary').textContent = characterFilters.factions.length
    ? `已选 ${characterFilters.factions.length} 个阵营`
    : '全部阵营';
  // list 只展示同时满足性别与阵营条件的角色。
  const list = characters.filter(character => {
    const isAlwaysVisible = character.name === '救世主';
    const matchesGender = !characterFilters.gender || isAlwaysVisible || character.sex === characterFilters.gender;
    const matchesFaction = !characterFilters.factions.length || characterFilters.factions.includes(character.faction);
    return matchesGender && matchesFaction;
  });
  $('skillsCharacterList').innerHTML = list.map(character => `
    <button class="character-picker-option ${selectedCharacter?.id === character.id ? 'selected' : ''}" type="button"
      role="option" aria-selected="${selectedCharacter?.id === character.id}" data-character-id="${esc(character.id)}">
      <b>${esc(character.name)}</b><small>${esc(character.sex || '性别未知')} · ${esc(character.faction || '无 faction')}</small>
    </button>`).join('') || '<p class="character-picker-empty">没有符合筛选条件的角色。</p>';
}

/** 从本地存储恢复上次选择的角色与各角色记录。 */
function restoreSkillState() {
  try {
    // savedState 保存选中角色 id 和以角色 id 为键的记录列表。
    const savedState = JSON.parse(localStorage.getItem(skillsStorageKey) || '{}');
    selectedCharacter = characters.find(character => character.id === savedState.selectedCharacterId) || null;
    Object.entries(savedState.recordsByCharacter || {}).forEach(([characterId, savedRecords]) => {
      // records 仅保留当前游戏数据中仍存在的职业及有效属性。
      const records = Array.isArray(savedRecords)
        ? savedRecords.map(record => ({
          job: classes.find(job => job.id === record.classId) || classes.find(job => job.name === record.jobName) || null,
          stats: Array.isArray(record.stats) ? record.stats.filter(key => statMeta.some(([statKey]) => statKey === key)) : [],
        })).filter(record => record.job)
        : [];
      if (records.length) recordsByCharacter.set(characterId, records);
    });
    $('skillsCharacterButton').textContent = selectedCharacter?.name || '选择角色';
  } catch {
    selectedCharacter = null;
  }
}

/** 将当前角色选择和各角色记录写入本地存储。 */
function saveSkillState() {
  try {
    // recordsByCharacterData 将职业对象压缩为稳定的职业 id 后保存。
    const recordsByCharacterData = Object.fromEntries([...recordsByCharacter].map(([characterId, records]) => [
      characterId,
      records.map(record => ({ classId: record.job?.id, jobName: record.job?.name, stats: record.stats })),
    ]));
    localStorage.setItem(skillsStorageKey, JSON.stringify({
      selectedCharacterId: selectedCharacter?.id || null,
      selectedCharacterName: selectedCharacter?.name || null,
      recordsByCharacter: recordsByCharacterData,
    }));
  } catch {
    // 本地存储不可用时页面记录仍可在当前会话中使用。
  }
}

/** 打开新增记录弹窗并重置属性勾选状态。 */
function openRecordDialog() {
  if (!selectedCharacter) {
    openCharacterPicker();
    return;
  }
  editingRecordIndex = null;
  $('skillRecordTitle').textContent = '新增记录';
  selectedJob = classes.find(job => job.name === '平民') || classes[0] || null;
  $('skillRecordJobName').textContent = selectedJob?.name || '平民';
  $('skillStatGrid').querySelectorAll('input').forEach(input => { input.checked = false; });
  $('skillRecordDialog').showModal();
}

/** 按要求的两列五行顺序创建九项属性多选框。 */
function renderStats() {
  // positions 将属性键映射到网格行列，右侧首行有意留空。
  const positions = { hp: [1, 1], str: [1, 2], def: [2, 2], mag: [1, 3], res: [2, 3], spd: [1, 4], lck: [2, 4], dex: [1, 5], cha: [2, 5] };
  $('skillStatGrid').innerHTML = `<legend>选择成长属性</legend>${statMeta.map(([key, label]) => {
    // row 和 column 分别是该属性在多选表单中的行列位置。
    const [column, row] = positions[key];
    return `<label class="skill-stat-option" style="grid-column:${column};grid-row:${row}">
      <input type="checkbox" value="${esc(key)}"><span>${esc(label)}</span>
    </label>`;
  }).join('')}`;
}

/** 展示九项属性推断出的随机数范围。 */
function renderInferenceFields() {
  // positions 与凹点选择表单保持相同的两列五行布局。
  const positions = { hp: [1, 1], str: [1, 2], def: [2, 2], mag: [1, 3], res: [2, 3], spd: [1, 4], lck: [2, 4], dex: [1, 5], cha: [2, 5] };
  // records 是当前角色的成长观察；rangeByStat 汇总每项属性允许的随机数区间。
  const records = selectedCharacter ? recordsByCharacter.get(selectedCharacter.id) || [] : [];
  const rangeByStat = inferRandomRanges(records);
  $('randomInferenceGrid').innerHTML = statMeta.map(([key, label]) => {
    // column 和 row 标明属性格位置，rangeText 显示推断区间的最小值与最大值。
    const [column, row] = positions[key];
    const range = records.length ? rangeByStat[key] : null;
    const rangeText = !range ? '??' : range.min > range.max ? '无解' : `${range.min}–${range.max}`;
    return `<label class="inference-stat" style="grid-column:${column};grid-row:${row}">
      <span class="inference-stat-label">${esc(label)}</span>
      <b aria-label="${esc(label)}随机数范围">${rangeText}</b>
    </label>`;
  }).join('');
}

/** 交叉计算各属性在多条凹点记录下共同满足的 0–99 随机数区间。 */
function inferRandomRanges(records) {
  // ranges 为每项属性维护当前仍可能的随机数最小值和最大值。
  const ranges = Object.fromEntries(statMeta.map(([key]) => [key, { min: 0, max: 99 }]));
  records.forEach(record => {
    statMeta.forEach(([key]) => {
      // growthRate 是角色成长率与该条记录职业成长率之和；success 表示该属性在记录中被勾选。
      const growthRate = (Number(selectedCharacter?.growth?.[key]) || 0) + (Number(record.job?.growth?.[key]) || 0);
      const success = record.stats.includes(key);
      const range = ranges[key];
      if (growthRate >= 100) {
        if (!success) range.min = 100;
      } else if (success) {
        range.max = Math.min(range.max, Math.ceil(growthRate) - 1);
      } else {
        range.min = Math.max(range.min, Math.ceil(growthRate));
      }
    });
  });
  return ranges;
}

/** 用各属性随机数区间最大值，查找预期成长属性项数最多的职业。 */
function renderBestJobInference() {
  if (!selectedCharacter) return;
  // records 与 randomRanges 分别是当前角色的凹点记录和各属性随机数区间。
  const records = recordsByCharacter.get(selectedCharacter.id) || [];
  const randomRanges = inferRandomRanges(records);
  // knownStats 仅包含有有效随机数最大值的属性项。
  const knownStats = statMeta.map(([key, label]) => ({ key, label, range: randomRanges[key] }))
    .filter(stat => stat.range && stat.range.min <= stat.range.max);
  if (!knownStats.length) {
    $('inferenceResultList').innerHTML = '<p class="skills-record-empty">当前记录无法推导有效随机数，请检查凹点记录。</p>';
    $('inferenceResultDialog').showModal();
    return;
  }
  // candidates 保存各职业按属性最大随机数计算出的成长属性列表。
  const candidates = classes.filter(job => supportedTiers.some(tier => tier.name === job.tier)).map(job => {
    const gainedStats = knownStats.filter(stat => {
      // growthRate 是角色与职业成长率之和，randomValue 取该属性推断区间最大值。
      const growthRate = (Number(selectedCharacter.growth?.[stat.key]) || 0) + (Number(job.growth?.[stat.key]) || 0);
      const randomValue = stat.range.max;
      return growthRate >= 100 || growthRate > randomValue;
    });
    return { job, gainedStats };
  });
  const maxCount = Math.max(...candidates.map(candidate => candidate.gainedStats.length));
  // bestCandidates 是预期成长属性项数并列最高的职业。
  const bestCandidates = candidates.filter(candidate => candidate.gainedStats.length === maxCount);
  $('inferenceResultList').innerHTML = `<p class="inference-result-summary">按 ${knownStats.length} 项有效随机数推导，最多可成长 ${maxCount} 项属性。</p>
    ${bestCandidates.map(({ job, gainedStats }) => `<article class="inference-result-item">
      <b>${esc(job.name)}</b><span>${gainedStats.map(stat => esc(stat.label)).join('、') || '无成长属性'}</span>
    </article>`).join('')}`;
  $('inferenceResultDialog').showModal();
}

/** 创建职业分类标签并同步当前分类状态。 */
function renderJobTabs() {
  $('skillsJobTabs').innerHTML = supportedTiers.map((tier, index) => `
    <button class="job-picker-tab ${tier.name === selectedTier ? 'active' : ''}" id="skillsJobTab-${index}"
      type="button" role="tab" data-tier="${esc(tier.name)}" aria-selected="${tier.name === selectedTier}">
      ${esc(tier.name)}
    </button>`).join('');
}

/** 根据当前分类展示可选职业。 */
function renderJobs() {
  // jobs 是当前分类且不高于上级的职业，基础阶级沿用模拟器的职业筛选规则。
  const jobs = selectedTier === '基础'
    ? classes.filter(job => job.tier === '基础' && ['平民', '贵族'].includes(job.name))
    : classes.filter(job => supportedTiers.some(tier => tier.name === job.tier) && job.tier === selectedTier);
  $('skillsJobPanel').innerHTML = jobs.length
    ? `<div class="job-picker-options">${jobs.map(job => `
        <button class="job-option" type="button" data-class-id="${esc(job.id)}"><span>${esc(job.name)}</span></button>`).join('')}</div>`
    : '<p class="job-picker-empty">这个分类暂无职业资料。</p>';
}

/** 展示当前角色已保存的职业与成长属性记录。 */
function renderRecords() {
  $('addSkillRecord').disabled = !selectedCharacter;
  renderInferenceFields();
  // records 只读取当前角色的记录，因此切换角色不会丢失其他角色的结果。
  const records = selectedCharacter ? recordsByCharacter.get(selectedCharacter.id) || [] : [];
  $('inferBestJob').disabled = !selectedCharacter || !records.length;
  $('resetSkillRecords').disabled = !selectedCharacter || !records.length;
  if (!selectedCharacter || !records.length) {
    $('skillsRecordList').innerHTML = `<p class="skills-record-empty">${selectedCharacter ? '还没有凹点记录，点击“新增记录”开始添加。' : '选择角色后，添加凹点记录。'}</p>`;
    return;
  }
  // cards 将每条记录格式化为职业标题、操作按钮与已选属性标签。
  const cards = records.map((record, index) => {
    // labels 将记录中的属性键转换为可读名称。
    const labels = record.stats.map(key => statMeta.find(([statKey]) => statKey === key)?.[1]).filter(Boolean);
    return `<article class="skills-record-item"><header><b>${esc(record.job?.name || '平民')}</b><div class="skills-record-actions">
      <button type="button" data-edit-record="${index}">编辑</button><button type="button" data-delete-record="${index}">删除</button>
      </div></header>
      <p>${labels.length ? labels.map(label => `<span class="skill-record-tag">${esc(label)}</span>`).join('') : '<small>未选择成长属性</small>'}</p></article>`;
  }).join('');
  $('skillsRecordList').innerHTML = cards;
}

/** 清除当前角色的凹点记录并同步保存及推断视图。 */
function resetSkillRecords() {
  if (!selectedCharacter) return;
  recordsByCharacter.delete(selectedCharacter.id);
  saveSkillState();
  renderRecords();
}
