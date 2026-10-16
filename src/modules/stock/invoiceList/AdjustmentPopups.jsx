"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import { Plus, X } from "lucide-react";
import { Modal, inputCls, money } from "@/modules/stock/shared/StockSharedUI";

const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export const ADJUSTMENT_META = {
  DEBIT_NOTE: { label: "Debit note", tone: "text-rose-700", chip: "bg-rose-50 text-rose-700 ring-rose-200", sign: "−" },
  MISC: { label: "Misc charge", tone: "text-sky-700", chip: "bg-sky-50 text-sky-700 ring-sky-200", sign: "+" },
};

/* ============================================================= */
/* Misc charge — a popup, not a page. Unlike a debit note it has */
/* no items to pick through: a description, an amount, a reason.  */
/* And it ADDS to the payable, which the copy says outright so    */
/* nobody reads it as the deduction its sibling is.               */
/*                                                                */
/* Pass `adjustment` to edit one. The server reverses the old     */
/* figure and applies the new one in a single transaction, so     */
/* editing is exactly as safe as creating.                        */
/* ============================================================= */
export const MiscChargePopup = ({ invoice, adjustment = null, onClose, onDone }) => {
  const isEdit = !!adjustment;
  const [rows, setRows] = useState(() =>
    isEdit && adjustment.extras?.length
      ? adjustment.extras.map((e) => ({ note: e.note || "", amount: String(e.amount ?? "") }))
      : [{ note: "", amount: "" }]
  );
  const [reason, setReason] = useState(isEdit ? adjustment.reason || "" : "");
  const [editReason, setEditReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const total = useMemo(
    () => Math.round(rows.reduce((s, r) => s + (Number(r.amount) || 0), 0) * 100) / 100,
    [rows]
  );

  // The payable already includes this charge while editing, so the preview has
  // to take the old figure back out before adding the new one.
  const basePayable = isEdit ? (invoice.payable || 0) - (adjustment.amount || 0) : invoice.payable || 0;

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const extras = rows
        .filter((r) => Number(r.amount) > 0)
        .map((r) => ({ note: r.note, amount: Number(r.amount) }));
      const url = isEdit
        ? `${API_BACKEND_URL}/stock/payments/adjustments/${adjustment._id}`
        : `${API_BACKEND_URL}/stock/payments/${invoice._id}/adjustments`;

      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(
          isEdit
            ? { extras, reason: reason.trim(), editReason: editReason.trim() }
            : { type: "MISC", extras, reason: reason.trim() }
        ),
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

  return (
    <Modal
      onClose={onClose}
      title={`${isEdit ? "Edit misc charge" : "Misc charge"} · Invoice ${invoice.invoiceNumber}`}
    >
      {error && (
        <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-100">{error}</div>
      )}

      <p className="mb-4 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800 ring-1 ring-inset ring-sky-100">
        A misc charge <strong>increases</strong> what is payable — freight, handling, anything the vendor passed on.
      </p>

      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700">Charges</span>
        <button
          type="button" onClick={() => setRows((p) => [...p, { note: "", amount: "" }])}
          className="inline-flex items-center gap-1 rounded-lg border border-blue-300 bg-white px-2.5 py-1 text-xs font-semibold text-blue-600 shadow-sm transition hover:bg-blue-50"
        >
          <Plus className="h-3.5 w-3.5" /> Add row
        </button>
      </div>

      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text" value={r.note}
              onChange={(e) => setRows((p) => p.map((x, k) => (k === i ? { ...x, note: e.target.value } : x)))}
              placeholder="Description"
              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            <input
              type="number" min="0" value={r.amount}
              onChange={(e) => setRows((p) => p.map((x, k) => (k === i ? { ...x, amount: e.target.value } : x)))}
              placeholder="Amount"
              className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            {rows.length > 1 && (
              <button
                type="button" onClick={() => setRows((p) => p.filter((_, k) => k !== i))}
                className="rounded-md border border-rose-200 bg-white p-1.5 text-rose-600 shadow-sm transition hover:bg-rose-50"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      <label htmlFor="misc-reason" className="mb-1.5 mt-4 block text-xs font-semibold text-slate-700">
        Reason <span className="text-rose-500">*</span>
      </label>
      <textarea
        id="misc-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
        placeholder="Why this is being charged…"
        className={inputCls}
      />

      {isEdit && (
        <>
          <label htmlFor="misc-edit-reason" className="mb-1.5 mt-3 block text-xs font-semibold text-slate-700">
            What changed
          </label>
          <input
            id="misc-edit-reason" type="text" value={editReason}
            onChange={(e) => setEditReason(e.target.value)}
            placeholder="Kept with the edit history" className={inputCls}
          />
        </>
      )}

      <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
        <span className="text-slate-500">Total</span>
        <span className="font-semibold tabular-nums text-slate-900">
          +{money(total)} &nbsp;·&nbsp; payable {money(basePayable)} &rarr; {money(basePayable + total)}
        </span>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button" onClick={onClose} disabled={busy}
          className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button" onClick={submit} disabled={busy || total <= 0 || !reason.trim()}
          className="rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {busy ? "Saving…" : isEdit ? "Save changes" : "Apply charge"}
        </button>
      </div>
    </Modal>
  );
};

/* ============================================================= */
/* Read-only view of everything on an invoice. The Invoice List   */
/* uses this to explain why payable differs from the invoice;     */
/* changing any of it happens on the Payments screen.             */
/* ============================================================= */
export const AdjustmentHistoryPopup = ({ invoice, basePath = "invoice-list", onClose }) => {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_BACKEND_URL}/stock/${basePath}/${invoice._id}/adjustments`,
        { credentials: "include" }
      );
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to load");
      setRows(json.data || []);
    } catch (e) {
      setError(e.message);
      setRows([]);
    }
  }, [invoice._id, basePath]);

  useEffect(() => { load(); }, [load]);

  return (
    <Modal onClose={onClose} title={`Adjustments · Invoice ${invoice.invoiceNumber}`} maxWidth="max-w-2xl">
      {error && (
        <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-100">{error}</div>
      )}

      {rows === null ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />)}
        </div>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">Nothing has been raised on this invoice.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((a) => <AdjustmentCard key={a._id} adjustment={a} />)}
        </div>
      )}
    </Modal>
  );
};

/* One adjustment, rendered the same way wherever it appears. */
export const AdjustmentCard = ({ adjustment: a, actions = null }) => {
  const meta = ADJUSTMENT_META[a.type] || {};
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`text-sm font-semibold ${meta.tone || "text-slate-800"}`}>{meta.label || a.type}</span>
        <span className="ml-auto font-bold tabular-nums text-slate-900">
          {meta.sign}{money(a.amount)}
        </span>
        {actions}
      </div>

      <p className="mt-1.5 text-sm text-slate-800">{a.reason || "—"}</p>

      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>{a.createdByName || "—"} · {fmtDateTime(a.createdOn || a.createdAt)}</span>
        {(a.edits || []).length > 0 && (
          <span title={a.edits.map((e) => `${money(e.fromAmount)} → ${money(e.toAmount)} · ${e.byName}`).join("\n")}>
            edited {a.edits.length}×
          </span>
        )}
      </div>

      {(a.lines || []).length > 0 && (
        <div className="mt-2.5 space-y-1">
          {a.lines.map((l, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs">
              <span className="font-medium text-slate-800">{l.productName}</span>
              <span className="text-slate-500">{l.quantity} &times; {money(l.rate)}</span>
              {l.gstRate > 0 && <span className="text-slate-400">+{l.gstRate}% GST</span>}
              <span className="ml-auto font-semibold tabular-nums text-slate-800">{money(l.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {(a.extras || []).length > 0 && (
        <div className="mt-1.5 space-y-1">
          {a.extras.map((e, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs">
              <span className="text-slate-700">{e.note || "—"}</span>
              <span className="ml-auto font-semibold tabular-nums text-slate-800">{money(e.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
