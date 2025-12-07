// src/lib/api.js
export const API_BASE = import.meta.env.VITE_API_BASE ?? "";
// 어디에 저장돼 있는지 감지 (local 우선)
export function getAccessToken() {
  return (
    window.localStorage.getItem("access_token") ||
    window.sessionStorage.getItem("access_token") ||
    ""
  );
}

// 현재 토큰의 저장 위치를 유지한 채로 갱신 저장
function saveAccessToken(token) {
  const localHas = window.localStorage.getItem("access_token") != null;
  const target = localHas ? window.localStorage : window.sessionStorage;
  if (!token) {
    ["localStorage", "sessionStorage"].forEach((k) => {
      const s = window[k];
      s.removeItem("access_token");
      s.removeItem("access_token_saved_at");
      s.removeItem("access_token_expires_in");
    });
    return;
  }
  target.setItem("access_token", token);
  target.setItem("access_token_saved_at", String(Date.now()));
  // 만료초는 서버 응답에 따라 set; 여기선 생략 가능
}

// 앱 전역에 토큰 갱신 이벤트 알림 (선택)
function notifyTokenUpdated() {
  window.dispatchEvent(new CustomEvent("auth:token_updated"));
}

// 401 시 한 번만 재발급 → 성공하면 재시도
async function tryRefreshAndRetry(original) {
  const r = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });
  if (!r.ok) throw new Error("토큰 재발급 실패");
  const jr = await r.json().catch(() => ({}));
  const { access_token } = jr?.data || {};
  if (!access_token) throw new Error("토큰 재발급 실패");
  saveAccessToken(access_token);
  notifyTokenUpdated();
  // 재시도
  const retryHeaders = new Headers(original.headers || {});
  retryHeaders.set("Authorization", `Bearer ${access_token}`);
  const retried = await fetch(original.url, { ...original, headers: retryHeaders });
  return retried;
}

// 공용 fetch 래퍼
export async function api(path, { method = "GET", body, headers = {}, auth = true } = {}) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const h = new Headers(headers);
  if (body && !h.has("Content-Type")) h.set("Content-Type", "application/json");
  if (auth) {
    const t = getAccessToken();
    if (t) h.set("Authorization", `Bearer ${t}`);
  }
  const reqInit = {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include", // refresh 쿠키 전송
  };

  let res = await fetch(url, reqInit);

  // 401/403 → 한 번만 refresh 후 재시도
  if (auth && (res.status === 401 || res.status === 403)) {
    try {
      res = await tryRefreshAndRetry({ url, ...reqInit });
    } catch {
      // 재발급 실패 → 저장 토큰 제거 후 로그인으로 보낼지 판단
      saveAccessToken("");
      throw new Error("세션 만료");
    }
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
  return json;
}
