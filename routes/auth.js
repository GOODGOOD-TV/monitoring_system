// auth.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { pool } = require('./db');

const ACCESS_TTL = '15m';
const REFRESH_TTL_SEC = 14 * 24 * 60 * 60;

function signAccess(payload) {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, { expiresIn: ACCESS_TTL });
}
function signRefresh() {
  return crypto.randomBytes(48).toString('base64url');
}

async function saveRefreshToken(userId, token) {
  const hash = await bcrypt.hash(token, 10);
  await pool.execute(
    `INSERT INTO refresh_tokens(user_id, token_hash, expires_at, created_at)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND), NOW())`,
    [userId, hash, REFRESH_TTL_SEC]
  );
}

async function verifyRefresh(userId, token) {
  const [rows] = await pool.execute(
    `SELECT id, token_hash, expires_at, revoked_at
       FROM refresh_tokens
      WHERE user_id=? ORDER BY id DESC LIMIT 20`,
    [userId]
  );
  for (const r of rows) {
    if (r.revoked_at) continue;
    if (new Date(r.expires_at) < new Date()) continue;
    if (await bcrypt.compare(token, r.token_hash)) return r.id;
  }
  return null;
}

async function revokeRefresh(id) {
  await pool.execute(`UPDATE refresh_tokens SET revoked_at=NOW() WHERE id=?`, [id]);
}

function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, code: 'NO_TOKEN' });
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = payload; // { id, role, company_code, name }
    next();
  } catch (e) {
    return res.status(401).json({ ok: false, code: 'INVALID_TOKEN' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ ok: false, code: 'FORBIDDEN' });
    }
    next();
  };
}

module.exports = {
  requireAuth,
  requireRole,
  signAccess,
  signRefresh,
  saveRefreshToken,
  verifyRefresh,
  revokeRefresh
};
