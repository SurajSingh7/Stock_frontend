"use client";

import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Send, PackageCheck, AlertTriangle, PencilLine, FileText, Ban, Hourglass } from "lucide-react";
import { Modal } from "@/modules/stock/shared/StockSharedUI";
import { fetchRequest } from "./transferApi";
import { StatusBadge, REQUEST_STATUS, turnOf, lineCells, qtyText, fmtDate, fmtDateTime } from "./shared";

const Skeleton = () => (
  <div className="space-y-3"><div className="h-6 w-1/2 animate-pulse rounded bg-slate-100" /><div className="h-40 animate-pulse rounded-xl bg-slate-100" /></div>
);

// Loads one request through the page (module) it is opened from.
const useRequest = (side, requestId, onClose) => {
  const [r, setR] = useState(null);
  useEffect(() => {
    fetchRequest(side, requestId).then(setR).catch((e) => { toast.error(e.message); onClose(); });
  }, [side, requestId]); // eslint-disable-line react-hooks/exhaustive-deps
  return r;
};

// "Zirakpur asked Azadpur · TRF-… · status" — the top of both popups.
const Header = ({ r }) => (
  <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm">
    <span className="font-bold text-slate-900">{r.requestingBranchId?.name}</span>
    <span className="text-xs text-slate-500">asked</span>
    <span className="font-bold text-slate-900">{r.sourceBranchId?.name}</span>
    {r.transferNumber && <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">{r.transferNumber}</span>}
    <span className="ml-auto"><StatusBadge status={r.status} map={REQUEST_STATUS} /></span>
  </div>
);

const Note = ({ label, text, tone = "slate" }) =>
  text ? (
    <p className={`mt-1.5 rounded-lg px-2.5 py-1.5 text-xs ring-1 ring-inset ${tone === "rose" ? "bg-rose-50 text-rose-800 ring-rose-200" : tone === "amber" ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-slate-50 text-slate-700 ring-slate-200"}`}>
      <b>{label}:</b> {text}
    </p>
  ) : null;

/* ── View — what was asked and what is (or was) on the way ────────────── */

// side: "mine" | "to-us" | "history" — the page (module) it is read through.
export const RequestDetailModal = ({ side, requestId, onClose }) => {
  const r = useRequest(side, requestId, onClose);
  const t = r?.transferId || null;

  return (
    <Modal title={r ? `Stock Request ${r.requestNumber}` : "Stock Request"} onClose={onClose} maxWidth="max-w-3xl">
      {!r ? <Skeleton /> : (
        <div className="space-y-5">
          <Header r={r} />

          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Field label="Requested on" value={fmtDate(r.requestedAt)} hint={r.requestedByName} />
            <Field label="Sent on" value={t ? fmtDate(t.sentAt) : "—"} hint={t?.sentByName} />
            <Field label={r.status === "DECLINED" ? "Declined on" : "Received on"} value={r.closedAt ? fmtDate(r.closedAt) : "—"} hint={r.status === "DECLINED" ? r.processedByName : t?.receivedByName} />
            <Field label="Status" value={REQUEST_STATUS[r.status]?.label} />
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                  <th className="px-4 py-2.5">Category</th>
                  <th className="px-4 py-2.5 text-right">Asked</th>
                  <th className="px-4 py-2.5 text-right">Sent</th>
                  <th className="px-4 py-2.5 text-right">Short</th>
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
          </div>

          {t?.lines?.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{r.status === "RECEIVED" ? "What was received" : "What is on the way"}</p>
              <div className="overflow-hidden rounded-xl border border-slate-200">
                {t.lines.map((l, i) => (
                  <div key={l._id} className={`px-4 py-2.5 ${i ? "border-t border-slate-100" : ""}`}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-slate-900">{l.productName}</span>
                      <span className="font-semibold tabular-nums text-slate-900">{qtyText(l.sentQty, l.unit)}</span>
                    </div>
                    {l.units?.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {l.units.map((u) => (
                          <span key={u.inventoryItemId} title={u.note ? `Sender: ${u.note}` : undefined} className={`rounded-md px-2 py-0.5 font-mono text-[11px] ring-1 ring-inset ${u.note ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-white text-slate-700 ring-slate-200"}`}>{u.label}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(r.remarks || r.reason || t?.note || t?.problemNote) && (
            <div className="space-y-1">
              <Note label="Remarks" text={r.remarks} />
              <Note label={r.status === "DECLINED" ? "Why declined" : "Why less"} text={r.reason} tone={r.status === "DECLINED" ? "rose" : "amber"} />
              <Note label="Sender's note" text={t?.note} />
              <Note label="Problem reported" text={r.status === "MISMATCH" ? t?.problemNote : ""} tone="rose" />
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

const Field = ({ label, value, hint }) => (
  <div className="rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-inset ring-slate-200">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="font-semibold text-slate-900">{value || "—"}</p>
    {hint && <p className="truncate text-xs text-slate-500">{hint}</p>}
  </div>
);

/* ── History — every change, oldest first ─────────────────────────────── */

// One step: who did what, when.
const Step = ({ icon: Icon, tone, title, who, when, children, last }) => (
  <li className="relative flex gap-3 pb-5">
    {!last && <span className="absolute left-4 top-9 h-[calc(100%-2rem)] w-px bg-slate-200" />}
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-white ${tone}`}><Icon className="h-4 w-4" /></span>
    <div className="min-w-0 pt-1">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {(who || when) && <p className="text-xs text-slate-500">{[when && fmtDateTime(when), who].filter(Boolean).join(" · ")}</p>}
      {children}
    </div>
  </li>
);

const linesText = (lines, pick, name) => lines.map((l) => `${name(l)} ${qtyText(pick(l), l.unit)}`).join(", ");

export const RequestHistoryModal = ({ side, requestId, onClose }) => {
  const r = useRequest(side, requestId, onClose);
  const t = r?.transferId || null;
  const asker = r?.requestingBranchId?.name;
  const sender = r?.sourceBranchId?.name;
  const turn = r ? turnOf(r.status) : null;
  // What first went out, before any correction took something off.
  const firstSent = t
    ? t.lines.map((l) => ({
        ...l,
        sentQty: l.sentQty + (t.history || []).flatMap((h) => h.removed || []).filter((x) => x.productName === l.productName).reduce((s, x) => s + x.quantity, 0),
      }))
    : [];

  return (
    <Modal title={r ? `History — ${r.requestNumber}` : "History"} onClose={onClose} maxWidth="max-w-2xl">
      {!r ? <Skeleton /> : (
        <div className="space-y-5">
          <Header r={r} />
          <ol>
            <Step icon={FileText} tone="bg-indigo-50 text-indigo-600" title={`Requested by ${asker}`} who={r.requestedByName} when={r.requestedAt} last={!t && r.status !== "DECLINED" && !turn}>
              <p className="mt-1 text-xs text-slate-700">{linesText(r.lines, (l) => l.requestedQty, (l) => l.categoryPath)}</p>
              <Note label="Remarks" text={r.remarks} />
            </Step>
            {r.status === "DECLINED" && (
              <Step icon={Ban} tone="bg-slate-100 text-slate-500" title={`Declined by ${sender}`} who={r.processedByName} when={r.processedAt} last>
                <Note label="Reason" text={r.reason} tone="rose" />
              </Step>
            )}
            {t && (
              <Step icon={Send} tone="bg-indigo-50 text-indigo-600" title={`Sent by ${sender}`} who={t.sentByName} when={t.sentAt}>
                <p className="mt-1 text-xs text-slate-700">{linesText(firstSent, (l) => l.sentQty, (l) => l.productName)}</p>
                <Note label="Note" text={t.note} />
                <Note label="Why less" text={r.reason} tone="amber" />
              </Step>
            )}
            {(t?.history || []).map((h, i) =>
              h.type === "PROBLEM_REPORTED" ? (
                <Step key={i} icon={AlertTriangle} tone="bg-rose-50 text-rose-600" title={`Problem reported by ${asker}`} who={h.byName} when={h.at}>
                  <Note label="Note" text={h.note} tone="rose" />
                </Step>
              ) : (
                <Step key={i} icon={PencilLine} tone="bg-indigo-50 text-indigo-600" title={`Corrected and resent by ${sender}`} who={h.byName} when={h.at}>
                  {h.removed?.length > 0 ? (
                    <ul className="mt-1.5 space-y-0.5 text-xs text-slate-700">
                      {h.removed.map((x, j) => (
                        <li key={j}>
                          • Took off {x.productName} <b>{qtyText(x.quantity, x.unit)}</b>
                          {x.labels?.length > 0 && <span className="font-mono text-slate-500"> ({x.labels.join(", ")})</span>}
                          <span className="text-emerald-700"> — back to {sender}&apos;s stock</span>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="mt-1 text-xs text-slate-500">Resent unchanged.</p>}
                  <Note label="Note" text={h.note} />
                </Step>
              )
            )}
            {r.status === "RECEIVED" && (
              <Step icon={PackageCheck} tone="bg-emerald-50 text-emerald-600" title={`Received by ${asker}`} who={t?.receivedByName} when={t?.receivedAt} last>
                <p className="mt-1 text-xs text-slate-700">{linesText(t?.lines || [], (l) => l.sentQty, (l) => l.productName)}</p>
              </Step>
            )}
            {turn && (
              <Step
                icon={Hourglass} tone="bg-slate-100 text-slate-500" last
                title={turn === "mine" ? `Waiting for ${asker} to receive it` : r.status === "PENDING" ? `Waiting for ${sender} to send or decline` : `Waiting for ${sender} to correct and resend`}
              />
            )}
          </ol>
        </div>
      )}
    </Modal>
  );
};
