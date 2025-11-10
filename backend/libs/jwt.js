//토큰 관련 유틸
import jwt from 'jsonwebtoken';

export const ACCESS_EXP_SEC = 60 * 60 * 6;              // 15분
export const REFRESH_EXP_SEC = 60 * 60 * 24 * 14; // 14일

const ACCESS_SECRET  = process.env.ACCESS_SECRET  ?? 'dev-access';
const REFRESH_SECRET = process.env.REFRESH_SECRET ?? 'dev-refresh';

export const signAccess  = (payload) => jwt.sign(payload, ACCESS_SECRET,  { expiresIn: ACCESS_EXP_SEC });
export const signRefresh = (payload) => jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXP_SEC });

export const verifyAccess  = (token) => jwt.verify(token, ACCESS_SECRET);
export const verifyRefresh = (token) => jwt.verify(token, REFRESH_SECRET);
