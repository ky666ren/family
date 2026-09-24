// ===== Global State =====
let currentView = 'dashboard';
let families = [];
let characters = [];
let marriages = [];
let parentChildRelations = [];
let occupationTags = [];
let currentCharacterId = null;
let tagLibrary = [];
let currentCharacter = null;
let currentCharacterTags = [];
let tagEditId = null;
let detailRelationContext = null;
let detailRelationCandidates = [];
let memoryCategories = [];
let memoryList = [];
let memoryPage = 1;
const MEMORY_PER_PAGE = 20;
let lifeEventRelatedIds = [];
let lifeEventCategoryId = null;
let editingLifeEventId = null;

// ===== API Helpers =====
const api = {
  async get(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  },
  async post(url, data) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  },
  async put(url, data) {
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  },
  async delete(url) {
    const response = await fetch(url, { method: 'DELETE' });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  }
};

// ===== Toast Notification =====
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// ===== View Management =====
function showView(viewName) {
  document.querySelectorAll('.view').forEach(view => {
    view.classList.remove('active');
  });
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });
  
  document.getElementById(`view-${viewName}`).classList.add('active');
  document.querySelector(`[data-view="${viewName}"]`).classList.add('active');
  
  currentView = viewName;
  
  switch(viewName) {
    case 'dashboard':
      loadDashboard();
      break;
    case 'families':
      loadFamilies();
      break;
    case 'characters':
      loadCharacters();
      break;
    case 'tree':
      loadTreeOptions();
      break;
    case 'memories':
      loadMemories();
      break;
    case 'settings':
      loadSettings();
      break;
  }
}

// ===== Dashboard =====
async function loadDashboard() {
  try {
    await loadChapters();
  } catch (e) {
    showToast('加载篇章失败: ' + e.message, 'error');
  }
}

async function loadChapters() {
  const result = await api.get('/api/chapters');
  const chapters = result.chapters || [];
  const activeId = result.activeId || null;
  renderChapterList(chapters, activeId);
}

function renderChapterList(chapters, activeId) {
  const container = document.getElementById('chapter-list');
  if (!container) return;

  if (!chapters.length) {
    container.innerHTML = `
      <div class="chapter-empty">
        <p>还没有篇章，开启一个属于你的故事吧。</p>
        <button class="btn btn-primary" onclick="openChapterModal()">开启新篇章</button>
      </div>
    `;
    return;
  }

  container.innerHTML = chapters.map(chapter => {
    const isActive = chapter.id === activeId;
    return `
      <div class="chapter-card ${isActive ? 'active' : ''}">
        <div class="chapter-icon">卷</div>
        <div class="chapter-info">
          <div class="chapter-name">${chapter.name}</div>
          <div class="chapter-date">${formatChapterDate(chapter.updated_at)}</div>
        </div>
        <div class="chapter-actions">
          <button class="btn btn-sm ${isActive ? 'btn-secondary' : 'btn-primary'}" onclick="activateChapter('${chapter.id}')">${isActive ? '当前篇章' : '继续'}</button>
          <button class="btn btn-sm btn-danger" onclick="deleteChapter('${chapter.id}')">删除</button>
        </div>
      </div>
    `;
  }).join('');
}

