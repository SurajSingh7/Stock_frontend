"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import Pagination from "@/shared/ui/pagination/Pagination";
import { CalendarDays, RotateCcw, Lock, Layers, MoreVertical, Eye, Info, FileMinus, Pencil, Undo2, History } from "lucide-react";
import { SearchableSelect, Modal, inputCls, money } from "@/modules/stock/shared/StockSharedUI";
import { paymentTermShort, paymentTermLabel } from "@/modules/stock/shared/paymentTerms";
import { PAYMENT_STATE, PAYABLE_OPTIONS, PAYABLE_FILTER } from "@/modules/stock/shared/paymentStatus";
import { usePermissions } from "@/context/PermissionContext";
import { anchorRect } from "@/modules/stock/shared/anchorRect";
import MiscPopup from "@/modules/stock/shared/MiscPopup";
import { InvoiceFilePopup, NetPayablePopup } from "@/modules/stock/shared/InvoiceInfoPopups";
import DebitNoteView from "./DebitNoteView";
import { DebitNoteCell, DebitNoteHistoryPopup, WithdrawDebitNotePopup } from "./DebitNoteParts";
import { DN_STATUS } from "@/modules/stock/shared/debitNoteStatus";

/* ============================================================= */
/* The payment-side list of approved invoices: what is owed, and  */
/* when. Every number here is computed server-side — the due date */
/* depends on the PO's payment terms, and a second copy of that   */
/* arithmetic in the browser is a second answer waiting to        */
/* disagree with the first.                                      */
/* ============================================================= */

