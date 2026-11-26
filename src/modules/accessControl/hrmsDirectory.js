import { api, ApiError } from '@/lib/apiClient';
import { API_ENDPOINTS } from '@/constants/api';

// Talks directly to HRMS (portal-backend), the same way erp-sales already
// does — see erp-sales/src/components/core/admin/roleModulePermission and
// .../abacPolicy. Stock-backend has no local copy of role/user identity data
// (it only consumes an id via the shared JWT), so a role/user picker has to
// read this from HRMS itself. portal-backend's allowedOrigins already covers
// http://localhost:3000, so the browser's userSession cookie carries over.

const HRMS = API_ENDPOINTS.admin.hrms;

// A missing endpoint (older HRMS) reads as an empty list, not an error.
const list = async (url, query, fallback) => {
  try {
    return (await api.get(url, { query, fallback })).data || [];
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return [];
    throw e;
  }
};

// Same endpoint family the staff-registration form uses for its department
// dropdown, so the two can never show different departments.
export const searchHrmsDepartments = async (search = '') =>
  (await list(HRMS.departments, { page: 1, limit: 100, search }, 'Failed to load departments')).map((d) => ({
    id: d._id,
    label: d.name,
    description: d.description || '',
  }));

export const searchHrmsRoles = async (search = '') =>
  (await list(HRMS.roles, { page: 1, limit: 50, search }, 'Failed to load roles')).map((r) => ({
    id: r._id,
    label: r.name,
    description: r.description || '',
  }));

// Requires an HRMS admin session (protectAdmin) — same as erp-sales's own
// AbacPolicyComp. A non-admin picker gracefully falls back to manual entry;
// see UserPicker's `allowManualId`.
export const searchHrmsUsers = async (search = '') =>
  (await list(HRMS.users, { page: 1, limit: 50, search }, 'Failed to load users'))
    .filter((u) => u.login_id?._id)
    .map((u) => ({
      id: u.login_id._id,
      label: `${u.firstName || ''}`.trim() || u.login_id.username,
      description: [u.employeeCode, u.login_id.email].filter(Boolean).join(' · '),
      roleId: u.login_id.role?._id || '',
      roleName: u.login_id.role?.name || '',
    }));
