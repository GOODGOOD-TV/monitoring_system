// libs/anomaly.js

// rows: [{ data_value 혹은 value, ... }]
export function detectAnomalies(rawRows, k = 3) {
  const rows = Array.isArray(rawRows) ? rawRows : [];

  if (!rows.length) return [];

  // data_value 또는 value 어떤 이름이 와도 처리
  const values = rows.map(r => {
    const v = r.data_value ?? r.value;
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  }).filter(v => !Number.isNaN(v));

  const n = values.length;
  if (n === 0) {
    // 값이 전부 NaN이면 전부 정상 처리
    return rows.map(r => ({ ...r, is_anomaly: false, anomaly_score: 0 }));
  }

  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance) || 0;

  if (std === 0) {
    return rows.map(r => ({ ...r, is_anomaly: false, anomaly_score: 0 }));
  }

  const lower = mean - k * std;
  const upper = mean + k * std;

  return rows.map(r => {
    const v = Number(r.data_value ?? r.value);
    if (!Number.isFinite(v)) {
      return { ...r, is_anomaly: false, anomaly_score: 0 };
    }

    const z = (v - mean) / std;
    const isAnomaly = v < lower || v > upper;

    return {
      ...r,
      is_anomaly: isAnomaly,
      anomaly_score: Math.abs(z),
    };
  });
}
