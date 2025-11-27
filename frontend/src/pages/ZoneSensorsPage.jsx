import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getZone } from "../services/zones";
import { getSensorsByZone } from "../services/sensors";
import { api } from "../lib/api.js";

export default function ZoneSensorsPage() {
  const { zoneId } = useParams();
  const [zone, setZone] = useState(null);
  const [sensors, setSensors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
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
        console.error("[ZoneSensorsPage] error:", e);
        setErr(e.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [zoneId]);

  return (
    <div style={{ padding: 16 }}>
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
          <div style={{ color: "#4b5563", marginBottom: 16 }}>
            불러오는 중…
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 160px)",
            gap: 48,
            justifyContent: "center",
          }}
        >
          {!loading && !err && sensors.length === 0 && (
            <div style={{ color: "#4b5563" }}>이 구역에 센서가 없습니다.</div>
          )}

          {sensors.map((s) => (
            <button
              key={s.id}
              onClick={() => navigate(`/zones/${zoneId}/sensors/${s.id}`)}
              style={tile}
            >
              {/* 여기는 나중에 센서 데이터 붙이면 temp/hum로 교체 */}
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

          <button
            title="센서 추가"
            style={{ ...tile, border: "2px dashed #111", fontSize: 28 }}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

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
