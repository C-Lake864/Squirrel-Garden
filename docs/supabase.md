# Supabase 연결 (시험용 프로젝트)

컨테이너 안 SQLite 대신 Supabase(PostgreSQL)에 할 일을 저장해, 서버를 언제 꺼도 켜도 되는 무상태로 만든다.

## 1. 시험용 프로젝트 만들기
1. Supabase 대시보드에서 프로젝트를 만든다. 이름은 `squirrel-garden-staging` 처럼 시험용임을 알 수 있게 짓고,
   리전은 배포 리전(us-central1)과 가까운 미국 리전을 고른다. 데이터베이스 비밀번호는 비밀번호 관리 도구에 저장한다.
2. SQL Editor 에 [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql) 내용을 붙여 넣고 실행한다.
   `todos`, `daily_progress` 테이블이 만들어지고 RLS 가 켜진다.
3. Authentication > Sign In / Providers 에서 **Allow anonymous sign-ins** 를 켜고 저장한다.
4. Authentication > Rate Limits 에서 익명 로그인 한도를 확인한다 (기본 IP 하나당 시간당 30건).
5. Project Settings > API Keys 에서 프로젝트 URL, publishable key, secret key 위치를 확인한다.

## 2. 값 넣기 (키는 채팅이나 명령에 붙여 넣지 않는다)
저장소 루트의 `.env` 를 편집기로 열어 다음 다섯 줄을 채운다 (`.env.example` 참고, `.env` 는 커밋하지 않는다).

| 이름 | 값 | 쓰는 곳 |
|---|---|---|
| `STORAGE` | `supabase` | 저장소 스위치 |
| `AUTH` | `supabase` | 로그인 스위치 |
| `SUPABASE_URL` | 프로젝트 URL | 서버, 브라우저 |
| `SUPABASE_PUBLISHABLE_KEY` | publishable key | 브라우저 (드러나도 RLS 가 막는다) |
| `SUPABASE_SECRET_KEY` | secret key | **서버에서만** (RLS 를 건너뛰는 키) |

## 3. 동작 방식
- 브라우저는 익명 로그인으로 게스트 사용자를 만들고, 그 토큰을 `Authorization: Bearer ...` 로 서버에 보낸다.
- 서버는 토큰을 Supabase 에 확인해 사용자 ID 를 얻고, **모든 조회와 변경에 `user_id` 조건을 붙인다.**
  (secret key 는 RLS 를 건너뛰므로 이 조건이 사용자 분리를 맡는다.)
- 브라우저마다 다른 게스트 사용자라, 다른 브라우저에서는 앞의 할 일이 보이지 않는다.
- `STORAGE=supabase` 인데 `AUTH=supabase` 가 아니면 앱이 시작하지 않는다.

## 4. 되돌리기
`.env` 의 `STORAGE=sqlite`, `AUTH=none` 으로 바꾸면 다시 컨테이너 안 SQLite 를 쓴다.
