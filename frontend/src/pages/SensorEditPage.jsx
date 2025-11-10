import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getSensor, updateSensor } from "../services/sensors";

export default function SensorEditPage() {
  const { zoneId, sensorId } = useParams();
  const [form, setForm] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const data = await getSensor(sensorId);
      setForm(data || {});
    })();
  }, [sensorId]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await updateSensor(sensorId, form);
    navigate(`/zones/${zoneId}/sensors/${sensorId}`);
  };

  return (
    <div style={{ padding: 16 }}>
      <button onClick={() => navigate(-1)} style={backBtn}>← 뒤로</button>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginTop: 12 }}>센서 수정</h1>

      <form
        onSubmit={handleSubmit}
        style={{
          marginTop: 16,
          display: "grid",
          gap: 12,
          maxWidth: 400,
        }}
      >
        <label>센서 이름 <input name="name" value={form.name || ""} onChange={handleChange} style={input}/></label>
        <label>상태 <input name="status" value={form.status || ""} onChange={handleChange} style={input}/></label>
        <label>온도 하한 <input name="tempLow" value={form.tempLow || ""} onChange={handleChange} style={input}/></label>
        <label>온도 상한 <input name="tempHigh" value={form.tempHigh || ""} onChange={handleChange} style={input}/></label>
        <label>습도 하한 <input name="humLow" value={form.humLow || ""} onChange={handleChange} style={input}/></label>
        <label>습도 상한 <input name="humHigh" value={form.humHigh || ""} onChange={handleChange} style={input}/></label>

        <button type="submit" style={{ ...btn, background: "#10b981", color: "#fff" }}>
          저장
        </button>
      </form>
    </div>
  );
}

const input = {
  width: "100%",
  padding: "6px 8px",
  border: "1px solid #d1d5db",
  borderRadius: 4,
  marginTop: 4,
};

const btn = {
  border: "none",
  borderRadius: 6,
  padding: "8px 16px",
  cursor: "pointer",
};

const backBtn = {
  border: "1px solid #e5e7eb",
  background: "#fff",
  borderRadius: 6,
  padding: "4px 8px",
  cursor: "pointer",
};
