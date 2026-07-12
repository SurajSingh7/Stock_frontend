"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import Pagination from "@/shared/ui/pagination/Pagination";
import {
  SearchableSelect, Modal, leafOf, hasPath, ViewPathIcon, CategoryPathModal,
} from "@/modules/stock/shared/StockSharedUI";

const STATUS = { PENDING: "PENDING", APPROVED: "APPROVED", PARTIALLY_APPROVED: "PARTIALLY_APPROVED", REJECTED: "REJECTED" };
const STATUS_META = {
  PENDING: { label: "Pending", cls: "bg-amber-50 text-amber-700" },
  APPROVED: { label: "Approved", cls: "bg-green-50 text-green-700" },
  PARTIALLY_APPROVED: { label: "Partially approved", cls: "bg-indigo-50 text-indigo-700" },
  REJECTED: { label: "Rejected", cls: "bg-red-50 text-red-600" },
};

const CountCard = ({ label, count, active, tone, onClick }) => {
  const toneCls = active && tone === "warning" ? "border-amber-400 bg-amber-50" : active ? "border-indigo-400 bg-indigo-50" : "border-gray-200 bg-gray-50";
  return (
    <button type="button" onClick={onClick} className={`rounded-xl border-2 px-4 py-3 text-left transition-colors ${toneCls}`}>
      <p className="mb-1 text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-semibold text-gray-900">{count}</p>
    </button>
  );
};

