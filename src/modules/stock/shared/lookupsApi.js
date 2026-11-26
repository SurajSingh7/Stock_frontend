import { api } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/constants/api";

/*
  Filter dropdown lists many screens share. Each resolves to a plain array;
  a failure throws, and the screens treat that as "leave the dropdown empty".
*/
const { master, purchase } = API_ENDPOINTS;

// Only the branches this user can see on `module`'s screen.
export const fetchScopedBranches = async (module) =>
  (await api.get(master.branches.scoped, { query: { module }, fallback: "Failed to load branches" })).data?.branches || [];

export const fetchVendors = async (limit = 500) =>
  (await api.get(purchase.vendors.list, { query: { limit }, fallback: "Failed to load vendors" })).data || [];

// Leaf categories that have at least one product — the category filters.
export const fetchLeafCategories = async () =>
  (await api.get(master.categories.flat, { query: { type: "LEAF", hasProducts: true, limit: 500 }, fallback: "Failed to load categories" })).data || [];

export const fetchProductDefinitions = async ({ categoryId, limit = 1000 } = {}) =>
  (await api.get(master.productDefinitions.list, { query: { categoryId, limit }, fallback: "Failed to load products" })).data || [];

// Same, as { value, label } options for a product filter.
export const fetchProductOptions = async (categoryId) =>
  (await fetchProductDefinitions({ categoryId })).map((p) => ({ value: p._id, label: p.name }));
