import { pool } from './db.js';

const ALARM_COOLDOWN_SEC = +(process.env.ALARM_COOLDOWN_SEC ?? 60);
function nowUtcSql() { return 'UTC_TIMESTAMP()'; }

/**
 * sensor_state 없이 동작하는 버전
 * - 자동 해제(normal_streak) 기능 제거
 * - last_value 저장 제거
 */
export async function processSensorReading(
  conn,
  { sensor_id, sensor_type, data_no = 1, data_value, data_sum = null, data_num = null }
) {
  // 1) 값 검증
  const v = Number(data_value);
  if (!Number.isFinite(v)) return { effect: 'SKIP_INVALID_VALUE' };

  // 2) 센서 정보 + company_id + threshold 먼저 조회
  const [[sensor]] = await conn.query(
    `
    SELECT id,
           company_id,
           sensor_type,
           is_alarm,
           threshold_min,
           threshold_max
      FROM sensor
     WHERE id = :sensor_id
       AND deleted_at IS NULL
    `,
    { sensor_id }
  );

  if (!sensor) return { effect: 'SKIP_NO_SENSOR' };

  // 요청에 들어온 sensor_type 우선, 없으면 DB 값 사용
  const finalType = (sensor_type ?? sensor.sensor_type ?? '').toString().toLowerCase();
  if (!['humidity', 'temperature'].includes(finalType)) {
    return { effect: 'SKIP_INVALID_TYPE' };
  }

  // 3) RAW INSERT (✅ company_id 포함)
  await conn.query(
    `
    INSERT IGNORE INTO sensor_data
      (sensor_id, sensor_type, upload_at, data_no, data_value, data_sum, data_num)
    VALUES
      (:sensor_id, :sensor_type, ${nowUtcSql()}, :data_no, :data_value, :data_sum, :data_num)
    `,
    {
      sensor_id,
      sensor_type: finalType,
      data_no,
      data_value: v,
      data_sum,
      data_num,
    }
  );

  // 4) timestamp
  const [[{ ts: at_ts }]] = await conn.query(`SELECT ${nowUtcSql()} AS ts`);

  // 5) 알람 설정/임계값 사용
  if (!sensor.is_alarm) return { effect: 'SKIP_ALARM_OFF' };

  const lower = sensor.threshold_min;
  const upper = sensor.threshold_max;

  if (lower == null && upper == null) {
    return { effect: 'SKIP_NO_THRESHOLD' };
  }

  // threshold 비교
  const isHigh = upper != null && v > upper;
  const isLow  = lower != null && v < lower;
  const isNormal = !isHigh && !isLow;

  // 이미 열린 알람
  const [[openAlarm]] = await conn.query(
    `
    SELECT id, message, created_at
      FROM alarm
     WHERE sensor_id = :sensor_id
       AND resolved_at IS NULL
     ORDER BY id DESC
     LIMIT 1
    `,
    { sensor_id }
  );

  // HIGH/LOW 인 경우 → 알람 생성 or 쿨다운 무시
  if (isHigh || isLow) {
    const direction = isHigh ? 'HIGH' : 'LOW';

    // 동일 종류 알람 쿨다운 체크
    if (openAlarm && openAlarm.message === direction) {
      const [[{ recent }]] = await conn.query(
        `
        SELECT TIMESTAMPDIFF(SECOND, a.created_at, ${nowUtcSql()}) AS recent
          FROM alarm a
         WHERE a.id = :id
        `,
        { id: openAlarm.id }
      );

      if (recent < ALARM_COOLDOWN_SEC) {
        return { effect: 'COOLDOWN_SKIP', recent };
      }
    }

    // 새 알람 생성 (여기서도 company_id 컬럼이 있다면 같이 넣어야 함)
    const threshold_ref = JSON.stringify({ lower, upper });
    const [ar] = await conn.query(
      `
      INSERT INTO alarm
        (company_id, sensor_id, message, value, threshold_ref, created_at)
      VALUES
        (:cid, :sid, :msg, :val, :ref, ${nowUtcSql()})
      `,
      {
        cid: sensor.company_id,
        sid: sensor_id,
        msg: direction,
        val: v,
        ref: threshold_ref,
      }
    );
    const alarm_id = ar.insertId;

    return { effect: 'ALARM_CREATED', alarm_id, direction };
  }

  // 정상값 → 자동 해제 기능 제거
  return { effect: 'NORMAL' };
}
