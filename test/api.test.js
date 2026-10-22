// API 통합 테스트 — 서버를 임시 DB로 띄워서 실제 흐름을 검증
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';

const PORT = 3999;
const BASE = `http://127.0.0.1:${PORT}`;
const dbFile = './test.todo.db';
const cleanup = () => ['', '-wal', '-shm'].forEach((s) => { try { rmSync(dbFile + s); } catch {} });

let child;

// 서버와 동일한 방식으로 '오늘' 문자열 계산 (같은 로컬 시간대)
function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const get = (path, opts) => fetch(BASE + path, opts);
const json = (path, opts) => get(path, opts).then((r) => r.json());

before(async () => {
  cleanup();
  child = spawn(process.execPath, ['--experimental-sqlite', 'server.js'], {
    env: { ...process.env, PORT: String(PORT), DATABASE_FILE: dbFile },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('서버 시작 시간 초과')), 10000);
    child.stdout.on('data', (d) => { if (String(d).includes('실행 중')) { clearTimeout(t); resolve(); } });
    child.stderr.on('data', (d) => process.stderr.write(d));
  });
});

after(async () => {
  if (child) { child.kill(); await new Promise((r) => child.on('exit', r)); } // 파일 잠금 해제까지 대기
  cleanup();
});

test('추가 → 완료 → 정원에 알밤 반영', async () => {
  const today = todayStr();
  const add = await json('/api/todos', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: '테스트 할 일', due_date: today }),
  });
  assert.ok(add.id > 0);

  // 아직 미완료 → 알밤 없음
  assert.equal((await json('/api/garden')).todayEarned, false);

  // 완료 → 오늘 알밤 획득
  await get(`/api/todos/${add.id}/toggle`, { method: 'POST' });
  assert.equal((await json('/api/garden')).todayEarned, true);

  // 다시 미완료로 토글하면 알밤도 회수
  await get(`/api/todos/${add.id}/toggle`, { method: 'POST' });
  assert.equal((await json('/api/garden')).todayEarned, false);
});

