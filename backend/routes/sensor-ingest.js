import { Router } from 'express';
import { pool } from '../libs/db.js';
import { processSensorReading } from '../libs/alarmService.js';
import { mustRole } from '../middlewares/mustRole.js';

const router = Router();

/**
 * POST /api/v1/sensor-data/ingest
 * body: { sensor_id, sensor_type?, data_value, data_no?, data_sum?, data_num? } | [ ... ]
 *
 * - 필수: sensor_id(정수), data_value(숫자)
 * - sensor_type/threshold_min/threshold_max/is_alarm 은 sensor 테이블에서 가져옴
 * - upload_at 은 받지 않음(서버가 NOW()로 기록)
 */
router.post('/ingest', mustRole('admin', 'manager'), async (req, res) => {
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

    // 2) sensor 테이블에서 타입 + 알람 상태 + 임계값 조회
    const [[sensor]] = await pool.query(
      `SELECT sensor_type, is_alarm, threshold_min, threshold_max
         FROM sensor
        WHERE id=:id AND deleted_at IS NULL`,
      { id: it.sensor_id }
    );

    if (!sensor) {
      return res.fail(400, 'INVALID_SENSOR', '존재하지 않는 센서');
    }

    // sensor_type: 요청에 들어왔으면 우선 사용, 없으면 DB 값 사용
    const sensorType = (it.sensor_type ?? sensor.sensor_type ?? '').toString().toLowerCase();
    if (!['humidity', 'temperature'].includes(sensorType)) {
      return res.fail(400, 'INVALID_REQUEST_BODY', 'sensor_type must be humidity|temperature');
    }
    it.sensor_type = sensorType;

    // 알람 ON/OFF, 임계값 정보도 같이 붙여서 processSensorReading에 넘김
    it.is_alarm = sensor.is_alarm ? true : false;
    it.threshold_min = sensor.threshold_min; // DECIMAL → JS number or null
    it.threshold_max = sensor.threshold_max;

    // 3) 선택 필드(현행 유지)
    it.data_no  = Number.isInteger(it.data_no) ? it.data_no : 1;
    it.data_sum = (typeof it.data_sum === 'number') ? it.data_sum : null;
    it.data_num = (typeof it.data_num === 'number') ? it.data_num : null;

    // 4) upload_at 은 받지 않음 → processSensorReading에서 NOW()로 기록
    delete it.upload_at;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const summary = {
      inserted: 0,
      alarms_created: 0,
      auto_reset: 0,
      cooldown_skip: 0,
      skipped: 0,
      effects: [],
    };

    for (const it of payload) {
      // 🔥 이제 it 안에:
      // - sensor_id
      // - sensor_type
      // - data_value
      // - is_alarm
      // - threshold_min / threshold_max
      // 가 모두 들어 있음
      const r = await processSensorReading(conn, it);

      summary.effects.push({ sensor_id: it.sensor_id, effect: r.effect, info: r });

      switch (r.effect) {
        case 'ALARM_CREATED':
          summary.alarms_created += 1;
          break;
        case 'ALARM_AUTORESET':
          summary.auto_reset += 1;
          break;
        case 'COOLDOWN_SKIP':
          summary.cooldown_skip += 1;
          break;
        case 'SKIP_NO_SENSOR':
        case 'SKIP_ALARM_OFF':
        case 'SKIP_NO_THRESHOLD':
          summary.skipped += 1;
          break;
        default:
          break;
      }

      summary.inserted += 1;
    }

    await conn.commit();
    return res.status(201).json({
      is_sucsess: true,
      message: '적재/알람 처리 완료',
      data: summary,
    });
  } catch (e) {
    await conn.rollback();
    return res.fail(500, 'INTERNAL_ERROR', e.message);
  } finally {
    conn.release();
  }
});

export default router;
