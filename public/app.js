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
  const open = '<svg viewBox="0 0 240 180" style="display:block;width:100%;height:auto">';
  if (level === 0) {
    return `${open}<ellipse cx="120" cy="150" rx="22" ry="7" fill="#a7825a"/><circle cx="120" cy="144" r="5" fill="#a7825a"/></svg>`;
  }
  if (level <= 2) {
    // 1~2단계: 줄기 끝에 잎 두 장이 달린 새싹
    const h = 24, top = 150 - h;
    const leaf = (y, s) =>
      `<ellipse cx="${120 - 9 * s}" cy="${y}" rx="${9 * s}" ry="${4.2 * s}" transform="rotate(25 ${120 - 9 * s} ${y})" fill="#8a8f55"/>` +
      `<ellipse cx="${120 + 9 * s}" cy="${y}" rx="${9 * s}" ry="${4.2 * s}" transform="rotate(-25 ${120 + 9 * s} ${y})" fill="#a3a66a"/>`;
    const w = level === 1 ? 3 : 5;
    return `${open}<ellipse cx="120" cy="152" rx="${level === 1 ? 22 : 26}" ry="7" fill="#a7825a"/>` +
      `<rect x="${120 - w / 2}" y="${top}" width="${w}" height="${h}" rx="2" fill="#8a8f55"/>${leaf(top + 2, 1.3)}</svg>`;
  }
  const spec = {
    3: { trunkH: 48, trunkW: 10, canopy: [[120, 92, 32]] },
    4: { trunkH: 70, trunkW: 14, canopy: [[120, 70, 42], [98, 88, 28], [142, 88, 28]] },
    5: { trunkH: 92, trunkW: 18, canopy: [[120, 48, 50], [88, 78, 36], [152, 78, 36], [120, 92, 38]] },
  }[level];
  const trunk = `<rect x="${120 - spec.trunkW / 2}" y="${150 - spec.trunkH}" width="${spec.trunkW}" height="${spec.trunkH}" rx="3" fill="#6e4a2e"/>`;
  const leaves = spec.canopy
    .map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#8a8f55"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="#a3a66a" opacity="0.5"/>`)
    .join('');
  return `${open}<ellipse cx="120" cy="152" rx="28" ry="7" fill="#a7825a"/>${trunk}${leaves}</svg>`;
}

// 도토리 아이콘 (채워진 것 = 다음 단계까지 진행한 만큼)
function acornIcon(filled) {
  const body = filled ? '#9a5a2e' : 'rgba(43,33,25,0.3)';
  const base = filled ? '#e3c595' : 'rgba(43,33,25,0.3)';
  return `<svg viewBox="0 0 24 26" width="22" height="24" aria-hidden="true">
    <path d="M12 2.5L13.2 4.6C18.5 5.4 22.8 9.5 22.8 15.5C22.8 21.2 18 25 12 25C6 25 1.2 21.2 1.2 15.5C1.2 9.5 5.5 5.4 10.8 4.6Z" fill="${body}"/>
    <path d="M1.8 18.8C5 20.8 19 20.8 22.2 18.8C21 22.6 17 25 12 25C7 25 3 22.6 1.8 18.8Z" fill="${base}"/></svg>`;
}

// 받침이 있으면 '이', 없으면 '가' (새싹이 / 묘목이 / 작은 나무가)
const josa = (word) => ((word.charCodeAt(word.length - 1) - 0xac00) % 28 ? '이' : '가');

const STATUS_TEXT =
  '오늘의 할 일을 모두 끝내면 다람쥐가 알밤을 하나씩 묻어요. 알밤의 개수가 쌓일수록 나무가 자라요. 하루라도 건너뛰게 되면 원래대로 돌아와요.\n\n' +
  '하지만 걱정마세요! 대충모드를 사용하여 부담없이 매일의 습관을 만들어보아요!';

// ---------- 정원 그리기 ----------
// g.acorns = 연속으로 알밤을 얻은 날 수(나무 단계), g.totalAcorns = 지금까지 모은 알밤 전체
async function loadGarden() {
  const g = await api('/api/garden');
  const prev = [0, 5, 10, 15, 20].filter((t) => t <= g.acorns).pop() ?? 0;
  const pct = g.nextMilestone ? Math.round(((g.acorns - prev) / (g.nextMilestone - prev)) * 100) : 100;
  const filled = Math.round(pct / 10);
  const dots = Array.from({ length: 10 }, (_, i) => acornIcon(i < filled)).join('');
  const title = g.level === 0 ? g.stageName : `${g.stageName}${josa(g.stageName)} 자랐어요!`;

  document.getElementById('status').textContent = g.todayEarned ? '✓ 오늘 알밤을 묻었어요!' : STATUS_TEXT;
  document.getElementById('garden').innerHTML = `
    <h2>${title}</h2>
    <div class="scene">${treeSVG(g.level)}<img class="squirrel" src="squirrel.png" alt="다람쥐"></div>
    <div class="acorn-count">알밤을 총 <strong>${g.totalAcorns}</strong>개 모았어요</div>
    <div class="acorns" role="img" aria-label="다음 단계까지 ${pct}% 진행">${dots}</div>
    <div class="progress">
      <div class="bar"><div class="fill" style="width:${pct}%"></div></div>
      <div class="progress-label">${g.nextMilestone ? `다음 단계까지 알밤 ${g.remainingToNext}개` : '최고 단계 달성!'}</div>
    </div>`;
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
        dueHtml = `<span class="${cls}">${t.due_date}${overdue ? ' · 지남' : ''}</span>`;
      }
      const catHtml = t.category ? `<span class="chip">${escapeHtml(t.category)}</span>` : '';
      const tinyHtml = t.is_tiny ? `<span class="tiny-badge">대충 모드</span>` : '';
      const shrinkBtn = t.is_tiny
        ? `<button data-restore="${t.id}">원래대로</button>`
        : `<button data-shrink="${t.id}">대충하기</button>`;
      return `<li class="todo ${t.is_done ? 'done' : ''}">
        <div class="todo-main">
          <div class="meta">${catHtml}${dueHtml}${tinyHtml}</div>
          <div class="title">${escapeHtml(t.title)}</div>
          <div class="actions">${shrinkBtn}<button class="danger" data-delete="${t.id}">삭제</button></div>
        </div>
        <label class="check">
          <input type="checkbox" aria-label="${escapeHtml(t.title)} 완료" ${t.is_done ? 'checked' : ''} data-toggle="${t.id}">
        </label>
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
      <button data-custom="${id}">직접 입력</button>
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
