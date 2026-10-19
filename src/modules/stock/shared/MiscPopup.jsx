"use client";

import React, { useState } from "react";
import { Plus, X } from "lucide-react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import { Modal, inputCls, money } from "@/modules/stock/shared/StockSharedUI";

/* ============================================================= */
/* Misc — the invoice's extra charges (freight, handling…).        */
/*                                                                */
/* Entered with the invoice; accounts edit it here, prefilled with */
/* what was entered. Each row is "In bill" (added after Billing)   */
/* or "Note" (recorded only). Every change keeps who, when and     */
/* why. readOnly shows the same thing to the Invoice List.         */
/* ============================================================= */

const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const billedTotal = (rows) =>
  Math.round(rows.filter((r) => r.includeInBilling !== false).reduce((t, r) => t + (Number(r.amount) || 0), 0) * 100) / 100;

const MiscPopup = ({ invoice, readOnly = false, onClose, onDone }) => {
  const [rows, setRows] = useState(() =>
    (invoice.extraCharges || []).map((c) => ({
      note: c.note || "",
      amount: String(c.amount ?? ""),
      includeInBilling: c.includeInBilling !== false,
    }))
  );
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const before = billedTotal(invoice.extraCharges || []);
  const after = billedTotal(rows);
  const update = (i, k, v) => setRows((p) => p.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const bad = rows.some((r) => !(Number(r.amount) > 0));

  const save = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`${API_BACKEND_URL}/stock/payments/${invoice._id}/misc`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({
          charges: rows.map((r) => ({ note: r.note.trim(), amount: Number(r.amount), includeInBilling: r.includeInBilling })),
          reason: reason.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to save misc");
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const edits = [...(invoice.miscEdits || [])].reverse();

  return (
    <Modal onClose={onClose} maxWidth="max-w-xl">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-slate-900">Misc · {invoice.invoiceNumber}</p>
          <p className="text-xs text-slate-500">{invoice.vendorName || "—"} · added after Billing</p>
        </div>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 px-3 py-5 text-center text-sm text-slate-400">No misc on this invoice.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className={`flex flex-wrap items-center gap-2 ${r.includeInBilling ? "" : "opacity-75"}`}>
              <input
                value={r.note} disabled={readOnly} onChange={(e) => update(i, "note", e.target.value)}
                placeholder="e.g. Transport" className={`${inputCls} min-w-0 flex-1`}
              />
              <input
                type="number" min="0" value={r.amount} disabled={readOnly} onChange={(e) => update(i, "amount", e.target.value)}
                placeholder="Amount" className={`${inputCls} w-28 text-right`}
              />
              <span className="inline-flex overflow-hidden rounded-lg border border-slate-200 text-xs font-semibold">
                {[true, false].map((v) => (
                  <button
                    key={String(v)} type="button" disabled={readOnly}
                    onClick={() => update(i, "includeInBilling", v)}
                    className={`px-2.5 py-1.5 ${r.includeInBilling === v ? "bg-indigo-600 text-white" : "bg-white text-slate-500"}`}
                  >
                    {v ? "In bill" : "Note"}
                  </button>
                ))}
              </span>
              {!readOnly && (
                <button type="button" onClick={() => setRows((p) => p.filter((_, j) => j !== i))} className="rounded-md p-1 text-slate-400 hover:text-rose-600">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!readOnly && (
        <button
          type="button" onClick={() => setRows((p) => [...p, { note: "", amount: "", includeInBilling: true }])}
          className="mt-2 inline-flex items-center gap-1 rounded-lg border border-blue-300 bg-white px-2.5 py-1 text-xs font-semibold text-blue-600 shadow-sm hover:bg-blue-50"
        >
          <Plus className="h-3.5 w-3.5" /> Add misc
        </button>
      )}

      <div className="mt-4 flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
        <span className="text-slate-500">Misc in bill</span>
        <span className="font-semibold tabular-nums text-sky-700">
          {readOnly || after === before ? money(before) : <>{money(before)} → {money(after)}</>}
        </span>
      </div>

      {!readOnly && (
        <>
          <label className="mb-1 mt-3 block text-xs font-semibold text-slate-600">Reason for the change <span className="text-rose-500">*</span></label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} placeholder="e.g. freight bill received" />
        </>
      )}

      {edits.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-semibold text-indigo-600">Changed {edits.length}× — history</summary>
          <ol className="mt-2 space-y-1.5">
            {edits.map((e, i) => (
              <li key={i} className="flex gap-2 text-xs">
                <span className="w-36 shrink-0 text-slate-400">{fmtDateTime(e.at)}</span>
                <span className="text-slate-700">
                  {money(e.fromTotal)} → {money(e.toTotal)}
                  {e.byName ? <span className="text-slate-500"> · {e.byName}</span> : null}
                  {e.reason ? <span className="block text-slate-500">“{e.reason}”</span> : null}
                </span>
              </li>
            ))}
          </ol>
        </details>
      )}

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50">
          {readOnly ? "Close" : "Cancel"}
        </button>
        {!readOnly && (
          <button
            type="button" onClick={save} disabled={busy || bad || !reason.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {busy ? "Saving…" : "Save misc"}
          </button>
        )}
      </div>
    </Modal>
  );
};

export default MiscPopup;
