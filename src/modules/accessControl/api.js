import { api } from '@/lib/apiClient';
import { API_ENDPOINTS } from '@/constants/api';

const EP = API_ENDPOINTS.admin.accessControl;
const AUDIT = API_ENDPOINTS.admin.auditLog;

const get = (path, query) => api.get(path, { query });
const post = (path, body) => api.post(path, body);

// ─── Modules ────────────────────────────────────────────────────────────────
export const getModules = () => get(EP.modules);

// ─── Layer 1 — role defaults ───────────────────────────────────────────────
export const getRolePermissions = (roleId) => get(EP.rolePermissions, { roleId });
export const setRolePermission = (payload) => post(EP.rolePermissions, payload);

// ─── Layer 2 — user overrides ───────────────────────────────────────────────
export const getUserOverrides = (userId) => get(EP.userOverrides, { userId });
export const setUserOverride = (payload) => post(EP.userOverrides, payload);

// ─── Data access — three dimensions, global + optional module override ─────
// Omit moduleId to write the user's global row; pass one to override only
// the dimensions that entry marks as configured.
export const getDataScopes = (userId) => get(EP.dataScopes, { userId });
export const setDataScope = (payload) => post(EP.dataScopes, payload);
export const clearModuleDataScope = (payload) => post(EP.clearModuleDataScope, payload);

// ─── Department restriction — narrows a role, never widens it ──────────────
export const getDepartmentRestrictions = (departmentId) => get(EP.departmentRestrictions, { departmentId });
export const setDepartmentRestriction = (payload) => post(EP.departmentRestrictions, payload);
export const clearDepartmentRestriction = (payload) => post(EP.clearDepartmentRestriction, payload);

// ─── Effective permissions preview ──────────────────────────────────────────
export const getEffectivePermissions = (userId, roleId) => get(EP.effectivePermissions, { userId, roleId });

// ─── Delegation ──────────────────────────────────────────────────────────────
export const delegateAccess = (payload) => post(EP.delegate, payload);

// ─── Audit log ───────────────────────────────────────────────────────────────
export const getEntityHistory = (params) => get(AUDIT.entity, params);
export const getActivityLog = (params) => get(AUDIT.activity, params);
