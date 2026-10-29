// 다람쥐 정원 서버 (Express). 저장소는 설정으로 고른다: 내장 SQLite 또는 Supabase.
import 'dotenv/config';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import express from 'express';
import { loadConfig } from './config.js';
import { createStorage, createSupabaseAdmin } from './storage/index.js';
import { NO_CATEGORY, isDateStr } from './storage/common.js';
import { createAuth } from './auth.js';
import { acornsToStage, currentStreak } from './garden-logic.js';
import { suggestSmaller } from './shrink-suggest.js';

// 설정이 잘못됐으면(예: 로그인 없이 Supabase 저장소) 이유를 보여 주고 시작하지 않는다.
let config;
try {
  config = loadConfig();
} catch (err) {
  console.error(`설정 오류:\n${err.message}`);
  process.exit(1);
}

const supabaseAdmin =
  config.storage === 'supabase' || config.auth === 'supabase' ? await createSupabaseAdmin(config) : null;
const store = await createStorage(config, supabaseAdmin);
const authenticate = createAuth(config, supabaseAdmin);

// 무중단 배포 실습용 시작 지연: 포트는 바로 열지만 이 시간 동안은 모든 요청에 503(준비 중)을 돌려준다.
// 시작할 때 무언가를 불러오느라 준비가 늦은 버전을 흉내 낸다. 기본값 0 이면 지연 없음.
const slowStartMs = Math.max(0, Number(process.env.SLOW_START_SECONDS) || 0) * 1000;
const readyAt = Date.now() + slowStartMs;
const isReady = () => Date.now() >= readyAt;

const app = express();
app.use((_req, res, next) => (isReady() ? next() : res.status(503).json({ error: '준비 중입니다.' })));
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

// 경로의 id 를 정수로. 숫자가 아니면 null (없는 할 일로 취급한다)
const toId = (raw) => {
  const id = Number(raw);
  return Number.isInteger(id) ? id : null;
};
const notFound = (res) => res.status(404).json({ error: '없는 할 일입니다.' });

// ---- 연속으로 알밤을 얻은 날 수 → 나무 단계, 누적 총합은 따로 ----
// acorns = 오늘(아직이면 어제)까지 연속으로 알밤을 얻은 날 수. 하루 건너뛰면 0부터 다시 시작한다.
// totalAcorns = 지금까지 얻은 알밤 전체 (끊겨도 줄지 않는다).
async function garden(uid) {
  const earnedDates = await store.earnedDates(uid);
  const today = todayStr();
  const acorns = currentStreak(earnedDates, today);
  return {
    acorns,
    totalAcorns: earnedDates.length,
    ...acornsToStage(acorns),
    todayEarned: earnedDates.includes(today),
  };
}

// ================= 로그인 없이 열려 있는 곳 =================

// 화면이 로그인을 준비하는 데 필요한 값. publishable key 는 브라우저에 드러나도 되는 값이다 (RLS 가 막는다).
app.get('/api/config', (_req, res) =>
  res.json({
    auth: config.auth,
    supabaseUrl: config.auth === 'supabase' ? config.supabaseUrl : '',
    supabasePublishableKey: config.auth === 'supabase' ? config.supabasePublishableKey : '',
  })
);

// 브라우저용 supabase-js (설치한 패키지의 번들을 그대로 내려 준다. 외부 CDN 을 쓰지 않는다)
if (config.auth === 'supabase') {
  const pkgDir = dirname(createRequire(import.meta.url).resolve('@supabase/supabase-js/package.json'));
  app.get('/vendor/supabase.js', (_req, res) => res.sendFile(join(pkgDir, 'dist', 'umd', 'supabase.js')));
}

// 스타트업 프로브용: 요청을 받을 준비가 끝났을 때만 200. 준비 전에는 위의 미들웨어가 503 을 돌려준다.
// 스테이지 6 시험용 고장: Cloud Run 위(K_SERVICE 가 있을 때)에서만 /health 가 항상 503. 로컬 테스트는 통과한다
app.get('/health', (_req, res) =>
  process.env.K_SERVICE ? res.status(503).json({ status: 'broken' }) : res.json({ status: 'ok' })
);

// 배포 확인용: Cloud Run 이 붙여 주는 리비전 이름과 커밋(빌드 시 GIT_SHA 로 주입)
app.get('/version', (_req, res) => res.json({
  revision: process.env.K_REVISION || 'local',
  commit: process.env.GIT_SHA || 'unknown',
  banner: process.env.BANNER || '', // 무중단 배포 실습: 어느 쪽(BLUE/GREEN)이 응답했는지 화면에 띄우는 용도
  storage: config.storage,
  auth: config.auth,
}));

// ================= API (여기부터는 누구 요청인지 정해진다: req.uid) =================
app.use('/api', authenticate);

