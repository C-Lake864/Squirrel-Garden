// ===== 화면 로직 =====
let currentFilter = 'today';

// 오늘 날짜 'YYYY-MM-DD' (로컬 기준)
const todayStr = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// 사용자가 입력한 글자가 HTML을 깨뜨리지 않도록 escape (안전)
const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

async function api(path, opts) {
  const res = await fetch(path, opts);
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    alert(e.error || '오류가 발생했어요.');
    throw new Error(e.error || 'request failed');
  }
  return res.json();
}

// ---------- 나무 그림(SVG) ----------
function treeSVG(level) {
  const ground = `<rect x="0" y="144" width="240" height="36" fill="none"/>`;
  if (level === 0) {
    return `<svg viewBox="0 0 240 180">${ground}
      <ellipse cx="120" cy="150" rx="22" ry="7" fill="#8a6a41"/>
      <circle cx="120" cy="144" r="5" fill="#b07c43"/></svg>`;
  }
  const spec = {
    1: { trunkH: 16, trunkW: 5, canopy: [[120, 128, 15]] },
    2: { trunkH: 30, trunkW: 7, canopy: [[120, 112, 22]] },
    3: { trunkH: 48, trunkW: 10, canopy: [[120, 92, 32]] },
    4: { trunkH: 70, trunkW: 14, canopy: [[120, 70, 42], [98, 88, 28], [142, 88, 28]] },
    5: { trunkH: 92, trunkW: 18, canopy: [[120, 48, 50], [88, 78, 36], [152, 78, 36], [120, 92, 38]] },
  }[level];
  const baseY = 150;
  const trunk = `<rect x="${120 - spec.trunkW / 2}" y="${baseY - spec.trunkH}" width="${spec.trunkW}" height="${spec.trunkH}" rx="3" fill="#7b5233"/>`;
  const leaves = spec.canopy
    .map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#4c9a5a"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="#5fb26e" opacity="0.5"/>`)
    .join('');
  return `<svg viewBox="0 0 240 180">${ground}
    <ellipse cx="120" cy="152" rx="28" ry="7" fill="#8a6a41"/>
    ${trunk}${leaves}</svg>`;
}

// ---------- 다람쥐 그림(SVG): 크레용으로 그린 듯한 동글동글한 모습 ----------
function squirrelSVG() {
  return `<svg viewBox="0 0 230 232" role="img" aria-label="다람쥐">
    <g filter="url(#crayon)">
      <g class="tail">
        <path d="M120 202 C192 218 222 152 206 100 C196 58 154 26 126 46 C112 56 118 76 136 72 C152 72 160 96 156 124 C152 154 138 176 114 178 Z" fill="#b8692b"/>
        <path d="M150 112 C158 90 152 70 136 64 C158 54 190 80 192 112 C194 142 172 164 142 168 C150 154 148 132 150 112 Z" fill="#d38845" opacity=".85"/>
      </g>
      <ellipse cx="108" cy="162" rx="50" ry="54" fill="#ea9440"/>
      <ellipse cx="92" cy="174" rx="28" ry="38" fill="#f8cc96"/>
      <ellipse cx="88" cy="214" rx="23" ry="10" fill="#d8812f"/>
      <ellipse cx="128" cy="216" rx="23" ry="10" fill="#d8812f"/>
      <ellipse cx="56" cy="58" rx="16" ry="20" transform="rotate(-18 56 58)" fill="#ea9440"/>
      <ellipse cx="57" cy="60" rx="8" ry="11" transform="rotate(-18 57 60)" fill="#d27a2c"/>
      <ellipse cx="124" cy="58" rx="16" ry="20" transform="rotate(18 124 58)" fill="#ea9440"/>
      <ellipse cx="123" cy="60" rx="8" ry="11" transform="rotate(18 123 60)" fill="#d27a2c"/>
      <ellipse cx="90" cy="98" rx="55" ry="47" fill="#ee9a43"/>
      <ellipse cx="90" cy="112" rx="30" ry="22" fill="#f8cc96" opacity=".7"/>
      <circle cx="50" cy="112" r="10" fill="#f08a86" opacity=".85"/>
      <circle cx="130" cy="112" r="10" fill="#f08a86" opacity=".85"/>
      <circle cx="68" cy="94" r="6.4" fill="#3a2418"/>
      <circle cx="70" cy="92" r="2.1" fill="#fff"/>
      <circle cx="112" cy="94" r="6.4" fill="#3a2418"/>
      <circle cx="114" cy="92" r="2.1" fill="#fff"/>
      <ellipse cx="90" cy="106" rx="7" ry="5.4" fill="#5b3220"/>
      <path d="M78 115 Q84 124 90 115 Q96 124 102 115" fill="none" stroke="#5b3220" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <ellipse cx="94" cy="154" rx="11" ry="13" fill="#8a5a2b"/>
      <path d="M82 148 Q94 136 106 148 Z" fill="#5b3a1c"/>
      <ellipse cx="78" cy="156" rx="11" ry="9" transform="rotate(-20 78 156)" fill="#f0a85a"/>
      <ellipse cx="110" cy="156" rx="11" ry="9" transform="rotate(20 110 156)" fill="#f0a85a"/>
    </g>
  </svg>`;
}

