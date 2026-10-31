import { api } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/constants/api";

// Every Alerts & Escalations call goes through here: paths relative to the
// alerts base, the envelope already unwrapped and checked by apiClient.
const ALERTS = API_ENDPOINTS.admin.alerts.base;

export const alertApi = (path, { method = "GET", body, query } = {}) => {
  const url = `${ALERTS}${path}`;
  switch (method) {
    case "POST":
      return api.post(url, body, { query });
    case "PUT":
      return api.put(url, body, { query });
    case "PATCH":
      return api.patch(url, body, { query });
    case "DELETE":
      return api.delete(url, { query });
    default:
      return api.get(url, { query });
  }
};
