// src/pages/ZoneSensorsPage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getZone } from "../services/zones";
import { getSensorsByZone, createSensorInZone } from "../services/sensors";
import { api } from "../lib/api";

export default function ZoneSensorsPage() {
  const { zoneId } = useParams();
  const [zone, setZone] = useState(null);
  const [sensors, setSensors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [newModel, setNewModel] = useState("");
  const [newType, setNewType] = useState("");
  const [newAlarm, setNewAlarm] = useState("on");
  const [newMin, setNewMin] = useState("");     // threshold_min
  const [newMax, setNewMax] = useState("");     // threshold_max
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

      // 🔹 구역 정보 정규화
      setZone({
        id: z.id,
        name: z.name ?? z.area_name ?? z.areaName ?? `구역 ${zoneId}`,
        is_active: z.is_active ?? z.isActive ?? 1,
      });

      // 🔹 센서 리스트 정규화 (is_active 기본값 1)
      const adaptedSensors = (sList ?? []).map((s) => ({
        ...s,
        is_active:
          s.is_active ??
          s.isActive ??
          1,
      }));
      setSensors(adaptedSensors);
    } catch (e) {
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

    const minVal = newMin === "" ? null : Number(newMin);
    const maxVal = newMax === "" ? null : Number(newMax);

    setAdding(true);
    try {
      await createSensorInZone(zoneId, {
        model: newModel.trim(),
        sensor_type: newType,
        is_alarm: newAlarm === "on",
        threshold_min: minVal,
        threshold_max: maxVal,
      });

      setNewModel("");
      setNewType("");
      setNewAlarm("on");
      setNewMin("");
      setNewMax("");
      setShowAdd(false);

      await load();
    } catch (e) {
      alert(e.message || "센서 생성 실패");
    } finally {
      setAdding(false);
    }
  }
  const handleDeleteClick = async () => {
    if (!window.confirm("이 구역을 비활성화하시겠습니까?")) return;

    try {
      await api(`/areas/${zoneId}`, {
        method: "DELETE"
      });
      alert("구역을 비활성화했습니다.");
      navigate("/zones");
    } catch (e) {
      alert(e?.message || "구역을 비활성화하지 못했습니다.");
    }
  };
  return (
    <div style={{ padding: 16 }}>
      {/* 헤더 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => navigate("/zones")} style={backBtn}>
            ←
          </button>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
            센서관리 · {zone?.name ?? `구역 ${zoneId}`}
          </h1>
          {zone && zone.is_active === 0 && (
            <span
              style={{
                fontSize: 11,
                padding: "2px 6px",
                borderRadius: 999,
                background: "#f3f4f6",
                color: "#6b7280",
              }}
            >
              비활성 구역
            </span>
          )}
        </div>

        {/* 🔹 구역 수정 버튼 (구역 상세 페이지로 이동) */}
        <div>
        <button
          style={secondaryBtn}
          onClick={() => navigate(`/zones/${zoneId}/edit`)}
        >
          구역 수정
        </button>
        <button
          style={secondaryBtn}
          onClick={handleDeleteClick}
        >
          구역 삭제
        </button>
        </div>
        
      </div>

      {/* 본문 */}
      <div
        style={{
          background: "#d1d5db",
          border: "1px solid #9ca3af",
          borderRadius: 6,
          padding: 40,
          minHeight: 420,
        }}
      >
        {err && <div style={{ color: "#b91c1c", marginBottom: 16 }}>{err}</div>}

        {/* 추가 폼 */}
        {showAdd && (
          <form
            onSubmit={handleAddSensor}
            style={{
              marginBottom: 24,
              padding: 16,
              borderRadius: 8,
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <input
              value={newModel}
              onChange={(e) => setNewModel(e.target.value)}
              placeholder="모델명 (예: DHT22)"
              style={input}
            />

            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              style={selectBox}
            >
              <option value="">센서 타입</option>
              <option value="temperature">온도 (temperature)</option>
              <option value="humidity">습도 (humidity)</option>
            </select>

            <select
              value={newAlarm}
              onChange={(e) => setNewAlarm(e.target.value)}
              style={selectBox}
            >
              <option value="on">알람 ON</option>
              <option value="off">알람 OFF</option>
            </select>

            <input
              type="number"
              value={newMin}
              onChange={(e) => setNewMin(e.target.value)}
              placeholder="하한값 (min)"
              step="0.1"
              style={input}
            />

            <input
              type="number"
              value={newMax}
              onChange={(e) => setNewMax(e.target.value)}
              placeholder="상한값 (max)"
              step="0.1"
              style={input}
            />

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
                setNewMin("");
                setNewMax("");
              }}
              style={cancelBtn}
            >
              취소
            </button>
          </form>
        )}

        {/* 센서 목록 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 160px)",
            gap: 48,
            justifyContent: "center",
          }}
        >
          {sensors.map((s) => {
            const inactive = !s.is_active;

            return (
              <button
                key={s.id}
                onClick={() =>
                  navigate(`/zones/${zoneId}/sensors/${s.id}`)
                }
                style={{
                  ...tile,
                  opacity: inactive ? 0.4 : 1, // 🔹 비활성 센서 회색 처리
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    fontSize: 11,
                    color: "#6b7280",
                  }}
                >
                  {inactive && (
                    <span
                      style={{
                        padding: "2px 6px",
                        borderRadius: 999,
                        background: "#f3f4f6",
                      }}
                    >
                      비활성
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>
                  {s.model}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  타입: {s.sensor_type}
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    color: "#6b7280",
                  }}
                >
                  {s.threshold_min} ~ {s.threshold_max}
                </div>
              </button>
            );
          })}

          {!showAdd && (
            <button
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

/* Styles */
const tile = {
  position: "relative",
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
  width: 160,
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
  background: "#fff",
  fontSize: 13,
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

const secondaryBtn = {
  padding: "6px 10px",
  borderRadius: 6,
  border: "1px solid #e5e7eb",
  background: "#fff",
  color: "#111827",
  fontSize: 13,
  cursor: "pointer",
};
