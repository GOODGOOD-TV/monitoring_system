// routes/analytics.js
import { Router } from 'express';
import { pool } from '../libs/db.js';
import { detectAnomalies } from '../libs/anomaly.js';
import { smartForecast } from '../libs/forecast.js';

const router = Router();

/**
 * GET /api/v1/analytics/sensor-series
 * ?sensor_id=1&from=ISO&to=ISO
 * → 실제 데이터 + 이상치 플래그
 */
router.get('/sensor-series', async (req, res) => {
  try {
    const company_id = req.company_id; // authGuard에서 세팅된다고 가정
    const sensor_id = parseInt(req.query.sensor_id ?? '0', 10);
    const from = req.query.from;
    const to = req.query.to;

    if (!sensor_id || !from || !to) {
      return res.badRequest('sensor_id, from, to는 필수입니다.');
    }

    // 센서가 내 회사 것인지 체크
    const [[sensor]] = await pool.execute(
      'SELECT id FROM sensor WHERE id = ? AND company_id = ?',
      [sensor_id, company_id]
    );
    if (!sensor) return res.notFound('센서 없음');

    const [rows] = await pool.execute(
      `SELECT upload_at, data_value
         FROM sensor_data
        WHERE sensor_id = ?
          AND upload_at BETWEEN ? AND ?
        ORDER BY upload_at ASC`,
      [sensor_id, from, to]
    );

    const withFlags = detectAnomalies(rows);

    const data = withFlags.map((r) => ({
      upload_at: r.upload_at,
      value: Number(r.data_value),
      is_anomaly: !!r.is_anomaly,
      anomaly_score: Number(r.anomaly_score ?? 0),
    }));

    return res.ok(data, '센서 시계열 분석 성공');
  } catch (err) {
    console.error(err);
    return res.error('ANALYTICS_SERIES_ERROR', err.message);
  }
});

/**
 * GET /api/v1/analytics/sensor-forecast
 * ?sensor_id=1&horizon_minutes=60&step_minutes=5
 * → 패턴 기반 단기 예측 시계열
 */
router.get('/sensor-forecast', async (req, res) => {
  try {
    const company_id = req.company_id;
    const sensor_id = parseInt(req.query.sensor_id ?? '0', 10);
    const horizon = parseInt(req.query.horizon_minutes ?? '6', 10);
    const step = parseInt(req.query.step_minutes ?? '1', 10);

    if (!sensor_id) {
      return res.fail(400, 'BAD_REQUEST', 'sensor_id는 필수입니다.');
    }

    const [[sensor]] = await pool.execute(
      'SELECT id FROM sensor WHERE id = ? AND company_id = ?',
      [sensor_id, company_id]
    );
    if (!sensor) {
      return res.fail(404, 'NOT_FOUND', '센서 없음');
    }

    // 이 센서의 전체 데이터(혹은 최근 N일) 조회
    const [rows] = await pool.execute(
      `SELECT upload_at, data_value
         FROM sensor_data
        WHERE sensor_id = ?
        ORDER BY upload_at ASC`,
      [sensor_id]
    );

    console.log('[forecast] rows len =', rows.length);

    // ⬇ 선형 회귀 대신 패턴 기반 예측 사용
    const forecast = smartForecast(rows, {
      horizonMinutes: horizon,
      stepMinutes: 1,       // 10초 간격 버킷
      windowMinutes: 10,        // 최근 10분 패턴
      historyDays: 0.25,        // 최근 6시간만 참고
      kNeighbors: 5,
      weightPower: 2,
      recencyHalfLifeMinutes: 30,  // 30분마다 가중치 반감
    });

    console.log('[forecast] result len =', forecast.length);

    return res.ok(forecast, '센서 패턴 기반 단기 예측 성공');
  } catch (err) {
    console.error(err);
    return res.fail(500, 'ANALYTICS_FORECAST_ERROR', err.message);
  }
});

