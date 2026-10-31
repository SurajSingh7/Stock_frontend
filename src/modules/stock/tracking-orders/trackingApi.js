import { api, apiUrl } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/constants/api";

const T = API_ENDPOINTS.purchase.trackingOrders;
const INV = API_ENDPOINTS.purchase.invoices;

/* ---------------------------- tracking orders ---------------------------- */

// query: URLSearchParams or a plain object of the board filters.
export const fetchTrackingBoard = (query) => api.get(T.board, { query, fallback: "Failed to load tracking orders" });

export const fetchTrackingDetail = async (trackingOrderId) =>
  (await api.get(T.byId(trackingOrderId), { fallback: "Failed to load tracking order" })).data;

export const assignTrackingEntity = (trackingOrderId, entity) =>
  api.patch(T.entity(trackingOrderId), entity, { fallback: "Failed to assign entity" });

// short-close | reopen | not-required … — one PATCH per step.
export const trackingAction = (trackingOrderId, action, body) =>
  api.patch(T.action(trackingOrderId, action), body, { fallback: "Failed" });

export const resetTrackingOrder = (trackingOrderId, reason) =>
  api.patch(T.reset(trackingOrderId), { reason }, { fallback: "Failed to reset order" });

/* -------------------------------- invoices ------------------------------- */

// Every invoice of one order — the PO's received figures and "Previous invoices".
export const fetchInvoicesForTracking = async (trackingOrderId) =>
  (await api.get(INV.board, { query: { trackingOrderId, limit: 200 }, fallback: "Failed to load invoices" })).data?.rows || [];

// entryId: one entry of a partial-submit invoice.
export const fetchInvoice = async (id, entryId) =>
  (await api.get(INV.byId(id), { query: { entryId }, fallback: "Failed to load invoice" })).data;

// Add Invoice / Edit invoice — FormData with `data` (JSON) and the file.
export const saveInvoice = ({ trackingOrderId, invoiceId }, formData) =>
  invoiceId
    ? api.put(INV.byId(invoiceId), formData, { fallback: "Failed to save invoice" })
    : api.post(T.invoices(trackingOrderId), formData, { fallback: "Failed to save invoice" });

export const deleteInvoice = (id) => api.delete(INV.byId(id), { fallback: "Failed to delete invoice" });

export const setInvoicePartial = (id, on) => api.patch(INV.partial(id), { on }, { fallback: "Failed to change partial submit" });

export const saveInvoiceItems = (id, body) => api.put(INV.items(id), body, { fallback: "Failed to save" });

// Approve / reject the whole invoice, or one entry of a partial submit.
export const decideInvoice = (id, entryId, action, body) =>
  api.patch(entryId ? INV.decideEntry(id, entryId, action) : INV.decide(id, action), body, {
    fallback: action === "approve" ? "Failed to approve" : "Failed to reject",
  });

// The AI read of an uploaded invoice — sent with XHR for upload progress.
export const invoiceReadUrl = (trackingOrderId) => apiUrl(T.readInvoice(trackingOrderId));

export const fetchProductDefinition = async (id) =>
  (await api.get(API_ENDPOINTS.master.productDefinitions.byId(id), { fallback: "Failed to load product" })).data;
