// src/pages/ZonesPage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getZones, createZone } from "../services/zones";

export default function ZonesPage() {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // 추가 폼 상태
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const navigate = useNavigate();

  async function loadZones() {
    setLoading(true);
    setErr("");
    try {
      const list = await getZones();

      // 🔹 응답 형태 정규화: name / is_active만 맞춰놓고 쓰기
      const adapted = (list ?? []).map((z) => ({
        id: z.id,
        name: z.name ?? z.area_name ?? z.areaName ?? "-",
        is_active:
          z.is_active ??
          z.isActive ??
          1, // 백엔드에서 안 내려오면 기본 활성
      }));

      setZones(adapted);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadZones();
  }, []);

  async function handleAddZone(e) {
    e?.preventDefault();
    if (!newName.trim()) return;

    setAdding(true);
    try {
      // services/zones 쪽에서 { name }을 area_name으로 매핑한다고 가정
      await createZone({ name: newName.trim() });
      setNewName("");
      setShowAdd(false);
      await loadZones();
    } catch (e) {
      alert(e.message || "구역 생성 실패");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>구역관리</h1>

      {err && <div style={{ color: "#dc2626", marginBottom: 8 }}>{err}</div>}

      <div
        style={{
          background: "#e5e7eb",
          border: "1px solid #999",
          borderRadius: 6,
          padding: 40,
          minHeight: 420,
        }}
      >
        {/* 상단에 구역 추가 폼 (토글) */}
        {showAdd && (
          <form
            onSubmit={handleAddZone}
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
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="구역 이름"
              style={{
                width: 240,
                padding: "8px 10px",
                borderRadius: 6,
                border: "1px solid #d4d4d8",
                fontSize: 14,
              }}
            />
            <button
              type="submit"
              disabled={adding || !newName.trim()}
              style={primaryBtn}
            >
              {adding ? "추가 중…" : "추가"}
            </button>
            <button
              type="button"
              disabled={adding}
              onClick={() => {
                setShowAdd(false);
                setNewName("");
              }}
              style={cancelBtn}
            >
              취소
            </button>
          </form>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 160px)",
            gap: 48,
            justifyContent: "center",
          }}
        >
          {zones.map((z) => {
            const inactive = !z.is_active;

            return (
              <button
                key={z.id}
                onClick={() => navigate(`/zones/${z.id}`)}
                style={{
                  ...tileBtn,
                  opacity: inactive ? 0.4 : 1, // 🔹 비활성 회색
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <span>{z.name}</span>
                  {inactive && (
                    <span
                      style={{
                        fontSize: 11,
                        padding: "2px 6px",
                        borderRadius: 999,
                        background: "#f3f4f6",
                        color: "#6b7280",
                      }}
                    >
                      비활성
                    </span>
                  )}
                </div>
              </button>
            );
          })}

          {/* 🔥 구역 추가 버튼 */}
          {!showAdd && (
            <button
              title="구역 추가"
              style={{ ...tileBtn, border: "2px dashed #111", fontSize: 28 }}
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
