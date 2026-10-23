import { API_BACKEND_URL } from "@/config/getEnvVariables";

// Every Alerts & Escalations call goes through here: one base path, cookies,
// and the backend's { success, message, data, pagination } envelope unwrapped.
export const ALERTS_API = `${API_BACKEND_URL}/stock/alerts`;

export const alertApi = async (path, { method = "GET", body, query } = {}) => {
  const qs = query
    ? `?${new URLSearchParams(
        Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== "")
      ).toString()}`
    : "";
  const res = await fetch(`${path.startsWith("http") ? path : `${ALERTS_API}${path}`}${qs}`, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) throw new Error(json.message || `Request failed (${res.status})`);
  return json;
};

// Reference lists used by the rule editor. Missing permission → empty list,
// the condition pickers simply have nothing to offer.
export const fetchOptional = async (url) => {
  try {
    return (await alertApi(url)).data || [];
  } catch {
    return [];
  }
};

export const STOCK_API = `${API_BACKEND_URL}/stock`;
