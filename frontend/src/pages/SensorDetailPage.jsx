// src/pages/sensordetail.js
import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { api } from "../lib/api";

function getUnit(sensorType) {
  if (sensorType === "temperature") return "℃";
  if (sensorType === "humidity") return "%";
  return "";
}

function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

export default function SensorDetailPage() {
  const navigate = useNavigate();
  const { areaId, sensorId } = useParams(); // /zones/:areaId/sensors/:sensorId
  const location = useLocation();

  const areaName =
    (location.state && location.state.areaName) ||
    (areaId ? `Area ${areaId}` : "구역");

  const [sensor, setSensor] = useState(null);
  const [dataList, setDataList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sensorId) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const sensorRes = await api(`/api/v1/sensors/${sensorId}`);
        const s = sensorRes?.data || sensorRes || {};

        const dataRes = await api(
          `/api/v1/sensors/${sensorId}/data?limit=50`
        );
        let rows = dataRes?.data || dataRes || [];
        if (!Array.isArray(rows)) rows = [];

        rows.sort(
          (a, b) => new Date(b.upload_at) - new Date(a.upload_at)
        );

        if (!cancelled) {
          setSensor(s);
          setDataList(rows);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || "센서 데이터를 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [sensorId]);

  const latest = dataList[0] || null;
  const unit = getUnit(sensor?.sensor_type);

  const handleEditClick = () => {
    navigate(`/zones/${areaId}/sensors/${sensorId}/edit`, {
      state: { areaName },
    });
  };

  const handleDeleteClick = async () => {
    if (!window.confirm("이 센서를 비활성화하시겠습니까?")) return;

    try {
      await api(`/api/v1/sensors/${sensorId}`, {
        method: "PATCH",
        body: { is_active: 0 },
      });
      setSensor((prev) => (prev ? { ...prev, is_active: 0 } : prev));
      alert("센서를 비활성화했습니다.");
    } catch (e) {
      alert(e?.message || "센서를 비활성화하지 못했습니다.");
    }
  };

  return (
    <div className="page sensor-detail-page" style={{ padding: 24 }}>
      <button
        type="button"
        onClick={() => navigate(-1)}
        style={{
          border: "1px solid #e5e7eb",
          background: "#fff",
          borderRadius: 6,
          padding: "4px 8px",
          cursor: "pointer",
          marginBottom: 8,
          fontSize: 14,
        }}
      >
        ← 센서관리로 돌아가기
      </button>

      <header
        style={{
          marginBottom: 24,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 16,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 14,
              color: "#666",
              marginBottom: 4,
            }}
          >
            센서관리 · {areaName} · 센서 상세
          </div>
          <h1 style={{ fontSize: 28, margin: 0 }}>센서 상세</h1>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 8,
          }}
        >
          {sensor && (
            <div
              style={{
                padding: "16px 32px",
                backgroundColor: "#fff",
                borderRadius: 12,
                boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                fontSize: 20,
                fontWeight: 600,
                minWidth: 160,
                textAlign: "center",
              }}
            >
              {sensor.model}
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={handleEditClick}
              style={{
                padding: "6px 14px",
                borderRadius: 999,
                border: "1px solid #228be6",
                backgroundColor: "#228be6",
                color: "#fff",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              센서 수정
            </button>
            <button
              type="button"
              onClick={handleDeleteClick}
              style={{
                padding: "6px 14px",
                borderRadius: 999,
                border: "1px solid #e03131",
                backgroundColor: "#fff",
                color: "#e03131",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              센서 삭제
            </button>
          </div>
        </div>
      </header>

      {loading && <div>로딩 중...</div>}
      {!loading && error && (
        <div style={{ color: "red", marginBottom: 16 }}>{error}</div>
      )}

      {!loading && !error && sensor && (
        <>
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1.4fr)",
              gap: 24,
              marginBottom: 32,
            }}
          >
            <div
              style={{
                backgroundColor: "#e7ecf2",
                borderRadius: 16,
                padding: 24,
              }}
            >
              <h2
                style={{
                  fontSize: 20,
                  marginBottom: 16,
                }}
              >
                현재 상태
              </h2>

              <div
                style={{
                  backgroundColor: "#fff",
                  borderRadius: 16,
                  padding: 24,
                  boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                }}
              >
                <div
                  style={{
                    fontSize: 16,
                    marginBottom: 8,
                  }}
                >
                  측정 값
                </div>
                <div
                  style={{
                    fontSize: 40,
                    fontWeight: 700,
                    marginBottom: 12,
                  }}
                >
                  {latest ? (
                    <>
                      {latest.data_value}
                      {unit && <span> {unit}</span>}
                    </>
                  ) : (
                    "-"
                  )}
                </div>
                <div style={{ fontSize: 14, color: "#555" }}>
                  측정 시간:{" "}
                  {latest ? formatDateTime(latest.upload_at) : "-"}
                </div>
              </div>
            </div>

            <div
              style={{
                backgroundColor: "#e7ecf2",
                borderRadius: 16,
                padding: 24,
              }}
            >
              <h2
                style={{
                  fontSize: 20,
                  marginBottom: 16,
                }}
              >
                센서 정보
              </h2>

              <div
                style={{
                  backgroundColor: "#fff",
                  borderRadius: 16,
                  padding: 20,
                  boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                  fontSize: 14,
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                  }}
                >
                  <tbody>
                    <tr>
                      <th style={thStyle}>센서 ID</th>
                      <td style={tdStyle}>{sensor.id}</td>
                    </tr>
                    <tr>
                      <th style={thStyle}>타입</th>
                      <td style={tdStyle}>{sensor.sensor_type}</td>
                    </tr>
                    <tr>
                      <th style={thStyle}>회사 ID</th>
                      <td style={tdStyle}>{sensor.company_id}</td>
                    </tr>
                    <tr>
                      <th style={thStyle}>구역 ID</th>
                      <td style={tdStyle}>{sensor.area_id}</td>
                    </tr>
                    <tr>
                      <th style={thStyle}>상태</th>
                      <td style={tdStyle}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 10px",
                            borderRadius: 999,
                            fontSize: 12,
                            marginRight: 6,
                            backgroundColor: sensor.is_active
                              ? "#d3f9d8"
                              : "#f1f3f5",
                            color: sensor.is_active
                              ? "#2b8a3e"
                              : "#868e96",
                          }}
                        >
                          {sensor.is_active ? "ACTIVE" : "INACTIVE"}
                        </span>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 10px",
                            borderRadius: 999,
                            fontSize: 12,
                            backgroundColor: sensor.is_alarm
                              ? "#ffe3e3"
                              : "#f1f3f5",
                            color: sensor.is_alarm ? "#c92a2a" : "#868e96",
                          }}
                        >
                          {sensor.is_alarm ? "ALARM ON" : "ALARM OFF"}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <th style={thStyle}>하한(threshold_min)</th>
                      <td style={tdStyle}>
                        {sensor.threshold_min ?? "-"}
                      </td>
                    </tr>
                    <tr>
                      <th style={thStyle}>상한(threshold_max)</th>
                      <td style={tdStyle}>
                        {sensor.threshold_max ?? "-"}
                      </td>
                    </tr>
                    <tr>
                      <th style={thStyle}>생성일</th>
                      <td style={tdStyle}>
                        {formatDateTime(sensor.created_at)}
                      </td>
                    </tr>
                    <tr>
                      <th style={thStyle}>수정일</th>
                      <td style={tdStyle}>
                        {formatDateTime(sensor.updated_at)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section>
            <h2
              style={{
                fontSize: 20,
                marginBottom: 12,
              }}
            >
              최근 데이터
            </h2>

            <div
              style={{
                backgroundColor: "#fff",
                borderRadius: 12,
                boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                padding: 16,
                overflowX: "auto",
              }}
            >
              {dataList.length === 0 ? (
                <div>데이터가 없습니다.</div>
              ) : (
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 14,
                  }}
                >
                  <thead>
                    <tr>
                      <th style={theadThStyle}>시간</th>
                      <th style={theadThRight}>데이터 번호</th>
                      <th style={theadThRight}>값</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataList.map((row, idx) => (
                      <tr key={`${row.sensor_id || sensorId}-${idx}`}>
                        <td style={tbodyTdStyle}>
                          {formatDateTime(row.upload_at)}
                        </td>
                        <td style={tbodyTdRight}>{row.data_no}</td>
                        <td style={tbodyTdRight}>
                          {row.data_value}
                          {unit && <span> {unit}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

const thStyle = {
  textAlign: "left",
  padding: "4px 0",
  color: "#666",
  width: "32%",
};

const tdStyle = {
  padding: "4px 0",
};

const theadThStyle = {
  textAlign: "left",
  padding: "8px 4px",
  borderBottom: "1px solid #dee2e6",
};

const theadThRight = {
  textAlign: "right",
  padding: "8px 4px",
  borderBottom: "1px solid #dee2e6",
};

const tbodyTdStyle = {
  padding: "6px 4px",
  borderBottom: "1px solid #f1f3f5",
};

const tbodyTdRight = {
  padding: "6px 4px",
  borderBottom: "1px solid #f1f3f5",
  textAlign: "right",
};
