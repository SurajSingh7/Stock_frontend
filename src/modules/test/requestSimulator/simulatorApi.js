/* 🧪 TEST ONLY — Request Simulator. Remove with the rest of src/modules/test/requestSimulator. */
import { API_BACKEND_URL } from "@/config/getEnvVariables";

const BASE = `${API_BACKEND_URL}/stock/test-simulator`;

const call = async (url, { method = "GET", body } = {}, fallback = "Request failed") => {
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) throw new Error(json.message || fallback);
  return json.data;
};

export const fetchMeta = () => call(`${BASE}/meta`, {}, "Failed to load branches and categories");
export const fetchSubscribers = (search = "") =>
  call(`${BASE}/subscribers?${new URLSearchParams(search ? { search } : {})}`, {}, "Failed to load subscribers");
export const fetchHoldings = (subscriberId) => call(`${BASE}/subscribers/${subscriberId}/items`, {}, "Failed to load what the subscriber holds");
export const addSubscriber = (body) => call(`${BASE}/subscribers`, { method: "POST", body }, "Failed to add the subscriber");
export const sendRequest = (subscriberId, body) =>
  call(`${BASE}/subscribers/${subscriberId}/requests`, { method: "POST", body }, "Failed to send the request");
export const withdrawRequest = (requestId, reason = "") =>
  call(`${BASE}/requests/${requestId}/withdraw`, { method: "POST", body: { reason } }, "Failed to withdraw the request");
export const resendRequest = (requestId, body) => call(`${BASE}/requests/${requestId}`, { method: "PUT", body }, "Failed to send the request again");
