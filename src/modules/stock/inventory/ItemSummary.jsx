"use client";

/*
  Item Summary — every unit we hold, wherever it is: in the store, with a
  subscriber or an employee, out for repair, on the way to another branch,
  debited back to the vendor, or scrapped. Product Summary tells the same
  story as numbers per product; this page names each unit and who has it.

  Read-only: 👁 opens the unit's page with its history. Cards = totals for the
  current filters (pieces and metres kept apart); chips = rows per status.
*/

import React, { useState, useEffect, useCallback, useMemo } from "react";
import toast from "react-hot-toast";
import { api } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/constants/api";
import { fetchLeafCategories, fetchScopedBranches, fetchProductOptions, fetchVendors } from "@/modules/stock/shared/lookupsApi";
import Pagination from "@/shared/ui/pagination/Pagination";
import DateRangeButton from "@/modules/stock/shared/DateRangeButton";
import {
  ClipboardList, Package, PackageCheck, Users, Wrench, Undo2, SlidersHorizontal, Eye, MapPin,
} from "lucide-react";
import { SearchableSelect, unitLabel } from "@/modules/stock/shared/StockSharedUI";
import { Tile } from "@/modules/stock/reports/reportUi";
import { SearchBox, ResetButton } from "@/modules/stock/inventoryTransfer/shared";
import { SOURCE_LABEL, fmtDate } from "./itemBadges";
import { ItemDetailsView, InfoRow, Section, valueOf } from "./ItemInventory";

const EP = API_ENDPOINTS.inventory.inventoryItems;
const th = "px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 whitespace-nowrap";

const qtyNum = (n) => Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });
// "12 pcs · 95 m" — each unit on its own, never added together.
const unitTotals = (list = []) =>
  list.length ? list.map((t) => `${qtyNum(t.quantity)} ${t.unit === "meter" ? "m" : "pcs"}`).join(" · ") : "0";

