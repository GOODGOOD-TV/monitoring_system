import { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE, clearTokens } from "../lib/api";
/** 환경 설정 */
const AFTER_LOGIN_PATH = "/monitoring";                  // 로그인 성공 후 이동

// 저장소 선택: 상태 유지 체크 시 localStorage, 아니면 sessionStorage
const getStore = (persist) => (persist ? window.localStorage : window.sessionStorage);

export default function LoginPage() {
  useEffect(() => {
    // 로그인 페이지 들어오면 기존 토큰 모두 삭제
    clearTokens();
  }, []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberId, setRememberId] = useState(false);
  const [persistLogin, setPersistLogin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const [accessToken, setAccessToken] = useState("");
  const refreshTimer = useRef(null);

  // 최초 로드: 저장된 이메일 복구 + 토큰 있으면 바로 이동
  useEffect(() => {
    const savedId = localStorage.getItem("rememberEmail");
    if (savedId) {
      setEmail(savedId);
      setRememberId(true);
    }
    const t = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
    if (t) {
      window.location.replace(AFTER_LOGIN_PATH);
    }
  }, []);

  // 공통 fetch 래퍼
  const api = useMemo(() => {
    return async function api(path, { method = "GET", body, headers = {}, auth = true } = {}) {
      const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: {
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(auth && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        credentials: "include", // refreshToken 쿠키 전송
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
      return json; // { data, message, ... }
    };
  }, [accessToken]);

  // 토큰 적용 + 자동 갱신
  const applyAccessToken = (token, expiresInSec, persist) => {
    setAccessToken(token);
    const store = getStore(persist);
    store.setItem("access_token", token);
    store.setItem("access_token_saved_at", String(Date.now()));
    store.setItem("access_token_expires_in", String(expiresInSec));

    const delay = Math.max(0, (Number(expiresInSec) - 5) * 1000);
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(refreshAccessToken, delay);
  };

  const refreshAccessToken = async () => {
    try {
      const res = await api("/auth/refresh", { method: "POST", auth: false });
      const { access_token, expires_in } = res?.data || {};
      if (!access_token) throw new Error("토큰 재발급 실패");
      applyAccessToken(access_token, expires_in, persistLogin);
      setMsg("세션 갱신 완료");
    } catch (e) {
      setMsg(`세션 만료: ${e.message}`);
      handleLogout(false);
    }
  };
//로그인
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      if (rememberId) localStorage.setItem("rememberEmail", email);
      else localStorage.removeItem("rememberEmail");

      const res = await api("/auth/login", {
        method: "POST",
        auth: false,
        body: { email, password }, // 백엔드 auth.js 기준
      });

      const { access_token, expires_in } = res?.data || {};
      if (!access_token) throw new Error("access_token 누락");

      applyAccessToken(access_token, expires_in, persistLogin);
      window.location.assign(AFTER_LOGIN_PATH);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async (callServer = true) => {
    try {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      setAccessToken("");
      ["localStorage", "sessionStorage"].forEach((k) => {
        const s = window[k];
        s.removeItem("access_token");
        s.removeItem("access_token_saved_at");
        s.removeItem("access_token_expires_in");
      });
      if (callServer) await api("/auth/logout", { method: "POST", auth: false });
    } catch {}
  };

  return (
    <div style={wrap}>
      {/* 헤더 */}
      <div style={titleArea}>
        <div style={loginTitle}>LOGIN</div>
        <div style={subtitle}>모니터링 시스템</div>
      </div>

      {/* 폼 */}
      <form onSubmit={handleSubmit} style={{ width: 360 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div style={{ flex: 1, display: "grid", gap: 10 }}>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={input}
            />
            <input
              type="password"
              placeholder="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={input}
            />
          </div>

          <button type="submit" disabled={loading} style={loginBtn}>
            {loading ? "..." : "LOGIN"}
          </button>
        </div>

        {/* 체크박스 영역 */}
        <div style={checks}>
          <label style={checkItem}>
            <input
              type="checkbox"
              checked={rememberId}
              onChange={(e) => setRememberId(e.target.checked)}
            />
            <span>아이디 저장</span>
          </label>
          <label style={checkItem}>
            <input
              type="checkbox"
              checked={persistLogin}
              onChange={(e) => setPersistLogin(e.target.checked)}
            />
            <span>로그인 상태 유지</span>
          </label>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <button type="button" style={subBtn} onClick={() => window.location.assign("/register")}>
                회원가입
            </button>
            <button type="button" style={subBtn}>
                ID / 비밀번호 찾기
            </button>
        </div>

        {/* 메시지 */}
        {msg && <p style={msgStyle}>{msg}</p>}
      </form>
    </div>
  );
}

/* ---------- Inline Styles ---------- */
const wrap = {
  minHeight: "100vh",
  padding: 24,
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  justifyContent: "flex-start",
  background: "#fff",
};

const titleArea = { marginBottom: 16 };
const loginTitle = { fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" };
const subtitle = { marginTop: 4, fontSize: 12, color: "#71717a" };

const input = {
  width: "100%",
  border: "1px solid #d4d4d8",
  borderRadius: 6,
  padding: "10px 12px",
  fontSize: 14,
  boxSizing: "border-box",
};

const loginBtn = {
  height: 88,
  width: 64,
  borderRadius: 6,
  background: "#111827",
  color: "#fff",
  fontSize: 12,
  fontWeight: 600,
  border: "none",
  cursor: "pointer",
};

const checks = {
  marginTop: 8,
  display: "flex",
  gap: 24,
  fontSize: 12,
  color: "#374151",
  alignItems: "center",
};

const checkItem = { display: "inline-flex", alignItems: "center", gap: 6 };

const subBtn = {
  borderRadius: 6,
  background: "#111827",
  color: "#fff",
  padding: "8px 14px",
  fontSize: 12,
  border: "none",
  cursor: "pointer",
};

const msgStyle = { marginTop: 10, fontSize: 13, color: "#111827" };
