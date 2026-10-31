import { PORTAL_URL as PORTAL } from "./core";

/* Administration (Access Control, Alerts & Escalations, Testing) and the bell. */

export const ADMIN_API = {
  accessControl: {
    modules: "/stock/access-control/modules",
    rolePermissions: "/stock/access-control/role-permissions",
    userOverrides: "/stock/access-control/user-overrides",
    dataScopes: "/stock/access-control/data-scopes",
    clearModuleDataScope: "/stock/access-control/data-scopes/clear-module",
    departmentRestrictions: "/stock/access-control/department-restrictions",
    clearDepartmentRestriction: "/stock/access-control/department-restrictions/clear",
    effectivePermissions: "/stock/access-control/effective-permissions",
    delegate: "/stock/access-control/delegate",
  },

  auditLog: {
    entity: "/stock/audit-log/entity",
    activity: "/stock/audit-log/activity",
  },

  // HRMS directory, read straight from the portal backend (see hrmsDirectory.js).
  hrms: {
    departments: `${PORTAL}/api/role-management/department/get-all`,
    roles: `${PORTAL}/api/role-management/roles/get-all`,
    users: `${PORTAL}/api/admin/data/user-data`,
  },

  // ERP backend's master data, through the same-origin /erp-api rewrite
  // (that host only allows sales.gtel.in for CORS) — call with { base: "" }.
  erp: {
    internalCompanies: "/erp-api/config/internal/company/all",
    gstVerify: "/erp-api/third-party/gst/verify",
  },

  alerts: {
    base: "/stock/alerts",
    inbox: "/stock/alerts/inbox",
    inboxStream: "/stock/alerts/inbox/stream",
    // Preview of a manual alert before it is sent (e.g. PO_SEND_TO_VENDOR).
    manualPreview: (code, refId) => `/stock/alerts/manual/${code}/${refId}/preview`,
  },

  // 🧪 TEST ONLY — remove with src/modules/test/requestSimulator.
  testSimulator: {
    base: "/stock/test-simulator",
  },
};
