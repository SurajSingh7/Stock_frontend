import { api } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/constants/api";

const EP = API_ENDPOINTS.purchase.vendors;
const M = API_ENDPOINTS.master;

// query: URLSearchParams or a plain object (page, limit, search, group, parentId, …).
export const fetchVendorList = (query) => api.get(EP.list, { query, fallback: "Failed to fetch vendors" });

// includeInactive: the read-only view may open a soft-deleted vendor; editing never does.
export const fetchVendor = async (id, { includeInactive } = {}) =>
  (await api.get(EP.byId(id), { query: { includeInactive: includeInactive ? "true" : undefined }, fallback: "Failed to load vendor" })).data;

export const fetchVendorGroup = async (id) => (await api.get(EP.group(id), { fallback: "Failed to load the group" })).data;

// id given → update, else create.
export const saveVendor = (id, payload) =>
  id ? api.put(EP.byId(id), payload, { fallback: "Failed to save vendor" }) : api.post(EP.list, payload, { fallback: "Failed to save vendor" });

export const deleteVendor = (id) => api.delete(EP.byId(id), { fallback: "Delete failed" });
export const restoreVendor = (id) => api.patch(EP.restore(id), undefined, { fallback: "Restore failed" });

/* Lookups the vendor screens need */

export const fetchCategory = async (id) => (await api.get(M.categories.byId(id))).data;
export const fetchProductsByCategory = async (categoryId) => (await api.get(M.productDefinitions.byCategory(categoryId))).data || [];
export const fetchActiveBranches = async () => (await api.get(M.branches.active)).data || [];
