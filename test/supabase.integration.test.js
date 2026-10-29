// Supabase 통합 테스트: 진짜 Supabase(로컬 스택이나 시험용 프로젝트)를 상대로 돈다.
// SB_TEST_URL, SB_TEST_PUBLISHABLE_KEY, SB_TEST_SECRET_KEY 가 없으면 건너뛴다 (npm test 는 평소처럼 통과).
// 시험용 값만 쓴다. 테스트가 만든 익명 사용자는 끝나면 지운다 (사용자를 지우면 그 사용자의 데이터도 함께 지워진다).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const { SB_TEST_URL: URL_, SB_TEST_PUBLISHABLE_KEY: PUB, SB_TEST_SECRET_KEY: SEC } = process.env;
const skip = !(URL_ && PUB && SEC) ? 'SB_TEST_URL, SB_TEST_PUBLISHABLE_KEY, SB_TEST_SECRET_KEY 가 없어서 건너뜀' : false;

const PORT = 3997;
const BASE = `http://127.0.0.1:${PORT}`;
let child;
const users = []; // 지울 익명 사용자

function startServer() {
  child = spawn(process.execPath, ['--experimental-sqlite', 'server.js'], {
    env: {
      ...process.env,
      PORT: String(PORT),
      STORAGE: 'supabase',
      AUTH: 'supabase',
      SUPABASE_URL: URL_,
      SUPABASE_PUBLISHABLE_KEY: PUB,
      SUPABASE_SECRET_KEY: SEC,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('서버 시작 시간 초과')), 15000);
    child.stdout.on('data', (d) => {
      if (String(d).includes('실행 중')) { clearTimeout(t); resolve(); }
    });
    child.on('exit', (code) => { clearTimeout(t); reject(new Error(`서버가 종료됨 (코드 ${code})`)); });
  });
}
const stopServer = () => new Promise((res) => { child.removeAllListeners('exit'); child.once('exit', res); child.kill(); });

// 익명 로그인: 브라우저가 하는 것과 같은 요청. 새 게스트 사용자 + 토큰을 돌려준다.
async function signInAnonymously() {
  const res = await fetch(`${URL_}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: PUB, 'Content-Type': 'application/json' },
    body: '{}',
  });
  const body = await res.json();
  assert.ok(body.access_token, `익명 로그인 실패: ${body.msg || body.error_description || res.status}`);
  users.push(body.user.id);
  return body.access_token;
}

const call = (token) => (path, opts = {}) =>
  fetch(BASE + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts.headers || {}) },
  });
const post = (api, path, body) => api(path, { method: 'POST', body: JSON.stringify(body ?? {}) }).then((r) => r.json());

const todayStr = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

before(async () => { if (!skip) await startServer(); });
after(async () => {
  if (skip) return;
  await stopServer();
  for (const id of users) {
    await fetch(`${URL_}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: { apikey: SEC, Authorization: `Bearer ${SEC}` } });
  }
});

test('로그인 토큰이 없거나 틀리면 401', { skip }, async () => {
  assert.equal((await call(null)('/api/todos')).status, 401);
  assert.equal((await call('fake.token.value')('/api/todos')).status, 401);
});

test('/api/config 는 로그인 없이 열려 있고 secret key 는 내보내지 않는다', { skip }, async () => {
  const cfg = await (await call(null)('/api/config')).json();
  assert.equal(cfg.auth, 'supabase');
  assert.equal(cfg.supabaseUrl, URL_);
  assert.equal(cfg.supabasePublishableKey, PUB);
  assert.ok(!JSON.stringify(cfg).includes(SEC));
  const v = await (await call(null)('/version')).json();
  assert.equal(v.storage, 'supabase');
  assert.ok(!JSON.stringify(v).includes(SEC));
});

