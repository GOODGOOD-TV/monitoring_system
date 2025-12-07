import { Router } from 'express';
import { pool } from '../libs/db.js';
import bcrypt from 'bcrypt';
import { mustRole } from '../middlewares/mustRole.js';
import { toE164Korean } from '../libs/phone.js';

const router = Router();

/**
 * GET /api/v1/users/me
 * - 인증된 모든 사용자 가능
 */
router.get('/me', async (req, res) => {
  const id = req.user?.id;
  if (!id) return res.fail(401, 'UNAUTHORIZED', '토큰 없음');

  const [rows] = await pool.query(
    `
    SELECT 
      u.id,
      u.company_id,
      u.employee_id,
      u.name,
      u.phone,
      u.email,
      u.role,
      u.is_active,
      u.created_at,
      u.updated_at,
      c.name AS company_name
    FROM users u
    JOIN company c ON c.id = u.company_id
    WHERE u.id = :id
      AND u.deleted_at IS NULL
    `,
    { id }
  );

  if (!rows.length) return res.fail(404, 'NOT_FOUND_u', '사용자 없음');

  return res.status(200).json({
    is_sucsess: true,
    message: '내 프로필 조회 성공',
    data: rows[0]
  });
});

/**
 * PATCH /api/v1/users/me
 * body: { name?, phone?, email?, is_active? }
 * 같은 회사 범위 내 수정만 허용
 */
router.patch('/me', async (req, res) => {
  const company_id = req.company_id;
  const id = req.user?.id;

  let {
    name = null,
    phone = null,
    email = null,
    is_active = null
  } = req.body ?? {};

  if (!id) return res.fail(401, 'UNAUTHORIZED', '토큰 없음');

  if ([name, phone, email, is_active].every(v => v === null)) {
    return res.fail(400, 'EMPTY_UPDATE', '변경할 필드가 없습니다');
  }

  // 🔹 phone이 포함된 경우만 변환/검증
  if (phone !== null) {
    try {
      phone = toE164Korean(phone);
    } catch (e) {
      return res.fail(400, 'INVALID_PHONE', e.message || '전화번호 형식이 올바르지 않습니다.');
    }
  }

  const [r1] = await pool.query(
    `
    UPDATE users
      SET name       = COALESCE(:name, name),
          phone      = COALESCE(:phone, phone),
          email      = COALESCE(:email, email),
          is_active  = COALESCE(:is_active, is_active),
          updated_at = UTC_TIMESTAMP()
      WHERE id = :id
        AND company_id = :company_id
        AND deleted_at IS NULL
    `,
    { id, company_id, name, phone, email, is_active }
  );

  if (!r1.affectedRows) {
    return res.fail(404, 'NOT_FOUND_u', '사용자 없음');
  }

  const [row] = await pool.query(
    `
    SELECT 
      id,
      name,
      phone,
      email,
      role,
      is_active,
      updated_at
    FROM users
    WHERE id = :id
    `,
    { id }
  );

  return res.status(200).json({
    is_sucsess: true,
    message: '사용자 수정 성공',
    data: row[0]
  });
});

/**
 * PATCH /api/v1/users/me/password
 * body: { current_password, new_password }
 * - 로그인 사용자 본인만
 */
router.patch('/me/password', mustRole('user', 'manager', 'admin'), async (req, res) => {
  try {
    const company_id = req.company_id;
    const id = Number.parseInt(req.user?.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.fail(401, 'UNAUTHORIZED', '로그인이 필요합니다');
    }

    const { current_password, new_password } = req.body ?? {};
    if (typeof current_password !== 'string' || typeof new_password !== 'string') {
      return res.fail(400, 'INVALID_REQUEST_BODY', 'current_password와 new_password가 필요합니다');
    }
    if (new_password.length < 8) {
      return res.fail(400, 'WEAK_PASSWORD', 'new_password는 최소 8자 이상이어야 합니다');
    }

    // 현재 해시 조회
    const [rows] = await pool.query(
      `SELECT password_hash
         FROM users
        WHERE id=:id AND company_id=:company_id AND deleted_at IS NULL
        LIMIT 1`,
      { id, company_id }
    );
    if (!rows.length) return res.fail(404, 'NOT_FOUND_u', '사용자 없음');

    const { password_hash } = rows[0];

    // 현재 비밀번호 확인
    const okPw = await bcrypt.compare(String(current_password), password_hash);
    if (!okPw) return res.fail(403, 'PASSWORD_MISMATCH', '현재 비밀번호가 올바르지 않습니다');

    // 새 비밀번호가 이전과 동일한지 방지
    const sameAsOld = await bcrypt.compare(String(new_password), password_hash);
    if (sameAsOld) return res.fail(400, 'PASSWORD_REUSED', '이전과 동일한 비밀번호는 사용할 수 없습니다');

    // 새 해시 생성
    const new_hash = await bcrypt.hash(String(new_password), 12);

    // 비밀번호 변경
    const [r1] = await pool.query(
      `UPDATE users
          SET password_hash=:new_hash,
              updated_at=UTC_TIMESTAMP()
        WHERE id=:id AND company_id=:company_id AND deleted_at IS NULL`,
      { id, company_id, new_hash }
    );
    if (!r1.affectedRows) return res.fail(404, 'NOT_FOUND_u', '사용자 없음');

    return res.status(200).json({
      is_sucsess: true,
      message: '비밀번호 변경 성공',
      data: { id }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      is_sucsess: false,
      message: 'INTERNAL_ERROR',
      error: { code: 'INTERNAL_ERROR', message: e.message, details: null }
    });
  }
});

