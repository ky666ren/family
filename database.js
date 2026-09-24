const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

class FamilyTreeDB {
  constructor(dbPath) {
    this.dbPath = dbPath || path.join(process.cwd(), 'family_tree.db');
    this.db = null;
    this.ready = this._init();
  }

  async _init() {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const SQL = await initSqlJs();
    if (fs.existsSync(this.dbPath)) {
      this.db = new SQL.Database(fs.readFileSync(this.dbPath));
    } else {
      this.db = new SQL.Database();
    }
    this.db.run('PRAGMA foreign_keys = ON');
    this._createTables();
    this.save();
  }

  async ensureReady() { await this.ready; }

  save() {
    if (!this.db) return;
    fs.writeFileSync(this.dbPath, Buffer.from(this.db.export()));
  }

  _createTables() {
    this.db.run(`CREATE TABLE IF NOT EXISTS families (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, notes TEXT, description TEXT,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    )`);
    this.db.run(`CREATE TABLE IF NOT EXISTS characters (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, gender TEXT,
      family_id TEXT REFERENCES families(id) ON DELETE SET NULL,
      birth_date TEXT, death_date TEXT, avatar_id INTEGER DEFAULT 0,
      notes TEXT, is_alive INTEGER DEFAULT 1, title TEXT, identity TEXT,
      origin TEXT,
      occupation TEXT, tags TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    )`);
    this.db.run(`CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    )`);
    this.db.run(`CREATE TABLE IF NOT EXISTS marriages (
      id TEXT PRIMARY KEY,
      character_a_id TEXT REFERENCES characters(id) ON DELETE CASCADE,
      character_b_id TEXT REFERENCES characters(id) ON DELETE CASCADE,
      relationship_type TEXT DEFAULT 'spouse', marriage_kind TEXT DEFAULT 'primary',
      marriage_date TEXT, notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`);
    this.db.run(`CREATE TABLE IF NOT EXISTS parent_child (
      id TEXT PRIMARY KEY,
      parent_id TEXT REFERENCES characters(id) ON DELETE CASCADE,
      child_id TEXT REFERENCES characters(id) ON DELETE CASCADE,
      relationship_type TEXT DEFAULT 'biological', birth_status TEXT DEFAULT 'legitimate',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`);
    this.db.run(`CREATE TABLE IF NOT EXISTS bonds (
      id TEXT PRIMARY KEY,
      character_a_id TEXT REFERENCES characters(id) ON DELETE CASCADE,
      character_b_id TEXT REFERENCES characters(id) ON DELETE CASCADE,
      bond_type TEXT DEFAULT 'custom', bond_label TEXT, color TEXT DEFAULT '#9a7a42',
      notes TEXT, created_at TEXT DEFAULT (datetime('now'))
    )`);
    this.db.run(`CREATE TABLE IF NOT EXISTS life_events (
      id TEXT PRIMARY KEY,
      character_id TEXT REFERENCES characters(id) ON DELETE CASCADE,
      event_date TEXT, event_title TEXT, event_notes TEXT,
      related_character_ids TEXT DEFAULT '[]',
      category_id TEXT REFERENCES life_event_categories(id) ON DELETE SET NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )`);
    this.db.run(`CREATE TABLE IF NOT EXISTS life_event_categories (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT,
      color TEXT DEFAULT '#9a7a42',
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    )`);

    // 兼容已有数据库：补充新字段
    try {
      if (!this._columnExists('marriages', 'marriage_kind')) {
        this.db.run("ALTER TABLE marriages ADD COLUMN marriage_kind TEXT DEFAULT 'primary'");
      }
      if (!this._columnExists('parent_child', 'birth_status')) {
        this.db.run("ALTER TABLE parent_child ADD COLUMN birth_status TEXT DEFAULT 'legitimate'");
      }
      if (!this._columnExists('characters', 'origin')) {
        this.db.run('ALTER TABLE characters ADD COLUMN origin TEXT');
      }
      if (!this._columnExists('life_events', 'related_character_ids')) {
        this.db.run("ALTER TABLE life_events ADD COLUMN related_character_ids TEXT DEFAULT '[]'");
      }
      if (!this._columnExists('life_events', 'category_id')) {
        this.db.run('ALTER TABLE life_events ADD COLUMN category_id TEXT');
      }
    } catch (_) {}
    const idx = [
      'CREATE INDEX IF NOT EXISTS idx_char_family ON characters(family_id)',
      'CREATE INDEX IF NOT EXISTS idx_marr_a ON marriages(character_a_id)',
      'CREATE INDEX IF NOT EXISTS idx_marr_b ON marriages(character_b_id)',
      'CREATE INDEX IF NOT EXISTS idx_pc_parent ON parent_child(parent_id)',
      'CREATE INDEX IF NOT EXISTS idx_pc_child ON parent_child(child_id)',
      'CREATE INDEX IF NOT EXISTS idx_bonds_a ON bonds(character_a_id)',
      'CREATE INDEX IF NOT EXISTS idx_bonds_b ON bonds(character_b_id)',
      'CREATE INDEX IF NOT EXISTS idx_life_character ON life_events(character_id)',
      'CREATE INDEX IF NOT EXISTS idx_life_category ON life_events(category_id)',
      'CREATE INDEX IF NOT EXISTS idx_life_date ON life_events(event_date)'
    ];
    for (const s of idx) { try { this.db.run(s); } catch (_) {} }
  }

