// sensors.js — 구역(zone)별 센서 mock 데이터

let SENSORS = [
    {
      id: "s-a003-01",
      zoneId: "A003",
      name: "무연-1",
      status: "정상",
      temp: 4.2,
      hum: 52,
      tempLow: 2,
      tempHigh: 8,
      humLow: 40,
      humHigh: 65,
    },
    {
      id: "s-a021-01",
      zoneId: "A021",
      name: "sp1-1",
      status: "정상",
      temp: 25.0,
      hum: 58.0,
      tempLow: 20,
      tempHigh: 28,
      humLow: 40,
      humHigh: 65,
    },
    {
      id: "s-a024-01",
      zoneId: "A024",
      name: "sp8-1",
      status: "주의",
      temp: 22.0,
      hum: 65.0,
      tempLow: 20,
      tempHigh: 26,
      humLow: 40,
      humHigh: 60,
    },
    {
      id: "s-a031-01",
      zoneId: "A031",
      name: "SP9-1",
      status: "정상",
      temp: 24.0,
      hum: 55.0,
      tempLow: 21,
      tempHigh: 27,
      humLow: 35,
      humHigh: 60,
    },
  ];
  
  // ✅ 랜덤 센서 생성 함수 (존재하지 않는 zone 클릭 시 사용)
  function generateRandomSensors(zoneId) {
    const count = Math.random() > 0.5 ? 1 : 2; // 1~2개
    const list = [];
    for (let i = 1; i <= count; i++) {
      const temp = +(20 + Math.random() * 8).toFixed(1); // 20~28°C
      const hum = +(45 + Math.random() * 20).toFixed(1); // 45~65%
      list.push({
        id: `s-${zoneId.toLowerCase()}-${i.toString().padStart(2, "0")}`,
        zoneId,
        name: `Auto-${zoneId}-${i}`,
        status: "정상",
        temp,
        hum,
        tempLow: 20,
        tempHigh: 28,
        humLow: 40,
        humHigh: 65,
      });
    }
    return list;
  }
  
  // ✅ zone별 센서 조회 함수
  export async function getSensorsByZone(zoneId) {
    let found = SENSORS.filter((s) => s.zoneId === zoneId);
  
    // 센서가 없으면 자동 생성
    if (found.length === 0) {
      const generated = generateRandomSensors(zoneId);
      SENSORS = SENSORS.concat(generated);
      found = generated;
    }
  
    return found;
  }
  
  // ✅ 단일 센서 조회
  export async function getSensor(sensorId) {
    return SENSORS.find((s) => s.id === sensorId) ?? null;
  }
  
  // ✅ 센서 수정
  export async function updateSensor(sensorId, patch) {
    SENSORS = SENSORS.map((s) => (s.id === sensorId ? { ...s, ...patch } : s));
    return getSensor(sensorId);
  }
  
  // ✅ 센서 삭제
  export async function deleteSensor(sensorId) {
    SENSORS = SENSORS.filter((s) => s.id !== sensorId);
    return true;
  }
  