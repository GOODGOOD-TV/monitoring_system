import { Router } from 'express';
import { pool } from '../libs/db.js';
import { mustRole } from '../middlewares/mustRole.js';
import { dispatchNotificationById } from '../services/notificationService.js';

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
      WHERE nt.company_id = :company_id`,
    { company_id }
  );

  const [rows] = await pool.query(
    `SELECT nt.id, nt.company_id, nt.alarm_id, nt.channel, nt.target_id, nt.status,
            nt.message, nt.payload, nt.created_at, nt.sent_at
       FROM notification nt
      WHERE nt.company_id = :company_id
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

/** POST /api/v1/notifications */
router.post('/', mustRole('admin', 'manager'), async (req, res) => {
  const company_id = req.company_id;
  const { alarm_id, channel, target_id, payload = null, message = null } = req.body ?? {};

  if (!alarm_id || !channel || !target_id) {
    return res.fail(400, 'INVALID_REQUEST_BODY', 'alarm_id/channel/target_id 필수');
  }

  // payload 반드시 string 처리
  const payloadJson = payload ? JSON.stringify(payload) : null;

  const [r1] = await pool.query(
    `INSERT INTO notification
        (company_id, alarm_id, channel, target_id, status, message, payload)
     VALUES
        (:company_id, :alarm_id, :channel, :target_id, 'PENDING', :message, :payload)`,
    { company_id, alarm_id, channel, target_id, message, payload: payloadJson }
  );

  const id = r1.insertId;

  // 즉시 전송시도
  await dispatchNotificationById(id);

  const [[row]] = await pool.query(
    `SELECT id, company_id, alarm_id, channel, target_id, status, message, payload, created_at, sent_at
       FROM notification WHERE id = :id`,
    { id }
  );

  return res.status(202).json({
    is_sucsess: true,
    message: '알림 전송 요청 접수 및 발송 시도',
    data: row
  });
});

/** POST /api/v1/notifications/:id/retry */
router.post('/:id/retry', mustRole('admin', 'manager'), async (req, res) => {
  const id = +req.params.id;
  const company_id = req.company_id;

  const [own] = await pool.query(
    `SELECT nt.id
       FROM notification nt
      WHERE nt.id = :id AND nt.company_id = :company_id`,
    { id, company_id }
  );
  if (!own.length) return res.fail(404, 'NOT_FOUND_n', '알림 없음');

  await pool.query(
    `UPDATE notification SET status='PENDING', sent_at=NULL WHERE id=:id`,
    { id }
  );

  await dispatchNotificationById(id);

  const [[row]] = await pool.query(
    `SELECT id, company_id, alarm_id, channel, target_id, status, message, payload, created_at, sent_at
       FROM notification WHERE id=:id`,
    { id }
  );

  return res.ok(row, '알림 재전송 완료');
});

export default router;
