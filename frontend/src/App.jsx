import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

// 공용 컴포넌트
import Navbar from "./components/Navbar.jsx";

// 페이지
import MonitoringPage from "./pages/MonitoringPage.jsx";
import SensorsPage from "./pages/SensorsPage.jsx";
import AnalyticsPage from "./pages/AnalyticsPage.jsx";
import ZonesPage from "./pages/ZonesPage.jsx";
import ZoneSensorsPage from "./pages/ZoneSensorsPage.jsx";
import SensorDetailPage from "./pages/SensorDetailPage.jsx";
import SensorEditPage from "./pages/SensorEditPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";

// 아직 미구현 페이지는 임시 박스로
const box = { maxWidth: 1200, margin: "0 auto", padding: 24 };
const Zones    = () => <div style={box}>구역</div>;
const Settings = () => <div style={box}>설정</div>;

export default function App() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* 상단 네비게이션 */}
      <Navbar />

      {/* 본문: 회색 배경 영역 */}
      <main style={{ flex: 1, background: "#e5e7eb" }}>
        <Routes>
          {/* 기본 진입시 모니터링으로 */}
          <Route path="/" element={<Navigate to="/monitoring" replace />} />

          {/* 실제 페이지들 */}
          <Route path="/monitoring" element={<MonitoringPage />} />
          <Route path="/sensors"    element={<SensorsPage />} />
          <Route path="/analytics"  element={<AnalyticsPage />} />
          <Route path="/zones" element={<ZonesPage />} />
          <Route path="/zones/:zoneId" element={<ZoneSensorsPage />} />
          <Route path="/zones/:zoneId/sensors/:sensorId" element={<SensorDetailPage />} />
          <Route path="/zones/:zoneId/sensors/:sensorId/edit" element={<SensorEditPage />} />
          <Route path="/settings"   element={<SettingsPage />} />
          {/* 임시 페이지들 (원하면 추후 실제 파일로 교체) */}
          <Route path="/settings"   element={<Settings />} />

          {/* 정의되지 않은 경로 → 모니터링으로 */}
          <Route path="*" element={<Navigate to="/monitoring" replace />} />
        </Routes>
      </main>
    </div>
  );
}
