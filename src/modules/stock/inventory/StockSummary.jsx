"use client";

/*
  Product Summary — everything received, and where it all is now.

    Total Received = Available + Issued / Used, for every product and in total.

  ⓘ beside Total Received says where it came from (purchase, opening stock,
  other branches); ⓘ beside Issued / Used says where it went (returned to
  vendor, sent to branches, in use, repair & warranty), each line opening the
  screen that lists those units.

  With All branches, stock moved between our own branches is inside the
  company and counts nowhere — the backend only counts transfers that cross
  the edge of the branches being looked at.
*/

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { api } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/constants/api";
import { fetchLeafCategories, fetchScopedBranches, fetchProductOptions } from "@/modules/stock/shared/lookupsApi";
import Pagination from "@/shared/ui/pagination/Pagination";
import DateRangeButton from "@/modules/stock/shared/DateRangeButton";
import { Modal, SearchableSelect, unitLabel } from "@/modules/stock/shared/StockSharedUI";
import { ProductHistory } from "./ProductInventory";
import {
  RotateCcw, Search, Info, PackageCheck, PackageOpen, Layers, Receipt, Archive, ArrowLeftRight,
  Undo2, Users, Wrench, AlertTriangle, ChevronRight, History,
} from "lucide-react";

const EP = API_ENDPOINTS.inventory.inventoryItems;

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";
const th = "px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600";
const thRight = "px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600";

const qty = (n) => Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });

/* ---------- ⓘ popups ---------- */

const Line = ({ icon: Icon, tone, label, value, unit, onOpen, sub, warn }) => (
  <div className={sub ? "pl-10" : ""}>
    <button
      type="button" onClick={onOpen} disabled={!onOpen}
      className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition ${onOpen ? "hover:bg-slate-50" : "cursor-default"}`}
    >
      {Icon ? (
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${tone}`}><Icon className="h-4 w-4" /></span>
      ) : (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
      )}
      <span className={`flex-1 text-sm ${sub ? "text-slate-600" : "font-semibold text-slate-800"} ${warn ? "text-amber-700!" : ""}`}>{label}</span>
      <span className={`text-sm font-bold tabular-nums ${warn ? "text-amber-700" : "text-slate-900"}`}>
        {qty(value)} <span className="text-xs font-medium text-slate-400">{unit}</span>
      </span>
      <ChevronRight className={`h-4 w-4 ${onOpen ? "text-slate-300 group-hover:text-indigo-500" : "invisible"}`} />
    </button>
  </div>
);

const TotalLine = ({ label, value, unit }) => (
  <div className="mt-2 flex items-center justify-between border-t border-slate-200 px-3 pt-3">
    <span className="text-sm font-bold text-slate-900">{label}</span>
    <span className="text-base font-extrabold tabular-nums text-slate-900">{qty(value)} <span className="text-xs font-medium text-slate-400">{unit}</span></span>
  </div>
);

const ReceivedPopup = ({ row, single, onClose, onHistory }) => {
  const unit = unitLabel(row.unit);
  return (
    <Modal title={`${row.productName} · Received`} onClose={onClose} maxWidth="max-w-md">
      <div className="space-y-0.5">
        <Line icon={Receipt} tone="bg-indigo-50 text-indigo-600 ring-indigo-100" label="Purchase (Invoice)" value={row.purchase} unit={unit} />
        <Line icon={Archive} tone="bg-sky-50 text-sky-600 ring-sky-100" label="Opening Stock" value={row.opening} unit={unit} />
        {single && <Line icon={ArrowLeftRight} tone="bg-violet-50 text-violet-600 ring-violet-100" label="From Branches" value={row.fromBranches} unit={unit} />}
        {row.other > 0 && <Line icon={Layers} tone="bg-slate-50 text-slate-500 ring-slate-200" label="Other (older records)" value={row.other} unit={unit} />}
      </div>
      <TotalLine label="Total Received" value={row.received} unit={unit} />
      <div className="mt-4 flex justify-center">
        <button
          type="button" onClick={onHistory}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-100 transition hover:bg-indigo-100"
        >
          <History className="h-4 w-4" /> View History
        </button>
      </div>
    </Modal>
  );
};

