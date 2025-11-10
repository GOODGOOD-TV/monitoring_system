
import React, { useEffect, useMemo, useState } from "react";
import SensorCard from "../components/SensorCard.jsx";

/** 기본 타일(읽기 전용) */
const BASE_TILES = [
  { id: "b_1", name: "라인1", temp: 25, hum: 58, alert: false },
  { id: "b_2", name: "라인2", temp: 22, hum: 65, alert: true },
  { id: "b_3", name: "창고A", temp: 24, hum: 55, alert: false },
  { id: "b_4", name: "창고B", temp: 23, hum: 49, alert: false },
];

// 사용자 추가 타일만 저장
const LS_KEY = "monitoring.userTiles.v1";

export default function MonitoringPage() {
  const [userTiles, setUserTiles] = useState([]);
  const [editOpen, setEditOpen] = useState(false);
  const [showAlert, setShowAlert] = useState(false);

  // 초기 로드
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
      if (Array.isArray(saved)) setUserTiles(saved);
    } catch {}
  }, []);

  // 영속화
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(userTiles));
  }, [userTiles]);

  // 화면 출력용: 기본 + 사용자
  const tiles = useMemo(() => [...BASE_TILES, ...userTiles], [userTiles]);

  // 경고 여부
  const hasAlert = useMemo(() => tiles.some((t) => t.alert), [tiles]);
  useEffect(() => setShowAlert(hasAlert), [hasAlert]);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>모니터링</h1>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {/* ✅ 빠른 추가 버튼 제거 */}
          <button onClick={() => setEditOpen(true)} style={btnSecondary()}>
            ⚙️ 편집 설정
          </button>
        </div>
      </div>

      {/* 회색 캔버스 */}
      <div style={{ position: "relative", background: "#d1d5db", borderRadius: 8, padding: 40, minHeight: 420 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 160px)", gap: 48, justifyContent: "center" }}>
          {tiles.map((t) => (
            <SensorCard key={t.id} item={t} locked={String(t.id).startsWith("b_")} />
          ))}

          {/* ✅ + 타일: 이제 ‘빠른 추가’가 아니라 편집 설정 모달을 연다 */}
          <button
            onClick={() => setEditOpen(true)}
            title="타일 추가"
            style={{
              width: 160,
              height: 144,
              borderRadius: 8,
              background: "#fff",
              border: "1px solid #e5e7eb",
              fontSize: 28,
              cursor: "pointer",
            }}
          >
            +
          </button>
        </div>

        {/* 중앙 경고 카드 */}
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
              {"무연 냉장\n고 임계설\n정값 초과"}
            </div>
            <button onClick={() => setShowAlert(false)} style={btnSecondary()}>
              닫기
            </button>
          </div>
        )}
      </div>

      {/* 편집 설정 모달: 사용자 타일만 편집/삭제/추가 */}
      {editOpen && (
        <EditTilesModal
          baseTiles={BASE_TILES}
          userTiles={userTiles}
          onClose={() => setEditOpen(false)}
          onAdd={(item) => setUserTiles((prev) => [...prev, { ...item, id: `u_${Date.now()}` }])}
          onDelete={(id) => setUserTiles((prev) => prev.filter((t) => t.id !== id))}
          onUpdate={(id, patch) =>
            setUserTiles((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
          }
          onReset={() => setUserTiles([])}
        />
      )}
    </div>
  );
}

