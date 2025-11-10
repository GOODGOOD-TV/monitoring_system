import React, { useEffect, useMemo, useState } from "react";

/**
 * DB 없이 public/sensors.json에서 불러와서 렌더하는 버전
 * - 필터(위치/타입), 조회 버튼, 표, 페이지네이션 포함
 * - 인라인 스타일만 사용
 */
export default function SensorsPage() {
  const [rows, setRows] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // 필터 상태
  const [zone, setZone] = useState("ALL");
  const [stype, setStype] = useState("ALL");
  const [fromDate, setFromDate] = useState(dayOffset(-1));
  const [toDate, setToDate] = useState(dayOffset(0));
  const [fromTime, setFromTime] = useState("09:00");
  const [toTime, setToTime] = useState("23:59");

  const [page, setPage] = useState(1);
  const pageSize = 10;

  // 1) JSON 로드
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const res = await fetch("/sensors.json", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!alive) return;
        setRows(Array.isArray(data) ? data : []);
      } catch (e) {
        setErr(`데이터 불러오기 실패: ${e.message}`);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // 2) 필터 옵션
  const zoneOptions = useMemo(
    () => ["ALL", ...unique(rows.map((r) => r.zone))],
    [rows]
  );
  const typeOptions = useMemo(
    () => ["ALL", ...unique(rows.map((r) => r.type))],
    [rows]
  );

  // 3) 조회(필터 적용)
  const applyFilter = () => {
    let next = rows;
    if (zone !== "ALL") next = next.filter((r) => r.zone === zone);
    if (stype !== "ALL") next = next.filter((r) => r.type === stype);
    // 날짜/시간 필터는 데모라 생략 (실서비스에선 timestamp 비교)
    setFiltered(next);
    setPage(1);
  };

  // 최초 1회 자동 조회
  useEffect(() => {
    if (!loading && !err) applyFilter();
    // eslint-disable-next-line
  }, [loading, err, rows]);

  // 페이지 계산
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageData = filtered.slice((page - 1) * pageSize, page * pageSize);

  // 스타일
  const wrap = { maxWidth: 1200, margin: "0 auto", padding: 16 };
  const controlsRow = {
    display: "grid",
    gridTemplateColumns: "repeat(12, 1fr)",
    gap: 8,
    alignItems: "center",
    marginBottom: 12,
  };
  const select = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    fontSize: 14,
    boxSizing: "border-box",
    background: "#fff",
  };
  const input = select;
  const button = (primary) => ({
    padding: "10px 14px",
    borderRadius: 999,
    border: primary ? "1px solid #111" : "1px solid #d1d5db",
    background: primary ? "#111" : "#fff",
    color: primary ? "#fff" : "#111",
    cursor: "pointer",
  });
  const tableWrap = { overflowX: "auto", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff" };
  const th = { textAlign: "left", padding: "10px 12px", fontSize: 13, background: "#f3f4f6", whiteSpace: "nowrap" };
  const td = { padding: "10px 12px", fontSize: 13, borderTop: "1px solid #f1f5f9", whiteSpace: "nowrap" };

  return (
    <div style={{ padding: 16 }}>
      <div style={wrap}>
        <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>센서정보</h1>

        {/* 컨트롤 바 */}
        <div style={controlsRow}>
          <div style={{ gridColumn: "span 2" }}>
            <select value={zone} onChange={(e) => setZone(e.target.value)} style={select}>
              {zoneOptions.map((z) => (
                <option key={z} value={z}>{`위치 ${z}`}</option>
              ))}
            </select>
          </div>
          <div style={{ gridColumn: "span 2" }}>
            <select value={stype} onChange={(e) => setStype(e.target.value)} style={select}>
              {typeOptions.map((t) => (
                <option key={t} value={t}>{`센서타입 ${t}`}</option>
              ))}
            </select>
          </div>
          <div style={{ gridColumn: "span 3" }}>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={input} />
          </div>
          <div style={{ gridColumn: "span 1" }}>
            <input type="time" value={fromTime} onChange={(e) => setFromTime(e.target.value)} style={input} />
          </div>
          <div style={{ gridColumn: "span 3" }}>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={input} />
          </div>
          <div style={{ gridColumn: "span 1" }}>
            <input type="time" value={toTime} onChange={(e) => setToTime(e.target.value)} style={input} />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <button onClick={applyFilter} style={button(false)}>조회</button>
        </div>

        {/* 로딩/에러 */}
        {loading && <div style={{ padding: 12 }}>불러오는 중…</div>}
        {err && <div style={{ padding: 12, color: "#dc2626" }}>{err}</div>}

        {/* 표 */}
        {!loading && !err && (
          <>
            <div style={tableWrap}>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                <thead>
                  <tr>
                    <th style={th}>위치</th>
                    <th style={th}>센서ID</th>
                    <th style={th}>센서타입</th>
                    <th style={th}>측정항목</th>
                    <th style={th}>현재값</th>
                    <th style={th}>평균값</th>
                    <th style={{ ...th, textAlign: "right" }}>실적률</th>
                    <th style={th}>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.map((r) => (
                    <tr key={r.id}>
                      <td style={td}>{r.zone}</td>
                      <td style={td}>{r.id}</td>
                      <td style={td}>{r.type}</td>
                      <td style={td}>{r.item}</td>
                      <td style={td}>{fmt(r.value, r.item)}</td>
                      <td style={td}>{fmt(r.avg, r.item)}</td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{r.rate?.toFixed?.(1) ?? r.rate}%</td>
                      <td style={{ ...td, color: r.status === "경고" ? "#dc2626" : "#065f46", fontWeight: 700 }}>
                        {r.status}
                      </td>
                    </tr>
                  ))}
                  {pageData.length === 0 && (
                    <tr>
                      <td style={{ ...td, textAlign: "center" }} colSpan={8}>
                        데이터가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              page={page}
              totalPages={Math.max(1, Math.ceil(filtered.length / pageSize))}
              onChange={setPage}
              style={{ marginTop: 12 }}
            />
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------- 유틸/컴포넌트 ---------------- */

function unique(arr) { return Array.from(new Set(arr)); }
function fmt(v, kind) {
  if (v == null) return "-";
  if (kind === "온도") return `${v}°C`;
  if (kind === "습도") return `${v}%`;
  return String(v);
}
function dayOffset(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function Pagination({ page, totalPages, onChange, style }) {
  const btn = (active) => ({
    padding: "6px 10px",
    borderRadius: 6,
    border: "1px solid #d1d5db",
    background: active ? "#111" : "#fff",
    color: active ? "#fff" : "#111",
    cursor: "pointer",
    marginRight: 6,
    minWidth: 34,
    textAlign: "center",
  });
  const numbers = visiblePages(page, totalPages);
  return (
    <div style={{ display: "flex", justifyContent: "center", ...style }}>
      <button onClick={() => onChange(Math.max(1, page - 1))} style={btn(false)} disabled={page === 1}>‹</button>
      {numbers.map((p, i) =>
        p === "…" ? <span key={`e${i}`} style={{ padding: "6px 8px", marginRight: 6 }}>…</span>
                  : <button key={p} onClick={() => onChange(p)} style={btn(p === page)}>{p}</button>
      )}
      <button
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        style={btn(false)}
        disabled={page === totalPages}
      >›</button>
    </div>
  );
}
function visiblePages(current, total) {
  const out = [];
  const add = (x) => out.push(x);
  if (total <= 9) { for (let i = 1; i <= total; i++) add(i); return out; }
  add(1);
  if (current > 4) add("…");
  for (let i = Math.max(2, current - 2); i <= Math.min(total - 1, current + 2); i++) add(i);
  if (current < total - 3) add("…");
  add(total);
  return out;
}
