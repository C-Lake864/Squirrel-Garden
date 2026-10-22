// 알밤 수 → 나무 단계 (DB·서버와 무관한 순수 함수라 테스트하기 쉬움)
export function acornsToStage(acorns) {
  const stages = [
    { min: 25, level: 5, name: '무척 큰 나무' },
    { min: 20, level: 4, name: '큰 나무' },
    { min: 15, level: 3, name: '작은 나무' },
    { min: 10, level: 2, name: '묘목' },
    { min: 5, level: 1, name: '새싹' },
    { min: 0, level: 0, name: '씨앗 (곧 싹이 틀 거예요)' },
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

// ---- 연속 달성(스트릭) ----
const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function prevDay(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d); // 로컬 날짜 기준 (서머타임에 흔들리지 않게 날짜만 쓴다)
  dt.setDate(dt.getDate() - 1);
  return fmt(dt);
}

// 알밤을 얻은 날짜들과 '오늘'을 받아, 오늘까지(오늘이 아직이면 어제까지) 연속으로 얻은 날 수를 돌려준다.
// 오늘은 아직 끝나지 않았으므로 오늘 알밤이 없다고 바로 끊기지는 않는다.
export function currentStreak(earnedDates, today) {
  const earned = new Set(earnedDates);
  let day = earned.has(today) ? today : prevDay(today);
  let n = 0;
  while (earned.has(day)) {
    n += 1;
    day = prevDay(day);
  }
  return n;
}