test('할 일 전체 흐름: 추가, 필터, 카테고리, 완료와 알밤, 대충하기, 삭제', { skip }, async () => {
  const api = call(await signInAnonymously());
  const today = todayStr();

  const a = await post(api, '/api/todos', { title: '방 청소', category: '집', due_date: today });
  const b = await post(api, '/api/todos', { title: '메모하기' });
  assert.ok(a.id > 0 && b.id > 0);

  // 목록과 필터
  const all = await (await api('/api/todos?filter=all')).json();
  assert.deepEqual(all.map((t) => t.title).sort(), ['메모하기', '방 청소']);
  assert.deepEqual((await (await api('/api/todos?filter=today')).json()).map((t) => t.id), [a.id]);
  assert.deepEqual((await (await api(`/api/todos?filter=date&date=${today}`)).json()).map((t) => t.id), [a.id]);
  assert.deepEqual((await (await api(`/api/todos?filter=all&category=${encodeURIComponent('집')}`)).json()).map((t) => t.id), [a.id]);
  assert.deepEqual((await (await api('/api/todos?filter=all&category=__none__')).json()).map((t) => t.id), [b.id]);
  assert.deepEqual(await (await api(`/api/todos?filter=all&category=${encodeURIComponent("x' OR '1'='1")}`)).json(), []);
  assert.equal((await api('/api/todos?filter=date&date=abc')).status, 400);
  const cats = await (await api('/api/categories')).json();
  assert.deepEqual(cats, { categories: ['집'], uncategorized: 1 });

  // 완료하면 오늘 알밤, 취소하면 회수
  assert.equal((await (await api('/api/garden')).json()).todayEarned, false);
  await post(api, `/api/todos/${a.id}/toggle`);
  let g = await (await api('/api/garden')).json();
  assert.equal(g.todayEarned, true);
  assert.equal(g.acorns, 1);
  assert.equal(g.totalAcorns, 1);
  await post(api, `/api/todos/${a.id}/toggle`);
  assert.equal((await (await api('/api/garden')).json()).todayEarned, false);

  // 대충하기: 추천 → 적용 → 원래대로
  const { suggestions } = await (await api(`/api/todos/${a.id}/suggestions`)).json();
  assert.equal(suggestions.length, 3);
  await post(api, `/api/todos/${a.id}/shrink`, { title: suggestions[0] });
  let row = (await (await api('/api/todos?filter=all')).json()).find((t) => t.id === a.id);
  assert.equal(row.title, suggestions[0]);
  assert.equal(row.is_tiny, 1);
  await post(api, `/api/todos/${a.id}/restore`);
  row = (await (await api('/api/todos?filter=all')).json()).find((t) => t.id === a.id);
  assert.equal(row.title, '방 청소');
  assert.equal(row.is_tiny, 0);

  // 잘못된 입력과 없는 할 일
  assert.equal((await api('/api/todos', { method: 'POST', body: JSON.stringify({ title: '  ' }) })).status, 400);
  assert.equal((await api('/api/todos', { method: 'POST', body: JSON.stringify({ title: 'x', due_date: '내일' }) })).status, 400);
  assert.equal((await api('/api/todos/999999999/suggestions')).status, 404);

  // 삭제
  await api(`/api/todos/${b.id}`, { method: 'DELETE' });
  assert.deepEqual((await (await api('/api/todos?filter=all')).json()).map((t) => t.id), [a.id]);
});

test('사용자끼리 데이터가 섞이지 않는다 (브라우저마다 다른 게스트)', { skip }, async () => {
  const alice = call(await signInAnonymously());
  const bob = call(await signInAnonymously());
  const mine = await post(alice, '/api/todos', { title: 'A의 비밀 할 일', category: 'A전용', due_date: todayStr() });

  // B 에게는 A 의 할 일, 카테고리, 알밤이 보이지 않는다
  assert.deepEqual(await (await bob('/api/todos?filter=all')).json(), []);
  assert.deepEqual(await (await bob('/api/categories')).json(), { categories: [], uncategorized: 0 });
  assert.equal((await (await bob('/api/garden')).json()).totalAcorns, 0);

  // B 가 A 의 할 일 id 를 알아도 읽거나 바꾸거나 지울 수 없다 (없는 것처럼 404)
  assert.equal((await bob(`/api/todos/${mine.id}/suggestions`)).status, 404);
  assert.equal((await bob(`/api/todos/${mine.id}/toggle`, { method: 'POST' })).status, 404);
  assert.equal((await bob(`/api/todos/${mine.id}/shrink`, { method: 'POST', body: JSON.stringify({ title: '해킹' }) })).status, 404);
  await bob(`/api/todos/${mine.id}`, { method: 'DELETE' });

  // A 의 것은 그대로
  const still = await (await alice('/api/todos?filter=all')).json();
  assert.equal(still.length, 1);
  assert.equal(still[0].title, 'A의 비밀 할 일');
  assert.equal(still[0].is_done, 0);
});

test('서버를 다시 시작해도 데이터가 그대로다 (무상태 서버)', { skip }, async () => {
  const token = await signInAnonymously();
  const api = call(token);
  await post(api, '/api/todos', { title: '재시작 전에 만든 할 일', due_date: todayStr() });

  await stopServer();
  await startServer(); // 컨테이너를 지우고 새로 띄우는 것과 같은 상황: 서버 안에는 아무 상태도 없다

  const after = await (await call(token)('/api/todos?filter=all')).json();
  assert.deepEqual(after.map((t) => t.title), ['재시작 전에 만든 할 일']);
});
