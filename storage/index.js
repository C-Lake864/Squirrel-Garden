// 설정(STORAGE)에 맞는 저장소를 만든다.
import { createSqliteStorage } from './sqlite.js';
import { createSupabaseStorage } from './supabase.js';

// 서버용 Supabase 클라이언트 (secret key). 로그인 확인과 저장소가 함께 쓴다.
export async function createSupabaseAdmin(config) {
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(config.supabaseUrl, config.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false }, // 서버는 로그인 상태를 들고 있지 않는다(무상태)
  });
}

export async function createStorage(config, supabaseAdmin) {
  if (config.storage === 'supabase') return createSupabaseStorage(supabaseAdmin);
  return createSqliteStorage();
}
