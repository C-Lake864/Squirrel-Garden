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
