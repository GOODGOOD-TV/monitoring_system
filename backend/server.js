import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';

import { attachResHelpers } from './libs/http.js';

import { authGuard } from './middlewares/authGuard.js';

import authRoute from './routes/auth.js';
import usersRoute from './routes/users.js';
import companiesRoute from './routes/companies.js';
import areasRoute from './routes/areas.js';
import sensorsRoute from './routes/sensors.js';
import sensorDataRoute from './routes/sensor-data.js';
import thresholdsRoute from './routes/thresholds.js';
import alarmsRoute from './routes/alarms.js';
import notificationsRoute from './routes/notifications.js';
import sysLogsRoute from './routes/sys-logs.js';
import sensorIngestRoute from './routes/sensor-ingest.js';
import analyticsRoute from './routes/analytics.js';

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(attachResHelpers);

app.get('/health', (_req, res) => res.ok({ status: 'UP' }, '헬스체크'));

app.use('/api/v1/auth', authRoute); //인증
app.use('/api/v1/users', authGuard, usersRoute); //유저 정보
app.use('/api/v1/areas', authGuard, areasRoute); //구역 정보
app.use('/api/v1/companies', authGuard, companiesRoute); //회사 정보
app.use('/api/v1/sensors', authGuard, sensorsRoute); //센서 정보
app.use('/api/v1/sensor-data', authGuard, sensorDataRoute); //센서 데이터
app.use('/api/v1/thresholds', authGuard, thresholdsRoute); //임계값 정보
app.use('/api/v1/alarms', authGuard, alarmsRoute); //알람 정보
app.use('/api/v1/notifications', authGuard, notificationsRoute); //알람 발송
app.use('/api/v1/sys-logs', authGuard, sysLogsRoute); //시스템 로그

app.use('/api/v1/sensor-data', authGuard, sensorIngestRoute); //센서 -> 알람 생성
app.use('/api/v1/analytics', authGuard, analyticsRoute); //분석 및 이상예측

// 404
app.use((req, res) => res.fail(404, 'NOT_FOUND', 'Not Found'));

// 500
app.use((err, _req, res, _next) => {
  console.error('🔥 GLOBAL ERROR HANDLER 🔥');
  console.error('SQL      :', err.sql);
  console.error('SQL MSG  :', err.sqlMessage);
  console.error('STACK    :', err.stack);
  console.error('ERROR OBJ:', err);

  res.fail(
    err.status ?? 500,
    err.code ?? 'INTERNAL_ERROR',
    err.message ?? 'Server Error',
    err.details ?? null
  );
});

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
