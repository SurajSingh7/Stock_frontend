"use client";

import React, { useState } from "react";

/*
  What has been entered on an invoice as a card, a Σ total per product, and
  the line-by-line log folded away below — the Add Items screen's "Entry"
  popup.

  Works off an invoice as GET /invoices/:id returns it, or a row of the
  invoice board: `lines`, `entryLog`.
*/

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
export const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

const STATUS_META = {
  UPLOADED: { label: "Invoice Uploaded", cls: "bg-slate-100 text-slate-700" },
  DRAFT: { label: "Draft", cls: "bg-sky-100 text-sky-700" },
  PENDING: { label: "Pending approval", cls: "bg-amber-100 text-amber-800" },
  APPROVED: { label: "Approved", cls: "bg-emerald-100 text-emerald-700" },
  REJECTED: { label: "Rejected", cls: "bg-rose-100 text-rose-700" },
};
const StatusChip = ({ status }) => {
  const m = STATUS_META[status] || { label: status, cls: "bg-slate-100 text-slate-600" };
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.cls}`}>{m.label}</span>;
};

// One change chip: "single-sy-2010 +3", "CAT-5 −1", "+2 FOC".
const ChangeChip = ({ it }) => {
  const parts = [];
  if (it.quantity) parts.push({ v: it.quantity, foc: false });
  if (it.focQuantity) parts.push({ v: it.focQuantity, foc: true });
  if (!parts.length) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
      <span className="font-medium">{it.productName}</span>
      {parts.map((p, i) => (
        <span key={i} className="font-semibold tabular-nums text-slate-900">
          {p.v > 0 ? "+" : "−"}{Math.abs(p.v)}{p.foc ? " FOC" : ""}
        </span>
      ))}
    </span>
  );
};

// Who entered what, newest first — one row per Save as Draft / Submit.
const EntryHistory = ({ log }) => (
  <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
    <table className="w-full min-w-full border-collapse text-xs">
      <thead className="bg-slate-50">
        <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-slate-600">
          <th className="px-3 py-2">When</th>
          <th className="px-3 py-2">By</th>
          <th className="px-3 py-2">Action</th>
          <th className="px-3 py-2">Changes</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {log.map((e, i) => {
          const chips = (e.items || []).filter((it) => it.quantity || it.focQuantity);
          const submitted = e.action === "SUBMIT";
          return (
            <tr key={i}>
              <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-500">{fmtDateTime(e.at)}</td>
              <td className="whitespace-nowrap px-3 py-2 font-semibold text-slate-900">{e.byName || "—"}</td>
              <td className="whitespace-nowrap px-3 py-2">
                <span className={`rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-medium ${submitted ? "text-slate-900" : "text-slate-500"}`}>
                  {submitted ? "Submitted" : "Draft saved"}
                </span>
              </td>
              <td className="px-3 py-2">
                {chips.length ? (
                  <div className="flex flex-wrap gap-1">{chips.map((it, j) => <ChangeChip key={j} it={it} />)}</div>
                ) : (
                  <span className="text-slate-400">{submitted ? "Submitted as saved — no change" : "No change"}</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

/*
  The entry as a card, styled like the Current Invoice box: header (status,
  when, total, FOC) and its products below. A rejected invoice is faded and
  carries its reason.
*/
const EntryCard = ({ card }) => {
  const { title, status, at, lines, contributors, rejectedReason, reviewedByName } = card;
  const total = lines.reduce((t, l) => t + (l.qty || 0), 0);
  const foc = lines.reduce((t, l) => t + (l.foc || 0), 0);
  return (
    <div className={`overflow-hidden rounded-xl border border-indigo-200 bg-white shadow-sm ${status === "REJECTED" ? "opacity-80" : ""}`}>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-indigo-100 bg-indigo-50/70 px-3 py-1.5 text-[11px]">
        <span className="font-bold uppercase tracking-wider text-indigo-800">{title}</span>
        <StatusChip status={status} />
        {at && <span className="text-slate-500">{fmtDateTime(at)}</span>}
        <span className="ml-auto whitespace-nowrap text-slate-600">
          Total <span className="font-semibold text-slate-900">{total}</span>
          <span className="mx-1.5 text-slate-300">·</span>
          FOC <span className={`font-semibold ${foc ? "text-amber-700" : "text-slate-900"}`}>{foc}</span>
        </span>
      </div>
      {contributors?.length > 0 && (
        <p className="border-b border-slate-100 px-3 py-1 text-[10px] text-slate-500">
          Entered by {contributors.map((c) => `${c.name} (${fmtDate(c.at)})`).join(" · ")}
        </p>
      )}
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-slate-600">
            <th className="px-3 py-1">Category</th>
            <th className="px-3 py-1">Product</th>
            <th className="w-16 px-3 py-1 text-right">Qty</th>
            <th className="w-16 px-3 py-1 text-right">FOC</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {lines.length === 0 ? (
            <tr><td colSpan={4} className="px-3 py-1 text-slate-500">Nothing entered yet.</td></tr>
          ) : (
            lines.map((l, i) => (
              <tr key={i}>
                <td className="px-3 py-1 text-slate-600">{l.category || "—"}</td>
                <td className="px-3 py-1 font-medium text-slate-800">{l.productName}</td>
                <td className="px-3 py-1 text-right font-semibold tabular-nums text-indigo-700">{l.qty || 0}</td>
                <td className={`px-3 py-1 text-right tabular-nums ${l.foc ? "font-semibold text-amber-700" : "text-slate-500"}`}>{l.foc || 0}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {status === "REJECTED" && rejectedReason && (
        <p className="border-t border-rose-100 bg-rose-50/60 px-3 py-1 text-[10px] text-rose-700">
          Rejected: “{rejectedReason}”{reviewedByName ? ` — rejected by ${reviewedByName}` : ""}
        </p>
      )}
    </div>
  );
};

// The card + per-product totals, worked out once from the invoice.
export function entryView(invoice) {
  // One entry — the invoice itself. Everyone who saved a part of it is named.
  const seen = new Map();
  (invoice.entryLog || []).forEach((x) => { if (x.byName && !seen.has(x.byName)) seen.set(x.byName, x.at); });
  const last = (invoice.entryLog || [])[(invoice.entryLog || []).length - 1];
  const card = {
    title: "Invoice entry",
    status: invoice.status,
    at: last?.at || null,
    contributors: [...seen].map(([name, at]) => ({ name, at })),
    rejectedReason: invoice.rejectedReason,
    reviewedByName: invoice.reviewedByName,
    lines: (invoice.lines || [])
      .filter((l) => (l.receivedQuantity || 0) > 0 || (l.focQuantity || 0) > 0)
      .map((l) => ({ category: l.categoryPath || l.categoryName || "", productName: l.productName, qty: l.receivedQuantity || 0, foc: l.focQuantity || 0 })),
  };

  const totals = (invoice.lines || []).map((l) => {
    const invoiceQty = l.invoiceQuantity || 0;
    const entered = l.receivedQuantity || 0;
    return { productName: l.productName, invoiceQty, entered, foc: l.focQuantity || 0, left: Math.max(0, invoiceQty - entered) };
  });
  const sum = (f) => totals.reduce((t, r) => t + (r[f] || 0), 0);
  return { card, totals, sum };
}

const TONE = {
  entered: "font-semibold text-indigo-700",
  foc: "font-semibold text-amber-700",
  left: "font-semibold text-amber-700",
};
const COLS = [["invoiceQty", "Invoice qty"], ["entered", "Entered"], ["foc", "FOC"], ["left", "Left"]];

// The popup body: the card, Σ total, detailed log.
export const EntriesContent = ({ invoice }) => {
  const [showLog, setShowLog] = useState(false);
  const { card, totals, sum } = entryView(invoice);
  const log = (invoice.entryLog || []).slice().reverse();

  return (
    <div className="space-y-3">
      <EntryCard card={card} />

      <div className="overflow-hidden rounded-xl border-2 border-indigo-300 bg-white shadow-sm">
        <p className="border-b border-indigo-100 bg-indigo-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-indigo-800">
          Σ Total — this invoice
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-slate-600">
                <th className="px-3 py-1">Product</th>
                {COLS.map(([k, label]) => <th key={k} className="whitespace-nowrap px-3 py-1 text-right">{label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-slate-800">
              {totals.map((r, i) => (
                <tr key={i}>
                  <td className="px-3 py-1 font-medium">{r.productName}</td>
                  {COLS.map(([k]) => (
                    <td key={k} className={`px-3 py-1 text-right tabular-nums ${r[k] ? TONE[k] || "" : "text-slate-500"}`}>{r[k] || 0}</td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-indigo-100 bg-indigo-50/60 font-semibold text-slate-900">
                <td className="px-3 py-1.5">Total</td>
                {COLS.map(([k]) => <td key={k} className="px-3 py-1.5 text-right tabular-nums">{sum(k)}</td>)}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {log.length > 0 && (
        <div>
          <button type="button" onClick={() => setShowLog((v) => !v)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900">
            <span className="text-slate-400">{showLog ? "▾" : "▸"}</span> Detailed log
            <span className="rounded-full bg-slate-100 px-1.5 text-[10px] font-semibold text-slate-600">{log.length}</span>
          </button>
          {showLog && <EntryHistory log={log} />}
        </div>
      )}
    </div>
  );
};
