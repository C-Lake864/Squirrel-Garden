// 연속 달성(스트릭) 계산(순수 함수) 단위 테스트
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currentStreak } from '../garden-logic.js';

test('알밤이 하나도 없으면 0', () => {
  assert.equal(currentStreak([], '2026-10-22'), 0);
});

test('오늘까지 연속으로 얻었으면 오늘을 포함해 센다', () => {
  assert.equal(currentStreak(['2026-10-20', '2026-10-21', '2026-10-22'], '2026-10-22'), 3);
});

test('오늘 알밤이 아직 없어도 어제까지 이어졌으면 끊기지 않는다', () => {
  assert.equal(currentStreak(['2026-10-20', '2026-10-21'], '2026-10-22'), 2);
});

test('어제도 건너뛰고 오늘도 없으면 0으로 돌아간다', () => {
  assert.equal(currentStreak(['2026-10-18', '2026-10-19'], '2026-10-22'), 0);
});

test('하루 건너뛰면 그 앞은 세지 않는다', () => {
  assert.equal(currentStreak(['2026-10-18', '2026-10-19', '2026-10-21', '2026-10-22'], '2026-10-22'), 2);
});

test('달과 해가 바뀌어도 이어진다', () => {
  assert.equal(currentStreak(['2026-12-30', '2026-12-31', '2027-01-01'], '2027-01-01'), 3);
  assert.equal(currentStreak(['2026-09-30', '2026-10-01'], '2026-10-01'), 2);
});
