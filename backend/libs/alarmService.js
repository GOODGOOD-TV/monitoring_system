import { pool } from './db.js';

const AUTO_RESOLVE_N = +(process.env.AUTO_RESOLVE_N ?? 3);     // 연속 N회 정상 → 자동 해제
const ALARM_COOLDOWN_SEC = +(process.env.ALARM_COOLDOWN_SEC ?? 60); // 생성 스팸 방지 쿨다운

function nowUtcSql() { return 'UTC_TIMESTAMP()'; }

export async function processSensorReading(conn, { sensor_id, upload_at, data_no = 1, data_value, data_sum = null, data_num = null }) {
  // 1) raw insert (PK 충돌 시 409로 튕기고 싶다면 IGNORE 대신 try/catch)
  await conn.query(
    `INSERT IGNORE INTO sensor_data (sensor_id, upload_at, data_no, data_value, data_sum, data_num)
     VALUES (:sensor_id, :upload_at, :data_no, :data_value, :data_sum, :data_num)`,
    { sensor_id, upload_at, data_no, data_value, data_sum, data_num }
  );

  // 2) 센서/임계값/회사 조회
  const [[sensor]] = await conn.query(
    `SELECT s.id, s.company_id, s.sensor_type, s.is_alarm
       FROM sensor s
      WHERE s.id=:sensor_id AND s.deleted_at IS NULL`,
    { sensor_id }
  );
  if (!sensor) return { effect: 'SKIP_NO_SENSOR' };
  if (!sensor.is_alarm) return { effect: 'SKIP_ALARM_OFF' };

  const [[th]] = await conn.query(`SELECT lower_bound, upper_bound FROM thresholds WHERE sensor_id=:sensor_id`, { sensor_id });
  if (!th) return { effect: 'SKIP_NO_THRESHOLD' };

  // 3) 경계 비교
  const v = Number(data_value);
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
    `SELECT a.id, a.message, a.created_at
       FROM alarms a
       WHERE a.sensor_id = :sensor_id AND a.resolved_at IS NULL
       ORDER BY a.id DESC LIMIT 1`,
    { sensor_id }
  );

  // 4) 알람 생성 조건 + 쿨다운
  if ((isHigh || isLow)) {
    const direction = isHigh ? 'HIGH' : 'LOW';

    // 쿨다운(같은 방향 알람이 막 생긴 경우 중복 방지)
    if (openAlarm) {
      if (openAlarm.message === direction) {
        const [[{ recent }]] = await conn.query(
          `SELECT TIMESTAMPDIFF(SECOND, a.created_at, ${nowUtcSql()}) recent
             FROM alarms a WHERE a.id=:id`, { id: openAlarm.id }
        );
        if (recent < ALARM_COOLDOWN_SEC) {
          // 상태 업데이트만 하고 종료
          await conn.query(
            `UPDATE sensor_state SET normal_streak=0, last_value=:v, updated_at=${nowUtcSql()} WHERE sensor_id=:sensor_id`,
            { sensor_id, v }
          );
          return { effect: 'COOLDOWN_SKIP', recent };
        }
      }
    }

    // 알람 INSERT
    const threshold_ref = JSON.stringify({ lower: th.lower_bound, upper: th.upper_bound });
    const [ar] = await conn.query(
      `INSERT INTO alarms (sensor_id, message, value, threshold_ref, created_at)
       VALUES (:sensor_id, :msg, :val, :ref, ${nowUtcSql()})`,
      { sensor_id, msg: direction, val: v, ref: threshold_ref }
    );
    const alarm_id = ar.insertId;

    // 상태 리셋
    await conn.query(
      `UPDATE sensor_state SET normal_streak=0, last_alarm_id=:aid, last_value=:v, updated_at=${nowUtcSql()} WHERE sensor_id=:sensor_id`,
      { sensor_id, aid: alarm_id, v }
    );

    // 알림 라우팅 룰 조회 → notifications PENDING 생성
    const [rules] = await conn.query(
      `SELECT channel, target_id
         FROM notification_rules
        WHERE company_id=:company_id
          AND (sensor_type IS NULL OR sensor_type=:stype)`,
      { company_id: sensor.company_id, stype: sensor.sensor_type }
    );

    if (rules.length) {
      const text = `${sensor.sensor_type.toUpperCase()} ${direction} @ Sensor#${sensor_id} : ${v}`;
      const payload = JSON.stringify({ text, sensor_id, value: v, direction, at: upload_at });
      for (const r of rules) {
        await conn.query(
          `INSERT INTO notifications (alarm_id, channel, target_id, status, message, payload, created_at)
           VALUES (:alarm_id, :channel, :target_id, 'PENDING', :message, :payload, ${nowUtcSql()})`,
          { alarm_id, channel: r.channel, target_id: r.target_id, message: text, payload }
        );
      }
    }

    return { effect: 'ALARM_CREATED', alarm_id, direction };
  }

  // 5) 정상값: 카운트 증가 & 자동 해제
  if (isNormal) {
    // streak +1
    const [u] = await conn.query(
      `UPDATE sensor_state
          SET normal_streak = normal_streak + 1,
              last_value    = :v,
              updated_at    = ${nowUtcSql()}
        WHERE sensor_id = :sensor_id`,
      { sensor_id, v }
    );

    // 미해제 알람이 있고, N회 연속 정상 → 가장 최근 미해제 알람 해제
    if (openAlarm) {
      const [[st]] = await conn.query(`SELECT normal_streak FROM sensor_state WHERE sensor_id=:sensor_id`, { sensor_id });
      if ((st?.normal_streak ?? 0) >= AUTO_RESOLVE_N) {
        await conn.query(
          `UPDATE alarms SET resolved_at=${nowUtcSql()}, resolved_by=NULL WHERE id=:id AND resolved_at IS NULL`,
          { id: openAlarm.id }
        );
        // streak 유지(혹은 0으로 리셋도 가능)
        return { effect: 'ALARM_AUTORESET', alarm_id: openAlarm.id };
      }
    }
    return { effect: 'NORMAL_STREAK' };
  }

  return { effect: 'NOOP' };
}