const OutPopup = ({ row, single, onClose, go }) => {
  const unit = unitLabel(row.unit);
  const inUse = row.subscribers + row.employees;
  return (
    <Modal title={`${row.productName} · Issued / Used`} onClose={onClose} maxWidth="max-w-md">
      <div className="space-y-0.5">
        <Line icon={Undo2} tone="bg-rose-50 text-rose-600 ring-rose-100" label="Returned to Vendor" value={row.returned} unit={unit} onOpen={row.returned > 0 ? () => go("/stock/purchase/faulty-items") : null} />
        {single && <Line icon={ArrowLeftRight} tone="bg-violet-50 text-violet-600 ring-violet-100" label="Sent to Branches" value={row.sent} unit={unit} onOpen={row.sent > 0 ? () => go("/stock/inventory/transfers/history") : null} />}
        {row.inTransit > 0 && <Line icon={ArrowLeftRight} tone="bg-indigo-50 text-indigo-600 ring-indigo-100" label="On the Way" value={row.inTransit} unit={unit} onOpen={() => go("/stock/inventory/transfers/requests-to-us")} />}
        <Line icon={Users} tone="bg-sky-50 text-sky-600 ring-sky-100" label="In Use" value={inUse} unit={unit}  />
        <Line sub label="Subscribers" value={row.subscribers} unit={unit} />
        <Line sub label="Employees" value={row.employees} unit={unit} />
        <Line icon={Wrench} tone="bg-amber-50 text-amber-600 ring-amber-100" label="Repair & Warranty" value={row.repair} unit={unit} onOpen={row.repair > 0 ? () => go("/stock/repairs") : null} />
        {row.unrecorded > 0 && (
          <Line icon={AlertTriangle} tone="bg-amber-50 text-amber-600 ring-amber-200" label="Not recorded" value={row.unrecorded} unit={unit} warn />
        )}
      </div>
      <TotalLine label="Total Issued / Used" value={row.outOfStore} unit={unit} />
      {row.unrecorded > 0 && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Received but not found anywhere — stock that left without an entry. Worth checking.
        </p>
      )}
    </Modal>
  );
};

/* ---------- totals, beside the title ---------- */

const Stat = ({ label, value, icon: Icon, className, title }) => (
  <div title={title} className={`flex items-center gap-2 rounded-xl px-3 py-1.5 shadow-sm ${className}`}>
    <Icon className="h-4 w-4 opacity-80" />
    <span className="text-[11px] font-bold uppercase tracking-wide opacity-80">{label}</span>
    <span className="text-base font-extrabold tabular-nums">{qty(value)}</span>
  </div>
);

const Op = ({ children }) => <span className="text-lg font-light text-slate-300">{children}</span>;

/* ============================================================= */