test('오늘이 아닌 마감일도 알밤에 반영된다 (개선 #1)', async () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  // 이번 달이면서 '오늘'과 겹치지 않는 날짜 하나 고르기
  const day = d.getDate() === 1 ? '02' : '01';
  const otherDay = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${day}`;

  const before = (await json('/api/garden')).totalAcorns;
  const add = await json('/api/todos', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: '다른 날 할 일', due_date: otherDay }),
  });
  await get(`/api/todos/${add.id}/toggle`, { method: 'POST' }); // 완료
  const after = (await json('/api/garden')).totalAcorns;
  assert.equal(after, before + 1); // 예전 코드였다면 오늘만 재계산돼서 안 늘었을 것
});

test('정원 응답에 연속 일수(acorns)와 누적 총합(totalAcorns)이 있다', async () => {
  const g = await json('/api/garden');
  assert.equal(typeof g.acorns, 'number');
  assert.equal(typeof g.totalAcorns, 'number');
  assert.ok(g.totalAcorns >= g.acorns); // 총합은 연속 일수보다 작을 수 없다
});

test("'오늘 할 일'에는 마감이 지난 미완료 할 일도 보이고, 끝내면 빠진다", async () => {
  const d = new Date();
  d.setDate(d.getDate() - 3);
  const p = (n) => String(n).padStart(2, '0');
  const past = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  const add = await json('/api/todos', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: '밀린 할 일', due_date: past }),
  });
  const ids = async () => (await json('/api/todos?filter=today')).map((t) => t.id);
  assert.ok((await ids()).includes(add.id)); // 지났어도 안 끝냈으면 오늘 목록에 보인다
  await get(`/api/todos/${add.id}/toggle`, { method: 'POST' });
  assert.ok(!(await ids()).includes(add.id)); // 끝내면 오늘 목록에서는 빠진다
  assert.ok((await json('/api/todos?filter=all')).some((t) => t.id === add.id)); // 전체에는 남는다
});

test('빈 제목은 400으로 거부', async () => {
  const res = await get('/api/todos', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: '   ' }),
  });
  assert.equal(res.status, 400);
});

test('잘못된 JSON에도 서버가 죽지 않고 에러 JSON을 반환', async () => {
  const res = await get('/api/todos', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: '{ 깨진 JSON',
  });
  assert.ok(res.status >= 400 && res.status < 500);
  assert.ok((await res.json()).error); // 공통 에러 핸들러가 JSON 형태 유지
});

test('대충하기 추천 후보를 받아 그대로 적용할 수 있다', async () => {
  const add = await json('/api/todos', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: '방 청소' }),
  });
  const { suggestions } = await json(`/api/todos/${add.id}/suggestions`);
  assert.equal(suggestions.length, 3);

  await get(`/api/todos/${add.id}/shrink`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: suggestions[0] }),
  });
  const todo = (await json('/api/todos?filter=all')).find((t) => t.id === add.id);
  assert.equal(todo.title, suggestions[0]);
  assert.equal(todo.is_tiny, 1);

  assert.equal((await get('/api/todos/999999/suggestions')).status, 404);
});

// ---- 날짜별 / 카테고리별 보기 ----
const post = (path, body) =>
  json(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test("filter=date 는 그 날짜에 마감인 할 일만 돌려준다", async () => {
  const a = await post('/api/todos', { title: '날짜A', due_date: '2020-03-03' });
  const b = await post('/api/todos', { title: '날짜B', due_date: '2020-03-04' });
  const ids = (await json('/api/todos?filter=date&date=2020-03-03')).map((t) => t.id);
  assert.ok(ids.includes(a.id));
  assert.ok(!ids.includes(b.id));
});

test('filter=date 에 날짜가 없거나 형식이 틀리면 400', async () => {
  assert.equal((await get('/api/todos?filter=date')).status, 400);
  assert.equal((await get('/api/todos?filter=date&date=내일')).status, 400);
  assert.equal((await get("/api/todos?filter=date&date=2020-03-03'%20OR%201=1")).status, 400);
});

test('category 로 그 카테고리의 할 일만 거른다', async () => {
  const x = await post('/api/todos', { title: '분류X', category: '필터테스트', due_date: '2020-04-01' });
  const y = await post('/api/todos', { title: '분류Y', category: '다른분류', due_date: '2020-04-01' });
  const ids = (await json(`/api/todos?filter=all&category=${encodeURIComponent('필터테스트')}`)).map((t) => t.id);
  assert.ok(ids.includes(x.id));
  assert.ok(!ids.includes(y.id));
});

test('날짜와 카테고리를 함께 쓸 수 있고, __none__ 은 카테고리 없는 것만', async () => {
  const withCat = await post('/api/todos', { title: '둘다1', category: '조합', due_date: '2020-05-05' });
  const noCat = await post('/api/todos', { title: '둘다2', due_date: '2020-05-05' });
  const both = (await json(`/api/todos?filter=date&date=2020-05-05&category=${encodeURIComponent('조합')}`)).map((t) => t.id);
  assert.deepEqual(both, [withCat.id]);
  const none = (await json('/api/todos?filter=date&date=2020-05-05&category=__none__')).map((t) => t.id);
  assert.deepEqual(none, [noCat.id]);
});

test("카테고리 이름에 SQL 조각이 들어 있어도 그냥 이름으로만 취급한다", async () => {
  const rows = await json(`/api/todos?filter=all&category=${encodeURIComponent("x' OR '1'='1")}`);
  assert.deepEqual(rows, []);
});

test('/api/categories 는 쓰이는 카테고리와 카테고리 없는 할 일 수를 돌려준다', async () => {
  await post('/api/todos', { title: '목록용', category: '목록테스트' });
  await post('/api/todos', { title: '분류없음' });
  const r = await json('/api/categories');
  assert.ok(r.categories.includes('목록테스트'));
  assert.ok(!r.categories.includes('')); // 빈 카테고리는 이름으로 나오지 않는다
  assert.ok(r.uncategorized >= 1);
});
