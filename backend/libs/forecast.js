// libs/forecast.js

/**
 * rows: [{ upload_at: Date|string, data_value: number }, ...]
 *
 * options:
 *  - horizonMinutes : 예측할 시간 길이 (분)
 *  - stepMinutes    : 예측 간격 (분)
 *  - windowMinutes  : 최근 패턴 길이 (분)
 *  - historyDays    : 과거 몇 일만 보고 패턴을 찾을지
 *  - kNeighbors     : k-NN에서 사용할 이웃 개수
 *  - weightPower    : 거리 가중치 지수 (2면 1/dist^2)
 *  - recencyHalfLifeMinutes : 최신 패턴에 더 가중치를 줄지(분 단위 half-life)
 *
 * 반환:
 *  [
 *    { predicted_at: ISO string, value: number, lower: number|null, upper: number|null },
 *    ...
 *  ]
 */
export function smartForecast(
  rows,
  {
    horizonMinutes = 60,
    stepMinutes = 1,
    windowMinutes = 60,
    historyDays = 7,
    kNeighbors = 5,
    weightPower = 2,
    recencyHalfLifeMinutes = 0,
  } = {}
) {
  const raw = Array.isArray(rows) ? rows : [];
  if (raw.length < 3) return [];

  // 1) upload_at → { t: Date, value: number } 로 변환
  let seq = raw
    .map((r) => {
      const t = r.upload_at instanceof Date ? r.upload_at : new Date(r.upload_at);
      const v = Number(r.data_value);
      return { t, value: Number.isFinite(v) ? v : NaN };
    })
    .filter((r) => Number.isFinite(r.value))
    .sort((a, b) => a.t - b.t);

  if (seq.length < 3) return [];

  // 2) historyDays 만큼만 남기기 (너무 오래된 데이터는 버림)
  if (historyDays && historyDays > 0) {
    const lastTime = seq[seq.length - 1].t;
    const cutoff = new Date(lastTime.getTime() - historyDays * 24 * 60 * 60 * 1000);
    seq = seq.filter((r) => r.t >= cutoff);
  }
  if (seq.length < 3) return [];

  // 3) stepMinutes 기준으로 버킷팅 (평균 값)
  const stepMs = stepMinutes * 60 * 1000;
  const buckets = buildBuckets(seq, stepMs); // [{ t: Date, value: number }]
  if (buckets.length < 3) return [];

  const n = buckets.length;
  const windowSteps = Math.max(3, Math.floor(windowMinutes / stepMinutes) || 3);
  const horizonSteps = Math.max(1, Math.floor(horizonMinutes / stepMinutes) || 1);

  const minBucketsForKNN = windowSteps + horizonSteps + 1;

  const lastBucket = buckets[buckets.length - 1];
  const lastTime = lastBucket.t;

  // 4) 데이터가 충분하면 k-NN 패턴 기반 예측 시도
  if (n >= minBucketsForKNN) {
    const knn = knnForecast(buckets, {
      windowSteps,
      horizonSteps,
      kNeighbors,
      weightPower,
      recencyHalfLifeMinutes,
      stepMinutes,
    });

    if (knn.length > 0) {
      // knn: [{ value, lower, upper }, ...] 길이 horizonSteps
      return knn.map((f, idx) => {
        const t = new Date(lastTime.getTime() + (idx + 1) * stepMs);
        return {
          predicted_at: t.toISOString(),
          value: f.value,
          lower: f.lower,
          upper: f.upper,
        };
      });
    }
  }

  // 5) k-NN 실패/데이터 부족 → 로컬 선형 회귀 fallback
  const reg = regressionForecast(buckets, horizonSteps, stepMs);
  return reg.map((f, idx) => {
    const t = new Date(lastTime.getTime() + (idx + 1) * stepMs);
    return {
      predicted_at: t.toISOString(),
      value: f.value,
      lower: f.lower,
      upper: f.upper,
    };
  });
}

/* ------------------------------------------------------------------ */
/* 내부 유틸 함수들                                                   */
/* ------------------------------------------------------------------ */

/**
 * seq: [{ t: Date, value: number }]
 * stepMs 기준으로 각 버킷에 평균 값을 넣은 배열로 변환
 */
function buildBuckets(seq, stepMs) {
  const bucketMap = new Map(); // key: bucketMs, value: { sum, count }

  for (const r of seq) {
    const ms = r.t.getTime();
    const bucketMs = Math.floor(ms / stepMs) * stepMs;
    const cur = bucketMap.get(bucketMs) || { sum: 0, count: 0 };
    cur.sum += r.value;
    cur.count += 1;
    bucketMap.set(bucketMs, cur);
  }

  return Array.from(bucketMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([ms, agg]) => ({
      t: new Date(ms),
      value: agg.sum / agg.count,
    }));
}

/**
 * k-NN 패턴 기반 예측 + 가중치
 *
 * buckets: [{ t: Date, value: number }]
 *
 * 반환: 길이 horizonSteps 의 배열
 *   [{ value, lower, upper }, ...]
 */
