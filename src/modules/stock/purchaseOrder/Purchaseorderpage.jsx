"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import POCreateView from "./Pocreateview";
import PODetailsView from "./Podetailsview";
import Pagination from "@/shared/ui/pagination/Pagination";

const INTERNAL_COMPANIES_URL =
  "https://gist.githubusercontent.com/SurajSingh7/ac8ffea18746e9fea058db22054bd3f3/raw/internal-companies.json";

const money = (n) => `\u20B9${Number(n || 0).toLocaleString("en-IN")}`;
const fmt = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "\u2014");
const inputCls = "w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500";

const STATUS_META = {
  PO_PENDING: { label: "PO Pending", cls: "bg-amber-50 text-amber-700", border: "border-l-amber-400" },
  GENERATED: { label: "PO Generated", cls: "bg-blue-50 text-blue-700", border: "border-l-blue-400" },
  APPROVED: { label: "PO Approved", cls: "bg-green-50 text-green-700", border: "border-l-green-400" },
  REJECTED: { label: "PO Rejected", cls: "bg-red-50 text-red-600", border: "border-l-red-400" },
  SENT: { label: "Sent", cls: "bg-indigo-50 text-indigo-700", border: "border-l-indigo-400" },
};

/* ============================================================= */
/* Portal Modal — fixed to viewport, centered, scroll-locked      */
/* ============================================================= */

const Modal = ({ onClose, title, children, maxWidth = "max-w-lg" }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4" onMouseDown={onClose}>
      <div className={`max-h-[90vh] w-full ${maxWidth} overflow-y-auto rounded-xl bg-white p-5 shadow-2xl`} onMouseDown={(e) => e.stopPropagation()}>
        {title && (
          <div className="mb-3 flex items-center justify-between">
            <p className="text-base font-semibold text-gray-900">{title}</p>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body
  );
};

/* ============================================================= */
/* Searchable select                                              */
/* ============================================================= */

const SearchableSelect = ({ value, onChange, options, placeholder = "All", renderExtra }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const selected = options.find((o) => o.value === value);
  const filtered = options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} className={`${inputCls} flex items-center justify-between text-left`}>
        <span className={`truncate ${selected ? "text-gray-900" : "text-gray-400"}`}>{selected ? selected.label : placeholder}</span>
        <span className="ml-2 shrink-0 text-gray-400">▾</span>
      </button>
      {open && (
        <div className="absolute z-40 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…"
            className="w-full border-b border-gray-100 px-3 py-2 text-sm focus:outline-none" />
          <div className="max-h-56 overflow-y-auto py-1">
            <button type="button" onClick={() => { onChange(""); setOpen(false); setQ(""); }}
              className="block w-full px-3 py-1.5 text-left text-sm text-gray-500 hover:bg-gray-50">{placeholder}</button>
            {filtered.map((o) => (
              <div key={o.value} className="flex items-center gap-1 px-2 hover:bg-gray-50">
                <button type="button" onClick={() => { onChange(o.value); setOpen(false); setQ(""); }}
                  className="flex-1 truncate px-1 py-1.5 text-left text-sm text-gray-800">{o.label}</button>
                {renderExtra && renderExtra(o)}
              </div>
            ))}
            {filtered.length === 0 && <p className="px-3 py-2 text-sm text-gray-400">No match</p>}
          </div>
        </div>
      )}
    </div>
  );
};

/* ============================================================= */
/* Popups (all via portal Modal)                                  */
/* ============================================================= */

