import { Router } from 'express';
import { pool } from '../libs/db.js';
import { processSensorReading } from '../libs/alarmService.js';
import { mustRole } from '../middlewares/mustRole.js';

const router = Router();

/**
 * POST /api/v1/sensor-data/ingest
 * body: { sensor_id, sensor_type?, data_value, data_no?, data_sum?, data_num? } | [ ... ]
 * - upload_at 은 받지 않음(서버가 NOW()로 기록)
 * - 필수: sensor_id, data_value
 * - sensor_type 없으면 sensor 테이블에서 보정
 */
router.post('/ingest', mustRole('admin','manager'), async (req, res) => {
  const payload = Array.isArray(req.body) ? req.body : [req.body ?? {}];

  for (const it of payload) {
    // 1) 필수값 검증
    const sid = Number(it.sensor_id);
    const val = Number(it.data_value);
    if (!Number.isInteger(sid) || sid <= 0 || !Number.isFinite(val)) {
      return res.fail(400, 'INVALID_REQUEST_BODY', 'sensor_id(정수)/data_value(숫자) 필수');
    }
    it.sensor_id = sid;
    it.data_value = val;

    // 2) sensor_type 보정 (없으면 sensor 테이블에서 조회)
    if (!it.sensor_type) {
      const [[row]] = await pool.query(
        'SELECT sensor_type FROM sensor WHERE id=:id',
        { id: it.sensor_id }
      );
      if (!row?.sensor_type) {
        return res.fail(400, 'INVALID_SENSOR', '존재하지 않거나 타입 미정의 센서');
      }
      it.sensor_type = String(row.sensor_type).toLowerCase();
    } else {
      it.sensor_type = String(it.sensor_type).toLowerCase();
    }
    if (!['humidity','temperature'].includes(it.sensor_type)) {
      return res.fail(400, 'INVALID_REQUEST_BODY', 'sensor_type must be humidity|temperature');
    }

    // 3) 선택 필드(현재 동작 유지)
    // - data_no 기본 1
    // - data_sum/data_num은 주면 사용, 아니면 NULL (현행 유지, 이후 로직 개선 예정)
    it.data_no  = Number.isInteger(it.data_no) ? it.data_no : 1;
    it.data_sum = (typeof it.data_sum === 'number') ? it.data_sum : null;
    it.data_num = (typeof it.data_num === 'number') ? it.data_num : null;

    // 4) upload_at 은 받지 않음 → processSensorReading에서 NOW()로 기록
    delete it.upload_at;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const summary = { inserted: 0, alarms_created: 0, auto_reset: 0, cooldown_skip: 0, skipped: 0, effects: [] };

    for (const it of payload) {
      const r = await processSensorReading(conn, it); // it: {sensor_id, sensor_type, data_value, data_no, data_sum, data_num}
      summary.effects.push({ sensor_id: it.sensor_id, effect: r.effect, info: r });
      switch (r.effect) {
        case 'ALARM_CREATED': summary.alarms_created += 1; break;
        case 'ALARM_AUTORESET': summary.auto_reset += 1; break;
        case 'COOLDOWN_SKIP': summary.cooldown_skip += 1; break;
        case 'SKIP_NO_SENSOR':
        case 'SKIP_ALARM_OFF':
        case 'SKIP_NO_THRESHOLD': summary.skipped += 1; break;
        default: break;
      }
      summary.inserted += 1;
    }

    await conn.commit();
    return res.status(201).json({
      is_sucsess: true,
      message: '적재/알람 처리 완료',
      data: summary
    });
  } catch (e) {
    await conn.rollback();
    return res.fail(500, 'INTERNAL_ERROR', e.message);
  } finally {
    conn.release();
  }
});

export default router;
