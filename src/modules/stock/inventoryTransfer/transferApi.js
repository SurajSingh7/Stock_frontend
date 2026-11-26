import { api } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/constants/api";

const REQ = API_ENDPOINTS.inventory.stockRequests;

/*
  Branch pickers for every transfer screen, in the scope of the module the
  screen serves (my-stock-requests | stock-requests-to-us | stock-transfer-history).
  Not /branches/active, so branch staff need no Master > Branch permission.

    branches         every active branch (the other side of a transfer)
    defaultBranchId  the caller's own branch
    myBranchIds      every branch the caller may act for; null = all
*/
export async function fetchTransferBranches(module) {
  const json = await api.get(API_ENDPOINTS.inventory.transferBranches, { query: { module }, fallback: "Failed to load branches" });
  return {
    branches: json.data?.branches || [],
    defaultBranchId: json.data?.defaultBranchId ? String(json.data.defaultBranchId) : "",
    myBranchIds: json.data?.myBranchIds ? json.data.myBranchIds.map(String) : null,
  };
}

/* ── Lists and detail — side: "mine" | "to-us" | "history" ────────────── */

// mine / to-us: otherBranchId = the other side; from / to = requested between.
// history: direction ("sent" | "received"); from / to = closed between.
export async function fetchRequests({ side, status, search, branchId, otherBranchId, direction, from, to, page, limit }) {
  const json = await api.get(REQ.list(side), {
    query: {
      status: status || undefined, search: search?.trim() || undefined, branchId: branchId || undefined, otherBranchId: otherBranchId || undefined,
      direction: direction || undefined, from: from || undefined, to: to || undefined, page, limit,
    },
    fallback: "Failed to load requests",
  });
  return { rows: json.data || [], total: json.pagination?.total ?? 0, counts: json.meta?.counts || {} };
}

// The request with its transfer in full (units, batches, history) as transferId.
export const fetchRequest = async (side, id) => (await api.get(REQ.byId(side, id), { fallback: "Failed to load request" })).data;

/* ── My Requests ──────────────────────────────────────────────────────── */

// [{ _id, path, trackingMethod, unit }] — what a request can ask for.
export const fetchRequestCategories = async () =>
  (await api.get(REQ.categories, { fallback: "Failed to load categories" })).data || [];
export const createRequest = (body) => api.post(REQ.create, body, { fallback: "Failed to send request" });
export const receiveRequest = (id) => api.patch(REQ.receive(id), {}, { fallback: "Failed to receive stock" });
export const reportProblem = (id, note) => api.patch(REQ.reportProblem(id), { note }, { fallback: "Failed to report the problem" });

/* ── Requests to Us ───────────────────────────────────────────────────── */

export const sendAgainstRequest = (id, body) => api.patch(REQ.send(id), body, { fallback: "Failed to send stock" });
export const declineRequest = (id, reason) => api.patch(REQ.decline(id), { reason }, { fallback: "Failed to decline request" });
// lines: [{ lineId, keepItemIds } | { lineId, keepQty }]
export const correctAndResend = (id, body) => api.patch(REQ.correct(id), body, { fallback: "Failed to correct and resend" });

/* ── The Send page ─────────────────────────────────────────────────── */

// { [requestLineId]: [{ _id, name, trackingMethod, unit, available }] }
export const fetchSendOptions = async (id) =>
  (await api.get(REQ.sendOptions(id), { fallback: "Failed to load products" })).data || {};
// { fields: [{ code, label }], units: [{ _id, fieldValues }] } — free units, oldest first.
export const fetchSendUnits = async (id, productDefinitionId) =>
  (await api.get(REQ.sendUnits(id), { query: { productDefinitionId }, fallback: "Failed to load units" })).data || { fields: [], units: [] };
