// 저장소 구현 2: Supabase (컨테이너 밖 PostgreSQL)
// 서버는 secret key 로 접속한다. secret key 는 RLS 를 건너뛰므로, 모든 조회와 변경에
// user_id 조건을 직접 붙여서 사용자끼리 데이터가 섞이지 않게 한다.
import { NO_CATEGORY, isDateStr } from './common.js';

// supabase-js 는 실패를 예외로 던지지 않고 { error } 로 돌려주므로 여기서 예외로 바꾼다.
function check({ data, error }, what) {
  if (error) {
    const err = new Error(`Supabase ${what} 실패: ${error.message}`);
    err.cause = error;
    throw err;
  }
  return data;
}

export function createSupabaseStorage(sb) {
  return {
    name: 'supabase',

    async listTodos(uid, { filter, date, category, today }) {
      let q = sb.from('todos').select('*').eq('user_id', uid);
      if (filter === 'today') {
        if (!isDateStr(today)) throw new Error('today 형식 오류');
        q = q.or(`due_date.eq.${today},and(is_done.eq.0,due_date.lt.${today})`);
      } else if (filter === 'date') {
        if (!isDateStr(date)) throw new Error('date 형식 오류');
        q = q.eq('due_date', date);
      }
      if (category === NO_CATEGORY) q = q.or('category.is.null,category.eq.');
      else if (category) q = q.eq('category', category);
      // SQLite 와 같은 순서: 안 끝낸 것 먼저, 마감일 빠른 순(마감일 없는 것은 뒤), id 순
      q = q.order('is_done').order('due_date', { ascending: true, nullsFirst: false }).order('id');
      return check(await q, '목록 조회');
    },

    async listCategories(uid) {
      const rows = check(await sb.from('todos').select('category').eq('user_id', uid), '카테고리 조회');
      const names = new Set();
      let uncategorized = 0;
      for (const r of rows) {
        if (r.category) names.add(r.category);
        else uncategorized += 1;
      }
      return { categories: [...names].sort(), uncategorized };
    },

    async createTodo(uid, { title, category, due_date }) {
      const row = check(
        await sb.from('todos').insert({ user_id: uid, title, category, due_date }).select('id').single(),
        '추가'
      );
      return Number(row.id);
    },

    async getTodo(uid, id) {
      return check(await sb.from('todos').select('*').eq('user_id', uid).eq('id', id).maybeSingle(), '조회');
    },

    async setDone(uid, id, done) {
      check(
        await sb
          .from('todos')
          .update({ is_done: done ? 1 : 0, done_at: done ? new Date().toISOString() : null })
          .eq('user_id', uid)
          .eq('id', id),
        '완료 변경'
      );
    },

    async shrinkTodo(uid, id, title, original) {
      check(
        await sb.from('todos').update({ title, is_tiny: 1, original_title: original }).eq('user_id', uid).eq('id', id),
        '대충하기'
      );
    },

    async restoreTodo(uid, id, title) {
      check(
        await sb.from('todos').update({ title, is_tiny: 0, original_title: null }).eq('user_id', uid).eq('id', id),
        '원래대로'
      );
    },

    async deleteTodo(uid, id) {
      check(await sb.from('todos').delete().eq('user_id', uid).eq('id', id), '삭제');
    },

    // 그 날짜 마감 할 일을 전부 끝냈으면 알밤 1개 (마감일 없는 할 일은 알밤과 무관)
    async recomputeDate(uid, date) {
      if (!date) return;
      const rows = check(
        await sb.from('todos').select('is_done').eq('user_id', uid).eq('due_date', date),
        '알밤 계산'
      );
      const earned = rows.length > 0 && rows.every((r) => r.is_done === 1) ? 1 : 0;
      check(
        await sb.from('daily_progress').upsert({ user_id: uid, date, earned }, { onConflict: 'user_id,date' }),
        '알밤 기록'
      );
    },

    async earnedDates(uid) {
      const rows = check(
        await sb.from('daily_progress').select('date').eq('user_id', uid).eq('earned', 1),
        '알밤 조회'
      );
      return rows.map((r) => r.date);
    },
  };
}