const ProductsPopup = ({ row, onClose }) => {
  const [openPath, setOpenPath] = useState(null);
  const leafOf = (c) => String(c || "").split("/").pop().trim();
  return (
    <Modal onClose={onClose} title={`${row.vendorName} · ${row.items.length} items`}>
      <div className="overflow-hidden rounded-lg border border-gray-100">
        <div className="grid grid-cols-[1fr_1fr_40px_70px_44px_70px_80px] gap-2 bg-gray-50 px-3 py-2 text-[11px] text-gray-500">
          <span>Category</span><span>Product</span><span className="text-right">Qty</span><span className="text-right">Rate</span>
          <span className="text-right">GST</span><span className="text-right">GST₹</span><span className="text-right">Total</span>
        </div>
        {row.items.map((it, i) => (
          <div key={i} className="border-t border-gray-100">
            <div className="grid grid-cols-[1fr_1fr_40px_70px_44px_70px_80px] items-center gap-2 px-3 py-2 text-sm">
              <span className="flex items-center gap-1 text-gray-900">
                <span className="truncate">{leafOf(it.categoryName)}</span>
                <button type="button" title="View full path" onClick={() => setOpenPath(openPath === i ? null : i)}
                  className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-indigo-600">👁</button>
              </span>
              <span className="truncate font-medium text-gray-900">{it.productName}</span>
              <span className="text-right">{it.quantity}</span>
              <span className="text-right">{Number(it.unitPrice).toLocaleString("en-IN")}</span>
              <span className="text-right">{it.gstRate}%</span>
              <span className="text-right">{Number(it.gstAmount).toLocaleString("en-IN")}</span>
              <span className="text-right">{Number(it.lineTotal).toLocaleString("en-IN")}</span>
            </div>
            {openPath === i && (
              <p className="bg-indigo-50 px-3 py-1.5 text-xs text-indigo-700">Path: {it.categoryName}</p>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
};

const InfoPopup = ({ row, onClose }) => (
  <Modal onClose={onClose} title="Skipped products">
    <div className="space-y-2">
      {row.skipped.map((s, i) => (
        <div key={i} className="rounded-lg bg-amber-50 px-3 py-2 text-sm">
          <p className="font-medium text-gray-900">{s.productName} <span className="font-normal text-gray-500">· {s.categoryName} · qty {s.quantity}</span></p>
          <p className="text-xs text-amber-700">Reason: {s.poSkipReason || "\u2014"}</p>
        </div>
      ))}
    </div>
  </Modal>
);

const ReviewPopup = ({ row, onClose, onDone }) => {
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState(null);
  const act = async (path, body) => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`${API_BACKEND_URL}/stock/purchase-orders/${row.poId}/${path}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed");
      onDone();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return (
    <Modal onClose={onClose} title={`Review ${row.poNumber}`}>
      {error && <div className="mb-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="mb-3 grid grid-cols-2 gap-3 text-sm">
        <div><p className="text-[11px] uppercase text-gray-400">Vendor</p><p className="text-gray-900">{row.vendorName}</p></div>
        <div><p className="text-[11px] uppercase text-gray-400">Amount</p><p className="text-gray-900">{money(row.totalAmount)}</p></div>
        <div><p className="text-[11px] uppercase text-gray-400">Items</p><p className="text-gray-900">{row.items.length}</p></div>
        <div><p className="text-[11px] uppercase text-gray-400">Entity</p><p className="text-gray-900">{row.entityAlias || "\u2014"}</p></div>
      </div>
      {rejecting ? (
        <>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" className={`${inputCls} mb-2`} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setRejecting(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600">Cancel</button>
            <button type="button" disabled={busy} onClick={() => act("reject", { rejectedReason: reason })} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">Confirm reject</button>
          </div>
        </>
      ) : (
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setRejecting(true)} className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50">Reject</button>
          <button type="button" disabled={busy} onClick={() => act("approve")} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60">Approve</button>
        </div>
      )}
    </Modal>
  );
};

const NotRequiredPopup = ({ row, quotationId, onClose, onDone }) => {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal onClose={onClose} title="Mark as Not Required">
      <p className="mb-3 text-xs text-gray-500">PO creation for <span className="font-medium text-gray-700">{row.vendorName}</span> will be turned off for this quotation.</p>
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)" className={`${inputCls} mb-3 min-h-[70px]`} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600">Cancel</button>
        <button type="button" disabled={busy || !reason.trim()} onClick={async () => {
          setBusy(true);
          await fetch(`${API_BACKEND_URL}/stock/quotations/${quotationId}/disable-vendor`, {
            method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
            body: JSON.stringify({ vendorId: row.vendorId, reason: reason.trim() }),
          });
          setBusy(false); onDone();
        }} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Mark Not Required</button>
      </div>
    </Modal>
  );
};

/* ============================================================= */
/* Action bar                                                     */
/* ============================================================= */

const ActBtn = ({ label, enabled, tone = "gray", onClick }) => {
  const toneCls =
    tone === "indigo" ? "text-indigo-600 border-indigo-200 hover:bg-indigo-50"
    : tone === "green" ? "text-green-700 border-green-200 hover:bg-green-50"
    : tone === "amber" ? "text-amber-700 border-amber-200 hover:bg-amber-50"
    : tone === "red" ? "text-red-600 border-red-200 hover:bg-red-50"
    : "text-gray-600 border-gray-200 hover:bg-gray-50";
  return (
    <button type="button" disabled={!enabled} onClick={onClick} title={label}
      className={`rounded-md border px-2 py-1 text-[11px] font-medium ${enabled ? toneCls : "cursor-not-allowed border-gray-100 text-gray-300"}`}>
      {label}
    </button>
  );
};

const ActionBar = ({ row, on }) => {
  const s = row.status;
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {row.disabled ? (
        <ActBtn label="Enable" enabled tone="gray" onClick={() => on("enable", row)} />
      ) : (
        <ActBtn label="Create PO" enabled={s === "PO_PENDING" && row.items.length > 0} tone="indigo" onClick={() => on("create", row)} />
      )}
      <ActBtn label="View PO" enabled={s === "GENERATED" || s === "APPROVED"} tone="indigo" onClick={() => on("view", row)} />
      <ActBtn label="Review PO" enabled={s === "GENERATED"} tone="amber" onClick={() => on("review", row)} />
      <ActBtn label="Edit PO" enabled={s === "REJECTED"} tone="red" onClick={() => on("edit", row)} />
      <ActBtn label="Details" enabled tone="gray" onClick={() => on("details", row)} />
      <ActBtn label="Send PO" enabled={false} tone="green" onClick={() => {}} />
      {!row.disabled && <ActBtn label="Not Required" enabled={s === "PO_PENDING"} tone="red" onClick={() => on("notRequired", row)} />}
      <ActBtn label="Info" enabled={row.skipped?.length > 0} tone="gray" onClick={() => on("info", row)} />
    </div>
  );
};

/* ============================================================= */
/* Main                                                           */
/* ============================================================= */

const PurchaseOrderPage = () => {
  const [view, setView] = useState({ mode: "board" });
  const [board, setBoard] = useState([]);
  const [counts, setCounts] = useState({ ALL: 0, PO_PENDING: 0, GENERATED: 0, APPROVED: 0, REJECTED: 0 });
  const [entities, setEntities] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [popup, setPopup] = useState(null);
  const [pathModal, setPathModal] = useState(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [vendorF, setVendorF] = useState("");
  const [categoryF, setCategoryF] = useState("");
  const [productF, setProductF] = useState("");
  const [entityF, setEntityF] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });

  // debounce the search box so we don't fire a request per keystroke
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(id);
  }, [search]);

  // ALL filtering is server-side — every filter goes as a query param (Rule 23).
  const loadBoard = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (vendorF) params.set("vendorId", vendorF);
      if (categoryF) params.set("categoryId", categoryF);
      if (productF) params.set("productId", productF);
      if (entityF) params.set("entityAlias", entityF);
      if (status) params.set("status", status);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      params.set("page", String(page));
      params.set("limit", String(limit));
      const res = await fetch(`${API_BACKEND_URL}/stock/purchase-orders/board?${params.toString()}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to load board");
      setBoard(json.data?.board || []);
      setCounts(json.data?.counts || { ALL: 0, PO_PENDING: 0, GENERATED: 0, APPROVED: 0, REJECTED: 0 });
      setPagination(json.pagination || { total: 0, totalPages: 1 });
    } catch (e) { setError(e.message); setBoard([]); } finally { setLoading(false); }
  }, [debouncedSearch, vendorF, categoryF, productF, entityF, status, dateFrom, dateTo, page, limit]);

  // refetch whenever any filter changes
  useEffect(() => { loadBoard(); }, [loadBoard]);

  // reference data for the dropdown options (all from backend list endpoints)
  useEffect(() => {
    (async () => {
      try { const r = await fetch(INTERNAL_COMPANIES_URL); const j = await r.json();
        setEntities((j.data || []).filter((e) => e.isActive !== false && e.isShownOnDropDown !== false)); } catch {}
      try { const r = await fetch(`${API_BACKEND_URL}/stock/vendors?limit=1000`, { credentials: "include" });
        const j = await r.json(); if (j.success) setVendors(j.data || []); } catch {}
      try { const r = await fetch(`${API_BACKEND_URL}/stock/categories/flat?type=LEAF&limit=500`, { credentials: "include" });
        const j = await r.json(); if (j.success) setCategories(j.data || []); } catch {}
      try { const r = await fetch(`${API_BACKEND_URL}/stock/product-definitions?limit=1000`, { credentials: "include" });
        const j = await r.json(); if (j.success) setProducts(j.data || []); } catch {}
    })();
  }, []);

  const aliases = useMemo(() => [...new Set(entities.map((e) => e.alias).filter(Boolean))], [entities]);

  const vendorOptions = useMemo(() => vendors.map((v) => ({ value: v._id, label: v.name })), [vendors]);

  // only leaf categories that contain at least one product
  const categoryOptions = useMemo(() => {
    const withProducts = new Set(products.map((p) => String(p.categoryId)));
    return categories
      .filter((c) => withProducts.has(String(c._id)))
      .map((c) => ({ value: c._id, label: c.name, path: c.displayPath || c.name }));
  }, [categories, products]);

  const productOptions = useMemo(() => products.map((p) => ({ value: p._id, label: p.name })), [products]);
  const entityOptions = useMemo(() => aliases.map((a) => ({ value: a, label: a })), [aliases]);

  // board already filtered by the backend
  const shown = board;

  const refresh = () => { loadBoard(); setPopup(null); setView({ mode: "board" }); };

  const onAction = (type, row, q) => {
    if (type === "enable") {
      fetch(`${API_BACKEND_URL}/stock/quotations/${q.sourceQuotationId}/enable-vendor`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ vendorId: row.vendorId }),
      }).then(loadBoard);
      return;
    }
    if (type === "create") return setView({ mode: "create", sourceQuotationId: q.sourceQuotationId, vendorId: row.vendorId, vendorName: row.vendorName, vendorStateCode: row.stateCode, items: row.items });
    if (type === "edit") return setView({ mode: "edit", poId: row.poId, vendorName: row.vendorName, vendorStateCode: row.stateCode });
    if (type === "view") return setView({ mode: "view", poId: row.poId });
    if (type === "details") return setView({ mode: "details", poId: row.poId, row, quotationNumber: q.quotationNumber, quotationApprovalDate: q.quotationApprovalDate });
    if (type === "review") return setPopup({ type: "review", row });
    if (type === "info") return setPopup({ type: "info", row });
    if (type === "notRequired") return setPopup({ type: "notRequired", row, quotationId: q.sourceQuotationId });
  };

  if (view.mode === "create" || view.mode === "edit")
    return <POCreateView mode={view.mode} context={view} onBack={() => setView({ mode: "board" })} onDone={refresh} />;
  if (view.mode === "details")
    return <PODetailsView context={view} onBack={() => setView({ mode: "board" })} />;
  if (view.mode === "view") {
    const pdfUrl = `${API_BACKEND_URL}/stock/purchase-orders/${view.poId}/pdf`;
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="mb-4 flex items-center gap-3">
          <button onClick={() => setView({ mode: "board" })} className="rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">&larr; Back</button>
          <h1 className="text-lg font-semibold text-gray-900">View PO</h1>
          <a href={pdfUrl} target="_blank" rel="noreferrer" className="ml-auto rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">Open PDF</a>
        </div>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
          <iframe title="PO PDF" src={pdfUrl} className="h-[720px] w-full" />
        </div>
      </div>
    );
  }

  const tabs = [
    { key: "", label: "All", count: counts.ALL },
    { key: "PO_PENDING", label: "PO Pending", count: counts.PO_PENDING },
    { key: "GENERATED", label: "PO Generated", count: counts.GENERATED },
    { key: "APPROVED", label: "PO Approved", count: counts.APPROVED },
    { key: "REJECTED", label: "PO Rejected", count: counts.REJECTED },
  ];

  return (
    <div className="p-6">
      {/* filters */}
      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by Quotation No, PO No, Vendor, Product…" className={inputCls} />
          </div>
          <SearchableSelect value={vendorF} onChange={(v) => { setVendorF(v); setPage(1); }} options={vendorOptions} placeholder="All Vendors" />
          <SearchableSelect
            value={categoryF} onChange={(v) => { setCategoryF(v); setPage(1); }} options={categoryOptions} placeholder="All Categories"
            renderExtra={(o) => (
              <button type="button" title="View full path" onClick={(e) => { e.stopPropagation(); setPathModal(o); }}
                className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-indigo-600">👁</button>
            )}
          />
          <SearchableSelect value={productF} onChange={(v) => { setProductF(v); setPage(1); }} options={productOptions} placeholder="All Products" />
          <SearchableSelect value={entityF} onChange={(v) => { setEntityF(v); setPage(1); }} options={entityOptions} placeholder="All Entities" />
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div><label className="mb-1 block text-[11px] uppercase text-gray-500">Start date</label><input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className={inputCls} /></div>
          <div><label className="mb-1 block text-[11px] uppercase text-gray-500">End date</label><input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className={inputCls} /></div>
          <button type="button" onClick={() => { setSearch(""); setVendorF(""); setCategoryF(""); setProductF(""); setEntityF(""); setDateFrom(""); setDateTo(""); setStatus(""); setPage(1); }}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Clear filters</button>
        </div>
      </div>

      {/* status tabs */}
      <div className="mb-5 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button key={t.key} type="button" onClick={() => { setStatus(t.key); setPage(1); }}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium ${status === t.key ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>
            {t.label} <span className="ml-1 rounded-full bg-gray-100 px-1.5 text-xs text-gray-600">{t.count}</span>
          </button>
        ))}
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-xl bg-gray-100" />)}</div>
      ) : shown.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-12 text-center text-sm text-gray-500">No records found.</div>
      ) : (
        <div className="space-y-5">
          {shown.map((q) => (
            <div key={q.sourceQuotationId} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-500">Quotation No:</span>
                  <span className="text-sm font-semibold text-indigo-600">{q.quotationNumber}</span>
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">{q.vendorCount} Vendor{q.vendorCount > 1 ? "s" : ""}</span>
                </div>
                <span className="text-xs text-gray-500">Approval Date: <span className="font-medium text-gray-700">{fmt(q.quotationApprovalDate)}</span></span>
              </div>

              <div className="hidden grid-cols-[1.4fr_1fr_0.8fr_1fr_0.8fr_1fr_0.6fr_2.2fr] gap-2 px-5 py-2 text-[11px] uppercase tracking-wide text-gray-400 lg:grid">
                <span>Vendor</span><span>PO Number</span><span>Products</span><span className="text-right">Total</span><span className="text-right">Qty</span><span>Status</span><span>Entity</span><span className="text-right">Action</span>
              </div>

              {q.rows.map((row) => {
                const m = STATUS_META[row.status] || {};
                return (
                  <div key={row.vendorId} className={`grid grid-cols-1 gap-2 border-t border-gray-100 border-l-4 ${m.border || "border-l-gray-200"} px-5 py-3 lg:grid-cols-[1.4fr_1fr_0.8fr_1fr_0.8fr_1fr_0.6fr_2.2fr] lg:items-center`}>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{row.vendorName}</p>
                      <p className="text-xs text-gray-500">📞 {row.phone || "\u2014"}</p>
                    </div>
                    <div className="text-sm font-medium text-indigo-600">{row.poNumber || "\u2014"}</div>
                    <div>
                      <button type="button" onClick={() => setPopup({ type: "products", row })} className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50">
                        {row.items.length} Item{row.items.length > 1 ? "s" : ""} ▾
                      </button>
                    </div>
                    <div className="text-sm font-medium text-gray-900 lg:text-right">{money(row.totalAmount)}</div>
                    <div className="text-sm text-gray-700 lg:text-right">{row.totalQuantity}</div>
                    <div><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${m.cls}`}>{m.label}</span></div>
                    <div className="text-sm font-medium text-gray-700">{row.entityAlias || "\u2014"}</div>
                    <ActionBar row={row} on={(type, r) => onAction(type, r, q)} />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* pagination */}
      {!loading && pagination.total > 0 && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-gray-500">
            Showing {(page - 1) * limit + 1} to {Math.min(page * limit, pagination.total)} of {pagination.total} entries
          </p>
          <Pagination
            currentPage={page}
            totalItems={pagination.total}
            itemsPerPage={limit}
            onPageChange={setPage}
            onItemsPerPageChange={(n) => { setLimit(n); setPage(1); }}
          />
        </div>
      )}

      {/* popups (portal) */}
      {popup?.type === "products" && <ProductsPopup row={popup.row} onClose={() => setPopup(null)} />}
      {popup?.type === "info" && <InfoPopup row={popup.row} onClose={() => setPopup(null)} />}
      {popup?.type === "review" && <ReviewPopup row={popup.row} onClose={() => setPopup(null)} onDone={refresh} />}
      {popup?.type === "notRequired" && <NotRequiredPopup row={popup.row} quotationId={popup.quotationId} onClose={() => setPopup(null)} onDone={refresh} />}
      {pathModal && (
        <Modal onClose={() => setPathModal(null)} title={pathModal.label} maxWidth="max-w-md">
          <p className="text-[11px] uppercase text-gray-400">Full category path</p>
          <p className="mt-1 text-sm text-gray-900">{pathModal.path}</p>
        </Modal>
      )}
    </div>
  );
};

export default PurchaseOrderPage;