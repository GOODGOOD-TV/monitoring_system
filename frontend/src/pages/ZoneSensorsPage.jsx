import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getZone } from "../services/zones";
import { getSensorsByZone } from "../services/sensors";

export default function ZoneSensorsPage() {
  const { zoneId } = useParams();
  const [zone, setZone] = useState(null);
  const [sensors, setSensors] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      setZone(await getZone(zoneId));
      setSensors(await getSensorsByZone(zoneId));
    })();
  }, [zoneId]);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <button onClick={() => navigate("/zones")} style={backBtn}>←</button>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>
          센서관리 · {zone?.name ?? zoneId}
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
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 160px)",
            gap: 48,
            justifyContent: "center",
          }}
        >
          {sensors.map((s) => (
            <button
              key={s.id}
              onClick={() => navigate(`/zones/${zoneId}/sensors/${s.id}`)}
              style={tile}
            >
              <div style={{ fontSize: 18, fontWeight: 700 }}>{s.temp}°C</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{s.hum}%</div>
              <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>{s.name}</div>
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
