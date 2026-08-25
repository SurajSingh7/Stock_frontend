import { API_BACKEND_URL } from '@/config/getEnvVariables';

const BASE = `${API_BACKEND_URL}/stock/access-control`;
const AUDIT_BASE = `${API_BACKEND_URL}/stock/audit-log`;

const json = async (response) => {
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || 'Request failed');
  return data;
};

const get = (url) => fetch(url, { method: 'GET', credentials: 'include' }).then(json);
const post = (url, body) =>
  fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(json);

// ─── Modules ────────────────────────────────────────────────────────────────
export const getModules = () => get(`${BASE}/modules`);

// ─── Layer 1 — role defaults ───────────────────────────────────────────────
export const getRolePermissions = (roleId) => get(`${BASE}/role-permissions?roleId=${encodeURIComponent(roleId)}`);
export const setRolePermission = (payload) => post(`${BASE}/role-permissions`, payload);

// ─── Layer 2 — user overrides ───────────────────────────────────────────────
export const getUserOverrides = (userId) => get(`${BASE}/user-overrides?userId=${encodeURIComponent(userId)}`);
export const setUserOverride = (payload) => post(`${BASE}/user-overrides`, payload);

// ─── Layer 3 — branch scope ─────────────────────────────────────────────────
export const getScopePolicies = (userId) => get(`${BASE}/scope-policies?userId=${encodeURIComponent(userId)}`);
export const setScopePolicy = (payload) => post(`${BASE}/scope-policies`, payload);

// ─── Entity access — per USER, so no moduleId ───────────────────────────────
export const getEntityAccess = (userId) => get(`${BASE}/entity-access?userId=${encodeURIComponent(userId)}`);
export const setEntityAccess = (payload) => post(`${BASE}/entity-access`, payload);

// ─── Effective permissions preview ──────────────────────────────────────────
export const getEffectivePermissions = (userId, roleId) =>
  get(`${BASE}/effective-permissions?userId=${encodeURIComponent(userId)}&roleId=${encodeURIComponent(roleId)}`);

// ─── Delegation ──────────────────────────────────────────────────────────────
export const delegateAccess = (payload) => post(`${BASE}/delegate`, payload);

// ─── Audit log ───────────────────────────────────────────────────────────────
export const getEntityHistory = (params) => get(`${AUDIT_BASE}/entity?${new URLSearchParams(params).toString()}`);
export const getActivityLog = (params) => get(`${AUDIT_BASE}/activity?${new URLSearchParams(params).toString()}`);
