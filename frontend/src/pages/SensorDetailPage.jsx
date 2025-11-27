// src/pages/sensordetail.js

import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { api } from "../lib/api";

// 센서 타입에 따른 단위
function getUnit(sensorType) {
  if (sensorType === "temperature") return "℃";
  if (sensorType === "humidity") return "%";
  return "";
}

// 날짜 포맷
function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

export default function SensorDetail() {
  const navigate = useNavigate();
  const { areaId, sensorId } = useParams();
  const location = useLocation();

  // 구역 이름은 이전 페이지에서 navigate 할 때 state로 넘겨주는 걸 가정
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
        // 1) 센서 메타 정보
        const sensorRes = await api(`/api/v1/sensors/${sensorId}`);
        const sensorPayload =
          sensorRes?.data?.sensor || sensorRes?.data || sensorRes;

        // 2) 최근 센서 데이터 (예: 50개)
        const dataRes = await api(
          `/api/v1/sensors/${sensorId}/data?limit=50`
        );
        let rows = dataRes?.data?.items || dataRes?.data || dataRes;
        if (!Array.isArray(rows)) rows = [];

        // 최신순 정렬
        rows.sort(
          (a, b) => new Date(b.upload_at) - new Date(a.upload_at)
        );

        if (!cancelled) {
          setSensor(sensorPayload || null);
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

  // 🔹 센서 수정 버튼: /zones/:areaId/sensors/:sensorId/edit 로 이동
  const handleEditClick = () => {
    navigate(`/zones/${areaId}/sensors/${sensorId}/edit`, {
      state: { areaName },
    });
  };

  // 🔹 센서 삭제(비활성화): is_active = 0 으로 PATCH
  const handleDeleteClick = async () => {
    if (!window.confirm("이 센서를 비활성화하시겠습니까?")) return;

    try {
      await api(`/api/v1/sensors/${sensorId}`, {
        method: "PATCH",
        body: { is_active: 0 },
      });

      // 화면에서 즉시 반영
      setSensor((prev) =>
        prev ? { ...prev, is_active: 0 } : prev
      );
      alert("센서를 비활성화했습니다.");
    } catch (e) {
      alert(e?.message || "센서를 비활성화하지 못했습니다.");
    }
  };

  return (
    <div className="page sensor-detail-page" style={{ padding: "24px" }}>
      {/* 뒤로가기 */}
      <button
        type="button"
        onClick={() => navigate(-1)}
        style={{
          border: "none",
          background: "transparent",
          cursor: "pointer",
          marginBottom: "8px",
          fontSize: "16px",
        }}
      >
        ← 센서관리로 돌아가기
      </button>

      {/* 상단 타이틀 + 오른쪽 센서명 + 버튼들 */}
      <header
        style={{
          marginBottom: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: "16px",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "14px",
              color: "#666",
              marginBottom: "4px",
            }}
          >
            센서관리 · {areaName} · 센서 상세
          </div>
          <h1 style={{ fontSize: "28px", margin: 0 }}>센서 상세</h1>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: "8px",
          }}
        >
          {sensor && (
            <div
              style={{
                padding: "16px 32px",
                backgroundColor: "#fff",
                borderRadius: "12px",
                boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                fontSize: "20px",
                fontWeight: 600,
                minWidth: "160px",
                textAlign: "center",
              }}
            >
              {sensor.model}
            </div>
          )}

          {/* 수정 / 삭제 버튼 */}
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={handleEditClick}
              style={{
                padding: "6px 14px",
                borderRadius: "999px",
                border: "1px solid #228be6",
                backgroundColor: "#228be6",
                color: "#fff",
                fontSize: "13px",
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
                borderRadius: "999px",
                border: "1px solid #e03131",
                backgroundColor: "#fff",
                color: "#e03131",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              센서 삭제
            </button>
          </div>
        </div>
      </header>

      {/* 로딩/에러 처리 */}
      {loading && <div>로딩 중...</div>}
      {!loading && error && (
        <div style={{ color: "red", marginBottom: "16px" }}>{error}</div>
      )}

      {!loading && !error && (
        <>
          {/* 현재 상태 + 센서 정보 */}
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1.2fr)",
              gap: "24px",
              marginBottom: "32px",
            }}
          >
            {/* 현재 상태 */}
            <div
              style={{
                backgroundColor: "#e7ecf2",
                borderRadius: "16px",
                padding: "24px",
              }}
            >
              <h2
                style={{
                  fontSize: "20px",
                  marginBottom: "16px",
                }}
              >
                현재 상태
              </h2>

              <div
                style={{
                  backgroundColor: "#fff",
                  borderRadius: "16px",
                  padding: "24px",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                }}
              >
                <div
                  style={{
                    fontSize: "16px",
                    marginBottom: "8px",
                  }}
                >
                  측정 값
                </div>
                <div
                  style={{
                    fontSize: "40px",
                    fontWeight: 700,
                    marginBottom: "12px",
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
                <div style={{ fontSize: "14px", color: "#555" }}>
                  측정 시간:{" "}
                  {latest ? formatDateTime(latest.upload_at) : "-"}
                </div>
              </div>
            </div>

            {/* 센서 메타 정보 */}
            <div
              style={{
                backgroundColor: "#e7ecf2",
                borderRadius: "16px",
                padding: "24px",
              }}
            >
              <h2
                style={{
                  fontSize: "20px",
                  marginBottom: "16px",
                }}
              >
                센서 정보
              </h2>

              <div
                style={{
                  backgroundColor: "#fff",
                  borderRadius: "16px",
                  padding: "20px",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                  fontSize: "14px",
                }}
              >
                {sensor ? (
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                    }}
                  >
                    <tbody>
                      <tr>
                        <th
                          style={{
                            textAlign: "left",
                            padding: "4px 0",
                            color: "#666",
                            width: "30%",
                          }}
                        >
                          센서 ID
                        </th>
                        <td style={{ padding: "4px 0" }}>{sensor.id}</td>
                      </tr>
                      <tr>
                        <th
                          style={{
                            textAlign: "left",
                            padding: "4px 0",
                            color: "#666",
                          }}
                        >
                          타입
                        </th>
                        <td style={{ padding: "4px 0" }}>
                          {sensor.sensor_type}
                        </td>
                      </tr>
                      <tr>
                        <th
                          style={{
                            textAlign: "left",
                            padding: "4px 0",
                            color: "#666",
                          }}
                        >
                          회사 ID
                        </th>
                        <td style={{ padding: "4px 0" }}>
                          {sensor.company_id}
                        </td>
                      </tr>
                      <tr>
                        <th
                          style={{
                            textAlign: "left",
                            padding: "4px 0",
                            color: "#666",
                          }}
                        >
                          구역 ID
                        </th>
                        <td style={{ padding: "4px 0" }}>
                          {sensor.area_id}
                        </td>
                      </tr>
                      <tr>
                        <th
                          style={{
                            textAlign: "left",
                            padding: "4px 0",
                            color: "#666",
                          }}
                        >
                          상태
                        </th>
                        <td style={{ padding: "4px 0" }}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 10px",
                              borderRadius: "999px",
                              fontSize: "12px",
                              marginRight: "6px",
                              backgroundColor: sensor.is_active
                                ? "#d3f9d8"
                                : "#f1f3f5",
                              color: sensor.is_active ? "#2b8a3e" : "#868e96",
                            }}
                          >
                            {sensor.is_active ? "ACTIVE" : "INACTIVE"}
                          </span>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 10px",
                              borderRadius: "999px",
                              fontSize: "12px",
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
                        <th
                          style={{
                            textAlign: "left",
                            padding: "4px 0",
                            color: "#666",
                          }}
                        >
                          생성일
                        </th>
                        <td style={{ padding: "4px 0" }}>
                          {formatDateTime(sensor.created_at)}
                        </td>
                      </tr>
                      <tr>
                        <th
                          style={{
                            textAlign: "left",
                            padding: "4px 0",
                            color: "#666",
                          }}
                        >
                          수정일
                        </th>
                        <td style={{ padding: "4px 0" }}>
                          {formatDateTime(sensor.updated_at)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                ) : (
                  <div>센서 정보를 불러올 수 없습니다.</div>
                )}
              </div>
            </div>
          </section>

          {/* 최근 데이터 테이블 */}
          <section>
            <h2
              style={{
                fontSize: "20px",
                marginBottom: "12px",
              }}
            >
              최근 데이터
            </h2>

            <div
              style={{
                backgroundColor: "#fff",
                borderRadius: "12px",
                boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                padding: "16px",
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
                    fontSize: "14px",
                  }}
                >
                  <thead>
                    <tr>
                      <th
                        style={{
                          textAlign: "left",
                          padding: "8px 4px",
                          borderBottom: "1px solid #dee2e6",
                        }}
                      >
                        시간
                      </th>
                      <th
                        style={{
                          textAlign: "right",
                          padding: "8px 4px",
                          borderBottom: "1px solid #dee2e6",
                        }}
                      >
                        데이터 번호
                      </th>
                      <th
                        style={{
                          textAlign: "right",
                          padding: "8px 4px",
                          borderBottom: "1px solid #dee2e6",
                        }}
                      >
                        값
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataList.map((row, idx) => (
                      <tr key={`${row.sensor_id || sensorId}-${idx}`}>
                        <td
                          style={{
                            padding: "6px 4px",
                            borderBottom: "1px solid #f1f3f5",
                          }}
                        >
                          {formatDateTime(row.upload_at)}
                        </td>
                        <td
                          style={{
                            padding: "6px 4px",
                            borderBottom: "1px solid #f1f3f5",
                            textAlign: "right",
                          }}
                        >
                          {row.data_no}
                        </td>
                        <td
                          style={{
                            padding: "6px 4px",
                            borderBottom: "1px solid #f1f3f5",
                            textAlign: "right",
                          }}
                        >
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
