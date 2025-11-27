import React, { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from "recharts";
import { api, getAccessToken } from "../lib/api.js";

function typeSymbol(type) {
  if (type === "temperature") return "℃";
  if (type === "humidity") return "%";
  return "";
}

export default function AnalyticsPage() {
  const [sensors, setSensors] = useState([]);
  const [sensorId, setSensorId] = useState("");
  const [range, setRange] = useState("24h");    // 1h|6h|24h|7d

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [rangeLabel, setRangeLabel] = useState("");

  async function fetchSensors() {
    setErr("");
    try {
      if (!getAccessToken()) { window.location.assign("/login"); return; }
      const q = new URLSearchParams({ page: "1", size: "200", sort: "created_at DESC" });
      const json = await api(`/api/v1/sensors?${q.toString()}`);
      if (!json?.is_sucsess) throw new Error(json?.message || "센서 목록 실패");

      const list = Array.isArray(json.data) ? json.data : [];
      setSensors(list);
      if (!sensorId && list.length) setSensorId(String(list[0].id));
    } catch (e) {
      setErr(e.message || String(e));
      setSensors([]);
    }
  }

  async function fetchSeries() {
    if (!sensorId) return;
    setLoading(true);
    setErr("");

    try {
      if (!getAccessToken()) { window.location.assign("/login"); return; }

      // ✅ 기간(range)으로 from/to, bucket 자동 계산
      const now = new Date();
      const { from, to, fromObj, toObj } = buildRange(range, now);
      const bucket = chooseBucket(fromObj, toObj);

      const q = new URLSearchParams({
        sensor_id: String(sensorId),
        from: from.toISOString(),
        to: to.toISOString(),
        bucket,
      });

      const json = await api(`/api/v1/sensor-data?${q.toString()}`);
      if (!json?.is_sucsess) throw new Error(json?.message || "데이터 조회 실패");

      const data = (json.data || []).map((d) => ({
        label: safeTime(d.upload_at),
        temp: toNum(d.data_value),
        hum: undefined, // 나중에 습도 센서 생기면 분기해서 채우면 됨
      }));

      setRows(data);
      setRangeLabel(formatRange(fromObj, toObj, range));
    } catch (e) {
      setErr(e.message || String(e));
      setRows([]);
      setRangeLabel("");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchSensors(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);

  const sensor = sensors.find(s => String(s.id) === String(sensorId));
  const type = sensor?.sensor_type ?? "temperature"; // "temperature" or "humidity"

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 12px" }}>데이터분석</h1>

      {/* 상단 컨트롤 바: 센서 / 기간 / 조회 */}
      <div style={bar}>
        <div style={row}>
          <select value={sensorId} onChange={(e)=>setSensorId(e.target.value)} style={sel}>
            {sensors.map(s => (
              <option key={s.id} value={s.id}>
                {s.model ? `${s.model} (#${s.id}/${typeSymbol(s.sensor_type)})` : `SEN${s.id} (#${s.id}/${typeSymbol(s.sensor_type)})`}
              </option>
            ))}
          </select>

          {/* ✅ 기간만 선택 */}
          <select value={range} onChange={(e)=>setRange(e.target.value)} style={sel}>
            <option value="1h">최근 1시간</option>
            <option value="6h">최근 6시간</option>
            <option value="24h">최근 24시간</option>
            <option value="7d">최근 7일</option>
          </select>

          <button onClick={fetchSeries} disabled={loading || !sensorId} style={btnPrimary}>
            {loading ? "조회중…" : "조회"}
          </button>
        </div>
      </div>

      {err && <div style={{ color: "#dc2626", marginTop: 8 }}>{err}</div>}

      <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:8, padding: 12, marginTop: 12 }}>
        <div style={{ color:"#475569", fontSize:14, marginBottom: 8 }}>
          {rangeLabel || "조회 범위 없음"}
        </div>
        <div style={{ width: "100%", height: 420 }}>
          <ResponsiveContainer>
            <LineChart data={rows} margin={{ top: 12, right: 16, bottom: 12, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" minTickGap={20} />
              <YAxis />
              <Tooltip />
              {(type === "temperature") && (
                <Line type="monotone" dataKey="temp" dot={false} name="온도(°C)" />
              )}
              {(type === "humidity") && (
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
const btnPrimary = { padding: "8px 12px", borderRadius: 8, border: "1px solid #111827", background: "#111827", color: "#fff", cursor: "pointer" };

/* 유틸 */
function safeTime(ts) {
  try {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  } catch {
    return String(ts);
  }
}

function toNum(v){ const n = Number(v); return Number.isFinite(n) ? n : undefined; }

// range에 따라 from/to 계산
function buildRange(range, base = new Date()) {
  const to = new Date(base);
  const from = new Date(base);
  switch (range) {
    case "1h":
      from.setHours(from.getHours() - 1);
      break;
    case "6h":
      from.setHours(from.getHours() - 6);
      break;
    case "24h":
      from.setHours(from.getHours() - 24);
      break;
    case "7d":
      from.setDate(from.getDate() - 7);
      break;
    default:
      from.setHours(from.getHours() - 24);
  }
  return { from, to, fromObj: from, toObj: to };
}

// 기간 길이에 따라 bucket 자동 선택
function chooseBucket(from, to) {
  const ms = to.getTime() - from.getTime();
  const hours = ms / (1000 * 60 * 60);

  if (hours <= 6) return "5m";
  if (hours <= 24) return "10m";
  if (hours <= 24 * 7) return "30m";
  return "1h";
}

function formatRange(from, to, range) {
  // “최근 24시간” 같은 문구를 우선 보여주고 싶으면 그냥 이거 리턴해도 됨
  switch (range) {
    case "1h":  return "최근 1시간";
    case "6h":  return "최근 6시간";
    case "24h": return "최근 24시간";
    case "7d":  return "최근 7일";
    default:    return `${from.toISOString()} ~ ${to.toISOString()}`;
  }
}
