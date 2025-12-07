import React, { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { api, getAccessToken, API_BASE } from "../lib/api.js";

function typeSymbol(type) {
  if (type === "temperature") return "℃";
  if (type === "humidity") return "%";
  return "";
}

// 보고서 시간 옵션 (hours 기준)
const REPORT_HOUR_OPTIONS = [
  { value: 24, label: "최근 24시간" },
  { value: 24 * 7, label: "최근 7일" },
  { value: 24 * 30, label: "최근 1개월" },
  { value: 24 * 30 * 6, label: "최근 6개월" },
];

export default function AnalyticsPage() {
  const [sensors, setSensors] = useState([]);
  const [sensorId, setSensorId] = useState("");
  const [range, setRange] = useState("24h"); // 1h|6h|24h|7d

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [rangeLabel, setRangeLabel] = useState("");

  const [forecastRows, setForecastRows] = useState([]);

  // 🔹 보고서 모달 상태
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportSensorId, setReportSensorId] = useState("");
  const [reportName, setReportName] = useState("");
  const [reportHours, setReportHours] = useState(24); // 기본 24시간
  const [reporting, setReporting] = useState(false);
  const [reportMsg, setReportMsg] = useState("");
  const [reportErr, setReportErr] = useState("");

  async function fetchSensors() {
    setErr("");
    try {
      if (!getAccessToken()) {
        window.location.assign("/login");
        return;
      }
      const q = new URLSearchParams({
        page: "1",
        size: "200",
        sort: "created_at DESC",
      });
      const json = await api(`/sensors?${q.toString()}`);
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
      if (!getAccessToken()) {
        window.location.assign("/login");
        return;
      }

      const now = new Date();
      const { from, to, fromObj, toObj } = buildRange(range, now);

      // 1) 실제 시계열 + 이상치
      const q1 = new URLSearchParams({
        sensor_id: String(sensorId),
        from: from.toISOString(),
        to: to.toISOString(),
      });

      // 2) 단기 예측(60분, 1분 간격)
      const q2 = new URLSearchParams({
        sensor_id: String(sensorId),
        horizon_minutes: "60",
        step_minutes: "1",
      });

      const [jsonSeries, jsonForecast] = await Promise.all([
        api(`/analytics/sensor-series?${q1.toString()}`),
        api(`/analytics/sensor-forecast?${q2.toString()}`),
      ]);

      if (!jsonSeries?.is_sucsess)
        throw new Error(jsonSeries?.message || "데이터 조회 실패");
      if (!jsonForecast?.is_sucsess)
        throw new Error(jsonForecast?.message || "예측 실패");

      const data = (jsonSeries.data || []).map((d) => {
        const t = d.upload_at || d.time;
        const v = toNum(d.value);
        return {
          label: safeTime(t),
          time: t,
          value: v,
          temp: v, // 온도 센서 기준
          hum: undefined,
          is_anomaly: !!d.is_anomaly,
          anomaly_score: d.anomaly_score ?? 0,
        };
      });

      const fc = (jsonForecast.data || []).map((d) => ({
        label: safeTime(d.predicted_at),
        time: d.predicted_at,
        value: toNum(d.value),
        lower: toNum(d.lower),
        upper: toNum(d.upper),
      }));

      setRows(data);
      setForecastRows(fc);
      setRangeLabel(formatRange(fromObj, toObj, range));
    } catch (e) {
      setErr(e.message || String(e));
      setRows([]);
      setForecastRows([]);
      setRangeLabel("");
    } finally {
      setLoading(false);
    }
  }

  // 🔹 보고서 모달 열기
  function openReportModal() {
    // 기본값: 현재 선택된 센서 / 24시간 / 이름 비움
    const fallbackSensorId =
      sensorId || (sensors.length ? String(sensors[0].id) : "");
    setReportSensorId(fallbackSensorId);
    setReportHours(24);
    setReportName("");
    setReportErr("");
    setReportMsg("");
    setReportModalOpen(true);
  }

  // 🔹 보고서 생성 호출
  async function handleCreateReport() {
    if (!reportSensorId) {
      setReportErr("센서를 선택하세요.");
      return;
    }
    const token = getAccessToken();
    if (!token) {
      window.location.assign("/login");
      return;
    }

    setReporting(true);
    setReportErr("");
    setReportMsg("");

    try {
      const q = new URLSearchParams({
        sensor_id: String(reportSensorId),
        hours: String(reportHours),
      });
      if (reportName.trim()) {
        q.append("name", reportName.trim());
      }

      const url = `${API_BASE}/analytics/sensor-report/pdf?${q.toString()}`;

      const res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include", // refresh 쿠키 같이
      });

      if (res.status === 401 || res.status === 403) {
        setReportErr("세션이 만료되었습니다. 다시 로그인하세요.");
        return;
      }
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`보고서 생성 실패: ${txt}`);
      }

      const blob = await res.blob();
      const dlName =
        reportName.trim() ||
        `sensor-${reportSensorId}-report-${reportHours}h.pdf`;

      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = dlName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);

      setReportMsg("보고서 PDF가 다운로드되었습니다.");
      // 필요하면 모달 닫기
      // setReportModalOpen(false);
    } catch (e) {
      setReportErr(e.message || String(e));
    } finally {
      setReporting(false);
    }
  }

  useEffect(() => {
    fetchSensors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sensor = sensors.find((s) => String(s.id) === String(sensorId));
  const type = sensor?.sensor_type ?? "temperature"; // "temperature" or "humidity"
  const tmin =
    sensor?.threshold_min != null ? Number(sensor.threshold_min) - 3 : "auto";
  const tmax =
    sensor?.threshold_max != null ? Number(sensor.threshold_max) + 3 : "auto";

  return (
    <div style={{ padding: 16, position: "relative" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 12px" }}>
        데이터분석
      </h1>

      {/* 상단 컨트롤 바: 센서 / 기간 / 조회 */}
      <div style={bar}>
        <div style={row}>
          <select
            value={sensorId}
            onChange={(e) => setSensorId(e.target.value)}
            style={sel}
          >
            {sensors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.model
                  ? `${s.model} (#${s.id} / ${typeSymbol(s.sensor_type)})`
                  : `SEN${s.id} (#${s.id}/${typeSymbol(s.sensor_type)})`}
              </option>
            ))}
          </select>

          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            style={sel}
          >
            <option value="1h">최근 1시간</option>
            <option value="6h">최근 6시간</option>
            <option value="24h">최근 24시간</option>
            <option value="7d">최근 7일</option>
          </select>

          <button
            onClick={fetchSeries}
            disabled={loading || !sensorId}
            style={btnPrimary}
          >
            {loading ? "조회중…" : "조회"}
          </button>
        </div>
      </div>

      {err && <div style={{ color: "#dc2626", marginTop: 8 }}>{err}</div>}

      {/* 실제 데이터 차트 */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          padding: 12,
          marginTop: 12,
        }}
      >
        <div
          style={{
            color: "#475569",
            fontSize: 14,
            marginBottom: 8,
          }}
        >
          {rangeLabel || "조회 범위 없음"}
        </div>
        <div style={{ width: "100%", height: 420 }}>
          <ResponsiveContainer>
            <LineChart
              data={rows}
              margin={{ top: 12, right: 16, bottom: 12, left: 24 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" minTickGap={20} />
              <YAxis domain={[tmin, tmax]} />
              <Tooltip />
              {/* 임계값 하한선 */}
              {sensor?.threshold_min != null && (
                <ReferenceLine
                  y={sensor.threshold_min}
                  stroke="#22c55e"
                  strokeDasharray="4 4"
                  label={{
                    value: `하한 ${parseFloat(
                      sensor.threshold_min
                    ).toFixed(1)}`,
                    position: "left",
                    fontSize: 12,
                    fill: "#16a34a",
                    dx: -20,
                  }}
                />
              )}
              {/* 임계값 상한선 */}
              {sensor?.threshold_max != null && (
                <ReferenceLine
                  y={sensor.threshold_max}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  label={{
                    value: `상한 ${parseFloat(
                      sensor.threshold_max
                    ).toFixed(1)}`,
                    position: "left",
                    fontSize: 12,
                    fill: "#b91c1c",
                    dx: -20,
                  }}
                />
              )}
              {type === "temperature" && (
                <Line
                  type="monotone"
                  dataKey="temp"
                  dot={false}
                  name="온도(°C)"
                />
              )}
              {type === "humidity" && (
                <Line
                  type="monotone"
                  dataKey="hum"
                  dot={false}
                  name="습도(%)"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 예측 전용 차트 */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          padding: 12,
          marginTop: 12,
        }}
      >
        <div
          style={{
            color: "#475569",
            fontSize: 14,
            marginBottom: 8,
          }}
        >
          단기 예측 (다음 1시간)
        </div>
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer>
            <LineChart
              data={forecastRows}
              margin={{ top: 12, right: 16, bottom: 12, left: 24 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" minTickGap={20} />
              <YAxis domain={[tmin, tmax]} />
              <Tooltip />
              <Line type="monotone" dataKey="value" dot name="예측값" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 🔴 페이지 맨 아래 오른쪽: 보고서 생성 버튼 */}
      <div
        style={{
          marginTop: 16,
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <button
          style={btnSecondary}
          onClick={openReportModal}
          disabled={!sensors.length}
        >
          보고서 생성
        </button>
      </div>

      {/* 🔴 보고서 생성 모달 */}
      {reportModalOpen && (
        <div style={modalOverlay}>
          <div style={modalBox}>
            <h2
              style={{
                marginTop: 0,
                marginBottom: 12,
                fontSize: 18,
                fontWeight: 600,
              }}
            >
              센서 보고서 생성
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* 센서 선택 */}
              <div>
                <div style={modalLabel}>센서</div>
                <select
                  value={reportSensorId}
                  onChange={(e) => setReportSensorId(e.target.value)}
                  style={modalSelect}
                >
                  <option value="">센서 선택</option>
                  {sensors.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.model
                        ? `${s.model} (#${s.id} / ${typeSymbol(
                            s.sensor_type
                          )})`
                        : `SEN${s.id} (#${s.id}/${typeSymbol(s.sensor_type)})`}
                    </option>
                  ))}
                </select>
              </div>

              {/* 보고서 이름 */}
              <div>
                <div style={modalLabel}>보고서 이름 (선택)</div>
                <input
                  type="text"
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  placeholder="예: 11월 28일 24h 온도 분석"
                  style={modalInput}
                />
              </div>

              {/* 시간 선택 드롭다운 */}
              <div>
                <div style={modalLabel}>기간</div>
                <select
                  value={reportHours}
                  onChange={(e) => setReportHours(Number(e.target.value))}
                  style={modalSelect}
                >
                  {REPORT_HOUR_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {reportErr && (
                <div style={{ color: "#dc2626", fontSize: 13 }}>
                  {reportErr}
                </div>
              )}
              {reportMsg && (
                <div style={{ color: "#16a34a", fontSize: 13 }}>
                  {reportMsg}
                </div>
              )}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 18,
              }}
            >
              <button
                style={btnSecondary}
                onClick={() => setReportModalOpen(false)}
                disabled={reporting}
              >
                닫기
              </button>
              <button
                style={btnPrimary}
                onClick={handleCreateReport}
                disabled={reporting}
              >
                {reporting ? "생성 중…" : "확인"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* 스타일 */
const bar = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 8,
};
const row = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 8,
};
const sel = {
  height: 36,
  padding: "0 10px",
  borderRadius: 8,
  border: "1px solid #e5e7eb",
  background: "#fff",
};
const btnPrimary = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #111827",
  background: "#111827",
  color: "#fff",
  cursor: "pointer",
};
const btnSecondary = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #e5e7eb",
  background: "#fff",
  color: "#111827",
  cursor: "pointer",
};

