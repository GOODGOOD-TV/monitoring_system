const express = require("express");
const bcrypt = require("bcrypt");
const pool = require("../db");
const { writeLog } = require("../utils/log"); // ✅ 로그 유틸 불러오기

const router = express.Router();

router.post("/", async (req, res) => {
  const { company_code, employee_id, name, phone, email, password } = req.body;
  const ip = req.ip;

  if (!company_code || !employee_id || !name || !phone || !email || !password) {
    await writeLog(null, "REGISTER_FAIL", "필수 필드 누락", ip);
    return res.status(400).json({ error: "모든 필드는 필수입니다." });
  }

  try {
    // 이메일 중복 체크
    const [existing] = await pool.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length > 0) {
      await writeLog(existing[0].id, "REGISTER_FAIL", "이메일 중복", ip);
      return res.status(400).json({ error: "이미 존재하는 이메일입니다." });
    }

    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(password, 10);

    // DB 저장
    const [result] = await pool.query(
      "INSERT INTO users (company_code, employee_id, name, phone, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?, ?, 'user', true)",
      [company_code, employee_id, name, phone, email, hashedPassword]
    );

    const userId = result.insertId;

    await writeLog(userId, "REGISTER", "회원가입 성공", ip);

    res.json({ message: "사용자가 성공적으로 등록되었습니다.", userId });
  } catch (err) {
    await writeLog(null, "REGISTER_FAIL", err.message, ip);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
