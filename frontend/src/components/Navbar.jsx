import React from "react";
import { NavLink } from "react-router-dom";

const linkStyle = ({ isActive }) => ({
  padding: "10px 14px",
  borderRadius: 10,
  textDecoration: "none",
  color: isActive ? "#fff" : "#111",
  background: isActive ? "#111" : "transparent",
  marginRight: 8,
});

export default function Navbar() {
  return (
    <header style={{ borderBottom: "1px solid #e5e7eb", background: "#fff" }}>
      <nav style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}>
        <NavLink to="/monitoring" style={linkStyle}>모니터링</NavLink>
        <NavLink to="/sensors"    style={linkStyle}>센서정보</NavLink>
        <NavLink to="/analytics"  style={linkStyle}>데이터분석</NavLink>
        <NavLink to="/zones"      style={linkStyle}>구역</NavLink>
        <NavLink to="/settings"   style={linkStyle}>설정</NavLink>
      </nav>
    </header>
  );
}
