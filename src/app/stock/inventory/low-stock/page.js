import { redirect } from "next/navigation";

/*
  Low Stock became the Low / Out of stock tabs of Available Product
  (2026-11-04). Alerts sent before that still link here, so this address
  forwards to Available Product with the same branch.
*/
const page = async ({ searchParams }) => {
  const sp = await searchParams;
  const q = new URLSearchParams();
  if (sp?.branchId) q.set("branchId", String(sp.branchId));
  const qs = q.toString();
  redirect(`/stock/inventory/products${qs ? `?${qs}` : ""}`);
};

export default page;
