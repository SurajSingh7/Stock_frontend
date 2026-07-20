import { API_BACKEND_URL } from "@/config/getEnvVariables";

// Full breadcrumb string for a category — every category returned by the
// backend already carries a precomputed `displayPath` (e.g. "A / B / C").
export const pathLabel = (c) => (c && (c.displayPath || c.name)) || "";

// Fetch every LEAF category once (paging through `skip`/`limit` until the
// server-reported `total` is covered) so search can match any level of the
// breadcrumb client-side — the `/categories/flat` `search` param only
// matches the leaf name server-side and can't be changed.
export async function fetchAllLeafCategories({ hasProducts } = {}) {
  const pageSize = 500;
  let skip = 0;
  let all = [];
  while (true) {
    const params = new URLSearchParams({ type: "LEAF", limit: String(pageSize), skip: String(skip) });
    if (hasProducts) params.set("hasProducts", "true");
    const res = await fetch(`${API_BACKEND_URL}/stock/categories/flat?${params.toString()}`, { credentials: "include" });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.message || "Failed to load categories");
    const data = json.data || [];
    all = all.concat(data);
    skip += pageSize;
    if (data.length === 0 || all.length >= (json.total ?? all.length)) break;
  }
  return all;
}
