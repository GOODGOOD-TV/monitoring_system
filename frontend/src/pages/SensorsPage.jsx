import React, { useEffect, useMemo, useState } from "react";

export default function SensorsPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [sort, setSort] = useState("created_at DESC");

  const baseHost = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";
  // const DEV_TOKEN = (import.meta.env.VITE_DEV_TOKEN || "").trim() || null;
  const DEV_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiY29tcGFueV9pZCI6MSwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzYyNzg5NTYwLCJleHAiOjE3NjI3OTA0NjB9.ZZOblpWvEuW-tupCP_MRRfvl-sttCjH4bpS2j4WPXK8"

  const url = useMemo(() => {
    const qs = new URLSearchParams({
      page: String(page),
      size: String(size),
      sort,
    });
    return `${baseHost}/api/v1/sensors?${qs.toString()}`;
  }, [baseHost, page, size, sort]);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const headers = { Accept: "application/json" };
      if (DEV_TOKEN) headers["Authorization"] = `Bearer ${DEV_TOKEN}`;

      const res = await fetch(url, {
        method: "GET",
        headers,
        credentials: "include",       // 세션/쿠키 안 쓰면 제거 가능
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${res.statusText} :: ${text.slice(0,120)}`);
      }

      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        const text = await res.text().catch(() => "");
        throw new Error(`Non-JSON response: ${ct} :: ${text.slice(0,120)}`);
      }

      const json = await res.json(); // { is_sucsess, data, meta }
      if (!json?.is_sucsess) throw new Error(json?.message || "API 실패");

      setRows(Array.isArray(json.data) ? json.data : []);
      setTotal(Number(json.meta?.total ?? 0));
    } catch (e) {
      console.error("[SensorsPage] fetch error:", e);
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-line */ }, [url]);

  const totalPages = Math.max(1, Math.ceil(total / size));

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>센서정보</h1>

        <select value={sort} onChange={(e)=>{setPage(1); setSort(e.target.value);}} style={sel}>
          <option value="created_at DESC">최근 등록 순</option>
          <option value="created_at ASC">오래된 순</option>
          <option value="model ASC">모델명 ↑</option>
          <option value="model DESC">모델명 ↓</option>
          <option value="sensor_type ASC">센서타입 ↑</option>
          <option value="sensor_type DESC">센서타입 ↓</option>
        </select>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <select value={size} onChange={(e)=>{setPage(1); setSize(Number(e.target.value));}} style={sel}>
            {[10,20,50,100,200].map(n => <option key={n} value={n}>{n}개</option>)}
          </select>
          <button onClick={load} disabled={loading} style={btnSecondary()}>
            {loading ? "불러오는 중…" : "↻ 새로고침"}
          </button>
        </div>
      </div>

      <div style={{ background: "#e5e7eb", borderRadius: 8, padding: 16, minHeight: 360 }}>
        {err && <div style={{ color: "#dc2626", marginBottom: 12 }}>{err}</div>}

        <div style={{ overflowX: "auto", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background:"#f8fafc" }}>
                <Th>ID</Th>
                <Th>모델</Th>
                <Th>센서타입</Th>
                <Th>활성</Th>
                <Th>알람</Th>
                <Th>구역ID</Th>
                <Th>등록일</Th>
                <Th>수정일</Th>
              </tr>
            </thead>
            <tbody>
              {!loading && rows.length === 0 && (
                <tr><td colSpan={8} style={{ padding:16, textAlign:"center", color:"#64748b" }}>데이터가 없습니다.</td></tr>
              )}
              {rows.map(r => (
                <tr key={r.id} style={{ background:"#fff" }}>
                  <Td>{r.id}</Td>
                  <Td>{r.model ?? "-"}</Td>
                  <Td>{r.sensor_type ?? "-"}</Td>
                  <Td><Badge on={toNum(r.is_active) === 1}>{toNum(r.is_active) === 1 ? "ON" : "OFF"}</Badge></Td>
                  <Td><Badge on={toNum(r.is_alarm) === 1}>{toNum(r.is_alarm) === 1 ? "ON" : "OFF"}</Badge></Td>
                  <Td>{r.area_id ?? "-"}</Td>
                  <Td>{fmt(r.created_at)}</Td>
                  <Td>{fmt(r.updated_at)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display:"flex", justifyContent:"center", gap:10, marginTop:12 }}>
          <button style={btnSecondary()} onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={loading || page<=1}>이전</button>
          <span style={{ alignSelf:"center", color:"#475569" }}>{page} / {totalPages} (총 {total.toLocaleString()}건)</span>
          <button style={btnSecondary()} onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={loading || page>=totalPages}>다음</button>
        </div>
      </div>
    </div>
  );
}

/* UI helpers */
function Th({ children }) {
  return <th style={{ textAlign:"left", padding:"10px 12px", fontSize:12, color:"#334155", borderBottom:"1px solid #e5e7eb" }}>{children}</th>;
}
function Td({ children }) {
  return <td style={{ padding:"12px", borderBottom:"1px solid #f1f5f9", fontSize:14 }}>{children}</td>;
}
function Badge({ on, children }) {
  return <span style={{
    display:"inline-block", minWidth:44, textAlign:"center", padding:"2px 8px",
    borderRadius:999, fontSize:12, fontWeight:700,
    color: on ? "#065f46" : "#7f1d1d",
    background: on ? "#d1fae5" : "#fee2e2",
    border: `1px solid ${on ? "#10b981" : "#f87171"}`
  }}>{children}</span>;
}
const sel = { height:36, padding:"0 10px", borderRadius:8, border:"1px solid #e5e7eb", background:"#fff" };
function btnSecondary(){ return { padding:"8px 12px", borderRadius:8, border:"1px solid #e5e7eb", background:"#fff", color:"#111827", cursor:"pointer" }; }
function toNum(v){ const n = Number(v); return Number.isFinite(n) ? n : 0; }
function fmt(v){ if(!v) return "-"; try { return new Date(v).toLocaleString(); } catch { return String(v);} }
