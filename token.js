// token.js — Access Token 검증 전용 미들웨어
const jwt = require("jsonwebtoken");
const { writeLog } = require("./utils/log");

// ⚠️ Access Token 비밀키 (실제 운영 환경에서는 .env에서 불러와야 함)
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "access-secret-key";

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // "Bearer <token>"
  const ip = req.ip;

  // 🔒 토큰이 없을 때 접근 차단
  if (!token) {
    writeLog(null, "ACCESS_DENIED", "토큰 없음", ip);
    return res.status(401).json({ error: "토큰이 제공되지 않았습니다." });
  }

  // ✅ 토큰 검증
  jwt.verify(token, ACCESS_SECRET, (err, user) => {
    if (err) {
      // 만료 또는 위조된 토큰일 때
      writeLog(null, "ACCESS_DENIED", "토큰이 유효하지 않거나 만료됨", ip);
      return res
        .status(403)
        .json({ error: "토큰이 유효하지 않거나 만료되었습니다." });
    }

    // 👤 검증 성공 → 요청에 사용자 정보 저장
    req.user = user;

    // (선택) 만료 임박 시 새로운 토큰 재발급 예시
    // const exp = user.exp * 1000;
    // if (exp - Date.now() < 5 * 60 * 1000) {
    //   const newToken = jwt.sign(
    //     { id: user.id, role: user.role },
    //     ACCESS_SECRET,
    //     { expiresIn: "15m" }
    //   );
    //   res.setHeader("x-new-token", newToken); // 클라이언트에서 자동 갱신 가능
    // }

    next();
  });
}

module.exports = authenticateToken;
