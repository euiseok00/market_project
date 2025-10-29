export function attachUser(req, res, next) {
  // 로그인 시 세션에 user 객체를 저장한다고 가정
  // 예: req.session.user = { user_id: 1, role: 'admin', username: 'admin' }
  if (req.session && req.session.user) {
    req.user = req.session.user;
  } else {
    req.user = null;
  }
  next();
}
