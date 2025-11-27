// sensors.js — 구역(zone)별 센서 mock 데이터
import { api } from "../lib/api.js";
  
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
    if (!zoneId) return [];

    const qs = new URLSearchParams({
      area_id: String(zoneId),
      page: "1",
      size: "200",
      sort: "created_at DESC",
    });

    const json = await api(`/api/v1/sensors?${qs.toString()}`);

    if (!json?.is_sucsess) {
      throw new Error(json?.message || "센서 목록 조회 실패");
    }

    // 그대로 쓰든, 필요하면 매핑해서 쓰든 선택
    return Array.isArray(json.data) ? json.data : [];
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
  