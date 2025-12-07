import React, { useCallback, useEffect, useRef, useState } from "react";
import { api, getAccessToken, API_BASE } from "../lib/api.js";
import SensorCard from "../components/SensorCard.jsx";

export default function MonitoringPage() {
  const [tiles, setTiles] = useState([]); // {id, area, name, type, value, unit, lastAt, alert, thresholdMin, thresholdMax}
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);
  const [total, setTotal] = useState(0);

  const [showAlertModal, setShowAlertModal] = useState(false);

  // --- 1) 최초 목록: 구역/이름/타입/임계값 세팅 (값은 null)
  const fetchSensors = useCallback(async () => {
    if (!getAccessToken()) {
      window.location.assign("/login");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const list = await api(
        `/sensors?${new URLSearchParams({ page, size })}`
      );
      if (!list?.is_sucsess) throw new Error(list?.message || "API 실패");

      const adapted = (list.data ?? []).map((s) => {
        const type = String(s.sensor_type || "").toLowerCase(); // 'temperature' | 'humidity'
        const unit = type === "humidity" ? "%" : "°C";

        // 백엔드 스키마에 따라 여러 케이스 대비
        const thresholdMin =
          s.threshold_min ??
          s.thresholdMin ??
          s.threshold?.min ??
          null;
        const thresholdMax =
          s.threshold_max ??
          s.thresholdMax ??
          s.threshold?.max ??
          null;

        return {
          id: s.id,
          area: s.area_name ?? s.area?.name ?? "-",
          name: s.name ?? s.model ?? "-",
          type,
          unit,
          value: null, // 최신값은 폴링으로 채움
          lastAt: null,
          // alert는 "현재값 vs 임계값" 기준으로만 계산하므로 초기에는 false
          alert: false,
          thresholdMin,
          thresholdMax,
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
  }, [page, size]);

  // 페이지/사이즈 바뀔 때마다 목록 다시 조회
  useEffect(() => {
    fetchSensors();
  }, [fetchSensors]);

  // --- 2) 최신값 폴링 task (현재 tiles 기준으로 값/알람 갱신)
  const pollingTask = useCallback(async () => {
    if (!tiles.length) return;

    // (A) 배치 엔드포인트가 있는 경우 권장:
    let latest;
    try {
      const ids = tiles.map((t) => t.id).join(",");
      latest = await api(
        `/sensor-data/latest?${new URLSearchParams({ ids })}`
      );
    } catch (_) {
      latest = null;
    }

    // 공통: value → alert 계산 함수
    const applyLatestMap = (map) => {
      setTiles((prev) =>
        prev.map((t) => {
          const v = map.get(t.id);
          if (!v) return t;

          const nextValue = sanitizeNumber(v.value);
          const thresholdMin = t.thresholdMin;
          const thresholdMax = t.thresholdMax;

          let alert = false;
          if (nextValue != null) {
            if (thresholdMin != null && nextValue < thresholdMin) {
              alert = true;
            }
            if (thresholdMax != null && nextValue > thresholdMax) {
              alert = true;
            }
          }

          return {
            ...t,
            value: nextValue,
            lastAt: v.ts,
            alert,
            ...(v.type
              ? {
                  type: v.type,
                  unit: v.type === "humidity" ? "%" : "°C",
                }
              : {}),
          };
        })
      );
    };

    // (B) 폴백: 센서별 1건씩
    if (!latest?.is_sucsess) {
      const results = await Promise.allSettled(
        tiles.map((t) =>
          api(
            `/sensor-data?${new URLSearchParams({
              sensor_id: t.id,
              mode: "raw",
              size: 1,
              sort: "desc",
              sensor_type: t.type,
            })}`
          )
        )
      );
      const data = [];
      results.forEach((r, i) => {
        if (r.status === "fulfilled" && r.value?.is_sucsess) {
          const row = r.value.data?.[0];
          if (row)
            data.push({
              sensor_id: tiles[i].id,
              row,
            });
        }
      });

      const map = new Map(
        data.map(({ sensor_id, row }) => {
          const v =
            row.data_value ??
            row.value ??
            row.temperature ??
            row.humidity ??
            null;
          const ts =
            row.upload_at ??
            row.ts ??
            row.upload_dtm ??
            row.created_at ??
            null;
          return [sensor_id, { value: v, ts, type: row.sensor_type }];
        })
      );

      applyLatestMap(map);
      return;
    }

    // (A) 배치 응답 처리
    const map = new Map(
      (latest.data ?? []).map((r) => {
        const v =
          r.data_value ?? r.value ?? r.temperature ?? r.humidity ?? null;
        const ts =
          r.upload_at ?? r.ts ?? r.upload_dtm ?? r.created_at ?? null;
        return [r.sensor_id, { value: v, ts, type: r.sensor_type }];
      })
    );

    applyLatestMap(map);
  }, [tiles]);

  // --- 3) 폴링 훅 사용 (센서 ID / 페이지 / 사이즈 / task 변경 시 재설정)
  useSmartPolling({
    deps: [tiles.map((t) => t.id).join(","), page, size, pollingTask],
    intervalMs: 1000,
    task: pollingTask,
  });

  const totalPages = Math.max(1, Math.ceil(total / size));
  const hasAlert = tiles.some((t) => t.alert);

  // 알람이 새로 생기면 모달 다시 띄우기
  useEffect(() => {
    if (hasAlert) setShowAlertModal(true);
  }, [hasAlert]);

  return (
    <div style={{ padding: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
          모니터링
        </h1>
        <div
          style={{ marginLeft: "auto", display: "flex", gap: 8 }}
        >
          <button
            onClick={fetchSensors}
            style={btnSecondary()}
            disabled={loading}
          >
            {loading ? "불러오는 중…" : "새로고침"}
          </button>
        </div>
      </div>

      <div
        style={{
          position: "relative",
          background: "#d1d5db",
          borderRadius: 8,
          padding: 40,
          minHeight: 420,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 160px)",
            gap: 48,
            justifyContent: "center",
          }}
        >
          {tiles.map((t) => (
            <SensorCard key={t.id} item={t} locked />
          ))}
        </div>

        {hasAlert && showAlertModal && (
          <div style={modalBox}>
            <div
              style={{
                color: "#dc2626",
                fontWeight: 700,
                marginBottom: 12,
              }}
            >
              임계값을 벗어난 센서가 있습니다.
            </div>
            <button
              style={btnSecondary()}
              onClick={() => setShowAlertModal(false)}
            >
              확인
            </button>
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "center",
          marginTop: 12,
        }}
      >
        <button
          style={btnSecondary()}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={loading || page <= 1}
        >
          이전
        </button>
        <span
          style={{
            alignSelf: "center",
            color: "#475569",
            fontSize: 14,
          }}
        >
          {page} / {totalPages}
        </span>
        <button
          style={btnSecondary()}
          onClick={() =>
            setPage((p) => Math.min(totalPages, p + 1))
          }
          disabled={loading || page >= totalPages}
        >
          다음
        </button>
      </div>
      {error && (
        <div style={{ color: "#dc2626", marginTop: 8 }}>{error}</div>
      )}
    </div>
  );
}

/* 유틸: 폴링(탭 비활성 시 자동 일시정지) */
function useSmartPolling({ deps = [], intervalMs = 1000, task }) {
  const timerRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    async function tick() {
      if (mounted) await task();
    }
    function start() {
      if (timerRef.current) return;
      timerRef.current = setInterval(tick, intervalMs);
    }
    function stop() {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    // 처음 한 번 즉시 실행
    tick();
    start();

    const onVisibility = () =>
      document.hidden ? stop() : start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      mounted = false;
      stop();
      document.removeEventListener(
        "visibilitychange",
        onVisibility
      );
    };
  }, deps);
}

function sanitizeNumber(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/* 스타일 */
function btnSecondary() {
  return {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#111827",
    cursor: "pointer",
  };
}

const modalBox = {
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
};
