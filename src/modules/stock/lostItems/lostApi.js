import { api } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/constants/api";

/*
  Lost Items (family "lost": LOST / FOUND entries) and Dead Items (family
  "dead": DEAD entries) — the same calls on two sets of routes.
  side: "items" (make / read) or "approval" (review / decide).
*/
const EP = (family) => (family === "dead" ? API_ENDPOINTS.inventory.deadEntries : API_ENDPOINTS.inventory.lostEntries);

export const fetchLostEntries = async (family, side, query) => {
  const ep = EP(family);
  const j = await api.get(side === "approval" ? ep.approvalList : ep.list, { query, fallback: "Failed to load entries" });
  return { rows: j.data || [], total: j.pagination?.total ?? 0, counts: j.meta?.counts || {} };
};
export const fetchLostEntry = async (family, side, id) =>
  (await api.get(side === "approval" ? EP(family).approvalById(id) : EP(family).byId(id), { fallback: "Failed to load the entry" })).data;

export const fetchUnitOptions = async (family, query) => (await api.get(EP(family).unitOptions, { query, fallback: "Failed to load units" })).data || [];
export const fetchBatchSources = async (family, query) => (await api.get(EP(family).batchSources, { query, fallback: "Failed to load stock" })).data || [];

export const createLostEntry = async (family, body) => (await api.post(EP(family).create, body, { fallback: "Failed to send the entry" })).data;
export const updateLostEntry = async (family, id, body) => (await api.put(EP(family).byId(id), body, { fallback: "Failed to send the entry" })).data;
export const approveLostEntry = async (family, id) => (await api.patch(EP(family).approve(id), {}, { fallback: "Failed to approve" })).data;
export const rejectLostEntry = async (family, id, reason) => (await api.patch(EP(family).reject(id), { reason }, { fallback: "Failed to reject" })).data;
