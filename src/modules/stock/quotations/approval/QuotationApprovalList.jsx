"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import Pagination from "@/shared/ui/pagination/Pagination";
import { RotateCcw, Eye, FileText, ClipboardCheck } from "lucide-react";
import {
  SearchableSelect, Modal, leafOf, hasPath, ViewPathIcon, CategoryPathModal,
} from "@/modules/stock/shared/StockSharedUI";

/* ============================================================= */
/* Constants — SAME tokens as PurchaseOrderPage                   */
/* ============================================================= */

const STATUS = { PENDING: "PENDING", APPROVED: "APPROVED", PARTIALLY_APPROVED: "PARTIALLY_APPROVED", REJECTED: "REJECTED" };

const STATUS_META = {
  PENDING: { label: "Pending", badge: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500" },
  APPROVED: { label: "Approved", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  PARTIALLY_APPROVED: { label: "Partial", badge: "bg-indigo-50 text-indigo-700 ring-indigo-200", dot: "bg-indigo-500" },
  REJECTED: { label: "Rejected", badge: "bg-rose-50 text-rose-700 ring-rose-200", dot: "bg-rose-500" },
};

const TAB_STYLES = {
  "": {
    active: "border-indigo-600 bg-indigo-600 text-white",
    inactive: "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100",
    chipActive: "bg-indigo-500 text-indigo-50",
    chipInactive: "bg-indigo-100 text-indigo-700",
  },
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
  PARTIALLY_APPROVED: {
    active: "border-sky-600 bg-sky-600 text-white",
    inactive: "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100",
    chipActive: "bg-sky-500 text-sky-50",
    chipInactive: "bg-sky-100 text-sky-700",
  },
  REJECTED: {
    active: "border-rose-600 bg-rose-600 text-white",
    inactive: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
    chipActive: "bg-rose-500 text-rose-50",
    chipInactive: "bg-rose-100 text-rose-700",
  },
};

const localInputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-800 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";

const TRUNCATE_LEN = 25;

const th = "px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-700";
const thRight = "px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-700";

/* ============================================================= */
/* Truncate long text + "...more" popup                           */
/* ============================================================= */

const TruncateText = ({ text, max = TRUNCATE_LEN, title = "Full details", className = "" }) => {
  const [open, setOpen] = useState(false);
  const str = text == null || text === "" ? "—" : String(text);
  if (str.length <= max) return <span className={className}>{str}</span>;
  return (
    <>
      <span className={className}>
        {str.slice(0, max)}...
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
          className="ml-1 text-xs font-semibold text-indigo-600 hover:underline"
        >
          more
        </button>
      </span>
      {open && (
        <Modal onClose={() => setOpen(false)} title={title}>
          <p className="whitespace-pre-wrap break-words text-sm text-slate-900">{str}</p>
        </Modal>
      )}
    </>
  );
};

/* ============================================================= */
/* Bits                                                           */
/* ============================================================= */

const StatusBadge = ({ status }) => {
  const m = STATUS_META[status] || { label: status, badge: "bg-slate-50 text-slate-600 ring-slate-200", dot: "bg-slate-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition ${m.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
};

const Avatar = ({ name }) => {
  const initials = (name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <span className="inline-flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600 ring-1 ring-inset ring-indigo-100">
        {initials}
      </span>
      <span className="text-slate-900"><TruncateText text={name} max={18} title="Created by" /></span>
    </span>
  );
};

const quotationCategories = (q) => {
  const map = new Map();
  (q.items || []).forEach((it) => {
    const path = it.categoryName || "";
    if (path && !map.has(path)) map.set(path, { leaf: leafOf(path), path });
  });
  return [...map.values()];
};

const CategoriesCell = ({ q, onMore }) => {
  const cats = quotationCategories(q);
  if (cats.length === 0) return <span className="text-slate-400">—</span>;
  const shown = cats.slice(0, 2), extra = cats.length - shown.length;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((c, i) => (
        <span key={i} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{c.leaf}</span>
      ))}
      {extra > 0 && (
        <button
          type="button" onClick={() => onMore(cats)}
          className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-600 ring-1 ring-inset ring-indigo-100 transition hover:bg-indigo-100"
        >
          +{extra}
        </button>
      )}
    </div>
  );
};

/* ============================================================= */
/* Main                                                           */
/* ============================================================= */

const QuotationApprovalList = () => {
  const router = useRouter();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState(STATUS.PENDING); // approver defaults to pending
  const [categoryId, setCategoryId] = useState("");
  const [productId, setProductId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [categories, setCategories] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [productOptions, setProductOptions] = useState([]);
  const [pathModal, setPathModal] = useState(null);
  const [moreCats, setMoreCats] = useState(null);

  const [summary, setSummary] = useState({ PENDING: 0, APPROVED: 0, PARTIALLY_APPROVED: 0, REJECTED: 0, ALL: 0 });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);

  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 350); return () => clearTimeout(t); }, [search]);

  const loadSummary = useCallback(async () => {
    try { const res = await fetch(`${API_BACKEND_URL}/stock/quotations/status-summary`, { credentials: "include" });
      const json = await res.json(); if (json.success) setSummary(json.data || {}); } catch {}
  }, []);

  useEffect(() => {
    (async () => {
      try { const r = await fetch(`${API_BACKEND_URL}/stock/categories/flat?type=LEAF&hasProducts=true&limit=500`, { credentials: "include" });
        const j = await r.json(); if (j.success) setCategories(j.data || []); } catch {}
      try { const r = await fetch(`${API_BACKEND_URL}/stock/vendors?limit=1000`, { credentials: "include" });
        const j = await r.json(); if (j.success) setVendors(j.data || []); } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!categoryId) { setProductOptions([]); return; }
      try { const r = await fetch(`${API_BACKEND_URL}/stock/product-definitions?categoryId=${categoryId}&limit=1000`, { credentials: "include" });
        const j = await r.json(); if (j.success) setProductOptions((j.data || []).map((p) => ({ value: p._id, label: p.name }))); } catch { setProductOptions([]); }
    })();
  }, [categoryId]);

  const loadList = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (status) params.set("status", status);
      if (categoryId) params.set("categoryId", categoryId);
      if (productId) params.set("productId", productId);
      if (vendorId) params.set("vendorId", vendorId);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const res = await fetch(`${API_BACKEND_URL}/stock/quotations?${params.toString()}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to fetch quotations");
      setRows(json.data || []);
      setTotal(json.pagination?.total ?? 0);
    } catch (err) { setError(err.message); setRows([]); setTotal(0); } finally { setLoading(false); }
  }, [page, limit, debouncedSearch, status, categoryId, productId, vendorId, dateFrom, dateTo]);

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { loadList(); }, [loadList]);

  const onStatusTab = (next) => { setStatus(next); setPage(1); };

  const categoryOptions = useMemo(() => categories.map((c) => ({ value: c._id, label: c.name, path: c.displayPath || c.name })), [categories]);
  const vendorOptions = useMemo(() => vendors.map((v) => ({ value: v._id, label: v.name })), [vendors]);

  const hasActiveFilters =
    !!search || !!categoryId || !!productId || !!vendorId || !!dateFrom || !!dateTo || status !== STATUS.PENDING;

  const clearFilters = () => {
    setSearch(""); setCategoryId(""); setProductId(""); setVendorId("");
    setDateFrom(""); setDateTo(""); setStatus(STATUS.PENDING); setPage(1);
    // setStatus("");
  };

  const tabs = [
    { key: "", label: "All", count: summary.ALL ?? 0 },
    { key: STATUS.PENDING, label: "Pending", count: summary.PENDING ?? 0 },
    { key: STATUS.APPROVED, label: "Approved", count: summary.APPROVED ?? 0 },
    { key: STATUS.PARTIALLY_APPROVED, label: "Partial", count: summary.PARTIALLY_APPROVED ?? 0 },
    { key: STATUS.REJECTED, label: "Rejected", count: summary.REJECTED ?? 0 },
  ];

  const dateLabel = status === STATUS.PENDING || status === "" ? "Submitted:" : "Decided:";

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      {/* page header */}
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Quotation approvals</h1>
        <p className="mt-0.5 text-sm text-slate-500">Review pending quotations category-wise.</p>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="font-bold">&times;</button>
        </div>
      )}

      {/* ROW 1 — search (large) + Category / Product / Vendor filters */}
      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <input
              type="text" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search quotation number or vendor..."
              className={localInputCls}
            />
          </div>
          <SearchableSelect
            value={categoryId} onChange={(v) => { setCategoryId(v); setProductId(""); setPage(1); }}
            options={categoryOptions} placeholder="All categories"
            renderExtra={(o) => (hasPath(o.label, o.path) ? <ViewPathIcon onClick={(e) => { e.stopPropagation(); setPathModal(o); }} /> : null)}
          />
          <SearchableSelect
            value={productId} onChange={(v) => { setProductId(v); setPage(1); }}
            options={productOptions}
            placeholder={categoryId ? "All products" : "Select a category first"} disabled={!categoryId}
          />
          <SearchableSelect
            value={vendorId} onChange={(v) => { setVendorId(v); setPage(1); }}
            options={vendorOptions} placeholder="All vendors"
          />
        </div>
      </div>

      {/* ROW 2 — status chips (left) + date range + reset (right) */}
      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => {
            if (t.key === "") return null;   // Hide only "All"
            const st = TAB_STYLES[t.key] || TAB_STYLES[""];
            const active = status === t.key;
            return (
              <button
                key={t.key} type="button" onClick={() => onStatusTab(t.key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 ${active ? st.active : st.inactive}`}
              >
                {t.label}
                <span className={`rounded-full px-1.5 text-xs tabular-nums ${active ? st.chipActive : st.chipInactive}`}>
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <span className="whitespace-nowrap text-sm font-semibold text-slate-700">{dateLabel}</span>
            <input
              type="date" value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="w-[150px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <span className="whitespace-nowrap text-sm font-semibold text-slate-700">To:</span>
            <input
              type="date" value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="w-[150px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          {hasActiveFilters && (
            <button
              type="button" onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-xl border border-rose-300 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-600 shadow-sm transition hover:border-rose-400 hover:bg-rose-100"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      <p className="mb-3 text-xs text-slate-400">
        Date range uses the submission date for Pending, and the decision date for Approved / Partial / Rejected.
      </p>

      {/* table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50/60">
            <tr>
              <th className={th}>Quotation #</th>
              <th className={th}>Categories</th>
              <th className={th}>Vendors</th>
              {/* <th className={th}>Created By</th> */}
              <th className={th}>Status</th>
              <th className={thRight}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                  <p className="mt-2 text-sm text-slate-500">Loading…</p>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center">
                  <p className="text-sm font-medium text-slate-700">No quotations found</p>
                  <p className="mt-1 text-sm text-slate-400">Adjust the filters above to widen the search.</p>
                </td>
              </tr>
            ) : (
              rows.map((q) => {
                const vendorCount = new Set((q.items || []).map((it) => String(it.vendorId?._id || it.vendorId))).size;
                const isPending = q.status === STATUS.PENDING;
                return (
                  <tr key={q._id} className="transition hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-sm font-semibold text-indigo-600">{q.quotationNumber || "\u2014"}</td>
                    <td className="px-4 py-3"><CategoriesCell q={q} onMore={setMoreCats} /></td>
                    <td className="px-4 py-3 text-sm text-slate-700 tabular-nums">{vendorCount}</td>
                    {/* <td className="px-4 py-3 text-sm"><Avatar name={q.createdByName} /></td> */}
                    <td className="px-4 py-3"><StatusBadge status={q.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* <button
                          type="button" onClick={() => router.push(`/stock/quotations/${q._id}/details`)} title="Details"
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                        >
                          <FileText className="h-3.5 w-3.5" /> Details
                        </button> */}
                        {isPending ? (
                          <button
                            type="button" onClick={() => router.push(`/stock/quotations/${q._id}/review`)} title="Review"
                            className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-white px-2.5 py-1 text-xs font-medium text-amber-700 shadow-sm transition hover:border-amber-300 hover:bg-amber-50"
                          >
                            <ClipboardCheck className="h-3.5 w-3.5" /> Review
                          </button>
                        ) : (
                          <button
                            type="button" onClick={() => router.push(`/stock/quotations/${q._id}/view`)} title="View"
                            className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-white px-2.5 py-1 text-xs font-medium text-indigo-600 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
                          >
                            <Eye className="h-3.5 w-3.5" /> View
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-5">
        <Pagination
          currentPage={page} totalItems={total} itemsPerPage={limit} onPageChange={setPage}
          onItemsPerPageChange={(n) => { setLimit(n); setPage(1); }}
        />
      </div>

      {pathModal && <CategoryPathModal label={pathModal.label} path={pathModal.path} onClose={() => setPathModal(null)} />}
      {moreCats && (
        <Modal onClose={() => setMoreCats(null)} title="Categories">
          <div className="space-y-2">
            {moreCats.map((c, i) => (
              <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
                <p className="text-sm font-semibold text-slate-900">{c.leaf}</p>
                <p className="mt-0.5 text-xs text-slate-500">{c.path}</p>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default QuotationApprovalList;