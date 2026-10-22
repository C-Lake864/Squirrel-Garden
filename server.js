// Todo 앱 서버 (Express + 내장 SQLite)
import 'dotenv/config';
import express from 'express';
import { db } from './db.js';
import { acornsToStage, currentStreak } from './garden-logic.js';
import { suggestSmaller } from './shrink-suggest.js';

const app = express();
app.use(express.json());
app.use(express.static('public')); // public/ 안의 화면 파일 제공

const PORT = process.env.PORT || 3000;
// 로컬 기본값은 내 컴퓨터 전용. 컨테이너(Cloud Run)에서는 HOST=0.0.0.0 으로 연다.
const HOST = process.env.HOST || '127.0.0.1';

// ---- 날짜 도우미 (로컬 시간 기준) ----
function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// 라우트에서 던진 에러를 공통 에러 핸들러로 넘겨주는 래퍼 (동기/비동기 모두 처리)
const ah = (fn) => (req, res, next) => {
  try {
    const r = fn(req, res, next);
    if (r && typeof r.catch === 'function') r.catch(next);
  } catch (err) {
    next(err);
  }
};

// ---- 알밤 계산: '특정 날짜'의 마감 할 일을 전부 끝냈으면 그날 알밤 1개 ----
// (오늘뿐 아니라 지난/미래 마감일도 올바르게 반영되도록 날짜를 인자로 받음)
function recomputeDate(date) {
  if (!date) return; // 마감일 없는 할 일은 알밤에 영향 없음
  const row = db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN is_done = 1 THEN 1 ELSE 0 END) AS done
       FROM todos WHERE due_date = ?`
    )
    .get(date);
  const earned = row.total > 0 && row.total === row.done ? 1 : 0;
  db.prepare(
    `INSERT INTO daily_progress (date, earned) VALUES (?, ?)
     ON CONFLICT(date) DO UPDATE SET earned = excluded.earned`
  ).run(date, earned);
}

// ---- 연속으로 알밤을 얻은 날 수 → 나무 단계, 누적 총합은 따로 ----
// acorns = 오늘(아직이면 어제)까지 연속으로 알밤을 얻은 날 수. 하루 건너뛰면 0부터 다시 시작한다.
// totalAcorns = 지금까지 얻은 알밤 전체 (끊겨도 줄지 않는다).
function garden() {
  const earnedDates = db.prepare(`SELECT date FROM daily_progress WHERE earned = 1`).all().map((r) => r.date);
  const today = todayStr();
  const acorns = currentStreak(earnedDates, today);
  return {
    acorns,
    totalAcorns: earnedDates.length,
    ...acornsToStage(acorns),
    todayEarned: earnedDates.includes(today),
  };
}

// ================= API =================

// 목록 보기: ?filter=today | all
app.get('/api/todos', ah((req, res) => {
  const rows =
    req.query.filter === 'today'
      ? db
          // 오늘 마감 + 마감이 지났는데 아직 못 끝낸 할 일
          .prepare(`SELECT * FROM todos WHERE due_date = ? OR (is_done = 0 AND due_date < ?) ORDER BY is_done, due_date, id`)
          .all(todayStr(), todayStr())
      : db.prepare(`SELECT * FROM todos ORDER BY is_done, due_date IS NULL, due_date, id`).all();
  res.json(rows);
}));

// 추가 (파라미터화 쿼리)
app.post('/api/todos', ah((req, res) => {
  const { title, category, due_date } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: '할 일 내용을 입력하세요.' });
  const info = db
    .prepare(`INSERT INTO todos (title, category, due_date) VALUES (?, ?, ?)`)
    .run(title.trim(), category?.trim() || null, due_date || null);
  recomputeDate(due_date || null);
  res.json({ id: Number(info.lastInsertRowid) });
}));

// 완료/취소 토글
app.post('/api/todos/:id/toggle', ah((req, res) => {
  const id = Number(req.params.id);
  const cur = db.prepare(`SELECT is_done, due_date FROM todos WHERE id = ?`).get(id);
  if (!cur) return res.status(404).json({ error: '없는 할 일입니다.' });
  const next = cur.is_done ? 0 : 1;
  db.prepare(`UPDATE todos SET is_done = ?, done_at = ? WHERE id = ?`)
    .run(next, next ? new Date().toISOString() : null, id);
  recomputeDate(cur.due_date); // 그 할 일의 마감일 기준으로 재계산
  res.json({ ok: true });
}));

// 대충하기 추천: 이 할 일을 더 작게 바꿀 문장 후보
app.get('/api/todos/:id/suggestions', ah((req, res) => {
  const cur = db.prepare(`SELECT title, is_tiny, original_title FROM todos WHERE id = ?`).get(Number(req.params.id));
  if (!cur) return res.status(404).json({ error: '없는 할 일입니다.' });
  res.json({ suggestions: suggestSmaller(cur.is_tiny ? cur.original_title : cur.title) });
}));

// 대충하기: 더 작은 문장으로 바꾸기 (원래 문장은 보관)
app.post('/api/todos/:id/shrink', ah((req, res) => {
  const id = Number(req.params.id);
  const { title } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: '바꿀 내용을 입력하세요.' });
  const cur = db.prepare(`SELECT title, is_tiny, original_title FROM todos WHERE id = ?`).get(id);
  if (!cur) return res.status(404).json({ error: '없는 할 일입니다.' });
  const original = cur.is_tiny ? cur.original_title : cur.title; // 원래 문장 보존
  db.prepare(`UPDATE todos SET title = ?, is_tiny = 1, original_title = ? WHERE id = ?`)
    .run(title.trim(), original, id);
  res.json({ ok: true });
}));

// 대충하기 해제: 원래 문장으로 되돌리기
app.post('/api/todos/:id/restore', ah((req, res) => {
  const id = Number(req.params.id);
  const cur = db.prepare(`SELECT is_tiny, original_title FROM todos WHERE id = ?`).get(id);
  if (!cur) return res.status(404).json({ error: '없는 할 일입니다.' });
  if (cur.is_tiny) {
    db.prepare(`UPDATE todos SET title = ?, is_tiny = 0, original_title = NULL WHERE id = ?`)
      .run(cur.original_title, id);
  }
  res.json({ ok: true });
}));

// 삭제
app.delete('/api/todos/:id', ah((req, res) => {
  const id = Number(req.params.id);
  const cur = db.prepare(`SELECT due_date FROM todos WHERE id = ?`).get(id); // 삭제 전 마감일 확보
  db.prepare(`DELETE FROM todos WHERE id = ?`).run(id);
  recomputeDate(cur?.due_date);
  res.json({ ok: true });
}));

// 정원(다람쥐/나무) 상태
app.get('/api/garden', ah((_req, res) => res.json(garden())));

// 배포 확인용: Cloud Run 이 붙여 주는 리비전 이름과 커밋(빌드 시 GIT_SHA 로 주입)
app.get('/version', (_req, res) => res.json({
  revision: process.env.K_REVISION || 'local',
  commit: process.env.GIT_SHA || 'unknown',
}));

// ---- 공통 에러 핸들러: 어떤 라우트에서 예외가 나도 일관된 JSON으로 응답 ----
app.use((err, _req, res, _next) => {
  console.error(err);
  const code = err.status || err.statusCode || 500;
  res.status(code).json({ error: code === 400 ? '잘못된 요청이에요.' : '서버에서 문제가 발생했어요.' });
});

// HOST 기본값 '127.0.0.1' = 내 컴퓨터에서만 접속 허용 (같은 네트워크의 다른 기기 차단)
app.listen(PORT, HOST, () => console.log(`✅ Todo 앱 실행 중 → http://localhost:${PORT}`));
