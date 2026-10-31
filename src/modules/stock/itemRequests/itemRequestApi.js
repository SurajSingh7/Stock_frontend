import { api } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/constants/api";

const EP = API_ENDPOINTS.inventory.itemRequests;

const get = (path, query, fallback) => api.get(path, { query, fallback });
const patch = async (path, payload, fallback) => (await api.patch(path, payload || {}, { fallback })).data;

export const fetchRequests = async (query) => {
  const body = await get(EP.list, query, "Failed to load requests");
  return { rows: body.data || [], total: body.pagination?.total ?? 0 };
};

export const fetchStatusCounts = async (query) => (await get(EP.statusCounts, query, "Failed to load counts")).data || {};

// Open requests per type — for the Issue / Replace / Return tabs.
export const fetchTypeCounts = async (query) => (await get(EP.typeCounts, query, "Failed to load counts")).data || {};

export const fetchRequest = async (id) => (await get(EP.byId(id), undefined, "Failed to load the request")).data;

// Free stock of every product in one line's category, at the request's branch.
export const fetchAvailableUnits = async (id, { lineId = "", search = "", productId = "" } = {}) =>
  (await get(EP.units(id), { lineId, search, productId }, "Failed to load available stock")).data;

// One handover for any open lines:
// { lines: [{ requestLineId, inventoryItemIds } | { requestLineId, quantities: [{ productDefinitionId, quantity }] }] }
export const issueItems = (id, body) => patch(EP.action(id, "issue"), body, "Failed to issue");
export const closeRequestLine = (id, lineId, reason) => patch(EP.closeLine(id, lineId), { reason }, "Failed to close the item");
// lines: [{ returnLineId, quantity? (batch), condition: "GOOD" | "FAULTY", note? }]
export const receiveItems = (id, lines) => patch(EP.action(id, "receive"), { lines }, "Failed to receive");
// Replace one row: { returnLineId, receive?: { condition, note, quantity? }, give?: { inventoryItemIds } | { quantities } }
export const swapItem = (id, body) => patch(EP.action(id, "swap"), body, "Failed to replace the item");
export const shortCloseRequest = (id, reason) => patch(EP.action(id, "short-close"), { reason }, "Failed to short-close");
export const rejectRequest = (id, reason) => patch(EP.action(id, "reject"), { reason }, "Failed to reject");

export const fetchSubscribers = async (search = "") =>
  (await get(EP.subscribers, { search }, "Failed to load subscribers")).data || [];

export const fetchSubscriberItems = async (subscriberId) =>
  (await get(EP.subscriber(subscriberId), undefined, "Failed to load the subscriber's items")).data;