const CHIPS = [
  { key: "", count: "ALL", label: "All", active: "border-indigo-600 bg-indigo-600 text-white", idle: "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100" },
  { key: "AVAILABLE", label: "Available", active: "border-emerald-600 bg-emerald-600 text-white", idle: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" },
  { key: "SUBSCRIBERS", label: "Subscribers", active: "border-sky-600 bg-sky-600 text-white", idle: "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100" },
  { key: "EMPLOYEES", label: "Employees", active: "border-cyan-600 bg-cyan-600 text-white", idle: "border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100" },
  { key: "REPAIR", label: "Repair & Warranty", active: "border-amber-500 bg-amber-500 text-white", idle: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" },
  { key: "ON_THE_WAY", label: "On the Way", active: "border-violet-600 bg-violet-600 text-white", idle: "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100" },
  { key: "DEBITED", label: "Debited", active: "border-rose-600 bg-rose-600 text-white", idle: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100" },
  { key: "SCRAPPED", label: "Scrapped", active: "border-slate-600 bg-slate-600 text-white", idle: "border-slate-200 bg-white text-slate-600 hover:bg-slate-50" },
];

// The row's status, with the repair step spelled out.
const STATUS_META = {
  AVAILABLE: { label: "Available", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  SUBSCRIBERS: { label: "Subscriber", cls: "bg-sky-50 text-sky-700 ring-sky-200", dot: "bg-sky-500" },
  EMPLOYEES: { label: "Employee", cls: "bg-cyan-50 text-cyan-700 ring-cyan-200", dot: "bg-cyan-500" },
  FAULTY: { label: "Faulty", cls: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500" },
  IN_REPAIR: { label: "In Repair", cls: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500" },
  AT_VENDOR: { label: "At Vendor", cls: "bg-orange-50 text-orange-700 ring-orange-200", dot: "bg-orange-500" },
  ON_THE_WAY: { label: "On the Way", cls: "bg-violet-50 text-violet-700 ring-violet-200", dot: "bg-violet-500" },
  DEBITED: { label: "Debited", cls: "bg-rose-50 text-rose-700 ring-rose-200", dot: "bg-rose-500" },
  SCRAPPED: { label: "Scrapped", cls: "bg-slate-100 text-slate-600 ring-slate-200", dot: "bg-slate-400" },
};
const metaOf = (r) => STATUS_META[r.bucket === "REPAIR" ? r.status : r.bucket] || STATUS_META.SCRAPPED;

const StatusBadge = ({ row }) => {
  const m = metaOf(row);
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${m.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} /> {m.label}
    </span>
  );
};

// Who has it / where it is: a main line and a smaller second line.
const whereOf = (r) => {
  const a = r.assignedTo || {};
  switch (r.status) {
    case "AVAILABLE":
      return { main: "In store" };
    case "ASSIGNED":
      if (a.kind === "EMPLOYEE") return { main: a.employeeName || "Employee", sub: a.employeeCode || a.note };
      return { main: a.username || a.orderId || "Subscriber", sub: [a.username && a.orderId, a.requestNumber].filter(Boolean).join(" · ") };
    case "FAULTY":
      return { main: r.fault?.note || "Waiting for repair", sub: r.fault?.requestNumber ? `From ${r.fault.requestNumber}` : "Not sent yet" };
    case "IN_REPAIR":
      return { main: "Our repair", sub: r.repair?.note };
    case "AT_VENDOR":
      return { main: r.repair?.vendorName || "Vendor", sub: [r.repair?.claimRef && `Claim ${r.repair.claimRef}`, r.repair?.note].filter(Boolean).join(" · ") };
    case "IN_TRANSIT":
      return { main: `To ${r.transit?.toBranchId?.name || "branch"}`, sub: r.transit?.transferNumber };
    case "DEBITED":
      return { main: r.dnNumbers?.length ? r.dnNumbers.join(", ") : "Debit note", sub: "Money taken back from the vendor" };
    default:
      return { main: r.scrapNote || "Scrapped" };
  }
};

const qtyText = (r) => `${qtyNum(r.quantity)} ${r.productDefinitionId?.unit === "meter" ? "m" : unitLabel(r.productDefinitionId?.unit) || "pcs"}`;

const ItemSummary = () => {
  const [rows, setRows] = useState([]);
  const [listFields, setListFields] = useState([]);
  const [counts, setCounts] = useState({});
  const [totals, setTotals] = useState({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [productId, setProductId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [bucket, setBucket] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);

  const [categories, setCategories] = useState([]);
  const [productOptions, setProductOptions] = useState([]);
  const [branches, setBranches] = useState([]);
  const [vendors, setVendors] = useState([]);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [viewing, setViewing] = useState(null);

  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 350); return () => clearTimeout(t); }, [search]);

  useEffect(() => {
    (async () => {
      try { setCategories(await fetchLeafCategories()); } catch {}
      try { setBranches(await fetchScopedBranches("item-summary")); } catch {}
      try { setVendors(await fetchVendors()); } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try { setProductOptions(await fetchProductOptions(categoryId || undefined)); } catch { setProductOptions([]); }
    })();
  }, [categoryId]);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const query = { page, limit };
      if (debouncedSearch.trim()) query.search = debouncedSearch.trim();
      if (categoryId) query.categoryId = categoryId;
      if (productId) query.productDefinitionId = productId;
      if (branchId) query.branchId = branchId;
      if (from) query.from = from;
      if (to) query.to = to;
      if (sourceType) query.sourceType = sourceType;
      if (vendorId) query.vendorId = vendorId;
      if (bucket) query.bucket = bucket;
      const json = await api.get(EP.itemSummary, { query, fallback: "Failed to fetch item summary" });
      setRows(json.data || []);
      setTotal(json.pagination?.total ?? 0);
      setCounts(json.meta?.counts || {});
      setTotals(json.meta?.totals || {});
      setListFields(json.meta?.listFields || []);
    } catch (err) {
      toast.error(err.message);
      setRows([]); setTotal(0);
    } finally { setLoading(false); }
  }, [page, limit, debouncedSearch, categoryId, productId, branchId, from, to, sourceType, vendorId, bucket]);

  useEffect(() => { loadList(); }, [loadList]);

  const categoryOptions = useMemo(() => categories.map((c) => ({ value: c._id, label: c.displayPath || c.name })), [categories]);
  const branchOptions = useMemo(() => branches.map((b) => ({ value: String(b._id), label: b.name })), [branches]);
  const vendorOptions = useMemo(() => vendors.map((v) => ({ value: v._id, label: v.name })), [vendors]);

  const moreCount = [sourceType, vendorId].filter(Boolean).length;
  const hasActiveFilters = !!search || !!categoryId || !!productId || !!branchId || !!from || !!to || moreCount > 0;
  const clearFilters = () => {
    setSearch(""); setCategoryId(""); setProductId(""); setBranchId(""); setFrom(""); setTo("");
    setSourceType(""); setVendorId(""); setPage(1);
  };
  const setAndReset = (fn) => (v) => { fn(v); setPage(1); };

  if (viewing) {
    const w = whereOf(viewing);
    return (
      <ItemDetailsView
        card={viewing} onBack={() => setViewing(null)}
        timelineUrl={EP.itemSummaryTimeline} showBatches={false} qtyLabel="Quantity"
        badge={<span className="text-sm"><StatusBadge row={viewing} /></span>}
      >
        <div className="mb-5">
          <Section title="Where it is" icon={MapPin}>
            <div className="divide-y divide-slate-100">
              <InfoRow label="Status"><StatusBadge row={viewing} /></InfoRow>
              <InfoRow label="With / Where">{w.main}</InfoRow>
              {w.sub && <InfoRow label="Details">{w.sub}</InfoRow>}
              {viewing.assignedTo?.phone && <InfoRow label="Phone">{viewing.assignedTo.phone}</InfoRow>}
              <InfoRow label="Since">{fmtDate(viewing.since)}</InfoRow>
            </div>
          </Section>
        </div>
      </ItemDetailsView>
    );
  }

  const colCount = 9 + listFields.length;

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      {/* Title, and on the right the totals for the current filters (not the chip). */}
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-900">
          <ClipboardList className="h-5 w-5 text-indigo-600" /> Item Summary
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Tile icon={Package} label="Total" value={unitTotals(totals.total)} tone="border-slate-200 bg-white text-slate-700" />
          <Tile icon={PackageCheck} label="Available" value={unitTotals(totals.available)} tone="border-emerald-200 bg-emerald-50 text-emerald-700" />
          <Tile icon={Users} label="In Use" value={unitTotals(totals.inUse)} tone="border-sky-200 bg-sky-50 text-sky-700" />
          <Tile icon={Wrench} label="Repair" value={unitTotals(totals.repair)} tone="border-amber-200 bg-amber-50 text-amber-700" />
          <Tile icon={Undo2} label="Debited" value={unitTotals(totals.debited)} tone="border-rose-200 bg-rose-50 text-rose-700" />
        </div>
      </div>

      {/* One row of filters; the less-used ones sit behind the sliders button. */}
      <div className="mb-2.5 flex flex-wrap items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="w-full sm:w-72"><SearchBox value={search} onChange={setAndReset(setSearch)} placeholder="Serial, MAC, product, subscriber…" /></div>
        <div className="w-full sm:w-52">
          <SearchableSelect value={categoryId} onChange={(v) => { setCategoryId(v); setProductId(""); setPage(1); }} options={categoryOptions} placeholder="All categories" />
        </div>
        <div className="w-full sm:w-52"><SearchableSelect value={productId} onChange={setAndReset(setProductId)} options={productOptions} placeholder="All products" /></div>
        <div className="w-full sm:w-52"><SearchableSelect value={branchId} onChange={setAndReset(setBranchId)} options={branchOptions} placeholder="All branches" /></div>
        <DateRangeButton from={from} to={to} onFrom={setAndReset(setFrom)} onTo={setAndReset(setTo)} hint="Received between these dates" />

        <div className="relative">
          <button
            type="button" onClick={() => setMoreOpen((v) => !v)} title="More filters"
            className={`inline-flex h-9.5 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold shadow-sm transition ${
              moreCount ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {moreCount > 0 && <span className="rounded-full bg-indigo-600 px-1.5 text-[11px] font-bold text-white">{moreCount}</span>}
          </button>
          {moreOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMoreOpen(false)} />
              <div className="absolute right-0 z-40 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">More filters</p>
                <div className="space-y-3">
                  <div>
                    <p className="mb-1 text-xs font-semibold text-slate-600">Came in via</p>
                    <SearchableSelect value={sourceType} onChange={setAndReset(setSourceType)} options={Object.entries(SOURCE_LABEL).map(([value, label]) => ({ value, label }))} placeholder="Any origin" />
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold text-slate-600">Vendor</p>
                    <SearchableSelect value={vendorId} onChange={setAndReset(setVendorId)} options={vendorOptions} placeholder="Any vendor" />
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                  <button
                    type="button" disabled={!moreCount}
                    onClick={() => { setSourceType(""); setVendorId(""); setPage(1); }}
                    className="text-sm font-semibold text-rose-600 transition hover:text-rose-700 disabled:cursor-default disabled:text-slate-300"
                  >
                    Clear
                  </button>
                  <button
                    type="button" onClick={() => setMoreOpen(false)}
                    className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
                  >
                    Done
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
        {hasActiveFilters && <ResetButton onClick={clearFilters} />}
      </div>

      {/* status chips */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {CHIPS.map((c) => {
          const on = bucket === c.key;
          return (
            <button
              key={c.key || "all"} type="button" onClick={() => { setBucket(c.key); setPage(1); }}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold shadow-sm transition ${on ? c.active : c.idle}`}
            >
              {c.label}
              <span className={`rounded-full px-1.5 text-xs tabular-nums ${on ? "bg-white/25" : "bg-white/70"}`}>{counts[c.count || c.key] ?? 0}</span>
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className={`${th} w-12`}>#</th>
                <th className={th}>Category Path</th>
                <th className={th}>Product</th>
                {listFields.map((f) => <th key={f.code} className={th}>{f.label}</th>)}
                <th className={th}>Branch</th>
                <th className={`${th} text-right`}>Qty</th>
                <th className={th}>Status</th>
                <th className={th}>With / Where</th>
                <th className={th}>Since</th>
                <th className={`${th} text-right`}>Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, r) => (
                  <tr key={r} className="animate-pulse">
                    {Array.from({ length: colCount }).map((__, c) => (
                      <td key={c} className="px-4 py-4"><div className="h-3.5 w-3/4 rounded bg-slate-100" /></td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr><td colSpan={colCount} className="px-4 py-16 text-center">
                  <ClipboardList className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-sm font-medium text-slate-700">No items found</p>
                  <p className="mt-1 text-sm text-slate-400">{hasActiveFilters || bucket ? "Try changing or resetting the filters." : "Items appear here once stock comes in."}</p>
                </td></tr>
              ) : (
                rows.map((r, i) => {
                  const w = whereOf(r);
                  return (
                    <tr key={r._id} className="transition hover:bg-slate-50/60">
                      <td className="px-4 py-3.5">
                        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-indigo-50 px-1.5 text-xs font-bold text-indigo-600">{(page - 1) * limit + i + 1}</span>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-600">{r.productDefinitionId?.categoryPath || "—"}</td>
                      <td className="px-4 py-3.5 text-sm font-semibold text-slate-900">{r.productDefinitionId?.name}</td>
                      {listFields.map((f) => (
                        <td key={f.code} className="px-4 py-3.5 text-sm text-slate-700">{valueOf(r, f.code) || <span className="text-slate-300">—</span>}</td>
                      ))}
                      <td className="px-4 py-3.5 text-sm text-slate-700">{r.branchId?.name || "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right text-sm font-bold tabular-nums text-indigo-700">{qtyText(r)}</td>
                      <td className="px-4 py-3.5"><StatusBadge row={r} /></td>
                      <td className="max-w-64 px-4 py-3.5">
                        <p className="truncate text-sm font-medium text-slate-800" title={w.main}>{w.main}</p>
                        {w.sub && <p className="truncate text-xs text-slate-500" title={w.sub}>{w.sub}</p>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-sm text-slate-600">{fmtDate(r.since)}</td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button" onClick={() => setViewing(r)} title="View" aria-label="View"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100 transition hover:bg-indigo-100"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {total > 10 && (
          <div className="border-t border-slate-100 px-4 py-3">
            <Pagination currentPage={page} totalItems={total} itemsPerPage={limit} onPageChange={setPage} onItemsPerPageChange={(n) => { setLimit(n); setPage(1); }} />
          </div>
        )}
      </div>
    </div>
  );
};

export default ItemSummary;
