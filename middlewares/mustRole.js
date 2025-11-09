// src/middlewares/mustRole.js
export function mustRole(...roles) {
  return (req, res, next) => {
    const userRole = req.user?.role;
    if (!userRole) {
      return res.fail(401, 'UNAUTHORIZED', '로그인이 필요합니다');
    }
    if (!roles.includes(userRole)) {
      return res.fail(403, 'FORBIDDEN', '권한 부족');
    }
    next();
  };
}
