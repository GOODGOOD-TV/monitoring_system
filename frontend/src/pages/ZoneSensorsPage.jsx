// src/pages/ZoneSensorsPage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getZone } from "../services/zones";
import { getSensorsByZone, createSensorInZone } from "../services/sensors";

export default function ZoneSensorsPage() {
  const { zoneId } = useParams();
  const [zone, setZone] = useState(null);
  const [sensors, setSensors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [newModel, setNewModel] = useState("");
  const [newType, setNewType] = useState("");
  const [newAlarm, setNewAlarm] = useState("on"); // 🔔 알람 상태
  const [adding, setAdding] = useState(false);

  const navigate = useNavigate();

  async function load() {
    if (!zoneId) return;
    setLoading(true);
    setErr("");
    try {
      const [z, sList] = await Promise.all([
        getZone(zoneId),
        getSensorsByZone(zoneId),
      ]);
      setZone(z);
      setSensors(sList);
    } catch (e) {
      console.error("[ZoneSensorsPage] load error:", e);
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [zoneId]);

  async function handleAddSensor(e) {
    e.preventDefault();
    if (!newModel.trim() || !newType.trim()) return;

    setAdding(true);
    try {
      await createSensorInZone(zoneId, {
        model: newModel.trim(),
        sensor_type: newType,             // "temperature" | "humidity"
        is_alarm: newAlarm === "on",      // 🔔 true / false
      });
      setNewModel("");
      setNewType("");
      setNewAlarm("on");
      setShowAdd(false);
      await load();
    } catch (e) {
      console.error("[ZoneSensorsPage] create error:", e);
      alert(e.message || "센서 생성 실패");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      {/* 헤더 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <button onClick={() => navigate("/zones")} style={backBtn}>
          ←
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>
          센서관리 · {zone?.name ?? `구역 ${zoneId}`}
        </h1>
      </div>

      {/* 본문 박스 */}
      <div
        style={{
          background: "#d1d5db",
          border: "1px solid #9ca3af",
          borderRadius: 6,
          padding: 40,
          minHeight: 420,
        }}
      >
        {err && (
          <div style={{ color: "#b91c1c", marginBottom: 16 }}>{err}</div>
        )}
        {loading && (
          <div style={{ color: "#4b5563", marginBottom: 16 }}>불러오는 중…</div>
        )}

        {/* 센서 추가 폼 (토글) */}
        {showAdd && (
          <form
            onSubmit={handleAddSensor}
            style={{
              marginBottom: 24,
              padding: 12,
              borderRadius: 8,
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              display: "flex",
              gap: 8,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* 모델명 */}
            <input
              value={newModel}
              onChange={(e) => setNewModel(e.target.value)}
              placeholder="모델명 (예: DHT22)"
              style={input}
            />

            {/* 센서 타입 */}
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              style={selectBox}
            >
              <option value="">센서 타입 선택</option>
              <option value="temperature">온도 (temperature)</option>
              <option value="humidity">습도 (humidity)</option>
            </select>

            {/* 🔔 알람 활성화 여부 */}
            <select
              value={newAlarm}
              onChange={(e) => setNewAlarm(e.target.value)}
              style={selectBox}
            >
              <option value="on">알람 ON</option>
              <option value="off">알람 OFF</option>
            </select>

            <button
              type="submit"
              disabled={adding || !newModel.trim() || !newType.trim()}
              style={primaryBtn}
            >
              {adding ? "추가 중…" : "추가"}
            </button>

            <button
              type="button"
              disabled={adding}
              onClick={() => {
                setShowAdd(false);
                setNewModel("");
                setNewType("");
                setNewAlarm("on");
              }}
              style={cancelBtn}
            >
              취소
            </button>
          </form>
        )}

        {/* 센서 리스트 그리드 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 160px)",
            gap: 48,
            justifyContent: "center",
          }}
        >
          {!loading && !err && sensors.length === 0 && !showAdd && (
            <div style={{ color: "#4b5563" }}>이 구역에 센서가 없습니다.</div>
          )}

          {sensors.map((s) => (
            <button
              key={s.id}
              onClick={() => navigate(`/zones/${zoneId}/sensors/${s.id}`)}
              style={tile}
            >
              <div style={{ fontSize: 14, fontWeight: 700 }}>
                {s.model || "모델 미지정"}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "#6b7280",
                  marginTop: 4,
                  marginBottom: 8,
                }}
              >
                타입: {s.sensor_type || "-"}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <Badge on={num(s.is_active) === 1}>
                  {num(s.is_active) === 1 ? "ACTIVE" : "INACTIVE"}
                </Badge>
                <Badge on={num(s.is_alarm) === 1}>
                  {num(s.is_alarm) === 1 ? "ALARM" : "NORMAL"}
                </Badge>
              </div>
            </button>
          ))}

          {/* 센서 추가 버튼 */}
          {!showAdd && (
            <button
              title="센서 추가"
              style={{ ...tile, border: "2px dashed #111", fontSize: 28 }}
              onClick={() => setShowAdd(true)}
            >
              +
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* 스타일 & 헬퍼들 */

const tile = {
  width: 160,
  height: 144,
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const backBtn = {
  border: "1px solid #e5e7eb",
  background: "#fff",
  borderRadius: 6,
  padding: "4px 8px",
  cursor: "pointer",
};

const input = {
  width: 180,
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid #d4d4d8",
  fontSize: 13,
};

const selectBox = {
  width: 160,
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid #d4d4d8",
  fontSize: 13,
  background: "#fff",
};

const primaryBtn = {
  padding: "8px 12px",
  borderRadius: 6,
  border: "none",
  background: "#111827",
  color: "#fff",
  fontSize: 13,
  cursor: "pointer",
};

const cancelBtn = {
  padding: "8px 12px",
  borderRadius: 6,
  border: "1px solid #e5e7eb",
  background: "#fff",
  color: "#111827",
  fontSize: 13,
  cursor: "pointer",
};

function Badge({ on, children }) {
  return (
    <span
      style={{
        display: "inline-block",
        minWidth: 60,
        textAlign: "center",
        padding: "3px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        color: on ? "#065f46" : "#7f1d1d",
        background: on ? "#d1fae5" : "#fee2e2",
        border: `1px solid ${on ? "#10b981" : "#f87171"}`,
      }}
    >
      {children}
    </span>
  );
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
