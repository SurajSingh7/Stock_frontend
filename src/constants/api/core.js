import { API_PORTAL_BACKEND_URL } from "@/config/getEnvVariables";

/* Sign-in and identity: HRMS (portal backend) plus this app's own permissions. */

export const PORTAL_URL = API_PORTAL_BACKEND_URL.replace(/\/+$/, "");

export const CORE_API = {
  hrms: {
    login: `${PORTAL_URL}/hrms/login`,
    logout: `${PORTAL_URL}/hrms/logout`,
    authData: `${PORTAL_URL}/hrms/authdata`,
  },
  // Effective module permissions + branch, resolved server-side.
  myPermissions: "/stock/access-control/my-permissions",
};
