// backend/replay.js
import 'dotenv/config';
import { pool } from './libs/db.js';
import { processSensorReading } from './libs/alarmService.js';

// ----------------------------
// 설정 부분
// ----------------------------
const SENSOR_ID = 5;                  // SEN5
const SENSOR_TYPE = 'temperature';    // 필요하면 'humidity' 등으로 변경
const SPEED = 1;                     // 초당 몇 개 넣을지 (네가 조절)
// ----------------------------

async function main() {
  // test.sen_sensor_minute에서 데이터 읽기
  const [rows] = await pool.query(`
    SELECT data_value
    FROM test.sen_sensor_minute
    WHERE sensor_code = '14c5ecfa12f4'
      AND data_no = 1
    ORDER BY upload_dtm ASC
    /* 필요하면 LIMIT 10000 같은 거 걸어서 테스트해도 됨 */
  `);

  console.log('총 데이터 개수:', rows.length);

  const delay = 1000 / SPEED;

  let okCount = 0;
  let failCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const v = Number(rows[i].data_value);
    if (!Number.isFinite(v)) {
      console.log(`[${i + 1}] 값이 숫자가 아니라서 스킵`, rows[i].data_value);
      continue;
    }

    try {
      // HTTP 안 타고, 알람 로직 포함한 ingest 함수 직접 호출
      const result = await processSensorReading(pool, {
        sensor_id: SENSOR_ID,
        sensor_type: SENSOR_TYPE,
        data_no: 1,
        data_value: v,
        data_sum: null,
        data_num: null,
      });

      okCount++;
      if (i % 1 === 0) {
        console.log(
          `[${i + 1}/${rows.length}] value=${v}, effect=${result.effect}`
        );
      }
    } catch (err) {
      failCount++;
      console.error(
        `[${i + 1}/${rows.length}] 처리 실패 value=${v}:`,
        err.message || err
      );
      // 중간에 멈추고 싶으면 break; 걸고,
      // 계속 가고 싶으면 그냥 두면 됨
    }

    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  console.log('=== 완료 ===');
  console.log('성공 건수:', okCount);
  console.log('실패 건수:', failCount);

  process.exit(0);
}

main();
