"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import Pagination from "@/shared/ui/pagination/Pagination";
import useInternalEntities from "@/modules/stock/shared/useInternalEntities";
import StatusTracker, { stageIndexForStatus } from "./StatusTracker";
import InvoiceReceiveView from "./InvoiceReceiveView";
import { RotateCcw, Search, ChevronDown, X, PlusCircle, Ban, ClipboardList, Eye, MoreVertical, Info, ArrowLeft, Download, FileText } from "lucide-react";

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

// `badge`/`dot` = soft ring style (filter dropdown, small chips).
// `pill` = solid, colorful fill used on the card header — the punchy look.
const STATUS_META = {
  ENTITY_PENDING: { label: "Entity Pending", badge: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500", border: "border-l-amber-400", pill: "bg-amber-500 text-white" },
  PO_PENDING: { label: "PO Pending", badge: "bg-orange-50 text-orange-700 ring-orange-200", dot: "bg-orange-500", border: "border-l-orange-400", pill: "bg-orange-500 text-white" },
  PO_GENERATED: { label: "PO Generated", badge: "bg-sky-50 text-sky-700 ring-sky-200", dot: "bg-sky-500", border: "border-l-sky-400", pill: "bg-sky-500 text-white" },
  PO_APPROVED: { label: "PO Approved", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500", border: "border-l-emerald-400", pill: "bg-emerald-500 text-white" },
  PO_SENT: { label: "PO Sent", badge: "bg-orange-50 text-orange-700 ring-orange-200", dot: "bg-orange-500", border: "border-l-orange-400", pill: "bg-orange-500 text-white" },
  IN_PROGRESS: { label: "In Progress", badge: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500", border: "border-l-amber-400", pill: "bg-amber-500 text-white" },
  PARTIAL: { label: "Partial", badge: "bg-yellow-50 text-yellow-700 ring-yellow-200", dot: "bg-yellow-500", border: "border-l-yellow-400", pill: "bg-yellow-500 text-white" },
  COMPLETED: { label: "Completed", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500", border: "border-l-emerald-400", pill: "bg-emerald-500 text-white" },
  REJECTED: { label: "PO Rejected", badge: "bg-rose-50 text-rose-700 ring-rose-200", dot: "bg-rose-500", border: "border-l-rose-400", pill: "bg-rose-500 text-white" },
  NOT_REQUIRED: { label: "Not Required", badge: "bg-slate-100 text-slate-500 ring-slate-200", dot: "bg-slate-400", border: "border-l-slate-300", pill: "bg-slate-400 text-white" },
};

const TAB_LIST = [
  { key: "", label: "All" },
  { key: "ENTITY_PENDING", label: "Entity Pending" },
  { key: "PO_PENDING", label: "PO Pending" },
  { key: "PO_GENERATED", label: "PO Generated" },
  { key: "PO_APPROVED", label: "PO Approved" },
  { key: "PO_SENT", label: "PO Sent" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "PARTIAL", label: "Partial" },
  { key: "COMPLETED", label: "Completed" },
  { key: "REJECTED", label: "PO Rejected" },
  { key: "NOT_REQUIRED", label: "Not Required" },
];

const DEFAULT_COUNTS = {
  ALL: 0, ENTITY_PENDING: 0, PO_PENDING: 0, PO_GENERATED: 0,
  PO_APPROVED: 0, PO_SENT: 0, IN_PROGRESS: 0, PARTIAL: 0, COMPLETED: 0, REJECTED: 0, NOT_REQUIRED: 0,
};

// Add Items only while there's still something to receive.
const RECEIVABLE_STATUSES = new Set(["PO_SENT", "IN_PROGRESS", "PARTIAL"]);
// Overall Summary / Invoices are meaningful once the PO has been sent.
const RECEIVING_FLOW_STATUSES = new Set(["PO_SENT", "IN_PROGRESS", "PARTIAL", "COMPLETED"]);

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

// Matches the PO PDF's item table + summary layout — Sr/Description/Product/
// Qty/Basic Price/CGST/SGST(or IGST)/Amount, then a right-aligned totals
// block (Basic Price, CGST, SGST/IGST, Grand total).
const ProductsPopup = ({ row, onClose }) => {
  const itemTh = "px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600";
  const itemThRight = `${itemTh} text-right`;
  const itemTd = "px-3 py-2 text-sm text-slate-700";
  const itemTdRight = `${itemTd} text-right tabular-nums`;
  const isIgst = row.taxType === "IGST";
  const n = (v) => Number(v || 0).toLocaleString("en-IN");

  return (
    <Modal onClose={onClose} title={`${row.vendorName} · ${row.items.length} items`} maxWidth="max-w-3xl">
      <div className="overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full min-w-full border-collapse">
          <thead className="bg-slate-50">
            <tr>
              <th className={itemTh}>Sr.</th>
              <th className={itemTh}>Description</th>
              <th className={itemTh}>Product</th>
              <th className={itemThRight}>Qty</th>
              <th className={itemThRight}>Basic Price</th>
              {isIgst ? <th className={itemThRight}>IGST</th> : (
                <>
                  <th className={itemThRight}>CGST</th>
                  <th className={itemThRight}>SGST</th>
                </>
              )}
              <th className={itemThRight}>Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {row.items.map((it, i) => (
              <tr key={i} className="transition hover:bg-slate-50/60">
                <td className={itemTd}>{i + 1}</td>
                <td className={itemTd}>{it.categoryName}</td>
                <td className={`${itemTd} font-medium text-slate-900`}>{it.productName}</td>
                <td className={itemTdRight}>{it.quantity}</td>
                <td className={itemTdRight}>{n(it.taxable)}</td>
                {isIgst ? <td className={itemTdRight}>{n(it.igst)}</td> : (
                  <>
                    <td className={itemTdRight}>{n(it.cgst)}</td>
                    <td className={itemTdRight}>{n(it.sgst)}</td>
                  </>
                )}
                <td className={`${itemTdRight} font-medium text-slate-900`}>{n(it.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 ml-auto w-full max-w-[220px] space-y-1.5 text-sm">
        <div className="flex justify-between text-slate-500"><span>Basic Price</span><span className="tabular-nums">{money(row.subTotal)}</span></div>
        {isIgst ? (
          <div className="flex justify-between text-slate-500"><span>IGST</span><span className="tabular-nums">{money(row.igstTotal)}</span></div>
        ) : (
          <>
            <div className="flex justify-between text-slate-500"><span>CGST</span><span className="tabular-nums">{money(row.cgstTotal)}</span></div>
            <div className="flex justify-between text-slate-500"><span>SGST</span><span className="tabular-nums">{money(row.sgstTotal)}</span></div>
          </>
        )}
        <div className="flex justify-between border-t-2 border-slate-200 pt-1.5 font-bold text-slate-900">
          <span>Grand total</span><span className="tabular-nums">{money(row.totalAmount)}</span>
        </div>
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

const StatCard = ({ label, value, valueCls = "text-slate-900" }) => (
  <div className="rounded-xl bg-slate-50 px-4 py-3 text-center">
    <p className={`text-2xl font-bold tabular-nums ${valueCls}`}>{value}</p>
    <p className="mt-1 text-xs font-semibold text-slate-500">{label}</p>
  </div>
);

const StatusLine = ({ dot, label, count, pct }) => (
  <div className="flex items-center justify-between border-b border-slate-100 py-2 text-sm last:border-b-0">
    <span className="inline-flex items-center gap-2 text-slate-700">
      <span className={`h-2.5 w-2.5 rounded-full ${dot}`} /> {label}
    </span>
    <span className="font-semibold tabular-nums text-slate-900">{count} <span className="font-normal text-slate-400">({pct}%)</span></span>
  </div>
);

const OverallSummaryPopup = ({ row, invoices, onClose }) => {
  const orderedQty = row.totalQuantity;
  const receivedQty = row.receivedQuantity ?? 0;
  const pendingQty = row.pendingQuantity ?? Math.max(0, orderedQty - receivedQty);

  const invoiceQty = { APPROVED: 0, PENDING: 0, REJECTED: 0 };
  (invoices || []).forEach((inv) => {
    if (invoiceQty[inv.status] !== undefined) invoiceQty[inv.status] += inv.qtyReceived || 0;
  });
  const pctOf = (n) => (orderedQty > 0 ? Math.round((n / orderedQty) * 100) : 0);

  return (
    <Modal onClose={onClose} title={`Overall Summary - ${row.poNumber || row.vendorName}`} maxWidth="max-w-md">
      <div className="mb-5 grid grid-cols-3 gap-3">
        <StatCard label="Total Ordered Qty" value={orderedQty} />
        <StatCard label="Total Received Qty" value={receivedQty} valueCls="text-emerald-600" />
        <StatCard label="Total Pending Qty" value={pendingQty} valueCls="text-amber-600" />
      </div>

      <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">By Status</p>
      <StatusLine dot="bg-emerald-500" label="Approved" count={invoiceQty.APPROVED} pct={pctOf(invoiceQty.APPROVED)} />
      <StatusLine dot="bg-amber-500" label="Pending" count={invoiceQty.PENDING} pct={pctOf(invoiceQty.PENDING)} />
      <StatusLine dot="bg-rose-500" label="Rejected" count={invoiceQty.REJECTED} pct={pctOf(invoiceQty.REJECTED)} />

      <div className="mt-2 flex items-center justify-between border-t-2 border-slate-200 pt-2.5 text-sm">
        <span className="font-bold text-slate-900">Total</span>
        <span className="font-bold tabular-nums text-slate-900">{orderedQty} (100%)</span>
      </div>
    </Modal>
  );
};

const INVOICE_STATUS_META = {
  PENDING: { label: "Pending", badge: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500" },
  APPROVED: { label: "Approved", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  REJECTED: { label: "Rejected", badge: "bg-rose-50 text-rose-700 ring-rose-200", dot: "bg-rose-500" },
};

const InvoiceStatusBadge = ({ status }) => {
  const m = INVOICE_STATUS_META[status] || {};
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${m.badge || "bg-slate-50 text-slate-600 ring-slate-200"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot || "bg-slate-400"}`} />
      {m.label || status}
    </span>
  );
};

const InvoiceDetailPopup = ({ invoice, onClose }) => {
  const itemTh = "px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600";
  const itemThRight = `${itemTh} text-right`;
  const itemTd = "px-3 py-2 text-sm text-slate-700";
  const itemTdRight = `${itemTd} text-right tabular-nums`;
  return (
    <Modal onClose={onClose} title={`Invoice ${invoice.invoiceNumber}`} maxWidth="max-w-2xl">
      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date</p>
          <p className="mt-1 text-sm font-medium text-slate-900">{fmt(invoice.invoiceDate)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</p>
          <p className="mt-1 text-sm font-medium text-slate-900">{money(invoice.amount)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
          <div className="mt-1"><InvoiceStatusBadge status={invoice.status} /></div>
        </div>
        {invoice.invoiceFile && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Attachment</p>
            <a href={`${API_BACKEND_URL.replace(/\/api\/v1$/, "")}${invoice.invoiceFile}`} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm font-medium text-indigo-600 hover:underline">
              View file
            </a>
          </div>
        )}
      </div>
      {invoice.status === "REJECTED" && invoice.rejectedReason && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          Rejected: {invoice.rejectedReason}
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full min-w-full border-collapse">
          <thead className="bg-slate-50">
            <tr>
              <th className={itemTh}>Product</th>
              <th className={itemThRight}>Qty Received</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(invoice.lines || []).map((l, i) => (
              <tr key={i}>
                <td className={`${itemTd} font-medium text-slate-900`}>{l.productName}</td>
                <td className={itemTdRight}>{l.receivedQuantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {invoice.extraCharges?.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Extra Charges</p>
          <ul className="space-y-1 text-sm text-slate-700">
            {invoice.extraCharges.map((c, i) => (
              <li key={i} className="flex justify-between"><span>{c.note || "—"}</span><span className="tabular-nums">{money(c.amount)}</span></li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
};

/* Embedded (non-modal) invoice table — rendered directly inside the         */
/* Tracking Order card so approval status/qty is visible without a click.    */
const invTh = "px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600";
const invThRight = `${invTh} text-right`;
const invTd = "px-3 py-2.5 text-sm text-slate-700";
const invTdRight = `${invTd} text-right tabular-nums`;

// Dot + plain-text approval indicator (no pill background) — used inline in
// the invoice table, matching the approved reference look.
const APPROVAL_DOT_META = {
  PENDING: { label: "Pending", dot: "bg-amber-500", text: "text-slate-700" },
  APPROVED: { label: "Approved", dot: "bg-emerald-500", text: "text-slate-700" },
  REJECTED: { label: "Rejected", dot: "bg-rose-500", text: "text-slate-700" },
};
const ApprovalDot = ({ status }) => {
  const m = APPROVAL_DOT_META[status] || {};
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${m.text || "text-slate-700"}`}>
      <span className={`h-2 w-2 rounded-full ${m.dot || "bg-slate-400"}`} />
      {m.label || status}
    </span>
  );
};

// Items cell — "Product (qty), Product (qty)" plus a small "N Items" tag.
const ItemsCell = ({ lines }) => {
  const list = lines || [];
  const summary = list.map((l) => `${l.productName} (${l.receivedQuantity})`).join(", ");
  return (
    <div className="max-w-[240px]">
      <p className="truncate text-sm text-slate-700">{summary || "—"}</p>
      <span className="mt-0.5 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
        {list.length} Item{list.length === 1 ? "" : "s"}
      </span>
    </div>
  );
};

// Small icon-button row menu: Eye = View (direct), kebab = More (Edit when rejected).
const RowActionMenu = ({ invoice, onView, onEdit }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button" onClick={() => onView(invoice)} title="View"
        className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
      >
        <Eye className="h-3.5 w-3.5" />
      </button>
      {invoice.status === "REJECTED" && (
        <div className="relative" ref={ref}>
          <button
            type="button" onClick={() => setOpen((o) => !o)} title="More"
            className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </button>
          {open && (
            <div className="absolute right-0 z-20 mt-1 w-32 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              <button
                type="button" onClick={() => { setOpen(false); onEdit(invoice); }}
                className="block w-full px-3 py-1.5 text-left text-xs font-medium text-orange-600 hover:bg-orange-50"
              >
                Edit
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const InvoiceTableBlock = ({ invoices, loading, orderedQty, onView, onEdit }) => {
  if (loading) {
    return <div className="h-16 animate-pulse rounded-xl bg-slate-100" />;
  }
  if (invoices.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-700">
        <Info className="h-4 w-4 shrink-0" /> No invoice has been added yet.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-100">
      <table className="w-full min-w-full border-collapse">
        <thead className="bg-slate-50">
          <tr>
            <th className={invTh}>Invoice No</th>
            <th className={invTh}>Invoice Date</th>
            <th className={invTh}>Items</th>
            <th className={invThRight}>Qty</th>
            <th className={invThRight}>FOC</th>
            <th className={invThRight}>Basic Price</th>
            <th className={invThRight}>CGST</th>
            <th className={invThRight}>SGST</th>
            <th className={invThRight}>IGST</th>
            <th className={invThRight}>Extra</th>
            <th className={invThRight}>Total</th>
            <th className={invTh}>Status</th>
            <th className={invThRight}>Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {invoices.map((inv) => {
            const pct = orderedQty > 0 ? Math.round(((inv.qtyReceived || 0) / orderedQty) * 100) : 0;
            return (
              <tr key={inv._id} className="transition hover:bg-slate-50/60">
                <td className={`${invTd} font-semibold text-indigo-600`}>{inv.invoiceNumber}</td>
                <td className={invTd}>{fmt(inv.invoiceDate)}</td>
                <td className={invTd}><ItemsCell lines={inv.lines} /></td>
                <td className={invTdRight}>{inv.qtyReceived} </td>
                <td className={invTdRight}>{inv.focQtyReceived || 0}</td>
                <td className={invTdRight}>{money(inv.basicAmount)}</td>
                <td className={invTdRight}>{money(inv.cgstAmount)}</td>
                <td className={invTdRight}>{money(inv.sgstAmount)}</td>
                <td className={invTdRight}>{money(inv.igstAmount)}</td>
                <td className={invTdRight}>{money(inv.extraChargesTotal)}</td>
                <td className={`${invTdRight} font-semibold text-slate-900`}>{money(inv.grandTotal)}</td>
                <td className={invTd}><ApprovalDot status={inv.status} /></td>
                <td className={invTdRight}>
                  <RowActionMenu invoice={inv} onView={onView} onEdit={onEdit} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

/* ============================================================= */
/* Tracking Order card — one per vendor row, PO Number/Status      */
/* header, summary strip, and (once a PO exists) an embedded       */
/* invoice table — matches the approved card layout.               */
/* ============================================================= */

// Bold black label + colon, plain value — matches the approved card layout.
const SummaryField = ({ label, value, valueCls = "text-slate-900" }) => (
  <div className="flex items-baseline gap-1.5 text-sm">
    <span className="font-bold text-slate-900">{label} :</span>
    <span className={`font-medium tabular-nums ${valueCls}`}>{value}</span>
  </div>
);

// GST breakdown label — only the pair that applies (CGST+SGST same-state,
// IGST inter-state), matching the PO's own taxType.
const gstSummaryLabel = (row) => {
  if (row.taxType === "IGST" && row.igstTotal > 0) return `IGST ${money(row.igstTotal)}`;
  if (row.taxType === "CGST_SGST" && (row.cgstTotal > 0 || row.sgstTotal > 0)) {
    return `CGST ${money(row.cgstTotal)} + SGST ${money(row.sgstTotal)}`;
  }
  return "—";
};

const TrackingOrderCard = ({ quotationNumber, row, refreshSignal, onAddEntity, onNotRequired, onAddItems, onEditInvoice, onViewPoDoc, onHoverStage }) => {
  const m = STATUS_META[row.status] || {};
  const isReceivingFlow = RECEIVING_FLOW_STATUSES.has(row.status);
  const hasPo = !!row.poNumber;

  const [invoices, setInvoices] = useState([]);
  const [invLoading, setInvLoading] = useState(false);
  const [popup, setPopup] = useState(null); // { type: "products" | "overallSummary" | "viewInvoice", ... }

  const loadInvoices = useCallback(async () => {
    if (!isReceivingFlow) return;
    setInvLoading(true);
    try {
      const res = await fetch(`${API_BACKEND_URL}/stock/invoices/board?trackingOrderId=${row.trackingOrderId}&limit=200`, { credentials: "include" });
      const json = await res.json();
      if (res.ok && json.success) setInvoices(json.data?.rows || []);
    } catch {
      // non-fatal — the card just shows "no invoices yet"
    } finally {
      setInvLoading(false);
    }
  }, [row.trackingOrderId, isReceivingFlow]);

  useEffect(() => { loadInvoices(); }, [loadInvoices, refreshSignal]);

  return (
    <div
      onMouseEnter={() => onHoverStage(stageIndexForStatus(row.status))}
      onMouseLeave={() => onHoverStage(null)}
      className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm border-t-4 ${m.border ? m.border.replace("border-l-", "border-t-") : "border-t-slate-200"}`}
    >
      {/* Header — PO Number + Status (left), action buttons (right) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-white px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{quotationNumber}</span>
          <span className="text-base font-bold text-slate-900">PO Number : <span className="font-semibold text-slate-900">{row.poNumber || "—"}</span></span>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide shadow-sm ${m.pill || "bg-slate-400 text-white"}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
            {m.label || row.status}
          </span>
          {row.mailResult?.mode && (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
              {row.mailResult.mode === "SENT" ? "Mail Sent (ERP)" : "Mail Sent (Manual)"}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {row.status === "ENTITY_PENDING" && (
            <button
              type="button" onClick={() => onAddEntity(row)}
              className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-600 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
            >
              <PlusCircle className="h-3.5 w-3.5" /> Add Entity
            </button>
          )}
          {(row.status === "ENTITY_PENDING" || row.status === "PO_PENDING") && (
            <button
              type="button" onClick={() => onNotRequired(row)}
              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 shadow-sm transition hover:border-rose-300 hover:bg-rose-50"
            >
              <Ban className="h-3.5 w-3.5" /> Not Required
            </button>
          )}
          {isReceivingFlow && (
            <button
              type="button" onClick={() => setPopup({ type: "overallSummary" })}
              className="inline-flex items-center gap-1 rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-600 shadow-sm transition hover:border-blue-400 hover:bg-blue-50"
            >
              <ClipboardList className="h-3.5 w-3.5" /> Overall Summary
            </button>
          )}
          {RECEIVABLE_STATUSES.has(row.status) && (
            <button
              type="button" onClick={() => onAddItems(row)}
              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-500"
            >
              <PlusCircle className="h-3.5 w-3.5" /> Add Items
            </button>
          )}
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-1 gap-x-8 gap-y-3 bg-slate-50/60 px-5 py-4 sm:grid-cols-3">
        <SummaryField label="PO Date" value={hasPo ? fmt(row.poDate) : "—"} />
        <SummaryField label="Vendor" value={row.vendorName} />
        {hasPo && <SummaryField label="GST" value={gstSummaryLabel(row)} />}
        {hasPo && <SummaryField label="Basic Price" value={money(row.subTotal)} />}
        <SummaryField
          label="Grand Total"
          value={
            <button type="button" onClick={() => setPopup({ type: "products" })} className="hover:underline">
              {money(row.totalAmount)} <span className="font-normal text-slate-400">({row.items.length} item{row.items.length > 1 ? "s" : ""})</span>
            </button>
          }
        />
        {hasPo && (
          <SummaryField
            label="PO Doc"
            value={
              <button
                type="button" onClick={() => onViewPoDoc(row)}
                className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline"
              >
                <FileText className="h-3.5 w-3.5" /> View
              </button>
            }
          />
        )}
        {hasPo && (
          <>
            <SummaryField label="Total Ordered Qty" value={row.totalQuantity} />
            <SummaryField label="Received Qty" value={row.receivedQuantity ?? 0} valueCls="text-emerald-700" />
            <SummaryField label="Pending Qty" value={row.pendingQuantity ?? Math.max(0, row.totalQuantity - (row.receivedQuantity || 0))} valueCls="text-amber-700" />
          </>
        )}
      </div>

      {/* Invoice table — only once the receiving flow has started */}
      {isReceivingFlow && (
        <div className="border-t border-slate-100 px-5 py-4">
          <InvoiceTableBlock
            invoices={invoices}
            loading={invLoading}
            orderedQty={row.totalQuantity}
            onView={(inv) => setPopup({ type: "viewInvoice", invoice: inv })}
            onEdit={(inv) => onEditInvoice(row, inv)}
          />
        </div>
      )}

      {popup?.type === "products" && <ProductsPopup row={row} onClose={() => setPopup(null)} />}
      {popup?.type === "overallSummary" && <OverallSummaryPopup row={row} invoices={invoices} onClose={() => setPopup(null)} />}
      {popup?.type === "viewInvoice" && <InvoiceDetailPopup invoice={popup.invoice} onClose={() => setPopup(null)} />}
    </div>
  );
};

/* ============================================================= */
/* Main                                                           */
/* ============================================================= */

const TrackingOrdersComp = () => {
  const [view, setView] = useState({ mode: "board" });
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
  const [boardVersion, setBoardVersion] = useState(0);

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

  const refresh = () => { loadBoard(); setPopup(null); setBoardVersion((v) => v + 1); };
  const hasActiveFilters = !!search || !!status || !!dateFrom || !!dateTo;
  const clearFilters = () => { setSearch(""); setStatus(""); setDateFrom(""); setDateTo(""); setPage(1); };

  const backToBoard = () => { setView({ mode: "board" }); loadBoard(); setBoardVersion((v) => v + 1); };

  if (view.mode === "receiveInvoice") {
    return (
      <InvoiceReceiveView
        mode="create"
        trackingOrderId={view.row.trackingOrderId}
        onBack={backToBoard}
        onDone={backToBoard}
      />
    );
  }
  if (view.mode === "editInvoice") {
    return (
      <InvoiceReceiveView
        mode="edit"
        trackingOrderId={view.row.trackingOrderId}
        invoice={view.invoice}
        onBack={backToBoard}
        onDone={backToBoard}
      />
    );
  }
  if (view.mode === "viewPoDoc") {
    const pdfUrl = `${API_BACKEND_URL}/stock/purchase-orders/${view.poId}/pdf`;
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="mb-5 flex items-center gap-3">
          <button
            type="button" onClick={() => setView({ mode: "board" })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">PO Document · {view.poNumber || "—"}</h1>
          <a
            href={pdfUrl} download={`PO-${view.poNumber || view.poId}.pdf`}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" /> Download
          </a>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
          <iframe title="PO Document" src={pdfUrl} className="h-screen w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Tracking Orders</h1>
        <p className="mt-0.5 text-sm text-slate-600">Follow every vendor order from entity assignment through goods receiving to completion.</p>
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
          {board.map((q) =>
            q.rows.map((row) => (
              <TrackingOrderCard
                key={row.trackingOrderId}
                quotationNumber={q.quotationNumber}
                row={row}
                refreshSignal={boardVersion}
                onAddEntity={(r) => setPopup({ type: "addEntity", row: r })}
                onNotRequired={(r) => setPopup({ type: "notRequired", row: r })}
                onAddItems={(r) => setView({ mode: "receiveInvoice", row: r })}
                onEditInvoice={(r, invoice) => setView({ mode: "editInvoice", row: r, invoice })}
                onViewPoDoc={(r) => setView({ mode: "viewPoDoc", poId: r.poId, poNumber: r.poNumber })}
                onHoverStage={setHoveredStage}
              />
            ))
          )}
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

      {popup?.type === "addEntity" && <AddEntityPopup row={popup.row} onClose={() => setPopup(null)} onDone={refresh} />}
      {popup?.type === "notRequired" && <NotRequiredPopup row={popup.row} onClose={() => setPopup(null)} onDone={refresh} />}
    </div>
  );
};

export default TrackingOrdersComp;
