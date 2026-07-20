// DB 연결 + 스키마 자동 생성
import 'dotenv/config';
import { DatabaseSync } from 'node:sqlite'; // Node 24 기본 내장 (설치 불필요)
import { readFileSync } from 'node:fs';

// 접속/설정 정보(파일 경로)는 .env에서 읽음 — 코드에 하드코딩하지 않음
const dbFile = process.env.DATABASE_FILE || './todo.db';

export const db = new DatabaseSync(dbFile);
db.exec('PRAGMA journal_mode = WAL');  // 동시 읽기 성능 향상
db.exec('PRAGMA foreign_keys = ON');   // 외래키 제약 강제

// 서버 켤 때 테이블이 없으면 자동 생성 (IF NOT EXISTS라 여러 번 실행해도 안전)
const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
db.exec(schema);
