import React, { useEffect, useMemo, useState } from "react";
import SensorCard from "../components/SensorCard.jsx";

/**
 * MonitoringPage
 * - GET {{baseHost}}/api/v1/sensors 로 센서 목록 조회
 * - 응답 data[]를 타일로 그대로 렌더
 * - BASE_TILES / userTiles 제거 (전부 백엔드 데이터 기반)
 */
export default function MonitoringPage() {
  const [sensorTiles, setSensorTiles] = useState([]);   // ← 백엔드 센서 → 타일
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editOpen, setEditOpen] = useState(false);      // (남겨두되 기능 제거 가능)
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);
  const [total, setTotal] = useState(0);

  const baseHost = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";
  const url = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    return `${baseHost}/api/v1/sensors?${params.toString()}`;
  }, [baseHost, page, size]);
  
  const DEV_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiY29tcGFueV9pZCI6MSwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzYyNzkwNDgwLCJleHAiOjE3NjI3OTIyODB9.zY-KGo7QrbX3mrhtYzgUowLO5yHSHPoMYALE54ZrqIs"
  
  async function fetchSensors() {
    setLoading(true);
    setError("");
    try {
    const res = await fetch("http://localhost:3000/api/v1/sensors", {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEV_TOKEN}`, // 하드코딩된 토큰 사용
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json?.is_sucsess) throw new Error(json?.message || "API 실패");

    const adapted = (json.data ?? []).map((s) => ({
      id: s.id,
      name: `${s.sensor_type ?? "sensor"} · ${s.model ?? "-"}`,
      temp: null,
      hum: null,
      alert: Number(s.is_alarm) === 1,
      _raw: s,
    }));
    setSensorTiles(adapted);
    setTotal(json.meta?.total ?? adapted.length);
  } catch (e) {
    setError(e.message || String(e));
  } finally {
    setLoading(false);
  }
  }

  useEffect(() => {
    fetchSensors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // 화면 표시용 타일: 이제 백엔드 목록만 사용
  const tiles = sensorTiles;

  // 경고 배지/모달 여부
  const hasAlert = useMemo(() => tiles.some(t => t.alert), [tiles]);
  const [showAlert, setShowAlert] = useState(false);
  useEffect(() => setShowAlert(hasAlert), [hasAlert]);

  const totalPages = Math.max(1, Math.ceil(total / size));

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>모니터링</h1>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={fetchSensors} style={btnSecondary()} disabled={loading}>
            {loading ? "불러오는 중…" : "새로고침"}
          </button>
          {/* 편집 설정은 더 이상 의미 없으면 제거해도 됨 */}
          <button onClick={() => setEditOpen(true)} style={btnSecondary()}>
            ⚙️ 편집 설정
          </button>
        </div>
      </div>

      <div style={{ position: "relative", background: "#d1d5db", borderRadius: 8, padding: 40, minHeight: 420 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 160px)", gap: 48, justifyContent: "center" }}>
          {tiles.map(t => (
            <SensorCard
              key={t.id}
              item={t}
              locked={true}   // 백엔드 기반이라 사용자 편집 잠금 (원하면 false)
            />
          ))}
        </div>

        {showAlert && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              background: "#fff",
              border: "1px solid #d1d5db",
              boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
              borderRadius: 8,
              padding: "20px 24px",
              textAlign: "center",
              whiteSpace: "pre-line",
              zIndex: 10,
            }}
          >
            <div style={{ color: "#dc2626", fontWeight: 700 }}>
              {"알람 발생 센서 존재"}
            </div>
            <button onClick={() => setShowAlert(false)} style={btnSecondary()}>
              닫기
            </button>
          </div>
        )}
      </div>

      {/* 페이지네이션 */}
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
        <button
          style={btnSecondary()}
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={loading || page <= 1}
        >
          이전
        </button>
        <span style={{ alignSelf: "center", color: "#475569", fontSize: 14 }}>
          {page} / {totalPages}
        </span>
        <button
          style={btnSecondary()}
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={loading || page >= totalPages}
        >
          다음
        </button>
      </div>

      {/* 편집 모달: 이제 의미가 없으니 완전 제거해도 됨. 남겨두려면 내부 기능을 읽기용으로 바꿔. */}
      {editOpen && (
        <ReadOnlyInfoModal onClose={() => setEditOpen(false)} />
      )}
    </div>
  );
}

/* ---- 읽기 전용 안내 모달 (선택) ---- */
function ReadOnlyInfoModal({ onClose }) {
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 520, maxWidth: "95vw", background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", boxShadow: "0 10px 30px rgba(0,0,0,0.18)", padding: 16 }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>타일 편집</h3>
          <button onClick={onClose} style={{ marginLeft: "auto", ...btnGhost, fontSize: 20 }}>×</button>
        </div>
        <p style={{ color: "#475569", marginTop: 8 }}>
          현재 타일은 서버의 센서 목록을 그대로 반영합니다. 타일 추가/삭제는 센서 등록/비활성으로 관리하세요.
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button onClick={onClose} style={btnSecondary()}>닫기</button>
        </div>
      </div>
    </div>
  );
}

/* ---- 공통 버튼 스타일 ---- */
function btnSecondary() { return { padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", color: "#111827", cursor: "pointer" }; }
const btnGhost = { padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", color: "#111827", cursor: "pointer" };
