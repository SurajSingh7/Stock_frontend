"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowRight, PackageCheck, AlertTriangle, StickyNote, PencilLine } from "lucide-react";
import { fetchRequest, receiveRequest, reportProblem } from "./transferApi";
import { StatusBadge, REQUEST_STATUS, BackHeader, ConfirmDialog, ReasonDialog, lineCells, qtyText, fmtDateTime, lastEvent, useTransferAccess } from "./shared";

const BACK = "/stock/inventory/transfers/my-requests";

/*
  Receive — its own page, opened from My Requests. The branch that asked
  checks what came, as a whole:
    All Received    everything lands in this branch's Available → Received
    Report Problem  with a note; the sender corrects and resends → Mismatch
  Either way it goes back to My Requests.
*/
const ReceiveStockPage = () => {
  const { id } = useParams();
  const router = useRouter();
  const access = useTransferAccess();
  const [r, setR] = useState(null);
  const [error, setError] = useState("");
  const [step, setStep] = useState(null); // "receive" | "problem"
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchRequest("mine", id).then(setR).catch((e) => setError(e.message));
  }, [id]);

  const from = r?.sourceBranchId?.name;
  const receive = async () => {
    setBusy(true);
    try {
      await receiveRequest(r._id);
      toast.success(`${r.requestNumber} received — stock added to your branch`);
      router.push(BACK);
    } catch (err) {
      toast.error(err.message);
      setStep(null);
    } finally {
      setBusy(false);
    }
  };
  const problem = async (note) => {
    try {
      await reportProblem(r._id, note);
      toast.success(`Problem reported to ${from}`);
      router.push(BACK);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const t = r?.transferId || { lines: [] };
  const corrected = lastEvent(t, "CORRECTED");
  const waiting = r?.status === "ON_THE_WAY";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 p-6 pb-12">
      <BackHeader
        onBack={() => router.push(BACK)}
        title={r ? `Receive Stock — ${r.requestNumber}` : "Receive Stock"}
        subtitle={r && (
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-slate-800">{from}</span>
            <ArrowRight className="h-3.5 w-3.5" />
            <span className="font-semibold text-slate-800">{r.requestingBranchId?.name}</span>
            <span>· Sent {fmtDateTime(t.sentAt)}{t.sentByName ? ` by ${t.sentByName}` : ""}</span>
            {r.transferNumber && <span>· {r.transferNumber}</span>}
          </span>
        )}
      >
        {r && <StatusBadge status={r.status} map={REQUEST_STATUS} />}
      </BackHeader>

      {error ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500 shadow-sm">{error}</div>
      ) : !r ? (
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
      ) : (
        <>

          {!waiting && (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
              This request is not waiting to be received — it is {REQUEST_STATUS[r.status]?.label}.
            </p>
          )}
          {t.note && (
            <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
              <StickyNote className="mt-0.5 h-4 w-4 shrink-0" /> <span><b>Note from {from}:</b> {t.note}</span>
            </p>
          )}
          {corrected && (
            <div className="flex items-start gap-2 rounded-xl bg-indigo-50 px-4 py-3 text-sm text-indigo-900 ring-1 ring-inset ring-indigo-200">
              <PencilLine className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p><b>Corrected by {from}</b> after your report · {fmtDateTime(corrected.at)}</p>
                {corrected.removed?.length > 0 && (
                  <p className="text-xs">Taken off: {corrected.removed.map((x) => `${x.productName} ${qtyText(x.quantity, x.unit)}`).join(", ")}</p>
                )}
                {corrected.note && <p className="text-xs italic">“{corrected.note}”</p>}
              </div>
            </div>
          )}

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <h2 className="border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-600">What you asked vs what is coming</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2">Category</th>
                  <th className="px-4 py-2 text-right">Asked</th>
                  <th className="px-4 py-2 text-right">Sent</th>
                  <th className="px-4 py-2 text-right">Short</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {r.lines.map((l) => {
                  const c = lineCells(l, r.status);
                  return (
                    <tr key={l._id}>
                      <td className="px-4 py-2.5 font-medium text-slate-900">{l.categoryPath}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{c.asked}</td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{c.sent}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{c.short}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {r.reason && <p className="border-t border-slate-100 px-4 py-2.5 text-xs text-amber-800"><b>Why less:</b> {r.reason}</p>}
          </section>

          {t.lines.map((l) => (
            <section key={l._id} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 rounded-t-2xl border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                <h2 className="text-sm font-bold text-slate-900">{l.productName}</h2>
                <span className="text-sm font-semibold tabular-nums text-slate-800">{qtyText(l.sentQty, l.unit)}</span>
              </div>
              {l.units?.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 p-4">
                  {l.units.map((u) => (
                    <span key={u.inventoryItemId} title={u.note ? `Sender: ${u.note}` : undefined} className={`rounded-md px-2 py-1 font-mono text-xs ring-1 ring-inset ${u.note ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-slate-50 text-slate-700 ring-slate-200"}`}>
                      {u.label}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="px-4 py-3 text-sm text-slate-500">Counted by quantity — check that {qtyText(l.sentQty, l.unit)} arrived.</p>
              )}
            </section>
          ))}

          {waiting && access.canReceive && (
            <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-lg">
              <p className="text-sm text-slate-600">Check what arrived. If everything is here, press <b>All Received</b>. If anything is missing or different, report the problem.</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setStep("problem")} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-600 shadow-sm transition hover:bg-rose-50">
                  <AlertTriangle className="h-4 w-4" /> Report Problem
                </button>
                <button type="button" onClick={() => setStep("receive")} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700">
                  <PackageCheck className="h-4 w-4" /> All Received
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {step === "receive" && (
        <ConfirmDialog
          busy={busy} tone="emerald" confirmLabel="Yes, all received"
          message={<>Did everything arrive from <b>{from}</b>? It all goes into your Available stock.</>}
          detail={<ul className="space-y-0.5">{t.lines.map((l) => <li key={l._id}>• {l.productName} — <b>{qtyText(l.sentQty, l.unit)}</b></li>)}</ul>}
          onConfirm={receive} onClose={() => setStep(null)}
        />
      )}
      {step === "problem" && (
        <ReasonDialog
          title={`Report Problem — ${r.requestNumber}`} confirmLabel="Report Problem" label="What is wrong" placeholder="e.g. only 30 routers arrived, 10 missing"
          message={<>It goes back to <b>{from}</b>. They take off what did not come and resend it for you to check again.</>}
          onSubmit={problem} onClose={() => setStep(null)}
        />
      )}
    </div>
  );
};

export default ReceiveStockPage;
