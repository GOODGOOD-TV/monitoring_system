import { Router } from 'express';
import { pool } from '../libs/db.js';
import { parsePeriod, bucketToSeconds } from '../libs/period.js';

const router = Router();

// 예: /api/v1/sensor-data/latest?ids=1,2,3
router.get('/latest', async (req, res) => {
  const company_id = req.company_id;
  const ids = String(req.query.ids || '').split(',').map(x => +x).filter(Boolean);
  if (!ids.length) return res.fail(400, 'INVALID_REQUEST_QUERY', 'ids 필수');

  const [rows] = await pool.query(
  `
  SELECT sd.sensor_id, sd.sensor_type, sd.data_value, sd.upload_at
    FROM sensor_data sd
    JOIN sensor s ON s.id = sd.sensor_id AND s.company_id = ?
    JOIN (
      SELECT sensor_id, MAX(upload_at) AS upload_at
        FROM sensor_data
       WHERE sensor_id IN (?)
       GROUP BY sensor_id
    ) t ON t.sensor_id = sd.sensor_id AND t.upload_at = sd.upload_at
   ORDER BY sd.sensor_id ASC
  `,
  [req.company_id, ids]
);

  return res.status(200).json({
    is_sucsess: true,
    message: '최신 센서 데이터 조회 성공',
    data: rows
  });
});
/**
 * GET /api/v1/sensor-data
 * query:
 *  - sensor_id (required)
 *  - mode=raw|agg (default: raw)
 *  - bucket=5m/10m/1h/... (agg 전용, default: 5m)
 *  - page/size/sort는 raw에서 upload_at ASC 고정, agg에서도 bucket ASC 고정
 *  - from/to: ISO8601
 *
 * 응답:
 *  - raw: { sensor_id, upload_at, data_no, data_value, data_sum, data_num }
 *  - agg: { sensor_id, bucket, avg, min, max, count }
 */
router.get('/', async (req, res) => {
  const company_id = req.company_id;
  const sort = String(req.query.sort || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const { sensor_id, mode = 'raw', bucket = '5m', sensor_type } = req.query ?? {};
  if (!sensor_id) return res.fail(400, 'INVALID_REQUEST_BODY', 'sensor_id 필수');

  // 페이지네이션
  const page = Math.max(1, parseInt(req.query.page ?? '1', 10));
  const size = Math.min(200, Math.max(1, parseInt(req.query.size ?? '200', 10)));
  const offset = (page - 1) * size;

  // 기간
  const period = parsePeriod(req.query);
  const wherePeriod = [];
  const params = { sensor_id: +sensor_id, company_id };
  if (sensor_type) {
    // 방어: 값 검증
    if (!['humidity','temperature'].includes(String(sensor_type))) {
      return res.fail(400, 'INVALID_REQUEST_QUERY', 'sensor_type must be humidity|temperature');
    }
    params.sensor_type = sensor_type;
  }
  if (period.from) { wherePeriod.push('sd.upload_at >= :from'); params.from = period.from.toISOString(); }
  if (period.to)   { wherePeriod.push('sd.upload_at <= :to');   params.to   = period.to.toISOString(); }

  // 멀티테넌시 검증: sensor → company 매핑 확인용 JOIN
  const ownJoin = 'JOIN sensor s ON s.id = sd.sensor_id AND s.company_id = :company_id';

  // --- Aggregated mode ---
  if (mode === 'agg') {
    const interval = bucketToSeconds(bucket);
    const baseWhere = ['sd.sensor_id = :sensor_id',sensor_type ? 'sd.sensor_type = :sensor_type' : '1', ...wherePeriod].join(' AND ');
    const bucketExpr = 'FLOOR(UNIX_TIMESTAMP(sd.upload_at)/:interval)';
    const bucketTime = `FROM_UNIXTIME(${bucketExpr}*:interval)`; // 실제 시간 시작점

    // 데이터
    const [rows] = await pool.query(
      `
      SELECT sd.sensor_id,
             sd.sensor_type,
             ${bucketTime} AS bucket,
             AVG(sd.data_value) AS avg,
             MIN(sd.data_value) AS min,
             MAX(sd.data_value) AS max,
             COUNT(*) AS count
        FROM sensor_data sd
        ${ownJoin}
       WHERE ${baseWhere}
       GROUP BY sd.sensor_id, sd.sensor_type, ${bucketExpr}
       ORDER BY sd.sensor_type ASC, bucket ASC
       LIMIT :size OFFSET :offset
      `,
      { ...params, interval, size, offset }
    );

    // total (버킷 개수)
    const [[{ total }]] = await pool.query(
      `
      SELECT COUNT(*) AS total FROM (
        SELECT 1
          FROM sensor_data sd
          ${ownJoin}
         WHERE ${baseWhere}
         GROUP BY ${bucketExpr}
      ) x
      `,
      { ...params, interval }
    );

    return res.status(200).json({
      is_sucsess: true,
      message: '센서 데이터 집계 조회 성공',
      data: rows,
      meta: { page, size, total }
    });
  }

  // --- Raw mode ---
  {
    const baseWhere = ['sd.sensor_id = :sensor_id', sensor_type ? 'sd.sensor_type = :sensor_type' : '1', ...wherePeriod].join(' AND ');

    const [rows] = await pool.query(
      `
      SELECT sd.sensor_id, sd.upload_at, sd.sensor_type, sd.data_no, sd.data_value, sd.data_sum, sd.data_num
        FROM sensor_data sd
        ${ownJoin}
       WHERE ${baseWhere}
       ORDER BY sd.upload_at ${sort}
       LIMIT :size OFFSET :offset
      `,
      { ...params, size, offset }
    );

    const [[{ total }]] = await pool.query(
      `
      SELECT COUNT(*) AS total
        FROM sensor_data sd
        ${ownJoin}
       WHERE ${baseWhere}
      `,
      params
    );

    return res.status(200).json({
      is_sucsess: true,
      message: '센서 데이터 조회 성공',
      data: rows,
      meta: { page, size, total }
    });
  }
});

export default router;