/* ===== 편집 설정 모달 ===== */
function EditTilesModal({ baseTiles, userTiles, onClose, onAdd, onDelete, onUpdate, onReset }) {
  const [form, setForm] = useState({ name: "", temp: "24", hum: "55", alert: false });
  const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 760, maxWidth: "95vw", background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", boxShadow: "0 10px 30px rgba(0,0,0,0.18)", padding: 16 }}
      >
        {/* 헤더 */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>편집 설정</h3>
          <span style={{ color: "#64748b", fontSize: 13 }}>기본은 보호되고, 추가한 타일만 편집됩니다.</span>
          <button onClick={onClose} style={{ marginLeft: "auto", ...btnGhost, fontSize: 20 }}>×</button>
        </div>

        {/* 기본 타일 (읽기 전용) */}
        <Section title="기본 타일 (읽기 전용)">
          <GridHeader />
          {baseTiles.map((t) => (
            <GridRowRead key={t.id} t={t} />
          ))}
        </Section>

        {/* 사용자 타일 (편집 가능) */}
        <Section
          title={`사용자 타일 (${userTiles.length}개)`}
          extraRight={<button onClick={onReset} style={btnGhost}>추가분 모두 초기화</button>}
        >
          <GridHeader editable />
          <div style={{ maxHeight: "30vh", overflowY: "auto" }}>
            {userTiles.map((t) => (
              <GridRowEdit key={t.id} t={t} onUpdate={onUpdate} onDelete={onDelete} />
            ))}
            {!userTiles.length && (
              <div style={{ padding: 12, color: "#64748b", textAlign: "center" }}>
                추가된 타일이 없습니다. 아래 폼에서 추가하세요.
              </div>
            )}
          </div>
        </Section>

        {/* 추가 폼 */}
        <Section title="새 타일 추가">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 140px 100px auto", gap: 10 }}>
            <input
              placeholder="이름 (예: 창고C)"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              style={inp}
            />
            <input
              type="number"
              placeholder="온도(℃)"
              value={form.temp}
              onChange={(e) => setForm((f) => ({ ...f, temp: e.target.value }))}
              style={inpCenter}
            />
            <input
              type="number"
              placeholder="습도(%)"
              value={form.hum}
              onChange={(e) => setForm((f) => ({ ...f, hum: e.target.value }))}
              style={inpCenter}
            />
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={form.alert}
                onChange={(e) => setForm((f) => ({ ...f, alert: e.target.checked }))}
              />
              경고
            </label>
            <button
              onClick={() => {
                onAdd({
                  name: form.name || "새 구역",
                  temp: num(form.temp, 24),
                  hum: num(form.hum, 55),
                  alert: !!form.alert,
                });
                setForm({ name: "", temp: "24", hum: "55", alert: false });
              }}
              style={btnPrimary}
            >
              추가
            </button>
          </div>
        </Section>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button onClick={onClose} style={btnSecondary()}>닫기</button>
        </div>
      </div>
    </div>
  );
}

/* ---- 모달 내부 컴포넌트 ---- */
function Section({ title, children, extraRight }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
        <div style={{ marginLeft: "auto" }}>{extraRight}</div>
      </div>
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>{children}</div>
    </div>
  );
}
function GridHeader({ editable = false }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 120px 120px 80px" + (editable ? " 80px" : ""),
        gap: 0,
        background: "#f8fafc",
        padding: "10px 12px",
        fontWeight: 700,
        fontSize: 13,
        color: "#334155",
      }}
    >
      <div>이름</div>
      <div>온도(℃)</div>
      <div>습도(%)</div>
      <div>경고</div>
      {editable && <div>작업</div>}
    </div>
  );
}
function GridRowRead({ t }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 120px 120px 80px",
        alignItems: "center",
        padding: "8px 12px",
        borderTop: "1px solid #f1f5f9",
      }}
    >
      <div>{t.name}</div>
      <div style={{ textAlign: "center" }}>{t.temp}</div>
      <div style={{ textAlign: "center" }}>{t.hum}</div>
      <div style={{ textAlign: "center", color: t.alert ? "#ef4444" : "#64748b" }}>{t.alert ? "ON" : "OFF"}</div>
    </div>
  );
}
function GridRowEdit({ t, onUpdate, onDelete }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 120px 120px 80px 80px",
        alignItems: "center",
        padding: "8px 12px",
        borderTop: "1px solid #f1f5f9",
      }}
    >
      <input value={t.name} onChange={(e) => onUpdate(t.id, { name: e.target.value })} style={inp} />
      <input type="number" value={t.temp} onChange={(e) => onUpdate(t.id, { temp: Number(e.target.value) })} style={inpCenter} />
      <input type="number" value={t.hum} onChange={(e) => onUpdate(t.id, { hum: Number(e.target.value) })} style={inpCenter} />
      <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
        <input type="checkbox" checked={!!t.alert} onChange={(e) => onUpdate(t.id, { alert: e.target.checked })} />
        <span>ON</span>
      </label>
      <button onClick={() => onDelete(t.id)} style={btnDangerMini}>삭제</button>
    </div>
  );
}

/* ---- 공통 스타일 ---- */
const inp = { padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", fontSize: 14 };
const inpCenter = { ...inp, textAlign: "center" };

const btnPrimary = { padding: "8px 12px", borderRadius: 8, border: "1px solid #111827", background: "#111827", color: "#fff", cursor: "pointer" };
function btnSecondary() { return { padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", color: "#111827", cursor: "pointer" }; }
const btnGhost = { padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", color: "#111827", cursor: "pointer" };
const btnDangerMini = { padding: "6px 10px", borderRadius: 8, border: "1px solid #ef4444", background: "#ef4444", color: "#fff", cursor: "pointer" };
