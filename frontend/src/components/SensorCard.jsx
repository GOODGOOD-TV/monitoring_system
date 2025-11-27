// import React from "react";

// /**
//  * 센서 타일 카드 (가시성 보장)
//  * - 진한 배경 + 흰 텍스트
//  * - 부모 크기 없어도 보이도록 기본 크기 포함
//  */
// export default function SensorCard({ item, width = 160, height = 144 }) {
//   const t = item ?? {};
//   const isAlert = !!t.alert;

//   return (
//     <div
//       style={{
//         width,
//         height,
//         boxSizing: "border-box",
//         borderRadius: 8,
//         background: "#111",
//         border: "1px solid #444",
//         display: "flex",
//         alignItems: "center",
//         justifyContent: "center",
//       }}
//     >
//       <div style={{ textAlign: "center", lineHeight: 1.6, color: "#fff" }}>
//         <div style={{ fontSize: 20, fontWeight: isAlert ? 800 : 600 }}>
//           {t.temp}°C
//         </div>
//         <div style={{ fontSize: 20, fontWeight: isAlert ? 800 : 600 }}>
//           {t.hum}%
//         </div>
//       </div>
//     </div>
//   );
// }







// import React from "react";

// export default function SensorCard({ item, onClick, onDelete, editMode = false }) {
//   const isAlert = !!item.alert;

//   return (
//     <div
//       onClick={onClick}
//       style={{
//         width: 160,
//         height: 144,
//         borderRadius: 8,
//         background: "#fff",
//         border: isAlert ? "2px solid #ef4444" : "1px solid #e5e7eb",
//         display: "flex",
//         alignItems: "center",
//         justifyContent: "center",
//         position: "relative",
//         cursor: "pointer",
//         boxShadow: isAlert ? "0 0 0 3px rgba(239,68,68,0.15)" : "none",
//       }}
//       title={`${item.name} — ${item.temp}℃ / ${item.hum}%`}
//     >
//       {/* 삭제 버튼 (편집모드일 때만 노출) */}
//       {editMode && (
//         <button
//           onClick={(e) => {
//             e.stopPropagation();
//             onDelete?.();
//           }}
//           title="타일 삭제"
//           style={{
//             position: "absolute",
//             right: 8,
//             top: 8,
//             width: 26,
//             height: 26,
//             borderRadius: 999,
//             border: "1px solid #e5e7eb",
//             background: "#fff",
//             fontSize: 16,
//             lineHeight: "24px",
//             cursor: "pointer",
//           }}
//         >
//           ×
//         </button>
//       )}

//       <div style={{ textAlign: "center", lineHeight: 1.6 }}>
//         <div style={{ fontSize: 18, fontWeight: isAlert ? 800 : 600 }}>{item.temp}°C</div>
//         <div style={{ fontSize: 18, fontWeight: isAlert ? 800 : 600 }}>{item.hum}%</div>
//       </div>
//     </div>
//   );
// }



// import React from "react";

// export default function SensorCard({ item, locked = false, onClick }) {
//   const isAlert = !!item.alert;

//   return (
//     <div
//       onClick={onClick}
//       style={{
//         width: 160,
//         height: 144,
//         borderRadius: 8,
//         background: "#fff",
//         border: isAlert ? "2px solid #ef4444" : "1px solid #e5e7eb",
//         display: "flex",
//         alignItems: "center",
//         justifyContent: "center",
//         position: "relative",
//         cursor: onClick ? "pointer" : "default",
//         boxShadow: isAlert ? "0 0 0 3px rgba(239,68,68,0.15)" : "none",
//       }}
//       title={`${item.name} — ${item.temp}℃ / ${item.hum}%`}
//     >
//       {/* 기본 타일은 잠금 아이콘으로 표시(편집 불가) */}
//       {locked && (
//         <div
//           title="기본 타일 (편집 불가)"
//           style={{
//             position: "absolute",
//             right: 8,
//             top: 8,
//             width: 22,
//             height: 22,
//             borderRadius: 999,
//             border: "1px solid #e5e7eb",
//             background: "#f8fafc",
//             display: "flex",
//             alignItems: "center",
//             justifyContent: "center",
//             fontSize: 12,
//             color: "#64748b",
//           }}
//         >
//           🔒
//         </div>
//       )}

//       <div style={{ textAlign: "center", lineHeight: 1.6 }}>
//         <div style={{ fontSize: 18, fontWeight: isAlert ? 800 : 600 }}>{item.temp}°C</div>
//         <div style={{ fontSize: 18, fontWeight: isAlert ? 800 : 600 }}>{item.hum}%</div>
//       </div>
//     </div>
//   );
// }

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
