import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../libs/db.js';
import { signAccess, signRefresh, verifyRefresh, ACCESS_EXP_SEC, REFRESH_EXP_SEC } from '../libs/jwt.js';

const r = Router();
function validatePhone(phone) {
  // 010-1234-5678 또는 01012345678
  const re = /^01[016789]-?\d{3,4}-?\d{4}$/;
  return re.test(phone);
}
/**
 * POST /api/v1/auth/register
 * body: { email, password, name }
 * 비밀번호 해시 저장. 기본 role=user, company_id는 임시로 1 (초기 부트스트랩 단계).
 * 운영에서는 관리자만 사용자 생성하도록 별도 /users 로 분리 가능.
 */

r.post('/register', async (req, res) => {
  const { company_name, email, password, name, phone, employee_id } = req.body ?? {};
  if (!validatePhone(phone)) {
    return res.badRequest(400, '전화번호 형식이 올바르지 않습니다. (예: 010-1234-5678)');
  }
  if (!company_name || !email || !password || !name || !phone || !employee_id) {
    return res.fail(400, 'INVALID_REQUEST_BODY',  'company_name/email/password/name/phone/employee_id 필수');
  }
  const [company] = await pool.query(
    'SELECT id FROM company WHERE name=:company_name AND deleted_at IS NULL',
    { company_name }
  );
  if (!company.length)
    return res.fail(404, 'NOT_FOUND_c', '존재하지 않는 company_code');

  const company_id = company[0].id;

  const [dup] = await pool.query('SELECT id FROM users WHERE email=:email AND deleted_at IS NULL', { email });
  if (dup.length) return res.fail(409, 'CONFLICT', '이미 존재하는 이메일');

  const hash = await bcrypt.hash(password, 10);

  await pool.query(
    `INSERT INTO users (company_id, employee_id, name, phone, email, password_hash, role, is_active) VALUES (:company_id, :employee_id, :name, :phone, :email, :hash, 'user', 1)`,
    { company_id, employee_id, name, phone, email, hash }
  );
  return res.ok({}, '회원가입 성공');
});

/**
 * POST /api/v1/auth/login
 * body: { email, password }
 * 성공 시 access_token JSON 반환 + refreshToken 쿠키 설정
 */
r.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) return res.fail(400, 'INVALID_REQUEST_BODY', 'email/password 필수');

  const [rows] = await pool.query(
    'SELECT id, company_id, password_hash, role, is_active FROM users WHERE email=:email AND deleted_at IS NULL',
    { email }
  );
  if (!rows.length) return res.fail(401, 'UNAUTHORIZED', '계정 없음');

  const u = rows[0];
  if (!u.is_active) return res.fail(403, 'FORBIDDEN', '비활성 사용자');

  const ok = await bcrypt.compare(password, u.password_hash);
  if (!ok) return res.fail(401, 'UNAUTHORIZED', '비밀번호 불일치');

  const access_token  = signAccess({ id: u.id, company_id: u.company_id, role: u.role });
  const refresh_token = signRefresh({ id: u.id, company_id: u.company_id, role: u.role });

  // refresh 토큰 해시 저장 (화이트리스트 방식)
  const rHash = await bcrypt.hash(refresh_token, 10);
  await pool.query(
    `INSERT INTO refresh_token (user_id, refresh_token_hash, ip, user_agent, expires_at) VALUES (:uid, :hash, :ip, :ua, DATE_ADD(UTC_TIMESTAMP(), INTERVAL :exp SECOND))`,
    {
      uid: u.id,
      hash: rHash,
      ip: req.ip,
      ua: req.headers['user-agent'] ?? null,
      exp: REFRESH_EXP_SEC,
    }
  );

  // 쿠키 설정 (개발 편의상 secure=false; 배포 시 true + sameSite=strict 권장)
  res.cookie('refreshToken', refresh_token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: REFRESH_EXP_SEC * 1000,
    path: '/',
  });

  return res.ok({ access_token, expires_in: ACCESS_EXP_SEC }, '로그인 성공');
});

/**
 * POST /api/v1/auth/refresh
 * 쿠키 refreshToken 검증 → access_token 재발급
 */
r.post('/refresh', async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) return res.fail(401, 'UNAUTHORIZED', 'Refresh Token 없음');

  let decoded;
  try {
    decoded = verifyRefresh(token); // { id, company_id, role, iat, exp }
  } catch {
    return res.fail(403, 'FORBIDDEN', 'Refresh Token 무효');
  }

  // 토큰 화이트리스트 검증(해시 비교)
  const [rows] = await pool.query(
    'SELECT refresh_token_hash FROM refresh_token WHERE user_id=:uid AND expires_at > UTC_TIMESTAMP() ORDER BY id DESC LIMIT 100',
    { uid: decoded.id }
  );
  const valid = rows.some((r) => bcrypt.compareSync(token, r.refresh_token_hash));
  if (!valid) return res.fail(403, 'FORBIDDEN', '등록되지 않은 토큰');

  const access_token = signAccess({ id: decoded.id, company_id: decoded.company_id, role: decoded.role });
  return res.ok({ access_token, expires_in: ACCESS_EXP_SEC }, '토큰 재발급 성공');
});

/**
 * POST /api/v1/auth/logout
 * 쿠키 제거. (선택) DB 화이트리스트에서 현재 토큰만 무효 처리 가능.
 * 사양 예시에 맞춰 200 + 메시지로 응답.
 */
r.post('/logout', async (req, res) => {
  res.clearCookie('refreshToken', { path: '/' });
  return res.ok({}, '로그아웃 완료');
});

export default r;
