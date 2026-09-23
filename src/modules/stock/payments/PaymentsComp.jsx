"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import Pagination from "@/shared/ui/pagination/Pagination";
import {
  RotateCcw, Send, Wallet, FileMinus, PlusCircle, Layers, Paperclip, X,
  LayoutGrid, Clock, CheckCircle2, XCircle, CreditCard, PieChart, CalendarClock,
  Pencil, Trash2, AlertTriangle,
} from "lucide-react";
import { SearchableSelect, Modal, inputCls, money } from "@/modules/stock/shared/StockSharedUI";
import { paymentTermShort } from "@/modules/stock/shared/paymentTerms";
import {
  APPROVAL_STATUS, approvalMeta, PAYMENT_STATE, paymentStateMeta,
  PAYABLE_FILTER, PAYABLE_OPTIONS, PAYMENT_MODES, PAYMENT_MODE_LABEL,
} from "@/modules/stock/shared/paymentStatus";
import { usePermissions } from "@/context/PermissionContext";
import CreditNoteView from "@/modules/stock/invoiceList/CreditNoteView";
import { MiscChargePopup, AdjustmentCard, ADJUSTMENT_META } from "@/modules/stock/invoiceList/AdjustmentPopups";

/* ============================================================= */
/* Payments — the account team's screen.                          */
/*                                                                */
/* The status bar is two INDEPENDENT groups, because they answer   */
/* two independent questions: has this been cleared to pay, and    */
/* how much of it has gone. Picking one from each is the filter    */
/* accounts actually want — "approved but still unpaid".           */
/*                                                                */
/* Every "can I do this" flag on a row is computed server-side;    */
/* this file renders them and never works the rule out a second    */
/* time.                                                           */
/* ============================================================= */

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const todayStr = () => new Date().toISOString().slice(0, 10);

const th = "px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500";
const thRight = th + " text-right";
const td = "px-4 py-3 text-sm text-slate-700 align-middle";
const tdRight = td + " text-right tabular-nums";

const APPROVAL_CHIPS = [
  { key: APPROVAL_STATUS.PENDING, label: "Pending", icon: Clock, on: "border-amber-300 bg-amber-50 text-amber-700", count: "PENDING" },
  { key: APPROVAL_STATUS.APPROVED, label: "Approved", icon: CheckCircle2, on: "border-emerald-300 bg-emerald-50 text-emerald-700", count: "APPROVED" },
  { key: APPROVAL_STATUS.REJECTED, label: "Rejected", icon: XCircle, on: "border-rose-300 bg-rose-50 text-rose-700", count: "REJECTED" },
];

const STATE_CHIPS = [
  { key: PAYMENT_STATE.UNPAID, label: "Unpaid", icon: CreditCard, on: "border-slate-300 bg-slate-50 text-slate-700", count: "UNPAID" },
  { key: PAYMENT_STATE.PARTIAL, label: "Partial Paid", icon: PieChart, on: "border-blue-300 bg-blue-50 text-blue-700", count: "PARTIAL" },
  { key: PAYMENT_STATE.PAID, label: "Paid", icon: CheckCircle2, on: "border-emerald-300 bg-emerald-50 text-emerald-700", count: "PAID" },
];