// ---------- 정원 그리기 ----------
async function loadGarden() {
  const g = await api('/api/garden');
  const prev = [0, 5, 10, 15, 20].filter((t) => t <= g.acorns).pop() ?? 0;
  const pct = g.nextMilestone ? Math.round(((g.acorns - prev) / (g.nextMilestone - prev)) * 100) : 100;

  document.getElementById('garden').innerHTML = `
    <h2>${g.stageName}</h2>
    <div class="scene">${treeSVG(g.level)}<div class="squirrel">${squirrelSVG()}</div></div>
    <div class="acorn-count">이번 달 알밤 <strong>${g.acorns}</strong>개 <span class="month">(${g.month})</span></div>
    <div class="acorns">${'🌰'.repeat(Math.min(g.acorns, 30)) || '아직 없어요'}</div>
    <div class="progress">
      <div class="bar"><div class="fill" style="width:${pct}%"></div></div>
      <div class="progress-label">${g.nextMilestone ? `다음 단계까지 알밤 ${g.remainingToNext}개` : '🎉 최고 단계 달성!'}</div>
    </div>
    <div class="today-status">${g.todayEarned ? '✅ 오늘 알밤을 묻었어요!' : '오늘 마감 할 일을 모두 끝내면 알밤을 묻어요.'}</div>`;
}

// ---------- 할 일 목록 그리기 ----------
async function loadTodos() {
  const todos = await api(`/api/todos?filter=${currentFilter}`);
  const ul = document.getElementById('todo-list');
  if (todos.length === 0) {
    ul.innerHTML = `<li class="empty">${currentFilter === 'today' ? '오늘 할 일이 없어요. 하나 추가해볼까요?' : '할 일이 없어요.'}</li>`;
    return;
  }
  const today = todayStr();
  ul.innerHTML = todos
    .map((t) => {
      let dueHtml = '';
      if (t.due_date) {
        let cls = 'due';
        const overdue = !t.is_done && t.due_date < today;
        if (overdue) cls += ' overdue';
        else if (t.due_date === today) cls += ' today';
        dueHtml = `<span class="${cls}">📅 ${t.due_date}${overdue ? ' (지남)' : ''}</span>`;
      }
      const catHtml = t.category ? `<span class="chip">#${escapeHtml(t.category)}</span>` : '';
      const tinyHtml = t.is_tiny ? `<span class="tiny-badge">대충 모드</span>` : '';
      const shrinkBtn = t.is_tiny
        ? `<button data-restore="${t.id}">↩︎ 원래대로</button>`
        : `<button data-shrink="${t.id}">대충하기</button>`;
      return `<li class="todo ${t.is_done ? 'done' : ''}">
        <label class="check">
          <input type="checkbox" ${t.is_done ? 'checked' : ''} data-toggle="${t.id}">
          <span class="title">${escapeHtml(t.title)}</span>
        </label>
        <div class="meta">${catHtml}${dueHtml}${tinyHtml}</div>
        <div class="actions">${shrinkBtn}<button class="danger" data-delete="${t.id}">🗑️</button></div>
      </li>`;
    })
    .join('');
}

async function refresh() {
  await Promise.all([loadTodos(), loadGarden()]);
}

// ---------- 이벤트 ----------
document.getElementById('add-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('title');
  const category = document.getElementById('category');
  const due = document.getElementById('due_date');
  await api('/api/todos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: title.value, category: category.value, due_date: due.value }),
  });
  title.value = category.value = due.value = '';
  title.focus();
  refresh();
});

document.querySelectorAll('.filters button').forEach((btn) =>
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filters button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    loadTodos();
  })
);

// 목록 안의 버튼/체크박스는 위임으로 한 번에 처리
document.getElementById('todo-list').addEventListener('click', async (e) => {
  const el = e.target.closest('[data-toggle],[data-shrink],[data-pick],[data-custom],[data-cancel],[data-restore],[data-delete]');
  if (!el) return;

  if (el.dataset.toggle) {
    await api(`/api/todos/${el.dataset.toggle}/toggle`, { method: 'POST' });
  } else if (el.dataset.shrink) {
    // 추천 후보를 보여 준다 (이미 열려 있으면 그대로 두고 return)
    const li = el.closest('li');
    if (li.querySelector('.suggest')) return;
    const { suggestions } = await api(`/api/todos/${el.dataset.shrink}/suggestions`);
    const id = el.dataset.shrink;
    li.insertAdjacentHTML('beforeend', `<div class="suggest">
      <p>부담될 땐 아주 작게! 이 중에 하나로 바꿔 볼까요?</p>
      ${suggestions.map((s) => `<button data-pick="${id}" data-text="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join('')}
      <button data-custom="${id}">✏️ 직접 입력</button>
      <button data-cancel="${id}">닫기</button>
    </div>`);
    return;
  } else if (el.dataset.pick) {
    await api(`/api/todos/${el.dataset.pick}/shrink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: el.dataset.text }),
    });
  } else if (el.dataset.custom) {
    const small = prompt('더 작은 할 일로 바꿔보세요.\n(예: "방 청소" → "책상만 정리")');
    if (!small || !small.trim()) return;
    await api(`/api/todos/${el.dataset.custom}/shrink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: small }),
    });
  } else if (el.dataset.cancel) {
    el.closest('.suggest').remove();
    return;
  } else if (el.dataset.restore) {
    await api(`/api/todos/${el.dataset.restore}/restore`, { method: 'POST' });
  } else if (el.dataset.delete) {
    if (!confirm('이 할 일을 삭제할까요?')) return;
    await api(`/api/todos/${el.dataset.delete}`, { method: 'DELETE' });
  }
  refresh();
});

// 오늘 날짜를 마감일 기본값으로
document.getElementById('due_date').value = todayStr();
refresh();
