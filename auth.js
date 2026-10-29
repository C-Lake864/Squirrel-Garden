// 요청이 누구 것인지 정하는 미들웨어. 이후 라우트는 req.uid 만 본다.
//   AUTH=none      사용자 한 명 ('local')
//   AUTH=supabase  브라우저가 보낸 익명 로그인 토큰(Authorization: Bearer ...)을 Supabase 에 확인해 사용자 ID 를 얻는다
export function createAuth(config, supabaseAdmin) {
  if (config.auth !== 'supabase') {
    return (req, _res, next) => {
      req.uid = 'local';
      next();
    };
  }
  return async (req, res, next) => {
    try {
      const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      if (!token) return res.status(401).json({ error: '로그인이 필요해요.' });
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !data?.user) return res.status(401).json({ error: '로그인이 필요해요.' });
      req.uid = data.user.id;
      next();
    } catch (err) {
      next(err);
    }
  };
}
