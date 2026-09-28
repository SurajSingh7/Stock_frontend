"use client";

import React, { useState, useEffect, useCallback } from "react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import Pagination from "@/shared/ui/pagination/Pagination";
import { ArrowLeft, Calculator, Receipt, AlertTriangle, Wallet, Percent, Info } from "lucide-react";
import { Modal, money } from "@/modules/stock/shared/StockSharedUI";
import { paymentStateMeta } from "@/modules/stock/shared/paymentStatus";
import { stageMeta } from "@/modules/stock/shared/ledgerStages";
import { paymentTermShort } from "@/modules/stock/shared/paymentTerms";
import InvoiceCalculationView from "./InvoiceCalculationView";
import {
  th, thRight, td, tdRight, num, fmtDate, Tile, ErrorBanner, FootNote,
} from "./reportUi";

/* ============================================================= */
/* The invoices behind one vendor's row.                          */
/*                                                                */
/* A table, because the job here is comparing invoices — four      */
/* rows of basic/GST/billing read down a column in one glance,     */
/* which is exactly what cards destroy.                            */
/*                                                                */
/* Detail lives one click away instead, at two depths:             */
/*   info        a popup — what is ON this invoice (its lines),    */
/*               without leaving the table or losing your place.   */
/*   Calculation a full page — the whole working, credit notes and */
/*               payments included.                                */
/*                                                                */
/* Shared by Billing and Outstanding because it is the same drill: */
/* a rolled-up figure opened to show the documents underneath.     */
/* `mode` picks the columns — Billing wants the tax split,         */
/* Outstanding wants what is still owed and why.                    */
/*                                                                */
/* Both read the same endpoint the Invoice Breakup page uses, each */
/* through its OWN route so the permission matches the report that */
/* linked here. A drill-down that 403s is worse than none.         */
/* ============================================================= */

export const MODE = { BILLING: "BILLING", OUTSTANDING: "OUTSTANDING" };

/* One figure in a summary strip. */
const Bit = ({ label, value, tone = "text-slate-900", lead }) => (
  <span className="text-slate-500">
    {lead}
    {label} <strong className={tone}>{value}</strong>
  </span>
);