/* 모달 스타일 */
const modalOverlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(15,23,42,0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 50,
};

const modalBox = {
  width: "100%",
  maxWidth: 420,
  background: "#fff",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
  padding: 20,
};

const modalLabel = {
  fontSize: 13,
  color: "#4b5563",
  marginBottom: 4,
};

const modalSelect = {
  width: "100%",
  height: 36,
  padding: "0 10px",
  borderRadius: 8,
  border: "1px solid #e5e7eb",
  background: "#fff",
};

const modalInput = {
  width: "100%",
  height: 36,
  padding: "0 10px",
  borderRadius: 8,
  border: "1px solid #e5e7eb",
  background: "#fff",
};

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

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

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

// 기간 길이에 따라 bucket 자동 선택 (지금은 안 쓰지만 유지)
function chooseBucket(from, to) {
  const ms = to.getTime() - from.getTime();
  const hours = ms / (1000 * 60 * 60);

  if (hours <= 6) return "5m";
  if (hours <= 24) return "10m";
  if (hours <= 24 * 7) return "30m";
  return "1h";
}

function formatRange(from, to, range) {
  switch (range) {
    case "1h":
      return "최근 1시간";
    case "6h":
      return "최근 6시간";
    case "24h":
      return "최근 24시간";
    case "7d":
      return "최근 7일";
    default:
      return `${from.toISOString()} ~ ${to.toISOString()}`;
  }
}
// 이메일로 보고서 전송 로직 필요
// PDF 자동 생성(그래프 + 분석)도 생각해봐야할듯. 이 경우 PDF 다운로드 + 이메일 전송