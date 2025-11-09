const express = require("express");
const router = express.Router();

router.post("/", async (req, res) => {
  const { timestamp, sensors } = req.body;
  console.log("📡 수신:", timestamp, sensors.length, "개 센서");

  // TODO: DB 저장 / 분석 로직 추가
  res.json({ message: "데이터 수신 완료", count: sensors.length });
});

module.exports = router;