function knnForecast(
  buckets,
  {
    windowSteps,
    horizonSteps,
    kNeighbors,
    weightPower = 2,
    recencyHalfLifeMinutes = 0,
    stepMinutes = 1,
  }
) {
  const n = buckets.length;
  if (n < windowSteps + horizonSteps + 1) return [];

  // 현재 패턴 (마지막 windowSteps 개)
  const currentPattern = buckets.slice(n - windowSteps).map((b) => b.value);

  // 과거 윈도우 수집
  const candidates = [];
  const maxStart = n - windowSteps - horizonSteps; // 뒤 horizonSteps는 미래 역할

  for (let start = 0; start <= maxStart; start++) {
    const pat = buckets.slice(start, start + windowSteps).map((b) => b.value);
    const fut = buckets.slice(start + windowSteps, start + windowSteps + horizonSteps).map((b) => b.value);

    if (pat.length !== windowSteps || fut.length !== horizonSteps) continue;

    // 거리 (L2)
    let distSq = 0;
    for (let i = 0; i < windowSteps; i++) {
      const diff = (pat[i] ?? 0) - (currentPattern[i] ?? 0);
      distSq += diff * diff;
    }
    const dist = Math.sqrt(distSq);
    const eps = 1e-6;
    let weight = 1 / Math.pow(dist + eps, weightPower);

    // 최신 패턴에 더 가중치 (옵션)
    if (recencyHalfLifeMinutes > 0) {
      const ageSteps = (n - windowSteps) - start; // 현재 패턴 기준 과거 스텝 수
      const ageMinutes = ageSteps * stepMinutes;
      const lambda = Math.log(2) / recencyHalfLifeMinutes; // half-life
      const recencyFactor = Math.exp(-lambda * ageMinutes);
      weight *= recencyFactor;
    }

    candidates.push({ future: fut, dist, weight });
  }

  if (!candidates.length) return [];

  // 거리 기준으로 정렬 후 상위 kNeighbors만 사용
  candidates.sort((a, b) => a.dist - b.dist);
  const top = candidates.slice(0, Math.max(1, kNeighbors));

  // 가중치 정규화
  let wSum = 0;
  for (const c of top) wSum += c.weight;
  if (wSum <= 0) wSum = 1;
  const norm = top.map((c) => ({ future: c.future, w: c.weight / wSum }));

  const result = [];

  for (let h = 0; h < horizonSteps; h++) {
    let sumWV = 0;   // Σ w * v
    let sumWVV = 0;  // Σ w * v^2
    let sumW = 0;

    for (const c of norm) {
      const v = c.future[h];
      if (typeof v !== 'number' || !Number.isFinite(v)) continue;
      const w = c.w;
      sumW += w;
      sumWV += w * v;
      sumWVV += w * v * v;
    }

    if (sumW === 0) {
      // 데이터가 없으면 그냥 직전 값 유지 (fallback)
      const lastVal = buckets[buckets.length - 1].value;
      result.push({ value: lastVal, lower: lastVal, upper: lastVal });
      continue;
    }

    const mean = sumWV / sumW;
    const meanSq = sumWVV / sumW;
    const variance = Math.max(meanSq - mean * mean, 0);
    const sigma = Math.sqrt(variance);

    result.push({
      value: mean,
      lower: mean - 2 * sigma,
      upper: mean + 2 * sigma,
    });
  }

  return result;
}

/**
 * 로컬 선형 회귀 + 잔차 기반 신뢰구간
 *
 * buckets: [{ t: Date, value: number }]
 * 반환: [{ value, lower, upper }, ...]
 */
function regressionForecast(buckets, horizonSteps, stepMs) {
  const n = buckets.length;
  if (n < 3) return [];

  const xs = [];
  const ys = [];

  for (let i = 0; i < n; i++) {
    xs.push(i);
    ys.push(buckets[i].value);
  }

  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXX = xs.reduce((a, b) => a + b * b, 0);
  const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i], 0);

  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) {
    const lastVal = ys[n - 1];
    return Array.from({ length: horizonSteps }, () => ({
      value: lastVal,
      lower: lastVal,
      upper: lastVal,
    }));
  }

  const a = (n * sumXY - sumX * sumY) / denom;           // 기울기
  const b = (sumY * sumXX - sumX * sumXY) / denom;       // 절편

  // 잔차로 분산 추정
  const residuals = ys.map((y, i) => y - (a * xs[i] + b));
  const varRes =
    residuals.reduce((s, r) => s + r * r, 0) / Math.max(1, n - 2);
  const sigma = Math.sqrt(varRes) || 0;

  const result = [];
  for (let h = 1; h <= horizonSteps; h++) {
    const x = n - 1 + h;
    const mean = a * x + b;
    result.push({
      value: mean,
      lower: mean - 2 * sigma,
      upper: mean + 2 * sigma,
    });
  }

  return result;
}
