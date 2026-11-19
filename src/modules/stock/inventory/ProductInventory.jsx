"use client";

/*
  Available Product — every product's stock against its alert threshold.
  Took over the Low Stock page (2026-11-04): pick the Low / Out of stock tab
  for what used to be that list. Low-stock alerts link here with the branch
  already chosen.

  Branch picked → each row is that branch: available, threshold, short by.
  All branches → available is the total and the status is the worst branch's;
  ▸ opens the branch-by-branch numbers (a single total would hide a branch
  that ran out).
*/

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { api } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/constants/api";
import { fetchLeafCategories, fetchScopedBranches, fetchProductOptions } from "@/modules/stock/shared/lookupsApi";
import Pagination from "@/shared/ui/pagination/Pagination";
import {
  History, ArrowLeft, ArrowRight, Boxes, Package, ChevronDown, ChevronRight, PackageCheck, PackageOpen, UserCheck, Users,
  Wrench, PackageMinus, Undo2, ArrowLeftRight, AlertTriangle, Receipt, Archive, Truck, PackageX,
} from "lucide-react";
import { SearchableSelect, unitLabel } from "@/modules/stock/shared/StockSharedUI";
import { SOURCE_LABEL } from "./itemBadges";
import { Tile } from "@/modules/stock/reports/reportUi";
import { SearchBox, ResetButton } from "@/modules/stock/inventoryTransfer/shared";

const EP = API_ENDPOINTS.inventory.inventoryItems;

const th = "px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600";
const thRight = "px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600";

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const qty = (n) => Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });
// "5 pcs · 120 m" — each unit on its own, never added together.
const availableText = (list = []) =>
  list.length ? list.map((t) => `${qty(t.quantity)} ${t.unit === "meter" ? "m" : "pcs"}`).join(" · ") : "0";

