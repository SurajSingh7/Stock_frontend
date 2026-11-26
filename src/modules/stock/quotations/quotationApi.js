import { api } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/constants/api";

const EP = API_ENDPOINTS.purchase.quotations;

// Tab counts for the list and approval screens.
export const fetchStatusSummary = async () => (await api.get(EP.statusSummary)).data || {};

// query: URLSearchParams or a plain object of the list filters.
export const fetchQuotations = async (query) => {
  const json = await api.get(EP.list, { query, fallback: "Failed to fetch quotations" });
  return { rows: json.data || [], total: json.pagination?.total ?? 0 };
};

export const fetchQuotation = async (id) => (await api.get(EP.byId(id), { fallback: "Failed to load quotation" })).data;

export const createQuotation = (payload) => api.post(EP.list, payload, { fallback: "Failed to save quotation" });

export const reviewQuotation = (id, decisions) => api.patch(EP.review(id), { decisions }, { fallback: "Failed to submit" });

export const fetchVendorsForCategory = async (categoryId) =>
  (await api.get(EP.vendorsForCategory(categoryId), { fallback: "Failed to load vendors" })).data;

// Earlier quotations of these categories still waiting on an order.
export const getPendingOrders = async ({ categoryIds, excludeQuotationId }) =>
  (await api.get(EP.pendingOrders, { query: { categoryIds, excludeQuotationId } })).data || [];
