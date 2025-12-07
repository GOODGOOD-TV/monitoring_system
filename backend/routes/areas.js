// backend/routes/areas.js
import { Router } from 'express';
import { pool } from '../libs/db.js';
import { buildOrderBy } from '../libs/order.js';
import { mustRole } from '../middlewares/mustRole.js';

const router = Router();

/** ⭐ GET /api/v1/areas/:areaId
 *  회사별 구역 단일 조회 (ZoneSensorsPage에서 필요)
 */
router.get("/:areaId", async (req, res) => {
  const company_id = req.company_id;
  const id = parseInt(req.params.areaId, 10);

  if (!Number.isInteger(id)) {
    return res.fail(400, "INVALID_ID", "유효하지 않은 구역 ID");
  }

  const [rows] = await pool.query(
    `SELECT id, company_id, area_name, is_active, created_at
       FROM area
      WHERE id = :id
        AND company_id = :company_id
        AND deleted_at IS NULL`,
    { id, company_id }
  );

  if (rows.length === 0) {
    return res.fail(404, "NOT_FOUND_a", "구역 없음");
  }

  return res.ok(rows[0], "구역 조회 성공");
});

/** GET /api/v1/areas - 구역 목록 */
router.get('/', async (req, res) => {
  const company_id = req.company_id;
  const page = Math.max(1, parseInt(req.query.page ?? '1', 10));
  const size = Math.min(200, Math.max(1, parseInt(req.query.size ?? '20', 10)));
  const offset = (page - 1) * size;

  const orderSql = buildOrderBy(
    req.query.sort,
    ['created_at', 'area_name'],
    'is_active DESC, created_at DESC' // 활성 구역 우선
  );

  const [[{ cnt }]] = await pool.query(
    'SELECT COUNT(*) cnt FROM area WHERE company_id=:company_id AND deleted_at IS NULL',
    { company_id }
  );

  const [rows] = await pool.query(
    `SELECT id, area_name, is_active, created_at
       FROM area
      WHERE company_id=:company_id
        AND deleted_at IS NULL
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

/** PATCH /api/v1/areas/:areaId  (admin/manager)
 *  - 구역 이름 / 활성 여부 수정
 */
router.patch('/:areaId', mustRole('admin', 'manager'), async (req, res) => {
  const company_id = req.company_id;
  const id = +req.params.areaId;
  const { area_name = null, is_active = null } = req.body ?? {};

  // 변경할 게 아무것도 없으면 에러
  if ([area_name, is_active].every(v => v === null)) {
    return res.fail(400, 'EMPTY_UPDATE', '변경할 필드가 없습니다');
  }

  const [r1] = await pool.query(
    `UPDATE area
        SET area_name = COALESCE(:area_name, area_name),
            is_active = COALESCE(:is_active, is_active),
            updated_at = UTC_TIMESTAMP()
      WHERE id = :id
        AND company_id = :company_id
        AND deleted_at IS NULL`,
    { id, company_id, area_name, is_active }
  );

  if (!r1.affectedRows) return res.fail(404, 'NOT_FOUND_a', '구역 없음');

  const [row] = await pool.query(
    `SELECT id, area_name, is_active, created_at, updated_at
       FROM area
      WHERE id=:id`,
    { id }
  );

  return res.ok(row[0], '구역 수정 성공');
});

/** DELETE /api/v1/areas/:areaId  (admin/manager)
 *  - 구역 소프트 삭제 (deleted_at 설정)
 *  - 해당 구역의 센서들은 is_active = 0 으로 비활성화
 */
router.delete('/:areaId', mustRole('admin', 'manager'), async (req, res) => {
  const company_id = req.company_id;
  const id = +req.params.areaId;

  if (!id) {
    return res.fail(400, 'INVALID_ID', '유효하지 않은 구역 ID');
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1) 구역 소프트 삭제
    const [r1] = await conn.query(
      `
      UPDATE area
         SET deleted_at = UTC_TIMESTAMP()
       WHERE id = :id
         AND company_id = :company_id
         AND deleted_at IS NULL
      `,
      { id, company_id }
    );

    if (!r1.affectedRows) {
      await conn.rollback();
      conn.release();
      return res.fail(404, 'NOT_FOUND_a', '구역 없음');
    }

    // 2) 해당 구역의 센서들 비활성화
    await conn.query(
      `
      UPDATE sensor
         SET is_active  = 0,
             updated_at = UTC_TIMESTAMP()
       WHERE company_id = :company_id
         AND area_id    = :id
         AND deleted_at IS NULL
      `,
      { company_id, id }
    );

    await conn.commit();
    conn.release();
    return res.ok({}, '구역 삭제(비활성화) 성공');
  } catch (err) {
    console.error('DELETE /api/v1/areas/:areaId error', err);
    await conn.rollback();
    conn.release();
    return res.fail(500, 'INTERNAL_ERROR', '구역 삭제 중 오류가 발생했습니다.');
  }
});

export default router;
