"use client";

import React, { useState, useEffect } from "react";
import { History, Info } from "lucide-react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import { Modal, inputCls, money } from "@/modules/stock/shared/StockSharedUI";
import { dnStatusMeta, DN_ACTION_LABEL, DN_STATUS } from "@/modules/stock/shared/debitNoteStatus";

/* ============================================================= */
/* Debit note pieces shared by the Invoice List (raiser) and       */
/* Payments (reviewer): the status cell, the full history, and     */
/* the withdraw confirm.                                           */
/* ============================================================= */

const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export const DnChip = ({ status }) => {
  const m = dnStatusMeta(status);
  return (
    <span title={m.hint} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${m.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
};

/*
  The column: the LATEST note's number and status, its last note behind ⓘ
  when it was rejected, how many there have been (🕘 opens all of them), and
  what is already approved when the latest is still moving.
*/
export const DebitNoteCell = ({ summary, onHistory }) => {
  if (!summary) return <span className="text-slate-300">—</span>;
  const { latest, count, approvedTotal } = summary;
  const rejected = [DN_STATUS.REVIEW_REJECTED, DN_STATUS.APPROVAL_REJECTED].includes(latest.status);
  return (
    <div className="flex flex-col gap-0.5">
      <span className="inline-flex items-center gap-1.5">
        <span className="text-xs font-semibold text-slate-700">DN-{latest.dnNumber}</span>
        <DnChip status={latest.status} />
        {rejected && latest.lastNote && (
          <span title={`${latest.lastByName ? latest.lastByName + ": " : ""}${latest.lastNote}`} className="text-slate-400">
            <Info className="h-3.5 w-3.5" />
          </span>
        )}
        <button
          type="button" onClick={onHistory} title="Every debit note on this invoice, with history"
          className="inline-flex items-center gap-0.5 rounded-md border border-slate-200 bg-white px-1 py-0.5 text-[10px] font-semibold text-slate-500 shadow-sm transition hover:bg-slate-50"
        >
          <History className="h-3 w-3" /> {count}
        </button>
      </span>
      <span className="text-[11px] text-slate-400">
        {money(latest.amount)}
        {latest.status !== DN_STATUS.APPROVED && approvedTotal > 0 ? ` · ${money(approvedTotal)} approved` : ""}
      </span>
    </div>
  );
};

/* Every debit note on one invoice, newest first, each with its own timeline. */
export const DebitNoteHistoryPopup = ({ invoice, basePath = "invoice-list", onClose }) => {
  const [notes, setNotes] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BACKEND_URL}/stock/${basePath}/${invoice._id}/debit-notes`, { credentials: "include" });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message || "Failed to load debit notes");
        setNotes(json.data || []);
      } catch (e) {
        setError(e.message);
        setNotes([]);
      }
    })();
  }, [invoice._id, basePath]);

  return (
    <Modal onClose={onClose} maxWidth="max-w-2xl">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-slate-900">Debit notes · {invoice.invoiceNumber}</p>
          <p className="text-xs text-slate-500">{invoice.vendorName || "—"} · newest first</p>
        </div>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
      </div>

      {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {notes === null ? (
        <p className="py-8 text-center text-sm text-slate-400">Loading…</p>
      ) : notes.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">No debit note on this invoice.</p>
      ) : (
        <div className="space-y-3">
          {notes.map((n) => (
            <div key={n._id} className="rounded-xl border border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5">
                <span className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">DN-{n.dnNumber}</span>
                  <DnChip status={n.status} />
                </span>
                <span className="text-sm font-bold tabular-nums text-rose-700">−{money(n.amount)}</span>
              </div>
              <div className="space-y-1 px-4 py-2.5 text-sm">
                {(n.lines || []).map((l, i) => (
                  <div key={i} className="flex justify-between text-slate-600">
                    <span>{l.quantity} × {l.productName} @ {money(l.rate)}{l.gstRate ? ` +${l.gstRate}%` : ""}</span>
                    <span className="tabular-nums">{money(l.amount)}</span>
                  </div>
                ))}
                {(n.extras || []).map((e, i) => (
                  <div key={`e${i}`} className="flex justify-between text-slate-600">
                    <span>{e.note || "Other deduction"}</span>
                    <span className="tabular-nums">{money(e.amount)}</span>
                  </div>
                ))}
                {n.reason && <p className="pt-1 text-xs text-slate-500">Reason: {n.reason}</p>}
              </div>
              <ol className="space-y-1.5 border-t border-slate-100 px-4 py-2.5">
                {[...(n.history || [])].reverse().map((h, i) => (
                  <li key={i} className="flex gap-2 text-xs">
                    <span className="w-36 shrink-0 text-slate-400">{fmtDateTime(h.at)}</span>
                    <span className="text-slate-700">
                      <span className="font-semibold">{DN_ACTION_LABEL[h.action] || h.action}</span>
                      {h.byName ? <span className="text-slate-500"> · {h.byName}</span> : null}
                      {h.fromAmount != null && h.toAmount != null && h.fromAmount !== h.toAmount ? (
                        <span className="text-slate-500"> · {money(h.fromAmount)} → {money(h.toAmount)}</span>
                      ) : null}
                      {h.note ? <span className="block text-slate-500">“{h.note}”</span> : null}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
};

/* The raiser drops a note still in review. */
export const WithdrawDebitNotePopup = ({ invoice, onClose, onDone }) => {
  const dn = invoice.debitNote?.latest;
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`${API_BACKEND_URL}/stock/invoice-list/debit-notes/${dn._id}/withdraw`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to withdraw");
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} title={`Withdraw DN-${dn?.dnNumber} · ${invoice.invoiceNumber}`}>
      <p className="mb-3 text-sm text-slate-600">
        The debit note of {money(dn?.amount || 0)} is dropped, and its held units go back to available stock. A new
        one can be raised afterwards.
      </p>
      <label className="mb-1 block text-xs font-semibold text-slate-600">Reason (optional)</label>
      <input value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} placeholder="Why it is no longer needed" />
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50">Cancel</button>
        <button
          type="button" onClick={submit} disabled={busy}
          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-500 disabled:opacity-60"
        >
          {busy ? "Withdrawing…" : "Withdraw"}
        </button>
      </div>
    </Modal>
  );
};