/* ── What is on one invoice ────────────────────────────────────── */
/*
  Module scope, not declared inside the page: a component created during a
  render is a new type every render, so React would remount the popup on every
  keystroke and re-render behind it.

  Deliberately NOT the whole Calculation page in a modal. This answers "what
  did we buy and at what price"; the arithmetic walkthrough — credit notes,
  payments, what is still owed — stays on its own page, reachable from the
  button at the bottom. Two copies of that working would be two things to keep
  in step.
*/
const InvoiceDetailPopup = ({ row: r, onClose, onCalculation }) => {
  const isIgst = r.taxType === "IGST";
  const pm = paymentStateMeta(r.paymentState);
  const sm = stageMeta(r.stage);

  return (
    <Modal onClose={onClose} title={`Invoice ${r.invoiceNumber}`} maxWidth="max-w-4xl">
      {/* Identity. PO and date sit beside the number because nothing in the
          system makes an invoice number unique on its own. */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-xl bg-slate-50 px-4 py-3 text-sm sm:grid-cols-4">
        <div>
          <p className="text-xs text-slate-500">PO number</p>
          <p className="font-medium text-slate-900">{r.poNumber || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Invoice date</p>
          <p className="font-medium text-slate-900">{fmtDate(r.invoiceDate)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Due on</p>
          <p className="font-medium text-slate-900">
            {fmtDate(r.dueDate)}
            {r.paymentTerms ? <span className="text-slate-400"> · {paymentTermShort(r.paymentTerms)}</span> : null}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Tax</p>
          <p className={`font-medium ${isIgst ? "text-violet-600" : "text-slate-900"}`}>
            {isIgst ? "IGST · inter-state" : "CGST + SGST · same state"}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${pm.chip}`}>
          {pm.label}
        </span>
        {r.outstanding > 0 && (
          <span title={sm.hint} className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${sm.chip}`}>
            {sm.label}
          </span>
        )}
        {r.daysOverdue > 0 && (
          <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
            {r.daysOverdue} days overdue
          </span>
        )}
      </div>

      {r.rejectedReason && (
        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-inset ring-rose-100">
          Payment approval sent back: {r.rejectedReason}
        </p>
      )}

      {/* The lines — the reason this popup exists. A basic figure with nothing
          behind it was the complaint. */}
      <p className="mb-2 mt-4 text-xs font-bold uppercase tracking-wider text-slate-700">
        Item lines ({r.lines.length})
      </p>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full">
          <thead className="bg-slate-50/80">
            <tr>
              <th className={th}>Category</th>
              <th className={th}>Product</th>
              <th className={thRight}>Qty</th>
              <th className={thRight}>FOC</th>
              <th className={thRight}>Unit Price</th>
              <th className={thRight}>Basic</th>
              <th className={thRight}>GST %</th>
              {isIgst ? (
                <th className={thRight}>IGST</th>
              ) : (
                <>
                  <th className={thRight}>CGST</th>
                  <th className={thRight}>SGST</th>
                </>
              )}
              <th className={thRight}>Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {r.lines.length === 0 ? (
              <tr><td colSpan={isIgst ? 9 : 10} className="px-3 py-5 text-center text-sm text-slate-400">
                This invoice has no item lines.
              </td></tr>
            ) : (
              r.lines.map((l, i) => (
                <tr key={i}>
                  <td className={td + " text-xs text-slate-500"}>{l.categoryName || "—"}</td>
                  <td className={td + " font-medium text-slate-900"}>{l.productName || "—"}</td>
                  <td className={tdRight}>{l.quantity}</td>
                  {/* FOC units arrive but are never priced. "Forty came, why is
                      thirty-six billed" is answered here and nowhere else. */}
                  <td className={tdRight}>
                    {l.focQuantity
                      ? <span className="font-semibold text-amber-600">{l.focQuantity}</span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                  <td className={tdRight}>{money(l.unitPrice)}</td>
                  <td className={tdRight + " font-medium text-slate-900"}>{money(l.basic)}</td>
                  <td className={tdRight + " text-xs text-slate-500"}>{l.gstRate}%</td>
                  {isIgst ? (
                    <td className={tdRight + " text-violet-700"}>{money(l.igst)}</td>
                  ) : (
                    <>
                      <td className={tdRight + " text-violet-700"}>{money(l.cgst)}</td>
                      <td className={tdRight + " text-violet-700"}>{money(l.sgst)}</td>
                    </>
                  )}
                  <td className={tdRight + " font-semibold text-slate-900"}>{money(l.total)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Extra charges sit outside the item lines and are not taxed with them,
          which is why they are listed separately rather than folded in. */}
      {(r.extraCharges || []).length > 0 && (
        <>
          <p className="mb-2 mt-4 text-xs font-bold uppercase tracking-wider text-slate-700">Extra charges</p>
          <div className="space-y-1">
            {r.extraCharges.map((c, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="text-slate-700">{c.note || "—"}</span>
                <span className="ml-auto font-semibold tabular-nums text-slate-900">{money(c.amount)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* The summary, in the order the arithmetic runs. */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl bg-slate-50 px-4 py-3 text-sm">
        <Bit label="Basic" value={money(r.totals.basicAmount)} />
        {r.totals.extraChargesTotal > 0 && (
          <Bit lead="+ " label="Extra" value={money(r.totals.extraChargesTotal)} />
        )}
        <Bit lead="+ " label="GST" value={money(r.totals.gstAmount)} tone="text-violet-700" />
        <Bit lead="= " label="Billing" value={money(r.totals.grandTotal)} tone="text-blue-700" />
        {r.creditTotal > 0 && <Bit lead="− " label="Credit" value={money(r.creditTotal)} tone="text-rose-700" />}
        {r.miscTotal > 0 && <Bit lead="+ " label="Misc" value={money(r.miscTotal)} tone="text-sky-700" />}
        <Bit lead="= " label="Payable" value={money(r.payable)} />
        <Bit lead="− " label="Paid" value={money(r.paidTotal)} tone="text-emerald-700" />
        <span className="ml-auto font-semibold text-slate-500">
          Outstanding{" "}
          <strong className={r.outstanding > 0 ? "text-amber-700" : "text-slate-900"}>
            {money(r.outstanding)}
          </strong>
        </span>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button" onClick={onClose}
          className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          Close
        </button>
        <button
          type="button" onClick={() => onCalculation(r)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
        >
          <Calculator className="h-4 w-4" /> Open full calculation
        </button>
      </div>
    </Modal>
  );
};

const VendorInvoicesView = ({ mode, vendorId, vendorName, period = {}, periodLabel, onBack }) => {
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detail, setDetail] = useState(null);
  const [calc, setCalc] = useState(null);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const isBilling = mode === MODE.BILLING;

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      /*
        Billing passes the period because its parent row was counted for that
        period. Outstanding does not: what is still owed is as on today, and a
        date window here would show a smaller figure than the row it opened
        from — the drill-down would contradict the page that linked to it.
      */
      if (isBilling && period.from) params.set("from", period.from);
      if (isBilling && period.to) params.set("to", period.to);

      const base = isBilling ? "billing" : "outstanding";
      const res = await fetch(
        `${API_BACKEND_URL}/stock/reports/${base}/${vendorId}/invoices?${params.toString()}`,
        { credentials: "include" }
      );
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to load invoices");
      setRows(json.data?.rows || []);
      setTotals(json.data?.totals || {});
      setTotal(json.pagination?.total || 0);
    } catch (e) {
      setError(e.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [isBilling, vendorId, page, limit, period.from, period.to]);

  useEffect(() => { load(); }, [load]);

  // The full working for one invoice — the same page Invoice Breakup opens, so
  // Billing drills all the way to unit prices without a second screen.
  if (calc) {
    return <InvoiceCalculationView row={calc} onBack={() => setCalc(null)} />;
  }

  const openCalculation = (r) => { setDetail(null); setCalc(r); };
  const colCount = isBilling ? 12 : 11;

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <button
        type="button" onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">
            {isBilling ? "Billing" : "Outstanding"} · {vendorName}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {isBilling ? periodLabel || "Chosen period" : "As on today"} ·{" "}
            {total} {total === 1 ? "invoice" : "invoices"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {isBilling ? (
            <>
              <Tile icon={Receipt} label="Basic" value={money(totals.basic || 0)} tone="border-slate-200 bg-white text-slate-700" />
              <Tile icon={Receipt} label="Extra" value={money(totals.extraCharges || 0)} tone="border-slate-200 bg-white text-slate-700" />
              <Tile icon={Percent} label="GST" value={money(totals.gst || 0)} tone="border-violet-200 bg-violet-50 text-violet-700" />
              <Tile icon={Receipt} label="Billing" value={money(totals.billing || 0)} tone="border-blue-200 bg-blue-50 text-blue-700" />
            </>
          ) : (
            <>
              <Tile icon={Receipt} label="Payable" value={money(totals.payable || 0)} tone="border-slate-200 bg-white text-slate-700" />
              <Tile icon={Wallet} label="Paid" value={money(totals.paid || 0)} tone="border-emerald-200 bg-emerald-50 text-emerald-700" />
              <Tile icon={AlertTriangle} label="Outstanding" value={money(totals.outstanding || 0)} tone="border-amber-300 bg-amber-50 text-amber-800" />
            </>
          )}
        </div>
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50/60">
            <tr>
              <th className={th}>Invoice</th>
              <th className={th}>Date</th>
              {isBilling ? (
                <>
                  <th className={thRight}>Basic</th>
                  <th className={thRight}>+Extra</th>
                  <th className={thRight}>CGST</th>
                  <th className={thRight}>SGST</th>
                  <th className={thRight}>IGST</th>
                  <th className={thRight}>GST</th>
                  <th className={thRight}>Billing</th>
                  <th className={thRight}>Credit Notes</th>
                  <th className={thRight}>Misc</th>
                </>
              ) : (
                <>
                  <th className={th}>Due</th>
                  <th className={thRight}>Billing</th>
                  <th className={thRight}>Credit Notes</th>
                  <th className={thRight}>Misc</th>
                  <th className={thRight}>Payable</th>
                  <th className={thRight}>Paid</th>
                  <th className={thRight}>Outstanding</th>
                  <th className={th}>Where it&apos;s stuck</th>
                </>
              )}
              <th className={thRight}>&nbsp;</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={colCount} className="px-4 py-12 text-center text-sm text-slate-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={colCount} className="px-4 py-12 text-center text-sm text-slate-400">
                No invoice for this vendor {isBilling ? "in this period" : "is outstanding"}.
              </td></tr>
            ) : (
              rows.map((r) => {
                const pm = paymentStateMeta(r.paymentState);
                const sm = stageMeta(r.stage);
                return (
                  <tr key={String(r.invoiceId)} className="transition hover:bg-slate-50/60">
                    {/* Number, PO and the info button together. The number alone
                        identifies nothing — nothing makes it unique — and the
                        button is what opens the lines behind the figures. */}
                    <td className={td}>
                      <span className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-900">{r.invoiceNumber}</span>
                        <button
                          type="button" onClick={() => setDetail(r)}
                          title="Show the item lines and everything on this invoice"
                          className="rounded-md border border-indigo-200 bg-white p-1 text-indigo-600 shadow-sm transition hover:bg-indigo-50"
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </span>
                      <span className="text-[11px] text-slate-400">{r.poNumber || "—"}</span>
                    </td>
                    <td className={td + " whitespace-nowrap text-xs"}>{fmtDate(r.invoiceDate)}</td>

                    {isBilling ? (
                      <>
                        <td className={tdRight}>{num(r.totals.basicAmount)}</td>
                        {/* The column that makes the row add up: Billing is
                            (basic + extra) + GST, and without this one any
                            invoice carrying freight looks like an error. */}
                        <td className={tdRight}>{num(r.totals.extraChargesTotal, "text-slate-600")}</td>
                        <td className={tdRight}>{num(r.totals.cgstAmount)}</td>
                        <td className={tdRight}>{num(r.totals.sgstAmount)}</td>
                        <td className={tdRight}>{num(r.totals.igstAmount)}</td>
                        <td className={tdRight}>{num(r.totals.gstAmount, "text-violet-700")}</td>
                        <td className={tdRight}>{num(r.totals.grandTotal, "font-medium text-blue-700")}</td>
                        <td className={tdRight}>
                          {r.creditTotal ? <span className="text-rose-700">−{money(r.creditTotal)}</span> : <span className="text-slate-300">—</span>}
                        </td>
                        <td className={tdRight}>
                          {r.miscTotal ? <span className="text-sky-700">+{money(r.miscTotal)}</span> : <span className="text-slate-300">—</span>}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className={td + " whitespace-nowrap text-xs"}>
                          <span className="block">{fmtDate(r.dueDate)}</span>
                          {r.daysOverdue > 0 && (
                            <span className="text-[11px] font-semibold text-rose-600">
                              {r.daysOverdue} days overdue
                            </span>
                          )}
                        </td>
                        <td className={tdRight}>{num(r.totals.grandTotal, "text-blue-700")}</td>
                        <td className={tdRight}>
                          {r.creditTotal ? <span className="text-rose-700">−{money(r.creditTotal)}</span> : <span className="text-slate-300">—</span>}
                        </td>
                        <td className={tdRight}>
                          {r.miscTotal ? <span className="text-sky-700">+{money(r.miscTotal)}</span> : <span className="text-slate-300">—</span>}
                        </td>
                        <td className={tdRight + " font-semibold text-slate-900"}>{money(r.payable)}</td>
                        <td className={tdRight}>{num(r.paidTotal, "text-emerald-700")}</td>
                        <td className={tdRight + " font-bold text-slate-900"}>
                          {r.outstanding ? money(r.outstanding) : <span className="text-slate-300">—</span>}
                          {r.writtenOff > 0 && (
                            <span className="mt-0.5 block text-[10px] font-normal text-slate-400">
                              {money(r.writtenOff)} written off
                            </span>
                          )}
                        </td>
                        <td className={td}>
                          <span className="flex flex-wrap items-center gap-1">
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${pm.chip}`}>
                              {pm.label}
                            </span>
                            {r.outstanding > 0 && (
                              <span
                                title={sm.hint}
                                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${sm.chip}`}
                              >
                                {sm.label}
                              </span>
                            )}
                          </span>
                          {r.rejectedReason && (
                            <span className="mt-0.5 block max-w-[180px] text-[11px] text-rose-600" title={r.rejectedReason}>
                              {r.rejectedReason}
                            </span>
                          )}
                        </td>
                      </>
                    )}

                    <td className={tdRight}>
                      <button
                        type="button" onClick={() => setCalc(r)}
                        className="inline-flex items-center gap-1 rounded-lg border border-indigo-300 bg-white px-2.5 py-1 text-xs font-semibold text-indigo-600 shadow-sm transition hover:bg-indigo-50"
                        title="Open the full working for this invoice"
                      >
                        <Calculator className="h-3.5 w-3.5" /> Calculation
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="border-t-2 border-slate-200 bg-slate-50">
              {/* These have to match the row this page was opened from. If the
                  footer disagrees with the figure on the report behind it, the
                  drill-down has made things worse, not better. They total every
                  page, not just this one. */}
              <tr>
                <td className={td + " font-bold text-slate-900"} colSpan={2}>TOTAL</td>
                {isBilling ? (
                  <>
                    <td className={tdRight + " font-semibold"}>{money(totals.basic || 0)}</td>
                    <td className={tdRight + " font-semibold"}>{money(totals.extraCharges || 0)}</td>
                    <td colSpan={3} />
                    <td className={tdRight + " font-bold text-violet-700"}>{money(totals.gst || 0)}</td>
                    <td className={tdRight + " font-bold text-blue-700"}>{money(totals.billing || 0)}</td>
                    <td className={tdRight + " font-bold text-rose-700"}>{totals.creditNotes ? `−${money(totals.creditNotes)}` : money(0)}</td>
                    <td className={tdRight + " font-bold text-sky-700"}>{totals.misc ? `+${money(totals.misc)}` : money(0)}</td>
                  </>
                ) : (
                  <>
                    <td />
                    <td className={tdRight + " font-bold text-blue-700"}>{money(totals.billing || 0)}</td>
                    <td className={tdRight + " font-bold text-rose-700"}>{totals.creditNotes ? `−${money(totals.creditNotes)}` : money(0)}</td>
                    <td className={tdRight + " font-bold text-sky-700"}>{totals.misc ? `+${money(totals.misc)}` : money(0)}</td>
                    <td className={tdRight + " font-bold text-slate-900"}>{money(totals.payable || 0)}</td>
                    <td className={tdRight + " font-bold text-emerald-700"}>{money(totals.paid || 0)}</td>
                    <td className={tdRight + " font-bold text-slate-900"}>{money(totals.outstanding || 0)}</td>
                    <td />
                  </>
                )}
                <td />
              </tr>
            </tfoot>
          )}
        </table>

        <Pagination
          currentPage={page} totalItems={total} itemsPerPage={limit} onPageChange={setPage}
          onItemsPerPageChange={(n) => { setLimit(n); setPage(1); }}
        />
      </div>

      <FootNote>
        {isBilling
          ? "Billing is (Basic + Extra) + GST, as the vendor billed it. Extra charges are freight, handling and anything else the invoice carried outside the item lines — they are not taxed with the items, which is why they sit in their own column. The info icon beside an invoice number opens its item lines; Calculation opens the full working. The TOTAL row covers every page, not just this one."
          : "As on today, whatever period the report behind this was showing — an unpaid invoice does not stop being owed because a month ended. Ageing counts from the contractual due date, and money settled short is written off rather than left outstanding. The info icon beside an invoice number opens its item lines; Calculation opens the full working."}
      </FootNote>

      {detail && (
        <InvoiceDetailPopup
          row={detail}
          onClose={() => setDetail(null)}
          onCalculation={openCalculation}
        />
      )}
    </div>
  );
};

export default VendorInvoicesView;
