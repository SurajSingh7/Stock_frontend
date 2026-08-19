"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import POCreateView from "./Pocreateview";
import PODetailsView from "./Podetailsview";
import Pagination from "@/shared/ui/pagination/Pagination";
import {
  RotateCcw,
  Eye,
  Pencil,
  MoreVertical,
  FileText,
  Download,
  Mail,
  CheckCircle2,
} from "lucide-react";
import SendMailPopup from "./SendMailPopup";
import { unitLabel } from "@/modules/stock/shared/StockSharedUI";

/* ============================================================= */
/* Constants                                                      */
/* ============================================================= */

const INTERNAL_COMPANIES_URL =
  "https://gist.githubusercontent.com/SurajSingh7/ac8ffea18746e9fea058db22054bd3f3/raw/internal-companies.json";

const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const fmt = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-800 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";
const microLabel = "mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-800";

const TRUNCATE_LEN = 25;

const STATUS_META = {
  PO_PENDING: { label: "PO Pending", badge: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500", border: "border-l-amber-400" },
  GENERATED: { label: "PO Generated", badge: "bg-sky-50 text-sky-700 ring-sky-200", dot: "bg-sky-500", border: "border-l-sky-400" },
  APPROVED: { label: "PO Approved", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500", border: "border-l-emerald-400" },
  REJECTED: { label: "PO Rejected", badge: "bg-rose-50 text-rose-700 ring-rose-200", dot: "bg-rose-500", border: "border-l-rose-400" },
  SENT: { label: "Sent", badge: "bg-indigo-50 text-indigo-700 ring-indigo-200", dot: "bg-indigo-500", border: "border-l-indigo-400" },
};

const SHORT_STATUS_LABEL = {
  PO_PENDING: "Pending",
  GENERATED: "Generated",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  SENT: "Sent",
};

const TAB_STYLES = {
  "": {
    active: "border-indigo-600 bg-indigo-600 text-white",
    inactive: "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100",
    chipActive: "bg-indigo-500 text-indigo-50",
    chipInactive: "bg-indigo-100 text-indigo-700",
  },
  PO_PENDING: {
    active: "border-amber-600 bg-amber-600 text-white",
    inactive: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100",
    chipActive: "bg-amber-500 text-amber-50",
    chipInactive: "bg-amber-100 text-amber-700",
  },
  GENERATED: {
    active: "border-sky-600 bg-sky-600 text-white",
    inactive: "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100",
    chipActive: "bg-sky-500 text-sky-50",
    chipInactive: "bg-sky-100 text-sky-700",
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
  SENT: {
    active: "border-indigo-600 bg-indigo-600 text-white",
    inactive: "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100",
    chipActive: "bg-indigo-500 text-indigo-50",
    chipInactive: "bg-indigo-100 text-indigo-700",
  },
};

/* ============================================================= */
/* Inline icons (non-lucide, used elsewhere in the UI)            */
/* ============================================================= */

const IconX = () => (
  <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
    <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const IconChevron = ({ open }) => (
  <svg viewBox="0 0 20 20" fill="none" className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true">
    <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconSearch = () => (
  <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
    <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="m13.5 13.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const IconPhone = () => (
  <svg viewBox="0 0 20 20" fill="none" className="h-3 w-3" aria-hidden="true">
    <path d="M4 3.5C4 3 4.4 2.5 5 2.5h2L8.5 6 7 7.5c.7 1.8 2.7 3.8 4.5 4.5L13 10.5l3.5 1.5v2c0 .6-.5 1-1 1C9 15 4 10 4 3.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);
const IconArrowLeft = () => (
  <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
    <path d="M12.5 15 7.5 10l5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

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
            <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-800 transition hover:bg-slate-100 hover:text-slate-700">
              <IconX />
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
        <Modal onClose={() => setOpen(false)} title={title} maxWidth="max-w-md">
          <p className="whitespace-pre-wrap break-words text-sm text-slate-900">{str}</p>
        </Modal>
      )}
    </>
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
      <button
        type="button" onClick={() => setOpen((o) => !o)}
        className={`${inputCls} flex items-center justify-between text-left`}
      >
        <span className={`truncate ${selected ? "text-slate-900" : "text-slate-800"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="ml-2 shrink-0 text-slate-800"><IconChevron open={open} /></span>
      </button>
      {open && (
        <div className="absolute z-40 mt-1.5 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg ring-1 ring-slate-900/5">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3">
            <span className="text-slate-800"><IconSearch /></span>
            <input
              autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search..."
              className="w-full py-2.5 text-sm placeholder:text-slate-800 focus:outline-none"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            <button
              type="button" onClick={() => { onChange(""); setOpen(false); setQ(""); }}
              className="block w-full px-3 py-2 text-left text-sm transition hover:bg-slate-50"
            >
              {placeholder}
            </button>
            {filtered.map((o) => (
              <div key={o.value} className={`flex items-center gap-1 px-2 transition hover:bg-indigo-50/60 ${o.value === value ? "bg-indigo-50" : ""}`}>
                <button
                  type="button" onClick={() => { onChange(o.value); setOpen(false); setQ(""); }}
                  className="flex-1 truncate px-1 py-2 text-left text-sm text-slate-800"
                >
                  {o.label}
                </button>
                {renderExtra && renderExtra(o)}
              </div>
            ))}
            {filtered.length === 0 && <p className="px-3 py-2.5 text-sm text-slate-800">No match</p>}
          </div>
        </div>
      )}
    </div>
  );
};

/* ============================================================= */
/* Date field — pill style: label + date input in one box         */
/* ============================================================= */

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

/* ============================================================= */
/* Popups (all via portal Modal)                                  */
/* ============================================================= */

const itemTh = "px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-800";
const itemThRight = `${itemTh} text-right`;
const itemTd = "px-3 py-2 text-sm text-slate-700";
const itemTdRight = `${itemTd} text-right tabular-nums`;

const ProductsPopup = ({ row, onClose }) => {
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
              <th className={itemThRight}>GST</th>
              <th className={itemThRight}>GST ₹</th>
              <th className={itemThRight}>Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {row.items.map((it, i) => (
              <tr key={i} className="transition hover:bg-slate-50/60">
                <td className={itemTd}>{it.categoryName}</td>
                <td className={`${itemTd} font-medium text-slate-900`}>{it.productName}</td>
                <td className={itemTdRight}>{it.quantity} {unitLabel(it.unit)}</td>
                <td className={itemTdRight}>{Number(it.unitPrice).toLocaleString("en-IN")}</td>
                <td className={itemTdRight}>{it.gstRate}%</td>
                <td className={itemTdRight}>{Number(it.gstAmount).toLocaleString("en-IN")}</td>
                <td className={`${itemTdRight} font-medium text-slate-900`}>{Number(it.lineTotal).toLocaleString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
};

const InfoPopup = ({ row, onClose }) => (
  <Modal onClose={onClose} title="Skipped products">
    <div className="space-y-2.5">
      {row.skipped.map((s, i) => (
        <div key={i} className="rounded-xl bg-amber-50 px-4 py-3 text-sm ring-1 ring-inset ring-amber-100">
          <p className="font-medium text-slate-900">
            {s.productName}{" "}
            <span className="font-normal">· {s.categoryName} · qty {s.quantity} {unitLabel(s.unit)}</span>
          </p>
          <p className="mt-0.5 text-xs text-amber-700">Reason · {s.poSkipReason || "—"}</p>
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
      {error && <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-100">{error}</div>}
      <div className="mb-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-slate-50 p-4 text-sm">
        <div><p className="text-xs font-medium uppercase tracking-wider text-slate-800">Vendor</p><p className="mt-0.5 truncate text-slate-900">{row.vendorName}</p></div>
        <div><p className="text-xs font-medium uppercase tracking-wider text-slate-800">Amount</p><p className="mt-0.5 font-semibold text-slate-900 tabular-nums">{money(row.totalAmount)}</p></div>
        <div><p className="text-xs font-medium uppercase tracking-wider text-slate-800">Items</p><p className="mt-0.5 text-slate-900 tabular-nums">{row.items.length}</p></div>
        <div><p className="text-xs font-medium uppercase tracking-wider text-slate-800">Entity</p><p className="mt-0.5 text-slate-900">{row.entityAlias || "—"}</p></div>
      </div>
      {rejecting ? (
        <>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" className={`${inputCls} mb-3`} />
          <div className="flex justify-end gap-2.5">
            <button type="button" onClick={() => setRejecting(false)} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50">Cancel</button>
            <button type="button" disabled={busy} onClick={() => act("reject", { rejectedReason: reason })} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60">Confirm reject</button>
          </div>
        </>
      ) : (
        <div className="flex justify-end gap-2.5">
          <button type="button" onClick={() => setRejecting(true)} className="rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-600 shadow-sm transition hover:bg-rose-50">Reject</button>
          <button type="button" disabled={busy} onClick={() => act("approve")} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60">Approve</button>
        </div>
      )}
    </Modal>
  );
};

/* ============================================================= */
/* Action bar building blocks — ERP style, compact & scalable     */
/* ============================================================= */

const TONE_STYLES = {
  indigo: "border-indigo-200 text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50",
  green: "border-emerald-200 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50",
  amber: "border-amber-200 text-amber-700 hover:border-amber-300 hover:bg-amber-50",
  red: "border-rose-200 text-rose-600 hover:border-rose-300 hover:bg-rose-50",
  gray: "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50",
};

const toneCls = (tone) => TONE_STYLES[tone] || TONE_STYLES.gray;

/** Plain text button — e.g. Create PO, Send PO, Review PO */
const ActBtn = ({ label, tone = "gray", onClick }) => (
  <button
    type="button" onClick={onClick} title={label}
    className={`rounded-md border bg-white px-2 py-1 text-xs font-medium shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 ${toneCls(tone)}`}
  >
    {label}
  </button>
);

/** Icon-only button with hover tooltip — e.g. Edit PO */
const IconActBtn = ({ icon: Icon, label, tone = "gray", onClick }) => (
  <div className="group relative">
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex h-7 w-7 items-center justify-center rounded-md border bg-white shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 ${toneCls(tone)}`}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
    <span className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
      {label}
    </span>
  </div>
);

/** Icon + short text button with hover tooltip — e.g. View PO (Eye + "PO") */
const IconTextBtn = ({ icon: Icon, text, label, tone = "gray", onClick }) => (
  <div className="group relative">
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex items-center gap-1 rounded-md border bg-white px-2 py-1 text-xs font-medium shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 ${toneCls(tone)}`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{text}</span>
    </button>
    <span className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
      {label}
    </span>
  </div>
);

/** Overflow (⋮) menu — extensible list of secondary actions (Details, Not Required, ...) */
const ActionMenu = ({ items, onSelect }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="More actions"
        title="More actions"
        className={`flex h-7 w-7 items-center justify-center rounded-md border bg-white shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 ${
          open ? "border-indigo-300 bg-indigo-50 text-indigo-600" : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
        }`}
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-1.5 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg ring-1 ring-slate-900/5">
          {items.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => { setOpen(false); onSelect(a.key); }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium transition hover:bg-slate-50 ${
                a.tone === "red" ? "text-rose-600" : "text-slate-700"
              }`}
            >
              {a.icon && <a.icon className="h-3.5 w-3.5" />}
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Builds inline + overflow action lists for a row based on its status/flags.
 * Kept separate from rendering so it's easy to extend with new actions.
 */
const buildRowActions = (row) => {
  const s = row.status;
  const inline = [];
  const menu = [];

  if (row.disabled) {
    inline.push({ type: "text", key: "enable", label: "Enable", tone: "gray" });
    return { inline, menu };
  }

  if (s === "PO_PENDING" && row.items.length > 0) {
    inline.push({ type: "text", key: "create", label: "Create PO", tone: "indigo" });
  }

  if (s !== "PO_PENDING") {
    inline.push({ type: "iconText", key: "view", label: "View PO", text: "PO", icon: Eye, tone: "indigo" });
  }

  // APPROVED: only before the first send (mailResult unset) — status moves
  // to SENT the moment mail goes out. SENT: always available, so the PO can
  // be resent as many times as needed.
  if ((s === "APPROVED" && !row.mailResult?.mode) || s === "SENT") {
    inline.push({ type: "icon", key: "sendMail", label: "Send Mail", icon: Mail, tone: "green" });
  }

  if (s === "GENERATED") {
    inline.push({ type: "text", key: "review", label: "Review PO", tone: "amber" });
  }

  if (s === "REJECTED") {
    inline.push({ type: "icon", key: "edit", label: "Edit PO", icon: Pencil, tone: "red" });
  }

  menu.push({ key: "details", label: "Details", tone: "gray", icon: FileText });

  if (row.skipped?.length > 0) {
    inline.push({ type: "text", key: "info", label: "Info", tone: "gray" });
  }

  return { inline, menu };
};

const ActionBar = ({ row, on }) => {
  const { inline, menu } = buildRowActions(row);

  const renderInline = (a) => {
    switch (a.type) {
      case "icon":
        return <IconActBtn key={a.key} icon={a.icon} label={a.label} tone={a.tone} onClick={() => on(a.key, row)} />;
      case "iconText":
        return <IconTextBtn key={a.key} icon={a.icon} text={a.text} label={a.label} tone={a.tone} onClick={() => on(a.key, row)} />;
      default:
        return <ActBtn key={a.key} label={a.label} tone={a.tone} onClick={() => on(a.key, row)} />;
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {inline.map(renderInline)}
      <ActionMenu items={menu} onSelect={(key) => on(key, row)} />
    </div>
  );
};

/* ============================================================= */
/* Main                                                           */
/* ============================================================= */

const PurchaseOrderPage = () => {
  const [view, setView] = useState({ mode: "board" });
  const [board, setBoard] = useState([]);
  const [counts, setCounts] = useState({ ALL: 0, PO_PENDING: 0, GENERATED: 0, APPROVED: 0, SENT: 0, REJECTED: 0 });
  const [entities, setEntities] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [popup, setPopup] = useState(null);

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
  const [productOptions, setProductOptions] = useState([]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(id);
  }, [search]);

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
      setCounts(json.data?.counts || { ALL: 0, PO_PENDING: 0, GENERATED: 0, APPROVED: 0, SENT: 0, REJECTED: 0 });
      setPagination(json.pagination || { total: 0, totalPages: 1 });
    } catch (e) {
      setError(e.message); setBoard([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, vendorF, categoryF, productF, entityF, status, dateFrom, dateTo, page, limit]);

  useEffect(() => { loadBoard(); }, [loadBoard]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(INTERNAL_COMPANIES_URL); const j = await r.json();
        setEntities((j.data || []).filter((e) => e.isActive !== false && e.isShownOnDropDown !== false));
      } catch { }
      try {
        const r = await fetch(`${API_BACKEND_URL}/stock/vendors?limit=1000`, { credentials: "include" });
        const j = await r.json(); if (j.success) setVendors(j.data || []);
      } catch { }
      try {
        const r = await fetch(`${API_BACKEND_URL}/stock/categories/flat?type=LEAF&hasProducts=true&limit=500`, { credentials: "include" });
        const j = await r.json(); if (j.success) setCategories(j.data || []);
      } catch { }
    })();
  }, []);

  const aliases = useMemo(() => [...new Set(entities.map((e) => e.alias).filter(Boolean))], [entities]);
  const vendorOptions = useMemo(() => vendors.map((v) => ({ value: v._id, label: v.name })), [vendors]);
  const categoryOptions = useMemo(
    () => categories.map((c) => ({ value: c._id, label: c.displayPath || c.name })),
    [categories]
  );

  useEffect(() => {
    (async () => {
      try {
        const url = categoryF
          ? `${API_BACKEND_URL}/stock/product-definitions?categoryId=${categoryF}&limit=1000`
          : `${API_BACKEND_URL}/stock/product-definitions?limit=1000`;
        const r = await fetch(url, { credentials: "include" });
        const j = await r.json();
        setProductOptions(j.success ? (j.data || []).map((p) => ({ value: p._id, label: p.name })) : []);
      } catch {
        setProductOptions([]);
      }
    })();
  }, [categoryF]);

  const entityOptions = useMemo(() => aliases.map((a) => ({ value: a, label: a })), [aliases]);

  const shown = board;

  const hasActiveFilters =
    !!search || !!vendorF || !!categoryF || !!productF || !!entityF ||
    !!status || !!dateFrom || !!dateTo;

  const refresh = () => { loadBoard(); setPopup(null); setView({ mode: "board" }); };

  const clearFilters = () => {
    setSearch("");
    setVendorF("");
    setCategoryF("");
    setProductF("");
    setEntityF("");
    setDateFrom("");
    setDateTo("");
    setStatus("");
    setPage(1);
  };

  const onAction = (type, row, q) => {
    if (type === "enable") {
      fetch(`${API_BACKEND_URL}/stock/quotations/${q.sourceQuotationId}/enable-vendor`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ vendorId: row.vendorId }),
      }).then(loadBoard);
      return;
    }
    if (type === "create") {
      return setView({
        mode: "create",
        sourceQuotationId: q.sourceQuotationId,
        vendorId: row.vendorId,
        vendorName: row.vendorName,
        vendorStateCode: row.stateCode,
        items: row.items,
        buyerEntity: row.buyerEntity,
      });
    }
    if (type === "edit") return setView({ mode: "edit", poId: row.poId, vendorName: row.vendorName, vendorStateCode: row.stateCode, buyerEntity: row.buyerEntity });
    if (type === "view") return setView({ mode: "view", poId: row.poId });
    if (type === "sendMail") return setPopup({ type: "sendMail", row });
    if (type === "details") {
      return setView({
        mode: "details",
        poId: row.poId,
        row,
        quotationNumber: q.quotationNumber,
        quotationApprovalDate: q.quotationApprovalDate,
      });
    }
    if (type === "review") return setPopup({ type: "review", row });
    if (type === "info") return setPopup({ type: "info", row });
  };

  if (view.mode === "create" || view.mode === "edit")
    return <POCreateView mode={view.mode} context={view} onBack={() => setView({ mode: "board" })} onDone={refresh} />;

  if (view.mode === "details")
    return <PODetailsView context={view} onBack={() => setView({ mode: "board" })} />;

  if (view.mode === "view") {
    const pdfUrl = `${API_BACKEND_URL}/stock/purchase-orders/${view.poId}/pdf`;
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="mb-5 flex items-center gap-3">
          <button
            type="button" onClick={() => setView({ mode: "board" })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            <IconArrowLeft /> Back
          </button>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">View PO</h1>
          <a
            href={pdfUrl} target="_blank" rel="noreferrer"
            className="ml-auto rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-600 shadow-sm transition hover:bg-indigo-50"
          >
            Open PDF
          </a>
          <a
            href={pdfUrl} download={`PO-${view.poId}.pdf`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" /> Download PDF
          </a>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
          <iframe title="PO PDF" src={pdfUrl} className="h-screen w-full" />
        </div>
      </div>
    );
  }

  const tabs = [
    { key: "", label: "All", count: counts.ALL },
    { key: "PO_PENDING", label: "PO Pending", count: counts.PO_PENDING },
    { key: "GENERATED", label: "PO Generated", count: counts.GENERATED },
    { key: "APPROVED", label: "PO Approved", count: counts.APPROVED },
    { key: "SENT", label: "PO Sent", count: counts.SENT },
    { key: "REJECTED", label: "PO Rejected", count: counts.REJECTED },
  ];

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Purchase orders Approval</h1>
        <p className="mt-0.5 text-sm">Create, review, and track purchase orders built from approved quotations.</p>
      </div>

      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-800"><IconSearch /></span>
            <input
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search quotation no, PO no, vendor, product..."
              className={`${inputCls} pl-9`}
            />
          </div>
          <SearchableSelect value={vendorF} onChange={(v) => { setVendorF(v); setPage(1); }} options={vendorOptions} placeholder="All Vendors" />
          <SearchableSelect
            value={categoryF} onChange={(v) => { setCategoryF(v); setProductF(""); setPage(1); }} options={categoryOptions} placeholder="All Categories"
          />
          <SearchableSelect value={productF} onChange={(v) => { setProductF(v); setPage(1); }} options={productOptions} placeholder="All Products" />
          <SearchableSelect value={entityF} onChange={(v) => { setEntityF(v); setPage(1); }} options={entityOptions} placeholder="All Entities" />
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
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

        <div className="flex flex-wrap items-center gap-2.5">
          <DateField label="From:" value={dateFrom} onChange={(v) => { setDateFrom(v); setPage(1); }} />
          <DateField label="To:" value={dateTo} onChange={(v) => { setDateTo(v); setPage(1); }} />
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-xl border border-rose-300 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-600 shadow-sm transition hover:border-rose-400 hover:bg-rose-100"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      {loading ? (
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-100" />)}</div>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-16 text-center">
          <p className="text-sm font-medium text-slate-700">No purchase orders found</p>
          <p className="mt-1 text-sm text-slate-800">Adjust the filters above, or approve a quotation to see it here.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {shown.map((q) => (
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
                  Quotation Approved Date: <span className="font-medium text-slate-900">{fmt(q.quotationApprovalDate)}</span>
                </span>
              </div>

              <div className="hidden grid-cols-12 gap-2 px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-700 lg:grid">
                <span className="col-span-2">Vendor</span>
                <span className="col-span-2">PO No</span>
                <span className="col-span-1">Products</span>
                <span className="col-span-1 text-right">Total</span>
                <span className="col-span-1 text-right">Qty</span>
                <span className="col-span-1">Status</span>
                <span className="col-span-1">Entity</span>
                <span className="col-span-3 text-right">Actions</span>
              </div>

              {q.rows.map((row) => {
                const m = STATUS_META[row.status] || {};
                return (
                  <div
                    key={row.vendorId}
                    className={`grid grid-cols-1 gap-2 border-t border-slate-100 border-l-4 ${m.border || "border-l-slate-200"} px-5 py-3.5 transition hover:bg-slate-50/50 lg:grid-cols-12 lg:items-center`}
                  >
                    <div className="col-span-2 min-w-0">
                      <p className="text-sm font-medium text-slate-900">
                        <TruncateText text={row.vendorName} title="Vendor name" />
                      </p>
                      <p className="mt-0.5 inline-flex items-center gap-1 text-xs">
                        <IconPhone /> {row.phone || "—"}
                      </p>
                    </div>
                    <div className="col-span-2 text-sm font-medium text-indigo-600">
                      <TruncateText text={row.poNumber} title="PO Number" />
                    </div>
                    <div className="col-span-1">
                      <button
                        type="button" onClick={() => setPopup({ type: "products", row })}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        {row.items.length} item{row.items.length > 1 ? "s" : ""} <IconChevron open={false} />
                      </button>
                    </div>
                    <div className="col-span-1 text-sm font-semibold text-slate-900 tabular-nums lg:text-right">{money(row.totalAmount)}</div>
                    <div className="col-span-1 text-sm text-slate-700 tabular-nums lg:text-right">{row.totalQuantity}</div>
                    <div className="col-span-1">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${m.badge || "bg-slate-50 text-slate-600 ring-slate-200"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${m.dot || "bg-slate-400"}`} />
                        {SHORT_STATUS_LABEL[row.status] || row.status}
                      </span>
                    </div>
                    <div className="col-span-1 text-sm font-medium text-slate-700">
                      <TruncateText text={row.entityAlias} title="Entity" />
                    </div>
                    <div className="col-span-3 flex flex-wrap items-center justify-end gap-1.5">
                      {row.status === "SENT" && row.mailResult?.mode && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                          <CheckCircle2 className="h-3 w-3" />
                          {row.mailResult.mode === "SENT" ? "Mail Sent" : "Manual"}
                        </span>
                      )}
                      <ActionBar row={row} on={(type, r) => onAction(type, r, q)} />
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
          <p className="text-xs tabular-nums">
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
      {popup?.type === "info" && <InfoPopup row={popup.row} onClose={() => setPopup(null)} />}
      {popup?.type === "review" && <ReviewPopup row={popup.row} onClose={() => setPopup(null)} onDone={refresh} />}
      {popup?.type === "sendMail" && <SendMailPopup row={popup.row} onClose={() => setPopup(null)} onDone={refresh} />}
    </div>
  );
};

export default PurchaseOrderPage;