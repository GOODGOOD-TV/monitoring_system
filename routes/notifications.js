import { Router } from 'express';
import { pool } from '../libs/db.js';
import { mustRole } from '../middlewares/mustRole.js';

const router = Router();

function buildOrderBy(querySort, allowed = [], def = 'nt.created_at DESC') {
  const arr = Array.isArray(querySort) ? querySort : (querySort ? [querySort] : []);
  const parts = arr.map(s => {
    const [f, d] = String(s).split(',');
    if (!allowed.includes(f)) return null;
    const dir = (d ?? 'asc').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    return `${f} ${dir}`;
  }).filter(Boolean);
  return `ORDER BY ${parts.length ? parts.join(', ') : def}`;
}

/** GET /api/v1/notifications */
router.get('/', async (req, res) => {
  const company_id = req.company_id;
  const page = Math.max(1, parseInt(req.query.page ?? '1', 10));
  const size = Math.min(200, Math.max(1, parseInt(req.query.size ?? '50', 10)));
  const offset = (page - 1) * size;

  const orderSql = buildOrderBy(
    req.query.sort,
    ['nt.created_at', 'nt.status'],
    'nt.created_at DESC'
  );

  const [[{ cnt }]] = await pool.query(
    `SELECT COUNT(*) cnt
       FROM notification nt
       JOIN alarm a ON a.id = nt.alarm_id
       JOIN sensor s ON s.id = a.sensor_id
      WHERE s.company_id = :company_id`,
    { company_id }
  );

  const [rows] = await pool.query(
    `SELECT nt.id, s.company_id, nt.alarm_id, nt.channel, nt.target_id, nt.status,
            nt.message, nt.payload, nt.created_at, nt.sent_at
       FROM notification nt
       JOIN alarm a ON a.id = nt.alarm_id
       JOIN sensor s ON s.id = a.sensor_id
      WHERE s.company_id = :company_id
      ${orderSql}
      LIMIT :size OFFSET :offset`,
    { company_id, size, offset }
  );

  return res.status(200).json({
    is_sucsess: true,
    message: '알림 전송 이력 조회 성공',
    data: rows,
    meta: { page, size, total: cnt }
  });
});

/** POST /api/v1/notifications  (admin/manager) */
router.post('/', mustRole('admin', 'manager'), async (req, res) => {
  const company_id = req.company_id;
  const { alarm_id, channel, target_id, payload = null, message = null } = req.body ?? {};

  if (!alarm_id || !channel || !target_id) {
    return res.fail(400, 'INVALID_REQUEST_BODY', 'alarm_id/channel/target_id 필수');
  }

  // 알람 소유권
  const [own] = await pool.query(
    `SELECT a.id
       FROM alarm a
       JOIN sensor s ON s.id = a.sensor_id
      WHERE a.id=:alarm_id AND s.company_id=:company_id`,
    { alarm_id, company_id }
  );
  if (!own.length) return res.fail(404, 'NOT_FOUND', '알람 없음');

  // 타깃 사용자 회사 일치
  const [usr] = await pool.query(
    `SELECT id FROM users WHERE id=:target_id AND company_id=:company_id AND deleted_at IS NULL`,
    { target_id, company_id }
  );
  if (!usr.length) return res.fail(403, 'FORBIDDEN', '타깃 사용자 범위 외');

  const [r1] = await pool.query(
    `INSERT INTO notification (alarm_id, channel, target_id, status, message, payload)
     VALUES (:alarm_id, :channel, :target_id, 'PENDING', :message, :payload)`,
    { alarm_id, channel, target_id, message, payload }
  );

  const [row] = await pool.query(
    `SELECT id, alarm_id, channel, target_id, status, payload, created_at, sent_at
       FROM notification WHERE id=:id`,
    { id: r1.insertId }
  );

  return res.status(202).json({
    is_sucsess: true,
    message: '알림 전송 요청 접수',
    data: row[0]
  });
});

/** POST /api/v1/notifications/:id/retry  (admin/manager) */
router.post('/:id/retry', mustRole('admin', 'manager'), async (req, res) => {
  const id = +req.params.id;
  const company_id = req.company_id;

  // 회사 소유 검증
  const [own] = await pool.query(
    `SELECT nt.id
       FROM notification nt
       JOIN alarm a ON a.id = nt.alarm_id
       JOIN sensor s ON s.id = a.sensor_id
      WHERE nt.id=:id AND s.company_id=:company_id`,
    { id, company_id }
  );
  if (!own.length) return res.fail(404, 'NOT_FOUND', '알림 없음');

  await pool.query(
    `UPDATE notification SET status='PENDING', sent_at=NULL WHERE id=:id`,
    { id }
  );

  return res.ok({ id, status: 'PENDING' }, '알림 재전송 요청 접수');
});

export default router;
