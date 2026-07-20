-- 할 일 테이블
CREATE TABLE IF NOT EXISTS todos (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  title          TEXT NOT NULL,                    -- 할 일 내용
  category       TEXT,                             -- 카테고리(태그), 선택
  due_date       TEXT,                             -- 마감일 'YYYY-MM-DD', 선택
  is_done        INTEGER NOT NULL DEFAULT 0 CHECK (is_done IN (0, 1)),
  is_tiny        INTEGER NOT NULL DEFAULT 0 CHECK (is_tiny IN (0, 1)),  -- 대충하기 모드
  original_title TEXT,                             -- 대충하기 전 원래 문장(되돌리기용)
  created_at     TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  done_at        TEXT
);

-- 하루 단위 진행(알밤) 기록: 그날 마감 할 일을 전부 끝내면 earned = 1
CREATE TABLE IF NOT EXISTS daily_progress (
  date   TEXT PRIMARY KEY,                         -- 'YYYY-MM-DD'
  earned INTEGER NOT NULL DEFAULT 0 CHECK (earned IN (0, 1))
);
