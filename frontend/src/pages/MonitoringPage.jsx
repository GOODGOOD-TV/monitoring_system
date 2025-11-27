import React, { useEffect, useMemo, useRef, useState } from "react";
import { api, getAccessToken } from "../lib/api.js";
import SensorCard from "../components/SensorCard.jsx";

export default function MonitoringPage() {
  const [tiles, setTiles] = useState([]);      // {id, area, name, type, value, unit, lastAt, alert}
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);
  const [total, setTotal] = useState(0);

  const baseHost = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";
  const url = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), size: String(size) });
    return `${baseHost}/api/v1/sensors?${p.toString()}`;
  }, [baseHost, page, size]);

  // --- 1) 최초 목록: 구역/이름/타입 세팅 (값은 null)
  async function fetchSensors() {
    setLoading(true);
    setError("");
    try {
      if (!getAccessToken()) { window.location.assign("/login"); return; }
      const list = await api(`/api/v1/sensors?${new URLSearchParams({ page, size })}`);
      if (!list?.is_sucsess) throw new Error(list?.message || "API 실패");

      const adapted = (list.data ?? []).map(s => {
        const type = String(s.sensor_type || "").toLowerCase(); // 'temperature' | 'humidity'
        const unit = type === "humidity" ? "%" : "°C";
        return {
          id: s.id,
          area: s.area_name ?? s.area?.name ?? "-",
          name: s.name ?? s.model ?? "-",
          type,
          unit,
          value: null,             // 최신값은 폴링으로 채운다
          lastAt: null,
          alert: Number(s.is_alarm) === 1,
          _raw: s,
        };
      });

      setTiles(adapted);
      setTotal(list.meta?.total ?? adapted.length);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchSensors(); /* eslint-disable-next-line */ }, [url]);

  // --- 2) 최신값 폴링: 1초마다 갱신 (페이지 바뀌면 대상도 바뀜)
  useSmartPolling({
    deps: [tiles.map(t => t.id).join(","), page, size],
    intervalMs: 1000,
    task: async () => {
      if (!tiles.length) return;

      // (A) 배치 엔드포인트가 있는 경우 권장:
      // GET /api/v1/sensor-data/latest?ids=1,2,3
      let latest;
      try {
        const ids = tiles.map(t => t.id).join(",");
        latest = await api(`/api/v1/sensor-data/latest?${new URLSearchParams({ ids })}`);
      } catch (_) {
        latest = null;
      }

      // (B) 폴백: 센서별 1건씩(사이즈 1, 최신순)
      if (!latest?.is_sucsess) {
        const results = await Promise.allSettled(
          tiles.map(t => api(`/api/v1/sensor-data?${new URLSearchParams({
            sensor_id: t.id, mode: "raw", size: 1, sort: "desc", sensor_type: t.type
          })}`))
        );
        const data = [];
        results.forEach((r, i) => {
          if (r.status === "fulfilled" && r.value?.is_sucsess) {
            const row = r.value.data?.[0];
            if (row) data.push({ sensor_id: tiles[i].id, row });
          }
        });
        // row에서 type별 값 꺼내 매핑
        const map = new Map(
          data.map(({ sensor_id, row }) => {
            // 백엔드 포맷에 맞춰 키를 고정: temperature / humidity 둘 중 하나만 온다
            const v = row.data_value ?? row.value ?? row.temperature ?? row.humidity ?? null;
            const ts = row.upload_at ?? row.ts ?? row.upload_dtm ?? row.created_at ?? null;
            return [sensor_id, { value: v, ts, type: row.sensor_type }];
          })
        );
        setTiles(prev => prev.map(t => {
          const v = map.get(t.id);
          return v ? { ...t, value: sanitizeNumber(v.value), lastAt: v.ts, ...(v.type ? { type: v.type, unit: v.type === 'humidity' ? '%' : '°C' } : {})} : t;
        }));
        return;
      }

      // (A) 배치 응답 처리 (스키마: [{ sensor_id, sensor_type, data_value, upload_at }])
      const map = new Map((latest.data ?? []).map(r => {
        const v = r.data_value ?? r.value ?? r.temperature ?? r.humidity ?? null;
        const ts = r.upload_at ?? r.ts ?? r.upload_dtm ?? r.created_at ?? null;
        return [r.sensor_id, { value: v, ts, type: r.sensor_type }];
      }));
      setTiles(prev => prev.map(t => {
        const v = map.get(t.id);
        return v ? { ...t, value: sanitizeNumber(v.value), lastAt: v.ts, ...(v.type ? { type: v.type, unit: v.type === 'humidity' ? '%' : '°C' } : {})} : t;
      }));
    },
  });

  const totalPages = Math.max(1, Math.ceil(total / size));
  const hasAlert = tiles.some(t => t.alert);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>모니터링</h1>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={fetchSensors} style={btnSecondary()} disabled={loading}>
            {loading ? "불러오는 중…" : "새로고침"}
          </button>
        </div>
      </div>

      <div style={{ position: "relative", background: "#d1d5db", borderRadius: 8, padding: 40, minHeight: 420 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 160px)", gap: 48, justifyContent: "center" }}>
          {tiles.map(t => (<SensorCard key={t.id} item={t} locked />))}
        </div>

        {hasAlert && (
          <div style={modalBox}>
            <div style={{ color: "#dc2626", fontWeight: 700 }}>알람 발생 센서 존재</div>
            <button style={btnSecondary()} onClick={() => { /* 필요시 토글 */ }}>확인</button>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
        <button style={btnSecondary()} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={loading || page <= 1}>이전</button>
        <span style={{ alignSelf: "center", color: "#475569", fontSize: 14 }}>{page} / {totalPages}</span>
        <button style={btnSecondary()} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={loading || page >= totalPages}>다음</button>
      </div>
      {error && <div style={{ color: "#dc2626", marginTop: 8 }}>{error}</div>}
    </div>
  );
}

/* 유틸: 폴링(탭 비활성 시 자동 일시정지) */
function useSmartPolling({ deps = [], intervalMs = 1000, task }) {
  const timerRef = useRef(null);
  useEffect(() => {
    let mounted = true;
    async function tick() { if (mounted) await task(); }
    function start() {
      if (timerRef.current) return;
      timerRef.current = setInterval(tick, intervalMs);
    }
    function stop() {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
    // 처음 한 번 즉시 실행
    tick();
    start();
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);
    return () => { mounted = false; stop(); document.removeEventListener("visibilitychange", onVisibility); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

function sanitizeNumber(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/* 스타일 */
function btnSecondary() { return { padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", color: "#111827", cursor: "pointer" }; }
const modalBox = {
  position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)",
  background: "#fff", border: "1px solid #d1d5db", boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
  borderRadius: 8, padding: "20px 24px", textAlign: "center", whiteSpace: "pre-line", zIndex: 10,
};