const StatusBadge = ({ status }) => {
  const meta = STATUS_META[status] || { label: status, cls: "bg-gray-100 text-gray-600" };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${meta.cls}`}>{meta.label}</span>;
};

const Avatar = ({ name }) => {
  const initials = (name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <span className="inline-flex items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-50 text-[10px] font-medium text-indigo-600">{initials}</span>
      <span className="text-gray-900">{name || "\u2014"}</span>
    </span>
  );
};

// distinct categories (leaf + full path) for a quotation, from its items
const quotationCategories = (q) => {
  const map = new Map();
  (q.items || []).forEach((it) => {
    const path = it.categoryName || "";
    if (path && !map.has(path)) map.set(path, { leaf: leafOf(path), path });
  });
  return [...map.values()];
};

// Categories cell: up to 2 leaf chips + "+N" → popup with leaf + full path
const CategoriesCell = ({ q, onMore }) => {
  const cats = quotationCategories(q);
  if (cats.length === 0) return <span className="text-gray-400">—</span>;
  const shown = cats.slice(0, 2);
  const extra = cats.length - shown.length;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((c, i) => (
        <span key={i} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{c.leaf}</span>
      ))}
      {extra > 0 && (
        <button type="button" onClick={() => onMore(cats)} className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600 hover:bg-indigo-100">+{extra}</button>
      )}
    </div>
  );
};

const CreatorAction = ({ quotation, onView, onDetails }) => (
  <div className="flex items-center justify-end gap-2">
    {quotation.status !== STATUS.PENDING && <span className="text-xs text-gray-400">Completed</span>}
    <button type="button" onClick={() => onDetails(quotation)} className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">Details</button>
    <button type="button" onClick={() => onView(quotation)} className="rounded-md border border-indigo-200 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50">View</button>
  </div>
);

const QuotationComp = () => {
  const router = useRouter();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [productId, setProductId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [categories, setCategories] = useState([]);      // leaf + hasProducts
  const [vendors, setVendors] = useState([]);
  const [productOptions, setProductOptions] = useState([]); // dependent
  const [pathModal, setPathModal] = useState(null);
  const [moreCats, setMoreCats] = useState(null);        // +N popup

  const [summary, setSummary] = useState({ PENDING: 0, APPROVED: 0, PARTIALLY_APPROVED: 0, REJECTED: 0, ALL: 0 });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);

  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 350); return () => clearTimeout(t); }, [search]);

  const loadSummary = useCallback(async () => {
    try { const res = await fetch(`${API_BACKEND_URL}/stock/quotations/status-summary`, { credentials: "include" });
      const json = await res.json(); if (json.success) setSummary(json.data || {}); } catch {}
  }, []);

  // leaf categories that have products (server-side)
  useEffect(() => {
    (async () => {
      try { const r = await fetch(`${API_BACKEND_URL}/stock/categories/flat?type=LEAF&hasProducts=true&limit=500`, { credentials: "include" });
        const j = await r.json(); if (j.success) setCategories(j.data || []); } catch {}
      try { const r = await fetch(`${API_BACKEND_URL}/stock/vendors?limit=1000`, { credentials: "include" });
        const j = await r.json(); if (j.success) setVendors(j.data || []); } catch {}
    })();
  }, []);

  // Product filter = dependent: only load products of the selected category (server-side)
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
      if (productId) params.set("productId", productId); // backend: filter items.productDefinitionId
      if (vendorId) params.set("vendorId", vendorId);
      if (dateFrom) params.set("dateFrom", dateFrom);    // backend: status-wise date (see note)
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

  const onStatusCard = (next) => { setStatus((prev) => (prev === next ? "" : next)); setPage(1); };

  const categoryOptions = useMemo(
    () => categories.map((c) => ({ value: c._id, label: c.name, path: c.displayPath || c.name })),
    [categories]
  );
  const vendorOptions = useMemo(() => vendors.map((v) => ({ value: v._id, label: v.name })), [vendors]);

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Quotations</h1>
          <p className="mt-1 text-sm text-gray-500">Approved categories flow to PO Management separately</p>
        </div>
        <button type="button" onClick={() => router.push("/stock/quotations/create")} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">+ Add quotation</button>
      </div>

      {error && <div className="mb-4 flex items-center justify-between rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"><span>{error}</span><button type="button" onClick={() => setError(null)} className="font-bold">&times;</button></div>}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <CountCard label="Pending" count={summary.PENDING ?? 0} active={status === STATUS.PENDING} tone="warning" onClick={() => onStatusCard(STATUS.PENDING)} />
        <CountCard label="Approved" count={summary.APPROVED ?? 0} active={status === STATUS.APPROVED} onClick={() => onStatusCard(STATUS.APPROVED)} />
        <CountCard label="Partial" count={summary.PARTIALLY_APPROVED ?? 0} active={status === STATUS.PARTIALLY_APPROVED} onClick={() => onStatusCard(STATUS.PARTIALLY_APPROVED)} />
        <CountCard label="Rejected" count={summary.REJECTED ?? 0} active={status === STATUS.REJECTED} onClick={() => onStatusCard(STATUS.REJECTED)} />
        <CountCard label="All" count={summary.ALL ?? 0} active={status === ""} onClick={() => onStatusCard("")} />
      </div>

      {/* filters — searchable + status-wise date range */}
      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search quotation number or vendor"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
          <SearchableSelect
            value={categoryId} onChange={(v) => { setCategoryId(v); setProductId(""); setPage(1); }} options={categoryOptions} placeholder="All categories"
            renderExtra={(o) => (hasPath(o.label, o.path) ? <ViewPathIcon onClick={(e) => { e.stopPropagation(); setPathModal(o); }} /> : null)}
          />
          <SearchableSelect
            value={productId} onChange={(v) => { setProductId(v); setPage(1); }} options={productOptions}
            placeholder={categoryId ? "All products" : "Select a category first"} disabled={!categoryId}
          />
          <SearchableSelect value={vendorId} onChange={(v) => { setVendorId(v); setPage(1); }} options={vendorOptions} placeholder="All vendors" />
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-[11px] uppercase text-gray-500">
              {status === "PENDING" || status === "" ? "Submitted from" : "Decided from"}
            </label>
            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] uppercase text-gray-500">To</label>
            <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <button type="button" onClick={() => { setSearch(""); setCategoryId(""); setProductId(""); setVendorId(""); setDateFrom(""); setDateTo(""); setStatus(""); setPage(1); }}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Clear filters</button>
        </div>
        <p className="mt-2 text-[11px] text-gray-400">Date range uses the submission date for Pending, and the decision date for Approved / Partial / Rejected.</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {["Quotation #", "Categories", "Vendors", "Created by", "Status", ""].map((h, i) => (
                <th key={i} className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 ${i === 5 ? "text-right" : "text-left"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" /><p className="mt-2 text-sm text-gray-500">Loading quotations…</p></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-500">No quotations found.</td></tr>
            ) : (
              rows.map((q) => {
                const vendorCount = new Set((q.items || []).map((it) => String(it.vendorId?._id || it.vendorId))).size;
                return (
                  <tr key={q._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{q.quotationNumber || "\u2014"}</td>
                    <td className="px-4 py-3"><CategoriesCell q={q} onMore={setMoreCats} /></td>
                    <td className="px-4 py-3 text-sm text-gray-600">{vendorCount}</td>
                    <td className="px-4 py-3 text-sm"><Avatar name={q.createdByName} /></td>
                    <td className="px-4 py-3"><StatusBadge status={q.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <CreatorAction quotation={q}
                        onView={(qt) => router.push(`/stock/quotations/${qt._id}/view`)}
                        onDetails={(qt) => router.push(`/stock/quotations/${qt._id}/details`)} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4">
        <Pagination currentPage={page} totalItems={total} itemsPerPage={limit} onPageChange={setPage}
          onItemsPerPageChange={(n) => { setLimit(n); setPage(1); }} />
      </div>

      {/* category path popup (from filter 👁) */}
      {pathModal && <CategoryPathModal label={pathModal.label} path={pathModal.path} onClose={() => setPathModal(null)} />}

      {/* +N categories popup — leaf name + full path */}
      {moreCats && (
        <Modal onClose={() => setMoreCats(null)} title="Categories">
          <div className="space-y-2">
            {moreCats.map((c, i) => (
              <div key={i} className="rounded-lg border border-gray-100 px-3 py-2">
                <p className="text-sm font-medium text-gray-900">{c.leaf}</p>
                <p className="text-xs text-gray-500">{c.path}</p>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default QuotationComp;