import { Router } from 'express';
import { pool } from '../libs/db.js';
import { buildOrderBy } from '../libs/order.js';
import { mustRole } from '../middlewares/mustRole.js';

const router = Router();

/** GET /api/v1/areas */
router.get('/', async (req, res) => {
  const company_id = req.company_id;
  const page = Math.max(1, parseInt(req.query.page ?? '1', 10));
  const size = Math.min(200, Math.max(1, parseInt(req.query.size ?? '20', 10)));
  const offset = (page - 1) * size;

  const orderSql = buildOrderBy(req.query.sort, ['created_at', 'area_name'], 'created_at DESC');

  const [[{ cnt }]] = await pool.query(
    'SELECT COUNT(*) cnt FROM area WHERE company_id=:company_id AND deleted_at IS NULL',
    { company_id }
  );

  const [rows] = await pool.query(
    `SELECT id, area_name, is_active, created_at
       FROM area
      WHERE company_id=:company_id AND deleted_at IS NULL
      ${orderSql}
      LIMIT :size OFFSET :offset`,
    { company_id, size, offset }
  );

  return res.ok(rows, '구역 목록 조회 성공', { page, size, total: cnt });
});

// 응답 래퍼에 meta를 넣으려면 헬퍼 대신 직접 json 반환
function okWithMeta(res, message, data, meta) {
  return res.status(200).json({ is_sucsess: true, message, data, meta });
}

/** POST /api/v1/areas  (admin/manager) */
router.post('/', mustRole('admin', 'manager'), async (req, res) => {
  const company_id = req.company_id;
  const { area_name, is_active = true } = req.body ?? {};
  if (!area_name) return res.fail(400, 'INVALID_REQUEST_BODY', 'area_name 필수');

  // 회사 내 중복 방지
  const [dup] = await pool.query(
    'SELECT id FROM area WHERE company_id=:company_id AND area_name=:area_name AND deleted_at IS NULL',
    { company_id, area_name }
  );
  if (dup.length) return res.fail(409, 'CONFLICT', '중복 구역명');

  const [r1] = await pool.query(
    `INSERT INTO area (company_id, area_name, is_active)
     VALUES (:company_id, :area_name, :is_active)`,
    { company_id, area_name, is_active: is_active ? 1 : 0 }
  );

  const [row] = await pool.query(
    `SELECT id, area_name, is_active, created_at FROM area WHERE id=:id`,
    { id: r1.insertId }
  );

  return res.created(row[0], '구역 생성 성공');
});

/** PATCH /api/v1/areas/:areaId  (admin/manager) */
router.patch('/:areaId', mustRole('admin', 'manager'), async (req, res) => {
  const company_id = req.company_id;
  const id = +req.params.areaId;
  const { area_name = null, is_active = null } = req.body ?? {};

  const [r1] = await pool.query(
    `UPDATE area
        SET area_name = COALESCE(:area_name, area_name),
            is_active = COALESCE(:is_active, is_active)
      WHERE id = :id AND company_id = :company_id AND deleted_at IS NULL`,
    { id, company_id, area_name, is_active }
  );

  if (!r1.affectedRows) return res.fail(404, 'NOT_FOUND', '구역 없음');

  const [row] = await pool.query(
    `SELECT id, area_name, is_active, created_at, deleted_at FROM area WHERE id=:id`,
    { id }
  );

  return res.ok(row[0], '구역 수정 성공');
});

export default router;
