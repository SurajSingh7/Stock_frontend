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

// ─── Data access — three dimensions, global + optional module override ─────
// Omit moduleId to write the user's global row; pass one to override only
// the dimensions that entry marks as configured.
export const getDataScopes = (userId) => get(`${BASE}/data-scopes?userId=${encodeURIComponent(userId)}`);
export const setDataScope = (payload) => post(`${BASE}/data-scopes`, payload);
export const clearModuleDataScope = (payload) => post(`${BASE}/data-scopes/clear-module`, payload);

// ─── Department restriction — narrows a role, never widens it ──────────────
export const getDepartmentRestrictions = (departmentId) =>
  get(`${BASE}/department-restrictions?departmentId=${encodeURIComponent(departmentId)}`);
export const setDepartmentRestriction = (payload) => post(`${BASE}/department-restrictions`, payload);
export const clearDepartmentRestriction = (payload) => post(`${BASE}/department-restrictions/clear`, payload);

// ─── Effective permissions preview ──────────────────────────────────────────
export const getEffectivePermissions = (userId, roleId) =>
  get(`${BASE}/effective-permissions?userId=${encodeURIComponent(userId)}&roleId=${encodeURIComponent(roleId)}`);

// ─── Delegation ──────────────────────────────────────────────────────────────
export const delegateAccess = (payload) => post(`${BASE}/delegate`, payload);

// ─── Audit log ───────────────────────────────────────────────────────────────
export const getEntityHistory = (params) => get(`${AUDIT_BASE}/entity?${new URLSearchParams(params).toString()}`);
export const getActivityLog = (params) => get(`${AUDIT_BASE}/activity?${new URLSearchParams(params).toString()}`);
