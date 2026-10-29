// /health 와 시작 지연(SLOW_START_SECONDS) 테스트 — 지연을 켠 서버를 따로 띄운다
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';

const PORT = 3998;
const BASE = `http://127.0.0.1:${PORT}`;
const dbFile = './test.health.db';
const cleanup = () => ['', '-wal', '-shm'].forEach((s) => { try { rmSync(dbFile + s); } catch {} });

let child;

before(async () => {
  cleanup();
  child = spawn(process.execPath, ['--experimental-sqlite', 'server.js'], {
    env: { ...process.env, PORT: String(PORT), DATABASE_FILE: dbFile, SLOW_START_SECONDS: '2' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('서버 시작 시간 초과')), 10000);
    child.stdout.on('data', (d) => { if (String(d).includes('실행 중')) { clearTimeout(t); resolve(); } });
    child.stderr.on('data', (d) => process.stderr.write(d));
  });
});

after(async () => {
  if (child) { child.kill(); await new Promise((r) => child.on('exit', r)); }
  cleanup();
});

test('시작 지연 중에는 포트는 열려 있지만 /health 와 다른 요청이 503, 지연이 끝나면 200', async () => {
  assert.equal((await fetch(`${BASE}/health`)).status, 503);
  assert.equal((await fetch(`${BASE}/version`)).status, 503);

  await new Promise((r) => setTimeout(r, 2200));

  const res = await fetch(`${BASE}/health`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'ok' });
  assert.equal((await fetch(`${BASE}/version`)).status, 200);
});
