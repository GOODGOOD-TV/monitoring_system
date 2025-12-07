import { Router } from 'express';
import { pool } from '../libs/db.js';
import { mustRole } from '../middlewares/mustRole.js';

const router = Router();

function buildOrderBy(querySort, allowed = [], def = 'a.created_at DESC') {
  const arr = Array.isArray(querySort) ? querySort : (querySort ? [querySort] : []);
  const parts = arr.map(s => {
    const [f, d] = String(s).split(',');
    if (!allowed.includes(f)) return null;
    const dir = (d ?? 'asc').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    return `${f} ${dir}`;
  }).filter(Boolean);
  return `ORDER BY ${parts.length ? parts.join(', ') : def}`;
}

/** GET /api/v1/alarms */
router.get('/', async (req, res) => {
  const company_id = req.company_id;
  const page = Math.max(1, parseInt(req.query.page ?? '1', 10));
  const size = Math.min(200, Math.max(1, parseInt(req.query.size ?? '20', 10)));
  const offset = (page - 1) * size;

  const orderSql = buildOrderBy(
    req.query.sort,
    ['a.created_at', 'a.resolved_at', 's.sensor_type'],
    'a.created_at DESC'
  );

  const [[{ cnt }]] = await pool.query(
    `SELECT COUNT(*) cnt
       FROM alarm a
       JOIN sensor s ON s.id = a.sensor_id
      WHERE s.company_id = :company_id`,
    { company_id }
  );

  const [rows] = await pool.query(
    `SELECT a.id, s.company_id, a.sensor_id, s.sensor_type, a.message, a.value,
            a.threshold_ref, a.created_at, a.resolved_at, a.resolved_by
       FROM alarm a
       JOIN sensor s ON s.id = a.sensor_id
      WHERE s.company_id = :company_id
      ${orderSql}
      LIMIT :size OFFSET :offset`,
    { company_id, size, offset }
  );

  return res.status(200).json({
    is_sucsess: true,
    message: '알람 목록 조회 성공',
    data: rows,
    meta: { page, size, total: cnt }
  });
});
/** POST /api/v1/alarms  (admin/manager) */
/** POST /api/v1/alarms/:alarmId/resolve  (admin/manager) */
router.post('/:alarmId/resolve', mustRole('admin', 'manager'), async (req, res) => {
  const company_id = req.company_id;
  const id = +req.params.alarmId;
  const uid = req.user.id;

  const [r1] = await pool.query(
    `UPDATE alarm a
        JOIN sensor s ON s.id = a.sensor_id
       SET a.resolved_at = UTC_TIMESTAMP(),
           a.resolved_by = :uid
     WHERE a.id = :id
       AND s.company_id = :company_id
       AND a.resolved_at IS NULL`,
    { id, uid, company_id }
  );

  if (!r1.affectedRows) return res.fail(404, 'NOT_FOUND_n', '알람 없음');

  const [row] = await pool.query(
    `SELECT id, resolved_at, resolved_by FROM alarm WHERE id=:id`,
    { id }
  );

  return res.ok(row[0], '알람 해제 완료');
});

export default router;
