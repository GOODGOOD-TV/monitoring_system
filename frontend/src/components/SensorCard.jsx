export default function SensorCard({ item, locked = false }) {
  const { area, name, value, unit, alert } = item;
  const border = alert ? "#ef4444" : "#e5e7eb";
  return (
    <div style={{
      width: 160, height: 140, background: "#fff", borderRadius: 12,
      border: `2px solid ${alert ? "#ef4444" : "#e5e7eb"}`, display: "flex",
      flexDirection: "column", justifyContent: "space-between", padding: 12
    }}>
      {/* 상단: 구역 · 이름 + 잠금 아이콘 */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ fontSize: 12, color: "#475569", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {area} · {name}
        </div>
        {locked && <span style={{ marginLeft: "auto", opacity: 0.6 }}>🔒</span>}
      </div>

      {/* 중앙: 값 하나 + 단위 */}
      <div style={{ textAlign: "center", margin: "8px 0", fontWeight: 800, fontSize: 26 }}>
        {value == null ? "—" : value}
        <span style={{ fontSize: 18, marginLeft: 4 }}>{unit}</span>
      </div>

      {/* 하단: 타임스탬프 같은 보조 정보가 필요하면 여기 */}
      <div style={{ minHeight: 8 }} />
    </div>
  );
}
