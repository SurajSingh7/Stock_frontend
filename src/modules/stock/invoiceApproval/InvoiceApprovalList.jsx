"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import toast from "react-hot-toast";
import { api } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/constants/api";
import { fetchLeafCategories, fetchVendors, fetchProductOptions, fetchScopedBranches } from "@/modules/stock/shared/lookupsApi";
import Pagination from "@/shared/ui/pagination/Pagination";
import { RotateCcw, Eye, Edit3, ClipboardCheck, Search, Info, Package, Check } from "lucide-react";
import { SearchableSelect, inputCls, money, unitLabel, Modal } from "@/modules/stock/shared/StockSharedUI";
import DateRangeButton from "@/modules/stock/shared/DateRangeButton";
import useInternalEntities from "@/modules/stock/shared/useInternalEntities";
import InvoiceReceiveView from "@/modules/stock/tracking-orders/InvoiceReceiveView";
import InvoiceReviewView from "./InvoiceReviewView";

const STATUS = { PENDING: "PENDING", APPROVED: "APPROVED", REJECTED: "REJECTED" };

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const STATUS_META = {
  PENDING: { label: "Pending", dot: "bg-amber-500" },
  APPROVED: { label: "Approved", dot: "bg-emerald-500" },
  REJECTED: { label: "Rejected", dot: "bg-rose-500" },
};

const TAB_STYLES = {
  PENDING: {
    active: "border-amber-600 bg-amber-600 text-white",
    inactive: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100",
    chipActive: "bg-amber-500 text-amber-50",
    chipInactive: "bg-amber-100 text-amber-700",
  },
  APPROVED: {
    active: "border-emerald-600 bg-emerald-600 text-white",
    inactive: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    chipActive: "bg-emerald-500 text-emerald-50",
    chipInactive: "bg-emerald-100 text-emerald-700",
  },
  REJECTED: {
    active: "border-rose-600 bg-rose-600 text-white",
    inactive: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
    chipActive: "bg-rose-500 text-rose-50",
    chipInactive: "bg-rose-100 text-rose-700",
  },
};

const th = "px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600";
const thRight = "px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600";
const COLUMNS = 9;

// Dot + plain-text status — same look as the Tracking Order card's invoice table.
const ApprovalDot = ({ status }) => {
  const m = STATUS_META[status] || {};
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700">
      <span className={`h-2 w-2 rounded-full ${m.dot || "bg-slate-400"}`} />
      {m.label || status}
    </span>
  );
};

/* How much of a partial invoice is approved, as a ring with the % inside. */
const ProgressRing = ({ pct = 0, size = 26, stroke = 2.5 }) => {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} title={`${p}% approved`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-violet-100" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - p / 100)}
          className="stroke-violet-500 transition-all duration-500"
        />
      </svg>
      <span className="absolute text-[7.5px] font-bold tabular-nums text-violet-700">{p}%</span>
    </span>
  );
};

/*
  The Qty column's mark, same size on every row: a green tick once all of it
  is approved, a violet ring with the % while part of it is, an empty grey
  ring while none of it is.
*/
const ApprovedMark = ({ pct }) => {
  const p = Math.round(Math.max(0, Math.min(100, Number(pct) || 0)));
  if (p >= 100) {
    return (
      // Same ring as the violet one, full and green — one shape, the colour says done.
      <span className="relative flex h-[26px] w-[26px] shrink-0 items-center justify-center" title="Fully approved">
        <svg width="26" height="26" className="absolute inset-0">
          <circle cx="13" cy="13" r="11.75" fill="none" strokeWidth="2.5" className="stroke-emerald-500" />
        </svg>
        <Check className="h-3 w-3 text-emerald-600" strokeWidth={3.5} />
      </span>
    );
  }
  if (p <= 0) {
    return (
      <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center" title="Nothing approved yet">
        <span className="h-5 w-5 rounded-full border-2 border-slate-200" />
      </span>
    );
  }
  return <ProgressRing pct={p} />;
};

