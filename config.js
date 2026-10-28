// 저장소(STORAGE)와 로그인(AUTH) 설정을 읽고 검증한다.
//   STORAGE = sqlite (기본, 컨테이너 안 파일) | supabase (컨테이너 밖 데이터베이스)
//   AUTH    = none   (기본, 사용자 한 명)     | supabase (익명 로그인으로 브라우저마다 게스트 사용자)
//
// 안전장치: 데이터베이스를 Supabase 로 바꾸면서 로그인을 켜지 않으면 모든 방문자의 할 일이
// 한 사람 것으로 섞이므로, 그런 설정으로는 앱을 시작하지 않는다.

const STORAGES = ['sqlite', 'supabase'];
const AUTHS = ['none', 'supabase'];

export function loadConfig(env = process.env) {
  const storage = env.STORAGE || 'sqlite';
  const auth = env.AUTH || 'none';
  const problems = [];

  if (!STORAGES.includes(storage)) problems.push(`STORAGE 는 ${STORAGES.join(' 또는 ')} 이어야 합니다 (지금: ${storage}).`);
  if (!AUTHS.includes(auth)) problems.push(`AUTH 는 ${AUTHS.join(' 또는 ')} 이어야 합니다 (지금: ${auth}).`);

  if (storage === 'supabase' && auth !== 'supabase') {
    problems.push(
      'STORAGE=supabase 인데 AUTH=supabase 가 아닙니다. 로그인 없이 공용 데이터베이스를 켜면 모든 방문자의 할 일이 한 사람 것으로 섞입니다.'
    );
  }

  const need = [];
  if (storage === 'supabase' || auth === 'supabase') need.push('SUPABASE_URL', 'SUPABASE_SECRET_KEY');
  if (auth === 'supabase') need.push('SUPABASE_PUBLISHABLE_KEY');
  for (const name of need) {
    if (!env[name]) problems.push(`${name} 값이 .env 에 없습니다.`);
  }

  if (problems.length) {
    const err = new Error(problems.map((p) => `- ${p}`).join('\n') + '\n앱을 시작하지 않습니다.');
    err.code = 'INVALID_CONFIG';
    throw err;
  }

  return {
    storage,
    auth,
    supabaseUrl: env.SUPABASE_URL || '',
    // 이 두 값은 키이므로 로그나 응답에 그대로 내보내지 않는다. publishable key 만 화면 코드로 전달한다.
    supabasePublishableKey: env.SUPABASE_PUBLISHABLE_KEY || '',
    supabaseSecretKey: env.SUPABASE_SECRET_KEY || '',
  };
}
