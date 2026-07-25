"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import Pagination from "@/shared/ui/pagination/Pagination";
import useInternalEntities from "@/modules/stock/shared/useInternalEntities";
import StatusTracker, { stageIndexForStatus } from "./StatusTracker";
import { RotateCcw, Search, ChevronDown, X, Phone, PlusCircle, Ban } from "lucide-react";

const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const fmt = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";
const labelCls = "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700";

// Same pill-style date field as the PO Approval page's date range filter.
const DateField = ({ label, value, onChange }) => (
  <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
    <span className="whitespace-nowrap text-sm font-semibold text-slate-700">{label}</span>
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-[150px] rounded-lg border border-slate-200 bg-white py-1.5 px-3 text-sm text-slate-900 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
    />
  </div>
);

const STATUS_META = {
  ENTITY_PENDING: { label: "Entity Pending", badge: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500", border: "border-l-amber-400" },
  PO_PENDING: { label: "PO Pending", badge: "bg-orange-50 text-orange-700 ring-orange-200", dot: "bg-orange-500", border: "border-l-orange-400" },
  PO_GENERATED: { label: "PO Generated", badge: "bg-sky-50 text-sky-700 ring-sky-200", dot: "bg-sky-500", border: "border-l-sky-400" },
  PO_APPROVED: { label: "PO Approved", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500", border: "border-l-emerald-400" },
  MATERIAL_PENDING: { label: "Material Pending", badge: "bg-indigo-50 text-indigo-700 ring-indigo-200", dot: "bg-indigo-500", border: "border-l-indigo-400" },
  REJECTED: { label: "PO Rejected", badge: "bg-rose-50 text-rose-700 ring-rose-200", dot: "bg-rose-500", border: "border-l-rose-400" },
  NOT_REQUIRED: { label: "Not Required", badge: "bg-slate-100 text-slate-500 ring-slate-200", dot: "bg-slate-400", border: "border-l-slate-300" },
};

const TAB_LIST = [
  { key: "", label: "All" },
  { key: "ENTITY_PENDING", label: "Entity Pending" },
  { key: "PO_PENDING", label: "PO Pending" },
  { key: "PO_GENERATED", label: "PO Generated" },
  { key: "PO_APPROVED", label: "PO Approved" },
  { key: "MATERIAL_PENDING", label: "Material Pending" },
];

const DEFAULT_COUNTS = {
  ALL: 0, ENTITY_PENDING: 0, PO_PENDING: 0, PO_GENERATED: 0,
  PO_APPROVED: 0, MATERIAL_PENDING: 0, REJECTED: 0, NOT_REQUIRED: 0,
};

/* ============================================================= */
/* Searchable status filter — same pattern as the PO Approval     */
/* page's Vendor/Category/Product dropdowns, with a count chip.   */
/* ============================================================= */

const SearchableSelect = ({ value, onChange, options, placeholder = "All" }) => {
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
    <div className="relative w-full sm:w-64" ref={ref}>
      <button
        type="button" onClick={() => setOpen((o) => !o)}
        className={`${inputCls} flex items-center justify-between text-left`}
      >
        <span className={`truncate ${selected ? "text-slate-900" : "text-slate-500"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <span className={`ml-2 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}>
          <ChevronDown className="h-4 w-4" />
        </span>
      </button>
      {open && (
        <div className="absolute z-40 mt-1.5 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg ring-1 ring-slate-900/5">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3">
            <span className="text-slate-400"><Search className="h-4 w-4" /></span>
            <input
              autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search status..."
              className="w-full py-2.5 text-sm placeholder:text-slate-400 focus:outline-none"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.map((o) => (
              <button
                key={o.value || "all"}
                type="button" onClick={() => { onChange(o.value); setOpen(false); setQ(""); }}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition hover:bg-indigo-50/60 ${o.value === value ? "bg-indigo-50 text-indigo-700" : "text-slate-700"}`}
              >
                <span className="truncate">{o.label}</span>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-500">
                  {o.count}
                </span>
              </button>
            ))}
            {filtered.length === 0 && <p className="px-3 py-2.5 text-sm text-slate-400">No match</p>}
          </div>
        </div>
      )}
    </div>
  );
};

/* ============================================================= */
/* Portal Modal — same pattern as PO Approval page                */
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className={`max-h-full w-full ${maxWidth} overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/5`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
            <p className="text-base font-semibold tracking-tight text-slate-900">{title}</p>
            <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body
  );
};

/* ============================================================= */
/* Popups                                                         */
/* ============================================================= */

const ProductsPopup = ({ row, onClose }) => {
  const itemTh = "px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600";
  const itemThRight = `${itemTh} text-right`;
  const itemTd = "px-3 py-2 text-sm text-slate-700";
  const itemTdRight = `${itemTd} text-right tabular-nums`;
  return (
    <Modal onClose={onClose} title={`${row.vendorName} · ${row.items.length} items`} maxWidth="max-w-2xl">
      <div className="overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full min-w-full border-collapse">
          <thead className="bg-slate-50">
            <tr>
              <th className={itemTh}>Category</th>
              <th className={itemTh}>Product</th>
              <th className={itemThRight}>Qty</th>
              <th className={itemThRight}>Rate</th>
              <th className={itemThRight}>Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {row.items.map((it, i) => (
              <tr key={i} className="transition hover:bg-slate-50/60">
                <td className={itemTd}>{it.categoryName}</td>
                <td className={`${itemTd} font-medium text-slate-900`}>{it.productName}</td>
                <td className={itemTdRight}>{it.quantity}</td>
                <td className={itemTdRight}>{Number(it.unitPrice).toLocaleString("en-IN")}</td>
                <td className={`${itemTdRight} font-medium text-slate-900`}>{Number(it.lineTotal).toLocaleString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
};

const AddEntityPopup = ({ row, onClose, onDone }) => {
  const { entities, aliases, loading } = useInternalEntities();
  const [alias, setAlias] = useState("");
  const [entityId, setEntityId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const statesForAlias = entities.filter((e) => e.alias === alias);
  const selectedEntity = entities.find((e) => String(e._id) === String(entityId)) || null;

  // As soon as the entity list loads, default Entity + State to whichever
  // record matches this vendor's own state (falling back to the very first
  // entity) — same auto-pick PO creation used to do — so the popup opens
  // pre-filled instead of requiring a manual Entity click first.
  useEffect(() => {
    if (!entities.length || alias) return;
    const match = entities.find((e) => String(e.stateCode) === String(row.vendorStateCode)) || entities[0];
    if (match) {
      setAlias(match.alias);
      setEntityId(String(match._id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entities]);

  // State auto-fills from the vendor's own state when the chosen entity has
  // a matching state option, else falls back to that entity's first state.
  const onAliasChange = (a) => {
    setAlias(a);
    const list = entities.filter((e) => e.alias === a);
    const match = list.find((e) => String(e.stateCode) === String(row.vendorStateCode)) || list[0];
    setEntityId(match ? String(match._id) : "");
  };

  const submit = async () => {
    if (!selectedEntity) return setError("Select entity and state");
    setBusy(true); setError(null);
    try {
      const res = await fetch(`${API_BACKEND_URL}/stock/tracking-orders/${row.trackingOrderId}/entity`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({
          entityId: selectedEntity._id, name: selectedEntity.name, alias: selectedEntity.alias,
          gstNumber: selectedEntity.gstNumber, address: selectedEntity.address,
          state: selectedEntity.state, stateCode: selectedEntity.stateCode,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to assign entity");
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} title={`Add Entity · ${row.vendorName}`}>
      {error && <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-100">{error}</div>}
      {loading ? (
        <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Entity</label>
            <select value={alias} onChange={(e) => onAliasChange(e.target.value)} className={inputCls}>
              <option value="">Select entity</option>
              {aliases.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>State</label>
            <select value={entityId} onChange={(e) => setEntityId(e.target.value)} className={inputCls} disabled={!alias}>
              <option value="">Select state</option>
              {statesForAlias.map((e) => (
                <option key={e._id} value={e._id}>{e.state} - {e.stateCode}</option>
              ))}
            </select>
          </div>
        </div>
      )}
      <div className="mt-5 flex justify-end gap-2.5">
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50">Cancel</button>
        <button
          type="button" disabled={busy || !selectedEntity} onClick={submit}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save entity"}
        </button>
      </div>
    </Modal>
  );
};

const NotRequiredPopup = ({ row, onClose, onDone }) => {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  return (
    <Modal onClose={onClose} title="Mark as Not Required">
      {error && <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-100">{error}</div>}
      <p className="mb-3 text-sm text-slate-600">
        PO creation for <span className="font-medium text-slate-800">{row.vendorName}</span> will be turned off for this quotation.
      </p>
      <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)" className={`${inputCls} mb-4`} />
      <div className="flex justify-end gap-2.5">
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50">Cancel</button>
        <button
          type="button" disabled={busy || !reason.trim()}
          onClick={async () => {
            setBusy(true); setError(null);
            try {
              const res = await fetch(`${API_BACKEND_URL}/stock/tracking-orders/${row.trackingOrderId}/not-required`, {
                method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
                body: JSON.stringify({ reason: reason.trim() }),
              });
              const json = await res.json();
              if (!res.ok || !json.success) throw new Error(json.message || "Failed");
              onDone();
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Saving…" : "Mark Not Required"}
        </button>
      </div>
    </Modal>
  );
};

/* ============================================================= */
/* Main                                                           */
/* ============================================================= */

const TrackingOrdersComp = () => {
  const [board, setBoard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [popup, setPopup] = useState(null);
  const [hoveredStage, setHoveredStage] = useState(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [counts, setCounts] = useState(DEFAULT_COUNTS);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(id);
  }, [search]);

  const loadBoard = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (status) params.set("status", status);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      params.set("page", String(page));
      params.set("limit", String(limit));

      const res = await fetch(`${API_BACKEND_URL}/stock/tracking-orders/board?${params.toString()}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to load tracking orders");

      setBoard(json.data?.board || []);
      setCounts(json.data?.counts || DEFAULT_COUNTS);
      setPagination(json.pagination || { total: 0, totalPages: 1 });
    } catch (e) {
      setError(e.message); setBoard([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, status, dateFrom, dateTo, page, limit]);

  useEffect(() => { loadBoard(); }, [loadBoard]);

  const refresh = () => { loadBoard(); setPopup(null); };
  const hasActiveFilters = !!search || !!status || !!dateFrom || !!dateTo;
  const clearFilters = () => { setSearch(""); setStatus(""); setDateFrom(""); setDateTo(""); setPage(1); };

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Tracking Orders</h1>
        <p className="mt-0.5 text-sm text-slate-600">Follow every vendor order from entity assignment through to material pending.</p>
      </div>

      <StatusTracker activeStage={hoveredStage} />

      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="relative lg:w-80">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400"><Search className="h-4 w-4" /></span>
          <input
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search quotation no, PO no, vendor, product..."
            className={`${inputCls} pl-9`}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SearchableSelect
            value={status}
            onChange={(v) => { setStatus(v); setPage(1); }}
            placeholder="All statuses"
            options={TAB_LIST.map((t) => ({
              value: t.key,
              label: t.label,
              count: t.key ? counts[t.key] ?? 0 : counts.ALL,
            }))}
          />
          <DateField label="From:" value={dateFrom} onChange={(v) => { setDateFrom(v); setPage(1); }} />
          <DateField label="To:" value={dateTo} onChange={(v) => { setDateTo(v); setPage(1); }} />
          {hasActiveFilters && (
            <button
              type="button" onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-50 px-3.5 py-1.5 text-sm font-semibold text-rose-600 shadow-sm transition hover:border-rose-400 hover:bg-rose-100"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
          )}
        </div>
      </div>

      {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      {loading ? (
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-100" />)}</div>
      ) : board.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-16 text-center">
          <p className="text-sm font-medium text-slate-700">No tracking orders found</p>
          <p className="mt-1 text-sm text-slate-500">Approve or partially approve a quotation to see vendor orders here.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {board.map((q) => (
            <div key={q.sourceQuotationId} className="overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-2xl border-b border-slate-100 bg-slate-50/60 px-5 py-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Quotation No:</span>
                  <span className="text-sm font-semibold text-indigo-600">{q.quotationNumber}</span>
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600 ring-1 ring-inset ring-indigo-100">
                    {q.vendorCount} vendor{q.vendorCount > 1 ? "s" : ""}
                  </span>
                </div>
                <span className="text-xs font-bold text-slate-600">
                  Approved: <span className="font-medium text-slate-900">{fmt(q.quotationApprovalDate)}</span>
                </span>
              </div>

              <div className="hidden grid-cols-12 gap-2 px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-700 lg:grid">
                <span className="col-span-2">Vendor</span>
                <span className="col-span-2">PO No</span>
                <span className="col-span-1">Products</span>
                <span className="col-span-1 text-right">Total</span>
                <span className="col-span-1 text-right">Qty</span>
                <span className="col-span-2">Status</span>
                <span className="col-span-1">Entity</span>
                <span className="col-span-2 text-right">Actions</span>
              </div>

              {q.rows.map((row) => {
                const m = STATUS_META[row.status] || {};
                const stage = stageIndexForStatus(row.status);
                return (
                  <div
                    key={row.vendorId}
                    onMouseEnter={() => setHoveredStage(stage)}
                    onMouseLeave={() => setHoveredStage(null)}
                    className={`grid grid-cols-1 gap-2 border-t border-slate-100 border-l-4 ${m.border || "border-l-slate-200"} px-5 py-3.5 transition hover:bg-slate-50/50 lg:grid-cols-12 lg:items-center`}
                  >
                    <div className="col-span-2 min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{row.vendorName}</p>
                      <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-500">
                        <Phone className="h-3 w-3" /> {row.phone || "—"}
                      </p>
                    </div>
                    <div className="col-span-2 truncate text-sm font-medium text-indigo-600">{row.poNumber || "—"}</div>
                    <div className="col-span-1">
                      <button
                        type="button" onClick={() => setPopup({ type: "products", row })}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        {row.items.length} item{row.items.length > 1 ? "s" : ""} <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="col-span-1 text-sm font-semibold text-slate-900 tabular-nums lg:text-right">{money(row.totalAmount)}</div>
                    <div className="col-span-1 text-sm text-slate-700 tabular-nums lg:text-right">{row.totalQuantity}</div>
                    <div className="col-span-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${m.badge || "bg-slate-50 text-slate-600 ring-slate-200"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${m.dot || "bg-slate-400"}`} />
                        {m.label || row.status}
                      </span>
                    </div>
                    <div className="col-span-1 truncate text-sm font-medium text-slate-700">{row.entityAlias || "—"}</div>
                    <div className="col-span-2 flex flex-wrap items-center justify-end gap-1.5">
                      {row.status === "ENTITY_PENDING" && (
                        <button
                          type="button" onClick={() => setPopup({ type: "addEntity", row })}
                          className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-white px-2 py-1 text-xs font-medium text-indigo-600 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
                        >
                          <PlusCircle className="h-3.5 w-3.5" /> Add Entity
                        </button>
                      )}
                      {(row.status === "ENTITY_PENDING" || row.status === "PO_PENDING") && (
                        <button
                          type="button" onClick={() => setPopup({ type: "notRequired", row })}
                          className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-white px-2 py-1 text-xs font-medium text-rose-600 shadow-sm transition hover:border-rose-300 hover:bg-rose-50"
                        >
                          <Ban className="h-3.5 w-3.5" /> Not Required
                        </button>
                      )}
                      {row.mailResult?.mode && (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                          {row.mailResult.mode === "SENT" ? "Mail Sent (ERP)" : "Mail Sent (Manual)"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {!loading && pagination.total > 0 && (
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500 tabular-nums">
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

      {popup?.type === "products" && <ProductsPopup row={popup.row} onClose={() => setPopup(null)} />}
      {popup?.type === "addEntity" && <AddEntityPopup row={popup.row} onClose={() => setPopup(null)} onDone={refresh} />}
      {popup?.type === "notRequired" && <NotRequiredPopup row={popup.row} onClose={() => setPopup(null)} onDone={refresh} />}
    </div>
  );
};

export default TrackingOrdersComp;
