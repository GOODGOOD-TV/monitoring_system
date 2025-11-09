const express = require("express");
const { writeLog } = require("../utils/log");
const authenticateToken = require("../auth");

const router = express.Router();

// 로그아웃
router.post("/", authenticateToken, async (req, res) => {
  const ip = req.ip;

  try {
    // ✅ 쿠키에서 refreshToken 제거
    res.clearCookie("refreshToken");

    // ✅ 로그 기록
    await writeLog(req.user.id, "LOGOUT", "로그아웃 성공", ip);

    res.json({ message: "로그아웃되었습니다." });
  } catch (err) {
    await writeLog(req.user ? req.user.id : null, "LOGOUT_FAIL", err.message, ip);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
