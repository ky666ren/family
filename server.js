const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const FamilyTreeDB = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders(res) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

let db = null;

function getConfigPath() {
  return path.join(__dirname, 'config.json');
}

function getChaptersPath() {
  return path.join(__dirname, 'chapters.json');
}

function getConfig() {
  if (fs.existsSync(getConfigPath())) {
    try { return JSON.parse(fs.readFileSync(getConfigPath(), 'utf8')); } catch (_) {}
  }
  return {};
}

function saveConfig(config) {
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
}

function getChapters() {
  if (!fs.existsSync(getChaptersPath())) return [];
  try { return JSON.parse(fs.readFileSync(getChaptersPath(), 'utf8')); } catch (_) { return []; }
}

function saveChapters(chapters) {
  fs.writeFileSync(getChaptersPath(), JSON.stringify(chapters, null, 2));
}

function getActiveChapterId() {
  return getConfig().activeChapterId || null;
}

function setActiveChapterId(chapterId) {
  const config = getConfig();
  config.activeChapterId = chapterId;
  saveConfig(config);
}

function getDbPath() {
  const activeChapterId = getActiveChapterId();
  if (activeChapterId) {
    const chapter = getChapters().find(c => c.id === activeChapterId);
    if (chapter && chapter.dbPath) return chapter.dbPath;
  }
  return getConfig().dbPath || path.join(__dirname, 'family_tree.db');
}

async function getDb() {
  if (db) {
    await db.ensureReady();
    return db;
  }
  db = new FamilyTreeDB(getDbPath());
  await db.ensureReady();
  return db;
}

app.use(async (_req, res, next) => {
  try {
    await getDb();
    next();
  } catch (e) {
    res.status(500).json({ error: 'Database init failed: ' + e.message });
  }
});

// ===== Chapters (篇章) =====
app.get('/api/chapters', (_req, res) => {
  res.json({ chapters: getChapters(), activeId: getActiveChapterId() });
});

