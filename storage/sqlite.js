// 저장소 구현 1: 내장 SQLite (컨테이너 안의 파일)
// 사용자 구분이 없는 1인용이라 uid 는 받기만 하고 쓰지 않는다.
// 모든 값은 ? 파라미터로만 넣는다 (SQL 인젝션 방어).
import { NO_CATEGORY } from './common.js';

export async function createSqliteStorage() {
  const { db } = await import('../db.js'); // 이 저장소를 고를 때만 DB 파일을 연다

  return {
    name: 'sqlite',

    async listTodos(_uid, { filter, date, category, today }) {
      const where = [];
      const params = [];
      if (filter === 'today') {
        where.push('(due_date = ? OR (is_done = 0 AND due_date < ?))');
        params.push(today, today);
      } else if (filter === 'date') {
        where.push('due_date = ?');
        params.push(date);
      }
      if (category === NO_CATEGORY) {
        where.push("(category IS NULL OR category = '')");
      } else if (category) {
        where.push('category = ?');
        params.push(category);
      }
      const sql =
        `SELECT * FROM todos ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ` +
        `ORDER BY is_done, due_date IS NULL, due_date, id`;
      return db.prepare(sql).all(...params);
    },

    async listCategories() {
      const categories = db
        .prepare(`SELECT category FROM todos WHERE category IS NOT NULL AND category <> '' GROUP BY category ORDER BY category`)
        .all()
        .map((r) => r.category);
      const uncategorized = db
        .prepare(`SELECT COUNT(*) AS n FROM todos WHERE category IS NULL OR category = ''`)
        .get().n;
      return { categories, uncategorized };
    },

    async createTodo(_uid, { title, category, due_date }) {
      const info = db
        .prepare(`INSERT INTO todos (title, category, due_date) VALUES (?, ?, ?)`)
        .run(title, category, due_date);
      return Number(info.lastInsertRowid);
    },

    async getTodo(_uid, id) {
      return db.prepare(`SELECT * FROM todos WHERE id = ?`).get(id) ?? null;
    },

    async setDone(_uid, id, done) {
      db.prepare(`UPDATE todos SET is_done = ?, done_at = ? WHERE id = ?`)
        .run(done ? 1 : 0, done ? new Date().toISOString() : null, id);
    },

    async shrinkTodo(_uid, id, title, original) {
      db.prepare(`UPDATE todos SET title = ?, is_tiny = 1, original_title = ? WHERE id = ?`).run(title, original, id);
    },

    async restoreTodo(_uid, id, title) {
      db.prepare(`UPDATE todos SET title = ?, is_tiny = 0, original_title = NULL WHERE id = ?`).run(title, id);
    },

    async deleteTodo(_uid, id) {
      db.prepare(`DELETE FROM todos WHERE id = ?`).run(id);
    },

    // 그 날짜 마감 할 일을 전부 끝냈으면 알밤 1개 (마감일 없는 할 일은 알밤과 무관)
    async recomputeDate(_uid, date) {
      if (!date) return;
      const row = db
        .prepare(`SELECT COUNT(*) AS total, SUM(CASE WHEN is_done = 1 THEN 1 ELSE 0 END) AS done FROM todos WHERE due_date = ?`)
        .get(date);
      const earned = row.total > 0 && row.total === row.done ? 1 : 0;
      db.prepare(
        `INSERT INTO daily_progress (date, earned) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET earned = excluded.earned`
      ).run(date, earned);
    },

    async earnedDates() {
      return db.prepare(`SELECT date FROM daily_progress WHERE earned = 1`).all().map((r) => r.date);
    },
  };
}
