// 대충하기 추천(순수 함수) 단위 테스트
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestSmaller } from '../shrink-suggest.js';

test('항상 서로 다른 후보 3개를 돌려준다', () => {
  const s = suggestSmaller('아무거나');
  assert.equal(s.length, 3);
  assert.equal(new Set(s).size, 3);
});

test('키워드가 있으면 그 종류의 추천이 먼저 나온다', () => {
  assert.equal(suggestSmaller('방 청소')[0], '눈에 보이는 것 하나만 치우기');
  assert.equal(suggestSmaller('보고서 쓰기')[0], '제목만 써 보기');
});

test('긴 문장은 잘라서 후보에 넣는다', () => {
  const s = suggestSmaller('아주아주아주아주아주아주아주 긴 할 일 문장입니다');
  assert.ok(s.every((c) => c.length <= 40));
});

test('빈 값이어도 죽지 않는다', () => {
  assert.equal(suggestSmaller('').length, 3);
  assert.equal(suggestSmaller(undefined).length, 3);
});