/* Items: just the count; the products behind it open in a popup. */
const ItemsCell = ({ inv }) => {
  const [open, setOpen] = useState(false);
  const list = inv.lines || [];
  if (!list.length) return <span className="text-sm text-slate-300">—</span>;
  return (
    <>
      <button
        type="button" onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-100 transition hover:bg-indigo-100"
      >
        <Package className="h-3.5 w-3.5" /> {list.length} item{list.length === 1 ? "" : "s"}
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)} title={`Items · ${inv.invoiceNumber}`} maxWidth="max-w-lg">
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2 text-right">Invoice qty</th>
                  <th className="px-3 py-2 text-right">Entered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((l, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2">
                      <p className="font-semibold text-slate-900">{l.productName}</p>
                      {l.categoryPath || l.categoryName ? <p className="text-xs text-slate-500">{l.categoryPath || l.categoryName}</p> : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-700">
                      {l.invoiceQuantity ?? "—"} <span className="text-xs text-slate-400">{unitLabel(l.unit)}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-slate-900">{l.receivedQuantity || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </>
  );
};

/* GST: one amount; CGST / SGST / IGST open in a popup. */
const GstCell = ({ inv }) => {
  const [open, setOpen] = useState(false);
  const cgst = Number(inv.cgstAmount || 0);
  const sgst = Number(inv.sgstAmount || 0);
  const igst = Number(inv.igstAmount || 0);
  const total = cgst + sgst + igst;
  const row = "flex justify-between py-2.5 text-sm";
  return (
    <span className="inline-flex items-center justify-end gap-1">
      {money(total)}
      <button
        type="button" onClick={() => setOpen(true)} title="GST breakup" aria-label="GST breakup"
        className="rounded-full p-0.5 text-slate-300 transition hover:bg-indigo-50 hover:text-indigo-600"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)} title={`GST · ${inv.invoiceNumber}`} maxWidth="max-w-sm">
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 px-4 tabular-nums">
            <div className={row}><span className="text-slate-500">Basic price</span><span className="font-semibold text-slate-900">{money(inv.basicAmount)}</span></div>
            {igst > 0 ? (
              <div className={row}><span className="text-slate-500">IGST</span><span className="font-semibold text-slate-900">{money(igst)}</span></div>
            ) : (
              <>
                <div className={row}><span className="text-slate-500">CGST</span><span className="font-semibold text-slate-900">{money(cgst)}</span></div>
                <div className={row}><span className="text-slate-500">SGST</span><span className="font-semibold text-slate-900">{money(sgst)}</span></div>
              </>
            )}
            <div className={row}><span className="font-semibold text-slate-700">Total GST</span><span className="font-bold text-indigo-700">{money(total)}</span></div>
          </div>
          <p className="mt-3 rounded-lg bg-indigo-50 px-3 py-2 text-center text-xs font-medium text-indigo-800">
            {igst > 0 ? "Different state — IGST" : "Same state — CGST + SGST"}
          </p>
        </Modal>
      )}
    </span>
  );
};

/* ============================================================= */
/* Main                                                           */
/* ============================================================= */

