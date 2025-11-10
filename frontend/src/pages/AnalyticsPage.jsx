// src/pages/AnalyticsPage.jsx
import React, { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from "recharts";

/**
 * 요구사항:
 *  - 하드코딩 토큰을 Authorization 헤더에 실어서 MonitoringPage처럼 호출
 *  - GET /api/v1/sensors 로 센서 목록 가져오기
 *  - GET /api/v1/sensor-data?sensor_id=&from=&to=&bucket= 로 시계열 가져오기
 *  - Recharts로 temp/hum 차트 표시
 */

const API_BASE = "http://localhost:3000";
const DEV_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiY29tcGFueV9pZCI6MSwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzYyNzkwNDgwLCJleHAiOjE3NjI3OTIyODB9.zY-KGo7QrbX3mrhtYzgUowLO5yHSHPoMYALE54ZrqIs"; // ← 네 토큰을 여기에 그대로 넣어

export default function AnalyticsPage() {
  // 센서/선택
  const [sensors, setSensors] = useState([]);
  const [sensorId, setSensorId] = useState("");

  // 폼 상태
  const [metric, setMetric] = useState("temp"); // temp|hum|both
  const [bucket, setBucket] = useState("10m");
  const [fromDate, setFromDate] = useState(dateStr(0));       // 오늘
  const [fromTime, setFromTime] = useState(timeMinusHours(24));// 지금-24h
  const [toDate, setToDate] = useState(dateStr(0));           // 오늘
  const [toTime, setToTime] = useState(nowHM());              // 지금

  // 데이터/상태
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // 공통 헤더(하드코딩 토큰)
  const headers = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Authorization": `Bearer ${DEV_TOKEN}`,
  };

  // 센서 목록
  async function fetchSensors() {
    setErr("");
    try {
      const url = `${API_BASE}/api/v1/sensors?page=1&size=200&sort=created_at%20DESC`;
      console.log("[GET] sensors:", url);
      const res = await fetch(url, { method: "GET", headers });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${res.statusText} :: ${text.slice(0,120)}`);
      }
      const json = await res.json();
      console.log("[RESP sensors]", json);
      if (!json?.is_sucsess) throw new Error(json?.message || "센서 목록 실패");

      const list = Array.isArray(json.data) ? json.data : [];
      setSensors(list);
      if (!sensorId && list.length) setSensorId(String(list[0].id));
    } catch (e) {
      setErr(e.message || String(e));
      setSensors([]);
    }
  }

  // 시계열
  async function fetchSeries() {
    if (!sensorId) return;
    setLoading(true);
    setErr("");
    try {
      // 백엔드가 UTC를 기대하면 아래 두 줄을 toISOString()으로 바꿔봐
      const from = `${fromDate}T${fromTime}:00`;
      const to   = `${toDate}T${toTime}:00`;

      const url = `${API_BASE}/api/v1/sensor-data?sensor_id=${encodeURIComponent(sensorId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&bucket=${encodeURIComponent(bucket)}`;
      console.log("[GET] series:", url);

      const res = await fetch(url, { method: "GET", headers });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${res.statusText} :: ${text.slice(0,120)}`);
      }
      const json = await res.json();
      console.log("[RESP series]", json);

      if (!json?.is_sucsess) throw new Error(json?.message || "데이터 조회 실패");

      const data = (json.data || []).map((d) => {
        const ts = d.ts ?? d.timestamp ?? d.time;
        return {
          label: safeTime(ts),
          temp: toNum(d.temp ?? d.temperature ?? d.t),
          hum:  toNum(d.hum  ?? d.humidity    ?? d.h),
        };
      });

      setRows(data);
    } catch (e) {
      setErr(e.message || String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  // 최초 로드: 센서
  useEffect(() => { fetchSensors(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 12px" }}>데이터분석</h1>

      {/* 컨트롤 바 */}
      <div style={bar}>
        <div style={row}>
          <select value={sensorId} onChange={(e)=>setSensorId(e.target.value)} style={sel}>
            {sensors.map(s => (
              <option key={s.id} value={s.id}>
                {s.model ? `${s.model} (#${s.id})` : `센서 #${s.id}`}
              </option>
            ))}
          </select>

          <select value={metric} onChange={(e)=>setMetric(e.target.value)} style={sel}>
            <option value="temp">항목 온도</option>
            <option value="hum">항목 습도</option>
            <option value="both">온도 + 습도</option>
          </select>

          <select value={bucket} onChange={(e)=>setBucket(e.target.value)} style={sel}>
            <option value="5m">간격 5분</option>
            <option value="10m">간격 10분</option>
            <option value="30m">간격 30분</option>
            <option value="1h">간격 1시간</option>
          </select>
        </div>

        <div style={row}>
          <input type="date" value={fromDate} onChange={(e)=>setFromDate(e.target.value)} style={inp}/>
          <input type="time" value={fromTime} onChange={(e)=>setFromTime(e.target.value)} style={inp}/>
          <input type="date" value={toDate} onChange={(e)=>setToDate(e.target.value)} style={inp}/>
          <input type="time" value={toTime} onChange={(e)=>setToTime(e.target.value)} style={inp}/>
          <button onClick={fetchSeries} disabled={loading || !sensorId} style={btnPrimary}>
            {loading ? "조회중…" : "조회"}
          </button>
        </div>
      </div>

      {err && <div style={{ color: "#dc2626", marginTop: 8 }}>{err}</div>}

      {/* 차트 */}
      <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:8, padding: 12, marginTop: 12 }}>
        <div style={{ color:"#475569", fontSize:14, marginBottom: 8 }}>
          {labelRange(fromDate, fromTime, toDate, toTime)} · {bucket}
        </div>
        <div style={{ width: "100%", height: 420 }}>
          <ResponsiveContainer>
            <LineChart data={rows} margin={{ top: 12, right: 16, bottom: 12, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" minTickGap={20} />
              <YAxis />
              <Tooltip />
              {(metric === "temp" || metric === "both") && (
                <Line type="monotone" dataKey="temp" dot={false} name="온도(°C)" />
              )}
              {(metric === "hum" || metric === "both") && (
                <Line type="monotone" dataKey="hum" dot={false} name="습도(%)" />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

/* 스타일 */
const bar = { display: "grid", gridTemplateColumns: "1fr", gap: 8 };
const row = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 };
const sel = { height: 36, padding: "0 10px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff" };
const inp = { height: 36, padding: "0 10px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff" };
const btnPrimary = { padding: "8px 12px", borderRadius: 8, border: "1px solid #111827", background: "#111827", color: "#fff", cursor: "pointer" };

/* 유틸 */
function dateStr(deltaDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}
function nowHM() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}
function timeMinusHours(h=24) {
  const d = new Date();
  d.setHours(d.getHours() - h);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}
function safeTime(ts) {
  try {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  } catch { return String(ts); }
}
function labelRange(fd, ft, td, tt) { return `${fd} ${ft} ~ ${td} ${tt}`; }
function toNum(v){ const n = Number(v); return Number.isFinite(n) ? n : undefined; }
