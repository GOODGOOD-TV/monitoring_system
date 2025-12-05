// backend/services/notificationService.js
import { pool } from "../libs/db.js";
import { snsClient, sesClient } from "../libs/aws.js";
import { PublishCommand } from "@aws-sdk/client-sns";
import { SendEmailCommand } from "@aws-sdk/client-ses";

const ALERT_EMAIL_FROM = process.env.ALERT_EMAIL_FROM;

// alarm + sensor 정보로 채널별 문구 생성
function buildAlarmMessages(alarm, sensor) {
  const dir = alarm.message; // 'HIGH' or 'LOW'
  const isTemp = sensor.sensor_type === "temperature";

  const typeLabel = isTemp ? "온도" : "습도";
  const dirLabel = dir === "HIGH" ? "상한 초과" : "하한 미만";

  // threshold_ref 는 { lower, upper } JSON
  let lower = null, upper = null;
  try {
    const t = alarm.threshold_ref ? JSON.parse(alarm.threshold_ref) : {};
    lower = t.lower ?? null;
    upper = t.upper ?? null;
  } catch (_) {}

  const value = alarm.value;
  const valueStr = value != null ? value.toFixed(1) : "?";

  let thresholdPart = "";
  if (dir === "HIGH" && upper != null) {
    thresholdPart = ` (임계값 ${upper})`;
  } else if (dir === "LOW" && lower != null) {
    thresholdPart = ` (임계값 ${lower})`;
  }

  const areaName   = sensor.area_name ?? "";
  const sensorName = sensor.name ?? `SEN${sensor.id}`;
  const placePart =
    areaName && sensorName
      ? `${areaName} - ${sensorName}`
      : sensorName;

  const timeStr = alarm.created_at
    ? new Date(alarm.created_at).toISOString().replace("T", " ").slice(0, 16)
    : "";

  // SMS 본문 (짧고 한 줄)
  const smsMsg =
    `[Sentory] ${placePart} ${typeLabel} ${dirLabel}: ` +
    `${valueStr}${isTemp ? "℃" : "%"}${thresholdPart}`;

  // 이메일 제목 / 본문
  const emailSubject = `[Sentory 경고] ${placePart} ${typeLabel} ${dirLabel}`;

  const emailBodyLines = [
    `${placePart} 센서에서 ${typeLabel} ${dirLabel} 알람이 발생했습니다.`,
    ``,
    `현재 값: ${valueStr}${isTemp ? "℃" : "%"}`,
    dir === "HIGH" && upper != null ? `상한 임계값: ${upper}` : "",
    dir === "LOW"  && lower != null ? `하한 임계값: ${lower}` : "",
    timeStr ? `발생 시각: ${timeStr} (UTC)` : "",
  ].filter(Boolean);

  const emailBody = emailBodyLines.join("\n");

  return { smsMsg, emailSubject, emailBody };
}

// 디버그용 로그 함수
function log(...args) {
  console.log("[notificationService]", ...args);
}

/**
 * notification.id 1개에 대해 실제 이메일/SMS 전송
 */
