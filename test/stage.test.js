// 나무 단계 계산(순수 함수) 단위 테스트 — 설치 필요 없는 Node 내장 test 러너 사용
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acornsToStage } from '../garden-logic.js';

test('0개면 씨앗, 다음 목표는 5', () => {
  const s = acornsToStage(0);
  assert.equal(s.level, 0);
  assert.equal(s.nextMilestone, 5);
  assert.equal(s.remainingToNext, 5);
});

test('5개면 새싹', () => {
  assert.equal(acornsToStage(5).stageName, '새싹');
  assert.equal(acornsToStage(5).level, 1);
});

test('경계 미만은 이전 단계 유지 (9개는 아직 새싹)', () => {
  assert.equal(acornsToStage(9).stageName, '새싹');
});

test('10개 묘목, 15개 작은 나무, 20개 큰 나무', () => {
  assert.equal(acornsToStage(10).stageName, '묘목');
  assert.equal(acornsToStage(15).stageName, '작은 나무');
  assert.equal(acornsToStage(20).stageName, '큰 나무');
});

test('25개 이상은 최고 단계, 다음 목표 없음', () => {
  const s = acornsToStage(30);
  assert.equal(s.level, 5);
  assert.equal(s.stageName, '무척 큰 나무');
  assert.equal(s.nextMilestone, null);
  assert.equal(s.remainingToNext, 0);
});
