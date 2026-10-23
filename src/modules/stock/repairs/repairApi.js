import { API_BACKEND_URL } from "@/config/getEnvVariables";

const BASE = `${API_BACKEND_URL}/stock/repairs`;

const call = async (url, { method = "GET", body } = {}, fallback = "Request failed") => {
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) throw new Error(json.message || fallback);
  return json;
};

export const fetchRepairs = async (query) => {
  const j = await call(`${BASE}?${new URLSearchParams(query)}`, {}, "Failed to load");
  return { rows: j.data || [], total: j.pagination?.total ?? 0 };
};
export const fetchRepairCounts = async (query = {}) => (await call(`${BASE}/counts?${new URLSearchParams(query)}`, {}, "Failed to load counts")).data || {};
export const fetchRepairVendors = async () => (await call(`${BASE}/vendors`, {}, "Failed to load vendors")).data || [];

const step = (path, fallback) => async (id, body) => (await call(`${BASE}/${id}/${path}`, { method: "PATCH", body: body || {} }, fallback)).data;
export const reportFaulty = step("report-faulty", "Failed to report the fault");
export const sendForRepair = step("send-repair", "Failed to send for repair");
export const repairResult = step("repair-result", "Failed to save the repair result");
export const sendClaim = step("claim", "Failed to send the warranty claim");
export const claimOutcome = step("claim-outcome", "Failed to close the claim");
export const markOk = step("mark-ok", "Failed to mark it working");
export const scrapUnit = step("scrap", "Failed to scrap");
