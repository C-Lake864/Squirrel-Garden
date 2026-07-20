// Todo 앱 서버 (Express + 내장 SQLite)
import 'dotenv/config';
import express from 'express';
import { db } from './db.js';

const app = express();
app.use(express.json());
app.use(express.static('public')); // public/ 안의 화면 파일 제공

const PORT = process.env.PORT || 3000;

// ---- 날짜 도우미 (로컬 시간 기준) ----
function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const monthPrefix = () => todayStr().slice(0, 7); // 'YYYY-MM'

// ---- 알밤 계산: 오늘 마감 할 일을 전부 끝냈으면 오늘 alarm 1개 ----
function recomputeToday() {
  const today = todayStr();
  const row = db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN is_done = 1 THEN 1 ELSE 0 END) AS done
       FROM todos WHERE due_date = ?`
    )
    .get(today);
  const earned = row.total > 0 && row.total === row.done ? 1 : 0;
  db.prepare(
    `INSERT INTO daily_progress (date, earned) VALUES (?, ?)
     ON CONFLICT(date) DO UPDATE SET earned = excluded.earned`
  ).run(today, earned);
}

// ---- 이번 달 알밤 수 → 나무 단계 ----
function garden() {
  const acorns = db
    .prepare(`SELECT COUNT(*) AS n FROM daily_progress WHERE earned = 1 AND date LIKE ?`)
    .get(monthPrefix() + '%').n;

  const stages = [
    { min: 25, level: 5, name: '무척 큰 나무' },
    { min: 20, level: 4, name: '큰 나무' },
    { min: 15, level: 3, name: '작은 나무' },
    { min: 10, level: 2, name: '묘목' },
    { min: 5, level: 1, name: '새싹' },
    { min: 0, level: 0, name: '씨앗 (아직 자라기 전)' },
  ];
  const stage = stages.find((s) => acorns >= s.min);
  const next = [5, 10, 15, 20, 25].find((t) => acorns < t) ?? null;
  const todayRow = db.prepare(`SELECT earned FROM daily_progress WHERE date = ?`).get(todayStr());

  return {
    month: monthPrefix(),
    acorns,
    level: stage.level,
    stageName: stage.name,
    nextMilestone: next,
    remainingToNext: next ? next - acorns : 0,
    todayEarned: !!(todayRow && todayRow.earned),
  };
}

// ================= API =================

// 목록 보기: ?filter=today | all
app.get('/api/todos', (req, res) => {
  const rows =
    req.query.filter === 'today'
      ? db.prepare(`SELECT * FROM todos WHERE due_date = ? ORDER BY is_done, id`).all(todayStr())
      : db.prepare(`SELECT * FROM todos ORDER BY is_done, due_date IS NULL, due_date, id`).all();
  res.json(rows);
});

// 추가 (파라미터화 쿼리)
app.post('/api/todos', (req, res) => {
  const { title, category, due_date } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: '할 일 내용을 입력하세요.' });
  const info = db
    .prepare(`INSERT INTO todos (title, category, due_date) VALUES (?, ?, ?)`)
    .run(title.trim(), category?.trim() || null, due_date || null);
  recomputeToday();
  res.json({ id: Number(info.lastInsertRowid) });
});

// 완료/취소 토글
app.post('/api/todos/:id/toggle', (req, res) => {
  const id = Number(req.params.id);
  const cur = db.prepare(`SELECT is_done FROM todos WHERE id = ?`).get(id);
  if (!cur) return res.status(404).json({ error: '없는 할 일입니다.' });
  const next = cur.is_done ? 0 : 1;
  db.prepare(`UPDATE todos SET is_done = ?, done_at = ? WHERE id = ?`)
    .run(next, next ? new Date().toISOString() : null, id);
  recomputeToday();
  res.json({ ok: true });
});

// 대충하기: 더 작은 문장으로 바꾸기 (원래 문장은 보관)
app.post('/api/todos/:id/shrink', (req, res) => {
  const id = Number(req.params.id);
  const { title } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: '바꿀 내용을 입력하세요.' });
  const cur = db.prepare(`SELECT title, is_tiny, original_title FROM todos WHERE id = ?`).get(id);
  if (!cur) return res.status(404).json({ error: '없는 할 일입니다.' });
  const original = cur.is_tiny ? cur.original_title : cur.title; // 원래 문장 보존
  db.prepare(`UPDATE todos SET title = ?, is_tiny = 1, original_title = ? WHERE id = ?`)
    .run(title.trim(), original, id);
  res.json({ ok: true });
});

// 대충하기 해제: 원래 문장으로 되돌리기
app.post('/api/todos/:id/restore', (req, res) => {
  const id = Number(req.params.id);
  const cur = db.prepare(`SELECT is_tiny, original_title FROM todos WHERE id = ?`).get(id);
  if (!cur) return res.status(404).json({ error: '없는 할 일입니다.' });
  if (cur.is_tiny) {
    db.prepare(`UPDATE todos SET title = ?, is_tiny = 0, original_title = NULL WHERE id = ?`)
      .run(cur.original_title, id);
  }
  res.json({ ok: true });
});

// 삭제
app.delete('/api/todos/:id', (req, res) => {
  db.prepare(`DELETE FROM todos WHERE id = ?`).run(Number(req.params.id));
  recomputeToday();
  res.json({ ok: true });
});

// 정원(다람쥐/나무) 상태
app.get('/api/garden', (_req, res) => res.json(garden()));

// '127.0.0.1' = 내 컴퓨터에서만 접속 허용 (같은 네트워크의 다른 기기 차단)
app.listen(PORT, '127.0.0.1', () => console.log(`✅ Todo 앱 실행 중 → http://localhost:${PORT}`));
