import { pool } from './db.js';

const AUTO_RESOLVE_N = +(process.env.AUTO_RESOLVE_N ?? 3);
const ALARM_COOLDOWN_SEC = +(process.env.ALARM_COOLDOWN_SEC ?? 60);

function nowUtcSql() { return 'UTC_TIMESTAMP()'; }

/**
 * 서버는 upload_at을 받지 않는다.
 * 반드시 { sensor_id, sensor_type, data_value, data_no?, data_sum?, data_num? }를 넘겨라.
 * sensor_type은 라우터에서 없으면 sensor 테이블에서 보정하여 내려보내도록 했다.
 */
export async function processSensorReading(
  conn,
  { sensor_id, sensor_type, data_no = 1, data_value, data_sum = null, data_num = null }
) {
  // 0) 기본 방어
  const v = Number(data_value);
  if (!Number.isFinite(v)) return { effect: 'SKIP_INVALID_VALUE' };

  // 1) RAW INSERT (upload_at은 서버 시각)
  await conn.query(
    `
    INSERT IGNORE INTO sensor_data
      (sensor_id, sensor_type, upload_at, data_no, data_value, data_sum, data_num)
    VALUES
      (:sensor_id, :sensor_type, ${nowUtcSql()}, :data_no, :data_value, :data_sum, :data_num)
    `,
    { sensor_id, sensor_type, data_no, data_value: v, data_sum, data_num }
  );

  // 1-1) 방금 기록한 시각을 payload 용도로 가져옴
  const [[{ ts: at_ts }]] = await conn.query(`SELECT ${nowUtcSql()} AS ts`);

  // 2) 센서/임계값/회사 조회
  const [[sensor]] = await conn.query(
    `
    SELECT s.id, s.company_id, s.sensor_type, s.is_alarm
      FROM sensor s
     WHERE s.id=:sensor_id AND s.deleted_at IS NULL
    `,
    { sensor_id }
  );
  if (!sensor) return { effect: 'SKIP_NO_SENSOR' };
  if (!sensor.is_alarm) return { effect: 'SKIP_ALARM_OFF' };

  const [[th]] = await conn.query(
    `SELECT lower_bound, upper_bound FROM threshold WHERE sensor_id=:sensor_id`,
    { sensor_id }
  );
  if (!th) return { effect: 'SKIP_NO_THRESHOLD' };

  // 3) 경계 비교
  const isHigh = v > th.upper_bound;
  const isLow  = v < th.lower_bound;
  const isNormal = !isHigh && !isLow;

  // 상태 로우 준비
  await conn.query(
    `INSERT IGNORE INTO sensor_state (sensor_id, normal_streak) VALUES (:sensor_id, 0)`,
    { sensor_id }
  );

  // 최근 미해제 알람
  const [[openAlarm]] = await conn.query(
    `
    SELECT a.id, a.message, a.created_at
      FROM alarm a
     WHERE a.sensor_id = :sensor_id AND a.resolved_at IS NULL
     ORDER BY a.id DESC LIMIT 1
    `,
    { sensor_id }
  );

  // 4) 알람 생성 + 쿨다운
  if (isHigh || isLow) {
    const direction = isHigh ? 'HIGH' : 'LOW';

    if (openAlarm && openAlarm.message === direction) {
      const [[{ recent }]] = await conn.query(
        `SELECT TIMESTAMPDIFF(SECOND, a.created_at, ${nowUtcSql()}) recent FROM alarm a WHERE a.id=:id`,
        { id: openAlarm.id }
      );
      if (recent < ALARM_COOLDOWN_SEC) {
        await conn.query(
          `UPDATE sensor_state SET normal_streak=0, last_value=:v, updated_at=${nowUtcSql()} WHERE sensor_id=:sensor_id`,
          { sensor_id, v }
        );
        return { effect: 'COOLDOWN_SKIP', recent };
      }
    }

    // 알람 INSERT
    const threshold_ref = JSON.stringify({ lower: th.lower_bound, upper: th.upper_bound });
    const [ar] = await conn.query(
      `
      INSERT INTO alarm (sensor_id, message, value, threshold_ref, created_at)
      VALUES (:sensor_id, :msg, :val, :ref, ${nowUtcSql()})
      `,
      { sensor_id, msg: direction, val: v, ref: threshold_ref }
    );
    const alarm_id = ar.insertId;

    // 상태 리셋
    await conn.query(
      `UPDATE sensor_state SET normal_streak=0, last_alarm_id=:aid, last_value=:v, updated_at=${nowUtcSql()} WHERE sensor_id=:sensor_id`,
      { sensor_id, aid: alarm_id, v }
    );

    // 알림 라우팅 → notifications PENDING 생성
    const [rules] = await conn.query(
      `
      SELECT channel, target_id
        FROM notification_rules
       WHERE company_id=:company_id
         AND (sensor_type IS NULL OR sensor_type=:stype)
      `,
      { company_id: sensor.company_id, stype: sensor.sensor_type }
    );

    if (rules.length) {
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
          { alarm_id, channel: r.channel, target_id: r.target_id, message: text, payload }
        );
      }
    }

    return { effect: 'ALARM_CREATED', alarm_id, direction };
  }

  // 5) 정상값: 카운트 증가 & 자동 해제
  if (isNormal) {
    await conn.query(
      `
      UPDATE sensor_state
         SET normal_streak = normal_streak + 1,
             last_value    = :v,
             updated_at    = ${nowUtcSql()}
       WHERE sensor_id     = :sensor_id
      `,
      { sensor_id, v }
    );

    if (openAlarm) {
      const [[st]] = await conn.query(
        `SELECT normal_streak FROM sensor_state WHERE sensor_id=:sensor_id`,
        { sensor_id }
      );
      if ((st?.normal_streak ?? 0) >= AUTO_RESOLVE_N) {
        await conn.query(
          `UPDATE alarm SET resolved_at=${nowUtcSql()}, resolved_by=NULL WHERE id=:id AND resolved_at IS NULL`,
          { id: openAlarm.id }
        );
        return { effect: 'ALARM_AUTORESET', alarm_id: openAlarm.id };
      }
    }
    return { effect: 'NORMAL_STREAK' };
  }

  return { effect: 'NOOP' };
}
