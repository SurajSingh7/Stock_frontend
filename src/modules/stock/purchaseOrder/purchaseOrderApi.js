import { api, apiUrl } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/constants/api";

const EP = API_ENDPOINTS.purchase.purchaseOrders;

// The PO as a PDF, opened by the browser itself (iframe / new tab).
export const poPdfUrl = (poId) => apiUrl(EP.pdf(poId));

export const fetchPurchaseOrder = async (poId) => (await api.get(EP.byId(poId), { fallback: "Failed to load purchase order" })).data;

export const createPurchaseOrder = (body) => api.post(EP.list, body, { fallback: "Failed to create PO" });

export const updatePurchaseOrder = (poId, body) => api.put(EP.byId(poId), body, { fallback: "Failed to update PO" });

// One review step on the board (approve / reject / …).
export const poAction = (poId, action, body) => api.patch(EP.action(poId, action), body, { fallback: "Failed" });

// query: URLSearchParams or a plain object of the board filters.
export const fetchPoBoard = (query) => api.get(EP.board, { query, fallback: "Failed to load board" });

/** Fires the send-mail action. Resolves to the resulting mode: "SENT" | "MANUAL" | "SKIPPED". */
export const sendPoMail = async (poId, body) =>
  (await api.patch(EP.sendMail(poId), body, { fallback: "Failed to send" })).data;

// The mail the server would send — for the popup to show before sending.
export const fetchPoMailPreview = async (poId) =>
  (await api.get(API_ENDPOINTS.admin.alerts.manualPreview("PO_SEND_TO_VENDOR", poId))).data;

// The vendor's terms (vendor-specific, else the default) and, when there is
// none, the active templates to pick one by hand.
export const resolveVendorTerms = async (vendorId) =>
  (await api.get(API_ENDPOINTS.master.termsConditions.resolve(vendorId))).data;
export const fetchActiveTerms = async () =>
  (await api.get(API_ENDPOINTS.master.termsConditions.list, { query: { status: "ACTIVE", limit: 100 } })).data?.data || [];
