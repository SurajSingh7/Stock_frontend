import { api, saveDownload } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/constants/api";

/*
  Two screens, one kind of entry (see openingKinds.js): Opening Stock talks to
  /opening-stock, Opening Issued Stock to /opening-issued-stock. Each has its
  own module, so each screen calls only its own path.
*/
const BASES = API_ENDPOINTS.inventory.opening;

export const entryApi = (kind = "STORE") => {
  const BASE = BASES[kind] || BASES.STORE;
  return {
    fetchFormOptions: async () =>
      (await api.get(`${BASE}/form-options`, { fallback: "Failed to load branches and vendors" })).data,

    searchProducts: async (search = "") =>
      (await api.get(`${BASE}/products`, { query: { search }, fallback: "Failed to load products" })).data || [],

    fetchProductsByIds: async (ids) => {
      if (!ids.length) return [];
      return (await api.get(`${BASE}/products`, { query: { ids: ids.join(",") }, fallback: "Failed to load products" })).data || [];
    },

    fetchEntries: async (query) => {
      const body = await api.get(BASE, { query, fallback: "Failed to load entries" });
      return { rows: body.data || [], total: body.pagination?.total ?? 0 };
    },

    fetchEntry: async (id) => (await api.get(`${BASE}/${id}`, { fallback: "Failed to load the entry" })).data,

    createEntry: async (payload) => (await api.post(BASE, payload, { fallback: "Failed to save the entry" })).data,
    updateEntry: async (id, payload) => (await api.put(`${BASE}/${id}`, payload, { fallback: "Failed to save the entry" })).data,
    deleteEntry: async (id) => (await api.delete(`${BASE}/${id}`, { fallback: "Failed to delete the entry" })).data,
    postEntry: async (id) => (await api.patch(`${BASE}/${id}/post`, undefined, { fallback: "Failed to post the entry" })).data,
  };
};

// Excel — Opening Stock only.
export const { searchProducts } = entryApi("STORE");

export const downloadTemplate = async (productId) => {
  const res = await api.raw(`${BASES.STORE}/template/${productId}`, { fallback: "Failed to download the template" });
  await saveDownload(res, "opening-stock.xlsx");
};

export const parseUpload = async (productId, file) => {
  const form = new FormData();
  form.append("file", file);
  return (await api.post(`${BASES.STORE}/parse/${productId}`, form, { fallback: "Failed to read the file" })).data;
};
