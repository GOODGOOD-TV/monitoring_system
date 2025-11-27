// sensors.js — 구역(zone)별 센서 mock 데이터
import { api } from "../lib/api.js";
  
  // 구역별 센서 조회 함수
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
  
  // 단일 센서 조회
  export async function getSensor(sensorId) {
    return SENSORS.find((s) => s.id === sensorId) ?? null;
  }

  /* 특정 구역에 센서 생성 */
  export async function createSensorInZone(zoneId, { model, sensor_type, is_alarm, threshold_min, threshold_max }) {
    const body = {
      area_id: Number(zoneId),
      sensor_type,
      model,
      is_active: true,
      is_alarm: Boolean(is_alarm),
      threshold_min: threshold_min,  
      threshold_max: threshold_max, 
      pos_x: 10.5,
      pos_y: 20.0,
    };

    const json = await api("/api/v1/sensors", {
      method: "POST",
      body,
    });

    if (!json?.is_sucsess) {
      throw new Error(json?.message || "센서 생성 실패");
    }

    return json.data;
  }
  
  // 센서 수정
  export async function updateSensor(sensorId, patch) {
    SENSORS = SENSORS.map((s) => (s.id === sensorId ? { ...s, ...patch } : s));
    return getSensor(sensorId);
  }
  
  // 센서 삭제
  export async function deleteSensor(sensorId) {
    SENSORS = SENSORS.filter((s) => s.id !== sensorId);
    return true;
  }
  