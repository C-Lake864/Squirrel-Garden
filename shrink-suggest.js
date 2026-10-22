// 대충하기 추천: 할 일 문장을 보고 더 작은 문장 후보 3개를 만든다 (규칙 기반, 외부 서비스 없음)
// DB·서버와 무관한 순수 함수라 테스트하기 쉬움

// 키워드가 들어 있으면 그 종류에 맞는 작은 행동을 먼저 추천한다
const RULES = [
  { words: ['청소', '정리', '치우'], picks: ['눈에 보이는 것 하나만 치우기', '책상 위만 정리하기'] },
  { words: ['빨래', '설거지', '세탁'], picks: ['한 개만 먼저 하기', '5분 타이머 맞추고 시작하기'] },
  { words: ['보고서', '과제', '리포트', '글', '쓰기', '작성'], picks: ['제목만 써 보기', '첫 문장만 쓰기'] },
  { words: ['공부', '읽기', '책', '강의'], picks: ['한 페이지만 읽기', '목차만 훑어보기'] },
  { words: ['운동', '달리기', '걷기', '헬스'], picks: ['운동복만 갈아입기', '스트레칭 5분만 하기'] },
  { words: ['연락', '전화', '메일', '답장', '메시지'], picks: ['한 줄만 보내기', '받는 사람만 정해 두기'] },
  { words: ['준비', '챙기', '짐'], picks: ['제일 중요한 것 하나만 챙기기', '필요한 것 목록만 적기'] },
];

const MAX_TITLE = 20; // 문장이 길면 후보가 너무 길어지지 않게 자른다

function shorten(title) {
  const t = title.trim();
  return t.length > MAX_TITLE ? `${t.slice(0, MAX_TITLE)}…` : t;
}

export function suggestSmaller(title) {
  const t = String(title ?? '').trim();
  const name = shorten(t);
  const candidates = [];

  for (const rule of RULES) {
    if (rule.words.some((w) => t.includes(w))) candidates.push(...rule.picks);
  }
  // 어떤 문장에도 어울리는 기본 후보
  candidates.push(`"${name}" 5분만 해 보기`, `"${name}" 첫 단계만 하기`, `"${name}" 준비물만 꺼내 두기`);

  return [...new Set(candidates)].filter((c) => c !== t).slice(0, 3);
}
