import { Router } from 'express';
import { pool } from '../libs/db.js';
import { mustRole } from '../middlewares/mustRole.js';

const router = Router();

/**
 * GET /api/v1/companies
 * - admin 전용
 * - 페이지네이션 + 정렬
 */
router.get('/', mustRole('admin'), async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page ?? '1', 10));
  const size = Math.min(200, Math.max(1, parseInt(req.query.size ?? '20', 10)));
  const offset = (page - 1) * size;

  const allowed = ['created_at', 'name'];
  const sort = Array.isArray(req.query.sort) ? req.query.sort : (req.query.sort ? [req.query.sort] : []);
  const orderBy = sort
    .map(s => {
      const [f, d] = String(s).split(',');
      if (!allowed.includes(f)) return null;
      const dir = (d ?? 'asc').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      return `${f} ${dir}`;
    })
    .filter(Boolean)
    .join(', ') || 'created_at DESC';

  const [[{ cnt }]] = await pool.query(`SELECT COUNT(*) cnt FROM company WHERE deleted_at IS NULL`);

  const [rows] = await pool.query(
    `SELECT id, name, is_active, created_at
       FROM company
      WHERE deleted_at IS NULL
      ORDER BY ${orderBy}
      LIMIT :size OFFSET :offset`,
    { size, offset }
  );

  return res.status(200).json({
    is_sucsess: true,
    message: '회사 목록 조회 성공',
    data: rows,
    meta: { page, size, total: cnt }
  });
});

/**
 * POST /api/v1/companies
 * - admin 전용
 * body: { name, is_active? }
 */
router.post('/', mustRole('admin'), async (req, res) => {
  const { name, is_active = true } = req.body ?? {};
  if (!name) return res.fail(400, 'INVALID_REQUEST_BODY', 'name 필수');

  const [dup] = await pool.query(
    `SELECT id FROM company WHERE name=:name AND deleted_at IS NULL`,
    { name }
  );
  if (dup.length) return res.fail(409, 'CONFLICT', '이미 존재하는 회사명');

  const [r1] = await pool.query(
    `INSERT INTO company (name, is_active) VALUES (:name, :is_active)`,
    { name, is_active: is_active ? 1 : 0 }
  );

  const [row] = await pool.query(
    `SELECT id, name, is_active, created_at FROM company WHERE id=:id`,
    { id: r1.insertId }
  );

  return res.status(201).json({
    is_sucsess: true,
    message: '회사 생성 성공',
    data: row[0]
  });
});

/**
 * PATCH /api/v1/companies/:companyId
 * - admin 전용
 * body: { name?, is_active? }
 */
router.patch('/:companyId', mustRole('admin'), async (req, res) => {
  const id = +req.params.companyId;
  const { name = null, is_active = null } = req.body ?? {};

  const [r1] = await pool.query(
    `UPDATE company
        SET name = COALESCE(:name, name),
            is_active = COALESCE(:is_active, is_active)
      WHERE id=:id AND deleted_at IS NULL`,
    { id, name, is_active }
  );

  if (!r1.affectedRows) return res.fail(404, 'NOT_FOUND_c', '회사 없음');

  const [row] = await pool.query(
    `SELECT id, name, is_active, created_at, deleted_at FROM company WHERE id=:id`,
    { id }
  );

  return res.status(200).json({
    is_sucsess: true,
    message: '회사 수정 성공',
    data: row[0]
  });
});

/**
 * DELETE /api/v1/companies/:companyId
 * - admin 전용
 */
router.delete('/:companyId', mustRole('admin'), async (req, res) => {
  const id = +req.params.companyId;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 회사 존재+미삭제 확인
    const [[cmp]] = await conn.query(
      'SELECT id FROM company WHERE id=:id AND deleted_at IS NULL',
      { id }
    );
    if (!cmp) {
      await conn.rollback();
      return res.fail(404, 'NOT_FOUND_c', '이미 삭제되었거나 존재하지 않음');
    }

    // 1) 회사 soft delete
    await conn.query(
      'UPDATE company SET deleted_at = UTC_TIMESTAMP(), is_active = 0 WHERE id = :id AND deleted_at IS NULL',
      { id }
    );

    // 2) 연관 리소스 soft delete / 비활성
    await conn.query(
      'UPDATE users SET deleted_at = UTC_TIMESTAMP(), is_active = 0 WHERE company_id = :id AND deleted_at IS NULL',
      { id }
    );
    await conn.query(
      'UPDATE area SET deleted_at = UTC_TIMESTAMP(), is_active = 0 WHERE company_id = :id AND deleted_at IS NULL',
      { id }
    );
    await conn.query(
      'UPDATE sensor SET deleted_at = UTC_TIMESTAMP(), is_active = 0, is_alarm = 0 WHERE company_id = :id AND deleted_at IS NULL',
      { id }
    );

    // 알람/알림/로그는 기록 보존을 위해 soft delete만(원하면 유지 가능)
    await conn.query(
      'UPDATE alarm SET resolved_at = COALESCE(resolved_at, UTC_TIMESTAMP()) WHERE company_id = :id',
      { id }
    );
    await conn.query(
      'UPDATE notification SET status = IF(status="PENDING","FAILED",status) WHERE company_id = :id',
      { id }
    );
    await conn.query(
      'UPDATE sys_log SET created_at = created_at /* no-op: 보존 */ WHERE company_id = :id',
      { id }
    );

    await conn.commit();
    return res.ok({}, '회사 소프트 삭제(연쇄) 성공');
  } catch (e) {
    await conn.rollback();
    console.error('[COMPANY_SOFT_DELETE]', e);
    return res.fail(500, 'INTERNAL_ERROR', e.message ?? 'Server Error');
  } finally {
    conn.release();
  }
});


export default router;
