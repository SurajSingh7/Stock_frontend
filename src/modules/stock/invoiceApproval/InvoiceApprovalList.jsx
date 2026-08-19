"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import Pagination from "@/shared/ui/pagination/Pagination";
import { RotateCcw, Eye, Edit3, ClipboardCheck } from "lucide-react";
import { SearchableSelect, Modal, inputCls, money, unitLabel } from "@/modules/stock/shared/StockSharedUI";
import InvoiceReceiveView from "@/modules/stock/tracking-orders/InvoiceReceiveView";
import InvoiceReviewView from "./InvoiceReviewView";

const STATUS = { PENDING: "PENDING", APPROVED: "APPROVED", REJECTED: "REJECTED" };

const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const STATUS_META = {
  PENDING: { label: "Pending", badge: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500" },
  APPROVED: { label: "Approved", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  REJECTED: { label: "Rejected", badge: "bg-rose-50 text-rose-700 ring-rose-200", dot: "bg-rose-500" },
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

const th = "px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-700";
const thRight = "px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-700";

const StatusBadge = ({ status }) => {
  const m = STATUS_META[status] || { label: status, badge: "bg-slate-50 text-slate-600 ring-slate-200", dot: "bg-slate-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition ${m.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
};

// Dot + plain-text status indicator for the dedicated "Approval Status"
// table column — same look as the Tracking Order card's invoice table.
const ApprovalDot = ({ status }) => {
  const m = STATUS_META[status] || {};
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700">
      <span className={`h-2 w-2 rounded-full ${m.dot || "bg-slate-400"}`} />
      {m.label || status}
    </span>
  );
};

// Items cell — "Product (qty), Product (qty)" plus a small "N Items" tag,
// same pattern as the Tracking Order card's invoice table.
const ItemsCell = ({ lines }) => {
  const list = lines || [];
  const summary = list.map((l) => `${l.productName} (${l.receivedQuantity} ${unitLabel(l.unit)})`).join(", ");
  return (
    <div className="max-w-[240px]">
      <p className="truncate text-sm text-slate-700">{summary || "—"}</p>
      <span className="mt-0.5 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
        {list.length} Item{list.length === 1 ? "" : "s"}
      </span>
    </div>
  );
};

/* ============================================================= */
/* Detail / Review popup                                          */
/* ============================================================= */

const InvoiceDetailPopup = ({ invoice, onClose }) => {
  const itemTh = "px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600";
  const itemThRight = `${itemTh} text-right`;
  const itemTd = "px-3 py-2 text-sm text-slate-700";
  const itemTdRight = `${itemTd} text-right tabular-nums`;
  return (
    <Modal onClose={onClose} title={`Invoice ${invoice.invoiceNumber}`} maxWidth="max-w-2xl">
      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vendor</p><p className="mt-1 text-sm font-medium text-slate-900">{invoice.vendorName}</p></div>
        <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date</p><p className="mt-1 text-sm font-medium text-slate-900">{fmtDateTime(invoice.invoiceDate)}</p></div>
        <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</p><p className="mt-1 text-sm font-medium text-slate-900">{money(invoice.amount)}</p></div>
        <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p><div className="mt-1"><StatusBadge status={invoice.status} /></div></div>
      </div>
      {invoice.status === "REJECTED" && invoice.rejectedReason && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">Rejected: {invoice.rejectedReason}</div>
      )}
      <div className="overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full min-w-full border-collapse">
          <thead className="bg-slate-50">
            <tr><th className={itemTh}>Product</th><th className={itemThRight}>Qty Received</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(invoice.lines || []).map((l, i) => (
              <tr key={i}>
                <td className={`${itemTd} font-medium text-slate-900`}>{l.productName}</td>
                <td className={itemTdRight}>{l.receivedQuantity} {unitLabel(l.unit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
};

/* ============================================================= */
/* Main                                                           */
/* ============================================================= */

const InvoiceApprovalList = () => {
  const [view, setView] = useState({ mode: "list" });

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState(STATUS.PENDING);
  const [categoryId, setCategoryId] = useState("");
  const [productId, setProductId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [categories, setCategories] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [productOptions, setProductOptions] = useState([]);

  const [counts, setCounts] = useState({ ALL: 0, PENDING: 0, APPROVED: 0, REJECTED: 0 });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);

  const [viewing, setViewing] = useState(null);
  const [actionError, setActionError] = useState(null);

  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 350); return () => clearTimeout(t); }, [search]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BACKEND_URL}/stock/categories/flat?type=LEAF&hasProducts=true&limit=500`, { credentials: "include" });
        const j = await r.json(); if (j.success) setCategories(j.data || []);
      } catch {}
      try {
        const r = await fetch(`${API_BACKEND_URL}/stock/vendors?limit=1000`, { credentials: "include" });
        const j = await r.json(); if (j.success) setVendors(j.data || []);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!categoryId) { setProductOptions([]); return; }
      try {
        const r = await fetch(`${API_BACKEND_URL}/stock/product-definitions?categoryId=${categoryId}&limit=1000`, { credentials: "include" });
        const j = await r.json(); if (j.success) setProductOptions((j.data || []).map((p) => ({ value: p._id, label: p.name })));
      } catch { setProductOptions([]); }
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
      const res = await fetch(`${API_BACKEND_URL}/stock/invoices/board?${params.toString()}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to fetch invoices");
      setRows(json.data?.rows || []);
      setCounts(json.data?.counts || { ALL: 0, PENDING: 0, APPROVED: 0, REJECTED: 0 });
      setTotal(json.pagination?.total ?? 0);
    } catch (err) { setError(err.message); setRows([]); setTotal(0); } finally { setLoading(false); }
  }, [page, limit, debouncedSearch, status, categoryId, productId, vendorId, dateFrom, dateTo]);

  useEffect(() => { loadList(); }, [loadList]);

  const onStatusTab = (next) => { setStatus(next); setPage(1); };

  const categoryOptions = useMemo(() => categories.map((c) => ({ value: c._id, label: c.displayPath || c.name })), [categories]);
  const vendorOptions = useMemo(() => vendors.map((v) => ({ value: v._id, label: v.name })), [vendors]);

  const hasActiveFilters =
    !!search || !!categoryId || !!productId || !!vendorId || !!dateFrom || !!dateTo || status !== STATUS.PENDING;

  const clearFilters = () => {
    setSearch(""); setCategoryId(""); setProductId(""); setVendorId("");
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
        mode="edit"
        trackingOrderId={view.invoice.trackingOrderId}
        invoice={view.invoice}
        onBack={backToList}
        onDone={backToList}
      />
    );
  }
  if (view.mode === "review") {
    return <InvoiceReviewView invoiceId={view.invoiceId} onBack={backToList} onDone={backToList} />;
  }

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Invoice approvals</h1>
        <p className="mt-0.5 text-sm text-slate-500">Review goods-received invoices submitted against sent purchase orders.</p>
      </div>

      {(error || actionError) && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{error || actionError}</span>
          <button type="button" onClick={() => { setError(null); setActionError(null); }} className="font-bold">&times;</button>
        </div>
      )}

      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <input
              type="text" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search invoice number, vendor or product..."
              className={inputCls}
            />
          </div>
          <SearchableSelect
            value={categoryId} onChange={(v) => { setCategoryId(v); setProductId(""); setPage(1); }}
            options={categoryOptions} placeholder="All categories"
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

      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => {
            const st = TAB_STYLES[t.key];
            const active = status === t.key;
            return (
              <button
                key={t.key} type="button" onClick={() => onStatusTab(t.key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 ${active ? st.active : st.inactive}`}
              >
                {t.label}
                <span className={`rounded-full px-1.5 text-xs tabular-nums ${active ? st.chipActive : st.chipInactive}`}>{t.count}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <span className="whitespace-nowrap text-sm font-semibold text-slate-700">From:</span>
            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="w-[150px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm" />
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <span className="whitespace-nowrap text-sm font-semibold text-slate-700">To:</span>
            <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="w-[150px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm" />
          </div>
          {hasActiveFilters && (
            <button
              type="button" onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-xl border border-rose-300 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-600 shadow-sm transition hover:border-rose-400 hover:bg-rose-100"
            >
              <RotateCcw className="h-4 w-4" /><span>Reset</span>
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50/60">
            <tr>
              <th className={th}>Invoice No</th>
              <th className={th}>Invoice Date</th>
              <th className={th}>Items</th>
              <th className={thRight}>Qty </th>
              <th className={thRight}>FOC</th>
              <th className={thRight}>Basic Price</th>
              <th className={thRight}>CGST</th>
              <th className={thRight}>SGST</th>
              <th className={thRight}>IGST</th>
              <th className={thRight}>Extra </th>
              <th className={thRight}>Total</th>
              <th className={th}>Status</th>
              <th className={thRight}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={13} className="px-4 py-12 text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                <p className="mt-2 text-sm text-slate-500">Loading…</p>
              </td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={13} className="px-4 py-16 text-center">
                <p className="text-sm font-medium text-slate-700">No invoices found</p>
                <p className="mt-1 text-sm text-slate-400">Adjust the filters above to widen the search.</p>
              </td></tr>
            ) : (
              rows.map((inv) => {
                const pct = inv.orderedQty > 0 ? Math.round(((inv.qtyReceived || 0) / inv.orderedQty) * 100) : 0;
                return (
                  <tr key={inv._id} className="transition hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-sm font-semibold text-indigo-600">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3 text-sm text-slate-500 tabular-nums">{fmtDateTime(inv.invoiceDate)}</td>
                    <td className="px-4 py-3"><ItemsCell lines={inv.lines} /></td>
                    <td className="px-4 py-3 text-right text-sm text-slate-700 tabular-nums">
                      {inv.qtyReceived} 
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-slate-700 tabular-nums">{inv.focQtyReceived || 0}</td>
                    <td className="px-4 py-3 text-right text-sm text-slate-700 tabular-nums">{money(inv.basicAmount)}</td>
                    <td className="px-4 py-3 text-right text-sm text-slate-700 tabular-nums">{money(inv.cgstAmount)}</td>
                    <td className="px-4 py-3 text-right text-sm text-slate-700 tabular-nums">{money(inv.sgstAmount)}</td>
                    <td className="px-4 py-3 text-right text-sm text-slate-700 tabular-nums">{money(inv.igstAmount)}</td>
                    <td className="px-4 py-3 text-right text-sm text-slate-700 tabular-nums">{money(inv.extraChargesTotal)}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900 tabular-nums">{money(inv.grandTotal)}</td>
                    <td className="px-4 py-3"><ApprovalDot status={inv.status} /></td>
                    <td className="px-4 py-3 text-right">
                      {inv.status === STATUS.PENDING ? (
                        <div className="flex items-center justify-end">
                          <button
                            type="button" onClick={() => setView({ mode: "review", invoiceId: inv._id })}
                            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-500"
                          >
                            <ClipboardCheck className="h-3.5 w-3.5" /> Review
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button" onClick={() => setViewing(inv)} title="View"
                            className="rounded-md border border-indigo-200 bg-white p-1.5 text-indigo-600 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          {inv.status === STATUS.REJECTED && (
                            <button
                              type="button" onClick={() => setView({ mode: "editInvoice", invoice: inv })} title="Edit"
                              className="rounded-md border border-orange-200 bg-white p-1.5 text-orange-600 shadow-sm transition hover:border-orange-300 hover:bg-orange-50"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}
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

      {viewing && <InvoiceDetailPopup invoice={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
};

export default InvoiceApprovalList;
