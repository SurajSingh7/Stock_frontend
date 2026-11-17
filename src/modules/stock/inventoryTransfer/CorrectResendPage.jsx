"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowRight, Truck, MessageSquareWarning, StickyNote } from "lucide-react";
import { inputCls, unitLabel } from "@/modules/stock/shared/StockSharedUI";
import { fetchRequest, correctAndResend } from "./transferApi";
import { BackHeader, StatusBadge, REQUEST_STATUS, ConfirmDialog, qtyText, fmtDateTime, lastEvent } from "./shared";

const BACK = "/stock/inventory/transfers/requests-to-us";

const round3 = (n) => Math.round((Number(n) + Number.EPSILON) * 1000) / 1000;

/*
  Correct & Resend — its own page, opened from Requests to Us. The sender fixes
  what the branch that asked reported: untick the units (or lower the
  quantity) that never went — they come back into this branch's Available.
  What stays goes On the Way again for them to check.
*/
const CorrectResendPage = () => {
  const { id } = useParams();
  const router = useRouter();
  const back = () => router.push(BACK);
  const [r, setR] = useState(null);
  const [error, setError] = useState("");
  const [keep, setKeep] = useState({}); // lineId → Set of unit ids | quantity (string, as typed)
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchRequest("to-us", id)
      .then((d) => {
        setR(d);
        setKeep(Object.fromEntries(d.transferId.lines.map((l) => [
          l._id,
          l.trackingMethod === "individual" ? new Set(l.units.map((u) => String(u.inventoryItemId))) : String(l.sentQty),
        ])));
      })
      .catch((e) => setError(e.message));
  }, [id]);

  const header = (
    <BackHeader
      onBack={back}
      title={r ? `Correct & Resend — ${r.requestNumber}` : "Correct & Resend"}
      subtitle={r && (
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold text-slate-800">{r.sourceBranchId?.name}</span>
          <ArrowRight className="h-3.5 w-3.5" />
          <span className="font-semibold text-slate-800">{r.requestingBranchId?.name}</span>
          <span>· Sent {fmtDateTime(r.transferId?.sentAt)}</span>
          {r.transferNumber && <span>· {r.transferNumber}</span>}
        </span>
      )}
    >
      {r && <StatusBadge status={r.status} map={REQUEST_STATUS} />}
    </BackHeader>
  );
  if (error || !r || r.status !== "MISMATCH") {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-5 p-6 pb-12">
        {header}
        {error ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500 shadow-sm">{error}</div>
        ) : !r ? (
          <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
        ) : (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
            This request does not need correcting — it is {REQUEST_STATUS[r.status]?.label}.
          </p>
        )}
      </div>
    );
  }

  const t = r.transferId;
  const from = r.sourceBranchId?.name;
  const to = r.requestingBranchId?.name;
  const individual = (l) => l.trackingMethod === "individual";
  const keptQty = (l) => (individual(l) ? keep[l._id]?.size || 0 : round3(Number(keep[l._id]) || 0));
  const lines = t.lines.map((l) => ({ l, kept: keptQty(l), off: round3(l.sentQty - keptQty(l)) }));
  const takingOff = lines.filter((x) => x.off > 0);
  const toggleUnit = (lineId, id) =>
    setKeep((p) => {
      const s = new Set(p[lineId]);
      if (s.has(id)) s.delete(id); else s.add(id);
      return { ...p, [lineId]: s };
    });

  const check = () => {
    for (const { l } of lines) {
      if (individual(l)) continue;
      const q = Number(keep[l._id]);
      if (keep[l._id] === "" || !Number.isFinite(q) || q < 0 || q > l.sentQty) return `${l.productName}: enter 0 to ${qtyText(l.sentQty, l.unit)}`;
    }
    if (!lines.some((x) => x.kept > 0)) return "At least one item must stay on the transfer";
    return null;
  };

  const submit = async () => {
    setBusy(true);
    try {
      await correctAndResend(r._id, {
        note: note.trim(),
        lines: t.lines.map((l) => (individual(l) ? { lineId: l._id, keepItemIds: [...keep[l._id]] } : { lineId: l._id, keepQty: keptQty(l) })),
      });
      toast.success(`${r.requestNumber} resent — On the Way to ${to}`);
      back();
    } catch (err) {
      toast.error(err.message);
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  const confirmDialog = confirming && (
      <ConfirmDialog
        busy={busy} confirmLabel="Yes, resend"
        message={<>Resend this to <b>{to}</b> for them to check again?</>}
        detail={
          <div className="space-y-2">
            <div>
              <p className="font-semibold text-slate-700">Going</p>
              <ul className="space-y-0.5">{lines.filter((x) => x.kept > 0).map(({ l, kept }) => <li key={l._id}>• {l.productName} — <b>{qtyText(kept, l.unit)}</b></li>)}</ul>
            </div>
            {takingOff.length > 0 && (
              <div>
                <p className="font-semibold text-emerald-700">Back to your Available</p>
                <ul className="space-y-0.5">{takingOff.map(({ l, off }) => <li key={l._id}>• {l.productName} — <b>{qtyText(off, l.unit)}</b></li>)}</ul>
              </div>
            )}
          </div>
        }
        onConfirm={submit} onClose={() => setConfirming(false)}
      />
  );

  const problem = lastEvent(t, "PROBLEM_REPORTED");

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 p-6 pb-12">
        {header}
        {problem && (
          <div className="flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-900 ring-1 ring-inset ring-rose-200">
            <MessageSquareWarning className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p><b>{to} reported a problem:</b> {problem.note}</p>
              <p className="text-xs text-rose-700">{[problem.byName, fmtDateTime(problem.at)].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
        )}
        <p className="text-xs text-slate-500">Keep only what really went. Whatever you take off comes back into your Available stock.</p>

        {lines.map(({ l, kept, off }) => (
          <div key={l._id} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-2xl border-b border-slate-100 bg-slate-50 px-4 py-2.5">
              <p className="text-sm font-bold text-slate-900">{l.productName}</p>
              <p className="text-xs text-slate-500">
                Sent <b className="text-slate-800">{qtyText(l.sentQty, l.unit)}</b> · Going <b className="text-indigo-700">{qtyText(kept, l.unit)}</b>
                {off > 0 && <> · <b className="text-emerald-700">{qtyText(off, l.unit)} back to stock</b></>}
              </p>
            </div>
            {individual(l) ? (
              <div className="flex flex-wrap gap-2 p-3">
                {l.units.map((u) => {
                  const id = String(u.inventoryItemId);
                  const on = keep[l._id]?.has(id);
                  return (
                    <label key={id} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 ring-1 ring-inset transition ${on ? "bg-white ring-slate-200" : "bg-emerald-50/60 ring-emerald-200"}`}>
                      <input type="checkbox" checked={on} onChange={() => toggleUnit(l._id, id)} />
                      <span className={`font-mono text-xs ${on ? "text-slate-800" : "text-emerald-700 line-through"}`}>{u.label}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3">
                <label className="text-xs font-semibold text-slate-600">Really went</label>
                <div className="relative w-36">
                  <input
                    type="number" min="0" max={l.sentQty} value={keep[l._id]}
                    onChange={(e) => setKeep((p) => ({ ...p, [l._id]: e.target.value }))}
                    className={`${inputCls} pr-12`}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-slate-400">{unitLabel(l.unit)}</span>
                </div>
                <span className="text-xs text-slate-400">of {qtyText(l.sentQty, l.unit)}</span>
              </div>
            )}
          </div>
        ))}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <label className="mb-1.5 flex items-center gap-1 text-xs font-bold text-slate-700"><StickyNote className="h-3.5 w-3.5" /> Note for {to}</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. only 30 were loaded, the rest are still here" className={inputCls} />
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={back} className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50">Cancel</button>
          <button
            type="button" onClick={() => { const e = check(); if (e) toast.error(e); else setConfirming(true); }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
          >
            <Truck className="h-4 w-4" /> Correct &amp; Resend
          </button>
        </div>
      {confirmDialog}
    </div>
  );
};

export default CorrectResendPage;
