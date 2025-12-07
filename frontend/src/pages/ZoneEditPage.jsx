// src/pages/ZoneEditPage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { getZone } from "../services/zones";

export default function ZoneEditPage() {
  const { zoneId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [active, setActive] = useState(true);
  const [createdAt, setCreatedAt] = useState(null);

  useEffect(() => {
    if (!zoneId) return;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const z = await getZone(zoneId);
        setName(z.name ?? z.area_name ?? z.areaName ?? "");
        setActive(z.is_active === 1 || z.is_active === true);
        setCreatedAt(z.created_at ?? null);
      } catch (e) {
        setError(e.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [zoneId]);

  const handleSave = async (e) => {
    e?.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      alert("구역 이름은 비워둘 수 없습니다.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await api(`/areas/${zoneId}`, {
        method: "PATCH",
        body: {
          area_name: trimmed,
          is_active: active ? 1 : 0,
        },
      });
      alert("구역이 수정되었습니다.");
      navigate(`/zones/${zoneId}`, { replace: true });
    } catch (e) {
      setError(e.message || "구역 수정 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const formattedCreatedAt = createdAt
    ? String(createdAt).slice(0, 19).replace("T", " ")
    : "-";

  return (
    <div style={{ padding: 16 }}>
      {/* 헤더 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 16,
        }}
      >
        <button
          onClick={() => navigate(`/zones/${zoneId}`)}
          style={backBtn}
        >
          ←
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
          구역 설정 · {name || `구역 ${zoneId}`}
        </h1>
      </div>

      <div
        style={{
          maxWidth: 520,
          background: "#f9fafb",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          padding: 20,
        }}
      >
        {loading ? (
          <div>불러오는 중…</div>
        ) : (
          <>
            {error && (
              <div
                style={{
                  color: "#b91c1c",
                  marginBottom: 12,
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}

            {/* 기본 정보 */}
            <div style={{ marginBottom: 16, fontSize: 13, color: "#6b7280" }}>
              <div>구역 ID: {zoneId}</div>
              <div>생성일: {formattedCreatedAt}</div>
            </div>

            {/* 수정 폼 */}
            <form onSubmit={handleSave}>
              <div style={{ marginBottom: 12 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    marginBottom: 4,
                    color: "#4b5563",
                  }}
                >
                  구역 이름
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="구역 이름"
                  style={input}
                  disabled={saving || deleting}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    marginBottom: 4,
                    color: "#4b5563",
                  }}
                >
                </label>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="submit"
                  disabled={saving || deleting}
                  style={primaryBtn}
                >
                  {saving ? "저장 중…" : "변경사항 저장"}
                </button>
                <button
                  type="button"
                  disabled={saving || deleting}
                  style={secondaryBtn}
                  onClick={() => navigate(`/zones/${zoneId}`)}
                >
                  취소
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

/* 스타일 */
const backBtn = {
  border: "1px solid #e5e7eb",
  background: "#fff",
  borderRadius: 6,
  padding: "4px 8px",
  cursor: "pointer",
};

const input = {
  width: "100%",
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

const secondaryBtn = {
  padding: "8px 12px",
  borderRadius: 6,
  border: "1px solid #e5e7eb",
  background: "#fff",
  color: "#111827",
  fontSize: 13,
  cursor: "pointer",
};

const dangerBtn = {
  padding: "8px 12px",
  borderRadius: 6,
  border: "1px solid #fecaca",
  background: "#fee2e2",
  color: "#b91c1c",
  fontSize: 13,
  cursor: "pointer",
};
