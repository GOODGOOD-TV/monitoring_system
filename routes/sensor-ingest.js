import { Router } from 'express';
import { pool } from '../libs/db.js';
import { processSensorReading } from '../libs/alarmService.js';
import { mustRole } from '../middlewares/mustRole.js';

const router = Router();

/**
 * POST /api/v1/sensor-data/ingest
 * - 센서 디바이스/어댑터가 호출 (보호 라우트: admin/manager만 허용해도 되고, 별도 디바이스 키 인증을 둘 수도 있음)
 * body:
 *  { sensor_id, upload_at, data_no?, data_value, data_sum?, data_num? }
 * or
 *  [ { ... }, { ... } ]  // 배치
 *
 * 응답: 생성/알람/해제 집계
 */
router.post('/ingest', mustRole('admin','manager'), async (req, res) => {
  const payload = Array.isArray(req.body) ? req.body : [req.body ?? {}];

  // 기본 검증
  for (const it of payload) {
    if (!it.sensor_id || typeof it.data_value !== 'number') {
      return res.fail(400, 'INVALID_REQUEST_BODY', 'sensor_id/data_value 필수');
    }
    // upload_at 기본값: 서버 시각
    it.upload_at = it.upload_at ?? new Date().toISOString();
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const summary = { inserted: 0, alarms_created: 0, auto_reset: 0, cooldown_skip: 0, skipped: 0, effects: [] };

    for (const it of payload) {
      const r = await processSensorReading(conn, it);
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
      // raw insert는 process 내부에서 IGNORE로 처리 → inserted 추정은 effects가 ALARM_*외에도 포함되므로 생략 가능
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
