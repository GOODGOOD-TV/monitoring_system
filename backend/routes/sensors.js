import { Router } from 'express';
import { pool } from '../libs/db.js';
import { buildOrderBy } from '../libs/order.js';
import { mustRole } from '../middlewares/mustRole.js';

const router = Router();

/** GET /api/v1/sensors */
router.get('/', async (req, res) => {
  const company_id = req.company_id;
  const page = Math.max(1, parseInt(req.query.page ?? '1', 10));
  const size = Math.min(200, Math.max(1, parseInt(req.query.size ?? '20', 10)));
  const offset = (page - 1) * size;

  const orderSql = buildOrderBy(
    req.query.sort,
    ['created_at', 'model', 'sensor_type'],
    'created_at DESC'
  );

  const area_id = req.query.area_id ? parseInt(req.query.area_id, 10) : null;

  // 🔹 공통 WHERE 절 + 파라미터
  let where = 'company_id=:company_id AND deleted_at IS NULL';
  const params = { company_id, size, offset };

  if (Number.isInteger(area_id)) {
    where += ' AND area_id=:area_id';
    params.area_id = area_id;
  }

  const [[{ cnt }]] = await pool.query(
    `SELECT COUNT(*) cnt FROM sensor WHERE ${where}`,
    params
  );

  const [rows] = await pool.query(
    `SELECT id, company_id, area_id, sensor_type, model, is_active, is_alarm,
            pos_x, pos_y, created_at, updated_at
       FROM sensor
      WHERE ${where}
      ${orderSql}
      LIMIT :size OFFSET :offset`,
    params
  );

  return res.status(200).json({
    is_sucsess: true,
    message: '센서 목록 조회 성공',
    data: rows,
    meta: { page, size, total: cnt }
  });
});

/** POST /api/v1/sensors  (admin/manager) */
router.post('/', mustRole('admin', 'manager'), async (req, res) => {
  const company_id = req.company_id;
  const {
    area_id,
    sensor_type,
    model,
    is_active = true,
    is_alarm = true,
    pos_x = null,
    pos_y = null,
  } = req.body ?? {};

  if (!area_id || !sensor_type || !model) {
    return res.fail(400, 'INVALID_REQUEST_BODY', 'area_id/sensor_type/model 필수');
  }

  // area 소속 검사(멀티테넌시 보장)
  const [area] = await pool.query(
    'SELECT id FROM area WHERE id=:area_id AND company_id=:company_id AND deleted_at IS NULL',
    { area_id, company_id }
  );
  if (!area.length) return res.fail(403, 'FORBIDDEN', '해당 회사의 구역이 아님');

  const [r1] = await pool.query(
    `INSERT INTO sensor (company_id, area_id, sensor_type, model, is_active, is_alarm, pos_x, pos_y)
     VALUES (:company_id, :area_id, :sensor_type, :model, :is_active, :is_alarm, :pos_x, :pos_y)`,
    {
      company_id,
      area_id,
      sensor_type,
      model,
      is_active: is_active ? 1 : 0,
      is_alarm: is_alarm ? 1 : 0,
      pos_x,
      pos_y,
    }
  );

  const [row] = await pool.query(
    'SELECT * FROM sensor WHERE id=:id',
    { id: r1.insertId }
  );

  return res.status(201).json({
    is_sucsess: true,
    message: '센서 생성 성공',
    data: row[0]
  });
});

/** PATCH /api/v1/sensors/:sensorId  (admin/manager) */
router.patch('/:sensorId', mustRole('admin', 'manager'), async (req, res) => {
  const company_id = req.company_id;
  const id = +req.params.sensorId;
  const { model = null, is_active = null, is_alarm = null, pos_x = null, pos_y = null } = req.body ?? {};

  const [r1] = await pool.query(
    `UPDATE sensor
        SET model     = COALESCE(:model, model),
            is_active = COALESCE(:is_active, is_active),
            is_alarm  = COALESCE(:is_alarm, is_alarm),
            pos_x     = COALESCE(:pos_x, pos_x),
            pos_y     = COALESCE(:pos_y, pos_y),
            updated_at = UTC_TIMESTAMP()
      WHERE id=:id AND company_id=:company_id AND deleted_at IS NULL`,
    { id, company_id, model, is_active, is_alarm, pos_x, pos_y }
  );

  if (!r1.affectedRows) return res.fail(404, 'NOT_FOUND', '센서 없음');

  const [row] = await pool.query(
    `SELECT id, model, is_active, is_alarm, pos_x, pos_y, updated_at
       FROM sensor WHERE id=:id`,
    { id }
  );

  return res.ok(row[0], '센서 수정 성공');
});

export default router;
