import { API_PORTAL_BACKEND_URL } from '@/config/getEnvVariables';

// Talks directly to HRMS (portal-backend), the same way erp-sales already
// does — see erp-sales/src/components/core/admin/roleModulePermission and
// .../abacPolicy. Stock-backend has no local copy of role/user identity data
// (it only consumes an id via the shared JWT), so a role/user picker has to
// read this from HRMS itself. portal-backend's allowedOrigins already covers
// http://localhost:3000, so the browser's userSession cookie carries over.

// Same endpoint family the staff-registration form uses for its department
// dropdown, so the two can never show different departments.
export const searchHrmsDepartments = async (search = '') => {
  const params = new URLSearchParams({ page: '1', limit: '100' });
  if (search) params.set('search', search);
  const res = await fetch(`${API_PORTAL_BACKEND_URL}/api/role-management/department/get-all?${params}`, {
    method: 'GET',
    credentials: 'include',
  });
  if (res.status === 404) return [];
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'Failed to load departments');
  return (data.data || []).map((d) => ({ id: d._id, label: d.name, description: d.description || '' }));
};

export const searchHrmsRoles = async (search = '') => {
  const params = new URLSearchParams({ page: '1', limit: '50' });
  if (search) params.set('search', search);
  const res = await fetch(`${API_PORTAL_BACKEND_URL}/api/role-management/roles/get-all?${params}`, {
    method: 'GET',
    credentials: 'include',
  });
  if (res.status === 404) return [];
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'Failed to load roles');
  return (data.data || []).map((r) => ({ id: r._id, label: r.name, description: r.description || '' }));
};

// Requires an HRMS admin session (protectAdmin) — same as erp-sales's own
// AbacPolicyComp. A non-admin picker gracefully falls back to manual entry;
// see UserPicker's `allowManualId`.
export const searchHrmsUsers = async (search = '') => {
  const params = new URLSearchParams({ page: '1', limit: '50' });
  if (search) params.set('search', search);
  const res = await fetch(`${API_PORTAL_BACKEND_URL}/api/admin/data/user-data?${params}`, {
    method: 'GET',
    credentials: 'include',
  });
  if (res.status === 404) return [];
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'Failed to load users');
  return (data.data || [])
    .filter((u) => u.login_id?._id)
    .map((u) => ({
      id: u.login_id._id,
      label: `${u.firstName || ''}`.trim() || u.login_id.username,
      description: [u.employeeCode, u.login_id.email].filter(Boolean).join(' · '),
      roleId: u.login_id.role?._id || '',
      roleName: u.login_id.role?.name || '',
    }));
};
