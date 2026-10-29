import { API_BACKEND_URL } from "@/config/getEnvVariables";

const BASE = `${API_BACKEND_URL}/stock/item-requests`;

const json = async (res, fallback) => {
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) throw new Error(body.message || fallback);
  return body;
};

const get = async (url, fallback) => (await json(await fetch(url, { credentials: "include" }), fallback));

const patch = async (url, payload, fallback) =>
  (
    await json(
      await fetch(url, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload || {}),
      }),
      fallback
    )
  ).data;

export const fetchRequests = async (query) => {
  const body = await get(`${BASE}?${new URLSearchParams(query)}`, "Failed to load requests");
  return { rows: body.data || [], total: body.pagination?.total ?? 0 };
};

export const fetchStatusCounts = async (query) =>
  (await get(`${BASE}/status-counts?${new URLSearchParams(query)}`, "Failed to load counts")).data || {};

// Open requests per type — for the Issue / Replace / Return tabs.
export const fetchTypeCounts = async (query) =>
  (await get(`${BASE}/type-counts?${new URLSearchParams(query)}`, "Failed to load counts")).data || {};

export const fetchRequest = async (id) => (await get(`${BASE}/${id}`, "Failed to load the request")).data;

// Free stock of every product in one line's category, at the request's branch.
export const fetchAvailableUnits = async (id, { lineId = "", search = "", productId = "" } = {}) => {
  const params = new URLSearchParams();
  if (lineId) params.set("lineId", lineId);
  if (search) params.set("search", search);
  if (productId) params.set("productId", productId);
  return (await get(`${BASE}/${id}/units?${params}`, "Failed to load available stock")).data;
};

// One handover for any open lines:
// { lines: [{ requestLineId, inventoryItemIds } | { requestLineId, quantities: [{ productDefinitionId, quantity }] }] }
export const issueItems = (id, body) => patch(`${BASE}/${id}/issue`, body, "Failed to issue");
export const closeRequestLine = (id, lineId, reason) => patch(`${BASE}/${id}/lines/${lineId}/close`, { reason }, "Failed to close the item");
// lines: [{ returnLineId, quantity? (batch), condition: "GOOD" | "FAULTY", note? }]
export const receiveItems = (id, lines) => patch(`${BASE}/${id}/receive`, { lines }, "Failed to receive");
// Replace one row: { returnLineId, receive?: { condition, note, quantity? }, give?: { inventoryItemIds } | { quantities } }
export const swapItem = (id, body) => patch(`${BASE}/${id}/swap`, body, "Failed to replace the item");
export const shortCloseRequest = (id, reason) => patch(`${BASE}/${id}/short-close`, { reason }, "Failed to short-close");
export const rejectRequest = (id, reason) => patch(`${BASE}/${id}/reject`, { reason }, "Failed to reject");

export const fetchSubscribers = async (search = "") => {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  return (await get(`${BASE}/subscribers?${params}`, "Failed to load subscribers")).data || [];
};

export const fetchSubscriberItems = async (subscriberId) =>
  (await get(`${BASE}/subscribers/${subscriberId}`, "Failed to load the subscriber's items")).data;
