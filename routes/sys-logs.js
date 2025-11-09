import { Router } from 'express';
import { pool } from '../libs/db.js';

const router = Router();

function buildOrderBy(querySort, allowed = [], def = 'created_at DESC') {
  const arr = Array.isArray(querySort) ? querySort : (querySort ? [querySort] : []);
  const parts = arr.map(s => {
    const [f, d] = String(s).split(',');
    if (!allowed.includes(f)) return null;
    const dir = (d ?? 'asc').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    return `${f} ${dir}`;
  }).filter(Boolean);
  return `ORDER BY ${parts.length ? parts.join(', ') : def}`;
}

/** GET /api/v1/sys-logs */
router.get('/', async (req, res) => {
  const company_id = req.company_id;
  const page = Math.max(1, parseInt(req.query.page ?? '1', 10));
  const size = Math.min(200, Math.max(1, parseInt(req.query.size ?? '50', 10)));
  const offset = (page - 1) * size;

  const orderSql = buildOrderBy(req.query.sort, ['created_at'], 'created_at DESC');

  const [[{ cnt }]] = await pool.query(
    `SELECT COUNT(*) cnt FROM sys_logs WHERE company_id=:company_id`,
    { company_id }
  );

  const [rows] = await pool.query(
    `SELECT id, company_id, user_id, action, description, ip, created_at
       FROM sys_logs
      WHERE company_id=:company_id
      ${orderSql}
      LIMIT :size OFFSET :offset`,
    { company_id, size, offset }
  );

  return res.status(200).json({
    is_sucsess: true,
    message: '시스템 로그 조회 성공',
    data: rows,
    meta: { page, size, total: cnt }
  });
});

export default router;
