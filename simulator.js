const mysql = require("mysql2/promise");
const fetch = require("node-fetch");

async function runSimulator() {
  const pool = await mysql.createPool({
    host: "localhost",
    user: "root",
    password: "poiu1234",
    database: "test"
  });

  // 전체 데이터의 distinct 타임스탬프 가져오기
  const [timestamps] = await pool.query(`
    SELECT DISTINCT upload_dtm
    FROM sen_sensor_minute
    ORDER BY upload_dtm ASC
  `);

  console.log(`총 ${timestamps.length} 타임스탬프 로드됨.`);

  let index = 0;

  setInterval(async () => {
    if (index >= timestamps.length) {
      console.log("✅ 모든 데이터 전송 완료");
      process.exit(0);
    }

    const ts = timestamps[index++].upload_dtm;

    // 해당 타임스탬프의 모든 센서 데이터 가져오기
    const [rows] = await pool.query(
      "SELECT * FROM sen_sensor_minute WHERE upload_dtm = ? ORDER BY sensor_code, data_no",
      [ts]
    );

    // 센서별로 그룹화
    const sensors = {};
    rows.forEach(r => {
      if (!sensors[r.sensor_code]) {
        sensors[r.sensor_code] = {
          company_code: r.company_code,
          sensor_code: r.sensor_code,
          values: []
        };
      }
      sensors[r.sensor_code].values.push({
        type: r.sensor_type,
        value: r.data_value
      });
    });

    const payload = {
      timestamp: ts,
      sensors: Object.values(sensors)
    };

    try {
      const res = await fetch("http://localhost:3000/sensors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      console.log(`👉 전송: ${ts}, 상태: ${res.status}`);
    } catch (err) {
      console.error("❌ 전송 실패:", err.message);
    }
  }, 1000); // 1초마다 1분치 전송
}

runSimulator();
