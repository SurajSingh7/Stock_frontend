import { API_BACKEND_URL } from "@/config/getEnvVariables";

const BASE = `${API_BACKEND_URL}/stock/opening-stock`;

const json = async (res, fallback) => {
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) throw new Error(body.message || fallback);
  return body;
};

export const fetchFormOptions = async () =>
  (await json(await fetch(`${BASE}/form-options`, { credentials: "include" }), "Failed to load branches and vendors")).data;

export const searchProducts = async (search = "") => {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  return (await json(await fetch(`${BASE}/products?${params}`, { credentials: "include" }), "Failed to load products")).data || [];
};

export const fetchProductsByIds = async (ids) => {
  if (!ids.length) return [];
  const params = new URLSearchParams({ ids: ids.join(",") });
  return (await json(await fetch(`${BASE}/products?${params}`, { credentials: "include" }), "Failed to load products")).data || [];
};

export const fetchEntries = async (query) => {
  const body = await json(await fetch(`${BASE}?${new URLSearchParams(query)}`, { credentials: "include" }), "Failed to load entries");
  return { rows: body.data || [], total: body.pagination?.total ?? 0 };
};

export const fetchEntry = async (id) =>
  (await json(await fetch(`${BASE}/${id}`, { credentials: "include" }), "Failed to load the entry")).data;

const send = async (url, method, payload, fallback) =>
  (
    await json(
      await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: payload ? JSON.stringify(payload) : undefined,
      }),
      fallback
    )
  ).data;

export const createEntry = (payload) => send(BASE, "POST", payload, "Failed to save the entry");
export const updateEntry = (id, payload) => send(`${BASE}/${id}`, "PUT", payload, "Failed to save the entry");
export const deleteEntry = (id) => send(`${BASE}/${id}`, "DELETE", null, "Failed to delete the entry");
export const postEntry = (id) => send(`${BASE}/${id}/post`, "PATCH", null, "Failed to post the entry");

export const downloadTemplate = async (productId) => {
  const res = await fetch(`${BASE}/template/${productId}`, { credentials: "include" });
  if (!res.ok) await json(res, "Failed to download the template");
  const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") || "")?.[1] || "opening-stock.xlsx";
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export const parseUpload = async (productId, file) => {
  const form = new FormData();
  form.append("file", file);
  return (
    await json(await fetch(`${BASE}/parse/${productId}`, { method: "POST", credentials: "include", body: form }), "Failed to read the file")
  ).data;
};
