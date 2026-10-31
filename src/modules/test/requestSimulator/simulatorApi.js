/* 🧪 TEST ONLY — Request Simulator. Remove with the rest of src/modules/test/requestSimulator. */
import { api } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/constants/api";

const BASE = API_ENDPOINTS.admin.testSimulator.base;

const data = async (promise) => (await promise).data;

export const fetchMeta = () => data(api.get(`${BASE}/meta`, { fallback: "Failed to load branches and categories" }));
export const fetchSubscribers = (search = "") =>
  data(api.get(`${BASE}/subscribers`, { query: { search }, fallback: "Failed to load subscribers" }));
export const fetchHoldings = (subscriberId) =>
  data(api.get(`${BASE}/subscribers/${subscriberId}/items`, { fallback: "Failed to load what the subscriber holds" }));
export const addSubscriber = (body) => data(api.post(`${BASE}/subscribers`, body, { fallback: "Failed to add the subscriber" }));
export const sendRequest = (subscriberId, body) =>
  data(api.post(`${BASE}/subscribers/${subscriberId}/requests`, body, { fallback: "Failed to send the request" }));
export const withdrawRequest = (requestId, reason = "") =>
  data(api.post(`${BASE}/requests/${requestId}/withdraw`, { reason }, { fallback: "Failed to withdraw the request" }));
export const resendRequest = (requestId, body) =>
  data(api.put(`${BASE}/requests/${requestId}`, body, { fallback: "Failed to send the request again" }));
