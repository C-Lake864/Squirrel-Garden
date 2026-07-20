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

// ---------- 정원 그리기 ----------
async function loadGarden() {
  const g = await api('/api/garden');
  const prev = [0, 5, 10, 15, 20].filter((t) => t <= g.acorns).pop() ?? 0;
  const pct = g.nextMilestone ? Math.round(((g.acorns - prev) / (g.nextMilestone - prev)) * 100) : 100;

  document.getElementById('garden').innerHTML = `
    <h2>${g.stageName}</h2>
    <div class="scene">${treeSVG(g.level)}<div class="squirrel">🐿️</div></div>
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
      const tinyHtml = t.is_tiny ? `<span class="tiny-badge">🐿️ 대충 모드</span>` : '';
      const shrinkBtn = t.is_tiny
        ? `<button data-restore="${t.id}">↩︎ 원래대로</button>`
        : `<button data-shrink="${t.id}">🐿️ 대충하기</button>`;
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
  const el = e.target.closest('[data-toggle],[data-shrink],[data-restore],[data-delete]');
  if (!el) return;

  if (el.dataset.toggle) {
    await api(`/api/todos/${el.dataset.toggle}/toggle`, { method: 'POST' });
  } else if (el.dataset.shrink) {
    const small = prompt('부담될 땐 아주 작게! 더 작은 할 일로 바꿔보세요.\n(예: "방 청소" → "책상만 정리")');
    if (!small || !small.trim()) return;
    await api(`/api/todos/${el.dataset.shrink}/shrink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: small }),
    });
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
