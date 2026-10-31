import { api, ApiError } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/constants/api";

const CORE = API_ENDPOINTS.core;

/*
  HRMS login. Resolves to { ok, result } with HRMS's own body either way —
  the screen reads its message/key on failure too (login limit, broken
  account). Only a network failure throws.
*/
export const login = async (body) => {
  try {
    return { ok: true, result: await api.post(CORE.hrms.login, body) };
  } catch (e) {
    if (e instanceof ApiError && e.status > 0) return { ok: e.status < 400, result: e.body || {} };
    throw e;
  }
};

// Ends the HRMS session (and with it the userSession cookie). Throws if refused.
export const logout = () => api.raw(CORE.hrms.logout, { fallback: "Logout failed" });

/*
  Who is signed in (HRMS) and what they may open (this backend). Read as raw
  responses: only the HTTP status decides, as it always has — HRMS's body is
  not this backend's { success } envelope.
*/
export const fetchAuthData = async () => (await api.raw(CORE.hrms.authData)).json();
export const fetchMyPermissions = async () => (await api.raw(CORE.myPermissions)).json();
