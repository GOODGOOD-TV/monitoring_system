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

export default router;
