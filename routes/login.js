console.log("✅ login.js 라우트 로드됨");


const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const { writeLog } = require("../utils/log"); // ✅ 로그 기록 유틸 불러오기

const router = express.Router();

const ACCESS_SECRET = "access-secret-key";   // 실제 운영에서는 .env 로 분리
const REFRESH_SECRET = "refresh-secret-key"; // 실제 운영에서는 .env 로 분리

// 로그인
router.post("/", async (req, res) => {
  console.log("✅ /login POST 진입:", req.body);

  const { email, password } = req.body;
  const ip = req.ip; // 요청자 IP

  if (!email || !password) {
    return res.status(400).json({ error: "이메일과 비밀번호는 필수입니다." });
  }

  try {
    // 사용자 조회
    const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
    if (rows.length === 0) {
      await writeLog(null, "LOGIN_FAIL", "존재하지 않는 이메일", ip);
      return res.status(400).json({ error: "존재하지 않는 사용자입니다." });
    }

    const user = rows[0];

    // 비밀번호 검증
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      await writeLog(user.id, "LOGIN_FAIL", "비밀번호 불일치", ip);
      return res.status(401).json({ error: "비밀번호가 올바르지 않습니다." });
    }

    // 계정 활성 여부 확인
    if (!user.is_active) {
      await writeLog(user.id, "LOGIN_FAIL", "비활성화된 계정", ip);
      return res.status(403).json({ error: "비활성화된 계정입니다." });
    }

    // ✅ Access Token (짧게, 예: 15분)
    const accessToken = jwt.sign(
      { id: user.id, role: user.role, company_code: user.company_code },
      ACCESS_SECRET,
      { expiresIn: "15m" }
    );

    // ✅ Refresh Token (길게, 예: 7일)
    const refreshToken = jwt.sign(
      { id: user.id },
      REFRESH_SECRET,
      { expiresIn: "7d" }
    );

    // ✅ Refresh Token 쿠키 저장
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,   // JS에서 접근 불가
      secure: false,    // HTTPS 환경에서는 true 권장
      sameSite: "strict"
    });

    // ✅ 로그인 성공 로그 기록
    await writeLog(user.id, "LOGIN", "로그인 성공", ip);

    // Access Token 응답
    res.json({ accessToken });
  } catch (err) {
    console.error("❌ [LOGIN ERROR]", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
