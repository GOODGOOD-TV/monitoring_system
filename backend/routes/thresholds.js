import { Router } from 'express';
import { pool } from '../libs/db.js';
import { mustRole } from '../middlewares/mustRole.js';

const router = Router();

/**
 * GET /api/v1/thresholds
 * - 회사 범위 내 센서의 임계값 리스트
 */
router.get('/', async (req, res) => {
  const company_id = req.company_id;
  const [rows] = await pool.query(
    `
    SELECT th.sensor_id, th.lower_bound, th.upper_bound, th.updated_by, th.updated_at
      FROM threshold th
      JOIN sensor s ON s.id = th.sensor_id
     WHERE s.company_id = :company_id
    `,
    { company_id }
  );
  return res.status(200).json({
    is_sucsess: true,
    message: '임계값 조회 성공',
    data: rows
  });
});

/**
 * PUT /api/v1/thresholds/:sensorId
 * - admin/manager
 * - lower_bound <= upper_bound (422)
 * - 회사 소유 센서만 허용
 * - UPSERT
 */
router.put('/:sensorId', mustRole('admin', 'manager'), async (req, res) => {
  const company_id = req.company_id;
  const sensor_id = +req.params.sensorId;
  const { lower_bound, upper_bound } = req.body ?? {};

  if (typeof lower_bound !== 'number' || typeof upper_bound !== 'number') {
    return res.fail(422, 'LOWER_BOUND_MUST_NOT_EXCEED_UPPER_BOUND', '숫자 필요');
  }
  if (lower_bound > upper_bound) {
    return res.fail(422, 'LOWER_BOUND_MUST_NOT_EXCEED_UPPER_BOUND', 'lower > upper');
  }

  // 소유권 확인
  const [own] = await pool.query(
    'SELECT id FROM sensor WHERE id=:sensor_id AND company_id=:company_id AND deleted_at IS NULL',
    { sensor_id, company_id }
  );
  if (!own.length) return res.fail(404, 'NOT_FOUND', '센서 없음');

  // UPSERT
  await pool.query(
    `INSERT INTO threshold (sensor_id, lower_bound, upper_bound, updated_by)
     VALUES (:sensor_id, :lb, :ub, :uid)
     ON DUPLICATE KEY UPDATE
       lower_bound = VALUES(lower_bound),
       upper_bound = VALUES(upper_bound),
       updated_by  = VALUES(updated_by),
       updated_at  = UTC_TIMESTAMP()`,
    { sensor_id, lb: lower_bound, ub: upper_bound, uid: req.user.id }
  );

  const [row] = await pool.query(
    'SELECT sensor_id, lower_bound, upper_bound, updated_by, updated_at FROM threshold WHERE sensor_id=:sensor_id',
    { sensor_id }
  );

  return res.status(200).json({
    is_sucsess: true,
    message: '임계값 수정 성공',
    data: row[0]
  });
});

export default router;