/* ── Everything raised on one invoice, with the buttons to change it ── */
const ManageAdjustmentsPopup = ({ invoice, canManage, onClose, onEdit, onAdd, onChanged }) => {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BACKEND_URL}/stock/payments/${invoice._id}/adjustments`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to load");
      setRows(json.data || []);
    } catch (e) {
      setError(e.message);
      setRows([]);
    }
  }, [invoice._id]);

  useEffect(() => { load(); }, [load]);

  const remove = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`${API_BACKEND_URL}/stock/payments/adjustments/${confirming._id}`, {
        method: "DELETE", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ reason: deleteReason.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to withdraw");
      setConfirming(null); setDeleteReason("");
      onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} title={`Adjustments · Invoice ${invoice.invoiceNumber}`} maxWidth="max-w-2xl">
      {error && (
        <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-100">{error}</div>
      )}

      {canManage && invoice.canEditAdjustments && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button" onClick={() => onAdd("CREDIT_NOTE")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 shadow-sm transition hover:bg-rose-50"
          >
            <FileMinus className="h-3.5 w-3.5" /> Add credit note
          </button>
          <button
            type="button" onClick={() => onAdd("MISC")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-xs font-semibold text-sky-600 shadow-sm transition hover:bg-sky-50"
          >
            <PlusCircle className="h-3.5 w-3.5" /> Add misc charge
          </button>
        </div>
      )}

      {!invoice.canEditAdjustments && (
        <p className="mb-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-inset ring-slate-200">
          {invoice.approvalStatus === APPROVAL_STATUS.PENDING
            ? "Waiting on payment approval — adjustments are frozen until it is decided."
            : "Already approved for payment — adjustments can no longer be changed."}
        </p>
      )}

      {rows === null ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />)}
        </div>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">Nothing has been raised on this invoice.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((a) => (
            <AdjustmentCard
              key={a._id}
              adjustment={a}
              actions={
                canManage && invoice.canEditAdjustments ? (
                  <span className="ml-2 flex gap-1">
                    <button
                      type="button" onClick={() => onEdit(a)} title="Edit"
                      className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 shadow-sm transition hover:bg-slate-50"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button" onClick={() => setConfirming(a)} title="Withdraw"
                      className="rounded-md border border-rose-200 bg-white p-1.5 text-rose-600 shadow-sm transition hover:bg-rose-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ) : null
              }
            />
          ))}
        </div>
      )}

      {confirming && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50/60 p-3">
          <p className="text-sm font-semibold text-rose-800">
            Withdraw this {(ADJUSTMENT_META[confirming.type] || {}).label?.toLowerCase() || "adjustment"} of {money(confirming.amount)}?
          </p>
          {confirming.type === "CREDIT_NOTE" && (
            <p className="mt-1 text-xs text-rose-700">
              Any units it marked faulty go back to available stock.
            </p>
          )}
          <input
            type="text" value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)}
            placeholder="Reason (kept on the record)"
            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-100"
          />
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button" onClick={() => setConfirming(null)} disabled={busy}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button" onClick={remove} disabled={busy}
              className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500 disabled:opacity-60"
            >
              {busy ? "Withdrawing…" : "Withdraw"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};

/* ── Fix & resend, after the approval team sent it back ───────── */
/* A rejection means "something on this is wrong". This puts the   */
/* reason, the adjustments and the resend button in one place, so  */
/* the fix and the resubmission are one piece of work rather than  */
/* two screens the user has to join up themselves.                 */
const FixAndResendPopup = ({ invoice, canManage, onClose, onEdit, onAdd, onChanged, onResent }) => {
  const [rows, setRows] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BACKEND_URL}/stock/payments/${invoice._id}/adjustments`, { credentials: "include" });
      const json = await res.json();
      setRows(res.ok && json.success ? json.data || [] : []);
    } catch {
      setRows([]);
    }
  }, [invoice._id]);

  useEffect(() => { load(); }, [load]);

  const resend = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`${API_BACKEND_URL}/stock/payments/${invoice._id}/send-for-approval`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to send");
      onResent();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} title={`Fix & resend · Invoice ${invoice.invoiceNumber}`} maxWidth="max-w-2xl">
      {error && (
        <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-100">{error}</div>
      )}

      <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50/60 p-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-rose-800">
          <AlertTriangle className="h-4 w-4" /> Sent back by {invoice.paymentApproval?.reviewedByName || "—"}
          <span className="font-normal text-rose-600">· {fmtDateTime(invoice.paymentApproval?.reviewedAt)}</span>
        </p>
        <p className="mt-1 text-sm text-rose-900">{invoice.paymentApproval?.rejectedReason || "No reason given"}</p>
      </div>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-700">What is on this invoice</span>
        {canManage && (
          <span className="flex gap-2">
            <button
              type="button" onClick={() => onAdd("CREDIT_NOTE")}
              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-xs font-semibold text-rose-600 shadow-sm transition hover:bg-rose-50"
            >
              <FileMinus className="h-3.5 w-3.5" /> Credit note
            </button>
            <button
              type="button" onClick={() => onAdd("MISC")}
              className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-white px-2.5 py-1 text-xs font-semibold text-sky-600 shadow-sm transition hover:bg-sky-50"
            >
              <PlusCircle className="h-3.5 w-3.5" /> Misc
            </button>
          </span>
        )}
      </div>

      {rows === null ? (
        <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-400">
          No credit notes or misc charges on this invoice.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((a) => (
            <AdjustmentCard
              key={a._id}
              adjustment={a}
              actions={
                canManage ? (
                  <button
                    type="button" onClick={() => onEdit(a)} title="Edit"
                    className="ml-2 rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 shadow-sm transition hover:bg-slate-50"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                ) : null
              }
            />
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
        <span className="text-slate-500">Payable now</span>
        <span className="font-bold tabular-nums text-slate-900">{money(invoice.payable)}</span>
      </div>

      <label htmlFor="resend-reason" className="mb-1.5 mt-4 block text-xs font-semibold text-slate-700">
        Note for the approval team
      </label>
      <textarea
        id="resend-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
        placeholder="What was fixed…" className={inputCls}
      />

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button" onClick={onClose} disabled={busy}
          className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
        >
          Close
        </button>
        <button
          type="button" onClick={resend} disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-60"
        >
          <Send className="h-4 w-4" /> {busy ? "Sending…" : "Send for approval again"}
        </button>
      </div>
    </Modal>
  );
};

/* ── Record a payment ──────────────────────────────────────────── */
/* An instalment, not a settlement: the balance is what limits the  */
/* amount, and the rows already recorded are shown so nobody pays   */
/* the same thing twice.                                            */
const RecordPaymentPopup = ({ invoice, onClose, onDone }) => {
  const [amount, setAmount] = useState(String(invoice.balance ?? ""));
  const [mode, setMode] = useState("NEFT");
  const [paidOn, setPaidOn] = useState(todayStr());
  const [refNo, setRefNo] = useState("");
  const [remarks, setRemarks] = useState("");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const value = Number(amount) || 0;
  const overBalance = value > (invoice.balance || 0);

  const pickFiles = (e) => {
    const picked = [...(e.target.files || [])];
    e.target.value = "";
    // Mirrors the server cap so the sixth file is refused here rather than
    // silently dropped by multer.
    setFiles((prev) => [...prev, ...picked].slice(0, 5));
  };

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const fd = new FormData();
      fd.append("amount", String(value));
      fd.append("mode", mode);
      fd.append("paidOn", paidOn);
      fd.append("refNo", refNo);
      fd.append("remarks", remarks);
      files.forEach((f) => fd.append("proofs", f));

      const res = await fetch(`${API_BACKEND_URL}/stock/payments/${invoice._id}/record`, {
        method: "POST", credentials: "include", body: fd,
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to record payment");
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const history = invoice.payments || [];

  return (
    <Modal onClose={onClose} title={`Payment · Invoice ${invoice.invoiceNumber}`}>
      {error && (
        <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-100">{error}</div>
      )}

      <div className="mb-4 grid grid-cols-3 gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-sm">
        <div>
          <p className="text-xs text-slate-500">Payable</p>
          <p className="font-semibold tabular-nums text-slate-900">{money(invoice.payable)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Paid so far</p>
          <p className="font-semibold tabular-nums text-slate-900">{money(invoice.paidTotal)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Balance</p>
          <p className="font-semibold tabular-nums text-indigo-700">{money(invoice.balance)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="pay-amount" className="mb-1.5 block text-xs font-semibold text-slate-700">
            Amount <span className="text-rose-500">*</span>
          </label>
          <input
            id="pay-amount" type="number" min="0" value={amount}
            onChange={(e) => setAmount(e.target.value)} className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="pay-date" className="mb-1.5 block text-xs font-semibold text-slate-700">
            Payment date <span className="text-rose-500">*</span>
          </label>
          <input
            id="pay-date" type="date" value={paidOn} max={todayStr()}
            onChange={(e) => setPaidOn(e.target.value)} className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="pay-mode" className="mb-1.5 block text-xs font-semibold text-slate-700">
            Mode <span className="text-rose-500">*</span>
          </label>
          <select id="pay-mode" value={mode} onChange={(e) => setMode(e.target.value)} className={inputCls}>
            {PAYMENT_MODES.map((m) => (
              <option key={m} value={m}>{PAYMENT_MODE_LABEL[m]}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="pay-ref" className="mb-1.5 block text-xs font-semibold text-slate-700">
            Reference no.
          </label>
          <input
            id="pay-ref" type="text" value={refNo} onChange={(e) => setRefNo(e.target.value)}
            placeholder="UTR / cheque no." className={inputCls}
          />
        </div>
      </div>

      <label htmlFor="pay-remarks" className="mb-1.5 mt-3 block text-xs font-semibold text-slate-700">
        Remarks
      </label>
      <textarea
        id="pay-remarks" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)}
        placeholder="Optional" className={inputCls}
      />

      <div className="mt-3">
        <label htmlFor="pay-proofs" className="mb-1.5 block text-xs font-semibold text-slate-700">
          Receipt / proof <span className="font-normal text-slate-400">(up to 5, JPG PNG WEBP or PDF)</span>
        </label>
        <input
          id="pay-proofs" type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf"
          onChange={pickFiles}
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
        />
        {files.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {files.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                <Paperclip className="h-3 w-3" />
                <span className="max-w-[160px] truncate">{f.name}</span>
                <button type="button" onClick={() => setFiles((p) => p.filter((_, k) => k !== i))} className="text-slate-400 hover:text-rose-600">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {overBalance && (
        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-inset ring-rose-100">
          That is more than the outstanding balance ({money(invoice.balance)}).
        </p>
      )}

      {history.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Already recorded ({history.length})
          </p>
          <div className="max-h-40 space-y-1.5 overflow-y-auto">
            {history.map((p, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs">
                <span className="font-semibold tabular-nums text-slate-900">{money(p.amount)}</span>
                <span className="text-slate-500">{PAYMENT_MODE_LABEL[p.mode] || p.mode}</span>
                <span className="text-slate-500">{fmtDate(p.paidOn)}</span>
                {p.refNo && <span className="text-slate-400">{p.refNo}</span>}
                <span className="ml-auto text-slate-400">{p.byName || "—"}</span>
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
          type="button" onClick={submit} disabled={busy || value <= 0 || overBalance || !paidOn}
          className="rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {busy ? "Saving…" : "Save payment"}
        </button>
      </div>
    </Modal>
  );
};

/* ============================================================= */
/* Main                                                           */
/* ============================================================= */

const PaymentsComp = () => {
  const { permissions, isAdmin } = usePermissions();
  const myActions = useMemo(() => {
    if (isAdmin) return null;
    const mod = (permissions || []).find((m) => m.moduleKey === "payments");
    return new Set((mod?.actions || []).map((a) => String(a).toUpperCase()));
  }, [permissions, isAdmin]);
  const can = (a) => myActions === null || myActions.has(a);
  const canManage = can("MANAGE_ADJUSTMENT");
  const canRequest = can("REQUEST_PAYMENT_APPROVAL");
  const canPay = can("ENTER_PAYMENT");

  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [approvalStatus, setApprovalStatus] = useState("");
  const [paymentState, setPaymentState] = useState("");
  // Payable Now by default: it is what the desk opens the screen for.
  const [payable, setPayable] = useState(PAYABLE_FILTER.NOW);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [vendors, setVendors] = useState([]);
  const [view, setView] = useState({ mode: "list" });
  const [popup, setPopup] = useState(null);
  const [sendingId, setSendingId] = useState(null);

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
      if (approvalStatus) params.set("approvalStatus", approvalStatus);
      if (paymentState) params.set("paymentState", paymentState);
      if (payable && payable !== PAYABLE_FILTER.ALL) params.set("payable", payable);

      const res = await fetch(`${API_BACKEND_URL}/stock/payments?${params.toString()}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to load");
      setRows(json.data?.rows || []);
      setCounts(json.data?.counts || {});
      setTotal(json.pagination?.total || 0);
    } catch (e) {
      setError(e.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, vendorId, approvalStatus, paymentState, payable]);

  useEffect(() => { loadList(); }, [loadList]);

  const vendorOptions = useMemo(() => vendors.map((v) => ({ value: v._id, label: v.name })), [vendors]);

  const refresh = () => { setPopup(null); setView({ mode: "list" }); loadList(); };
  /*
    "All" clears the two CHIP groups and leaves the Payable dropdown alone —
    because that is exactly what its count means. The count answers "how many
    if I click this", and it is worked out with the dropdown still applied, so
    clearing the dropdown too would show more rows than the button promised.
  */
  const clearChips = () => { setApprovalStatus(""); setPaymentState(""); setPage(1); };
  // The Clear Filter button resets everything, dropdown included.
  const clearEverything = () => {
    setSearch(""); setVendorId(""); setApprovalStatus(""); setPaymentState("");
    setPayable(PAYABLE_FILTER.ALL); setPage(1);
  };

  const sendForApproval = async (row) => {
    setSendingId(String(row._id)); setActionError(null);
    try {
      const res = await fetch(`${API_BACKEND_URL}/stock/payments/${row._id}/send-for-approval`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to send");
      loadList();
    } catch (e) {
      setActionError(e.message);
    } finally {
      setSendingId(null);
    }
  };

  // The credit note is a full page — picking units out of a 40-piece delivery
  // needs the room — so it replaces the list rather than opening over it.
  if (view.mode === "creditNote") {
    return (
      <CreditNoteView
        invoice={view.row} adjustment={view.adjustment || null}
        onBack={() => setView({ mode: "list" })} onDone={refresh}
      />
    );
  }

  const Chip = ({ chip, group, value, setValue }) => {
    const active = value === chip.key;
    const Icon = chip.icon;
    return (
      <button
        type="button"
        onClick={() => { setValue(active ? "" : chip.key); setPage(1); }}
        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-semibold shadow-sm transition ${
          active ? chip.on : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
        }`}
        aria-pressed={active}
        aria-label={`${group} ${chip.label}`}
      >
        <Icon className="h-4 w-4" />
        {chip.label}
        <span className={`rounded-full px-1.5 text-xs tabular-nums ${active ? "bg-white/60" : "bg-slate-100 text-slate-500"}`}>
          {counts[chip.count] ?? 0}
        </span>
      </button>
    );
  };

  const anyFilter = !!approvalStatus || !!paymentState || payable !== PAYABLE_FILTER.ALL;

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Payments</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Raise credit notes and misc charges, ask for payment approval once an invoice is due, then record what was paid.
        </p>
      </div>

      {(error || actionError) && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{error || actionError}</span>
          <button type="button" onClick={() => { setError(null); setActionError(null); }} className="font-bold">&times;</button>
        </div>
      )}

      {/* Two independent groups. Picking one from each is the filter accounts
          actually want — "approved but still unpaid". */}
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <button
          type="button" onClick={clearChips}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-semibold shadow-sm transition ${
            anyFilter ? "border-slate-200 bg-white text-slate-500 hover:bg-slate-50" : "border-slate-300 bg-slate-100 text-slate-800"
          }`}
        >
          <LayoutGrid className="h-4 w-4" /> All
          <span className="rounded-full bg-slate-200 px-1.5 text-xs tabular-nums text-slate-600">{counts.ALL ?? 0}</span>
        </button>

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5">
          <span className="mr-1 text-sm font-semibold text-slate-600">Payment Approval</span>
          {APPROVAL_CHIPS.map((c) => (
            <Chip key={c.key} chip={c} group="Payment approval" value={approvalStatus} setValue={setApprovalStatus} />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5">
          <span className="mr-1 text-sm font-semibold text-slate-600">Payment Status</span>
          {STATE_CHIPS.map((c) => (
            <Chip key={c.key} chip={c} group="Payment status" value={paymentState} setValue={setPaymentState} />
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5">
          <CalendarClock className="h-4 w-4 text-slate-400" />
          <select
            value={payable} onChange={(e) => { setPayable(e.target.value); setPage(1); }}
            className="rounded-lg border-0 bg-transparent py-0.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-0"
            aria-label="Payable timing"
          >
            {PAYABLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoice number, PO number or vendor..." className={inputCls}
            />
          </div>
          <SearchableSelect
            value={vendorId} onChange={(v) => { setVendorId(v); setPage(1); }}
            options={vendorOptions} placeholder="All vendors"
          />
          {(search || vendorId || anyFilter) && (
            <button
              type="button"
              onClick={clearEverything}
              className="inline-flex items-center justify-center gap-1 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2 text-sm font-semibold text-rose-600 shadow-sm transition hover:bg-rose-100"
            >
              <RotateCcw className="h-4 w-4" /> Clear Filter
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50/60">
            <tr>
              <th className={th}>Invoice</th>
              <th className={th}>Vendor</th>
              <th className={thRight}>Payable</th>
              <th className={thRight}>Paid</th>
              <th className={thRight}>Balance</th>
              <th className={th}>Terms</th>
              <th className={th}>Payable On</th>
              <th className={th}>Approval</th>
              <th className={th}>Payment</th>
              <th className={thRight}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={10} className="px-4 py-12 text-center text-sm text-slate-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-12 text-center text-sm text-slate-400">
                Nothing here with these filters.
              </td></tr>
            ) : (
              rows.map((r) => {
                const am = approvalMeta(r.approvalStatus);
                const pm = paymentStateMeta(r.paymentState);
                const busy = sendingId === String(r._id);
                return (
                  <tr key={r._id} className="transition hover:bg-slate-50/60">
                    <td className={td}>
                      <span className="block font-semibold text-slate-900">{r.invoiceNumber}</span>
                      <span className="text-[11px] text-slate-400">{r.poNumber || "—"}</span>
                    </td>
                    <td className={td}>{r.vendorName || "—"}</td>
                    <td className={tdRight + " font-semibold text-slate-900"}>
                      {money(r.payable)}
                      {r.adjustmentTotal !== 0 && (
                        <span className={`ml-1 text-[11px] ${r.adjustmentTotal < 0 ? "text-rose-600" : "text-sky-600"}`}>
                          ({r.adjustmentTotal < 0 ? "−" : "+"}{money(Math.abs(r.adjustmentTotal))})
                        </span>
                      )}
                    </td>
                    <td className={tdRight}>{r.paidTotal > 0 ? money(r.paidTotal) : <span className="text-slate-300">—</span>}</td>
                    <td className={tdRight + " font-medium text-indigo-700"}>{money(r.balance)}</td>
                    <td className={td}>{paymentTermShort(r.paymentTerms)}</td>
                    {/* The SCHEDULED date, because that is when this reaches
                        the queue — which is what this screen is for. The
                        contractual due date is shown underneath when the two
                        differ, so a deferred invoice never looks like it simply
                        arrived late. */}
                    <td className={td}>
                      <span className="block">{fmtDate(r.scheduledOn)}</span>
                      {r.rescheduled ? (
                        <span className={`text-[11px] font-semibold ${r.scheduleOffset < 0 ? "text-amber-600" : "text-violet-600"}`}>
                          due {fmtDate(r.dueDate)}
                        </span>
                      ) : r.daysLeft < 0 ? (
                        <span className="text-[11px] font-semibold text-rose-600">{Math.abs(r.daysLeft)} days overdue</span>
                      ) : null}
                    </td>
                    <td className={td}>
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${am.chip}`}>
                        {am.label}
                      </span>
                      {r.approvalStatus === APPROVAL_STATUS.REJECTED && r.paymentApproval?.rejectedReason && (
                        <span className="mt-0.5 block max-w-[170px] truncate text-[11px] text-slate-400" title={r.paymentApproval.rejectedReason}>
                          {r.paymentApproval.rejectedReason}
                        </span>
                      )}
                    </td>
                    <td className={td}>
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${pm.chip}`}>
                        {pm.label}
                      </span>
                    </td>
                    <td className={tdRight}>
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {/* A rejection is one piece of work, not two screens:
                            the reason, the adjustments and the resend live in
                            one popup. */}
                        {r.approvalStatus === APPROVAL_STATUS.REJECTED && canRequest && (
                          <button
                            type="button" onClick={() => setPopup({ type: "fix", row: r })}
                            className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-500"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Fix & resend
                          </button>
                        )}
                        {canManage && r.canEditAdjustments && r.approvalStatus !== APPROVAL_STATUS.REJECTED && (
                          <>
                            <button
                              type="button" onClick={() => setView({ mode: "creditNote", row: r })}
                              title="Claim money back for faulty goods"
                              className="inline-flex items-center rounded-lg border border-rose-200 bg-white px-2 py-1.5 text-xs font-semibold text-rose-600 shadow-sm transition hover:bg-rose-50"
                            >
                              <FileMinus className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button" onClick={() => setPopup({ type: "misc", row: r })}
                              title="Add a charge to what is payable"
                              className="inline-flex items-center rounded-lg border border-sky-200 bg-white px-2 py-1.5 text-xs font-semibold text-sky-600 shadow-sm transition hover:bg-sky-50"
                            >
                              <PlusCircle className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                        {canRequest && r.canSendForApproval && r.approvalStatus !== APPROVAL_STATUS.REJECTED && (
                          <button
                            type="button" disabled={busy} onClick={() => sendForApproval(r)}
                            className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-60"
                          >
                            <Send className="h-3.5 w-3.5" /> {busy ? "Sending…" : "Send for approval"}
                          </button>
                        )}
                        {canPay && r.canEnterPayment && (
                          <button
                            type="button" onClick={() => setPopup({ type: "pay", row: r })}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-500"
                          >
                            <Wallet className="h-3.5 w-3.5" /> {r.paidTotal > 0 ? "Add payment" : "Enter payment"}
                          </button>
                        )}
                        <button
                          type="button" onClick={() => setPopup({ type: "adjustments", row: r })}
                          title="Credit notes and misc charges on this invoice"
                          className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-500 shadow-sm transition hover:bg-slate-50"
                        >
                          <Layers className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <Pagination
          currentPage={page} totalItems={total} itemsPerPage={limit} onPageChange={setPage}
          onItemsPerPageChange={(n) => { setLimit(n); setPage(1); }}
        />
      </div>

      {popup?.type === "adjustments" && (
        <ManageAdjustmentsPopup
          invoice={popup.row} canManage={canManage}
          onClose={() => setPopup(null)}
          onChanged={refresh}
          onAdd={(type) =>
            type === "CREDIT_NOTE"
              ? setView({ mode: "creditNote", row: popup.row })
              : setPopup({ type: "misc", row: popup.row })
          }
          onEdit={(adj) =>
            adj.type === "CREDIT_NOTE"
              ? setView({ mode: "creditNote", row: popup.row, adjustment: adj })
              : setPopup({ type: "misc", row: popup.row, adjustment: adj })
          }
        />
      )}
      {popup?.type === "fix" && (
        <FixAndResendPopup
          invoice={popup.row} canManage={canManage}
          onClose={() => setPopup(null)}
          onChanged={refresh}
          onResent={refresh}
          onAdd={(type) =>
            type === "CREDIT_NOTE"
              ? setView({ mode: "creditNote", row: popup.row })
              : setPopup({ type: "misc", row: popup.row })
          }
          onEdit={(adj) =>
            adj.type === "CREDIT_NOTE"
              ? setView({ mode: "creditNote", row: popup.row, adjustment: adj })
              : setPopup({ type: "misc", row: popup.row, adjustment: adj })
          }
        />
      )}
      {popup?.type === "misc" && (
        <MiscChargePopup
          invoice={popup.row} adjustment={popup.adjustment || null}
          onClose={() => setPopup(null)} onDone={refresh}
        />
      )}
      {popup?.type === "pay" && (
        <RecordPaymentPopup invoice={popup.row} onClose={() => setPopup(null)} onDone={refresh} />
      )}
    </div>
  );
};

export default PaymentsComp;
