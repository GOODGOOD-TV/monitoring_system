import React from "react";
import { NavLink } from "react-router-dom";
import { API_BASE } from "../lib/api";

const linkStyle = ({ isActive }) => ({
  padding: "10px 14px",
  borderRadius: 10,
  textDecoration: "none",
  color: isActive ? "#fff" : "#111",
  background: isActive ? "#111" : "transparent",
  marginRight: 8,
});

function clearToken() {
  ["localStorage", "sessionStorage"].forEach((k) => {
    const s = window[k];
    s.removeItem("access_token");
    s.removeItem("access_token_saved_at");
    s.removeItem("access_token_expires_in");
  });
}

export default function Navbar() {
  // const navigate = useNavigate();
  const handleLogout = async () => { 
    try {
      await fetch(`${API_BASE}/auth/logout`, { //서버에 로그아웃 로그 작성 시
        method: "POST",
        credentials: "include",
      }).catch(() => {});
    } catch {}
      clearToken();
      navigate("/login", { replace: true });
  };
  return (
    <header style={{ borderBottom: "1px solid #e5e7eb", background: "#fff" }}>
      <nav style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}>
        <div>
          <NavLink to="/monitoring" style={linkStyle}>모니터링</NavLink>
          <NavLink to="/sensors"    style={linkStyle}>센서정보</NavLink>
          <NavLink to="/analytics"  style={linkStyle}>데이터분석</NavLink>
          <NavLink to="/zones"      style={linkStyle}>구역</NavLink>
          <NavLink to="/settings"   style={linkStyle}>설정</NavLink>
          <NavLink to="/login"   style={linkStyle} onClick={handleLogout}>로그아웃</NavLink>
        </div>
      </nav>
    </header>
  );
}
