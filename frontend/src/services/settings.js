// src/services/settings.js
import { api, getAccessToken } from "../lib/api.js";

export async function getSettings() {
  const res = await api("/users/me");
  const u = res.data ?? res;

  return {
    profile: {
      id: u.id,
      company_id: u.company_id,
      employee_id: u.employee_id,
      name: u.name,
      company_name: u.company_name ?? "",
      role: u.role,
      is_active: u.is_active,
      created_at: u.created_at,
      updated_at: u.updated_at,
    },
    contact: {
      phone: u.phone ?? "",
      email: u.email ?? "",
    },
  };
}

export async function saveSettings(settings) {
  const body = {
    phone: settings.contact?.phone ?? null,
    email: settings.contact?.email ?? null,
  };

  return api("/users/me", {
    method: "PATCH",
    body,
  });
}