/*
  The tabs answer the PAYMENT question now.

  They used to be Not due / Due today / Overdue — which is precisely what the
  Payable Now / Payable Later filter beside them already says. The same
  question in two places is two chances to disagree, so the duplicate went and
  the tabs took over what nothing else was answering.
*/
const TABS = [
  { key: "", label: "All", count: "ALL",
    active: "border-slate-700 bg-slate-700 text-white",
    inactive: "border-slate-200 bg-white text-slate-600 hover:bg-slate-50" },
  { key: PAYMENT_STATE.UNPAID, label: "Unpaid", count: "UNPAID",
    active: "border-slate-500 bg-slate-500 text-white",
    inactive: "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100" },
  { key: PAYMENT_STATE.PARTIAL, label: "Partial Paid", count: "PARTIAL",
    active: "border-blue-600 bg-blue-600 text-white",
    inactive: "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100" },
  { key: PAYMENT_STATE.PAID, label: "Paid", count: "PAID",
    active: "border-emerald-600 bg-emerald-600 text-white",
    inactive: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" },
];

/*
  Row menu, rendered through a portal and positioned from the button's own
  rect. The table scrolls sideways inside an overflow container, which would
  clip an absolutely-positioned panel — a fixed one anchored to the button
  escapes that without the table having to give up its scrolling.
*/
const RowMenu = ({ items }) => {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = anchorRect(btnRef.current);
      // Right-aligned under the button (menu is w-60 = 240px), kept on screen;
      // flips above when the last rows leave no room below.
      const height = items.length * 52 + 8;
      const below = r.bottom + 6;
      setAt({
        top: below + height > r.vh - 8 ? Math.max(8, r.top - height - 6) : below,
        left: Math.min(Math.max(8, r.right - 240), r.vw - 248),
      });
    }
    setOpen((v) => !v);
  };

  return (
    <>
      <button
        ref={btnRef} type="button" onClick={toggle}
        aria-haspopup="menu" aria-expanded={open} aria-label="Row actions"
        className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-500 shadow-sm transition hover:bg-slate-50"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <>
          {/* Catches the click that closes it, and keeps the page behind
              un-scrollable-into by accident. */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="menu"
            style={{ top: at.top, left: at.left }}
            className="fixed z-50 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
          >
            {items.map((it, i) => (
              <button
                key={i} type="button" role="menuitem"
                disabled={it.disabled}
                onClick={() => { setOpen(false); it.onClick?.(); }}
                className={`flex w-full items-start gap-2.5 px-3.5 py-2 text-left text-sm transition ${
                  it.disabled
                    ? "cursor-not-allowed text-slate-400"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <it.icon className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="min-w-0">
                  <span className="block font-medium">{it.label}</span>
                  {it.hint && <span className="block text-xs text-slate-400">{it.hint}</span>}
                </span>
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </>
  );
};

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

// <input type="date"> speaks YYYY-MM-DD and nothing else.
const toInputDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

const th = "px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500";
const thRight = th + " text-right";
const td = "px-4 py-3 text-sm text-slate-700 align-middle";
const tdRight = td + " text-right tabular-nums";

/* ── Due-in cell ───────────────────────────────────────────────── */
/* One number, read three ways: still to come, due today, or how   */
/* far past. Colour carries it as much as the words, because this  */
/* is the column the page exists for.                              */
// Mirrors the dueStatus the server derives per row. Only the two that need
// colouring are named — anything else reads as plain days remaining.
const DUE_STATUS = { DUE: "DUE", OVERDUE: "OVERDUE" };

/*
  Says whether this invoice sits on its contractual date or was moved off it,
  and by how much. Without it the two date columns look like an unexplained
  discrepancy rather than a decision somebody took.
*/
const ScheduleBadge = ({ kind, offset }) => {
  if (kind === "EARLY") {
    return (
      <span className="text-[11px] font-semibold text-amber-600">
        {Math.abs(offset)}d early
      </span>
    );
  }
  if (kind === "DEFERRED") {
    return (
      <span className="text-[11px] font-semibold text-violet-600">
        {offset}d deferred
      </span>
    );
  }
  return <span className="text-[11px] text-slate-400">on due date</span>;
};

const DueIn = ({ daysLeft, dueStatus }) => {
  if (dueStatus === DUE_STATUS.OVERDUE) {
    const over = Math.abs(daysLeft);
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
        {over} {over === 1 ? "day" : "days"} overdue
      </span>
    );
  }
  if (dueStatus === DUE_STATUS.DUE) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
        Due today
      </span>
    );
  }
  return (
    <span className="text-sm tabular-nums text-slate-700">
      {daysLeft} {daysLeft === 1 ? "day" : "days"}
    </span>
  );
};

/* ── Schedule payment popup ────────────────────────────────────── */
/* The due date is the contract and is shown, never edited. What is */
/* chosen here is only WHEN the invoice reaches the account team's  */
/* payable queue — earlier when a vendor asks to be paid ahead of   */
/* terms, later when the money is not there yet.                    */
/*                                                                  */
/* The "on the due date" option is how a schedule is UNDONE. Without */
/* it there would be no way back to the contract, only a way to     */
/* keep moving away from it.                                        */
const SchedulePaymentPopup = ({ row, onClose, onDone }) => {
  const [onDueDate, setOnDueDate] = useState(!row.rescheduled);
  const [date, setDate] = useState(toInputDate(row.scheduledOn));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // No max: deferring has no ceiling. What stops a date being pushed away for
  // ever is the two locks, not a window.
  const min = toInputDate(row.scheduleWindow?.min);

  // Shown while choosing rather than after saving, so the consequence of the
  // date is visible at the moment it is picked.
  const preview = useMemo(() => {
    if (onDueDate || !date) return null;
    const picked = new Date(date + "T00:00:00");
    const due = new Date(row.dueDate);
    due.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return {
      offset: Math.round((picked - due) / 86400000),
      daysAway: Math.round((picked - today) / 86400000),
    };
  }, [onDueDate, date, row.dueDate]);

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`${API_BACKEND_URL}/stock/invoice-list/${row._id}/schedule`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(onDueDate ? { onDueDate: true } : { scheduledOn: date }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to save");
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const history = [...(row.paymentScheduleHistory || [])].reverse();
  const unchanged = onDueDate ? !row.rescheduled : toInputDate(row.scheduledOn) === date;

  return (
    <Modal onClose={onClose} title={`Schedule payment · Invoice ${row.invoiceNumber}`}>
      {error && (
        <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-100">{error}</div>
      )}

      <div className="mb-4 grid grid-cols-3 gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-sm">
        <div>
          <p className="text-xs text-slate-500">Invoice date</p>
          <p className="font-medium text-slate-900">{fmtDate(row.invoiceDate)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Terms</p>
          <p className="font-medium text-slate-900">{paymentTermShort(row.paymentTerms)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Due on</p>
          <p className="font-semibold text-slate-900">{fmtDate(row.dueDate)}</p>
        </div>
      </div>

      <p className="mb-2 text-xs font-semibold text-slate-700">Make it payable</p>

      <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5 text-sm">
        <input
          type="radio" name="schedule-mode" checked={onDueDate}
          onChange={() => setOnDueDate(true)}
          className="h-4 w-4 border-slate-300 text-indigo-600 focus:ring-indigo-500"
        />
        <span className="text-slate-800">
          On the due date — <strong>{fmtDate(row.dueDate)}</strong>
        </span>
      </label>

      <label className="mt-2 flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5 text-sm">
        <input
          type="radio" name="schedule-mode" checked={!onDueDate}
          onChange={() => setOnDueDate(false)}
          className="h-4 w-4 border-slate-300 text-indigo-600 focus:ring-indigo-500"
        />
        <span className="flex flex-wrap items-center gap-2 text-slate-800">
          Schedule it for
          <input
            type="date" value={date} min={min}
            onChange={(e) => { setDate(e.target.value); setOnDueDate(false); }}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </span>
      </label>

      <p className="mt-1.5 text-xs text-slate-500">
        Today ({fmtDate(row.scheduleWindow?.min)}) or any day after. Pick today to make it payable at once.
      </p>

      {preview && (
        <p className={`mt-3 rounded-lg px-3 py-2 text-sm ring-1 ring-inset ${
          preview.offset < 0
            ? "bg-amber-50 text-amber-800 ring-amber-100"
            : preview.offset > 0
              ? "bg-violet-50 text-violet-800 ring-violet-100"
              : "bg-slate-50 text-slate-700 ring-slate-200"
        }`}>
          {preview.offset === 0
            ? "Same as the due date."
            : preview.offset < 0
              ? `${Math.abs(preview.offset)} days before the due date — paying early.`
              : `${preview.offset} days after the due date — deferred.`}
          {preview.daysAway <= 0 ? " Payable immediately." : ` Payable in ${preview.daysAway} days.`}
        </p>
      )}

      {history.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Changes ({history.length})
          </p>
          <div className="max-h-40 space-y-2 overflow-y-auto">
            {history.map((h, i) => (
              <div key={i} className="rounded-lg border border-slate-200 px-3 py-2 text-xs">
                <p className="text-slate-800">
                  {fmtDate(h.from)} <span className="text-slate-400">&rarr;</span> {fmtDate(h.to)}
                </p>
                <p className="mt-0.5 text-slate-500">{h.byName || "—"} · {fmtDateTime(h.at)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button" onClick={onClose} disabled={busy}
          className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button" onClick={submit}
          disabled={busy || unchanged || (!onDueDate && !date)}
          className="rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </Modal>
  );
};

/* ============================================================= */
/* Main                                                           */
/* ============================================================= */

const InvoiceListComp = () => {
  const { permissions, isAdmin } = usePermissions();
  /*
    Two writes on this screen, each with its own action: scheduling changes
    WHEN money leaves, and a debit note claims money back for faulty goods
    (then goes to review and approval). Misc charges are accounts' own.
  */
  const myActions = useMemo(() => {
    if (isAdmin) return null; // admins bypass server-side too
    const mod = (permissions || []).find((m) => m.moduleKey === "invoice-list");
    return new Set((mod?.actions || []).map((a) => String(a).toUpperCase()));
  }, [permissions, isAdmin]);
  const canSchedule = myActions === null || myActions.has("SCHEDULE_PAYMENT");
  const canRaiseDn = myActions === null || myActions.has("RAISE_DEBIT_NOTE");
  const [dnView, setDnView] = useState(null); // { row, adjustment? } — the debit note page

  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({ ALL: 0, NOT_DUE: 0, DUE: 0, OVERDUE: 0 });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [vendorId, setVendorId] = useState("");
  // The tabs. Payable Now / Later stays a dropdown beside them — it narrows
  // what the tabs show rather than being another way to read the page.
  const [paymentState, setPaymentState] = useState("");
  const [payable, setPayable] = useState(PAYABLE_FILTER.ALL);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [vendors, setVendors] = useState([]);
  const [editing, setEditing] = useState(null);
  const [popup, setPopup] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BACKEND_URL}/stock/vendors?limit=500`, { credentials: "include" });
        const j = await r.json();
        if (j.success) setVendors(j.data || []);
      } catch {
        // Non-fatal — the vendor filter just stays empty.
      }
    })();
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (vendorId) params.set("vendorId", vendorId);
      if (paymentState) params.set("paymentState", paymentState);
      if (payable && payable !== PAYABLE_FILTER.ALL) params.set("payable", payable);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(`${API_BACKEND_URL}/stock/invoice-list?${params.toString()}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to load invoices");
      setRows(json.data?.rows || []);
      setCounts(json.data?.counts || { ALL: 0, NOT_DUE: 0, DUE: 0, OVERDUE: 0 });
      setTotal(json.pagination?.total || 0);
    } catch (e) {
      setError(e.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, vendorId, paymentState, payable, dateFrom, dateTo]);

  useEffect(() => { loadList(); }, [loadList]);

  const vendorOptions = useMemo(
    () => vendors.map((v) => ({ value: v._id, label: v.name })),
    [vendors]
  );

  const hasActiveFilters =
    !!search || !!vendorId || !!dateFrom || !!dateTo ||
    !!paymentState || payable !== PAYABLE_FILTER.ALL;
  const clearFilters = () => {
    setSearch(""); setVendorId(""); setDateFrom(""); setDateTo("");
    setPaymentState(""); setPayable(PAYABLE_FILTER.ALL); setPage(1);
  };

  const refresh = () => { setEditing(null); setPopup(null); setDnView(null); loadList(); };

  // A debit note is picked unit by unit, so it gets the whole page.
  if (dnView) {
    return (
      <DebitNoteView
        invoice={dnView.row}
        adjustment={dnView.adjustment || null}
        onBack={() => setDnView(null)}
        onDone={refresh}
      />
    );
  }

  // The latest note, fetched in full (lines + history) to edit it.
  const openResubmit = async (r) => {
    try {
      const res = await fetch(`${API_BACKEND_URL}/stock/invoice-list/${r._id}/debit-notes`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to load the debit note");
      const dn = (json.data || []).find((d) => String(d._id) === String(r.debitNote?.latest?._id));
      if (!dn) throw new Error("Debit note not found");
      setDnView({ row: r, adjustment: dn });
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Invoice list</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Approved invoices and when each one falls due. The clock runs from the invoice date unless it has been moved.
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="font-bold">&times;</button>
        </div>
      )}

      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoice number, PO number or vendor..."
              className={inputCls}
            />
          </div>
          <SearchableSelect
            value={vendorId} onChange={(v) => { setVendorId(v); setPage(1); }}
            options={vendorOptions} placeholder="All vendors"
          />
          <select
            value={payable}
            onChange={(e) => { setPayable(e.target.value); setPage(1); }}
            className={inputCls}
            aria-label="Payable timing"
          >
            {PAYABLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => {
            const active = paymentState === t.key;
            return (
              <button
                key={t.key || "all"} type="button"
                onClick={() => { setPaymentState(t.key); setPage(1); }}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 ${active ? t.active : t.inactive}`}
              >
                {t.label}
                <span className={`rounded-full px-1.5 text-xs tabular-nums ${active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                  {counts[t.count] ?? 0}
                </span>
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
              <th className={th}>PO Number</th>
              <th className={th}>Vendor</th>
              <th className={thRight}>Net Payable</th>
              <th className={thRight}>Paid</th>
              <th className={th}>Debit Note</th>
              <th className={th}>Terms</th>
              <th className={th}>Due On</th>
              <th className={th}>Scheduled On</th>
              <th className={th}>Payable In</th>
              <th className={thRight}>Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={12} className="px-4 py-12 text-center text-sm text-slate-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={12} className="px-4 py-12 text-center text-sm text-slate-400">
                No approved invoices match these filters.
              </td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r._id} className="transition hover:bg-slate-50/60">
                  <td className={td}>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="font-semibold text-slate-900">{r.invoiceNumber}</span>
                      {r.invoiceFile && (
                        <button
                          type="button" onClick={() => setPopup({ type: "file", row: r })}
                          title="View the invoice as uploaded"
                          className="rounded-md border border-indigo-200 bg-white p-0.5 text-indigo-600 shadow-sm transition hover:bg-indigo-50"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </span>
                  </td>
                  <td className={td}>{fmtDate(r.invoiceDate)}</td>
                  <td className={td}>{r.poNumber || "—"}</td>
                  <td className={td}>{r.vendorName || "—"}</td>
                  {/* Net Payable with its working one click away — Billing,
                      Misc, TDS and Debit Notes live in the ⓘ, not as columns. */}
                  <td className={tdRight}>
                    <span className="inline-flex items-center justify-end gap-1.5">
                      <span className="font-semibold text-slate-900">{money(r.payable)}</span>
                      <button
                        type="button" onClick={() => setPopup({ type: "netPayable", row: r })}
                        title="Billing, Misc, TDS and Debit Notes behind this figure"
                        className="rounded-md border border-blue-200 bg-white p-0.5 text-blue-600 shadow-sm transition hover:bg-blue-50"
                      >
                        <Info className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </td>
                  <td className={tdRight}>
                    {r.paidTotal > 0 ? <span className="font-medium text-emerald-700">{money(r.paidTotal)}</span> : <span className="text-slate-300">—</span>}
                  </td>
                  <td className={td}>
                    <DebitNoteCell summary={r.debitNote} onHistory={() => setPopup({ type: "dnHistory", row: r })} />
                  </td>
                  <td className={td}>{paymentTermShort(r.paymentTerms)}</td>
                  {/* The contract. Never edited, and shown next to the
                      decision so the two can be compared at a glance. */}
                  <td className={td}>{fmtDate(r.dueDate)}</td>
                  <td className={td}>
                    <span className="block">{fmtDate(r.scheduledOn)}</span>
                    <ScheduleBadge kind={r.scheduleKind} offset={r.scheduleOffset} />
                  </td>
                  <td className={td}><DueIn daysLeft={r.daysLeft} dueStatus={r.dueStatus} /></td>
                  <td className={tdRight}>
                    <div className="flex items-center justify-end">
                      {/* Disabled items stay in the menu with their reason
                          rather than disappearing — an option that vanishes
                          just leaves the user hunting for it. */}
                      <RowMenu
                        items={[
                          {
                            icon: r.canSchedulePayment && canSchedule ? CalendarDays : Lock,
                            label: r.rescheduled ? "Reschedule payment" : "Schedule payment",
                            hint: !canSchedule
                              ? "You do not have permission"
                              : r.scheduleLockReason === "IN_APPROVAL"
                                ? "Sent for payment approval"
                                : r.scheduleLockReason === "PAYABLE"
                                  ? "Already payable"
                                  : null,
                            disabled: !canSchedule || !r.canSchedulePayment,
                            onClick: () => setEditing(r),
                          },
                          {
                            icon: FileMinus,
                            label: "Add debit note",
                            hint: !canRaiseDn
                              ? "You do not have permission"
                              : !r.canRaiseDebitNote
                                ? r.debitNoteLive
                                  ? `DN-${r.debitNote?.latest?.dnNumber} is still in progress`
                                  : "Payment already approved"
                                : null,
                            disabled: !canRaiseDn || !r.canRaiseDebitNote,
                            onClick: () => setDnView({ row: r }),
                          },
                          // Only for the latest note, and only while review has it.
                          ...(r.debitNote?.latest?.status === DN_STATUS.REVIEW_REJECTED
                            ? [{
                                icon: Pencil,
                                label: `Edit & resubmit DN-${r.debitNote.latest.dnNumber}`,
                                hint: canRaiseDn ? r.debitNote.latest.lastNote || null : "You do not have permission",
                                disabled: !canRaiseDn,
                                onClick: () => openResubmit(r),
                              }]
                            : []),
                          ...([DN_STATUS.REVIEW_PENDING, DN_STATUS.REVIEW_REJECTED].includes(r.debitNote?.latest?.status)
                            ? [{
                                icon: Undo2,
                                label: `Withdraw DN-${r.debitNote.latest.dnNumber}`,
                                hint: canRaiseDn ? null : "You do not have permission",
                                disabled: !canRaiseDn,
                                onClick: () => setPopup({ type: "dnWithdraw", row: r }),
                              }]
                            : []),
                          {
                            icon: History,
                            label: "Debit notes",
                            hint: r.debitNote ? `${r.debitNote.count} on this invoice` : "None on this invoice",
                            disabled: !r.debitNote,
                            onClick: () => setPopup({ type: "dnHistory", row: r }),
                          },
                          {
                            icon: Layers,
                            label: "Misc",
                            hint: (r.extraCharges || []).length === 0 ? "None on this invoice" : undefined,
                            disabled: (r.extraCharges || []).length === 0,
                            onClick: () => setPopup({ type: "misc", row: r }),
                          },
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <Pagination
          currentPage={page} totalItems={total} itemsPerPage={limit} onPageChange={setPage}
          onItemsPerPageChange={(n) => { setLimit(n); setPage(1); }}
        />
      </div>

      {editing && <SchedulePaymentPopup row={editing} onClose={() => setEditing(null)} onDone={refresh} />}
      {popup?.type === "dnHistory" && (
        <DebitNoteHistoryPopup invoice={popup.row} basePath="invoice-list" onClose={() => setPopup(null)} />
      )}
      {popup?.type === "dnWithdraw" && (
        <WithdrawDebitNotePopup invoice={popup.row} onClose={() => setPopup(null)} onDone={refresh} />
      )}
      {popup?.type === "file" && (
        <InvoiceFilePopup
          invoiceNumber={popup.row.invoiceNumber} vendorName={popup.row.vendorName}
          file={popup.row.invoiceFile} onClose={() => setPopup(null)}
        />
      )}
      {popup?.type === "netPayable" && <NetPayablePopup row={popup.row} onClose={() => setPopup(null)} />}
      {popup?.type === "misc" && <MiscPopup invoice={popup.row} readOnly onClose={() => setPopup(null)} />}
    </div>
  );
};

export default InvoiceListComp;
