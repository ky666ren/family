(() => {
  // ==== 身份 → 名字颜色（与项目整体色调一致的古典色） ====
  const COLOR = {
    primary: '#b8242a',        // 正室 / 嫡出 - 朱红
    equal: '#b8242a',          // 平妻（与正室同级，沿用朱红）
    concubine: '#d8838b',      // 妾室 / 庶出 - 粉
    adopted: '#4a7c4a',        // 收养 / 过继 - 深绿
    illegitimate: '#1f1f1f',   // 私生 - 黑
    default: '#4a1515'         // 祖辈 / 父辈 / 本人 / 手足 - 暗红
  };

  const SPOUSE_KIND_ORDER = { primary: 0, equal: 1, concubine: 2 };

  function getSpouseColor(kind) {
    return COLOR[kind] || COLOR.primary;
  }

  function getChildColor(relationshipType, birthStatus) {
    if (relationshipType === 'adopted' || relationshipType === 'guoji') return COLOR.adopted;
    return COLOR[birthStatus] || COLOR.primary;
  }

  function getSpouseLabel(kind) {
    if (kind === 'primary') return '正室';
    if (kind === 'equal') return '平妻';
    if (kind === 'concubine') return '妾室';
    return '配偶';
  }

  function getChildLabel(relationshipType, birthStatus) {
    if (relationshipType === 'adopted') return '收养';
    if (relationshipType === 'guoji') return '过继';
    if (birthStatus === 'legitimate') return '嫡出';
    if (birthStatus === 'concubine_born') return '庶出';
    if (birthStatus === 'illegitimate') return '私生';
    return '';
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function personCardHtml(person, opts) {
    opts = opts || {};
    const name = person.name || '(无名)';
    const color = opts.color || COLOR.default;
    const tag = opts.tag || '';
    const isCurrent = !!opts.isCurrent;
    const deceased = person.is_alive === 0;
    const rowKey = opts.rowKey || '';
    const classes = [
      'sanzu-card',
      isCurrent ? 'sanzu-current' : '',
      deceased ? 'sanzu-deceased' : ''
    ].filter(Boolean).join(' ');
    const tip = [name, tag].filter(Boolean).join(' · ');
    // 中心人物本人不可删；其他角色显示 × 按钮
    const removeBtn = !isCurrent
      ? `<button type="button" class="sanzu-card-del" onclick="event.stopPropagation(); window.removeSanzuRelation('${escapeHtml(rowKey)}','${escapeHtml(person.id)}')" title="解除关系">×</button>`
      : '';
    return `
      <div class="${classes}" data-person-id="${escapeHtml(person.id)}" data-row="${escapeHtml(rowKey)}"
        style="color:${color};" title="${escapeHtml(tip)}">
        <button type="button" class="sanzu-card-name" onclick="event.stopPropagation(); if(window.openCharacterFromSanzu){window.openCharacterFromSanzu('${escapeHtml(person.id)}')}else if(window.viewCharacterDetail){window.viewCharacterDetail('${escapeHtml(person.id)}')}">
          ${escapeHtml(name)}
        </button>
        ${tag ? `<span class="sanzu-card-tag">${escapeHtml(tag)}</span>` : ''}
        ${deceased ? '<span class="sanzu-card-tag sanzu-card-tag-deceased">已故</span>' : ''}
        ${removeBtn}
      </div>
    `;
  }

  function organize(data) {
    const byId = new Map();
    byId.set(data.character.id, data.character);
    (data.ancestors || []).forEach(p => byId.set(p.id, p));
    (data.descendants || []).forEach(p => byId.set(p.id, p));
    (data.siblings || []).forEach(p => byId.set(p.id, p));
    (data.related_characters || []).forEach(p => byId.set(p.id, p));

    const currentId = data.character.id;
    const allParentChild = data.all_parent_child || [];

    const grandparents = (data.ancestors || []).filter(a => a.level === 2);
    const parents = (data.ancestors || []).filter(a => a.level === 1);
    const selfAndSiblings = [data.character, ...(data.siblings || [])];

    // 妻妾 - 仅含当前人物的配偶，过滤掉前配偶/其他
    const spouses = [];
    for (const m of (data.all_marriages || [])) {
      if (m.relationship_type === 'former_spouse' || m.relationship_type === 'other') continue;
      let otherId = null;
      if (m.character_a_id === currentId) otherId = m.character_b_id;
      else if (m.character_b_id === currentId) otherId = m.character_a_id;
      if (!otherId) continue;
      const person = byId.get(otherId);
      if (!person) continue;
      spouses.push({ person, kind: m.marriage_kind || 'primary' });
    }
    spouses.sort((a, b) => (SPOUSE_KIND_ORDER[a.kind] || 0) - (SPOUSE_KIND_ORDER[b.kind] || 0));

    const children = (data.descendants || []).filter(d => d.level === 1);
    const grandchildren = (data.descendants || []).filter(d => d.level === 2);

    // 当前人物 → 子女的出身/关系
    const childMeta = new Map();
    for (const r of allParentChild) {
      if (r.parent_id === currentId) {
        childMeta.set(r.child_id, {
          relationship_type: r.relationship_type || 'biological',
          birth_status: r.birth_status || 'legitimate'
        });
      }
    }

    // 孙子孙女自己的出身/关系（按他们与父母的亲子关系取）
    const gcMeta = new Map();
    for (const r of allParentChild) {
      if (gcMeta.has(r.child_id)) continue;
      gcMeta.set(r.child_id, {
        relationship_type: r.relationship_type || 'biological',
        birth_status: r.birth_status || 'legitimate'
      });
    }

    // 区分父系 / 母系祖父母
    const father = parents.find(p => p.gender === 'male');
    const mother = parents.find(p => p.gender === 'female');
    const parentsOf = id => allParentChild
      .filter(r => r.child_id === id)
      .map(r => byId.get(r.parent_id))
      .filter(Boolean);
    const fatherParents = father ? parentsOf(father.id) : [];
    const motherParents = mother ? parentsOf(mother.id) : [];

    return {
      grandparents,
      parents,
      selfAndSiblings,
      spouses,
      children,
      grandchildren,
      childMeta,
      gcMeta,
      fatherParents,
      motherParents,
      byId
    };
  }

  function renderRow(rowName, label, cards, opts) {
    opts = opts || {};
    const addBtn = opts.hideAdd ? '' : `<button type="button" class="sanzu-row-add" onclick="event.stopPropagation(); window.openSanzuAdd('${escapeHtml(rowName)}')" title="添加${escapeHtml(label)}">＋</button>`;
    if (opts.splitSelf) {
      // 两栏：左=本人（无 ＋），右=手足（有 ＋）
      const selfHtml = opts.selfCardHtml || '<span class="sanzu-empty">无</span>';
      const sibCards = opts.sibCardsHtml || [];
      const sibHtml = sibCards.length ? sibCards.join('') : '<span class="sanzu-empty">无</span>';
      return `
      <div class="sanzu-row sanzu-row-split-self" data-row="${escapeHtml(rowName)}">
        <div class="sanzu-row-label">
          <span class="sanzu-row-label-text">${escapeHtml(label)}</span>
        </div>
        <div class="sanzu-row-cols">
          <div class="sanzu-row-col sanzu-row-col-self">
            <div class="sanzu-row-col-cards">${selfHtml}</div>
          </div>
          <div class="sanzu-row-col sanzu-row-col-siblings">
            <div class="sanzu-row-col-cards">${sibHtml}</div>
            <button type="button" class="sanzu-row-add" onclick="event.stopPropagation(); window.openSanzuAdd('${escapeHtml(rowName)}')" title="添加${escapeHtml(label)}">＋</button>
          </div>
        </div>
      </div>
    `;
    }
    const cardsHtml = cards.length
      ? cards.join('')
      : '<span class="sanzu-empty">无</span>';
    return `
      <div class="sanzu-row" data-row="${escapeHtml(rowName)}">
        <div class="sanzu-row-label">
          <span class="sanzu-row-label-text">${escapeHtml(label)}</span>
          ${addBtn}
        </div>
        <div class="sanzu-row-cards">${cardsHtml}</div>
      </div>
    `;
  }

  function renderSanzuTree(data) {
    const canvas = document.getElementById('ancestry-canvas');
    if (!canvas) return null;

    // 标记为新布局模式（让 app.js / CSS 跳过平移缩放）
    canvas.classList.add('sanzu-mode');
    canvas.style.transform = 'none';
    const viewport = document.getElementById('ancestry-viewport');
    if (viewport) viewport.classList.add('sanzu-mode');

    if (!data || !data.character) {
      canvas.innerHTML = '<div class="sanzu-empty sanzu-empty-main">暂无人物数据</div>';
      return null;
    }

    const r = organize(data);
    const currentId = data.character.id;

    // 1. 祖父母 / 外祖父母（先父系后母系）
    const gpCards = [];
    r.fatherParents.forEach(p => {
      gpCards.push(personCardHtml(p, {
        tag: p.gender === 'male' ? '祖父' : '祖母',
        color: COLOR.default,
        rowKey: 'grandparents'
      }));
    });
    r.motherParents.forEach(p => {
      gpCards.push(personCardHtml(p, {
        tag: p.gender === 'male' ? '外祖父' : '外祖母',
        color: COLOR.default,
        rowKey: 'grandparents'
      }));
    });
    if (!gpCards.length && r.grandparents.length) {
      r.grandparents.forEach(p => {
        gpCards.push(personCardHtml(p, { tag: '祖辈', color: COLOR.default, rowKey: 'grandparents' }));
      });
    }

    // 2. 父母
    const parentCards = r.parents.map(p => {
      const tag = p.gender === 'male' ? '父' : (p.gender === 'female' ? '母' : '亲');
      return personCardHtml(p, { tag, color: COLOR.default, rowKey: 'parents' });
    });

    // 3. 当前人物与手足（本人高亮）—— 拆成两栏：本人在左，手足在右
    const centerChar = data.character;
    const selfCardHtml = personCardHtml(centerChar, {
      tag: '本人', isCurrent: true, color: COLOR.default, rowKey: 'self-siblings'
    });
    const siblingCardStrs = (data.siblings || []).map(p => {
      let tag = '';
      if (p.gender === 'male') tag = '兄弟';
      else if (p.gender === 'female') tag = '姐妹';
      else tag = '手足';
      return personCardHtml(p, { tag, isCurrent: false, color: COLOR.default, rowKey: 'self-siblings' });
    });

    // 4. 妻妾
    const spouseCards = r.spouses.map(({ person, kind }) =>
      personCardHtml(person, { tag: getSpouseLabel(kind), color: getSpouseColor(kind), rowKey: 'spouses' })
    );

    // 5. 子女
    const childCards = r.children.map(c => {
      const meta = r.childMeta.get(c.id) || {};
      const color = getChildColor(meta.relationship_type, meta.birth_status);
      let tag = getChildLabel(meta.relationship_type, meta.birth_status);
      if (!tag) tag = c.gender === 'male' ? '子' : (c.gender === 'female' ? '女' : '子女');
      return personCardHtml(c, { tag, color, rowKey: 'children' });
    });

    // 6. 孙子孙女
    const gcCards = r.grandchildren.map(c => {
      const meta = r.gcMeta.get(c.id) || {};
      const color = getChildColor(meta.relationship_type, meta.birth_status);
      let tag = getChildLabel(meta.relationship_type, meta.birth_status);
      if (!tag) tag = c.gender === 'male' ? '孙' : (c.gender === 'female' ? '孙女' : '孙辈');
      return personCardHtml(c, { tag, color, rowKey: 'grandchildren' });
    });

    canvas.innerHTML = `
      <div class="sanzu-grid">
        <div class="sanzu-legend">
          <span class="sanzu-legend-title">图例</span>
          <span class="sanzu-legend-item" style="color:${COLOR.primary}">正室 · 嫡出</span>
          <span class="sanzu-legend-item" style="color:${COLOR.concubine}">妾室 · 庶出</span>
          <span class="sanzu-legend-item" style="color:${COLOR.adopted}">收养 · 过继</span>
          <span class="sanzu-legend-item" style="color:${COLOR.illegitimate}">私生</span>
          <span class="sanzu-legend-hint">点击名字可查看详情</span>
        </div>
        ${renderRow('grandparents', '祖父母 / 外祖父母', gpCards)}
        ${renderRow('parents', '父母', parentCards)}
        ${renderRow('self-siblings', '本人与手足', [], {
          splitSelf: true,
          selfCardHtml,
          sibCardsHtml: siblingCardStrs
        })}
        ${renderRow('spouses', '妻妾', spouseCards)}
        ${renderRow('children', '子女', childCards)}
        ${renderRow('grandchildren', '孙子孙女', gcCards)}
      </div>
    `;

    canvas.querySelectorAll('.sanzu-card').forEach(card => {
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof openCharacterFromAncestry === 'function') {
          openCharacterFromAncestry(card.dataset.personId);
        } else if (typeof viewCharacterDetail === 'function') {
          viewCharacterDetail(card.dataset.personId);
        }
      });
    });

    return null;
  }

  window.renderAncestryTree = renderSanzuTree;
})();
