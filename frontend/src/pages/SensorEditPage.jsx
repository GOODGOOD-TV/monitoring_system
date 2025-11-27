// src/pages/sensoreditpage.js
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";

export default function SensorEditPage() {
  const { areaId, sensorId } = useParams();   // /zones/:areaId/sensors/:sensorId/edit
  const navigate = useNavigate();

  // 폼 상태: 센서 이름, 알림, 상한/하한
  const [form, setForm] = useState({
    model: "",
    is_alarm: 1,
    threshold_max: "",
    threshold_min: "",
  });
  const [loading, setLoading] = useState(true);

  // 최초 진입 시 센서 정보 불러오기
  useEffect(() => {
    if (!sensorId) return;

    (async () => {
      setLoading(true);
      try {
        const json = await api(`/api/v1/sensors/${sensorId}`);
        // json이 { is_sucsess, data: {...} } 형태라고 가정
        const s = json?.data || json || {};

        setForm({
          model: s.model ?? "",
          is_alarm: s.is_alarm ?? 1,
          threshold_max: s.threshold_max ?? "",
          threshold_min: s.threshold_min ?? "",
        });
      } catch (e) {
        alert(e?.message || "센서 정보를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    })();
  }, [sensorId]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    // 숫자 필드
    if (["is_alarm", "threshold_max", "threshold_min"].includes(name)) {
      setForm((prev) => ({
        ...prev,
        [name]: value === "" ? "" : Number(value),
      }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api(`/api/v1/sensors/${sensorId}`, {
        method: "PATCH",
        body: {
          model: form.model,
          is_alarm: form.is_alarm,
          // threshold_min/max는 나중에 백엔드 PATCH가 지원하면 같이 반영
          threshold_max: form.threshold_max,
          threshold_min: form.threshold_min,
        },
      });
      navigate(`/zones/${areaId}/sensors/${sensorId}`);
    } catch (err) {
      alert(err?.message || "센서를 수정하지 못했습니다.");
    }
  };

  if (loading) {
    return <div style={{ padding: 16 }}>로딩 중...</div>;
  }

  return (
    <div style={{ padding: 16 }}>
      <button onClick={() => navigate(-1)} style={backBtn}>
        ← 뒤로
      </button>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginTop: 12 }}>
        센서 수정
      </h1>

      <form
        onSubmit={handleSubmit}
        style={{
          marginTop: 16,
          display: "grid",
          gap: 12,
          maxWidth: 400,
        }}
      >
        {/* 센서 이름 (DHT22 등 기존 값이 자동으로 들어옴) */}
        <label>
          센서 이름
          <input
            name="model"
            value={form.model}
            onChange={handleChange}
            style={input}
          />
        </label>

        {/* 알림 ON/OFF (기존 is_alarm 값으로 선택됨) */}
        <label>
          알림
          <select
            name="is_alarm"
            value={form.is_alarm}
            onChange={handleChange}
            style={input}
          >
            <option value={1}>ON</option>
            <option value={0}>OFF</option>
          </select>
        </label>

        {/* 상한 = threshold_max */}
        <label>
          상한
          <input
            type="number"
            name="threshold_max"
            value={form.threshold_max}
            onChange={handleChange}
            style={input}
          />
        </label>

        {/* 하한 = threshold_min */}
        <label>
          하한
          <input
            type="number"
            name="threshold_min"
            value={form.threshold_min}
            onChange={handleChange}
            style={input}
          />
        </label>

        <button
          type="submit"
          style={{ ...btn, background: "#10b981", color: "#fff" }}
        >
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