const LEVEL_META = {
  OUT: { label: "Out of stock", dot: "bg-rose-500", chip: "bg-rose-50 text-rose-700 ring-rose-200", text: "text-rose-700" },
  LOW: { label: "Low", dot: "bg-amber-500", chip: "bg-amber-50 text-amber-700 ring-amber-200", text: "text-amber-700" },
  OK: { label: "In stock", dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", text: "text-emerald-700" },
  NONE: { label: "No alert set", dot: "bg-slate-300", chip: "bg-slate-50 text-slate-500 ring-slate-200", text: "text-slate-500" },
};

const TABS = [
  { key: "", label: "All", count: "ALL", active: "border-indigo-600 bg-indigo-600 text-white", idle: "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100" },
  { key: "OK", label: "In stock", count: "OK", active: "border-emerald-600 bg-emerald-600 text-white", idle: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" },
  { key: "LOW", label: "Low", count: "LOW", active: "border-amber-500 bg-amber-500 text-white", idle: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" },
  { key: "OUT", label: "Out of stock", count: "OUT", active: "border-rose-600 bg-rose-600 text-white", idle: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100" },
  { key: "NONE", label: "No alert set", count: "NONE", active: "border-slate-600 bg-slate-600 text-white", idle: "border-slate-200 bg-white text-slate-600 hover:bg-slate-50" },
];

const LevelChip = ({ level, extra }) => {
  const m = LEVEL_META[level] || LEVEL_META.NONE;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${m.chip}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
        {m.label}
      </span>
      {extra && <span className="text-[11px] text-slate-500">{extra}</span>}
    </span>
  );
};

const availableCls = (level, available) => {
  if (!(available > 0)) return "text-rose-600";
  if (level === "LOW") return "text-amber-600";
  if (level === "OUT") return "text-rose-600";
  return "text-emerald-700";
};

const sourceLabel = (t) => (t === "INVOICE" ? "Invoice" : SOURCE_LABEL[t] || (t ? t : "Unknown source"));

/* ============================================================= */
/* History — what came in, and where it is now                    */
/* ============================================================= */

// Where the not-available stock is now — same names as Product Summary.
const ISSUED_PARTS = [
  { key: "subscribers", label: "Subscribers", icon: Users, tone: "bg-sky-50 text-sky-700 ring-sky-100" },
  { key: "employees", label: "Employees", icon: UserCheck, tone: "bg-cyan-50 text-cyan-700 ring-cyan-100" },
  { key: "repair", label: "Repair & Warranty", icon: Wrench, tone: "bg-amber-50 text-amber-700 ring-amber-100" },
  { key: "returned", label: "Debited", icon: Undo2, tone: "bg-rose-50 text-rose-700 ring-rose-100" },
  { key: "sent", label: "Sent to Branches", icon: ArrowLeftRight, tone: "bg-violet-50 text-violet-700 ring-violet-100" },
  { key: "inTransit", label: "On the Way", icon: Truck, tone: "bg-indigo-50 text-indigo-700 ring-indigo-100" },
  { key: "unrecorded", label: "Not recorded", icon: AlertTriangle, tone: "bg-amber-50 text-amber-800 ring-amber-200" },
];

export const ProductHistory = ({ product, branchId, branchName, onBack }) => {
  const [data, setData] = useState(null);
  const unit = unitLabel(product.unit);

  useEffect(() => {
    (async () => {
      try {
        const json = await api.get(EP.productStockHistory(product.productDefinitionId), {
          query: branchId ? { branchId } : undefined,
          fallback: "Failed to load history",
        });
        setData(json.data || { summary: {}, receipts: [] });
      } catch (e) {
        toast.error(e.message);
        setData({ summary: {}, receipts: [] });
      }
    })();
  }, [product.productDefinitionId, branchId]);

  const s = data?.summary || {};
  const issuedParts = ISSUED_PARTS.filter((p) => (s[p.key] || 0) > 0);

  return (
    <div className="mx-auto max-w-6xl p-6 pb-12">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button
          type="button" onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="min-w-0">
          <h1 className="text-lg font-bold tracking-tight text-slate-900">{product.productName}</h1>
          <p className="truncate text-sm text-slate-500">
            {product.categoryPath || "—"} · {branchName || "All branches"}
          </p>
        </div>
      </div>

      {!data ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100" />)}</div>
      ) : (
        <>
          {/* Total Received = Available + Not Available */}
          <div className="mb-5 flex flex-col gap-2 lg:flex-row lg:items-stretch">
            <div className="rounded-xl bg-linear-to-br from-indigo-600 to-violet-600 px-3.5 py-2.5 text-white shadow-sm shadow-indigo-200 lg:w-48">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-indigo-100"><PackageOpen className="h-3.5 w-3.5" /> Total Received</p>
              <p className="mt-0.5 text-xl font-extrabold tabular-nums">{qty(s.received)} <span className="text-xs font-medium text-indigo-200">{unit}</span></p>
              <p className="mt-0.5 text-[11px] text-indigo-100">
                Purchase {qty(s.purchase)} · Opening {qty(s.opening)}
                {branchId && s.fromBranches > 0 ? ` · From branches ${qty(s.fromBranches)}` : ""}
                {s.other > 0 ? ` · Other ${qty(s.other)}` : ""}
              </p>
            </div>
            <span className="hidden items-center text-lg font-light text-slate-300 lg:flex">=</span>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-emerald-800 shadow-sm lg:w-36">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider"><PackageCheck className="h-3.5 w-3.5" /> Available</p>
              <p className="mt-0.5 text-xl font-extrabold tabular-nums">{qty(s.inStore)} <span className="text-xs font-medium text-emerald-600">{unit}</span></p>
            </div>
            <span className="hidden items-center text-lg font-light text-slate-300 lg:flex">+</span>
            <div className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm">
              <div className="flex items-baseline justify-between gap-3">
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600"><PackageMinus className="h-3.5 w-3.5" /> Not Available</p>
                <p className="text-xl font-extrabold tabular-nums text-slate-900">{qty(s.outOfStore)} <span className="text-xs font-medium text-slate-400">{unit}</span></p>
              </div>
              {issuedParts.length === 0 ? (
                <p className="mt-2 text-xs text-slate-400">Nothing outside the store yet.</p>
              ) : (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {issuedParts.map((p) => (
                    <span key={p.key} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${p.tone}`}>
                      <p.icon className="h-3.5 w-3.5" /> {p.label} <span className="tabular-nums">{qty(s[p.key])}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Received — invoice-wise</p>
            </div>
            {data.receipts.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-400">Nothing received yet for this product.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.receipts.map((r, i) => {
                  const parts = ISSUED_PARTS.filter((p) => (r.now?.[p.key] || 0) > 0);
                  return (
                    <li key={r.refId || i} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100">
                        {r.sourceType === "OPENING_STOCK" ? <Archive className="h-4 w-4" /> : <Receipt className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0 w-56">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {r.sourceType || r.refNumber ? `${sourceLabel(r.sourceType)} ${r.refNumber || ""}` : "Older stock (no record)"}
                        </p>
                        <p className="text-xs text-slate-500">{fmtDate(r.receivedAt)}</p>
                      </div>
                      <span className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-bold text-indigo-700 ring-1 ring-inset ring-indigo-100 tabular-nums">
                        Received {qty(r.received)} {unit}
                      </span>
                      <ArrowRight className="h-4 w-4 text-slate-300" />
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700 ring-1 ring-inset ring-emerald-100 tabular-nums">
                        Available {qty(r.available)}
                      </span>
                      <span className={`rounded-full px-3 py-1 text-sm font-bold ring-1 ring-inset tabular-nums ${r.issued > 0 ? "bg-slate-100 text-slate-700 ring-slate-200" : "bg-white text-slate-400 ring-slate-100"}`}>
                        Issued {qty(r.issued)}
                      </span>
                      {parts.length > 0 && (
                        <span className="text-xs text-slate-500">
                          ({parts.map((p) => `${p.label} ${qty(r.now[p.key])}`).join(" · ")})
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
};

/* ============================================================= */
/* Main                                                           */
/* ============================================================= */

const ProductInventory = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useState({ mode: "list" });

  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [totals, setTotals] = useState({ available: [] });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [productId, setProductId] = useState("");
  // A low-stock alert opens this page with its branch (and level) already chosen.
  const [branchId, setBranchId] = useState(searchParams.get("branchId") || "");
  const [level, setLevel] = useState(searchParams.get("level") || "");

  const [categories, setCategories] = useState([]);
  const [productOptions, setProductOptions] = useState([]);
  const [branches, setBranches] = useState([]);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [expanded, setExpanded] = useState({});

  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 350); return () => clearTimeout(t); }, [search]);

  useEffect(() => {
    (async () => {
      try { setCategories(await fetchLeafCategories()); } catch {}
      try { setBranches(await fetchScopedBranches("available-products")); } catch {}
    })();
  }, []);

  // Products of the chosen category, or every product when none is chosen.
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
      if (level) query.level = level;
      const json = await api.get(EP.productStock, { query, fallback: "Failed to fetch product inventory" });
      setRows(json.data?.rows || []);
      setCounts(json.data?.counts || {});
      setTotals(json.data?.totals || { available: [] });
      setTotal(json.data?.total ?? 0);
    } catch (err) {
      toast.error(err.message);
      setRows([]); setTotal(0);
    } finally { setLoading(false); }
  }, [page, limit, debouncedSearch, categoryId, productId, branchId, level]);

  useEffect(() => { loadList(); }, [loadList]);

  const categoryOptions = useMemo(() => categories.map((c) => ({ value: c._id, label: c.displayPath || c.name })), [categories]);
  const branchOptions = useMemo(() => branches.map((b) => ({ value: String(b._id), label: b.name })), [branches]);
  const branchName = branches.find((b) => String(b._id) === String(branchId))?.name || "";
  const single = !!branchId;

  const hasActiveFilters = !!search || !!categoryId || !!productId || !!branchId || !!level;
  const clearFilters = () => { setSearch(""); setCategoryId(""); setProductId(""); setBranchId(""); setLevel(""); setPage(1); };

  // Items of this product in Available Item — paged there, however many there are.
  const openItems = (p) => {
    const q = new URLSearchParams({ productDefinitionId: String(p.productDefinitionId) });
    if (branchId) q.set("branchId", branchId);
    router.push(`/stock/inventory/items?${q.toString()}`);
  };

  if (view.mode === "history") {
    return (
      <ProductHistory
        product={view.product} branchId={branchId} branchName={branchName}
        onBack={() => setView({ mode: "list" })}
      />
    );
  }

  const COLS = single ? 8 : 6;

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      {/* Title, and on the right the totals for the current filters (not the tab). */}
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-900">
          <Boxes className="h-5 w-5 text-indigo-600" /> Available Product
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Tile icon={Package} label="Products" value={qty(counts.ALL)} tone="border-slate-200 bg-white text-slate-700" />
          <Tile icon={PackageCheck} label="Available" value={availableText(totals.available)} tone="border-emerald-200 bg-emerald-50 text-emerald-700" />
          <Tile icon={AlertTriangle} label="Low" value={qty(counts.LOW)} tone="border-amber-200 bg-amber-50 text-amber-700" />
          <Tile icon={PackageX} label="Out" value={qty(counts.OUT)} tone="border-rose-200 bg-rose-50 text-rose-700" />
        </div>
      </div>

      {/* One row of filters, then the status tabs. */}
      <div className="mb-2.5 flex flex-wrap items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="w-full sm:w-72"><SearchBox value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search product name…" /></div>
        <div className="w-full sm:w-52">
          <SearchableSelect value={categoryId} onChange={(v) => { setCategoryId(v); setProductId(""); setPage(1); }} options={categoryOptions} placeholder="All categories" />
        </div>
        <div className="w-full sm:w-52">
          <SearchableSelect value={productId} onChange={(v) => { setProductId(v); setPage(1); }} options={productOptions} placeholder="All products" />
        </div>
        <div className="w-full sm:w-52">
          <SearchableSelect value={branchId} onChange={(v) => { setBranchId(v); setPage(1); setExpanded({}); }} options={branchOptions} placeholder="All branches" />
        </div>
        {hasActiveFilters && <ResetButton onClick={clearFilters} />}
      </div>

      {/* status tabs */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {TABS.map((t) => {
          const on = level === t.key;
          return (
            <button
              key={t.key || "all"} type="button" onClick={() => { setLevel(t.key); setPage(1); }}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold shadow-sm transition ${on ? t.active : t.idle}`}
            >
              {t.label}
              <span className={`rounded-full px-1.5 text-xs tabular-nums ${on ? "bg-white/25" : "bg-white/70"}`}>{counts[t.count] ?? 0}</span>
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {!single && <th className="w-10 px-3 py-3" />}
                <th className={th}>Category Path</th>
                <th className={th}>Product</th>
                <th className={thRight}>Available</th>
                {single && <th className={thRight}>Threshold</th>}
                {single && <th className={thRight}>Short by</th>}
                <th className={th}>Status</th>
                {single && <th className={th}>Low since</th>}
                <th className={thRight}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, r) => (
                  <tr key={r} className="animate-pulse">
                    {Array.from({ length: COLS + (single ? 0 : 1) }).map((__, c) => (
                      <td key={c} className="px-4 py-4"><div className="h-3.5 w-3/4 rounded bg-slate-100" /></td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr><td colSpan={COLS + 1} className="px-4 py-16 text-center">
                  <Boxes className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-sm font-medium text-slate-700">
                    {level === "LOW" || level === "OUT" ? "Nothing here — no product is in this state" : "No products found"}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">{hasActiveFilters ? "Try changing or resetting the filters." : "Products appear here once defined."}</p>
                </td></tr>
              ) : (
                rows.map((p) => {
                  const unit = unitLabel(p.unit);
                  const b = single ? p.branches[0] : null;
                  const open = !!expanded[p.productDefinitionId];
                  const m = LEVEL_META[p.level] || LEVEL_META.NONE;
                  return (
                    <React.Fragment key={p.productDefinitionId}>
                      <tr className="transition hover:bg-slate-50/60">
                        {!single && (
                          <td className="px-3 py-3.5">
                            <button
                              type="button" onClick={() => setExpanded((e) => ({ ...e, [p.productDefinitionId]: !e[p.productDefinitionId] }))}
                              title={open ? "Hide branches" : "Show branches"} aria-label="Branches"
                              className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${open ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"}`}
                            >
                              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                          </td>
                        )}
                        <td className="px-4 py-3.5 text-sm text-slate-600">{p.categoryPath || "—"}</td>
                        <td className="px-4 py-3.5 text-sm font-semibold text-slate-900">{p.productName}</td>
                        <td className={`whitespace-nowrap px-4 py-3.5 text-right text-sm font-bold tabular-nums ${availableCls(p.level, p.available)}`}>
                          {qty(p.available)} <span className="text-xs font-medium text-slate-400">{unit}</span>
                        </td>
                        {single && <td className="px-4 py-3.5 text-right text-sm tabular-nums text-slate-700">{b.threshold > 0 ? qty(b.threshold) : "—"}</td>}
                        {single && (
                          <td className={`px-4 py-3.5 text-right text-sm font-semibold tabular-nums ${b.shortBy > 0 ? m.text : "text-slate-300"}`}>
                            {b.shortBy > 0 ? qty(b.shortBy) : "—"}
                          </td>
                        )}
                        <td className="px-4 py-3.5">
                          <LevelChip
                            level={p.level}
                            extra={!single && p.lowBranches > 0 ? `${p.lowBranches} of ${p.alertBranches} branches` : null}
                          />
                        </td>
                        {single && <td className="whitespace-nowrap px-4 py-3.5 text-xs text-slate-500">{b.since ? fmtDate(b.since) : "—"}</td>}
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button" onClick={() => openItems(p)} title="Items in Available Item" aria-label="Items"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100 transition hover:bg-indigo-100"
                            >
                              <Package className="h-4 w-4" />
                            </button>
                            <button
                              type="button" onClick={() => setView({ mode: "history", product: p })} title="History" aria-label="History"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600 ring-1 ring-inset ring-violet-100 transition hover:bg-violet-100"
                            >
                              <History className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* all branches: the numbers branch by branch */}
                      {!single && open && (
                        <tr className="bg-indigo-50/30">
                          <td colSpan={COLS + 1} className="px-6 pb-4 pt-1">
                            <div className="overflow-hidden rounded-xl border border-indigo-100 bg-white">
                              <table className="w-full text-sm">
                                <thead className="bg-indigo-50/60">
                                  <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-indigo-900/70">
                                    <th className="px-3 py-2">Branch</th>
                                    <th className="px-3 py-2 text-right">Available</th>
                                    <th className="px-3 py-2 text-right">Threshold</th>
                                    <th className="px-3 py-2 text-right">Short by</th>
                                    <th className="px-3 py-2">Status</th>
                                    <th className="px-3 py-2">Low since</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {p.branches.map((br) => (
                                    <tr key={br.branchId}>
                                      <td className="px-3 py-2 font-semibold text-slate-800">{br.branchName}</td>
                                      <td className={`px-3 py-2 text-right font-semibold tabular-nums ${availableCls(br.level, br.available)}`}>{qty(br.available)}</td>
                                      <td className="px-3 py-2 text-right tabular-nums text-slate-600">{br.threshold > 0 ? qty(br.threshold) : "—"}</td>
                                      <td className={`px-3 py-2 text-right font-semibold tabular-nums ${br.shortBy > 0 ? (LEVEL_META[br.level] || {}).text : "text-slate-300"}`}>
                                        {br.shortBy > 0 ? qty(br.shortBy) : "—"}
                                      </td>
                                      <td className="px-3 py-2"><LevelChip level={br.level} /></td>
                                      <td className="px-3 py-2 text-xs text-slate-500">{br.since ? fmtDate(br.since) : "—"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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

export default ProductInventory;
