// backend/services/notificationService.js
import { pool } from "../libs/db.js";
import { snsClient, sesClient } from "../libs/aws.js";
import { PublishCommand } from "@aws-sdk/client-sns";
import { SendEmailCommand } from "@aws-sdk/client-ses";

function nowUtcSql() {
  return "UTC_TIMESTAMP()";
}

/** 알림 메시지 기본 포맷 생성 */
function buildDefaultMessage(row) {
  const dir =
    row.alarm_message === "HIGH" ? "상한 초과" :
    row.alarm_message === "LOW" ? "하한 미만" :
    row.alarm_message ?? "";

  let thresholdStr = "";
  try {
    if (row.threshold_ref) {
      const ref = JSON.parse(row.threshold_ref);
      if (ref.lower != null || ref.upper != null) {
        thresholdStr = ` (임계값: ${ref.lower ?? "-"} ~ ${ref.upper ?? "-"})`;
      }
    }
  } catch (_) {}

  return `[Sentory] ${row.company_name ?? ""} ${row.sensor_name ?? ""} ${dir}
현재 값: ${row.alarm_value ?? ""}${row.sensor_unit ?? ""}
${thresholdStr}`.trim();
}

/** SNS로 SMS 전송 */
async function sendSms({ phoneNumber, message }) {
  if (!phoneNumber) {
    return { ok: false, reason: "NO_PHONE" };
  }

  const cmd = new PublishCommand({
    PhoneNumber: phoneNumber, // "+8210..." 형식
    Message: message,
  });

  const res = await snsClient.send(cmd);
  return { ok: true, id: res.MessageId };
}

/** SES로 이메일 전송 */
async function sendEmail({ to, subject, text }) {
  if (!to) {
    return { ok: false, reason: "NO_EMAIL" };
  }

  const cmd = new SendEmailCommand({
    Source: process.env.ALERT_EMAIL_FROM,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject, Charset: "UTF-8" },
      Body: {
        Text: { Data: text, Charset: "UTF-8" },
      },
    },
  });

  const res = await sesClient.send(cmd);
  return { ok: true, id: res.MessageId };
}

/**
 * notification 1건을 실제로 발송하고
 * status / sent_at / payload 를 업데이트
 */
export async function dispatchNotificationById(id) {
  // 1) notification + user + alarm + sensor + company 정보 조회
  const [rows] = await pool.query(
    `
    SELECT
      nt.id,
      nt.company_id,
      nt.alarm_id,
      nt.channel,
      nt.target_id,
      nt.status,
      nt.message       AS nt_message,
      nt.payload       AS nt_payload,

      u.email          AS user_email,
      u.phone          AS user_phone,

      a.message        AS alarm_message,
      a.value          AS alarm_value,
      a.threshold_ref,

      s.name           AS sensor_name,
      s.unit           AS sensor_unit,

      c.name           AS company_name
    FROM notification nt
    JOIN users u   ON u.id = nt.target_id
    JOIN alarm a   ON a.id = nt.alarm_id
    JOIN sensor s  ON s.id = a.sensor_id
    JOIN company c ON c.id = s.company_id
    WHERE nt.id = :id
    LIMIT 1
    `,
    { id }
  );

  if (!rows.length) {
    return { ok: false, reason: "NOT_FOUND" };
  }

  const row = rows[0];

  if (row.status === "SENT") {
    return { ok: false, reason: "ALREADY_SENT" };
  }

  const msg = row.nt_message || buildDefaultMessage(row);

  let result = { ok: false, reason: "UNKNOWN_CHANNEL" };
  let payloadObj = {};

  try {
    if (row.channel.toLowerCase() === "sms") {
      result = await sendSms({
        phoneNumber: row.user_phone, // DB에 "+8210..." 형식으로 넣어두는 게 좋다
        message: msg,
      });
    } else if (row.channel.toLowerCase() === "email") {
      result = await sendEmail({
        to: row.user_email,
        subject: "[Sentory] 센서 임계값 이탈 알림",
        text: msg,
      });
    } else {
      result = { ok: false, reason: "UNSUPPORTED_CHANNEL" };
    }

    payloadObj = {
      ok: result.ok,
      reason: result.reason ?? null,
      external_id: result.id ?? null,
    };
  } catch (err) {
    console.error("[notificationService] dispatch error:", err);
    result = { ok: false, reason: "EXCEPTION" };
    payloadObj = {
      ok: false,
      reason: "EXCEPTION",
      error: String(err),
    };
  }

  const newStatus = result.ok ? "SENT" : "FAILED";

  await pool.query(
    `
    UPDATE notification
       SET status  = :status,
           sent_at = ${nowUtcSql()},
           payload = :payload
     WHERE id = :id
    `,
    {
      id,
      status: newStatus,
      payload: JSON.stringify(payloadObj),
    }
  );

  return { ok: result.ok, status: newStatus };
}

/**
 * 알람 발생 시: 같은 회사 유저들에게
 * EMAIL / SMS 알림을 PENDING 상태로 생성만 한다.
 * (발송은 별도 API에서 dispatchNotificationById 로 수행)
 */
export async function createAndDispatchForAlarm(conn, alarm_id, company_id) {
  console.log("[notificationService] alarm -> create notifications:", alarm_id, company_id);

  const [targets] = await conn.query(
    `
    SELECT id, email, phone
      FROM users
     WHERE company_id = :company_id
       AND deleted_at IS NULL
       AND is_active = 1
    `,
    { company_id }
  );

  if (!targets.length) {
    return { created: 0, dispatched: 0 };
  }

  let created = 0;

  for (const u of targets) {
    if (u.email) {
      await conn.query(
        `
        INSERT INTO notification
          (company_id, alarm_id, channel, target_id, status, message, payload)
        VALUES
          (:company_id, :alarm_id, 'email', :uid, 'PENDING', NULL, NULL)
        `,
        { company_id, alarm_id, uid: u.id }
      );
      created++;
    }

    if (u.phone) {
      await conn.query(
        `
        INSERT INTO notification
          (company_id, alarm_id, channel, target_id, status, message, payload)
        VALUES
          (:company_id, :alarm_id, 'sms', :uid, 'PENDING', NULL, NULL)
        `,
        { company_id, alarm_id, uid: u.id }
      );
      created++;
    }
  }

  return { created, dispatched: 0 };
}
