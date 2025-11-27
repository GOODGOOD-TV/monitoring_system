import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getZones } from "../services/zones";
import { api } from "../lib/api.js";

export default function ZonesPage() {
  const [zones, setZones] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const res = await getZones();    // [{ id, area_name, ... }]
      setZones(res);
    })();
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>구역관리</h1>
      <div
        style={{
          background: "#e5e7eb",
          border: "1px solid #999",
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
          {zones.map((z) => (
            <button
              key={z.id}
              onClick={() => navigate(`/zones/${z.id}`)}
              style={tileBtn}
            >
              {z.name}
            </button>
          ))}

          <button
            title="구역 추가"
            style={{ ...tileBtn, border: "2px dashed #111", fontSize: 28 }}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

const tileBtn = {
  width: 160,
  height: 144,
  background: "#fff",
  borderRadius: 8,
  border: "1px solid #e5e7eb",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  fontSize: 16,
  fontWeight: 600,
};