/**
 * GET /api/v1/users
 * - admin 전용
 * - pagination: ?page=1&size=20 (size ≤ 200)
 * - sort: ?sort=created_at,desc&sort=name,asc (허용 필드 화이트리스트)
 */
router.get('/', mustRole('admin'), async (req, res) => {
  const company_id = req.company_id;

  // 페이지네이션
  const page = Math.max(1, parseInt(req.query.page ?? '1', 10));
  const size = Math.min(200, Math.max(1, parseInt(req.query.size ?? '20', 10)));
  const offset = (page - 1) * size;

  // 정렬
  const allowed = new Set(['created_at', 'name', 'email']);
  const sortParams = Array.isArray(req.query.sort) ? req.query.sort : (req.query.sort ? [req.query.sort] : []);
  const sorts = sortParams
    .map(s => {
      const [f, d] = String(s).split(',');
      if (!allowed.has(f)) return null;
      const dir = (d ?? 'asc').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      return `${f} ${dir}`;
    })
    .filter(Boolean);
  const orderSql = `ORDER BY ${sorts.length ? sorts.join(', ') : 'created_at DESC'}`;

  const [[{ cnt }]] = await pool.query(
    'SELECT COUNT(*) cnt FROM users WHERE company_id=:company_id AND deleted_at IS NULL',
    { company_id }
  );

  const [rows] = await pool.query(
    `
    SELECT id, company_id, employee_id, name, phone, email, role, is_active,
           created_at, updated_at
      FROM users
     WHERE company_id=:company_id
       AND deleted_at IS NULL
     ${orderSql}
     LIMIT :size OFFSET :offset
    `,
    { company_id, size, offset }
  );

  return res.status(200).json({
    is_sucsess: true,
    message: '사용자 목록 조회 성공',
    data: rows,
    meta: { page, size, total: cnt }
  });
});

/**
 * PATCH /api/v1/users/:userId
 * - admin 전용
 * body: { name?, phone?, role?, is_active? }
 * 같은 회사 범위 내 수정만 허용
 */
router.patch('/:userId', mustRole('admin'), async (req, res) => {
  const company_id = req.company_id;
  const id = +req.params.userId;
  const { name = null, phone = null, role = null, is_active = null } = req.body ?? {};

  if (role && !['admin', 'manager', 'user'].includes(role)) {
    return res.fail(400, 'INVALID_REQUEST_BODY', 'role 값이 올바르지 않습니다');
  }
  if ([name, phone, role, is_active].every(v => v === null)) {
    return res.fail(400, 'EMPTY_UPDATE', '변경할 필드가 없습니다');
  }

  const [r1] = await pool.query(
    `
    UPDATE users
       SET name=COALESCE(:name, name),
           phone=COALESCE(:phone, phone),
           role=COALESCE(:role, role),
           is_active=COALESCE(:is_active, is_active),
           updated_at=UTC_TIMESTAMP()
     WHERE id=:id
       AND company_id=:company_id
       AND deleted_at IS NULL
    `,
    { id, company_id, name, phone, role, is_active }
  );

  if (!r1.affectedRows) return res.fail(404, 'NOT_FOUND_u', '사용자 없음');

  const [row] = await pool.query(
    `SELECT id, name, phone, role, is_active, updated_at FROM users WHERE id=:id`,
    { id }
  );

  return res.status(200).json({
    is_sucsess: true,
    message: '사용자 수정 성공',
    data: row[0]
  });
});

export default router;
