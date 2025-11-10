import { verifyAccess } from '../libs/jwt.js';

export function authGuard(req, res, next) {
  const h = req.headers['authorization'] ?? '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.fail(401, 'UNAUTHORIZED', '토큰 없음');

  try {
    const decoded = verifyAccess(token); // { id, company_id, role }
    req.user = decoded;
    // 멀티 테넌시: company_id는 JWT만 신뢰
    req.company_id = decoded.company_id;
    next();
  } catch (e) {
    return res.fail(401, 'UNAUTHORIZED', '토큰 무효');
  }
}
