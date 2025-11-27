import { api } from "../lib/api.js";

const API_BASE = import.meta?.env?.VITE_API_BASE || "http://localhost:3000";

// 로그인 페이지에서 쓰는 것과 동일한 키 사용
const getStoredAccessToken = () =>
  localStorage.getItem("access_token") || sessionStorage.getItem("access_token");

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** 구역 목록 조회 */
export async function getZones() {
  const token = getStoredAccessToken();

  const res = await fetch(`${API_BASE}/api/v1/areas`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include", // refreshToken 쿠키도 같이 감
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new HttpError(res.status, body?.message || `HTTP ${res.status}`);
  }

  if (!body.is_sucsess) {
    throw new HttpError(res.status, body?.message ?? "구역 목록 조회 실패");
  }

  // ZonesPage에서 쓰기 편하게 이름 매핑
  return body.data.map((a) => ({
    id: a.id,
    name: a.area_name,
    isActive: !!a.is_active,
    createdAt: a.created_at,
  }));
}

/** 구역 하나 조회 – 지금 안 써도 import 깨지지 않게 유지 */
export async function getZone(zoneId) {
  if (!zoneId) return null;

  const json = await api(`/api/v1/areas/${zoneId}`);

  if (!json?.is_sucsess) {
    throw new Error(json?.message || "구역 조회 실패");
  }

  const a = json.data;

  // 컴포넌트에서 쓰기 편하게 이름 맞춰주기
  return {
    id: a.id,
    name: a.area_name,
    isActive: a.is_active,
    createdAt: a.created_at,
  };
}