app.post('/api/chapters', async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: '请输入篇章名称' });
  const chapters = getChapters();
  const id = generateId();
  const chapter = {
    id,
    name: name.trim(),
    dbPath: path.join(__dirname, 'chapters', `${id}.db`),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  chapters.push(chapter);
  saveChapters(chapters);
  if (db) { db.close(); db = null; }
  setActiveChapterId(id);
  try {
    await getDb();
    res.status(201).json(chapter);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/chapters/:id/activate', async (req, res) => {
  const chapter = getChapters().find(c => c.id === req.params.id);
  if (!chapter) return res.status(404).json({ error: '篇章不存在' });
  if (db) { db.close(); db = null; }
  setActiveChapterId(chapter.id);
  try {
    await getDb();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/chapters/:id', async (req, res) => {
  const chapterId = req.params.id;
  const chapters = getChapters().filter(c => c.id !== chapterId);
  saveChapters(chapters);
  if (getActiveChapterId() === chapterId) {
    if (db) { db.close(); db = null; }
    const next = chapters[0];
    setActiveChapterId(next ? next.id : null);
    try { await getDb(); } catch (_) {}
  }
  res.json({ success: true });
});

// ===== Config =====
app.get('/api/config', (_req, res) => {
  const config = getConfig();
  config.dbPath = config.dbPath || path.join(__dirname, 'family_tree.db');
  config.eraName = config.eraName || '';
  res.json(config);
});

app.post('/api/config', async (req, res) => {
  const { dbPath, eraName } = req.body;
  const existing = getConfig();
  const next = {
    dbPath: dbPath || existing.dbPath || path.join(__dirname, 'family_tree.db'),
    eraName: eraName !== undefined ? eraName : (existing.eraName || ''),
    activeChapterId: existing.activeChapterId || null
  };
  if (dbPath && db) { db.close(); db = null; }
  saveConfig(next);
  try {
    if (dbPath) await getDb();
    res.json({ success: true, message: '设置已保存', config: next });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ===== Families =====
app.get('/api/families', async (_req, res) => {
  try { res.json((await getDb()).getAllFamilies()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/families/:id', async (req, res) => {
  try {
    const f = (await getDb()).getFamilyById(req.params.id);
    f ? res.json(f) : res.status(404).json({ error: '家族不存在' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/families', async (req, res) => {
  try { res.status(201).json((await getDb()).createFamily(req.body)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/families/:id', async (req, res) => {
  try { res.json((await getDb()).updateFamily(req.params.id, req.body)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/families/:id', async (req, res) => {
  try { (await getDb()).deleteFamily(req.params.id); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ===== Characters =====
app.get('/api/characters', async (req, res) => {
  try {
    const d = await getDb();
    const { family_id, search } = req.query;
    if (search) res.json(d.searchCharacters(search));
    else if (family_id) res.json(d.getCharactersByFamily(family_id));
    else res.json(d.getAllCharacters());
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/characters/:id', async (req, res) => {
  try {
    const c = (await getDb()).getCharacterById(req.params.id);
    c ? res.json(c) : res.status(404).json({ error: '角色不存在' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/characters', async (req, res) => {
  try { res.status(201).json((await getDb()).createCharacter(req.body)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/characters/:id', async (req, res) => {
  try { res.json((await getDb()).updateCharacter(req.params.id, req.body)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/characters/:id', async (req, res) => {
  try { (await getDb()).deleteCharacter(req.params.id); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ===== Marriages =====
app.get('/api/marriages', async (req, res) => {
  try {
    const d = await getDb();
    const { character_id } = req.query;
    res.json(character_id ? d.getMarriagesByCharacter(character_id) : d.getAllMarriages());
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/marriages', async (req, res) => {
  try { res.status(201).json((await getDb()).createMarriage(req.body)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/marriages/:id', async (req, res) => {
  try { (await getDb()).deleteMarriage(req.params.id); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ===== Parent-Child =====
app.get('/api/parent-child', async (req, res) => {
  try {
    const d = await getDb();
    const { character_id } = req.query;
    if (character_id) {
      res.json({ parents: d.getParents(character_id), children: d.getChildren(character_id) });
    } else {
      res.json(d.getAllParentChildRelations());
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/parent-child', async (req, res) => {
  try { res.status(201).json((await getDb()).createParentChild(req.body)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/parent-child/:id', async (req, res) => {
  try { (await getDb()).deleteParentChild(req.params.id); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ===== Bonds (次要关系) =====
app.get('/api/bonds', async (req, res) => {
  try {
    const d = await getDb();
    const { character_id } = req.query;
    res.json(character_id ? d.getBondsByCharacter(character_id) : d.getAllBonds());
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/bonds', async (req, res) => {
  try { res.status(201).json((await getDb()).createBond(req.body)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/bonds/:id', async (req, res) => {
  try { (await getDb()).deleteBond(req.params.id); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ===== Life Events (往事录) =====
app.get('/api/life-events', async (req, res) => {
  try {
    const d = await getDb();
    const { character_id, category_id, search, sort, order } = req.query;
    if (character_id) return res.json(d.getLifeEventsByCharacter(character_id));
    res.json(d.getAllLifeEvents({
      categoryId: category_id || null,
      search: search || null,
      sort: sort || 'event_date',
      order: order || 'desc'
    }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/life-events/:id', async (req, res) => {
  try {
    const ev = (await getDb()).getLifeEventById(req.params.id);
    ev ? res.json(ev) : res.status(404).json({ error: '记事不存在' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/life-events', async (req, res) => {
  try { res.status(201).json((await getDb()).createLifeEvent(req.body)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/life-events/:id', async (req, res) => {
  try { res.json((await getDb()).updateLifeEvent(req.params.id, req.body)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/life-events/:id', async (req, res) => {
  try { (await getDb()).deleteLifeEvent(req.params.id); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ===== Life Event Categories (记事分类) =====
app.get('/api/life-event-categories', async (_req, res) => {
  try { res.json((await getDb()).getAllLifeEventCategories()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/life-event-categories', async (req, res) => {
  try {
    if (!req.body.name || !String(req.body.name).trim()) return res.status(400).json({ error: '分类名不能为空' });
    res.status(201).json((await getDb()).createLifeEventCategory(req.body));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/life-event-categories/:id', async (req, res) => {
  try {
    if (!req.body.name || !String(req.body.name).trim()) return res.status(400).json({ error: '分类名不能为空' });
    res.json((await getDb()).updateLifeEventCategory(req.params.id, req.body));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/life-event-categories/:id', async (req, res) => {
  try { (await getDb()).deleteLifeEventCategory(req.params.id); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ===== Tags =====
app.get('/api/tags', async (_req, res) => {
  try { res.json((await getDb()).getAllTags()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/tags', async (req, res) => {
  try {
    if (!req.body.name || !String(req.body.name).trim()) return res.status(400).json({ error: '标签名不能为空' });
    res.status(201).json((await getDb()).createTag(req.body));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/tags/:id', async (req, res) => {
  try {
    if (!req.body.name || !String(req.body.name).trim()) return res.status(400).json({ error: '标签名不能为空' });
    res.json((await getDb()).updateTag(req.params.id, req.body));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/tags/:id', async (req, res) => {
  try { (await getDb()).deleteTag(req.params.id); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ===== Tree =====
app.get('/api/family-tree/:familyId', async (req, res) => {
  try {
    const d = await getDb();
    res.json(d.getFamilyTreeData(req.params.familyId));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/tree/:characterId', async (req, res) => {
  try {
    const d = await getDb();
    const { characterId } = req.params;
    const depth = parseInt(req.query.depth) || 5;
    const character = d.getCharacterById(characterId);
    if (!character) return res.status(404).json({ error: '角色不存在' });
    const ancestors = d.getAncestors(characterId, 2);
    const descendants = d.getDescendants(characterId, depth);
    const siblingIds = new Set();
    for (const parent of d.getParents(characterId)) {
      for (const sibling of d.getChildren(parent.id)) {
        if (sibling.id !== characterId) siblingIds.add(sibling.id);
      }
    }
    const siblings = [...siblingIds].map(id => d.getCharacterById(id)).filter(Boolean);
    const parentSiblingIds = new Set();
    for (const parent of d.getParents(characterId)) {
      for (const grandparent of d.getParents(parent.id)) {
        for (const parentSibling of d.getChildren(grandparent.id)) {
          if (parentSibling.id !== parent.id) parentSiblingIds.add(parentSibling.id);
        }
      }
    }
    const parentSiblings = [...parentSiblingIds].map(id => d.getCharacterById(id)).filter(Boolean);
    const cousinChildren = [];
    const cousinChildIds = new Set();
    for (const parentSibling of parentSiblings) {
      for (const child of d.getChildren(parentSibling.id)) {
        if (cousinChildIds.has(child.id)) continue;
        cousinChildIds.add(child.id);
        cousinChildren.push({ ...child, parent_sibling_id: parentSibling.id });
      }
    }
    const siblingDescendants = [];
    const siblingDescendantIds = new Set();
    const siblingQueue = siblings.map(sibling => ({ id: sibling.id, level: 0 }));
    while (siblingQueue.length) {
      const { id, level } = siblingQueue.shift();
      if (level >= depth) continue;
      for (const child of d.getChildren(id)) {
        if (siblingDescendantIds.has(child.id)) continue;
        siblingDescendantIds.add(child.id);
        siblingDescendants.push({ ...child, level: level + 1, sibling_root_id: id });
        siblingQueue.push({ id: child.id, level: level + 1 });
      }
    }
    const siblingChildren = siblingDescendants.filter(sd => sd.level === 1)
      .map(sd => ({ ...sd, sibling_id: sd.sibling_root_id }));
    const siblingGrandchildren = siblingDescendants.filter(sd => sd.level === 2)
      .map(sd => ({ ...sd, sibling_child_id: sd.sibling_root_id }));
    const allIds = [characterId, ...ancestors.map(a => a.id), ...descendants.map(dd => dd.id), ...siblings.map(s => s.id), ...siblingDescendantIds, ...parentSiblings.map(p => p.id), ...cousinChildren.map(c => c.id)];
    const allMarriages = [];
    const allParentChild = [];
    for (const id of allIds) {
      if (!siblingDescendantIds.has(id)) allMarriages.push(...d.getMarriagesByCharacter(id));
      for (const p of d.getParents(id)) allParentChild.push({ parent_id: p.id, child_id: id, relationship_type: p.relationship_type || 'biological', birth_status: p.birth_status || 'legitimate' });
      for (const c of d.getChildren(id)) allParentChild.push({ parent_id: id, child_id: c.id, relationship_type: c.relationship_type || 'biological', birth_status: c.birth_status || 'legitimate' });
    }
    const uniqueMarriages = [...new Map(allMarriages.map(m => [m.id, m])).values()];
    const uniquePC = [...new Map(allParentChild.map(p => [`${p.parent_id}->${p.child_id}`, p])).values()];
    const relatedIds = new Set(allIds);
    const relatedCharacters = [];
    for (const m of uniqueMarriages) {
      for (const sid of [m.character_a_id, m.character_b_id]) {
        if (!relatedIds.has(sid)) {
          const sc = d.getCharacterById(sid);
          if (sc) {
            relatedIds.add(sid);
            relatedCharacters.push(sc);
          }
        }
      }
    }
    res.json({
      character,
      ancestors,
      descendants,
      siblings,
      sibling_children: siblingChildren,
      sibling_grandchildren: siblingGrandchildren,
      sibling_descendants: siblingDescendants,
      parent_siblings: parentSiblings,
      cousin_children: cousinChildren,
      all_marriages: uniqueMarriages,
      all_parent_child: uniquePC,
      related_characters: relatedCharacters
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===== Export / Import =====
app.get('/api/export', async (_req, res) => {
  try {
    const activeId = getActiveChapterId();
    const chapter = getChapters().find(c => c.id === activeId) || null;
    const payload = (await getDb()).exportData({
      chapter: chapter ? { id: chapter.id, name: chapter.name } : null
    });
    // 文件名形如：family-tree_第一篇章_2026-09-24-00-01-30.json
    const ts = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
    const safeName = (chapter ? chapter.name : 'default').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40) || 'default';
    const filename = `family-tree_${safeName}_${ts}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(JSON.stringify(payload, null, 2));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/import', async (req, res) => {
  try { (await getDb()).importData(req.body); res.json({ success: true, message: '数据导入成功' }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, async () => {
  console.log(`家族树管理工具已启动: http://localhost:${PORT}`);
  try { await getDb(); console.log('数据库已就绪'); }
  catch (e) { console.error('数据库初始化失败:', e); }
});
