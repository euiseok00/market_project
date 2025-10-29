export function attachUser(req, res, next) {
  // 세션에 user 객체를 저장한다고 가정 (로그인 시)
  if (req.session && req.session.user) {
    req.user = req.session.user;
  } else {
    req.user = null;
  }
  next();
}