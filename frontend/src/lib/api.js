// src/lib/api.js

// 항상 "API 베이스 경로"만 넣는다고 생각하면 됨.
// 예)
//  - 로컬:  http://localhost:3000/api/v1
//  - EC2:   /api/v1
export const API_BASE = import.meta.env.VITE_API_BASE ?? "";

// 토큰 읽기
export function getAccessToken() {
  return (
    window.localStorage.getItem("access_token") ||
    window.sessionStorage.getItem("access_token") ||
    ""
  );
}

// 토큰 저장 / 삭제
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
}

// 토큰 갱신 브로드캐스트(옵션)
function notifyTokenUpdated() {
  window.dispatchEvent(new CustomEvent("auth:token_updated"));
}

// 401/403일 때 한 번만 refresh 시도 후 원래 요청 재시도
async function tryRefreshAndRetry(original) {
  // ⚠️ API_BASE에 이미 /api/v1 까지 들어갈 거라서 여기서는 다시 붙이지 않음
  const r = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });

  if (!r.ok) throw new Error("토큰 재발급 실패");

  const jr = await r.json().catch(() => ({}));
  const { access_token } = jr?.data || {};
  if (!access_token) throw new Error("토큰 재발급 실패");

  saveAccessToken(access_token);
  notifyTokenUpdated();

  // 원래 요청 재시도
  const retryHeaders = new Headers(original.headers || {});
  retryHeaders.set("Authorization", `Bearer ${access_token}`);

  const retried = await fetch(original.url, {
    ...original,
    headers: retryHeaders,
  });

  return retried;
}

// 공용 fetch 래퍼
export async function api(
  path,
  { method = "GET", body, headers = {}, auth = true } = {}
) {
  // path 앞에 http로 시작하면 그대로, 아니면 API_BASE 붙이기
  const url = path.startsWith("http")
    ? path
    : path.startsWith("/")
    ? `${API_BASE}${path}`
    : `${API_BASE}/${path}`;

  const h = new Headers(headers);
  if (body && !h.has("Content-Type")) {
    h.set("Content-Type", "application/json");
  }

  if (auth) {
    const t = getAccessToken();
    if (t) h.set("Authorization", `Bearer ${t}`);
  }

  const reqInit = {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  };

  let res = await fetch(url, reqInit);

  if (auth && (res.status === 401 || res.status === 403)) {
    try {
      res = await tryRefreshAndRetry({ url, ...reqInit });
    } catch {
      saveAccessToken("");
      throw new Error("세션 만료");
    }
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
  return json;
}
