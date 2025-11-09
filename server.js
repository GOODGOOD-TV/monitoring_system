require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');

const login = require('./routes/login');
const logout = require('./routes/logout');
const token = require('./routes/token');
const sensors = require('./routes/sensors');
const logs = require('./routes/logs');
let register;
try { register = require('./routes/register'); } catch (_) {}

const { errorHandler } = require('./routes/utils/error');

const app = express();

// 🔧 기본 미들웨어 설정
app.use(express.json()); // JSON 요청 본문 파싱
app.use(cors({ origin: process.env.CORS_ORIGIN || true, credentials: true })); // CORS 허용
app.use(helmet()); // 보안 헤더 설정
app.use(rateLimit({ windowMs: 60_000, max: 200 })); // 요청 제한 (60초당 200회)
app.use(morgan('dev')); // 요청 로깅

// 🌐 공개 엔드포인트 (로그인/회원가입 등)
if (register) app.use('/register', register);
app.use('/login', login);
app.use('/token', token);
app.use('/logout', logout);

// 🔒 보호 엔드포인트 (토큰 필요)
app.use('/sensors', sensors);
app.use('/logs', logs);

// 🗂️ 정적 파일 제공 (프론트엔드 빌드 결과)
app.use(express.static('frontend'));

// ⚠️ 전역 에러 핸들러
app.use(errorHandler);

// 🚀 서버 실행
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API listening on :${PORT}`));