export async function dispatchNotificationById(id, extConn = null) {
  // extConn 이 있으면 그걸 쓰고, 없으면 pool에서 새로 빌림
  const ownConn = !extConn;
  const conn = extConn ?? (await pool.getConnection());
  log("dispatchNotificationById START id=", id);

  try {
    const [rows] = await conn.query(
      `
      SELECT nt.id, nt.company_id, nt.alarm_id, nt.channel, nt.target_id,
             nt.status, nt.message, nt.payload,
             u.email, u.phone
        FROM notification nt
        JOIN users u ON u.id = nt.target_id
       WHERE nt.id = :id
      `,
      { id }
    );

    if (!rows.length) {
      log("dispatchNotificationById NOT_FOUND", id);
      return { ok: false, reason: "NOT_FOUND" };
    }

    const nt = rows[0];

    if (nt.status === "SENT") {
      log("dispatchNotificationById ALREADY_SENT", id);
      return { ok: true, reason: "ALREADY_SENT" };
    }

    const payload = nt.payload ? JSON.parse(nt.payload) : null;
    let resultPayload = null;

    if (nt.channel === "sms") {
      if (!nt.phone) throw new Error("NO_PHONE_ON_USER");

      // E.164 포맷으로 정제 (+와 숫자만)
      const phoneE164 = nt.phone.replace(/[^+\d]/g, "");
      const cmd = new PublishCommand({
        PhoneNumber: phoneE164,
        Message: nt.message ?? `Alarm #${nt.alarm_id} (company ${nt.company_id})`,
        MessageAttributes: {
          "AWS.SNS.SMS.SMSType": {
            DataType: "String",
            StringValue: "Transactional",
          },
        },
      });
      const res = await snsClient.send(cmd);
      resultPayload = { ok: true, type: "sms", res };
      log("SMS sent", id, phoneE164, res.MessageId);
    } else if (nt.channel === "email") {
      if (!ALERT_EMAIL_FROM) throw new Error("ALERT_EMAIL_FROM_NOT_SET");
      if (!nt.email) throw new Error("NO_EMAIL_ON_USER");

      const bodyText =
        payload && payload.body
          ? payload.body
          : nt.message ?? `Alarm #${nt.alarm_id} for company ${nt.company_id}`;

      const cmd = new SendEmailCommand({
        Destination: { ToAddresses: [nt.email] },
        Message: {
          Subject: {
            Data: nt.message ?? `Alarm #${nt.alarm_id}`,
            Charset: "UTF-8",
          },
          Body: {
            Text: {
              Data: bodyText,
              Charset: "UTF-8",
            },
          },
        },
        Source: ALERT_EMAIL_FROM,
      });
      const res = await sesClient.send(cmd);
      resultPayload = { ok: true, type: "email", res };
      log("EMAIL sent", id, res.MessageId);
    } else {
      throw new Error(`UNKNOWN_CHANNEL:${nt.channel}`);
    }

    await conn.query(
      `
      UPDATE notification
         SET status = 'SENT',
             sent_at = UTC_TIMESTAMP(),
             payload = :payload
       WHERE id = :id
      `,
      { id, payload: JSON.stringify(resultPayload) }
    );

    log("dispatchNotificationById DONE id=", id);
    return { ok: true };
  } catch (err) {
    log("dispatchNotificationById ERROR", id, err);

    await conn.query(
      `
      UPDATE notification
         SET status = 'FAILED',
             sent_at = UTC_TIMESTAMP(),
             payload = :payload
       WHERE id = :id
      `,
      {
        id,
        payload: JSON.stringify({
          ok: false,
          error: String(err?.message ?? err),
        }),
      }
    );

    return { ok: false, error: err };
  } finally {
    if (ownConn) conn.release(); // 내가 빌린 커넥션만 release
  }
}

/**
 * 새 alarm에 대해 회사 유저 전체에게 email+sms notification 생성 후 곧바로 전송
 */
export async function createAndDispatchForAlarm(conn, alarm_id, company_id) {
  log("createAndDispatchForAlarm START", { alarm_id, company_id });

  // 1) 회사 유저
  const [users] = await conn.query(
    `
    SELECT id, email, phone
      FROM users
     WHERE company_id = :cid
       AND is_active = 1
       AND deleted_at IS NULL
    `,
    { cid: company_id }
  );
  if (!users.length) {
    log("no active users for company", company_id);
    return { created: 0, dispatched: 0 };
  }

  // 2) 알람 + 센서 정보
  const [rows] = await conn.query(
    `
    SELECT 
        id,
        message,
        value,
        threshold_ref,
        created_at,
        sensor_id,
        sensor_type
      FROM alarm
    WHERE id = :id
    `,
    { id: alarm_id }
  );

  if (!rows.length) {
    log("alarm not found", alarm_id);
    return { created: 0, dispatched: 0 };
  }

  const alarm = rows[0];

  // sensor 테이블/area 테이블 안 쓰고 최소 정보만 구성
  const sensor = {
    id: alarm.sensor_id,
    sensor_type: alarm.sensor_type,
    name: null,        // 이름 컬럼 없으니 null
    area_name: null,   // area 도 현재 안 씀
  };


  // 3) 채널별 문구 생성
  const { smsMsg, emailSubject, emailBody } = buildAlarmMessages(alarm, sensor);

  const notiIds = [];

  // 4) notification row 생성
  for (const u of users) {
    if (u.email) {
      const [r1] = await conn.query(
        `
        INSERT INTO notification
          (company_id, alarm_id, channel, target_id, status, message, payload)
        VALUES
          (:cid, :aid, 'email', :uid, 'PENDING', :msg, :payload)
        `,
        {
          cid: company_id,
          aid: alarm_id,
          uid: u.id,
          msg: emailSubject,
          payload: JSON.stringify({ body: emailBody }),
        }
      );
      notiIds.push(r1.insertId);
    }

    if (u.phone) {
      const [r2] = await conn.query(
        `
        INSERT INTO notification
          (company_id, alarm_id, channel, target_id, status, message)
        VALUES
          (:cid, :aid, 'sms', :uid, 'PENDING', :msg)
        `,
        {
          cid: company_id,
          aid: alarm_id,
          uid: u.id,
          msg: smsMsg,
        }
      );
      notiIds.push(r2.insertId);
    }
  }

  log("notifications created", notiIds);

  // 5) 실제 발송 (같은 conn 넘겨서 사용)
  for (const nid of notiIds) {
    try {
      await dispatchNotificationById(nid, conn);
    } catch (e) {
      log("dispatch failed for", nid, e);
    }
  }

  log("createAndDispatchForAlarm DONE", { alarm_id, company_id });
  return { created: notiIds.length };
}