function formatChapterDate(isoDate) {
  if (!isoDate) return '刚刚';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return '刚刚';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function openChapterModal() {
  document.getElementById('chapter-name').value = '';
  document.getElementById('chapter-modal').classList.add('active');
}

function closeChapterModal() {
  document.getElementById('chapter-modal').classList.remove('active');
}

async function saveChapter(e) {
  e.preventDefault();
  const name = document.getElementById('chapter-name').value.trim();
  if (!name) return;
  try {
    await api.post('/api/chapters', { name });
    closeChapterModal();
    showToast('新篇章已开启');
    await loadChapters();
  } catch (e) {
    showToast('开启篇章失败: ' + e.message, 'error');
  }
}

async function activateChapter(id) {
  try {
    await api.post(`/api/chapters/${id}/activate`);
    await loadChapters();
    showToast('已切换篇章');
  } catch (e) {
    showToast('切换篇章失败: ' + e.message, 'error');
  }
}

async function deleteChapter(id) {
  if (!confirm('确定要删除这个篇章吗？该篇章的所有家族和角色都会被删除。')) return;
  try {
    await api.delete(`/api/chapters/${id}`);
    await loadChapters();
    showToast('篇章已删除');
  } catch (e) {
    showToast('删除篇章失败: ' + e.message, 'error');
  }
}

// ===== Families =====
async function loadFamilies() {
  try {
    families = await api.get('/api/families');
    characters = await api.get('/api/characters');
    renderFamilies();
  } catch (e) {
    showToast('加载家族失败: ' + e.message, 'error');
  }
}

function renderFamilies() {
  const tbody = document.getElementById('families-list');
  tbody.innerHTML = families.map(family => {
    const memberCount = characters.filter(c => c.family_id === family.id).length;
    return `
      <tr>
        <td>${family.name}</td>
        <td>${memberCount}</td>
        <td>${family.notes || '-'}</td>
        <td class="actions">
          <button class="btn btn-sm btn-secondary" onclick="editFamily('${family.id}')">编辑</button>
          <button class="btn btn-sm btn-danger" onclick="deleteFamily('${family.id}')">删除</button>
        </td>
      </tr>
    `;
  }).join('');
}

function filterFamilies() {
  const query = document.getElementById('family-search').value.toLowerCase();
  const filtered = families.filter(f => f.name.toLowerCase().includes(query));
  const tbody = document.getElementById('families-list');
  tbody.innerHTML = filtered.map(family => {
    const memberCount = characters.filter(c => c.family_id === family.id).length;
    return `
      <tr>
        <td>${family.name}</td>
        <td>${memberCount}</td>
        <td>${family.notes || '-'}</td>
        <td class="actions">
          <button class="btn btn-sm btn-secondary" onclick="editFamily('${family.id}')">编辑</button>
          <button class="btn btn-sm btn-danger" onclick="deleteFamily('${family.id}')">删除</button>
        </td>
      </tr>
    `;
  }).join('');
}

let familyModalContext = null;

function openFamilyModal(family = null) {
  familyModalContext = null;
  document.getElementById('family-modal-title').textContent = family ? '编辑家族' : '新建家族';
  document.getElementById('family-id').value = family ? family.id : '';
  document.getElementById('family-name').value = family ? family.name : '';
  document.getElementById('family-notes').value = family ? (family.notes || '') : '';
  document.getElementById('family-description').value = family ? (family.description || '') : '';
  document.getElementById('family-modal').classList.add('active');
}

function openFamilyModalFromCharacter() {
  familyModalContext = 'character';
  openFamilyModal(null);
}

function closeFamilyModal() {
  document.getElementById('family-modal').classList.remove('active');
  familyModalContext = null;
}

async function saveFamily(e) {
  e.preventDefault();
  const id = document.getElementById('family-id').value;
  const data = {
    name: document.getElementById('family-name').value,
    notes: document.getElementById('family-notes').value,
    description: document.getElementById('family-description').value
  };
  
  try {
    let savedId = id;
    if (id) {
      await api.put(`/api/families/${id}`, data);
      showToast('家族已更新');
    } else {
      const created = await api.post('/api/families', data);
      savedId = created.id;
      showToast('家族已创建');
    }

    const context = familyModalContext;
    closeFamilyModal();

    if (context === 'character') {
      families = await api.get('/api/families');
      updateFamilySelects();
      if (savedId) {
        const family = families.find(f => f.id === savedId);
        document.getElementById('character-family-input').value = family ? getFamilyDisplayName(family) : '';
      }
    } else {
      loadFamilies();
    }
  } catch (e) {
    showToast('保存失败: ' + e.message, 'error');
  }
}

async function editFamily(id) {
  const family = families.find(f => f.id === id);
  if (family) {
    openFamilyModal(family);
  }
}

async function deleteFamily(id) {
  if (!confirm('确定要删除这个家族吗？家族成员将失去家族归属。')) return;
  
  try {
    await api.delete(`/api/families/${id}`);
    showToast('家族已删除');
    loadFamilies();
  } catch (e) {
    showToast('删除失败: ' + e.message, 'error');
  }
}

function viewFamilyTree(familyId) {
  showView('tree');
  document.getElementById('tree-family-select').value = familyId;
  loadFamilyTree();
}

// ===== Characters =====
async function loadCharacters() {
  try {
    families = await api.get('/api/families');
    characters = await api.get('/api/characters');
    marriages = await api.get('/api/marriages');
    parentChildRelations = await api.get('/api/parent-child');
    tagLibrary = await api.get('/api/tags');
    
    updateFamilySelects();
    updateOccupationFilterOptions();
    renderCharacters();
  } catch (e) {
    showToast('加载角色失败: ' + e.message, 'error');
  }
}

function updateFamilySelects() {
  const selects = [
    document.getElementById('character-family-filter'),
    document.getElementById('tree-family-select')
  ];
  
  selects.forEach(select => {
    if (!select) return;
    const currentValue = select.value;
    const options = '<option value="">所有家族</option>';
    
    select.innerHTML = options + families.map(f => 
      `<option value="${f.id}">${getFamilyDisplayName(f)}</option>`
    ).join('');
    
    select.value = currentValue;
  });

  // 家族输入联想
  const datalist = document.getElementById('family-datalist');
  if (datalist) {
    datalist.innerHTML = families.map(f => 
      `<option value="${getFamilyDisplayName(f)}">${getFamilyDisplayName(f)}</option>`
    ).join('');
  }
}

function updateOccupationFilterOptions() {
  const select = document.getElementById('character-occupation-filter');
  if (!select) return;

  const currentValue = select.value;
  const occupations = new Set();
  for (const c of characters) {
    for (const occupation of parseOccupations(c.occupation)) occupations.add(occupation);
  }

  const options = '<option value="">全部职业</option>';
  select.innerHTML = options + [...occupations]
    .sort((a, b) => a.localeCompare(b, 'zh-CN'))
    .map(o => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`)
    .join('');
  select.value = currentValue;
}

function getFamilyDisplayName(family) {
  if (!family) return '';
  if (family.notes) return `${family.name}（${family.notes}）`;
  return family.name;
}

function getCharacterFamilyDisplay(char) {
  const family = families.find(f => f.id === char.family_id);
  return family ? getFamilyDisplayName(family) : '';
}

function findFamilyByDisplayName(displayName) {
  if (!displayName) return null;
  const trimmed = displayName.trim();
  return families.find(f => getFamilyDisplayName(f) === trimmed) || null;
}

function loadOriginOptions() {
  const datalist = document.getElementById('origin-datalist');
  if (!datalist) return;
  const origins = new Set();
  for (const c of characters) {
    if (c.origin) origins.add(c.origin);
  }
  datalist.innerHTML = [...origins].sort().map(o => `<option value="${o}"></option>`).join('');
}

function parseOccupations(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).map(v => v.trim()).filter(Boolean);
  const trimmed = String(value).trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map(String).map(v => v.trim()).filter(Boolean);
    } catch (_) {}
  }
  return trimmed ? [trimmed] : [];
}

function occupationStorage(value) {
  const list = parseOccupations(value);
  return list.length ? JSON.stringify(list) : null;
}

function getOccupationDisplay(value) {
  return parseOccupations(value).join('、');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderOccupationTags() {
  const container = document.getElementById('occupation-tags');
  if (!container) return;
  container.innerHTML = occupationTags.map((tag, index) => `
    <span class="occupation-tag">
      <span>${escapeHtml(tag)}</span>
      <button type="button" title="移除职业" onclick="removeOccupationTag(${index})">×</button>
    </span>
  `).join('') || '<span class="occupation-empty">暂无职业</span>';
}

function loadOccupationOptions(query = '') {
  const optionsEl = document.getElementById('occupation-options');
  const datalist = document.getElementById('occupation-datalist');
  if (!optionsEl) return;

  const seen = new Set(occupationTags);
  for (const c of characters) {
    for (const occupation of parseOccupations(c.occupation)) seen.add(occupation);
  }
  const normalized = String(query || '').trim().toLowerCase();
  const values = [...seen]
    .filter(v => !normalized || v.toLowerCase().includes(normalized))
    .sort((a, b) => a.localeCompare(b, 'zh-CN'));

  datalist.innerHTML = [...seen].sort((a, b) => a.localeCompare(b, 'zh-CN'))
    .map(v => `<option value="${escapeHtml(v)}"></option>`).join('');

  if (!values.length) {
    optionsEl.innerHTML = '<div class="occupation-empty">没有匹配的职业，输入后点击添加</div>';
    optionsEl.classList.add('show');
    return;
  }

  optionsEl.innerHTML = values.map(v => {
    const selected = occupationTags.includes(v);
    return `<button type="button" class="occupation-option ${selected ? 'selected' : ''}" data-value="${escapeHtml(v)}" onmousedown="event.preventDefault()" onclick="toggleOccupationOption(this)"><span>${escapeHtml(v)}</span>${selected ? '<span class="check">✓</span>' : ''}</button>`;
  }).join('');
}

function showOccupationOptions() {
  const optionsEl = document.getElementById('occupation-options');
  if (!optionsEl) return;
  loadOccupationOptions('');
  optionsEl.classList.add('show');
}

function hideOccupationOptions() {
  const optionsEl = document.getElementById('occupation-options');
  if (optionsEl) optionsEl.classList.remove('show');
}

function addOccupationTag(value) {
  const input = document.getElementById('character-occupation-input');
  const raw = typeof value === 'string' ? value : (input ? input.value : '');
  const tag = (raw || '').trim();
  if (!tag) return;
  if (!occupationTags.includes(tag)) occupationTags.push(tag);
  if (input) input.value = '';
  renderOccupationTags();
  showOccupationOptions();
  if (input) input.focus();
}

function removeOccupationTag(index) {
  occupationTags.splice(index, 1);
  renderOccupationTags();
  loadOccupationOptions('');
}

function toggleOccupationOption(button) {
  const value = button ? button.dataset.value : '';
  if (!value) return;
  if (occupationTags.includes(value)) {
    occupationTags = occupationTags.filter(tag => tag !== value);
  } else {
    occupationTags.push(value);
  }
  renderOccupationTags();
  loadOccupationOptions('');
}

function handleOccupationInputKeydown(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    addOccupationTag();
  } else if (event.key === ',') {
    event.preventDefault();
    addOccupationTag();
  } else if (event.key === 'Escape') {
    hideOccupationOptions();
  }
}

let characterPage = 1;
const CHARACTERS_PER_PAGE = 20;

function renderCharacters() {
  const tbody = document.getElementById('characters-list');
  const search = document.getElementById('character-search').value.toLowerCase();
  const familyFilter = document.getElementById('character-family-filter').value;
  const occupationFilter = document.getElementById('character-occupation-filter').value;
  const aliveFilter = document.getElementById('character-alive-filter').value;
  const maritalFilter = document.getElementById('character-marital-filter').value;
  
  let filtered = characters;
  if (search) {
    filtered = filtered.filter(c => 
      c.name.toLowerCase().includes(search) ||
      (c.identity && c.identity.toLowerCase().includes(search)) ||
      getOccupationDisplay(c.occupation).toLowerCase().includes(search) ||
      getCharacterTagObjects(c).map(t => t.name).join(' ').toLowerCase().includes(search)
    );
  }
  if (familyFilter) {
    filtered = filtered.filter(c => c.family_id === familyFilter);
  }
  if (occupationFilter) {
    filtered = filtered.filter(c => parseOccupations(c.occupation).includes(occupationFilter));
  }
  if (aliveFilter === 'alive') {
    filtered = filtered.filter(c => c.is_alive === 1);
  } else if (aliveFilter === 'deceased') {
    filtered = filtered.filter(c => c.is_alive !== 1);
  }
  if (maritalFilter === 'married') {
    filtered = filtered.filter(c => getMaritalStatus(c) === '已婚');
  } else if (maritalFilter === 'unmarried') {
    filtered = filtered.filter(c => getMaritalStatus(c) === '未婚');
  }

  if (characterSort.column) {
    const { column, direction } = characterSort;
    filtered = [...filtered].sort((a, b) => {
      let av, bv;
      if (column === 'family') {
        av = getCharacterFamilyDisplay(a);
        bv = getCharacterFamilyDisplay(b);
      } else if (column === 'birth') {
        av = a.birth_date || '';
        bv = b.birth_date || '';
        if (!av) av = '~';
        if (!bv) bv = '~';
      }
      return av.localeCompare(bv, 'zh-CN', { numeric: true }) * direction;
    });
  }
  
  const totalPages = Math.max(1, Math.ceil(filtered.length / CHARACTERS_PER_PAGE));
  if (characterPage > totalPages) characterPage = totalPages;
  const startIndex = (characterPage - 1) * CHARACTERS_PER_PAGE;
  const pageCharacters = filtered.slice(startIndex, startIndex + CHARACTERS_PER_PAGE);

  tbody.innerHTML = pageCharacters.map(char => {
    const spouseCount = marriages.filter(m => 
      m.character_a_id === char.id || m.character_b_id === char.id
    ).length;
    const childrenCount = parentChildRelations.filter(pc => pc.parent_id === char.id).length;
    const genderClass = char.gender || 'other';
    const birthYear = char.birth_date || '';
    const isDeceased = char.is_alive !== 1;
    const maritalStatus = getMaritalStatus(char);
    
    return `
      <tr>
        <td><div class="avatar ${genderClass}">${char.avatar_id || '?'}</div></td>
        <td>${char.name}</td>
        <td>${getGenderLabel(char.gender)}</td>
        <td>${char.identity || '-'}</td>
        <td>${getCharacterFamilyDisplay(char) || '-'}</td>
        <td>${birthYear || '-'}</td>
        <td>${spouseCount}</td>
        <td>${maritalStatus}</td>
        <td>${childrenCount}</td>
        <td><input type="checkbox" ${isDeceased ? 'checked' : ''} onclick="toggleCharacterAlive('${char.id}', this.checked)"></td>
        <td class="actions">
          <button class="btn btn-sm btn-secondary" onclick="viewCharacterDetail('${char.id}')">详情</button>
          <button class="btn btn-sm btn-secondary" onclick="editCharacter('${char.id}')">编辑</button>
          <button class="btn btn-sm btn-danger" onclick="deleteCharacter('${char.id}')">删除</button>
        </td>
      </tr>
    `;
  }).join('');

  renderCharacterPagination(filtered.length, totalPages);
  updateSortIndicators();
}

function renderCharacterPagination(totalCount, totalPages) {
  const container = document.getElementById('character-pagination');
  if (!container) return;

  let html = `<div class="pagination-info">共 ${totalCount} 个角色，第 ${characterPage} / ${totalPages} 页</div>`;
  html += '<div class="pagination-buttons">';
  html += `<button class="btn btn-sm btn-secondary" ${characterPage <= 1 ? 'disabled' : ''} onclick="changeCharacterPage(${characterPage - 1})">上一页</button>`;

  const pageButtons = [];
  const startPage = Math.max(1, characterPage - 2);
  const endPage = Math.min(totalPages, characterPage + 2);
  for (let p = startPage; p <= endPage; p++) {
    pageButtons.push(`<button class="btn btn-sm ${p === characterPage ? 'btn-primary' : 'btn-secondary'}" onclick="changeCharacterPage(${p})">${p}</button>`);
  }
  html += pageButtons.join('');

  html += `<button class="btn btn-sm btn-secondary" ${characterPage >= totalPages ? 'disabled' : ''} onclick="changeCharacterPage(${characterPage + 1})">下一页</button>`;
  html += '</div>';

  container.innerHTML = html;
}

async function toggleCharacterAlive(id, isDeceased) {
  const char = characters.find(c => c.id === id);
  if (!char) return;
  let tags = [];
  if (char.tags) {
    try { tags = JSON.parse(char.tags); } catch (_) { tags = []; }
  }
  const data = {
    name: char.name,
    gender: char.gender || null,
    family_id: char.family_id || null,
    birth_date: char.birth_date || null,
    death_date: char.death_date || null,
    avatar_id: char.avatar_id || 0,
    notes: char.notes || null,
    is_alive: !isDeceased,
    origin: char.origin || null,
    identity: char.identity || null,
    occupation: occupationStorage(char.occupation),
    tags: tags
  };
  try {
    await api.put(`/api/characters/${id}`, data);
    showToast(isDeceased ? '已标记为去世' : '已标记为在世');
    await loadCharacters();
  } catch (e) {
    showToast('更新失败: ' + e.message, 'error');
  }
}

function changeCharacterPage(page) {
  characterPage = page;
  renderCharacters();
}

function filterCharacters() {
  characterPage = 1;
  renderCharacters();
}

let characterSort = { column: '', direction: 1 };

function sortCharacters(column) {
  if (characterSort.column === column) {
    characterSort.direction *= -1;
  } else {
    characterSort.column = column;
    characterSort.direction = 1;
  }
  characterPage = 1;
  renderCharacters();
}

function updateSortIndicators() {
  const familyIndicator = document.getElementById('sort-family-indicator');
  const birthIndicator = document.getElementById('sort-birth-indicator');
  if (familyIndicator) {
    familyIndicator.textContent = characterSort.column === 'family'
      ? (characterSort.direction === 1 ? '↑' : '↓') : '';
  }
  if (birthIndicator) {
    birthIndicator.textContent = characterSort.column === 'birth'
      ? (characterSort.direction === 1 ? '↑' : '↓') : '';
  }
}

function getGenderLabel(gender) {
  const labels = { male: '男', female: '女', other: '其他' };
  return labels[gender] || '未指定';
}

function getMaritalStatus(char) {
  const hasAnyMarriage = marriages.some(m =>
    m.character_a_id === char.id || m.character_b_id === char.id
  );
  const hasPrimaryMarriage = marriages.some(m => 
    (m.character_a_id === char.id || m.character_b_id === char.id) && 
    m.marriage_kind === 'primary'
  );
  if (char.gender === 'male') return hasPrimaryMarriage ? '已婚' : '未婚';
  return hasAnyMarriage ? '已婚' : '未婚';
}

let characterModalReturnTarget = null;

function openAddCharacterForSelect(dropdownId, modalId) {
  characterModalReturnTarget = { dropdownId, modalId };
  openCharacterModal(null);
  if (modalId === 'detail-relation-modal' && detailRelationContext && detailRelationContext.config) {
    const genderSelect = document.getElementById('character-gender');
    if (genderSelect) genderSelect.value = detailRelationContext.config.gender;
  }
}

async function refreshModalCharacterSelects(modalId, targetDropdownId, savedId) {
  await loadAllCharacters();
  const char = characters.find(c => c.id === savedId);
  const target = document.getElementById(targetDropdownId);
  if (!target) return;
  if (target.tagName === 'SELECT') {
    const option = document.createElement('option');
    option.value = savedId;
    option.textContent = char ? char.name : '';
    target.appendChild(option);
    option.selected = true;
  } else {
    target.value = char ? char.name : '';
    const hidden = document.getElementById(targetDropdownId + '-id');
    if (hidden) hidden.value = savedId;
  }
  if (targetDropdownId === 'detail-relation-candidate') refreshDetailRelationDatalist();
}

function openCharacterModal(char = null) {
  document.getElementById('character-modal-title').textContent = char ? '编辑角色' : '新建角色';
  document.getElementById('character-id').value = char ? char.id : '';
  document.getElementById('character-name').value = char ? char.name : '';
  document.getElementById('character-gender').value = char ? (char.gender || '') : '';
  const familyInput = document.getElementById('character-family-input');
  if (char && char.family_id) {
    const family = families.find(f => f.id === char.family_id);
    familyInput.value = family ? getFamilyDisplayName(family) : '';
  } else {
    familyInput.value = '';
  }
  document.getElementById('character-avatar').value = char ? (char.avatar_id || 0) : 0;
  document.getElementById('character-birth').value = char ? (char.birth_date || '') : '';
  document.getElementById('character-death').value = char ? (char.death_date || '') : '';
  if (currentEraName) {
    document.getElementById('character-birth').placeholder = `${currentEraName}三年`;
    document.getElementById('character-death').placeholder = `${currentEraName}廿年`;
  }
  document.getElementById('character-origin').value = char ? (char.origin || '') : '';
  document.getElementById('character-identity').value = char ? (char.identity || '') : '';
  occupationTags = parseOccupations(char ? char.occupation : '');
  renderOccupationTags();
  loadOccupationOptions('');
  document.getElementById('character-notes').value = char ? (char.notes || '') : '';

  loadOriginOptions();
  
  document.getElementById('character-modal').classList.add('active');
}

function closeCharacterModal() {
  hideOccupationOptions();
  document.getElementById('character-modal').classList.remove('active');
  if (characterModalReturnTarget) {
    const { modalId } = characterModalReturnTarget;
    characterModalReturnTarget = null;
    document.getElementById(modalId).classList.add('active');
  }
}

async function saveCharacter(e) {
  e.preventDefault();
  const id = document.getElementById('character-id').value;
  const familyInput = document.getElementById('character-family-input').value;
  const familyId = await resolveFamilyId(familyInput);
  const existingCharacter = id ? characters.find(c => c.id === id) : null;
  
  const data = {
    name: document.getElementById('character-name').value,
    gender: document.getElementById('character-gender').value || null,
    family_id: familyId,
    avatar_id: parseInt(document.getElementById('character-avatar').value) || 0,
    birth_date: document.getElementById('character-birth').value || null,
    death_date: document.getElementById('character-death').value || null,
    is_alive: id ? (characters.find(c => c.id === id)?.is_alive === 1) : true,
    origin: document.getElementById('character-origin').value || null,
    identity: document.getElementById('character-identity').value || null,
    occupation: occupationStorage(occupationTags),
    notes: document.getElementById('character-notes').value || null,
    tags: existingCharacter ? parseCharacterTags(existingCharacter) : []
  };
  
  try {
    let savedId = id;
    if (id) {
      await api.put(`/api/characters/${id}`, data);
      showToast('角色已更新');
    } else {
      const created = await api.post('/api/characters', data);
      savedId = created.id;
      showToast('角色已创建');
    }

    const target = characterModalReturnTarget;
    characterModalReturnTarget = null;
    if (target) {
      await refreshModalCharacterSelects(target.modalId, target.dropdownId, savedId);
      document.getElementById(target.modalId).classList.add('active');
    }

    closeCharacterModal();
    await loadCharacters();

    if (currentView === 'tree') {
      const familyId = document.getElementById('tree-family-select').value || data.family_id;
      await loadTreeOptions();
      if (familyId) {
        document.getElementById('tree-family-select').value = familyId;
        await loadFamilyTree();
      }
    }
  } catch (e) {
    showToast('保存失败: ' + e.message, 'error');
  }
}

async function resolveFamilyId(input) {
  const trimmed = (input || '').trim();
  if (!trimmed) return null;

  const existing = findFamilyByDisplayName(trimmed);
  if (existing) return existing.id;

  let name = trimmed;
  let notes = '';
  const match = trimmed.match(/^(.+?)（(.+?)）$/);
  if (match) {
    name = match[1].trim();
    notes = match[2].trim();
  }

  const created = await api.post('/api/families', { name, notes });
  families.push(created);
  updateFamilySelects();
  return created.id;
}

async function editCharacter(id) {
  const char = characters.find(c => c.id === id);
  if (char) {
    openCharacterModal(char);
  }
}

async function deleteCharacter(id) {
  if (!confirm('确定要删除这个角色吗？')) return;
  
  try {
    await api.delete(`/api/characters/${id}`);
    showToast('角色已删除');
    loadCharacters();
  } catch (e) {
    showToast('删除失败: ' + e.message, 'error');
  }
}

function getSiblingIds(characterId, relations = parentChildRelations) {
  const parentIds = new Set(relations
    .filter(relation => relation.child_id === characterId)
    .map(relation => relation.parent_id));
  const siblingIds = new Set();
  for (const relation of relations) {
    if (parentIds.has(relation.parent_id) && relation.child_id !== characterId) siblingIds.add(relation.child_id);
  }
  return siblingIds;
}

function renderDetailRelationRow(label, items, addAction) {
  const chips = items.map(item => `
    <div class="relation-item ${item.className || ''}">
      <span class="relation-name" onclick="viewCharacterDetail('${item.id}')">${escapeHtml(item.name)}</span>
      ${item.type ? `<span class="relation-type">${item.type}</span>` : ''}
      ${item.deleteAction ? `<button class="btn btn-sm btn-danger" onclick="${item.deleteAction}">×</button>` : ''}
    </div>
  `).join('');
  return `
    <div class="detail-relation-row">
      <div class="detail-relation-label"><span class="detail-relation-bullet">•</span>${label}</div>
      <div class="detail-relation-values">
        ${chips || '<span class="detail-relation-empty">未设置</span>'}
        <button class="detail-relation-add" onclick="${addAction}" title="添加${label}">＋</button>
      </div>
    </div>
  `;
}
// ===== Character Detail =====
async function viewCharacterDetail(id) {
  try {
    const [char, charMarriages, relations, bonds, lifeEvents, allCharacters, allRelations, tags] = await Promise.all([
      api.get(`/api/characters/${id}`),
      api.get(`/api/marriages?character_id=${id}`),
      api.get(`/api/parent-child?character_id=${id}`),
      api.get(`/api/bonds?character_id=${id}`),
      api.get(`/api/life-events?character_id=${id}`),
      api.get('/api/characters'),
      api.get('/api/parent-child'),
      api.get('/api/tags')
    ]);
    characters = allCharacters;
    parentChildRelations = allRelations;
    tagLibrary = tags;

    const characterById = new Map(characters.map(character => [character.id, character]));
    const siblingIds = getSiblingIds(id, parentChildRelations);
    const siblings = [...siblingIds].map(siblingId => characterById.get(siblingId)).filter(Boolean);
    const fathers = relations.parents.filter(parent => parent.gender === 'male');
    const mothers = relations.parents.filter(parent => parent.gender === 'female');
    const brothers = siblings.filter(sibling => sibling.gender === 'male');
    const sisters = siblings.filter(sibling => sibling.gender === 'female');
    const sons = relations.children.filter(child => child.gender === 'male');
    const daughters = relations.children.filter(child => child.gender === 'female');
    const relationItem = relation => ({
      id: relation.id,
      name: relation.name,
      className: getRelationBirthClass(relation.birth_status),
      type: `${getRelationTypeLabel(relation.relationship_type)}${getBirthStatusLabel(relation.birth_status)}`,
      deleteAction: `deleteParentChild('${relation.pc_id}')`
    });
    const siblingItem = sibling => ({
      id: sibling.id,
      name: sibling.name,
      deleteAction: `removeSiblingRelation('${id}', '${sibling.id}')`
    });
    const marriageItem = marriage => {
      const isCharacterA = marriage.character_a_id === id;
      return {
        id: isCharacterA ? marriage.character_b_id : marriage.character_a_id,
        name: isCharacterA ? marriage.character_b_name : marriage.character_a_name,
        className: getRelationMarriageClass(marriage.marriage_kind),
        type: `${getMarriageTypeLabel(marriage.relationship_type)}${getMarriageKindLabel(marriage.marriage_kind)}`,
        deleteAction: `deleteMarriage('${marriage.id}')`
      };
    };
    const detailRelationRows = [
      renderDetailRelationRow('父亲', fathers.map(relationItem), `openDetailRelationModal('${id}', 'father')`),
      renderDetailRelationRow('母亲', mothers.map(relationItem), `openDetailRelationModal('${id}', 'mother')`),
      renderDetailRelationRow('配偶', charMarriages.map(marriageItem), `openMarriageModal('${id}')`),
      renderDetailRelationRow('兄弟', brothers.map(siblingItem), `openDetailRelationModal('${id}', 'brother')`),
      renderDetailRelationRow('姐妹', sisters.map(siblingItem), `openDetailRelationModal('${id}', 'sister')`),
      renderDetailRelationRow('子', sons.map(relationItem), `openDetailRelationModal('${id}', 'son')`),
      renderDetailRelationRow('女', daughters.map(relationItem), `openDetailRelationModal('${id}', 'daughter')`)
    ].join('');
    
    currentCharacterId = id;
    currentCharacter = char;
    currentCharacterTags = parseCharacterTags(char);
    
    document.getElementById('character-detail-title').textContent = char.name;
    
    const content = document.getElementById('character-detail-content');
    content.innerHTML = `
      <div class="character-info">
        <div class="character-info-item">
          <label>姓名</label>
          <span>${char.name}</span>
        </div>
        <div class="character-info-item">
          <label>性别</label>
          <span>${getGenderLabel(char.gender)}</span>
        </div>
        <div class="character-info-item">
          <label>家族</label>
          <span>${getCharacterFamilyDisplay(char) || '无家族'}</span>
        </div>
        <div class="character-info-item">
          <label>头像编号</label>
          <span>${char.avatar_id || '-'}</span>
        </div>
        <div class="character-info-item">
          <label>出生日期</label>
          <span>${char.birth_date || '-'}</span>
        </div>
        <div class="character-info-item">
          <label>死亡日期</label>
          <span>${char.death_date || '-'}</span>
        </div>
        <div class="character-info-item">
          <label>出身</label>
          <span>${char.origin || '-'}</span>
        </div>
        <div class="character-info-item">
          <label>爵位</label>
          <span>${char.identity || '-'}</span>
        </div>
        <div class="character-info-item">
          <label>职业</label>
          <span>${getOccupationDisplay(char.occupation) || '-'}</span>
        </div>
        <div class="character-info-item">
          <label>备注</label>
          <span>${char.notes || '-'}</span>
        </div>
      </div>

      <div class="character-tags">
        <div class="character-tags-header">
          <h4>标签</h4>
          <div class="character-tags-actions">
            <button class="btn btn-sm btn-secondary" onclick="toggleCharacterTagPicker()">添加标签</button>
            <button class="btn btn-sm btn-secondary" onclick="openTagManager()">编辑标签</button>
          </div>
        </div>
        <div class="character-tags-list" id="character-detail-tags"></div>
        <div class="character-tag-picker" id="character-tag-picker"></div>
      </div>
      
      <div class="character-relations">
        <div class="detail-relation-panel">
          ${detailRelationRows}
        </div>
        
        <h4>宿命羁绊</h4>
        <div class="relation-list">
          ${bonds.map(b => {
            const otherId = b.character_a_id === id ? b.character_b_id : b.character_a_id;
            const otherName = b.character_a_id === id ? b.character_b_name : b.character_a_name;
            return `
              <div class="relation-item" style="border-color: ${b.color || '#9a7a42'}">
                <span class="relation-name" onclick="viewCharacterDetail('${otherId}')">${otherName}</span>
                <span class="relation-type" style="color: ${b.color || '#9a7a42'}">${b.bond_label || getBondTypeLabel(b.bond_type)}</span>
                <button class="btn btn-sm btn-danger" onclick="deleteBond('${b.id}')">×</button>
              </div>
            `;
          }).join('')}
          <button class="add-relation-btn" onclick="openBondModal('${id}')">+ 添加羁绊</button>
        </div>

        <h4>往事录</h4>
        <div class="life-events">
          ${lifeEvents.map(le => `
            <div class="life-event-item">
              <span class="life-event-date">${escapeHtml(le.event_date || '日期不详')}</span>
              <span class="life-event-content">${escapeHtml(le.event_notes || '未命名事件')}</span>
              ${le.category_name ? `<span class="life-event-cat-badge" style="background:${escapeHtml(le.category_color || '#9a7a42')}">${escapeHtml(le.category_name)}</span>` : ''}
              <button class="btn btn-sm btn-secondary" onclick="editLifeEvent('${le.id}','${id}')" title="编辑">✎</button>
              <button class="btn btn-sm btn-danger" onclick="deleteLifeEvent('${le.id}')">×</button>
            </div>
          `).join('')}
          <button class="add-relation-btn" onclick="openLifeEventModal('${id}')">+ 记录往事</button>
        </div>
      </div>
    `;
    
    renderCharacterDetailTags();
    document.getElementById('character-detail-modal').classList.add('active');
  } catch (e) {
    showToast('加载角色详情失败: ' + e.message, 'error');
  }
}

function closeCharacterDetailModal() {
  document.getElementById('character-detail-modal').classList.remove('active');
  const relationModal = document.getElementById('detail-relation-modal');
  if (relationModal) relationModal.classList.remove('active');
  detailRelationContext = null;
  currentCharacterId = null;
  currentCharacter = null;
  currentCharacterTags = [];
}

function editCharacterFromDetail() {
  if (currentCharacterId) {
    const id = currentCharacterId;
    closeCharacterDetailModal();
    editCharacter(id);
  }
}

// ===== Character Tags =====
function parseCharacterTags(char) {
  if (!char || !char.tags) return [];
  try {
    const parsed = JSON.parse(char.tags);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function getCharacterTagObjects(char) {
  const ids = parseCharacterTags(char);
  return tagLibrary.filter(tag => ids.includes(tag.id));
}

function getTagById(id) {
  return tagLibrary.find(tag => tag.id === id) || null;
}

function buildCharacterPayload(char, tagsOverride) {
  return {
    name: char.name,
    gender: char.gender || null,
    family_id: char.family_id || null,
    birth_date: char.birth_date || null,
    death_date: char.death_date || null,
    avatar_id: char.avatar_id || 0,
    notes: char.notes || null,
    is_alive: char.is_alive === 1 || char.is_alive === true,
    origin: char.origin || null,
    identity: char.identity || null,
    occupation: occupationStorage(char.occupation),
    tags: tagsOverride || parseCharacterTags(char)
  };
}

function renderCharacterDetailTags() {
  const container = document.getElementById('character-detail-tags');
  if (!container) return;
  const tags = currentCharacterTags.map(getTagById).filter(Boolean);
  container.innerHTML = tags.length
    ? tags.map(tag => `<span class="character-tag" title="${escapeHtml(tag.description || tag.name)}">${escapeHtml(tag.name)}</span>`).join('')
    : '<span class="text-muted">暂无标签</span>';
}

function renderCharacterTagPicker() {
  const container = document.getElementById('character-tag-picker');
  if (!container) return;
  if (!tagLibrary.length) {
    container.innerHTML = '<div class="tag-picker-empty">暂无标签，可先点击“编辑标签”创建</div>';
    return;
  }
  container.innerHTML = tagLibrary.map(tag => {
    const selected = currentCharacterTags.includes(tag.id);
    return `<button type="button" class="tag-picker-option ${selected ? 'selected' : ''}" onclick="toggleCharacterTag('${tag.id}')">
      <span class="tag-picker-name">${escapeHtml(tag.name)}</span>
      ${tag.description ? `<span class="tag-picker-desc">${escapeHtml(tag.description)}</span>` : ''}
      <span class="tag-picker-check">${selected ? '✓' : ''}</span>
    </button>`;
  }).join('');
}

function toggleCharacterTagPicker() {
  const picker = document.getElementById('character-tag-picker');
  if (!picker) return;
  renderCharacterTagPicker();
  picker.classList.toggle('show');
}

async function toggleCharacterTag(tagId) {
  if (!currentCharacter) return;
  const index = currentCharacterTags.indexOf(tagId);
  if (index >= 0) currentCharacterTags.splice(index, 1);
  else currentCharacterTags.push(tagId);
  renderCharacterDetailTags();
  renderCharacterTagPicker();
  try {
    const payload = buildCharacterPayload(currentCharacter, currentCharacterTags);
    await api.put(`/api/characters/${currentCharacter.id}`, payload);
    currentCharacter.tags = JSON.stringify(currentCharacterTags);
    const listChar = characters.find(c => c.id === currentCharacter.id);
    if (listChar) listChar.tags = currentCharacter.tags;
  } catch (e) {
    showToast('标签保存失败: ' + e.message, 'error');
  }
}

function openTagManager() {
  const picker = document.getElementById('character-tag-picker');
  if (picker) picker.classList.remove('show');
  resetTagEditForm();
  renderTagManagerList();
  document.getElementById('tag-manager-modal').classList.add('active');
}

function closeTagManager() {
  document.getElementById('tag-manager-modal').classList.remove('active');
}

function resetTagEditForm() {
  tagEditId = null;
  const idInput = document.getElementById('tag-edit-id');
  const nameInput = document.getElementById('tag-edit-name');
  const descInput = document.getElementById('tag-edit-description');
  const title = document.getElementById('tag-editor-title');
  const submit = document.getElementById('tag-editor-submit');
  if (idInput) idInput.value = '';
  if (nameInput) nameInput.value = '';
  if (descInput) descInput.value = '';
  if (title) title.textContent = '新建标签';
  if (submit) submit.textContent = '添加标签';
}

function editTag(id) {
  const tag = getTagById(id);
  if (!tag) return;
  tagEditId = id;
  document.getElementById('tag-edit-id').value = id;
  document.getElementById('tag-edit-name').value = tag.name;
  document.getElementById('tag-edit-description').value = tag.description || '';
  document.getElementById('tag-editor-title').textContent = '编辑标签';
  document.getElementById('tag-editor-submit').textContent = '保存修改';
}

async function saveTag(e) {
  e.preventDefault();
  const id = document.getElementById('tag-edit-id').value;
  const name = document.getElementById('tag-edit-name').value.trim();
  const description = document.getElementById('tag-edit-description').value.trim();
  if (!name) {
    showToast('请输入标签名', 'error');
    return;
  }
  try {
    if (id) {
      await api.put(`/api/tags/${id}`, { name, description: description || null });
      showToast('标签已更新');
    } else {
      await api.post('/api/tags', { name, description: description || null });
      showToast('标签已创建');
    }
    tagLibrary = await api.get('/api/tags');
    resetTagEditForm();
    renderTagManagerList();
    renderCharacterDetailTags();
    renderCharacterTagPicker();
  } catch (e) {
    showToast('保存标签失败: ' + e.message, 'error');
  }
}

async function deleteTag(id) {
  if (!confirm('确定要删除这个标签吗？角色上已添加的该标签也会被移除。')) return;
  try {
    await api.delete(`/api/tags/${id}`);
    tagLibrary = await api.get('/api/tags');
    currentCharacterTags = currentCharacterTags.filter(tagId => tagId !== id);
    if (currentCharacter) currentCharacter.tags = JSON.stringify(currentCharacterTags);
    for (const c of characters) {
      const ids = parseCharacterTags(c);
      if (ids.includes(id)) c.tags = JSON.stringify(ids.filter(tagId => tagId !== id));
    }
    renderTagManagerList();
    renderCharacterDetailTags();
    renderCharacterTagPicker();
    showToast('标签已删除');
  } catch (e) {
    showToast('删除标签失败: ' + e.message, 'error');
  }
}

function renderTagManagerList() {
  const container = document.getElementById('tag-manager-list');
  if (!container) return;
  if (!tagLibrary.length) {
    container.innerHTML = '<div class="tag-manager-empty">还没有标签，先创建第一个吧。</div>';
    return;
  }
  container.innerHTML = tagLibrary.map(tag => `
    <div class="tag-manager-item">
      <div class="tag-manager-info">
        <span class="tag-manager-name">${escapeHtml(tag.name)}</span>
        ${tag.description ? `<span class="tag-manager-desc">${escapeHtml(tag.description)}</span>` : ''}
      </div>
      <div class="tag-manager-actions">
        <button class="btn btn-sm btn-secondary" onclick="editTag('${tag.id}')">编辑</button>
        <button class="btn btn-sm btn-danger" onclick="deleteTag('${tag.id}')">删除</button>
      </div>
    </div>
  `).join('');
}

function getRelationTypeLabel(type) {
  const labels = { biological: '亲生', adopted: '收养', guoji: '过继' };
  return labels[type] || '亲生';
}

function getMarriageTypeLabel(type) {
  const labels = { spouse: '配偶', former_spouse: '前配偶', other: '其他' };
  return labels[type] || '配偶';
}

function getMarriageKindLabel(kind) {
  const labels = { primary: '正室', equal: '平妻', concubine: '妾室' };
  return kind ? ' · ' + (labels[kind] || '正室') : '';
}

function getBirthStatusLabel(status) {
  const labels = { legitimate: '嫡出', concubine_born: '庶出', illegitimate: '私生' };
  return status ? ' · ' + (labels[status] || '') : '';
}

function getRelationBirthClass(status) {
  const map = {
    legitimate: 'relation-prime',
    concubine_born: 'relation-concubine',
    adopted: 'relation-adopted',
    illegitimate: 'relation-illegitimate'
  };
  return map[status] || 'relation-prime';
}

function getRelationMarriageClass(kind) {
  const map = {
    primary: 'relation-prime',
    equal: 'relation-equal',
    concubine: 'relation-concubine'
  };
  return map[kind] || 'relation-prime';
}

function getBondTypeLabel(type) {
  const labels = { master_disciple: '师徒', friend: '好友', enemy: '宿敌', lover: '情人', custom: '自定义' };
  return labels[type] || '羁绊';
}

// ===== Marriage Modal =====
async function openMarriageModal(characterId) {
  await loadAllCharacters();
  const charA = characters.find(c => c.id === characterId);
  document.getElementById('marriage-a').value = charA ? charA.name : '';
  document.getElementById('marriage-b').value = '';
  
  document.getElementById('marriage-modal').classList.add('active');
}

function closeMarriageModal() {
  document.getElementById('marriage-modal').classList.remove('active');
}

async function saveMarriage(e) {
  e.preventDefault();
  const data = {
    character_a_id: resolveCharacterId(document.getElementById('marriage-a').value),
    character_b_id: resolveCharacterId(document.getElementById('marriage-b').value),
    relationship_type: document.getElementById('marriage-type').value,
    marriage_kind: document.getElementById('marriage-kind').value,
    notes: document.getElementById('marriage-notes').value || null
  };

  if (!data.character_a_id || !data.character_b_id) {
    showToast('请选择有效角色', 'error');
    return;
  }
  
  if (data.character_a_id === data.character_b_id) {
    showToast('不能与自己结婚', 'error');
    return;
  }
  
  try {
    await api.post('/api/marriages', data);
    showToast('配偶关系已添加');
    closeMarriageModal();
    await loadCharacters();
    if (currentCharacterId) {
      viewCharacterDetail(currentCharacterId);
    }
  } catch (e) {
    showToast('保存失败: ' + e.message, 'error');
  }
}

async function deleteMarriage(id) {
  if (!confirm('确定要删除这段配偶关系吗？')) return;
  
  try {
    await api.delete(`/api/marriages/${id}`);
    showToast('配偶关系已删除');
    if (currentCharacterId) {
      viewCharacterDetail(currentCharacterId);
    }
  } catch (e) {
    showToast('删除失败: ' + e.message, 'error');
  }
}

async function removeSiblingRelation(characterId, siblingId) {
  const parentIds = new Set(parentChildRelations
    .filter(relation => relation.child_id === characterId)
    .map(relation => relation.parent_id));
  const sharedRelations = parentChildRelations.filter(relation =>
    relation.child_id === siblingId && parentIds.has(relation.parent_id)
  );
  if (!sharedRelations.length) return;
  if (!confirm('确定要解除这段手足关系吗？这会删除对方与共同父母的亲子关系。')) return;
  try {
    await Promise.all(sharedRelations.map(relation => api.delete(`/api/parent-child/${relation.id}`)));
    await loadCharacters();
    await viewCharacterDetail(characterId);
    showToast('手足关系已解除');
  } catch (error) {
    showToast('解除手足关系失败: ' + error.message, 'error');
  }
}
const DETAIL_RELATION_CONFIG = {
  father: { label: '父亲', gender: 'male', mode: 'parent', defaultBirthStatus: 'legitimate' },
  mother: { label: '母亲', gender: 'female', mode: 'parent', defaultBirthStatus: 'legitimate' },
  brother: { label: '兄弟', gender: 'male', mode: 'sibling' },
  sister: { label: '姐妹', gender: 'female', mode: 'sibling' },
  son: { label: '子', gender: 'male', mode: 'child', defaultBirthStatus: 'legitimate' },
  daughter: { label: '女', gender: 'female', mode: 'child', defaultBirthStatus: 'legitimate' }
};

function getSelectedDetailRelationIds(characterId, kind) {
  const config = DETAIL_RELATION_CONFIG[kind];
  if (!config) return new Set();
  if (config.mode === 'sibling') {
    return new Set(getSiblingIds(characterId, parentChildRelations));
  }
  return new Set(parentChildRelations
    .filter(relation => config.mode === 'parent'
      ? relation.child_id === characterId
      : relation.parent_id === characterId)
    .map(relation => config.mode === 'parent' ? relation.parent_id : relation.child_id));
}
async function openDetailRelationModal(characterId, kind) {
  const config = DETAIL_RELATION_CONFIG[kind];
  if (!config) return;
  const [allCharacters, allRelations] = await Promise.all([
    api.get('/api/characters'),
    api.get('/api/parent-child')
  ]);
  characters = allCharacters;
  parentChildRelations = allRelations;
  detailRelationContext = { characterId, kind, config };
  const input = document.getElementById('detail-relation-candidate');
  const hidden = document.getElementById('detail-relation-candidate-id');
  if (input) {
    input.value = '';
    input.oninput = syncDetailRelationCandidateId;
  }
  if (hidden) hidden.value = '';
  refreshDetailRelationDatalist();
  document.getElementById('detail-relation-modal-title').textContent = `添加${config.label}`;
  const hint = document.getElementById('detail-relation-hint');
  if (hint) {
    hint.textContent = detailRelationCandidates.length
      ? (config.mode === 'sibling'
        ? '将自动复制当前人物的父母关系，建立共同父亲或母亲。'
        : `按姓名输入匹配；仅${config.gender === 'male' ? '男性' : '女性'}可选，已添加人物不会重复出现。`)
      : '当前没有可选人物，可点击 ＋ 直接新建。';
  }
  document.getElementById('detail-relation-options').style.display = config.mode === 'sibling' ? 'none' : '';
  document.getElementById('detail-relation-type').value = 'biological';
  document.getElementById('detail-relation-birth-status').value = config.defaultBirthStatus || 'legitimate';
  document.getElementById('detail-relation-modal').classList.add('active');
}

function closeDetailRelationModal() {
  document.getElementById('detail-relation-modal').classList.remove('active');
  detailRelationContext = null;
}

function buildDetailRelationCandidates(characterId, kind, allCharacters, allRelations) {
  const config = DETAIL_RELATION_CONFIG[kind];
  if (!config) return [];
  const selectedIds = getSelectedDetailRelationIds(characterId, kind);
  const directRelativeIds = new Set(allRelations.flatMap(relation => {
    if (relation.child_id === characterId) return [relation.parent_id];
    if (relation.parent_id === characterId) return [relation.child_id];
    return [];
  }));
  return allCharacters
    .filter(character =>
      character.id !== characterId &&
      character.gender === config.gender &&
      !selectedIds.has(character.id) &&
      (config.mode !== 'sibling' || !directRelativeIds.has(character.id)))
    .map(character => ({
      id: character.id,
      name: character.name,
      family: character.family_name || '',
      label: `${character.name}${character.family_name ? ` · ${character.family_name}` : ''}`
    }));
}

function refreshDetailRelationDatalist() {
  const datalist = document.getElementById('detail-relation-datalist');
  if (!datalist || !detailRelationContext) return;
  detailRelationCandidates = buildDetailRelationCandidates(
    detailRelationContext.characterId, detailRelationContext.kind, characters, parentChildRelations);
  datalist.innerHTML = detailRelationCandidates.length
    ? detailRelationCandidates.map(candidate =>
        `<option value="${escapeHtml(candidate.name)}">${escapeHtml(candidate.label)}</option>`).join('')
    : '';
  syncDetailRelationCandidateId();
}

function syncDetailRelationCandidateId() {
  const input = document.getElementById('detail-relation-candidate');
  const hidden = document.getElementById('detail-relation-candidate-id');
  const hint = document.getElementById('detail-relation-hint');
  if (!input || !hidden) return;
  const text = (input.value || '').trim();
  let matched = null;
  if (text) {
    const exact = detailRelationCandidates.filter(candidate => candidate.name === text);
    if (exact.length === 1) {
      matched = exact[0];
    } else {
      const partial = detailRelationCandidates.filter(candidate => candidate.name.includes(text));
      if (partial.length === 1) matched = partial[0];
    }
  }
  hidden.value = matched ? matched.id : '';
  if (hint && detailRelationContext) {
    if (matched) {
      hint.textContent = `已匹配：${matched.name}${matched.family ? ` · ${matched.family}` : ''}`;
    } else if (text) {
      hint.textContent = '未匹配到唯一人物，可点击 ＋ 直接新建';
    } else {
      hint.textContent = detailRelationContext.config.mode === 'sibling'
        ? '将自动复制当前人物的父母关系，建立共同父亲或母亲。'
        : `按姓名输入匹配；仅${detailRelationContext.config.gender === 'male' ? '男性' : '女性'}可选，已添加人物不会重复出现。`;
    }
  }
}

async function saveDetailRelation(event) {
  event.preventDefault();
  if (!detailRelationContext) return;
  const selectedId = document.getElementById('detail-relation-candidate-id').value;
  if (!selectedId) {
    showToast('请选择人物', 'error');
    return;
  }
  const { characterId, config } = detailRelationContext;
  const relationshipType = document.getElementById('detail-relation-type').value;
  const birthStatus = document.getElementById('detail-relation-birth-status').value;
  try {
    if (config.mode === 'sibling') {
      const parentRelations = parentChildRelations.filter(relation => relation.child_id === characterId);
      if (!parentRelations.length) {
        showToast('请先为当前人物添加父亲或母亲，再添加兄弟姐妹', 'error');
        return;
      }
      const existingKeys = new Set(parentChildRelations.map(relation => `${relation.parent_id}->${relation.child_id}`));
      const requests = parentRelations
        .filter(relation => !existingKeys.has(`${relation.parent_id}->${selectedId}`))
        .map(relation => api.post('/api/parent-child', {
          parent_id: relation.parent_id,
          child_id: selectedId,
          relationship_type: relation.relationship_type || 'biological',
          birth_status: relation.birth_status || 'legitimate',
          notes: null
        }));
      if (!requests.length) {
        showToast('该人物已经是当前人物的手足', 'error');
        return;
      }
      await Promise.all(requests);
    } else {
      await api.post('/api/parent-child', {
        parent_id: config.mode === 'parent' ? selectedId : characterId,
        child_id: config.mode === 'parent' ? characterId : selectedId,
        relationship_type: relationshipType,
        birth_status: birthStatus,
        notes: null
      });
    }
    closeDetailRelationModal();
    await loadCharacters();
    await viewCharacterDetail(characterId);
    showToast(`${config.label}已添加`);
  } catch (error) {
    showToast('保存关系失败: ' + error.message, 'error');
  }
}
// ===== Parent-Child Modal =====
async function openParentChildModal(characterId, role) {
  await loadAllCharacters();
  
  const char = characters.find(c => c.id === characterId);
  const charName = char ? char.name : '';
  
  document.getElementById('parent-select').value = role === 'parent' ? charName : '';
  document.getElementById('child-select').value = role === 'child' ? charName : '';
  
  document.getElementById('parent-child-modal').classList.add('active');
}

function closeParentChildModal() {
  document.getElementById('parent-child-modal').classList.remove('active');
}

async function saveParentChild(e) {
  e.preventDefault();
  const parentId = resolveCharacterId(document.getElementById('parent-select').value);
  const childId = resolveCharacterId(document.getElementById('child-select').value);
  const relationshipType = document.getElementById('parent-child-type').value;
  const birthStatus = document.getElementById('birth-status').value;
  const notes = document.getElementById('parent-child-notes').value || null;

  if (!parentId || !childId) {
    showToast('请选择有效角色', 'error');
    return;
  }
  
  if (parentId === childId) {
    showToast('不能成为自己的父母', 'error');
    return;
  }
  
  try {
    await api.post('/api/parent-child', {
      parent_id: parentId,
      child_id: childId,
      relationship_type: relationshipType,
      birth_status: birthStatus,
      notes: notes
    });
    showToast('亲子关系已添加');
    closeParentChildModal();
    await loadCharacters();
    if (currentCharacterId) {
      viewCharacterDetail(currentCharacterId);
    }
  } catch (e) {
    showToast('保存失败: ' + e.message, 'error');
  }
}

async function deleteParentChild(id) {
  if (!confirm('确定要删除这段亲子关系吗？')) return;
  try {
    await api.delete(`/api/parent-child/${id}`);
    showToast('亲子关系已删除');
    if (currentCharacterId) {
      viewCharacterDetail(currentCharacterId);
    }
  } catch (e) {
    showToast('删除失败: ' + e.message, 'error');
  }
}

// ===== Bonds (次要关系) =====
async function openBondModal(characterId) {
  await loadAllCharacters();
  const charA = characters.find(c => c.id === characterId);
  document.getElementById('bond-a').value = charA ? charA.name : '';
  document.getElementById('bond-b').value = '';
  document.getElementById('bond-type').value = 'custom';
  document.getElementById('bond-label').value = '';
  document.getElementById('bond-color').value = '#9a7a42';
  document.getElementById('bond-notes').value = '';
  document.getElementById('bond-modal').classList.add('active');
}

function closeBondModal() {
  document.getElementById('bond-modal').classList.remove('active');
}

function onBondTypeChange() {
  const type = document.getElementById('bond-type').value;
  const labelInput = document.getElementById('bond-label');
  const presets = {
    master_disciple: { label: '师徒', color: '#5a7a4a' },
    friend: { label: '好友', color: '#4a7a9c' },
    enemy: { label: '宿敌', color: '#9c3d2e' },
    lover: { label: '情人', color: '#b84a72' },
    custom: { label: '', color: '#9a7a42' }
  };
  const preset = presets[type] || presets.custom;
  labelInput.value = preset.label;
  document.getElementById('bond-color').value = preset.color;
}

async function saveBond(e) {
  e.preventDefault();
  const data = {
    character_a_id: resolveCharacterId(document.getElementById('bond-a').value),
    character_b_id: resolveCharacterId(document.getElementById('bond-b').value),
    bond_type: document.getElementById('bond-type').value,
    bond_label: document.getElementById('bond-label').value || null,
    color: document.getElementById('bond-color').value,
    notes: document.getElementById('bond-notes').value || null
  };
  if (!data.character_a_id || !data.character_b_id) {
    showToast('请选择有效角色', 'error');
    return;
  }
  if (data.character_a_id === data.character_b_id) {
    showToast('不能与自己建立羁绊', 'error');
    return;
  }
  try {
    await api.post('/api/bonds', data);
    showToast('羁绊已添加');
    closeBondModal();
    await loadCharacters();
    if (currentCharacterId) viewCharacterDetail(currentCharacterId);
  } catch (e) {
    showToast('保存失败: ' + e.message, 'error');
  }
}

async function deleteBond(id) {
  if (!confirm('确定要删除这段羁绊吗？')) return;
  try {
    await api.delete(`/api/bonds/${id}`);
    showToast('羁绊已删除');
    if (currentCharacterId) viewCharacterDetail(currentCharacterId);
  } catch (e) {
    showToast('删除失败: ' + e.message, 'error');
  }
}

// ===== Life Events (往事录) =====
const CHINESE_NUMERALS = {
  '零': 0, '〇': 0,
  '一': 1, '壹': 1, '幺': 1,
  '二': 2, '贰': 2, '两': 2,
  '三': 3, '叁': 3,
  '四': 4, '肆': 4,
  '五': 5, '伍': 5,
  '六': 6, '陆': 6,
  '七': 7, '柒': 7,
  '八': 8, '捌': 8,
  '九': 9, '玖': 9,
  '十': 10, '拾': 10,
  '廿': 20, '卅': 30, '卌': 40
};

function chineseNumberToInt(str) {
  if (!str) return null;
  // 全角数字直转
  if (/^[0-9]+$/.test(str)) return parseInt(str, 10);
  let total = 0;
  let section = 0;
  let lastDigit = 0;
  for (const ch of str) {
    if (ch in CHINESE_NUMERALS) {
      const v = CHINESE_NUMERALS[ch];
      if (v === 10) {
        // 十 / 拾 单独出现
        if (section === 0) section = 10;
        else section = (lastDigit || 1) * 10;
        lastDigit = 0;
        total += section;
        section = 0;
      } else if (v >= 20) {
        // 廿 卅 卌
        total += v;
        lastDigit = 0;
      } else {
        lastDigit = v;
      }
    } else if (/[0-9]/.test(ch)) {
      lastDigit = parseInt(ch, 10);
    } else {
      break;
    }
  }
  total += lastDigit;
  return total || null;
}

function detectEraName() {
  // 从设置读取；currentEraName 在 loadSettings 中维护
  return (currentEraName || '').trim();
}

function detectLifeEventDate(text) {
  if (!text) return null;
  // 1) 「年号+年份+月」: 泰盛6年11月、贞观三年
  // 2) 数字年: 1234年5月、1234年
  // 3) 兜底: 春/夏/秋/冬+某月
  const era = detectEraName();
  const eraPattern = era
    ? new RegExp(`(${escapeRegExp(era)})\\s*([\\d零〇一二三四五六七八九十百千壹贰叁肆伍陆柒捌玖拾两廿卅卌]+)\\s*年\\s*(?:([\\d零〇一二三四五六七八九十壹贰叁肆伍陆柒捌玖两]+)\\s*月)?`)
    : null;
  if (eraPattern) {
    const m = text.match(eraPattern);
    if (m) {
      const year = chineseNumberToInt(m[2]);
      const month = m[3] ? chineseNumberToInt(m[3]) : null;
      if (year != null) {
        return month ? `${era}${year}年${month}月` : `${era}${year}年`;
      }
    }
  }
  // 数字年
  const numeric = text.match(/(\d{2,4})\s*年\s*(?:(\d{1,2})\s*月)?/);
  if (numeric) {
    const year = parseInt(numeric[1], 10);
    const month = numeric[2] ? parseInt(numeric[2], 10) : null;
    return month ? `${year}年${month}月` : `${year}年`;
  }
  // 兜底: 某月
  const monthOnly = text.match(/([一二三四五六七八九十]{1,2}月|\d{1,2}月)/);
  if (monthOnly) return monthOnly[1];
  return null;
}

function escapeRegExp(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function detectRelatedCharacters(text) {
  if (!text || !characters.length) return [];
  // 排序:名字长的优先,避免短名截胡
  const sorted = [...characters].sort((a, b) => (b.name || '').length - (a.name || '').length);
  const usedRanges = [];
  const found = [];
  for (const c of sorted) {
    if (!c.name) continue;
    const idx = text.indexOf(c.name);
    if (idx < 0) continue;
    // 检查是否已经被更长名字覆盖
    const overlap = usedRanges.some(([s, e]) => !(idx + c.name.length <= s || idx >= e));
    if (overlap) continue;
    usedRanges.push([idx, idx + c.name.length]);
    found.push(c);
  }
  return found;
}

function parseLifeEventText(text) {
  // 智能解析:返回 { event_date, event_notes, related_character_ids }
  const raw = String(text || '').trim();
  if (!raw) return { event_date: null, event_notes: null, related_character_ids: [] };
  const detectedDate = detectLifeEventDate(raw);
  const detectedCharacters = detectRelatedCharacters(raw);
  let body = raw;
  if (detectedDate && body.startsWith(detectedDate)) {
    body = body.slice(detectedDate.length).replace(/^[，,。:：\s]+/, '');
  }
  return {
    event_date: detectedDate,
    event_notes: body.trim() || raw,
    related_character_ids: detectedCharacters.map(c => c.id)
  };
}

// ===== 人物片段工具条(可点击/可拖拽插入到正文) =====
function buildLifeEventCharacterChips() {
  const container = document.getElementById('life-event-character-chips');
  if (!container) return;
  // 收集主角色 + 相关人物
  const mainId = (document.getElementById('life-event-main-character-id')?.value || '').trim();
  const relatedIds = (typeof lifeEventRelatedIds !== 'undefined' && lifeEventRelatedIds) ? lifeEventRelatedIds : [];
  // 合并并去重(主角色优先)
  const seen = new Set();
  const ordered = [];
  if (mainId) {
    seen.add(mainId);
    ordered.push({ id: mainId, role: 'main' });
  }
  for (const id of relatedIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    ordered.push({ id, role: 'related' });
  }
  if (!ordered.length) {
    container.innerHTML = '<span class="life-event-chips-empty">识别到主角色和相关人物后，会显示可点击/可拖拽的称谓片段</span>';
    return;
  }
  const html = ordered.map(item => {
    const c = (characters || []).find(x => x.id === item.id);
    if (!c) return '';
    const short = c.name || '';
    // 长码 = 头衔 + 名字(若头衔与 name 重复或为空则只显示 name)
    const title = (c.title || '').trim();
    const long = title && !title.includes(short) ? `${title}${short}` : (title || short);
    const label = item.role === 'main' ? '主' : '相关';
    return `
      <span class="life-event-chip-group" data-character-id="${escapeHtml(c.id)}">
        <span class="life-event-chip-group-label">${label}</span>
        <span class="life-event-chip ${item.role === 'main' ? 'is-main' : ''}" draggable="true" data-insert="${escapeHtml(short)}" title="点击插入到光标;拖入正文可放到任意位置">${escapeHtml(short)}</span>
        ${long !== short ? `<span class="life-event-chip" draggable="true" data-insert="${escapeHtml(long)}" title="点击插入到光标;拖入正文可放到任意位置">${escapeHtml(long)}</span>` : ''}
      </span>
    `;
  }).join('');
  container.innerHTML = html || '<span class="life-event-chips-empty">识别到主角色和相关人物后，会显示可点击/可拖拽的称谓片段</span>';
  bindLifeEventChipHandlers();
}

function bindLifeEventChipHandlers() {
  const container = document.getElementById('life-event-character-chips');
  if (!container) return;
  // 点击 → 插入到当前光标位置
  container.querySelectorAll('.life-event-chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
      const text = chip.getAttribute('data-insert') || '';
      if (!text) return;
      const ta = document.getElementById('life-event-notes');
      insertTextAtCursor(ta, text);
      ta.focus();
    });
    chip.addEventListener('dragstart', (e) => {
      const text = chip.getAttribute('data-insert') || '';
      e.dataTransfer.setData('text/plain', text);
      e.dataTransfer.effectAllowed = 'copy';
      // Firefox 兼容:必须 setData
    });
  });
  // 拖到正文文本框:支持任意位置 drop
  const ta = document.getElementById('life-event-notes');
  if (!ta) return;
  // 避免重复绑定(同一 modal 内):先移除
  if (ta.__chipDropBound) return;
  ta.__chipDropBound = true;
  ta.addEventListener('dragover', (e) => {
    if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('text/plain')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    ta.classList.add('is-drag-over');
  });
  ta.addEventListener('dragleave', (e) => {
    // 只在真正离开 textarea 时去掉高亮
    if (e.target === ta) ta.classList.remove('is-drag-over');
  });
  ta.addEventListener('drop', (e) => {
    e.preventDefault();
    ta.classList.remove('is-drag-over');
    const text = e.dataTransfer.getData('text/plain');
    if (!text) return;
    const pos = getTextareaCaretIndex(ta, e.clientX, e.clientY);
    insertTextAt(ta, pos, text);
    ta.focus();
  });
}

// 把文本插入到 textarea 当前光标位置(点击 chip 触发)
function insertTextAtCursor(textarea, text) {
  if (!textarea) return;
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? start;
  insertTextAt(textarea, start, text, end);
}

// 在指定位置插入文本,并把光标移到插入内容之后
function insertTextAt(textarea, pos, text, selEnd) {
  if (!textarea) return;
  const value = textarea.value;
  const before = value.slice(0, pos);
  const after = value.slice(selEnd ?? pos);
  textarea.value = before + text + after;
  const caret = pos + text.length;
  textarea.selectionStart = textarea.selectionEnd = caret;
  // 触发 input 事件,让 oninput 解析逻辑跑一遍
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

// 根据鼠标坐标算出 textarea 中的字符索引;用浏览器原生 caret API,失败回退到当前光标
function getTextareaCaretIndex(textarea, clientX, clientY) {
  // 优先用 caretPositionFromPoint(Firefox / 较新 Chrome)
  if (typeof document.caretPositionFromPoint === 'function') {
    try {
      const pos = document.caretPositionFromPoint(clientX, clientY);
      if (pos && pos.offsetNode === textarea) return pos.offset;
    } catch (_) {}
  }
  // 兼容 WebKit
  if (typeof document.caretRangeFromPoint === 'function') {
    try {
      const range = document.caretRangeFromPoint(clientX, clientY);
      if (range && range.startContainer === textarea) return range.startOffset;
    } catch (_) {}
  }
  // 兜底:用 mirror div 估算(Y 坐标 → 行号;X 坐标 → 行内字符索引)
  try {
    return estimateCaretByMirror(textarea, clientX, clientY);
  } catch (_) {}
  // 最终兜底:用当前光标位置
  return textarea.selectionStart ?? textarea.value.length;
}

// mirror div 方案:克隆 textarea 的样式,把鼠标位置对应的字符位置算出来
function estimateCaretByMirror(textarea, clientX, clientY) {
  const rect = textarea.getBoundingClientRect();
  const style = getComputedStyle(textarea);
  const div = document.createElement('div');
  div.style.position = 'absolute';
  div.style.visibility = 'hidden';
  div.style.overflow = 'hidden';
  div.style.top = '0';
  div.style.left = '-9999px';
  div.style.whiteSpace = 'pre-wrap';
  div.style.wordWrap = 'break-word';
  // 关键样式
  const copyProps = ['fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','paddingTop','paddingBottom','paddingLeft','paddingRight','borderTopWidth','borderBottomWidth','borderLeftWidth','borderRightWidth','boxSizing','width','tabSize','textIndent'];
  copyProps.forEach(p => { div.style[p] = style[p]; });
  document.body.appendChild(div);
  // 估算行高(px)
  const lineHeight = parseFloat(style.lineHeight) || (parseFloat(style.fontSize) * 1.4);
  const paddingTop = parseFloat(style.paddingTop) || 0;
  const paddingLeft = parseFloat(style.paddingLeft) || 0;
  // 鼠标相对 textarea 的位置
  const relY = clientY - rect.top - paddingTop + textarea.scrollTop;
  const relX = clientX - rect.left - paddingLeft + textarea.scrollLeft;
  // 行号
  const lineNo = Math.max(0, Math.floor(relY / lineHeight));
  const text = textarea.value;
  const lines = text.split('\n');
  const safeLineNo = Math.min(lineNo, lines.length - 1);
  // 第 safeLineNo 行的字符索引起点
  let lineStart = 0;
  for (let i = 0; i < safeLineNo; i++) lineStart += lines[i].length + 1;
  // 第 safeLineNo 行的内容填到 div,后面跟一个 mark span
  const lineText = lines[safeLineNo] || '';
  div.textContent = lineText;
  // 在 div 末尾追加一个 mark,用来探测 X
  const mark = document.createElement('span');
  mark.textContent = '\u200b'; // zero-width
  div.appendChild(mark);
  // 用一个临时的 range 测 mark 的 X 位置(不实用,改用逐字符试)
  // 简化:用二分法找最接近 relX 的字符位置
  let lo = 0, hi = lineText.length;
  // 测 lineText[0..mid] 的宽度
  const measure = (n) => {
    div.textContent = lineText.slice(0, n);
    div.appendChild(mark);
    return mark.offsetLeft;
  };
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const w = measure(mid);
    if (w < relX) lo = mid + 1; else hi = mid;
  }
  document.body.removeChild(div);
  return lineStart + lo;
}

async function openLifeEventModal(characterId) {
  if (!characters.length) await loadAllCharacters();
  await refreshMemoryCategories();
  editingLifeEventId = null;
  document.getElementById('life-event-modal-title').textContent = characterId ? '记录往事' : '新建记事';
  document.getElementById('life-event-id').value = '';
  document.getElementById('life-event-character-id').value = characterId || '';
  document.getElementById('life-event-text').value = '';
  document.getElementById('life-event-date').value = '';
  document.getElementById('life-event-notes').value = '';
  // 主角色:默认绑定当前角色
  const mainInput = document.getElementById('life-event-main-character');
  const mainIdInput = document.getElementById('life-event-main-character-id');
  if (characterId) {
    const c = characters.find(x => x.id === characterId);
    if (c) {
      mainInput.value = c.name;
      mainIdInput.value = c.id;
    } else {
      mainInput.value = '';
      mainIdInput.value = characterId;
    }
  } else {
    mainInput.value = '';
    mainIdInput.value = '';
  }
  lifeEventRelatedIds = [];
  lifeEventCategoryId = null;
  renderLifeEventRelatedTags();
  renderLifeEventCategoryTags();
  renderLifeEventParsePreview(null, []);
  document.getElementById('life-event-parse-hint').textContent = '';
  loadMemoryCategoryOptions();
  buildLifeEventCharacterChips();
  document.getElementById('life-event-modal').classList.add('active');
  // 主角色输入变化时同步刷新人物 chip 工具条
  mainInput.onchange = () => {
    const name = (mainInput.value || '').trim();
    const c = characters.find(x => x.name === name);
    mainIdInput.value = c ? c.id : '';
    buildLifeEventCharacterChips();
  };
  mainInput.oninput = mainInput.onchange;
  // 输入时实时解析
  const textEl = document.getElementById('life-event-text');
  textEl.oninput = () => {
    const parsed = parseLifeEventText(textEl.value);
    const dateEl = document.getElementById('life-event-date');
    const notesEl = document.getElementById('life-event-notes');
    if (dateEl && !dateEl.value && parsed.event_date) dateEl.value = parsed.event_date;
    if (notesEl && !notesEl.value && parsed.event_notes) notesEl.value = parsed.event_notes;
    let added = 0;
    for (const id of parsed.related_character_ids) {
      if (!lifeEventRelatedIds.includes(id)) {
        lifeEventRelatedIds.push(id);
        added++;
      }
    }
    if (added) renderLifeEventRelatedTags();
    renderLifeEventParsePreview(parsed.event_date, parsed.related_character_ids);
    document.getElementById('life-event-parse-hint').textContent = added
      ? `已识别时间「${parsed.event_date || '未识别'}」,新增人物 ${added} 位`
      : '';
  };
}

function closeLifeEventModal() {
  document.getElementById('life-event-modal').classList.remove('active');
  const textEl = document.getElementById('life-event-text');
  if (textEl) textEl.oninput = null;
  const mainInput = document.getElementById('life-event-main-character');
  if (mainInput) { mainInput.oninput = null; mainInput.onchange = null; }
  editingLifeEventId = null;
}

function analyzeLifeEventText() {
  const text = (document.getElementById('life-event-text').value || '').trim();
  if (!text) {
    showToast('请先粘贴或输入内容', 'error');
    return;
  }
  const parsed = parseLifeEventText(text);
  // 仅在用户未手动调整时,自动回填到下方字段
  if (parsed.event_date && !document.getElementById('life-event-date').value) {
    document.getElementById('life-event-date').value = parsed.event_date;
  }
  if (parsed.event_notes && !document.getElementById('life-event-notes').value) {
    document.getElementById('life-event-notes').value = parsed.event_notes;
  }
  // 合并相关人物(去重)
  const beforeCount = lifeEventRelatedIds.length;
  for (const id of parsed.related_character_ids) {
    if (!lifeEventRelatedIds.includes(id)) lifeEventRelatedIds.push(id);
  }
  renderLifeEventRelatedTags();
  renderLifeEventParsePreview(parsed.event_date, parsed.related_character_ids);
  const added = lifeEventRelatedIds.length - beforeCount;
  document.getElementById('life-event-parse-hint').textContent =
    `已识别:时间「${parsed.event_date || '未识别'}」,人物 ${parsed.related_character_ids.length} 位${added ? `,新增 ${added} 位` : ''}`;
}

function renderLifeEventParsePreview(date, relatedIds) {
  const dateEl = document.getElementById('life-event-parse-date');
  const charEl = document.getElementById('life-event-parse-characters');
  if (dateEl) dateEl.textContent = date || '未识别';
  if (charEl) {
    if (!relatedIds || !relatedIds.length) {
      charEl.textContent = '未识别';
    } else {
      const names = relatedIds.map(id => (characters.find(c => c.id === id) || {}).name).filter(Boolean);
      charEl.textContent = names.join('、');
    }
  }
}

function renderLifeEventRelatedTags() {
  const container = document.getElementById('life-event-related-tags');
  if (!container) return;
  if (!lifeEventRelatedIds.length) {
    container.innerHTML = '<span class="multi-character-empty">尚未添加相关人物</span>';
    return;
  }
  container.innerHTML = lifeEventRelatedIds.map((id, idx) => {
    const c = characters.find(x => x.id === id);
    const name = c ? c.name : '(未知)';
    return `<span class="multi-character-tag">
      <span>${escapeHtml(name)}</span>
      <button type="button" onclick="removeLifeEventRelated(${idx})" title="移除">×</button>
    </span>`;
  }).join('');
}

function removeLifeEventRelated(index) {
  lifeEventRelatedIds.splice(index, 1);
  renderLifeEventRelatedTags();
  buildLifeEventCharacterChips();
}

function addLifeEventRelatedFromInput() {
  const input = document.getElementById('life-event-related-input');
  const name = (input.value || '').trim();
  if (!name) return;
  const c = characters.find(x => x.name === name);
  if (!c) {
    showToast('未找到匹配角色,请先在角色管理中创建', 'error');
    return;
  }
  if (!lifeEventRelatedIds.includes(c.id)) lifeEventRelatedIds.push(c.id);
  input.value = '';
  renderLifeEventRelatedTags();
  loadLifeEventRelatedDropdown();
  buildLifeEventCharacterChips();
}

function toggleLifeEventRelatedDropdown() {
  const options = document.getElementById('life-event-related-options');
  if (!options) return;
  if (options.classList.contains('show')) {
    options.classList.remove('show');
  } else {
    loadLifeEventRelatedDropdown();
    options.classList.add('show');
  }
}

function loadLifeEventRelatedDropdown() {
  const options = document.getElementById('life-event-related-options');
  if (!options) return;
  const list = (characters || []).slice().sort((a, b) => (a.name || '').localeCompare(b.name || '', 'zh-CN'));
  if (!list.length) {
    options.innerHTML = '<div class="multi-character-empty">还没有角色</div>';
    return;
  }
  options.innerHTML = list.map(c => {
    const selected = lifeEventRelatedIds.includes(c.id);
    return `<button type="button" class="multi-character-option ${selected ? 'selected' : ''}" data-id="${c.id}" onmousedown="event.preventDefault()" onclick="toggleLifeEventRelated('${c.id}')">
      <span>${escapeHtml(c.name)}</span>${selected ? '<span class="check">✓</span>' : ''}
    </button>`;
  }).join('');
}

function toggleLifeEventRelated(id) {
  if (!id) return;
  const idx = lifeEventRelatedIds.indexOf(id);
  if (idx >= 0) lifeEventRelatedIds.splice(idx, 1);
  else lifeEventRelatedIds.push(id);
  renderLifeEventRelatedTags();
  loadLifeEventRelatedDropdown();
  buildLifeEventCharacterChips();
}

function renderLifeEventCategoryTags() {
  const container = document.getElementById('life-event-category-tags');
  if (!container) return;
  if (!lifeEventCategoryId) {
    container.innerHTML = '<span class="multi-character-empty">未选分类</span>';
    return;
  }
  const cat = memoryCategories.find(c => c.id === lifeEventCategoryId);
  if (!cat) {
    container.innerHTML = '<span class="multi-character-empty">未选分类</span>';
    return;
  }
  container.innerHTML = `<span class="memory-category-tag" style="background:${escapeHtml(cat.color || '#9a7a42')}">
    <span>${escapeHtml(cat.name)}</span>
    <button type="button" onclick="lifeEventCategoryId=null;renderLifeEventCategoryTags();" title="清除">×</button>
  </span>`;
}

function loadMemoryCategoryOptions() {
  // 填充到 input 的 datalist
  const dl = document.getElementById('memory-category-datalist');
  if (dl) {
    dl.innerHTML = memoryCategories
      .map(c => `<option value="${escapeHtml(c.name)}"></option>`).join('');
  }
}

function addLifeEventCategoryFromInput() {
  const input = document.getElementById('life-event-category-input');
  const name = (input.value || '').trim();
  if (!name) return;
  const existing = memoryCategories.find(c => c.name === name);
  if (existing) {
    lifeEventCategoryId = existing.id;
    input.value = '';
    renderLifeEventCategoryTags();
    showToast(`已选择分类:${name}`);
    return;
  }
  // 新建分类
  api.post('/api/life-event-categories', { name, color: '#9a7a42' }).then(cat => {
    memoryCategories.push(cat);
    lifeEventCategoryId = cat.id;
    input.value = '';
    loadMemoryCategoryOptions();
    renderLifeEventCategoryTags();
    showToast(`已新建分类:${cat.name}`);
  }).catch(e => showToast('新建分类失败:' + e.message, 'error'));
}

async function saveLifeEvent(e) {
  e.preventDefault();
  const text = (document.getElementById('life-event-text').value || '').trim();
  const date = (document.getElementById('life-event-date').value || '').trim();
  const notes = (document.getElementById('life-event-notes').value || '').trim();
  if (!text && !notes) {
    showToast('请输入往事内容', 'error');
    return;
  }
  let mainId = (document.getElementById('life-event-main-character-id').value || '').trim();
  if (!mainId) {
    const name = (document.getElementById('life-event-main-character').value || '').trim();
    if (name) {
      const c = characters.find(x => x.name === name);
      if (c) mainId = c.id;
    }
  }
  // 解析后端存储:如果有 text 但正文为空,用解析结果兜底
  const parsed = parseLifeEventText(text);
  const payload = {
    character_id: mainId || document.getElementById('life-event-character-id').value || null,
    event_date: date || parsed.event_date || null,
    event_notes: notes || parsed.event_notes || text || null,
    related_character_ids: lifeEventRelatedIds.slice(),
    category_id: lifeEventCategoryId
  };
  try {
    if (editingLifeEventId) {
      await api.put(`/api/life-events/${editingLifeEventId}`, payload);
      showToast('记事已更新');
    } else {
      await api.post('/api/life-events', payload);
      showToast('往事已记录');
    }
    closeLifeEventModal();
    if (currentView === 'memories') {
      loadMemories();
    }
    if (currentCharacterId) viewCharacterDetail(currentCharacterId);
  } catch (err) {
    showToast('保存失败: ' + err.message, 'error');
  }
}

async function editLifeEvent(id, fallbackCharacterId) {
  try {
    if (!characters.length) await loadAllCharacters();
    await refreshMemoryCategories();
    const ev = await api.get(`/api/life-events/${id}`);
    if (!ev) return;
    editingLifeEventId = id;
    document.getElementById('life-event-modal-title').textContent = '编辑记事';
    document.getElementById('life-event-id').value = id;
    document.getElementById('life-event-character-id').value = ev.character_id || '';
    document.getElementById('life-event-text').value = ev.event_notes || '';
    document.getElementById('life-event-date').value = ev.event_date || '';
    document.getElementById('life-event-notes').value = ev.event_notes || '';
    // 主角色
    const mainInput = document.getElementById('life-event-main-character');
    const mainIdInput = document.getElementById('life-event-main-character-id');
    if (ev.character_id) {
      const c = characters.find(x => x.id === ev.character_id);
      mainInput.value = c ? c.name : '';
      mainIdInput.value = ev.character_id;
    } else if (fallbackCharacterId) {
      const c = characters.find(x => x.id === fallbackCharacterId);
      mainInput.value = c ? c.name : '';
      mainIdInput.value = fallbackCharacterId;
    } else {
      mainInput.value = '';
      mainIdInput.value = '';
    }
    // 相关人物
    let relIds = [];
    try { relIds = JSON.parse(ev.related_character_ids || '[]'); } catch (_) {}
    lifeEventRelatedIds = Array.isArray(relIds) ? relIds.filter(x => x) : [];
    renderLifeEventRelatedTags();
    // 分类
    lifeEventCategoryId = ev.category_id || null;
    renderLifeEventCategoryTags();
    loadMemoryCategoryOptions();
    renderLifeEventParsePreview(ev.event_date, lifeEventRelatedIds);
    document.getElementById('life-event-parse-hint').textContent = '';
    buildLifeEventCharacterChips();
    document.getElementById('life-event-modal').classList.add('active');
    // 主角色输入变化时同步刷新人物 chip 工具条
    mainInput.onchange = () => {
      const name = (mainInput.value || '').trim();
      const c = characters.find(x => x.name === name);
      mainIdInput.value = c ? c.id : '';
      buildLifeEventCharacterChips();
    };
    mainInput.oninput = mainInput.onchange;
    // 重新绑定实时解析
    const textEl = document.getElementById('life-event-text');
    textEl.oninput = () => {
      const parsed = parseLifeEventText(textEl.value);
      const dateEl = document.getElementById('life-event-date');
      const notesEl = document.getElementById('life-event-notes');
      if (dateEl && !dateEl.value && parsed.event_date) dateEl.value = parsed.event_date;
      if (notesEl && !notesEl.value && parsed.event_notes) notesEl.value = parsed.event_notes;
      let added = 0;
      for (const id of parsed.related_character_ids) {
        if (!lifeEventRelatedIds.includes(id)) {
          lifeEventRelatedIds.push(id);
          added++;
        }
      }
      if (added) renderLifeEventRelatedTags();
      renderLifeEventParsePreview(parsed.event_date, parsed.related_character_ids);
      document.getElementById('life-event-parse-hint').textContent = added
        ? `已识别时间「${parsed.event_date || '未识别'}」,新增人物 ${added} 位`
        : '';
    };
  } catch (e) {
    showToast('加载记事失败: ' + e.message, 'error');
  }
}

async function deleteLifeEvent(id) {
  if (!confirm('确定要删除这段往事吗?')) return;
  try {
    await api.delete(`/api/life-events/${id}`);
    showToast('往事已删除');
    if (currentView === 'memories') loadMemories();
    if (currentCharacterId) viewCharacterDetail(currentCharacterId);
  } catch (e) {
    showToast('删除失败: ' + e.message, 'error');
  }
}

// ===== Memory Categories (记事分类管理) =====
async function openMemoryCategoryManager() {
  await refreshMemoryCategories();
  resetMemoryCategoryForm();
  renderMemoryCategoryList();
  document.getElementById('memory-category-modal').classList.add('active');
}

function closeMemoryCategoryManager() {
  document.getElementById('memory-category-modal').classList.remove('active');
}

function resetMemoryCategoryForm() {
  document.getElementById('memory-category-edit-id').value = '';
  document.getElementById('memory-category-name').value = '';
  document.getElementById('memory-category-color').value = '#9a7a42';
  document.getElementById('memory-category-description').value = '';
  document.getElementById('memory-category-submit').textContent = '添加分类';
}

function renderMemoryCategoryList() {
  const container = document.getElementById('memory-category-list');
  if (!container) return;
  if (!memoryCategories.length) {
    container.innerHTML = '<div class="tag-manager-empty">还没有分类,先创建第一个吧。</div>';
    return;
  }
  container.innerHTML = memoryCategories.map(c => `
    <div class="tag-manager-item">
      <div class="tag-manager-info">
        <span class="tag-manager-name" style="color:${escapeHtml(c.color || '#9a7a42')}">● ${escapeHtml(c.name)}</span>
        ${c.description ? `<span class="tag-manager-desc">${escapeHtml(c.description)}</span>` : ''}
      </div>
      <div class="tag-manager-actions">
        <button class="btn btn-sm btn-secondary" onclick="editMemoryCategory('${c.id}')">编辑</button>
        <button class="btn btn-sm btn-danger" onclick="deleteMemoryCategory('${c.id}')">删除</button>
      </div>
    </div>
  `).join('');
}

function editMemoryCategory(id) {
  const c = memoryCategories.find(x => x.id === id);
  if (!c) return;
  document.getElementById('memory-category-edit-id').value = c.id;
  document.getElementById('memory-category-name').value = c.name || '';
  document.getElementById('memory-category-color').value = c.color || '#9a7a42';
  document.getElementById('memory-category-description').value = c.description || '';
  document.getElementById('memory-category-submit').textContent = '更新分类';
}

async function saveMemoryCategoryFromForm(e) {
  e.preventDefault();
  const id = document.getElementById('memory-category-edit-id').value;
  const name = (document.getElementById('memory-category-name').value || '').trim();
  if (!name) { showToast('分类名不能为空', 'error'); return; }
  const color = document.getElementById('memory-category-color').value || '#9a7a42';
  const description = (document.getElementById('memory-category-description').value || '').trim();
  try {
    if (id) {
      const updated = await api.put(`/api/life-event-categories/${id}`, { name, color, description });
      const idx = memoryCategories.findIndex(c => c.id === id);
      if (idx >= 0) memoryCategories[idx] = updated;
      showToast('分类已更新');
    } else {
      const created = await api.post('/api/life-event-categories', { name, color, description });
      memoryCategories.push(created);
      showToast('分类已添加');
    }
    await refreshMemoryCategories();
    loadMemoryCategoryOptions();
    renderMemoryCategoryList();
    if (currentView === 'memories') loadMemories();
    resetMemoryCategoryForm();
  } catch (e) {
    showToast('保存失败: ' + e.message, 'error');
  }
}

async function deleteMemoryCategory(id) {
  if (!confirm('删除该分类?相关记事会变成『未分类』')) return;
  try {
    await api.delete(`/api/life-event-categories/${id}`);
    memoryCategories = memoryCategories.filter(c => c.id !== id);
    if (lifeEventCategoryId === id) lifeEventCategoryId = null;
    renderLifeEventCategoryTags();
    loadMemoryCategoryOptions();
    renderMemoryCategoryList();
    if (currentView === 'memories') loadMemories();
    showToast('分类已删除');
  } catch (e) {
    showToast('删除失败: ' + e.message, 'error');
  }
}

async function refreshMemoryCategories() {
  try {
    memoryCategories = await api.get('/api/life-event-categories');
  } catch (e) {
    memoryCategories = [];
  }
}

// ===== Memories View (记事一览) =====
async function loadMemories() {
  await loadAllCharacters();
  await refreshMemoryCategories();
  populateMemoryCategoryFilter();
  const search = document.getElementById('memory-search').value.trim();
  const categoryId = document.getElementById('memory-category-filter').value;
  const sortValue = document.getElementById('memory-sort').value;
  const [sort, order] = sortValue.split('_'); // event_date_desc
  const sortKey = sort; // event_date
  try {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (categoryId) params.set('category_id', categoryId);
    if (sortKey) params.set('sort', sortKey);
    if (order) params.set('order', order);
    memoryList = await api.get('/api/life-events?' + params.toString());
  } catch (e) {
    memoryList = [];
    showToast('加载记事失败: ' + e.message, 'error');
  }
  memoryPage = 1;
  renderMemoryList();
  updateMemorySortIndicator();
}

function populateMemoryCategoryFilter() {
  const sel = document.getElementById('memory-category-filter');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">全部分类</option>' +
    memoryCategories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  if (current && memoryCategories.some(c => c.id === current)) sel.value = current;
}

function onMemoryFilterChange() {
  // 重新拉取服务端,做服务端搜索/筛选
  if (currentView === 'memories') loadMemories();
}

function toggleMemorySort(field) {
  const sel = document.getElementById('memory-sort');
  const cur = sel.value;
  // event_date_desc / event_date_asc / created_at_desc / created_at_asc
  const asc = `${field}_asc`;
  const desc = `${field}_desc`;
  if (cur === asc) sel.value = desc;
  else if (cur === desc) sel.value = asc;
  else sel.value = desc; // 默认降序
  onMemoryFilterChange();
}

function updateMemorySortIndicator() {
  const sel = document.getElementById('memory-sort');
  const timeSpan = document.getElementById('memory-sort-indicator');
  const categorySpan = document.getElementById('memory-category-sort-indicator');
  if (!sel) return;
  const v = sel.value;
  if (timeSpan) timeSpan.textContent = v.startsWith('event_date') ? (v.endsWith('asc') ? '↑' : '↓') : '·';
  if (categorySpan) categorySpan.textContent = v.startsWith('category') ? (v.endsWith('asc') ? '↑' : '↓') : '·';
}

function getFilteredMemoryList() {
  // 服务端已筛,这里再按 currentSort 兜底
  return memoryList;
}

function renderMemoryList() {
  const tbody = document.getElementById('memory-list');
  const countEl = document.getElementById('memory-count');
  if (!tbody) return;
  const data = getFilteredMemoryList();
  if (countEl) countEl.textContent = `共 ${data.length} 条`;
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="loading">还没有记事,点击右上角新建。</td></tr>';
    document.getElementById('memory-pagination').innerHTML = '';
    return;
  }
  const totalPages = Math.max(1, Math.ceil(data.length / MEMORY_PER_PAGE));
  if (memoryPage > totalPages) memoryPage = totalPages;
  const start = (memoryPage - 1) * MEMORY_PER_PAGE;
  const pageRows = data.slice(start, start + MEMORY_PER_PAGE);
  tbody.innerHTML = pageRows.map(ev => {
    const relatedIds = (() => { try { return JSON.parse(ev.related_character_ids || '[]'); } catch (_) { return []; } })();
    const relatedNames = relatedIds.map(id => (characters.find(c => c.id === id) || {}).name).filter(Boolean);
    const mainName = ev.character_name || (ev.character_id ? `(${ev.character_id.slice(0,6)}…)` : '—');
    const catBadge = ev.category_id
      ? `<span class="memory-category-badge" style="background:${escapeHtml(ev.category_color || '#9a7a42')}">${escapeHtml(ev.category_name || '分类')}</span>`
      : '<span class="text-muted">未分类</span>';
    return `<tr>
      <td>${escapeHtml(ev.event_date || '—')}</td>
      <td><div class="memory-content">${escapeHtml(ev.event_notes || '（无正文）')}</div></td>
      <td>${mainName ? `<a class="memory-link" onclick="viewCharacterDetail('${ev.character_id}')">${escapeHtml(mainName)}</a>` : '—'}</td>
      <td>${relatedNames.length ? relatedNames.map(n => `<span class="memory-related-pill">${escapeHtml(n)}</span>`).join('') : '<span class="text-muted">—</span>'}</td>
      <td>${catBadge}</td>
      <td class="actions">
        <button class="btn btn-sm btn-secondary" onclick="editLifeEvent('${ev.id}','${ev.character_id || ''}')">编辑</button>
        <button class="btn btn-sm btn-danger" onclick="deleteLifeEvent('${ev.id}')">删除</button>
      </td>
    </tr>`;
  }).join('');
  renderMemoryPagination(totalPages);
}

function renderMemoryPagination(totalPages) {
  const container = document.getElementById('memory-pagination');
  if (!container) return;
  if (totalPages <= 1) { container.innerHTML = ''; return; }
  const start = Math.max(1, memoryPage - 2);
  const end = Math.min(totalPages, memoryPage + 2);
  let html = `<div class="pagination-info">第 ${memoryPage} / ${totalPages} 页</div><div class="pagination-buttons">`;
  html += `<button class="btn btn-sm btn-secondary" ${memoryPage <= 1 ? 'disabled' : ''} onclick="changeMemoryPage(${memoryPage - 1})">上一页</button>`;
  for (let p = start; p <= end; p++) {
    html += `<button class="btn btn-sm ${p === memoryPage ? 'btn-primary' : 'btn-secondary'}" onclick="changeMemoryPage(${p})">${p}</button>`;
  }
  html += `<button class="btn btn-sm btn-secondary" ${memoryPage >= totalPages ? 'disabled' : ''} onclick="changeMemoryPage(${memoryPage + 1})">下一页</button>`;
  html += '</div>';
  container.innerHTML = html;
}

function changeMemoryPage(p) {
  memoryPage = p;
  renderMemoryList();
}

// ===== Tree View =====
async function loadTreeOptions() {
  try {
    families = await api.get('/api/families');
    characters = await api.get('/api/characters');
    updateFamilySelects();
  } catch (e) {
    showToast('加载选项失败: ' + e.message, 'error');
  }
}

async function loadFamilyCharacters(familyId) {
  // 家族树视图不再使用单一角色下拉框
}

function openTreeCharacterModal() {
  const familyId = document.getElementById('tree-family-select').value;
  openCharacterModal(null);
  if (familyId) {
    const family = families.find(f => f.id === familyId);
    document.getElementById('character-family-input').value = family ? getFamilyDisplayName(family) : '';
  }
}

async function loadFamilyTree() {
  const familyId = document.getElementById('tree-family-select').value;
  const canvas = document.getElementById('tree-canvas');
  if (!canvas) return;
  try {
    resetTreeZoom();
    if (familyId) {
      const data = await api.get(`/api/family-tree/${familyId}`);
      renderMindMapTree([data]);
    } else {
      const datas = [];
      for (const family of families) {
        const data = await api.get(`/api/family-tree/${family.id}`);
        datas.push(data);
      }
      if (datas.length === 0) {
        canvas.innerHTML = '<div class="tree-placeholder"><p>暂无家族</p></div>';
        return;
      }
      renderMindMapTree(datas);
    }
  } catch (e) {
    showToast('加载族谱失败: ' + e.message, 'error');
  }
}

function addToMap(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

let treeZoom = 1;
let treePan = { x: 40, y: 40 };
let collapsedTreeNodes = new Set();

function zoomTree(delta) {
  treeZoom = Math.max(0.2, Math.min(3, treeZoom + delta));
  applyTreeZoom();
}

function resetTreeZoom() {
  treeZoom = 1;
  treePan = { x: 40, y: 40 };
  applyTreeZoom();
}

function applyTreeZoom() {
  const canvas = document.getElementById('tree-canvas');
  const label = document.getElementById('zoom-level');
  if (canvas) canvas.style.transform = `translate(${treePan.x}px, ${treePan.y}px) scale(${treeZoom})`;
  if (label) label.textContent = `${Math.round(treeZoom * 100)}%`;
}

function toggleCollapseNode(id) {
  if (collapsedTreeNodes.has(id)) collapsedTreeNodes.delete(id);
  else collapsedTreeNodes.add(id);
  loadFamilyTree();
}

// 思维导图式族谱：固定视口，严格树状，节点可折叠
const MM_NODE_W = 126;
const MM_NODE_H = 126;
const MM_H_GAP = 72;
const MM_V_GAP = 60;

function buildTreeFromData(data) {
  const people = new Map();
  for (const m of data.members || []) people.set(m.id, m);
  for (const e of data.external_characters || []) people.set(e.id, e);

  const marriages = new Map();
  const primarySpouses = new Map();
  const spouseKinds = new Map();
  for (const m of data.marriages || []) {
    addToMap(marriages, m.character_a_id, m.character_b_id);
    addToMap(marriages, m.character_b_id, m.character_a_id);
    if (!spouseKinds.has(m.character_a_id)) spouseKinds.set(m.character_a_id, new Map());
    if (!spouseKinds.has(m.character_b_id)) spouseKinds.set(m.character_b_id, new Map());
    spouseKinds.get(m.character_a_id).set(m.character_b_id, m.marriage_kind);
    spouseKinds.get(m.character_b_id).set(m.character_a_id, m.marriage_kind);
    if (m.marriage_kind === 'primary') {
      addToMap(primarySpouses, m.character_a_id, m.character_b_id);
      addToMap(primarySpouses, m.character_b_id, m.character_a_id);
    }
  }

  const parentsOf = new Map();
  const childrenOf = new Map();
  const birthStatuses = new Map();
  for (const pc of data.parent_child || []) {
    addToMap(parentsOf, pc.child_id, pc.parent_id);
    addToMap(childrenOf, pc.parent_id, pc.child_id);
    if (!birthStatuses.has(pc.child_id)) {
      birthStatuses.set(pc.child_id, pc.birth_status || 'legitimate');
    }
  }

  const memberIds = new Set((data.members || []).map(m => m.id));
  const roots = (data.members || [])
    .filter(m => !(parentsOf.get(m.id) || []).some(p => memberIds.has(p)))
    .map(m => m.id);

  const visited = new Set();
  function buildNode(id, birthStatus) {
    if (visited.has(id)) return null;
    visited.add(id);
    const person = people.get(id);
    if (!person) return null;
    const node = {
      id,
      person,
      spouses: (primarySpouses.get(id) || []).map(sid => people.get(sid)).filter(Boolean),
      spouseKinds: spouseKinds.get(id) || new Map(),
      birthStatus: birthStatus || 'legitimate',
      isExternal: false,
      children: []
    };
    for (const childId of (childrenOf.get(id) || [])) {
      if (memberIds.has(childId)) {
        const childNode = buildNode(childId, birthStatuses.get(childId) || 'legitimate');
        if (childNode) node.children.push(childNode);
      } else if (people.has(childId)) {
        node.children.push({
          id: childId,
          person: people.get(childId),
          spouses: [],
          spouseKinds: new Map(),
          birthStatus: birthStatuses.get(childId) || 'legitimate',
          isExternal: true,
          children: []
        });
      }
    }
    return node;
  }

  const treeRoots = roots.map(id => buildNode(id, birthStatuses.get(id) || 'legitimate')).filter(Boolean);

  // 处理孤立人物和循环关系：没被任何根节点连到的人物也单独展示
  for (const m of data.members || []) {
    if (!visited.has(m.id)) {
      const node = buildNode(m.id, birthStatuses.get(m.id) || 'legitimate');
      if (node) treeRoots.push(node);
    }
  }

  return treeRoots;
}

function layoutMindMap(roots, collapsed) {
  let maxX = 0;
  let maxY = 0;

  function shiftSubtree(node, shift) {
    node.y += shift;
    for (const child of node.children) shiftSubtree(child, shift);
  }

  function place(node, depth, top) {
    node.depth = depth;
    node.x = depth * (MM_NODE_W + MM_H_GAP) + 40;
    maxX = Math.max(maxX, node.x + MM_NODE_W);
    const children = collapsed.has(node.id) ? [] : node.children;

    if (children.length === 0) {
      node.y = top;
      maxY = Math.max(maxY, top + MM_NODE_H);
      return top + MM_NODE_H + MM_V_GAP;
    }

    let childTop = top;
    for (const child of children) {
      childTop = place(child, depth + 1, childTop);
    }
    childTop -= MM_V_GAP;

    const firstCenter = children[0].y + MM_NODE_H / 2;
    const lastCenter = children[children.length - 1].y + MM_NODE_H / 2;
    let parentY = (firstCenter + lastCenter) / 2 - MM_NODE_H / 2;

    if (parentY < top) {
      const shift = top - parentY;
      shiftSubtree(node, shift);
      parentY += shift;
      childTop += shift;
    }

    node.y = parentY;
    maxY = Math.max(maxY, parentY + MM_NODE_H, childTop);
    return childTop;
  }

  let top = 40;
  for (const root of roots) {
    top = place(root, 0, top);
  }

  return { width: maxX + 80, height: Math.max(maxY + 60, 480) };
}

function renderMindMapTree(datas) {
  const canvas = document.getElementById('tree-canvas');
  if (!canvas) return;

  const roots = datas.flatMap(d => buildTreeFromData(d));
  if (!roots.length) {
    canvas.innerHTML = '<div class="tree-placeholder"><p>暂无人物</p></div>';
    return;
  }

  const bounds = layoutMindMap(roots, collapsedTreeNodes);
  canvas.style.width = `${bounds.width}px`;
  canvas.style.height = `${bounds.height}px`;

  const edges = [];
  const nodesHtml = [];

  function collect(node) {
    const isCollapsed = collapsedTreeNodes.has(node.id);
    const hasChildren = node.children.length > 0;
    const children = isCollapsed ? [] : node.children;
    for (const child of children) edges.push({ parent: node, child });
    const genderClass = node.person.gender || 'other';
    const colorClass = getNodeColorClass(node.birthStatus);
    const spouseText = (node.spouses || []).map(s => {
      const kind = node.spouseKinds.get(s.id) || 'primary';
      const color = getMarriageKindColor(kind);
      return `<span style="color:${color}">${s.name}</span>`;
    }).join(' · ');
    nodesHtml.push(`
      <div class="mm-node ${colorClass}" style="left:${node.x}px;top:${node.y}px;" onclick="viewCharacterDetail('${node.id}')">
        ${node.isExternal ? '<div class="mm-badge">外</div>' : ''}
        ${hasChildren ? `<div class="mm-collapse" onclick="event.stopPropagation();toggleCollapseNode('${node.id}')">${isCollapsed ? '+' : '−'}</div>` : ''}
        <div class="avatar ${genderClass}" style="margin:0 auto 4px;">${node.person.avatar_id || '?'}</div>
        <div class="mm-name">${node.person.name}</div>
        <div class="mm-info">${node.person.family_name || ''}</div>
        ${spouseText ? `<div class="mm-spouse">配：${spouseText}</div>` : ''}
      </div>
    `);
    for (const child of children) collect(child);
  }
  for (const root of roots) collect(root);

  const childrenByParent = new Map();
  const parentById = new Map();
  for (const edge of edges) {
    parentById.set(edge.parent.id, edge.parent);
    if (!childrenByParent.has(edge.parent.id)) childrenByParent.set(edge.parent.id, []);
    childrenByParent.get(edge.parent.id).push(edge.child);
  }

  // 夫妻合并为一个主干，非夫妻各自独立主干
  const groups = [];
  const used = new Set();
  for (const [parentId, children] of childrenByParent) {
    if (used.has(parentId)) continue;
    const parent = parentById.get(parentId);
    if (!parent) continue;
    const spouseParent = (parent.spouses || []).find(s => childrenByParent.has(s.id) && !used.has(s.id));
    if (spouseParent) {
      groups.push({
        parents: [parent, parentById.get(spouseParent.id)],
        children: [...new Set([...children, ...childrenByParent.get(spouseParent.id)])]
      });
      used.add(parentId);
      used.add(spouseParent.id);
    } else {
      groups.push({ parents: [parent], children });
      used.add(parentId);
    }
  }

  const lines = [];
  groups.forEach((group, gi) => {
    const baseTrunkX = group.parents[0].x + MM_NODE_W + MM_H_GAP / 2;
    const trunkX = baseTrunkX + (gi - (groups.length - 1) / 2) * 7;
    const allYs = [
      ...group.parents.map(p => p.y + MM_NODE_H / 2),
      ...group.children.map(c => c.y + MM_NODE_H / 2)
    ];
    const minY = Math.min(...allYs);
    const maxY = Math.max(...allYs);
    const trunkColor = getLineColor(group.parents[0].birthStatus);

    for (const p of group.parents) {
      lines.push(`<path d="M ${p.x + MM_NODE_W} ${p.y + MM_NODE_H / 2} H ${trunkX}" fill="none" stroke="${trunkColor}" stroke-width="2"/>`);
    }
    lines.push(`<path d="M ${trunkX} ${minY} V ${maxY}" fill="none" stroke="${trunkColor}" stroke-width="2"/>`);
    for (const child of group.children) {
      const color = getLineColor(child.birthStatus);
      lines.push(`<path d="M ${trunkX} ${child.y + MM_NODE_H / 2} H ${child.x}" fill="none" stroke="${color}" stroke-width="2"/>`);
    }
  });

  canvas.innerHTML = `<svg class="mm-svg" width="${bounds.width}" height="${bounds.height}">${lines.join('')}</svg>${nodesHtml.join('')}`;
  applyTreeZoom();
}

function getNodeColorClass(birthStatus) {
  const map = {
    legitimate: 'mm-prime',
    concubine_born: 'mm-concubine',
    adopted: 'mm-adopted',
    illegitimate: 'mm-illegitimate'
  };
  return map[birthStatus] || 'mm-prime';
}

function getLineColor(birthStatus) {
  const map = {
    legitimate: '#9c3d2e',
    concubine_born: '#e2a0b0',
    adopted: '#6f8f6f',
    illegitimate: '#999999'
  };
  return map[birthStatus] || '#9c3d2e';
}

function getMarriageKindColor(kind) {
  const map = {
    primary: '#9a6f08',
    equal: '#c0392b',
    concubine: '#d8838b'
  };
  return map[kind] || '#9a6f08';
}

// ===== Ancestry (三族) - 重写：纯 generation + 防重叠迭代布局 =====
let ancestryZoom = 1;
let ancestryPan = { x: 40, y: 40 };

function applyAncestryZoom() {
  const canvas = document.getElementById('ancestry-canvas');
  const label = document.getElementById('ancestry-zoom-level');
  if (canvas && canvas.classList.contains('sanzu-mode')) {
    // 新版六行网格布局无需平移缩放
    if (canvas) canvas.style.transform = 'none';
    if (label) label.textContent = '';
    return;
  }
  if (canvas) canvas.style.transform = `translate(${ancestryPan.x}px, ${ancestryPan.y}px) scale(${ancestryZoom})`;
  if (label) label.textContent = `${Math.round(ancestryZoom * 100)}%`;
}

function zoomAncestry(delta) {
  ancestryZoom = Math.max(0.2, Math.min(3, ancestryZoom + delta));
  applyAncestryZoom();
}

function resetAncestryZoom() {
  ancestryZoom = 1;
  ancestryPan = { x: 40, y: 40 };
  applyAncestryZoom();
}

function initAncestryPan() {
  const viewport = document.getElementById('ancestry-viewport');
  if (!viewport || viewport.dataset.panBound) return;
  viewport.dataset.panBound = '1';

  let dragging = false;
  let startX = 0;
  let startY = 0;
  let pointerId = null;

  const isSanzuMode = () => {
    const canvas = document.getElementById('ancestry-canvas');
    return !!(canvas && canvas.classList.contains('sanzu-mode'));
  };

  viewport.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('.ancestry-node') || e.target.closest('.sanzu-card')) return;
    if (isSanzuMode()) return;
    dragging = true;
    pointerId = e.pointerId;
    startX = e.clientX - ancestryPan.x;
    startY = e.clientY - ancestryPan.y;
    viewport.setPointerCapture(e.pointerId);
    viewport.classList.add('is-panning');
  });
  viewport.addEventListener('pointermove', (e) => {
    if (!dragging || e.pointerId !== pointerId) return;
    ancestryPan.x = e.clientX - startX;
    ancestryPan.y = e.clientY - startY;
    applyAncestryZoom();
  });
  const endPan = e => {
    if (!dragging || (e && e.pointerId !== pointerId)) return;
    dragging = false;
    pointerId = null;
    viewport.classList.remove('is-panning');
  };
  viewport.addEventListener('pointerup', endPan);
  viewport.addEventListener('pointercancel', endPan);
  viewport.addEventListener('wheel', (e) => {
    if (isSanzuMode()) return; // 网格模式下让浏览器原生滚动
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    const rect = viewport.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const oldZoom = ancestryZoom;
    zoomAncestry(delta);
    ancestryPan.x = cx - (cx - ancestryPan.x) * (ancestryZoom / oldZoom);
    ancestryPan.y = cy - (cy - ancestryPan.y) * (ancestryZoom / oldZoom);
    applyAncestryZoom();
  }, { passive: false });
}

async function openAncestry(characterId) {
  if (!characterId) return;
  try {
    if (!families.length) families = await api.get('/api/families');
    if (!characters.length) characters = await api.get('/api/characters');
    const data = await api.get(`/api/tree/${characterId}?depth=5`);
    const knownPeople = new Map([
      data.character,
      ...(data.ancestors || []),
      ...(data.descendants || []),
      ...(data.related_characters || []),
      ...(data.siblings || []),
      ...characters
    ].filter(Boolean).map(person => [person.id, person]));
    const relations = data.all_parent_child || [];
    const parentIds = new Set(relations
      .filter(relation => relation.child_id === characterId)
      .map(relation => relation.parent_id));
    const siblingIds = new Set(relations
      .filter(relation => parentIds.has(relation.parent_id) && relation.child_id !== characterId)
      .map(relation => relation.child_id));
    data.siblings = [...new Set([...(data.siblings || []).map(person => person.id), ...siblingIds])]
      .map(id => knownPeople.get(id))
      .filter(Boolean);
    const title = document.getElementById('ancestry-title');
    if (title) title.textContent = `${data.character.name} · 三族谱系图`;
    resetAncestryZoom();
    const currentCenter = renderAncestryTree(data);
    document.getElementById('ancestry-modal').classList.add('active');
    document.body.classList.add('ancestry-open');
    document.documentElement.classList.add('ancestry-open');
    requestAnimationFrame(() => {
      const viewport = document.getElementById('ancestry-viewport');
      if (!viewport || !currentCenter) return;
      ancestryPan.x = viewport.clientWidth / 2 - currentCenter.x * ancestryZoom;
      ancestryPan.y = viewport.clientHeight / 2 - currentCenter.y * ancestryZoom;
      applyAncestryZoom();
    });
  } catch (e) {
    showToast('加载三族谱系图失败: ' + e.message, 'error');
  }
}

function closeAncestry() {
  document.getElementById('ancestry-modal').classList.remove('active');
  document.body.classList.remove('ancestry-open');
  document.documentElement.classList.remove('ancestry-open');
}

function openCharacterFromAncestry(id) {
  closeAncestry();
  viewCharacterDetail(id);
}

// ===== Settings =====
let currentEraName = '';

async function loadSettings() {
  try {
    const config = await api.get('/api/config');
    document.getElementById('db-path').value = config.dbPath || '';
    document.getElementById('era-name').value = config.eraName || '';
    currentEraName = config.eraName || '';
  } catch (e) {
    showToast('加载设置失败: ' + e.message, 'error');
  }
}

async function saveEraName() {
  const eraName = document.getElementById('era-name').value.trim();
  try {
    await api.post('/api/config', { eraName });
    currentEraName = eraName;
    showToast('年号已保存');
    loadSettings();
  } catch (e) {
    showToast('保存年号失败: ' + e.message, 'error');
  }
}

async function changeDbPath() {
  const newPath = prompt('请输入新的数据库路径:', document.getElementById('db-path').value);
  if (!newPath) return;
  
  try {
    await api.post('/api/config', { dbPath: newPath });
    showToast('数据库路径已更新');
    loadSettings();
  } catch (e) {
    showToast('更新路径失败: ' + e.message, 'error');
  }
}

async function exportData() {
  try {
    const data = await api.get('/api/export');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    // 优先用服务端给出的文件名（含章节名+时间戳）；否则前端兜底
    const ts = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
    const chapterPart = (data && data.chapter && data.chapter.name)
      ? data.chapter.name.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40)
      : 'default';
    a.download = `family-tree_${chapterPart}_${ts}.json`;
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
    showToast('备份已导出');
  } catch (e) {
    showToast('导出失败: ' + e.message, 'error');
  }
}

function importData() {
  document.getElementById('import-file').click();
}

async function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  if (!confirm('导入将覆盖所有现有数据，确定要继续吗？')) {
    e.target.value = '';
    return;
  }
  
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    await api.post('/api/import', data);
    showToast('数据导入成功');
    e.target.value = '';
    
    if (currentView === 'dashboard') loadDashboard();
    else if (currentView === 'families') loadFamilies();
    else if (currentView === 'characters') loadCharacters();
  } catch (e) {
    showToast('导入失败: ' + e.message, 'error');
  }
}

// ===== Helper Functions =====
async function loadAllCharacters() {
  characters = await api.get('/api/characters');
  tagLibrary = await api.get('/api/tags');
  loadCharacterDatalist();
}

function loadCharacterDatalist() {
  const datalist = document.getElementById('character-datalist');
  if (!datalist) return;
  datalist.innerHTML = characters.map(c => `<option value="${c.name}"></option>`).join('');
}

function resolveCharacterId(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return null;
  const char = characters.find(c => c.name === trimmed);
  return char ? char.id : null;
}

// ===== Initialization =====
document.addEventListener('DOMContentLoaded', () => {
  // Set up navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      showView(item.dataset.view);
    });
  });

  document.addEventListener('click', (e) => {
    const field = document.getElementById('occupation-tag-field');
    if (field && !field.contains(e.target)) hideOccupationOptions();
    const picker = document.getElementById('character-tag-picker');
    if (picker && picker.classList.contains('show') && !picker.contains(e.target) && !e.target.closest('.character-tags-actions')) {
      picker.classList.remove('show');
    }
    // 记事模块：相关人物下拉
    const relPicker = document.getElementById('life-event-related-picker');
    const relOptions = document.getElementById('life-event-related-options');
    if (relOptions && relOptions.classList.contains('show') && relPicker && !relPicker.contains(e.target)) {
      relOptions.classList.remove('show');
    }
  });
  
  // 加载纪年设置
  api.get('/api/config').then(config => {
    currentEraName = config.eraName || '';
  }).catch(() => {});

  // 族谱思维导图：平移 + 滚轮局部缩放
  const viewport = document.getElementById('tree-viewport');
  if (viewport) {
    let dragging = false;
    let startX = 0;
    let startY = 0;

    viewport.addEventListener('mousedown', (e) => {
      dragging = true;
      startX = e.clientX - treePan.x;
      startY = e.clientY - treePan.y;
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      treePan.x = e.clientX - startX;
      treePan.y = e.clientY - startY;
      applyTreeZoom();
    });
    window.addEventListener('mouseup', () => {
      dragging = false;
    });
    viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      const rect = viewport.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const oldZoom = treeZoom;
      zoomTree(delta);
      treePan.x = cx - (cx - treePan.x) * (treeZoom / oldZoom);
      treePan.y = cy - (cy - treePan.y) * (treeZoom / oldZoom);
      applyTreeZoom();
    }, { passive: false });
  }

  initAncestryPan();

  // 预热:加载年号与初始数据,避免首次进『记事一览』时分类为空
  loadSettings().catch(() => {});

  // Load initial view
  showView('dashboard');
});
