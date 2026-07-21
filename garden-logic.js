// 알밤 수 → 나무 단계 (DB·서버와 무관한 순수 함수라 테스트하기 쉬움)
export function acornsToStage(acorns) {
  const stages = [
    { min: 25, level: 5, name: '무척 큰 나무' },
    { min: 20, level: 4, name: '큰 나무' },
    { min: 15, level: 3, name: '작은 나무' },
    { min: 10, level: 2, name: '묘목' },
    { min: 5, level: 1, name: '새싹' },
    { min: 0, level: 0, name: '씨앗 (아직 자라기 전)' },
  ];
  const stage = stages.find((s) => acorns >= s.min);
  const nextMilestone = [5, 10, 15, 20, 25].find((t) => acorns < t) ?? null;
  return {
    level: stage.level,
    stageName: stage.name,
    nextMilestone,
    remainingToNext: nextMilestone ? nextMilestone - acorns : 0,
  };
}
