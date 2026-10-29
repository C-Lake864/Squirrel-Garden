-- 다람쥐 정원: Supabase(PostgreSQL) 초기 테이블
-- Supabase 대시보드 > SQL Editor 에 붙여 넣어 한 번 실행한다. 여러 번 실행해도 안전하다.

-- 할 일. 사용자(익명 로그인으로 생기는 게스트 포함)마다 자기 것만 갖는다.
create table if not exists public.todos (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references auth.users (id) on delete cascade,
  title          text not null,
  category       text,
  due_date       date,                                              -- 'YYYY-MM-DD', 선택
  is_done        smallint not null default 0 check (is_done in (0, 1)),
  is_tiny        smallint not null default 0 check (is_tiny in (0, 1)),  -- 대충하기 모드
  original_title text,                                              -- 대충하기 전 원래 문장
  created_at     timestamptz not null default now(),
  done_at        timestamptz
);
create index if not exists todos_user_due_idx on public.todos (user_id, due_date);

-- 하루 단위 알밤 기록: 그날 마감 할 일을 전부 끝내면 earned = 1
create table if not exists public.daily_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  date    date not null,
  earned  smallint not null default 0 check (earned in (0, 1)),
  primary key (user_id, date)
);

-- RLS(행 단위 접근 제한): 켜 두고 정책을 하나도 만들지 않는다.
-- 그러면 브라우저(publishable key)는 이 테이블을 직접 읽거나 쓸 수 없고,
-- RLS 를 건너뛰는 서버(secret key)만 접근한다. 서버가 모든 조회에 user_id 조건을 붙인다.
alter table public.todos enable row level security;
alter table public.daily_progress enable row level security;
