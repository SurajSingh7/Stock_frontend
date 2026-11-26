"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { fetchStatusSummary, fetchQuotations } from "@/modules/stock/quotations/quotationApi";
import { fetchLeafCategories, fetchVendors, fetchProductOptions } from "@/modules/stock/shared/lookupsApi";
import Pagination from "@/shared/ui/pagination/Pagination";
import { RotateCcw, Eye, Search, CalendarDays, Info, ClipboardCheck } from "lucide-react";
import { SearchableSelect, Modal } from "@/modules/stock/shared/StockSharedUI";
import {
  QUOTATION_STATUS as STATUS,
  QUOTATION_STATUS_META as STATUS_META,
} from "@/modules/stock/quotations/quotationStatus";

/* ============================================================= */
/* Constants                                                      */
/* ============================================================= */

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const fmtTime = (d) =>
  d ? new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "";

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

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";
const dateCls =
  "w-[140px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";

const th = "px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600";
const thRight = "px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600";

// Category paths get long ("Laptop › Dell › Latitude"); past this they are cut.
const PATH_MAX = 28;

/* ============================================================= */
/* Bits                                                           */
/* ============================================================= */

const StatusBadge = ({ status }) => {
  const m = STATUS_META[status] || { label: status, badge: "bg-slate-50 text-slate-600 ring-slate-200", dot: "bg-slate-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${m.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
};

// Popup listing every name behind a "+N more".
const NamesModal = ({ title, names, tone, onClose }) => (
  <Modal title={title} onClose={onClose} maxWidth="max-w-md">
    <div className="flex flex-wrap gap-1.5">
      {names.map((n, i) => (
        <span key={i} className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${tone}`}>{n}</span>
      ))}
    </div>
  </Modal>
);

const MoreBtn = ({ count, onClick }) => (
  <button
    type="button" onClick={onClick}
    className="ml-1 whitespace-nowrap text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
  >
    +{count} more
  </button>
);

// Categories: first two paths as chips (long ones cut with "…"), the rest behind "+N more".
const CategoriesCell = ({ q }) => {
  const [open, setOpen] = useState(false);
  const paths = [...new Set((q.items || []).map((it) => it.categoryName).filter(Boolean))];
  if (paths.length === 0) return <span className="text-sm text-slate-300">—</span>;
  const extra = paths.length - 2;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {paths.slice(0, 2).map((p, i) => (
        <span key={i} title={p} className="whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
          {p.length > PATH_MAX ? `${p.slice(0, PATH_MAX).trimEnd()}…` : p}
        </span>
      ))}
      {extra > 0 && <MoreBtn count={extra} onClick={() => setOpen(true)} />}
      {open && (
        <NamesModal
          title={`Categories · ${q.quotationNumber}`} names={paths}
          tone="bg-slate-50 text-slate-700 ring-slate-200" onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
};

// Vendors: first two names, the rest behind "+N more".
const VendorsCell = ({ q }) => {
  const [open, setOpen] = useState(false);
  const names = [...new Set((q.items || []).map((it) => it.vendorName).filter(Boolean))];
  if (names.length === 0) return <span className="text-sm text-slate-300">—</span>;
  const extra = names.length - 2;
  return (
    <span className="text-sm text-slate-700">
      {names.slice(0, 2).join(", ")}
      {extra > 0 && <MoreBtn count={extra} onClick={() => setOpen(true)} />}
      {open && (
        <NamesModal
          title={`Vendors · ${q.quotationNumber}`} names={names}
          tone="bg-indigo-50 text-indigo-700 ring-indigo-100" onClose={() => setOpen(false)}
        />
      )}
    </span>
  );
};

const LoadingRows = ({ columns, rows = 6 }) => (
  <>
    {Array.from({ length: rows }).map((_, r) => (
      <tr key={r} className="animate-pulse">
        {Array.from({ length: columns }).map((__, c) => (
          <td key={c} className="px-4 py-4">
            <div className="h-3.5 w-3/4 rounded bg-slate-100" />
          </td>
        ))}
      </tr>
    ))}
  </>
);

/* ============================================================= */
/* Main                                                           */
/* ============================================================= */

const COLUMNS = 6;

const QuotationApprovalList = () => {
  const router = useRouter();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState(STATUS.PENDING); // approver defaults to pending
  const [categoryId, setCategoryId] = useState("");
  const [productId, setProductId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [categories, setCategories] = useState([]);      // leaf + hasProducts
  const [vendors, setVendors] = useState([]);
  const [productOptions, setProductOptions] = useState([]);

  const [summary, setSummary] = useState({ PENDING: 0, APPROVED: 0, PARTIALLY_APPROVED: 0, REJECTED: 0, ALL: 0 });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);

  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 350); return () => clearTimeout(t); }, [search]);

  const loadSummary = useCallback(async () => {
    try { setSummary(await fetchStatusSummary()); } catch {}
  }, []);

  useEffect(() => {
    (async () => {
      try { setCategories(await fetchLeafCategories()); } catch {}
      try { setVendors(await fetchVendors(1000)); } catch {}
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
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (status) params.set("status", status);
      if (categoryId) params.set("categoryId", categoryId);
      if (productId) params.set("productId", productId);
      if (vendorId) params.set("vendorId", vendorId);
      if (dateFrom) params.set("dateFrom", dateFrom);    // backend: status-wise date (see the ⓘ note)
      if (dateTo) params.set("dateTo", dateTo);
      const { rows, total } = await fetchQuotations(params);
      setRows(rows);
      setTotal(total);
    } catch (err) {
      toast.error(err.message || "Failed to fetch quotations");
      setRows([]); setTotal(0);
    } finally { setLoading(false); }
  }, [page, limit, debouncedSearch, status, categoryId, productId, vendorId, dateFrom, dateTo]);

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { loadList(); }, [loadList]);

  const categoryOptions = useMemo(
    () => categories.map((c) => ({ value: c._id, label: c.displayPath || c.name })),
    [categories]
  );
  const vendorOptions = useMemo(() => vendors.map((v) => ({ value: v._id, label: v.name })), [vendors]);

  const hasActiveFilters =
    !!search || !!categoryId || !!productId || !!vendorId || status !== STATUS.PENDING || !!dateFrom || !!dateTo;

  const clearFilters = () => {
    setSearch(""); setCategoryId(""); setProductId(""); setVendorId("");
    setDateFrom(""); setDateTo(""); setStatus(STATUS.PENDING); setPage(1);
  };

  const tabs = [
    ...[STATUS.PENDING, STATUS.APPROVED, STATUS.PARTIALLY_APPROVED, STATUS.REJECTED].map((key) => ({
      key, label: STATUS_META[key].label, count: summary[key] ?? 0,
    })),
  ];

  const openReview = (q) => router.push(`/stock/approval/quotations/${q._id}`);
  const openView = (q) => router.push(`/stock/purchase/quotations/${q._id}?from=approval`);
  const open = (q) => (q.status === STATUS.PENDING ? openReview(q) : openView(q));

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      {/* page header */}
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-100">
            <ClipboardCheck className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">Quotation approvals</h1>
            <p className="mt-0.5 text-sm text-slate-500">Review pending quotations category-wise.</p>
          </div>
        </div>
      </div>

      {/* filters — search + lookups */}
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search quotation #, vendor or creator"
              className={`${inputCls} pl-9`}
            />
          </div>
          <SearchableSelect
            value={categoryId} onChange={(v) => { setCategoryId(v); setProductId(""); setPage(1); }}
            options={categoryOptions} placeholder="All categories"
          />
          <SearchableSelect
            value={productId} onChange={(v) => { setProductId(v); setPage(1); }}
            options={productOptions} placeholder="All products"
          />
          <SearchableSelect
            value={vendorId} onChange={(v) => { setVendorId(v); setPage(1); }}
            options={vendorOptions} placeholder="All vendors"
          />
        </div>
      </div>

      {/* status tabs on the left; date range + reset on the right */}
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => {
          const st = TAB_STYLES[t.key] || TAB_STYLES[""];
          const active = status === t.key;
          return (
            <button
              key={t.key} type="button" onClick={() => { setStatus(t.key); setPage(1); }}
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

        <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <CalendarDays className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-600">From</span>
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className={dateCls} />
          <span className="text-sm font-medium text-slate-600">To</span>
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className={dateCls} />
          <span
            className="cursor-help text-slate-400 hover:text-slate-600"
            title="Pending uses the submission date; Fully Approved, Partially Approved and Rejected use the decision date."
          >
            <Info className="h-4 w-4" />
          </span>
          {hasActiveFilters && (
            <button
              type="button" onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-100"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
          )}
        </div>
      </div>

      {/* table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className={th}>Quotation #</th>
                <th className={th}>Categories</th>
                <th className={th}>Vendors</th>
                <th className={th}>Status</th>
                <th className={th}>Created</th>
                <th className={thRight}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <LoadingRows columns={COLUMNS} />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS} className="px-4 py-16 text-center">
                    <ClipboardCheck className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-2 text-sm font-medium text-slate-700">
                      {status === STATUS.PENDING && !hasActiveFilters ? "Nothing waiting for approval" : "No quotations found"}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      {hasActiveFilters ? "Try changing or resetting the filters." : "New quotations appear here once submitted."}
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((q) => (
                  <tr key={q._id} className="transition hover:bg-slate-50/60">
                    <td className="whitespace-nowrap px-4 py-3.5">
                      <button
                        type="button" onClick={() => open(q)}
                        className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                      >
                        {q.quotationNumber || "—"}
                      </button>
                    </td>
                    <td className="px-4 py-3.5"><CategoriesCell q={q} /></td>
                    <td className="px-4 py-3.5"><VendorsCell q={q} /></td>
                    <td className="px-4 py-3.5"><StatusBadge status={q.status} /></td>
                    <td className="whitespace-nowrap px-4 py-3.5">
                      <p className="text-sm text-slate-700 tabular-nums">
                        {fmtDate(q.createdAt)}
                        <span className="ml-1.5 text-xs text-slate-400">{fmtTime(q.createdAt)}</span>
                      </p>
                      {q.createdBy?.name && <p className="mt-0.5 text-xs text-slate-400">by {q.createdBy.name}</p>}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {/* Pending → Review (the decision screen); decided → View (read-only) */}
                      {q.status === STATUS.PENDING ? (
                        <button
                          type="button" onClick={() => openReview(q)} title="Review"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200 transition hover:bg-amber-100 hover:text-amber-800"
                        >
                          <ClipboardCheck className="h-4 w-4" /> Review
                        </button>
                      ) : (
                        <button
                          type="button" onClick={() => openView(q)} title="View" aria-label="View"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100 transition hover:bg-indigo-100 hover:text-indigo-700"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
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

export default QuotationApprovalList;
