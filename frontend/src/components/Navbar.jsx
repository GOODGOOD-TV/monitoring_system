import React from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { API_BASE, clearTokens } from "../lib/api";

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();

  const isAuthPage =
    location.pathname === "/login" ||
    location.pathname === "/register";

  const linkStyle = ({ isActive }) => {
    const base = {
      padding: "10px 14px",
      borderRadius: 10,
      textDecoration: "none",
      color: isActive ? "#fff" : "#111",
      background: isActive ? "#111" : "transparent",
      marginRight: 8,
      transition: "opacity 0.2s",
    };

    if (isAuthPage) {
      return {
        ...base,
        pointerEvents: "none",  // 클릭 금지
        opacity: 0.4,           // 흐리게 표시
      };
    }

    return base;
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        credentials: "include",
      }).catch(() => {});
    } catch {}

    clearTokens();
    navigate("/login", { replace: true });
  };

  return (
    <header style={{ borderBottom: "1px solid #e5e7eb", background: "#fff" }}>
      <nav style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}>
        <div>
          <NavLink to="/monitoring" style={linkStyle}>모니터링</NavLink>
          <NavLink to="/sensors" style={linkStyle}>센서정보</NavLink>
          <NavLink to="/analytics" style={linkStyle}>데이터분석</NavLink>
          <NavLink to="/zones" style={linkStyle}>구역</NavLink>
          <NavLink to="/settings" style={linkStyle}>설정</NavLink>
          <NavLink to="/login" style={linkStyle} onClick={handleLogout}>
            로그아웃
          </NavLink>
        </div>
      </nav>
    </header>
  );
}
