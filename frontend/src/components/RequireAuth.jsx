// src/components/RequireAuth.jsx
import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom"; // ⭐ Outlet 꼭!!

import { getAccessToken } from "../lib/api"; // 경로/이름 확인

export default function RequireAuth() {
  const location = useLocation();
  const token = getAccessToken();

  // 디버그용 로그
  console.log("RequireAuth token:", token, "location:", location.pathname);

  if (!token) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    );
  }

  // 토큰 있으면 자식 라우트 렌더링
  return <Outlet />;
}