  // --- query helpers ---
  _all(sql, params = []) {
    const st = this.db.prepare(sql);
    if (params.length) st.bind(params);
    const r = [];
    while (st.step()) r.push(st.getAsObject());
    st.free();
    return r;
  }
  _get(sql, params = []) {
    const st = this.db.prepare(sql);
    if (params.length) st.bind(params);
    let r = null;
    if (st.step()) r = st.getAsObject();
    st.free();
    return r;
  }
  _run(sql, params = []) { this.db.run(sql, params); }

  _columnExists(table, column) {
    const cols = this._all(`PRAGMA table_info(${table})`);
    return cols.some(c => c.name === column);
  }

  _occupationStorage(value) {
    if (value == null) return null;
    if (Array.isArray(value)) return JSON.stringify(value.map(String).map(v => v.trim()).filter(Boolean));
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) return JSON.stringify(parsed.map(String).map(v => v.trim()).filter(Boolean));
        } catch (_) {}
      }
      return trimmed || null;
    }
    return String(value) || null;
  }

  // ===== Families =====
  getAllFamilies() { return this._all('SELECT * FROM families ORDER BY name'); }
  getFamilyById(id) { return this._get('SELECT * FROM families WHERE id=?', [id]); }
  createFamily(d) {
    const id = this._id();
    this._run('INSERT INTO families(id,name,notes,description) VALUES(?,?,?,?)',
      [id, d.name, d.notes||null, d.description||null]);
    this.save(); return {id,...d};
  }
  updateFamily(id, d) {
    this._run("UPDATE families SET name=?,notes=?,description=?,updated_at=datetime('now') WHERE id=?",
      [d.name, d.notes||null, d.description||null, id]);
    this.save(); return {id,...d};
  }
  deleteFamily(id) {
    this._run('UPDATE characters SET family_id=NULL WHERE family_id=?',[id]);
    this._run('DELETE FROM families WHERE id=?',[id]); this.save();
  }

  // ===== Characters =====
  getAllCharacters() { return this._all('SELECT c.*,f.name as family_name FROM characters c LEFT JOIN families f ON c.family_id=f.id ORDER BY c.name'); }
  getCharacterById(id) { return this._get('SELECT c.*,f.name as family_name FROM characters c LEFT JOIN families f ON c.family_id=f.id WHERE c.id=?',[id]); }
  getCharactersByFamily(fid) { return this._all('SELECT c.*,f.name as family_name FROM characters c LEFT JOIN families f ON c.family_id=f.id WHERE c.family_id=? ORDER BY c.name',[fid]); }
  searchCharacters(q) { const l=`%${q}%`; return this._all('SELECT c.*,f.name as family_name FROM characters c LEFT JOIN families f ON c.family_id=f.id WHERE c.name LIKE ? OR c.identity LIKE ? OR c.occupation LIKE ? ORDER BY c.name',[l,l,l]); }
  createCharacter(d) {
    const id=this._id();
    this._run('INSERT INTO characters(id,name,gender,family_id,birth_date,death_date,avatar_id,notes,is_alive,title,identity,origin,occupation,tags) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [id,d.name,d.gender||null,d.family_id||null,d.birth_date||null,d.death_date||null,d.avatar_id||0,d.notes||null,d.is_alive!==undefined?(d.is_alive?1:0):1,d.title||null,d.identity||null,d.origin||null,this._occupationStorage(d.occupation),JSON.stringify(d.tags||[])]);
    this.save(); return {id,...d};
  }
  updateCharacter(id,d) {
    this._run("UPDATE characters SET name=?,gender=?,family_id=?,birth_date=?,death_date=?,avatar_id=?,notes=?,is_alive=?,title=?,identity=?,origin=?,occupation=?,tags=?,updated_at=datetime('now') WHERE id=?",
      [d.name,d.gender||null,d.family_id||null,d.birth_date||null,d.death_date||null,d.avatar_id||0,d.notes||null,d.is_alive!==undefined?(d.is_alive?1:0):1,d.title||null,d.identity||null,d.origin||null,this._occupationStorage(d.occupation),JSON.stringify(d.tags||[]),id]);
    this.save(); return {id,...d};
  }
  deleteCharacter(id) { this._run('DELETE FROM characters WHERE id=?',[id]); this.save(); }

  // ===== Marriages =====
  getAllMarriages() { return this._all('SELECT m.*,ca.name as character_a_name,ca.family_id as character_a_family_id,cb.name as character_b_name,cb.family_id as character_b_family_id FROM marriages m JOIN characters ca ON m.character_a_id=ca.id JOIN characters cb ON m.character_b_id=cb.id'); }
  getMarriagesByCharacter(cid) { return this._all('SELECT m.*,ca.name as character_a_name,ca.family_id as character_a_family_id,cb.name as character_b_name,cb.family_id as character_b_family_id FROM marriages m JOIN characters ca ON m.character_a_id=ca.id JOIN characters cb ON m.character_b_id=cb.id WHERE m.character_a_id=? OR m.character_b_id=?',[cid,cid]); }
  createMarriage(d) {
    const id=this._id();
    this._run('INSERT INTO marriages(id,character_a_id,character_b_id,relationship_type,marriage_kind,marriage_date,notes) VALUES(?,?,?,?,?,?,?)',
      [id,d.character_a_id,d.character_b_id,d.relationship_type||'spouse',d.marriage_kind||'primary',d.marriage_date||null,d.notes||null]);
    this.save(); return {id,...d};
  }
  deleteMarriage(id) { this._run('DELETE FROM marriages WHERE id=?',[id]); this.save(); }

  // ===== Parent-Child =====
  getAllParentChildRelations() { return this._all('SELECT pc.*,p.name as parent_name,p.family_id as parent_family_id,c.name as child_name,c.family_id as child_family_id FROM parent_child pc JOIN characters p ON pc.parent_id=p.id JOIN characters c ON pc.child_id=c.id'); }
  getParents(cid) { return this._all('SELECT p.*,pc.id as pc_id,pc.relationship_type,pc.birth_status,pc.notes as relation_notes FROM parent_child pc JOIN characters p ON pc.parent_id=p.id WHERE pc.child_id=?',[cid]); }
  getChildren(cid) { return this._all('SELECT c.*,pc.id as pc_id,pc.relationship_type,pc.birth_status,pc.notes as relation_notes FROM parent_child pc JOIN characters c ON pc.child_id=c.id WHERE pc.parent_id=?',[cid]); }
  createParentChild(d) {
    const id=this._id();
    this._run('INSERT INTO parent_child(id,parent_id,child_id,relationship_type,birth_status,notes) VALUES(?,?,?,?,?,?)',
      [id,d.parent_id,d.child_id,d.relationship_type||'biological',d.birth_status||'legitimate',d.notes||null]);
    this.save(); return {id,...d};
  }
  deleteParentChild(id) { this._run('DELETE FROM parent_child WHERE id=?',[id]); this.save(); }

  // ===== Bonds (次要关系) =====
  getAllBonds() { return this._all('SELECT b.*,ca.name as character_a_name,cb.name as character_b_name FROM bonds b JOIN characters ca ON b.character_a_id=ca.id JOIN characters cb ON b.character_b_id=cb.id'); }
  getBondsByCharacter(cid) { return this._all('SELECT b.*,ca.name as character_a_name,cb.name as character_b_name FROM bonds b JOIN characters ca ON b.character_a_id=ca.id JOIN characters cb ON b.character_b_id=cb.id WHERE b.character_a_id=? OR b.character_b_id=?',[cid,cid]); }
  createBond(d) {
    const id=this._id();
    this._run('INSERT INTO bonds(id,character_a_id,character_b_id,bond_type,bond_label,color,notes) VALUES(?,?,?,?,?,?,?)',
      [id,d.character_a_id,d.character_b_id,d.bond_type||'custom',d.bond_label||null,d.color||'#9a7a42',d.notes||null]);
    this.save(); return {id,...d};
  }
  deleteBond(id) { this._run('DELETE FROM bonds WHERE id=?',[id]); this.save(); }

  // ===== Life Events (往事录) =====
  _lifeEventSelectFields() {
    return `le.*, le.character_id as character_id,
            c.name as character_name, c.avatar_id as character_avatar_id,
            cat.id as category_id, cat.name as category_name, cat.color as category_color`;
  }
  _lifeEventFromJoin() {
    return `FROM life_events le
            LEFT JOIN characters c ON le.character_id = c.id
            LEFT JOIN life_event_categories cat ON le.category_id = cat.id`;
  }

  // 把 event_date 字符串解析成可比较的 (年号, 年, 月) 三元组
  // event_date 是中文自由格式(年号+数字年+月、年号+年、纯月等),
  // 字典序比较会让 "10月" 排在 "1月" 前面,必须先解析再比
  _parseLifeEventDate(s) {
    if (!s || typeof s !== 'string') return { era: '￿', year: 9999, month: 99 };
    // 标准格式: <年号>数字年[(数字)月]  例如 "泰盛6年11月" / "2024年5月" / "泰盛6年"
    const m = s.match(/^(.*?)(\d+)年(?:(\d{1,2})月)?/);
    if (m) {
      return {
        era: m[1] || '￿',
        year: parseInt(m[2], 10) || 9999,
        month: m[3] ? parseInt(m[3], 10) : 99  // 99 = 当作该年最末
      };
    }
    // 兜底: "N月" 或 "N月..."
    const m2 = s.match(/^(\d{1,2})月/);
    if (m2) {
      return { era: '￿', year: 9999, month: parseInt(m2[1], 10) };
    }
    return { era: '￿', year: 9999, month: 99 };
  }

  _sortLifeEventsByDate(rows, direction = 'desc') {
    const dir = direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const A = this._parseLifeEventDate(a.event_date);
      const B = this._parseLifeEventDate(b.event_date);
      if (A.era !== B.era) {
        const c = A.era.localeCompare(B.era, 'zh-CN');
        if (c !== 0) return c * dir;
      }
      if (A.year !== B.year) return (A.year - B.year) * dir;
      if (A.month !== B.month) return (A.month - B.month) * dir;
      return String(a.created_at || '').localeCompare(String(b.created_at || '')) * dir;
    });
  }

  getLifeEventsByCharacter(cid) {
    // event_date 是中文格式字符串,直接 SQL ORDER BY 字典序会乱
    // (例如 "泰盛6年10月" < "泰盛6年1月"),改成 JS 层按 (年号,年,月) 排
    const rows = this._all(
      `SELECT ${this._lifeEventSelectFields()} ${this._lifeEventFromJoin()} WHERE le.character_id=? ORDER BY le.created_at DESC`,
      [cid]
    );
    return this._sortLifeEventsByDate(rows, 'desc');
  }

  getAllLifeEvents(opts = {}) {
    const where = [];
    const params = [];
    if (opts.categoryId) { where.push('le.category_id = ?'); params.push(opts.categoryId); }
    const sort = opts.sort === 'created_at' ? 'le.created_at' :
      (opts.sort === 'category' ? 'cat.name' : null);
    const order = (opts.order || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const sortByEventDate = !sort;
    const orderClause = sort ? `ORDER BY ${sort} ${order}, le.created_at ${order}` : 'ORDER BY le.created_at DESC';
    const sql = `SELECT ${this._lifeEventSelectFields()} ${this._lifeEventFromJoin()} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ${orderClause}`;
    let rows = this._all(sql, params);
    if (sortByEventDate) {
      rows = this._sortLifeEventsByDate(rows, (opts.order || 'desc').toLowerCase());
    }
    const search = (opts.search || '').trim().toLowerCase();
    if (!search) return rows;
    const namesById = new Map(
      this._all('SELECT id, name FROM characters').map(c => [c.id, c.name])
    );
    return rows.filter(row => {
      const relatedIds = (() => {
        try { return JSON.parse(row.related_character_ids || '[]'); } catch (_) { return []; }
      })();
      const relatedNames = relatedIds.map(id => namesById.get(id)).filter(Boolean);
      return [
        row.event_date,
        row.event_notes,
        row.character_name,
        ...relatedNames
      ].filter(Boolean).some(value => String(value).toLowerCase().includes(search));
    });
  }

  getLifeEventById(id) {
    return this._get(`SELECT ${this._lifeEventSelectFields()} ${this._lifeEventFromJoin()} WHERE le.id=?`, [id]);
  }

  createLifeEvent(d) {
    const id = this._id();
    this._run('INSERT INTO life_events(id,character_id,event_date,event_notes,related_character_ids,category_id) VALUES(?,?,?,?,?,?)',
      [id, d.character_id || null, d.event_date || null, d.event_notes || null,
       JSON.stringify(Array.isArray(d.related_character_ids) ? d.related_character_ids : []),
       d.category_id || null]);
    this.save();
    return this.getLifeEventById(id);
  }

  updateLifeEvent(id, d) {
    this._run("UPDATE life_events SET character_id=?,event_date=?,event_title=NULL,event_notes=?,related_character_ids=?,category_id=? WHERE id=?",
      [d.character_id || null, d.event_date || null, d.event_notes || null,
       JSON.stringify(Array.isArray(d.related_character_ids) ? d.related_character_ids : []),
       d.category_id || null, id]);
    this.save();
    return this.getLifeEventById(id);
  }

  deleteLifeEvent(id) { this._run('DELETE FROM life_events WHERE id=?',[id]); this.save(); }

  // ===== Life Event Categories (记事分类) =====
  getAllLifeEventCategories() { return this._all('SELECT * FROM life_event_categories ORDER BY name'); }
  getLifeEventCategoryById(id) { return this._get('SELECT * FROM life_event_categories WHERE id=?', [id]); }
  createLifeEventCategory(d) {
    const id = this._id();
    this._run('INSERT INTO life_event_categories(id,name,description,color) VALUES(?,?,?,?)',
      [id, (d.name||'').trim() || '未命名', d.description || null, d.color || '#9a7a42']);
    this.save();
    return this.getLifeEventCategoryById(id);
  }
  updateLifeEventCategory(id, d) {
    this._run("UPDATE life_event_categories SET name=?,description=?,color=?,updated_at=datetime('now') WHERE id=?",
      [(d.name||'').trim() || '未命名', d.description || null, d.color || '#9a7a42', id]);
    this.save();
    return this.getLifeEventCategoryById(id);
  }
  deleteLifeEventCategory(id) {
    this._run('DELETE FROM life_event_categories WHERE id=?',[id]);
    this.save();
  }

  // ===== Tags (角色标签) =====
  getAllTags() { return this._all('SELECT * FROM tags ORDER BY name'); }
  getTagById(id) { return this._get('SELECT * FROM tags WHERE id=?',[id]); }
  createTag(d) {
    const id = this._id();
    this._run('INSERT INTO tags(id,name,description) VALUES(?,?,?)',
      [id, d.name, d.description||null]);
    this.save(); return {id, name:d.name, description:d.description||null};
  }
  updateTag(id,d) {
    this._run("UPDATE tags SET name=?,description=?,updated_at=datetime('now') WHERE id=?",
      [d.name, d.description||null, id]);
    this.save(); return {id, name:d.name, description:d.description||null};
  }
  deleteTag(id) {
    const chars = this._all("SELECT id,tags FROM characters WHERE tags IS NOT NULL AND tags != '[]'");
    for (const c of chars) {
      let list = [];
      try { list = JSON.parse(c.tags || '[]'); } catch (_) {}
      if (Array.isArray(list) && list.includes(id)) {
        this._run("UPDATE characters SET tags=?,updated_at=datetime('now') WHERE id=?",
          [JSON.stringify(list.filter(t => t !== id)), c.id]);
      }
    }
    this._run('DELETE FROM tags WHERE id=?',[id]);
    this.save();
  }

  // ===== Tree =====
  getAncestors(cid, depth) {
    const res=[], vis=new Set(), q=[{id:cid,lvl:0}];
    while(q.length){const{id,lvl}=q.shift();if(lvl>=depth||vis.has(id))continue;vis.add(id);
      for(const p of this.getParents(id)){res.push({...p,level:lvl+1,relation:'parent'});q.push({id:p.id,lvl:lvl+1});}}
    return res;
  }
  getDescendants(cid, depth) {
    const res=[], vis=new Set(), q=[{id:cid,lvl:0}];
    while(q.length){const{id,lvl}=q.shift();if(lvl>=depth||vis.has(id))continue;vis.add(id);
      for(const c of this.getChildren(id)){res.push({...c,level:lvl+1,relation:'child'});q.push({id:c.id,lvl:lvl+1});}}
    return res;
  }

  getFamilyTreeData(familyId) {
    const members = this.getCharactersByFamily(familyId);
    const memberIds = new Set(members.map(m => m.id));
    const marriages = [];
    const parentChild = [];
    const bonds = [];

    for (const id of memberIds) {
      marriages.push(...this.getMarriagesByCharacter(id));
      for (const p of this.getParents(id)) {
        parentChild.push({ parent_id: p.id, child_id: id, relationship_type: p.relationship_type, birth_status: p.birth_status || 'legitimate' });
      }
      for (const c of this.getChildren(id)) {
        parentChild.push({ parent_id: id, child_id: c.id, relationship_type: c.relationship_type, birth_status: c.birth_status || 'legitimate' });
      }
      bonds.push(...this.getBondsByCharacter(id));
    }

    const uniqueMarriages = [...new Map(marriages.map(m => [m.id, m])).values()];
    const uniquePC = [...new Map(parentChild.map(p => [`${p.parent_id}->${p.child_id}`, p])).values()];
    const uniqueBonds = [...new Map(bonds.map(b => [b.id, b])).values()];

    // 外部配偶、父母、子女（其他家族或无家族）
    const externalIds = new Set();
    for (const m of uniqueMarriages) {
      if (!memberIds.has(m.character_a_id)) externalIds.add(m.character_a_id);
      if (!memberIds.has(m.character_b_id)) externalIds.add(m.character_b_id);
    }
    for (const pc of uniquePC) {
      if (!memberIds.has(pc.parent_id)) externalIds.add(pc.parent_id);
      if (!memberIds.has(pc.child_id)) externalIds.add(pc.child_id);
    }
    const externalCharacters = [...externalIds].map(id => this.getCharacterById(id)).filter(Boolean);

    return {
      members,
      external_characters: externalCharacters,
      marriages: uniqueMarriages,
      parent_child: uniquePC,
      bonds: uniqueBonds
    };
  }

  // ===== Export / Import =====
  // 导出格式（带元数据）：
  //   { format: 'family-tree-manager-backup', version: 1,
  //     exported_at, chapter: { id, name } | null, data: { ...业务表 } }
  // 旧版本（没有 format 字段）依然视为一份扁平业务对象以兼容。
  exportData(meta = {}) {
    return {
      format: 'family-tree-manager-backup',
      version: 1,
      exported_at: new Date().toISOString(),
      chapter: meta.chapter || null,
      data: {
        families: this.getAllFamilies(),
        characters: this.getAllCharacters(),
        marriages: this.getAllMarriages(),
        parent_child: this.getAllParentChildRelations(),
        bonds: this.getAllBonds(),
        life_events: this._all('SELECT * FROM life_events'),
        life_event_categories: this.getAllLifeEventCategories(),
        tags: this.getAllTags()
      }
    };
  }
  // 接受新格式（带 format 包裹）或旧格式（扁平对象）。未知字段会被忽略。
  importData(input) {
    if (!input || typeof input !== 'object') throw new Error('导入数据格式无效');
    const data = input.format === 'family-tree-manager-backup'
      ? (input.data || {})
      : input;
    this._run('DELETE FROM life_events');
    this._run('DELETE FROM life_event_categories');
    this._run('DELETE FROM bonds');
    this._run('DELETE FROM parent_child');
    this._run('DELETE FROM marriages');
    this._run('DELETE FROM characters');
    this._run('DELETE FROM families');
    this._run('DELETE FROM tags');
    for (const f of data.families || []) this._run('INSERT INTO families(id,name,notes,description,created_at,updated_at) VALUES(?,?,?,?,?,?)', [f.id,f.name,f.notes,f.description,f.created_at,f.updated_at]);
    for (const c of data.characters || []) this._run('INSERT INTO characters(id,name,gender,family_id,birth_date,death_date,avatar_id,notes,is_alive,title,identity,origin,occupation,tags,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [c.id,c.name,c.gender,c.family_id,c.birth_date,c.death_date,c.avatar_id,c.notes,c.is_alive,c.title,c.identity,c.origin,c.occupation,c.tags,c.created_at,c.updated_at]);
    for (const m of data.marriages || []) this._run('INSERT INTO marriages(id,character_a_id,character_b_id,relationship_type,marriage_kind,marriage_date,notes,created_at) VALUES(?,?,?,?,?,?,?,?)', [m.id,m.character_a_id,m.character_b_id,m.relationship_type,m.marriage_kind,m.marriage_date,m.notes,m.created_at]);
    for (const p of data.parent_child || []) this._run('INSERT INTO parent_child(id,parent_id,child_id,relationship_type,birth_status,notes,created_at) VALUES(?,?,?,?,?,?,?)', [p.id,p.parent_id,p.child_id,p.relationship_type,p.birth_status,p.notes,p.created_at]);
    for (const b of data.bonds || []) this._run('INSERT INTO bonds(id,character_a_id,character_b_id,bond_type,bond_label,color,notes,created_at) VALUES(?,?,?,?,?,?,?,?)', [b.id,b.character_a_id,b.character_b_id,b.bond_type,b.bond_label,b.color,b.notes,b.created_at]);
    for (const l of data.life_events || []) {
      this._run('INSERT INTO life_events(id,character_id,event_date,event_title,event_notes,related_character_ids,category_id,created_at) VALUES(?,?,?,?,?,?,?,?)',
        [l.id,l.character_id,l.event_date,l.event_title,l.event_notes,l.related_character_ids || '[]',l.category_id||null,l.created_at]);
    }
    for (const c of data.life_event_categories || []) {
      this._run('INSERT INTO life_event_categories(id,name,description,color,created_at,updated_at) VALUES(?,?,?,?,?,?)',
        [c.id,c.name,c.description||null,c.color||'#9a7a42',c.created_at,c.updated_at]);
    }
    for (const t of data.tags || []) this._run('INSERT INTO tags(id,name,description,created_at,updated_at) VALUES(?,?,?,?,?)', [t.id,t.name,t.description,t.created_at,t.updated_at]);
    this.save();
  }

  _id() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c==='x'?r:(r&0x3|0x8)).toString(16)}); }
  close() { if(this.db){this.save();this.db.close();this.db=null;} }
}

module.exports = FamilyTreeDB;