const InvoiceApprovalList = () => {
  const [view, setView] = useState({ mode: "list" });

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState(STATUS.PENDING);
  const [categoryId, setCategoryId] = useState("");
  const [productId, setProductId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [entityAlias, setEntityAlias] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [categories, setCategories] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [productOptions, setProductOptions] = useState([]);
  const [branchOptions, setBranchOptions] = useState([]);
  const { aliases } = useInternalEntities();

  const [counts, setCounts] = useState({ ALL: 0, PENDING: 0, APPROVED: 0, REJECTED: 0 });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);

  const [expanded, setExpanded] = useState({}); // invoiceId -> entries open

  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 350); return () => clearTimeout(t); }, [search]);

  useEffect(() => {
    (async () => {
      try { setCategories(await fetchLeafCategories()); } catch {}
      try { setVendors(await fetchVendors(1000)); } catch {}
      // The branch that received the invoice.
      try {
        setBranchOptions((await fetchScopedBranches("invoices")).map((b) => ({ value: String(b._id), label: b.name })));
      } catch {}
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
      // view=approval: whole invoices, plus each submitted entry of a
      // partial-submit invoice as its own row.
      const params = new URLSearchParams({ page: String(page), limit: String(limit), view: "approval" });
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (status) params.set("status", status);
      if (categoryId) params.set("categoryId", categoryId);
      if (productId) params.set("productId", productId);
      if (vendorId) params.set("vendorId", vendorId);
      if (branchId) params.set("branchId", branchId);
      if (entityAlias) params.set("entityAlias", entityAlias);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const json = await api.get(API_ENDPOINTS.purchase.invoices.board, { query: params, fallback: "Failed to fetch invoices" });
      setRows(json.data?.rows || []);
      setCounts(json.data?.counts || { ALL: 0, PENDING: 0, APPROVED: 0, REJECTED: 0 });
      setTotal(json.pagination?.total ?? 0);
    } catch (err) {
      toast.error(err.message || "Failed to fetch invoices");
      setRows([]); setTotal(0);
    } finally { setLoading(false); }
  }, [page, limit, debouncedSearch, status, categoryId, productId, vendorId, branchId, entityAlias, dateFrom, dateTo]);

  useEffect(() => { loadList(); }, [loadList]);

  const categoryOptions = useMemo(() => categories.map((c) => ({ value: c._id, label: c.displayPath || c.name })), [categories]);
  const vendorOptions = useMemo(() => vendors.map((v) => ({ value: v._id, label: v.name })), [vendors]);
  const entityOptions = useMemo(() => aliases.map((a) => ({ value: a, label: a })), [aliases]);

  const hasActiveFilters =
    !!search || !!categoryId || !!productId || !!vendorId || !!branchId || !!entityAlias ||
    !!dateFrom || !!dateTo || status !== STATUS.PENDING;

  const clearFilters = () => {
    setSearch(""); setCategoryId(""); setProductId(""); setVendorId(""); setBranchId(""); setEntityAlias("");
    setDateFrom(""); setDateTo(""); setStatus(STATUS.PENDING); setPage(1);
  };

  const tabs = [
    { key: STATUS.PENDING, label: "Pending", count: counts.PENDING ?? 0 },
    { key: STATUS.APPROVED, label: "Approved", count: counts.APPROVED ?? 0 },
    { key: STATUS.REJECTED, label: "Rejected", count: counts.REJECTED ?? 0 },
  ];

  const backToList = () => { setView({ mode: "list" }); loadList(); };

  if (view.mode === "editInvoice") {
    return (
      <InvoiceReceiveView
        trackingOrderId={view.invoice.trackingOrderId}
        invoiceId={view.invoice._id}
        entryId={view.invoice.entryId}
        onBack={backToList}
        onDone={backToList}
      />
    );
  }
  if (view.mode === "review") {
    return <InvoiceReviewView invoiceId={view.invoiceId} entryId={view.entryId} onBack={backToList} onDone={backToList} />;
  }

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <h1 className="mb-5 flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-900">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-100">
          <ClipboardCheck className="h-5 w-5" />
        </span>
        Invoice Approvals
      </h1>

      {/* filters — search + lookups */}
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative sm:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search invoice no, vendor or product..."
              className={`${inputCls} pl-9`}
            />
          </div>
          <SearchableSelect value={vendorId} onChange={(v) => { setVendorId(v); setPage(1); }} options={vendorOptions} placeholder="All vendors" />
          <SearchableSelect
            value={categoryId} onChange={(v) => { setCategoryId(v); setProductId(""); setPage(1); }}
            options={categoryOptions} placeholder="All categories"
          />
          <SearchableSelect value={productId} onChange={(v) => { setProductId(v); setPage(1); }} options={productOptions} placeholder="All products" />
          {/* the branch that received the invoice */}
          <SearchableSelect value={branchId} onChange={(v) => { setBranchId(v); setPage(1); }} options={branchOptions} placeholder="All branches" />
        </div>
      </div>

      {/* status tabs on the left; entity, date range + reset on the right */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => {
            const st = TAB_STYLES[t.key];
            const active = status === t.key;
            return (
              <button
                key={t.key} type="button" onClick={() => { setStatus(t.key); setPage(1); }}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 ${active ? st.active : st.inactive}`}
              >
                {t.label}
                <span className={`rounded-full px-1.5 text-xs tabular-nums ${active ? st.chipActive : st.chipInactive}`}>{t.count}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full sm:w-40">
            <SearchableSelect value={entityAlias} onChange={(v) => { setEntityAlias(v); setPage(1); }} options={entityOptions} placeholder="All entities" />
          </div>
          <DateRangeButton
            from={dateFrom} to={dateTo}
            onFrom={(v) => { setDateFrom(v); setPage(1); }}
            onTo={(v) => { setDateTo(v); setPage(1); }}
            hint="Filters on the invoice date."
          />
          {hasActiveFilters && (
            <button
              type="button" onClick={clearFilters}
              className="inline-flex h-[38px] items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-rose-600 shadow-sm transition hover:border-rose-300 hover:bg-rose-100"
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
                <th className={th}>Invoice</th>
                <th className={th}>Vendor / PO</th>
                <th className={th}>Items</th>
                <th className={thRight}>Qty</th>
                <th className={thRight}>Basic Price</th>
                <th className={thRight}>GST</th>
                <th className={thRight}>Misc</th>
                <th className={thRight}>Total</th>
                <th className={th}>Status</th>
                <th className={thRight}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, r) => (
                  <tr key={r} className="animate-pulse">
                    {Array.from({ length: COLUMNS + 1 }).map((__, c) => (
                      <td key={c} className="px-4 py-4"><div className="h-3.5 w-3/4 rounded bg-slate-100" /></td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr><td colSpan={COLUMNS + 1} className="px-4 py-16 text-center">
                  <ClipboardCheck className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-sm font-medium text-slate-700">
                    {status === STATUS.PENDING && !hasActiveFilters ? "Nothing waiting for approval" : "No invoices found"}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">{hasActiveFilters ? "Try changing or resetting the filters." : "Submitted invoices appear here."}</p>
                </td></tr>
              ) : (
                rows.map((inv) => {
                  const partial = !!inv.partialSubmit;
                  const entries = (inv.entries || []).filter((e) => e.status !== "DRAFT").slice().sort((x, y) => y.entryNumber - x.entryNumber);
                  const open = !!expanded[inv._id];
                  const tab = inv.approvalTab || inv.status;
                  const reviewEntry = partial ? inv.pendingEntry : null;
                  return (
                    <React.Fragment key={inv._id}>
                    <tr className="transition hover:bg-slate-50/60">
                      {/* invoice no, its date below */}
                      <td className="px-4 py-3.5 align-top">
                        <p className="flex items-center gap-1.5 whitespace-nowrap">
                          <span className="text-sm font-semibold text-indigo-600">{inv.invoiceNumber}</span>
                          {/* partial submit: its entries open below the row */}
                          {partial && (
                            <button
                              type="button" onClick={() => setExpanded((p) => ({ ...p, [inv._id]: !p[inv._id] }))}
                              title={`Partial submit — ${open ? "hide" : "show"} ${entries.length} entr${entries.length === 1 ? "y" : "ies"}`}
                              className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-inset transition ${
                                open ? "bg-violet-600 text-white ring-violet-600" : "bg-violet-50 text-violet-700 ring-violet-200 hover:bg-violet-100"
                              }`}
                            >
                              P·{entries.length} {open ? "▾" : "▸"}
                            </button>
                          )}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500 tabular-nums">{fmtDate(inv.invoiceDate)}</p>
                      </td>
                      {/* vendor, its PO below */}
                      <td className="px-4 py-3.5 align-top">
                        <p className="text-sm font-semibold text-slate-900">{inv.vendorName || "—"}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{inv.poNumber || "—"}</p>
                      </td>
                      <td className="px-4 py-3.5 align-top"><ItemsCell inv={inv} /></td>
                      {/* approved so far out of the invoice */}
                      <td className="whitespace-nowrap px-4 py-3.5 text-right align-top text-sm tabular-nums">
                        {/* quantity, then a fixed slot that says how much of it is approved —
                            the slot is on every row so the numbers line up */}
                        <span className="inline-flex items-center justify-end gap-2.5">
                          <span>
                            <span className="font-semibold text-slate-900">{inv.qtyApproved || 0}</span>
                            <span className="text-slate-400"> / {inv.qtyInvoiced || 0}</span>
                          </span>
                          <ApprovedMark
                            pct={partial ? inv.progressPct : (inv.qtyInvoiced ? ((inv.qtyApproved || 0) / inv.qtyInvoiced) * 100 : 0)}
                          />
                        </span>
                        {partial && inv.pendingEntryCount > 0 && (
                          <span className="block text-[11px] text-amber-700">{inv.pendingEntryCount} entr{inv.pendingEntryCount > 1 ? "ies" : "y"} pending</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right align-top text-sm text-slate-700 tabular-nums">{money(inv.basicAmount)}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right align-top text-sm text-slate-700 tabular-nums"><GstCell inv={inv} /></td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right align-top text-sm text-slate-700 tabular-nums">{money(inv.miscTotal ?? inv.extraChargesTotal)}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right align-top text-sm font-bold text-slate-900 tabular-nums">{money(inv.invoiceTotal ?? inv.grandTotal)}</td>
                      <td className="px-4 py-3.5 align-top">
                        {partial && tab === STATUS.APPROVED && inv.status !== "APPROVED" ? (
                          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700">
                            <span className="h-2 w-2 rounded-full bg-violet-500" />
                            In progress
                          </span>
                        ) : (
                          <ApprovalDot status={tab} />
                        )}
                        {partial && tab === STATUS.PENDING && reviewEntry && (
                          <span className="block text-[11px] text-slate-500">Entry {reviewEntry.entryNumber} waiting</span>
                        )}
                        {partial && tab === STATUS.REJECTED && inv.rejectedEntry && (
                          <span className="block text-[11px] text-slate-500">Entry {inv.rejectedEntry.entryNumber}</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right align-top">
                        {tab === STATUS.PENDING ? (
                          <button
                            type="button" onClick={() => setView({ mode: "review", invoiceId: inv._id, entryId: reviewEntry?._id })}
                            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200 transition hover:bg-amber-100 hover:text-amber-800"
                          >
                            <ClipboardCheck className="h-4 w-4" /> {reviewEntry ? `Review Entry ${reviewEntry.entryNumber}` : "Review"}
                          </button>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button" onClick={() => setView({ mode: "review", invoiceId: inv._id })} title="View" aria-label="View"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100 transition hover:bg-indigo-100 hover:text-indigo-700"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            {tab === STATUS.REJECTED && (
                              <button
                                type="button" onClick={() => setView({ mode: "editInvoice", invoice: { ...inv, entryId: inv.rejectedEntry?._id } })}
                                title={inv.rejectedEntry ? `Fix Entry ${inv.rejectedEntry.entryNumber}` : "Fix"}
                                aria-label="Fix"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-orange-600 ring-1 ring-inset ring-orange-100 transition hover:bg-orange-100 hover:text-orange-700"
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                    {/* A partial invoice's entries — each its own share of the one bill */}
                    {partial && open && (
                      <tr className="bg-violet-50/30">
                        <td colSpan={COLUMNS + 1} className="px-6 pb-4 pt-1">
                          <div className="overflow-hidden rounded-xl border border-violet-100 bg-white">
                            <table className="w-full text-sm">
                              <thead className="bg-violet-50/60">
                                <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-violet-800">
                                  <th className="px-3 py-2">Entry</th>
                                  <th className="px-3 py-2">Date</th>
                                  <th className="px-3 py-2">Entered by</th>
                                  <th className="px-3 py-2">Items</th>
                                  <th className="px-3 py-2 text-right">Qty</th>
                                  <th className="px-3 py-2 text-right">FOC</th>
                                  <th className="px-3 py-2 text-right">Value</th>
                                  <th className="px-3 py-2">Status</th>
                                  <th className="px-3 py-2 text-right">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {entries.map((e) => (
                                  <tr key={e._id}>
                                    <td className="px-3 py-2 font-semibold text-slate-900">Entry {e.entryNumber}</td>
                                    <td className="px-3 py-2 tabular-nums text-slate-500">{fmtDateTime(e.submittedAt || e.updatedAt)}</td>
                                    <td className="px-3 py-2 text-slate-700">{e.submittedByName || "—"}</td>
                                    <td className="px-3 py-2 text-slate-600">{e.items || "—"}</td>
                                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">{e.qty || 0}</td>
                                    <td className={`px-3 py-2 text-right tabular-nums ${e.focQty ? "text-amber-700" : "text-slate-400"}`}>{e.focQty || 0}</td>
                                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">{money(e.value)}</td>
                                    <td className="px-3 py-2"><ApprovalDot status={e.status} /></td>
                                    <td className="px-3 py-2 text-right">
                                      {e.status === STATUS.PENDING ? (
                                        <button
                                          type="button" onClick={() => setView({ mode: "review", invoiceId: inv._id, entryId: e._id })}
                                          className="rounded-lg bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200 hover:bg-amber-100"
                                        >
                                          Review
                                        </button>
                                      ) : (
                                        <button
                                          type="button" onClick={() => setView({ mode: "review", invoiceId: inv._id, entryId: e._id })} title="View entry"
                                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100 hover:bg-indigo-100"
                                        >
                                          <Eye className="h-3.5 w-3.5" />
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <p className="border-t border-violet-100 px-3 py-1.5 text-[11px] text-slate-500">
                              One bill of {money(inv.grandTotal)} — entries are parts of it, not separate bills.
                            </p>
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

        {/* pagination only once there is more than one page's worth */}
        {total > 10 && (
          <div className="border-t border-slate-100 px-4 py-3">
            <Pagination
              currentPage={page} totalItems={total} itemsPerPage={limit} onPageChange={setPage}
              onItemsPerPageChange={(n) => { setLimit(n); setPage(1); }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default InvoiceApprovalList;