const StockSummary = () => {
  const router = useRouter();
  const [rows, setRows] = useState([]);
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

  const [categories, setCategories] = useState([]);
  const [productOptions, setProductOptions] = useState([]);
  const [branches, setBranches] = useState([]);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [popup, setPopup] = useState(null); // { kind: "received" | "out", row }
  const [historyFor, setHistoryFor] = useState(null);

  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 350); return () => clearTimeout(t); }, [search]);

  useEffect(() => {
    (async () => {
      try { setCategories(await fetchLeafCategories()); } catch {}
      try { setBranches(await fetchScopedBranches("product-summary")); } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try { setProductOptions(await fetchProductOptions(categoryId || undefined)); } catch { setProductOptions([]); }
    })();
  }, [categoryId]);

  const buildQuery = useCallback(() => {
    const q = {};
    if (debouncedSearch.trim()) q.search = debouncedSearch.trim();
    if (categoryId) q.categoryId = categoryId;
    if (productId) q.productDefinitionId = productId;
    if (branchId) q.branchId = branchId;
    if (from) q.from = from;
    if (to) q.to = to;
    return q;
  }, [debouncedSearch, categoryId, productId, branchId, from, to]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const json = await api.get(EP.stockSummary, { query: { ...buildQuery(), page, limit }, fallback: "Failed to fetch stock summary" });
      setRows(json.data?.rows || []);
      setTotals(json.data?.totals || {});
      setTotal(json.data?.total ?? 0);
    } catch (err) {
      toast.error(err.message);
      setRows([]); setTotal(0); setTotals({});
    } finally { setLoading(false); }
  }, [buildQuery, page, limit]);

  useEffect(() => { load(); }, [load]);

  const categoryOptions = useMemo(() => categories.map((c) => ({ value: c._id, label: c.displayPath || c.name })), [categories]);
  const branchOptions = useMemo(() => branches.map((b) => ({ value: String(b._id), label: b.name })), [branches]);
  const branchName = branches.find((b) => String(b._id) === String(branchId))?.name || "";
  const single = !!branchId;

  const hasActiveFilters = !!search || !!categoryId || !!productId || !!branchId || !!from || !!to;
  const clearFilters = () => { setSearch(""); setCategoryId(""); setProductId(""); setBranchId(""); setFrom(""); setTo(""); setPage(1); };

  // "items" opens Available Item on this product (and branch) with a status;
  // anything else is a screen path of its own.
  const go = (row) => (target, status) => {
    if (target !== "items") { router.push(target); return; }
    const q = new URLSearchParams({ productDefinitionId: String(row.productDefinitionId), status });
    if (branchId) q.set("branchId", branchId);
    router.push(`/stock/inventory/items?${q.toString()}`);
  };

  if (historyFor) {
    return <ProductHistory product={historyFor} branchId={branchId} branchName={branchName} onBack={() => setHistoryFor(null)} />;
  }

  const t = totals;

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-900">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100">
            <Layers className="h-5 w-5" />
          </span>
          Product Summary
        </h1>

        {/* Total Received = Available + Issued / Used */}
        <div className="flex flex-wrap items-center gap-2">
          <Stat
            label="Total Received" value={t.received} icon={PackageOpen}
            className="bg-linear-to-br from-indigo-600 to-violet-600 text-white"
            title={`Purchase ${qty(t.purchase)} · Opening ${qty(t.opening)}${single ? ` · From branches ${qty(t.fromBranches)}` : ""}`}
          />
          <Op>=</Op>
          <Stat label="Available" value={t.inStore} icon={PackageCheck} className="border border-emerald-200 bg-emerald-50 text-emerald-800" />
          <Op>+</Op>
          <Stat
            label="Issued / Used" value={t.outOfStore} icon={Users}
            className="border border-slate-200 bg-white text-slate-700"
            title={`In use ${qty((t.subscribers || 0) + (t.employees || 0))} · Repair ${qty(t.repair)} · Returned ${qty(t.returned)}${single ? ` · Sent ${qty(t.sent)}` : ""}`}
          />
        </div>
      </div>

      {/* filters */}
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search product name..." className={`${inputCls} pl-9`}
            />
          </div>
          <div className="w-52"><SearchableSelect value={categoryId} onChange={(v) => { setCategoryId(v); setProductId(""); setPage(1); }} options={categoryOptions} placeholder="All categories" /></div>
          <div className="w-48"><SearchableSelect value={productId} onChange={(v) => { setProductId(v); setPage(1); }} options={productOptions} placeholder="All products" /></div>
          <div className="w-44"><SearchableSelect value={branchId} onChange={(v) => { setBranchId(v); setPage(1); }} options={branchOptions} placeholder="All branches" /></div>
          <DateRangeButton
            from={from} to={to}
            onFrom={(v) => { setFrom(v); setPage(1); }} onTo={(v) => { setTo(v); setPage(1); }}
            hint="Stock received between these dates"
          />
          {hasActiveFilters && (
            <button
              type="button" onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600 shadow-sm transition hover:bg-rose-100"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className={`${th} w-14`}>#</th>
                <th className={th}>Category Path</th>
                <th className={th}>Product</th>
                <th className={thRight}>Total Received</th>
                <th className={thRight}>Available</th>
                <th className={thRight}>Issued / Used</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, r) => (
                  <tr key={r} className="animate-pulse">
                    {Array.from({ length: 6 }).map((__, c) => <td key={c} className="px-4 py-4"><div className="h-3.5 w-3/4 rounded bg-slate-100" /></td>)}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-16 text-center">
                  <Layers className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-sm font-medium text-slate-700">Nothing received yet</p>
                  <p className="mt-1 text-sm text-slate-400">{hasActiveFilters ? "Try changing or resetting the filters." : "Products appear here once stock is received."}</p>
                </td></tr>
              ) : (
                rows.map((r, i) => {
                  const unit = unitLabel(r.unit);
                  return (
                    <tr key={r.productDefinitionId} className="transition hover:bg-slate-50/60">
                      <td className="px-4 py-3.5">
                        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-indigo-50 px-1.5 text-xs font-bold text-indigo-600">
                          {(page - 1) * limit + i + 1}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-600">{r.categoryPath || "—"}</td>
                      <td className="px-4 py-3.5 text-sm font-semibold text-slate-900">{r.productName}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="text-sm font-bold tabular-nums text-indigo-700">{qty(r.received)}</span>
                          <span className="text-xs text-slate-400">{unit}</span>
                          <button
                            type="button" onClick={() => setPopup({ kind: "received", row: r })} title="Where it came from" aria-label="Received details"
                            className="flex h-6 w-6 items-center justify-center rounded-full text-indigo-500 transition hover:bg-indigo-50"
                          >
                            <Info className="h-4 w-4" />
                          </button>
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right">
                        <button
                          type="button" onClick={() => r.inStore > 0 && go(r)("items", "AVAILABLE")} disabled={!r.inStore}
                          title={r.inStore ? "Open these items" : undefined}
                          className={`text-sm font-bold tabular-nums ${r.inStore > 0 ? "text-emerald-700 hover:underline" : "text-rose-600"}`}
                        >
                          {qty(r.inStore)}
                        </button>{" "}
                        <span className="text-xs text-slate-400">{unit}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right">
                        {r.outOfStore > 0 ? (
                          <span className="inline-flex items-center gap-1.5">
                            {r.unrecorded > 0 && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" title="Some stock is not recorded" />}
                            <span className="text-sm font-bold tabular-nums text-slate-700">{qty(r.outOfStore)}</span>
                            <span className="text-xs text-slate-400">{unit}</span>
                            <button
                              type="button" onClick={() => setPopup({ kind: "out", row: r })} title="Where it went" aria-label="Issued / used details"
                              className="flex h-6 w-6 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100"
                            >
                              <Info className="h-4 w-4" />
                            </button>
                          </span>
                        ) : (
                          <span className="pr-8 text-sm text-slate-300">—</span>
                        )}
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

      {popup?.kind === "received" && (
        <ReceivedPopup
          row={popup.row} single={single} onClose={() => setPopup(null)}
          onHistory={() => { setHistoryFor(popup.row); setPopup(null); }}
        />
      )}
      {popup?.kind === "out" && (
        <OutPopup row={popup.row} single={single} onClose={() => setPopup(null)} go={go(popup.row)} />
      )}
    </div>
  );
};

export default StockSummary;