// 목록 보기
//   ?filter=today          오늘 마감 + 마감이 지났는데 아직 못 끝낸 할 일
//   ?filter=date&date=YYYY-MM-DD   그 날짜에 마감인 할 일
//   ?filter=all (기본)     전부
//   &category=이름         위 결과 중 그 카테고리만 (__none__ 이면 카테고리 없는 것만)
app.get('/api/todos', ah(async (req, res) => {
  const { filter, date, category } = req.query;
  if (filter === 'date' && !isDateStr(date)) {
    return res.status(400).json({ error: '날짜 형식이 올바르지 않아요.' });
  }
  res.json(
    await store.listTodos(req.uid, {
      filter,
      date,
      category: typeof category === 'string' ? category : '',
      today: todayStr(),
    })
  );
}));

// 카테고리 필터 버튼을 만들 목록: 쓰이고 있는 카테고리 이름들 + 카테고리 없는 할 일 수
app.get('/api/categories', ah(async (req, res) => res.json(await store.listCategories(req.uid))));

// 추가
app.post('/api/todos', ah(async (req, res) => {
  const { title, category, due_date } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: '할 일 내용을 입력하세요.' });
  if (due_date && !isDateStr(due_date)) return res.status(400).json({ error: '마감일 형식이 올바르지 않아요.' });
  const id = await store.createTodo(req.uid, {
    title: title.trim(),
    category: category?.trim() || null,
    due_date: due_date || null,
  });
  await store.recomputeDate(req.uid, due_date || null);
  res.json({ id });
}));

// 완료/취소 토글
app.post('/api/todos/:id/toggle', ah(async (req, res) => {
  const id = toId(req.params.id);
  const cur = id === null ? null : await store.getTodo(req.uid, id);
  if (!cur) return notFound(res);
  await store.setDone(req.uid, id, !cur.is_done);
  await store.recomputeDate(req.uid, cur.due_date); // 그 할 일의 마감일 기준으로 재계산
  res.json({ ok: true });
}));

// 대충하기 추천: 이 할 일을 더 작게 바꿀 문장 후보
app.get('/api/todos/:id/suggestions', ah(async (req, res) => {
  const id = toId(req.params.id);
  const cur = id === null ? null : await store.getTodo(req.uid, id);
  if (!cur) return notFound(res);
  res.json({ suggestions: suggestSmaller(cur.is_tiny ? cur.original_title : cur.title) });
}));

// 대충하기: 더 작은 문장으로 바꾸기 (원래 문장은 보관)
app.post('/api/todos/:id/shrink', ah(async (req, res) => {
  const { title } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: '바꿀 내용을 입력하세요.' });
  const id = toId(req.params.id);
  const cur = id === null ? null : await store.getTodo(req.uid, id);
  if (!cur) return notFound(res);
  const original = cur.is_tiny ? cur.original_title : cur.title; // 원래 문장 보존
  await store.shrinkTodo(req.uid, id, title.trim(), original);
  res.json({ ok: true });
}));

// 대충하기 해제: 원래 문장으로 되돌리기
app.post('/api/todos/:id/restore', ah(async (req, res) => {
  const id = toId(req.params.id);
  const cur = id === null ? null : await store.getTodo(req.uid, id);
  if (!cur) return notFound(res);
  if (cur.is_tiny) await store.restoreTodo(req.uid, id, cur.original_title);
  res.json({ ok: true });
}));

// 삭제
app.delete('/api/todos/:id', ah(async (req, res) => {
  const id = toId(req.params.id);
  const cur = id === null ? null : await store.getTodo(req.uid, id); // 삭제 전 마감일 확보
  if (cur) {
    await store.deleteTodo(req.uid, id);
    await store.recomputeDate(req.uid, cur.due_date);
  }
  res.json({ ok: true });
}));

// 정원(다람쥐/나무) 상태
app.get('/api/garden', ah(async (req, res) => res.json(await garden(req.uid))));

// ---- 공통 에러 핸들러: 어떤 라우트에서 예외가 나도 일관된 JSON으로 응답 ----
app.use((err, _req, res, _next) => {
  console.error(err);
  const code = err.status || err.statusCode || 500;
  res.status(code).json({ error: code === 400 ? '잘못된 요청이에요.' : '서버에서 문제가 발생했어요.' });
});

// 어떤 저장소와 로그인으로 떴는지 시작할 때 남긴다 (키 값은 남기지 않는다)
console.log(JSON.stringify({ storage: config.storage, auth: config.auth }));
// HOST 기본값 '127.0.0.1' = 내 컴퓨터에서만 접속 허용 (같은 네트워크의 다른 기기 차단)
app.listen(PORT, HOST, () => console.log(`✅ Todo 앱 실행 중 → http://localhost:${PORT}`));
