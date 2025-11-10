import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getSensor, deleteSensor } from "../services/sensors";

export default function SensorDetailPage() {
  const { zoneId, sensorId } = useParams();
  const [sensor, setSensor] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => setSensor(await getSensor(sensorId)))();
  }, [sensorId]);

  if (!sensor) return <div style={{ padding: 16 }}>Loading...</div>;

  const handleDelete = async () => {
    if (window.confirm("이 센서를 삭제하시겠습니까?")) {
      await deleteSensor(sensorId);
      navigate(`/zones/${zoneId}`);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <button onClick={() => navigate(`/zones/${zoneId}`)} style={backBtn}>← 구역으로</button>

      <h1 style={{ fontSize: 20, fontWeight: 700, marginTop: 12 }}>{sensor.name}</h1>

      <div
        style={{
          display: "flex",
          background: "#f9fafb",
          border: "1px solid #d1d5db",
          borderRadius: 8,
          marginTop: 16,
          padding: 20,
        }}
      >
        <div style={{ flex: 1 }}>
          <p><strong>상태:</strong> {sensor.status}</p>
          <p><strong>현재 온도:</strong> {sensor.temp}°C</p>
          <p><strong>현재 습도:</strong> {sensor.hum}%</p>
          <p><strong>온도 임계값:</strong> {sensor.tempLow}°C ~ {sensor.tempHigh}°C</p>
          <p><strong>습도 임계값:</strong> {sensor.humLow}% ~ {sensor.humHigh}%</p>
        </div>
        <div style={{ flex: 1, textAlign: "right" }}>
          <button
            onClick={() => navigate(`/zones/${zoneId}/sensors/${sensorId}/edit`)}
            style={{ ...btn, background: "#3b82f6", color: "#fff" }}
          >
            수정
          </button>
          <button onClick={handleDelete} style={{ ...btn, background: "#ef4444", color: "#fff" }}>
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}

const backBtn = {
  border: "1px solid #e5e7eb",
  background: "#fff",
  borderRadius: 6,
  padding: "4px 8px",
  cursor: "pointer",
};
const btn = {
  border: "none",
  borderRadius: 6,
  padding: "8px 16px",
  marginLeft: 8,
  cursor: "pointer",
};