/**
 * GET /api/v1/analytics/sensor-report
 * ?sensor_id=1&hours=24
 *
 * - 최근 N시간(기본 24h)에 대해:
 *   - 기본 통계(min/max/avg/std/count)
 *   - 임계값 범위 이탈 횟수
 *   - 이상치 개수
 *   - 1시간 단기 예측 요약
 *   - 문장형 요약(text_summary)
 */
router.get('/sensor-report', async (req, res) => {
  try {
    const company_id = req.company_id;
    const sensor_id = parseInt(req.query.sensor_id ?? '0', 10);
    const hours = parseInt(req.query.hours ?? '24', 10);

    if (!sensor_id || hours <= 0) {
      return res.badRequest('sensor_id, hours는 필수입니다.');
    }

    // 1) 센서 존재 + 회사 소속 확인 + 임계값/타입 정보 가져오기
    const [[sensor]] = await pool.execute(
      `SELECT id, model, sensor_type, threshold_min, threshold_max
         FROM sensor
        WHERE id = ?
          AND company_id = ?
          AND deleted_at IS NULL`,
      [sensor_id, company_id]
    );
    if (!sensor) return res.notFound('센서 없음');

    // 2) 기간 계산 (최근 hours시간)
    const to = new Date();
    const from = new Date(to.getTime() - hours * 60 * 60 * 1000);

    const fromIso = from.toISOString(); // MySQL이 ISO 문자열 파싱 가능하면 이대로 사용
    const toIso = to.toISOString();

    // 3) 센서 데이터 조회
    const [rows] = await pool.execute(
      `SELECT upload_at, data_value
         FROM sensor_data
        WHERE sensor_id = ?
          AND upload_at BETWEEN ? AND ?
        ORDER BY upload_at ASC`,
      [sensor_id, fromIso, toIso]
    );

    const numeric = rows
      .map(r => {
        const v = Number(r.data_value);
        return { upload_at: r.upload_at, value: Number.isFinite(v) ? v : NaN };
      })
      .filter(r => Number.isFinite(r.value));

    if (!numeric.length) {
      return res.ok(
        {
          sensor: {
            id: sensor.id,
            model: sensor.model,
            sensor_type: sensor.sensor_type,
            threshold_min: sensor.threshold_min,
            threshold_max: sensor.threshold_max,
          },
          range: { from: fromIso, to: toIso, hours },
          stats: null,
          threshold_stats: null,
          anomalies: null,
          forecast_summary: null,
          text_summary: '해당 기간에 수집된 데이터가 없습니다.',
        },
        '센서 보고서 생성(데이터 없음)'
      );
    }

    // 4) 기본 통계 계산
    const stats = calcStats(numeric.map(r => r.value));

    // 5) 임계값 기준 범위 이탈 횟수
    const tmin = sensor.threshold_min != null ? Number(sensor.threshold_min) : null;
    const tmax = sensor.threshold_max != null ? Number(sensor.threshold_max) : null;

    let overHigh = 0;
    let underLow = 0;

    if (tmax != null) {
      overHigh = numeric.filter(r => r.value > tmax).length;
    }
    if (tmin != null) {
      underLow = numeric.filter(r => r.value < tmin).length;
    }

    const thresholdStats = {
      threshold_min: tmin,
      threshold_max: tmax,
      over_high_count: overHigh,
      under_low_count: underLow,
    };

    // 6) 이상치 탐지 (anomaly.js 재사용)
    const flagged = detectAnomalies(
      rows.map(r => ({ upload_at: r.upload_at, data_value: r.data_value }))
    );
    const anomalies = flagged.filter(r => r.is_anomaly);
    const anomalyStats = {
      total: anomalies.length,
    };

    // 7) 단기 예측 요약 (향후 60분, 1분 간격)
    const forecast = smartForecast(
      rows.map(r => ({ upload_at: r.upload_at, data_value: r.data_value })),
      {
        horizonMinutes: 60,
        stepMinutes: 1,
        windowMinutes: 10,
        historyDays: 0.25, // 최근 6시간
        kNeighbors: 5,
        weightPower: 2,
        recencyHalfLifeMinutes: 30,
      }
    );

    let forecastSummary = null;
    if (forecast && forecast.length) {
      const lastReal = numeric[numeric.length - 1].value;
      const futureVals = forecast.map(f => f.value);
      const forecastAvg =
        futureVals.reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0) /
        futureVals.length;

      let trend = '유지';
      const diff = forecastAvg - lastReal;
      if (diff > 0.3) trend = '상승';
      else if (diff < -0.3) trend = '하락';

      forecastSummary = {
        last_value: lastReal,
        mean_forecast: forecastAvg,
        trend, // '상승' | '하락' | '유지'
      };
    }

    // 8) 문장형 요약 생성
    const text = buildTextSummary({
      sensor,
      range: { from: fromIso, to: toIso, hours },
      stats,
      thresholdStats,
      anomalyStats,
      forecastSummary,
    });

    // 9) 결과 응답
    return res.ok(
      {
        sensor: {
          id: sensor.id,
          model: sensor.model,
          sensor_type: sensor.sensor_type,
          threshold_min: sensor.threshold_min,
          threshold_max: sensor.threshold_max,
        },
        range: { from: fromIso, to: toIso, hours },
        stats,
        threshold_stats: thresholdStats,
        anomalies: anomalyStats,
        forecast_summary: forecastSummary,
        text_summary: text,
      },
      '센서 보고서 생성 성공'
    );
  } catch (err) {
    console.error(err);
    return res.fail(500, 'ANALYTICS_REPORT_ERROR', err.message);
  }
});

