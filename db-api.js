// ===== db-api.js =====
// 浏览器端 API shim —— 把 app.js 里的 fetch('/api/...') 调用映射到 FamilyTreeDB 方法。
// 与原 server.js 行为对齐（包括 chapters/config/导入导出），但所有数据存在浏览器本地。
//
// 数据存储：
//   - 每个篇章的 SQLite 数据 → IndexedDB，键 = chapter:<id>
//   - 篇章列表、当前激活 ID、eraName → localStorage
//
// 注意：本文件必须按顺序在 database.js 之后加载。

(function (rootScope) {
  'use strict';

  if (!rootScope.FamilyTreeDB || !rootScope.BrowserStorage) {
    throw new Error('db-api.js 必须在 database.js 之后加载');
  }
  const { FamilyTreeDB, BrowserStorage } = rootScope;

  const CHAPTERS_KEY = 'ftm:chapters';
  const CONFIG_KEY = 'ftm:config';

  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  function loadChapters() {
    try { return JSON.parse(localStorage.getItem(CHAPTERS_KEY) || '[]'); } catch (_) { return []; }
  }
  function saveChapters(chapters) {
    localStorage.setItem(CHAPTERS_KEY, JSON.stringify(chapters));
  }
  function loadConfig() {
    try { return JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}'); } catch (_) { return {}; }
  }
  function saveConfig(config) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  }

  let _activeDb = null;
  let _activeChapterId = null;
  let _activeDbPromise = null;

  async function getActiveDb() {
    if (_activeDb) return _activeDb;
    if (_activeDbPromise) return _activeDbPromise;
    _activeDbPromise = (async () => {
      const config = loadConfig();
      const chapters = loadChapters();
      let activeId = config.activeChapterId;
      if (!activeId && chapters.length) activeId = chapters[0].id;
      if (!activeId) {
        // 首次进入：自动创建一个默认篇章
        const id = uuid();
        const chapter = {
          id, name: '默认篇章',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        chapters.push(chapter);
        saveChapters(chapters);
        config.activeChapterId = id;
        if (config.eraName === undefined) config.eraName = '';
        saveConfig(config);
        activeId = id;
      }
      _activeChapterId = activeId;
      _activeDb = new FamilyTreeDB({ storageKey: `chapter:${activeId}` });
      await _activeDb.ensureReady();
      return _activeDb;
    })();
    try {
      return await _activeDbPromise;
    } finally {
      _activeDbPromise = null;
    }
  }

  async function closeActiveDb() {
    if (_activeDb) {
      try { await _activeDb.save(); } catch (_) {}
      _activeDb.close();
      _activeDb = null;
      _activeChapterId = null;
    }
  }

  async function setActiveChapter(id) {
    await closeActiveDb();
    const config = loadConfig();
    config.activeChapterId = id;
    saveConfig(config);
    _activeChapterId = id;
    _activeDb = new FamilyTreeDB({ storageKey: `chapter:${id}` });
    await _activeDb.ensureReady();
    return _activeDb;
  }

  function parseUrl(url) {
    const [path, query] = url.split('?');
    const params = {};
    if (query) {
      for (const pair of query.split('&')) {
        if (!pair) continue;
        const [k, v] = pair.split('=');
        params[decodeURIComponent(k)] = decodeURIComponent(v || '');
      }
    }
    return { path, params };
  }

  async function dispatchApi(method, url, body) {
    const { path, params } = parseUrl(url);
    const segs = path.split('/').filter(Boolean); // ['api', 'families', '123']
    const db = await getActiveDb();

    // -------- Chapters --------
    if (path === '/api/chapters') {
      if (method === 'GET') return { chapters: loadChapters(), activeId: _activeChapterId };
      if (method === 'POST') {
        const name = (body && body.name || '').trim();
        if (!name) throw new Error('请输入篇章名称');
        const id = uuid();
        const chapter = { id, name, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        const chapters = loadChapters();
        chapters.push(chapter);
        saveChapters(chapters);
        await setActiveChapter(id);
        return chapter;
      }
    }
    if (segs[0] === 'api' && segs[1] === 'chapters' && segs.length === 4 && segs[3] === 'activate') {
      const id = segs[2];
      const chapters = loadChapters();
      if (!chapters.find(c => c.id === id)) throw new Error('篇章不存在');
      await setActiveChapter(id);
      return { success: true };
    }
    if (segs[0] === 'api' && segs[1] === 'chapters' && segs.length === 3) {
      const id = segs[2];
      if (method === 'DELETE') {
        const chapters = loadChapters().filter(c => c.id !== id);
        saveChapters(chapters);
        try { await new BrowserStorage(`chapter:${id}`).remove(); } catch (_) {}
        if (_activeChapterId === id) {
          const next = chapters[0];
          if (next) { await setActiveChapter(next.id); }
          else {
            await closeActiveDb();
            const config = loadConfig();
            config.activeChapterId = null;
            saveConfig(config);
          }
        }
        return { success: true };
      }
    }

    // -------- Config --------
    if (path === '/api/config') {
      if (method === 'GET') {
        const config = loadConfig();
        config.eraName = config.eraName || '';
        return config;
      }
      if (method === 'POST') {
        const config = loadConfig();
        const next = { ...config };
        if (body && body.eraName !== undefined) next.eraName = body.eraName;
        saveConfig(next);
        return { success: true, message: '设置已保存', config: next };
      }
    }

    // -------- Families --------
    if (path === '/api/families') {
      if (method === 'GET') return db.getAllFamilies();
      if (method === 'POST') return await db.createFamily(body);
    }
    if (segs[0] === 'api' && segs[1] === 'families' && segs.length === 3) {
      const id = segs[2];
      if (method === 'GET') return db.getFamilyById(id);
      if (method === 'PUT') return await db.updateFamily(id, body);
      if (method === 'DELETE') { await db.deleteFamily(id); return { success: true }; }
    }

    // -------- Characters --------
    if (path === '/api/characters') {
      if (method === 'GET') {
        if (params.search) return db.searchCharacters(params.search);
        if (params.family_id) return db.getCharactersByFamily(params.family_id);
        return db.getAllCharacters();
      }
      if (method === 'POST') return await db.createCharacter(body);
    }
    if (segs[0] === 'api' && segs[1] === 'characters' && segs.length === 3) {
      const id = segs[2];
      if (method === 'GET') return db.getCharacterById(id);
      if (method === 'PUT') return await db.updateCharacter(id, body);
      if (method === 'DELETE') { await db.deleteCharacter(id); return { success: true }; }
    }

    // -------- Marriages --------
    if (path === '/api/marriages') {
      if (method === 'GET') {
        if (params.character_id) return db.getMarriagesByCharacter(params.character_id);
        return db.getAllMarriages();
      }
      if (method === 'POST') return await db.createMarriage(body);
    }
    if (segs[0] === 'api' && segs[1] === 'marriages' && segs.length === 3) {
      const id = segs[2];
      if (method === 'DELETE') { await db.deleteMarriage(id); return { success: true }; }
    }

    // -------- Parent-Child --------
    if (path === '/api/parent-child') {
      if (method === 'GET') {
        if (params.character_id) {
          return { parents: db.getParents(params.character_id), children: db.getChildren(params.character_id) };
        }
        return db.getAllParentChildRelations();
      }
      if (method === 'POST') return await db.createParentChild(body);
    }
    if (segs[0] === 'api' && segs[1] === 'parent-child' && segs.length === 3) {
      const id = segs[2];
      if (method === 'PUT') return await db.updateParentChild(id, body);
      if (method === 'DELETE') { await db.deleteParentChild(id); return { success: true }; }
    }

    // -------- Bonds --------
    if (path === '/api/bonds') {
      if (method === 'GET') {
        if (params.character_id) return db.getBondsByCharacter(params.character_id);
        return db.getAllBonds();
      }
      if (method === 'POST') return await db.createBond(body);
    }
    if (segs[0] === 'api' && segs[1] === 'bonds' && segs.length === 3) {
      const id = segs[2];
      if (method === 'DELETE') { await db.deleteBond(id); return { success: true }; }
    }

    // -------- Life Events --------
    if (path === '/api/life-events') {
      if (method === 'GET') {
        if (params.character_id) return db.getLifeEventsByCharacter(params.character_id);
        return db.getAllLifeEvents({
          categoryId: params.category_id || null,
          search: params.search || null,
          sort: params.sort || 'event_date',
          order: params.order || 'desc'
        });
      }
      if (method === 'POST') return await db.createLifeEvent(body);
    }
    if (segs[0] === 'api' && segs[1] === 'life-events' && segs.length === 3) {
      const id = segs[2];
      if (method === 'GET') return db.getLifeEventById(id);
      if (method === 'PUT') return await db.updateLifeEvent(id, body);
      if (method === 'DELETE') { await db.deleteLifeEvent(id); return { success: true }; }
    }

    // -------- Life Event Categories --------
    if (path === '/api/life-event-categories') {
      if (method === 'GET') return db.getAllLifeEventCategories();
      if (method === 'POST') return await db.createLifeEventCategory(body);
    }
    if (segs[0] === 'api' && segs[1] === 'life-event-categories' && segs.length === 3) {
      const id = segs[2];
      if (method === 'PUT') return await db.updateLifeEventCategory(id, body);
      if (method === 'DELETE') { await db.deleteLifeEventCategory(id); return { success: true }; }
    }

    // -------- Tags --------
    if (path === '/api/tags') {
      if (method === 'GET') return db.getAllTags();
      if (method === 'POST') return await db.createTag(body);
    }
    if (segs[0] === 'api' && segs[1] === 'tags' && segs.length === 3) {
      const id = segs[2];
      if (method === 'PUT') return await db.updateTag(id, body);
      if (method === 'DELETE') { await db.deleteTag(id); return { success: true }; }
    }

    // -------- Family Tree --------
    if (segs[0] === 'api' && segs[1] === 'family-tree' && segs.length === 3) {
      const familyId = segs[2];
      if (method === 'GET') return db.getFamilyTreeData(familyId);
    }

    // -------- Character Tree (中心树) --------
    if (segs[0] === 'api' && segs[1] === 'tree' && segs.length === 3) {
      if (method === 'GET') {
        const characterId = segs[2];
        const depth = parseInt(params.depth) || 5;
        const character = db.getCharacterById(characterId);
        if (!character) throw new Error('角色不存在');
        const ancestors = db.getAncestors(characterId, 2);
        const descendants = db.getDescendants(characterId, depth);
        const siblingIds = new Set();
        for (const parent of db.getParents(characterId)) {
          for (const sibling of db.getChildren(parent.id)) {
            if (sibling.id !== characterId) siblingIds.add(sibling.id);
          }
        }
        const siblings = [...siblingIds].map(id => db.getCharacterById(id)).filter(Boolean);
        const parentSiblingIds = new Set();
        for (const parent of db.getParents(characterId)) {
          for (const grandparent of db.getParents(parent.id)) {
            for (const parentSibling of db.getChildren(grandparent.id)) {
              if (parentSibling.id !== parent.id) parentSiblingIds.add(parentSibling.id);
            }
          }
        }
        const parentSiblings = [...parentSiblingIds].map(id => db.getCharacterById(id)).filter(Boolean);
        const cousinChildren = [];
        const cousinChildIds = new Set();
        for (const parentSibling of parentSiblings) {
          for (const child of db.getChildren(parentSibling.id)) {
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
          for (const child of db.getChildren(id)) {
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
        const allIds = [characterId, ...ancestors.map(a => a.id), ...descendants.map(dd => dd.id),
          ...siblings.map(s => s.id), ...siblingDescendantIds,
          ...parentSiblings.map(p => p.id), ...cousinChildren.map(c => c.id)];
        const allMarriages = [];
        const allParentChild = [];
        for (const id of allIds) {
          if (!siblingDescendantIds.has(id)) allMarriages.push(...db.getMarriagesByCharacter(id));
          for (const p of db.getParents(id)) allParentChild.push({ parent_id: p.id, child_id: id, relationship_type: p.relationship_type || 'biological', birth_status: p.birth_status || 'legitimate', role_label: p.role_label || null });
          for (const c of db.getChildren(id)) allParentChild.push({ parent_id: id, child_id: c.id, relationship_type: c.relationship_type || 'biological', birth_status: c.birth_status || 'legitimate', role_label: c.role_label || null });
        }
        const uniqueMarriages = [...new Map(allMarriages.map(m => [m.id, m])).values()];
        const uniquePC = [...new Map(allParentChild.map(p => [`${p.parent_id}->${p.child_id}`, p])).values()];
        const relatedIds = new Set(allIds);
        const relatedCharacters = [];
        for (const m of uniqueMarriages) {
          for (const sid of [m.character_a_id, m.character_b_id]) {
            if (!relatedIds.has(sid)) {
              const sc = db.getCharacterById(sid);
              if (sc) { relatedIds.add(sid); relatedCharacters.push(sc); }
            }
          }
        }
        return {
          character, ancestors, descendants, siblings,
          sibling_children: siblingChildren,
          sibling_grandchildren: siblingGrandchildren,
          sibling_descendants: siblingDescendants,
          parent_siblings: parentSiblings,
          cousin_children: cousinChildren,
          all_marriages: uniqueMarriages,
          all_parent_child: uniquePC,
          related_characters: relatedCharacters
        };
      }
    }

    // -------- Export / Import --------
    if (path === '/api/export' && method === 'GET') {
      const chapters = loadChapters();
      const chapter = chapters.find(c => c.id === _activeChapterId) || null;
      return db.exportData({
        chapter: chapter ? { id: chapter.id, name: chapter.name } : null
      });
    }
    if (path === '/api/import' && method === 'POST') {
      await db.importData(body);
      return { success: true, message: '数据导入成功' };
    }

    throw new Error(`未实现的 API: ${method} ${url}`);
  }

  const api = {
    async get(url) { return await dispatchApi('GET', url); },
    async post(url, body) { return await dispatchApi('POST', url, body); },
    async put(url, body) { return await dispatchApi('PUT', url, body); },
    async delete(url) { return await dispatchApi('DELETE', url); }
  };

  rootScope.api = api;
  // 提供一个就绪 Promise，app.js 可以在初次加载时 await 它再渲染数据
  rootScope.apiReady = getActiveDb().catch(e => { console.error('数据库初始化失败:', e); return null; });
})(typeof window !== 'undefined' ? window : globalThis);