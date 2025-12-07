import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

// 공용 컴포넌트
import Navbar from "./components/Navbar.jsx";
import RequireAuth from "./components/RequireAuth.jsx";

// 페이지
import MonitoringPage from "./pages/MonitoringPage.jsx";
import SensorsPage from "./pages/SensorsPage.jsx";
import AnalyticsPage from "./pages/AnalyticsPage.jsx";
import ZonesPage from "./pages/ZonesPage.jsx";
import ZoneSensorsPage from "./pages/ZoneSensorsPage.jsx";
import SensorDetailPage from "./pages/SensorDetailPage.jsx";
import SensorEditPage from "./pages/SensorEditPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";

export default function App() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Navbar />

      <main style={{ flex: 1, background: "#e5e7eb" }}>
        <Routes>
          {/* 기본 진입시 로그인으로 */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* 인증 필요 없는 페이지 */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* 여기부터는 토큰 필수 */}
          <Route element={<RequireAuth />}>
            <Route path="/monitoring" element={<MonitoringPage />} />
            <Route path="/sensors"    element={<SensorsPage />} />
            <Route path="/analytics"  element={<AnalyticsPage />} />
            <Route path="/zones"      element={<ZonesPage />} />
            <Route path="/zones/:zoneId" element={<ZoneSensorsPage />} />
            <Route
              path="/zones/:zoneId/sensors/:sensorId"
              element={<SensorDetailPage />}
            />
            <Route
              path="/zones/:zoneId/sensors/:sensorId/edit"
              element={<SensorEditPage />}
            />
            <Route path="/settings"   element={<SettingsPage />} />
          </Route>

          {/* 보호 안 걸리는 나머지 이상한 URL → 로그인으로 */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </main>
    </div>
  );
}
