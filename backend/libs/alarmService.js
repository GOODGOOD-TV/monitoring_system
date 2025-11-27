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
  // 값 검증
  const v = Number(data_value);
  if (!Number.isFinite(v)) return { effect: 'SKIP_INVALID_VALUE' };

  // RAW INSERT
  await conn.query(
    `
    INSERT IGNORE INTO sensor_data
      (sensor_id, sensor_type, upload_at, data_no, data_value, data_sum, data_num)
    VALUES
      (:sensor_id, :sensor_type, ${nowUtcSql()}, :data_no, :data_value, :data_sum, :data_num)
    `,
    { sensor_id, sensor_type, data_no, data_value: v, data_sum, data_num }
  );

  // timestamp
  const [[{ ts: at_ts }]] = await conn.query(`SELECT ${nowUtcSql()} AS ts`);

  // 센서 정보 + threshold
  const [[sensor]] = await conn.query(
    `
    SELECT id, company_id, sensor_type, is_alarm, threshold_min, threshold_max
      FROM sensor
     WHERE id = :sensor_id
       AND deleted_at IS NULL
    `,
    { sensor_id }
  );
  if (!sensor) return { effect: 'SKIP_NO_SENSOR' };
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

    // 새 알람 생성
    const threshold_ref = JSON.stringify({ lower, upper });
    const [ar] = await conn.query(
      `
      INSERT INTO alarm (sensor_id, message, value, threshold_ref, created_at)
      VALUES (:sid, :msg, :val, :ref, ${nowUtcSql()})
      `,
      {
        sid: sensor_id,
        msg: direction,
        val: v,
        ref: threshold_ref
      }
    );
    const alarm_id = ar.insertId;

    // 알림 규칙 조회 후 PENDING 추가
    const [rules] = await conn.query(
      `
      SELECT channel, target_id
        FROM notification_rules
       WHERE company_id = :cid
         AND (sensor_type IS NULL OR sensor_type = :stype)
      `,
      { cid: sensor.company_id, stype: sensor.sensor_type }
    );

    if (rules.length > 0) {
      const text = `${sensor.sensor_type.toUpperCase()} ${direction} @ Sensor#${sensor_id} : ${v}`;
      const payload = JSON.stringify({ text, sensor_id, value: v, direction, at: at_ts });

      for (const r of rules) {
        await conn.query(
          `
          INSERT INTO notifications
            (alarm_id, channel, target_id, status, message, payload, created_at)
          VALUES
            (:alarm_id, :channel, :target_id, 'PENDING', :message, :payload, ${nowUtcSql()})
          `,
          {
            alarm_id,
            channel: r.channel,
            target_id: r.target_id,
            message: text,
            payload
          }
        );
      }
    }

    return { effect: 'ALARM_CREATED', alarm_id, direction };
  }

  // 정상값 → 자동 해제 기능 제거
  return { effect: 'NORMAL' };
}