export default router;

// 통계 계산
function calcStats(values) {
  const arr = values.filter(v => Number.isFinite(v));
  const n = arr.length;
  if (!n) return null;

  let min = arr[0];
  let max = arr[0];
  let sum = 0;
  for (const v of arr) {
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }
  const mean = sum / n;

  let s2 = 0;
  for (const v of arr) {
    const d = v - mean;
    s2 += d * d;
  }
  const variance = n > 1 ? s2 / (n - 1) : 0;
  const stddev = Math.sqrt(variance);

  return { count: n, min, max, mean, stddev };
}

// 보고서용 한글 요약 문장 생성
function buildTextSummary({ sensor, range, stats, thresholdStats, anomalyStats, forecastSummary }) {
  const parts = [];

  // 기간
  parts.push(
    `보고 기간: 최근 ${range.hours}시간 (${range.from} ~ ${range.to})`
  );

  // 센서 정보
  parts.push(
    `대상 센서: #${sensor.id} (${sensor.model ?? '모델명 없음'}, 타입: ${sensor.sensor_type ?? 'N/A'})`
  );

  if (stats) {
    parts.push(
      `측정 개수 ${stats.count}건, 최소 ${stats.min.toFixed(2)}, 최대 ${stats.max.toFixed(
        2
      )}, 평균 ${stats.mean.toFixed(2)}, 표준편차 ${stats.stddev.toFixed(2)}입니다.`
    );
  }

  if (thresholdStats) {
    const { threshold_min, threshold_max, over_high_count, under_low_count } = thresholdStats;
    const thText = [];
    if (threshold_min != null) thText.push(`하한 ${threshold_min}`);
    if (threshold_max != null) thText.push(`상한 ${threshold_max}`);
    if (thText.length) {
      parts.push(`설정된 임계값은 ${thText.join(', ')} 입니다.`);
    }
    if (threshold_min != null || threshold_max != null) {
      parts.push(
        `임계 상한 초과 ${over_high_count}회, 임계 하한 미만 ${under_low_count}회 발생했습니다.`
      );
    }
  }

  if (anomalyStats) {
    parts.push(`이상치 탐지 결과, 이상 패턴으로 판단된 구간은 총 ${anomalyStats.total}건입니다.`);
  }

  if (forecastSummary) {
    const { last_value, mean_forecast, trend } = forecastSummary;
    parts.push(
      `현재 값은 ${last_value.toFixed(
        2
      )}이며, 향후 1시간 평균 예측 값은 ${mean_forecast.toFixed(
        2
      )}로, 전반적인 추세는 '${trend}'으로 예상됩니다.`
    );
  }

  return parts.join(' ');
}
