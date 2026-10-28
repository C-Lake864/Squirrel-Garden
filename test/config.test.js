// 저장소/로그인 설정 검증 테스트 (설정이 잘못되면 앱이 시작하지 않아야 한다)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../config.js';

const supabaseEnv = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'pub-test',
  SUPABASE_SECRET_KEY: 'secret-test',
};

test('아무것도 없으면 sqlite + 로그인 없음 (기존 동작)', () => {
  const c = loadConfig({});
  assert.equal(c.storage, 'sqlite');
  assert.equal(c.auth, 'none');
});

test('STORAGE=supabase 와 AUTH=supabase 에 값이 다 있으면 통과', () => {
  const c = loadConfig({ STORAGE: 'supabase', AUTH: 'supabase', ...supabaseEnv });
  assert.equal(c.storage, 'supabase');
  assert.equal(c.auth, 'supabase');
});

test('로그인 없이 Supabase 저장소를 켜면 시작하지 않는다 (사용자 데이터가 섞이는 것을 막는다)', () => {
  assert.throws(
    () => loadConfig({ STORAGE: 'supabase', AUTH: 'none', ...supabaseEnv }),
    (e) => e.code === 'INVALID_CONFIG' && /AUTH=supabase/.test(e.message) && /앱을 시작하지 않습니다/.test(e.message)
  );
  assert.throws(() => loadConfig({ STORAGE: 'supabase', ...supabaseEnv }), /앱을 시작하지 않습니다/); // AUTH 생략도 마찬가지
});

test('빠진 키 이름을 알려 준다 (값은 알려 주지 않는다)', () => {
  try {
    loadConfig({ STORAGE: 'supabase', AUTH: 'supabase', SUPABASE_URL: 'https://example.supabase.co' });
    assert.fail('통과하면 안 된다');
  } catch (e) {
    assert.match(e.message, /SUPABASE_SECRET_KEY/);
    assert.match(e.message, /SUPABASE_PUBLISHABLE_KEY/);
    assert.doesNotMatch(e.message, /example\.supabase\.co/); // 값은 메시지에 넣지 않는다
  }
});

test('알 수 없는 값은 거부', () => {
  assert.throws(() => loadConfig({ STORAGE: 'mongo' }), /STORAGE/);
  assert.throws(() => loadConfig({ AUTH: 'password' }), /AUTH/);
});
