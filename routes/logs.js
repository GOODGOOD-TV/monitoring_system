const express = require("express");
const pool = require("../db");
const authenticateToken = require("../auth");

const router = express.Router();

// 로그 조회 API
router.get("/", authenticateToken, async (req, res) => {
  const { id, role, company_code } = req.user;

  try {
    let query = `
      SELECT l.id, l.action, l.description, l.ip_address, l.timestamp,
             u.email, u.company_code
      FROM logs l
      JOIN users u ON l.user_id = u.id
    `;
    let params = [];

    if (role === "user") {
      query += " WHERE u.id = ?";
      params.push(id);
    } else if (role === "admin") {
      query += " WHERE u.company_code = ?";
      params.push(company_code);
    }
    // superadmin일 경우 제한 없음

    query += " ORDER BY l.timestamp DESC LIMIT 100";

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
