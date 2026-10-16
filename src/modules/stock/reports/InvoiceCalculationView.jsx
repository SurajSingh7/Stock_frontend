"use client";

import React from "react";
import { ArrowLeft, Calculator, AlertTriangle, Paperclip } from "lucide-react";
import { money } from "@/modules/stock/shared/StockSharedUI";
import { paymentTermShort } from "@/modules/stock/shared/paymentTerms";
import { PAYMENT_MODE_LABEL, paymentStateMeta } from "@/modules/stock/shared/paymentStatus";
import { stageMeta } from "@/modules/stock/shared/ledgerStages";
import { th, thRight, td, tdRight, fmtDate } from "./reportUi";

/* ============================================================= */
/* One invoice's calculation — a full page, not a popup or an     */
/* expander.                                                      */
/*                                                                */
/* It was an expander inside the list first, and that was the     */
/* wrong shape: the working is the thing somebody reads carefully, */
/* line by line, often beside a vendor's own statement. Squeezing  */
/* it under a table row meant a cramped column and no room for     */
/* the per-line tax split, the debit notes' claimed units, or the */
/* payments — the three things a reader actually queries.          */
/*                                                                */
/* Same pattern as DebitNoteView and RecordPaymentView: it        */
/* replaces the list rather than opening over it, and comes back   */
/* with the Back button.                                          */
/* ============================================================= */

/* One step of the working: a label, an optional formula, a figure. */
const Step = ({ label, formula, amount, strong, tone = "text-slate-800" }) => (
  <div className={`flex items-baseline gap-3 ${strong ? "font-semibold" : ""}`}>
    <span className={`min-w-0 flex-1 ${tone}`}>
      {label}
      {formula && <span className="ml-2 font-mono text-[11px] text-slate-400">{formula}</span>}
    </span>
    <span className={`shrink-0 tabular-nums ${tone}`}>{amount}</span>
  </div>
);

const Rule = () => <div className="my-1.5 border-t border-dashed border-slate-300" />;

const Card = ({ title, children, note }) => (
  <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-700">{title}</p>
    {children}
    {note && <p className="mt-3 text-xs text-slate-400">{note}</p>}
  </div>
);

const InvoiceCalculationView = ({ row: r, onBack }) => {
  const isIgst = r.taxType === "IGST";
  const pm = paymentStateMeta(r.paymentState);
  const sm = stageMeta(r.stage);
  const debits = (r.adjustments || []).filter((a) => a.type === "DEBIT_NOTE");
  const miscs = (r.adjustments || []).filter((a) => a.type === "MISC");

  /*
    The lines and the stored basic come from the same fields, so they always
    agree. Shown anyway: a working that cannot be checked against the invoice
    it explains is worth nothing, so a mismatch has to surface rather than be
    quietly absorbed.
  */
  const mismatch = Math.abs((r.basicFromLines || 0) - (r.totals?.basicAmount || 0)) > 0.01;

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <div className="mx-auto max-w-5xl">
        <button
          type="button" onClick={onBack}
          className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {/* ── Identity ─────────────────────────────────────────── */}
        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-900">
                <Calculator className="h-5 w-5 text-indigo-500" />
                Calculation · Invoice {r.invoiceNumber}
              </h1>
              {/* PO number and invoice date sit beside the number because
                  nothing in the system makes an invoice number unique — on its
                  own it cannot identify which invoice this is. */}
              <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                <span>{r.poNumber || "—"}</span>
                <span className="font-medium text-slate-700">{r.vendorName}</span>
                {r.branchName && <span>{r.branchName}</span>}
              </p>
              <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                <span>Invoice {fmtDate(r.invoiceDate)}</span>
                <span>
                  Due {fmtDate(r.dueDate)}
                  {r.paymentTerms ? ` · ${paymentTermShort(r.paymentTerms)}` : ""}
                </span>
                <span className={isIgst ? "font-semibold text-violet-600" : "text-slate-500"}>
                  {isIgst ? "IGST · inter-state" : "CGST + SGST · same state"}
                </span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${pm.chip}`}>
                {pm.label}
              </span>
              {r.outstanding > 0 && (
                <span
                  title={sm.hint}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${sm.chip}`}
                >
                  {sm.label}
                </span>
              )}
            </div>
          </div>

          {r.rejectedReason && (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-inset ring-rose-100">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Payment approval sent back: {r.rejectedReason}
            </p>
          )}
        </div>

        {/* ── Lines ────────────────────────────────────────────── */}
        {/* The full page finally has room for the per-line tax split, which
            the expander could not fit. */}
        <Card
          title="Invoice lines"
          note="Unit price is what this invoice was billed at, snapshotted when it was created — it never re-reads the purchase order. The GST rate comes off the PO line."
        >
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
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
                  <tr><td colSpan={isIgst ? 9 : 10} className="px-3 py-6 text-center text-sm text-slate-400">
                    This invoice has no lines.
                  </td></tr>
                ) : (
                  r.lines.map((l, i) => (
                    <tr key={i}>
                      <td className={td + " text-xs text-slate-500"}>{l.categoryName || "—"}</td>
                      <td className={td + " font-medium text-slate-900"}>{l.productName || "—"}</td>
                      <td className={tdRight}>{l.quantity}</td>
                      {/* FOC units arrive but are never priced. "Forty came, why
                          is thirty-six billed" is answered here and nowhere else
                          in the system. */}
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
        </Card>

        {/* ── The working ──────────────────────────────────────── */}
        <div className="mb-5 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5 shadow-sm">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-700">
            <Calculator className="h-3.5 w-3.5" /> How this amount was reached
          </p>

          <div className="space-y-1 text-sm">
            {r.lines.map((l, i) => (
              <Step
                key={i}
                label={l.productName || l.categoryName || "—"}
                formula={
                  `${money(l.unitPrice)} × ${l.quantity} paid` +
                  (l.focQuantity > 0 ? `  (+${l.focQuantity} FOC free — ${money(0)})` : "")
                }
                amount={money(l.basic)}
              />
            ))}

            <Rule />
            <Step label="Basic" amount={money(r.totals.basicAmount)} strong />

            {mismatch && (
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-600">
                <AlertTriangle className="h-3 w-3" />
                Lines add to {money(r.basicFromLines)} but the invoice stores {money(r.totals.basicAmount)}
              </p>
            )}

            {(r.extraCharges || []).filter((c) => c.includeInBilling !== false).map((c, i) => (
              <Step key={i} label={`+ ${c.note || "Extra charge"}`} amount={money(c.amount)} tone="text-slate-600" />
            ))}

            {/* The REASON for the tax split, not just the amount. Whether an
                invoice carries IGST or CGST+SGST depends on the vendor's state
                against the branch's, and that lives on the purchase order where
                nobody reading the invoice can see it. */}
            <Rule />
            <p className="text-[11px] text-slate-500">
              {isIgst
                ? "Vendor is in another state, so tax is charged as a single IGST line."
                : "Vendor is in the same state as the branch, so tax splits into CGST and SGST."}
            </p>
            {isIgst ? (
              <Step label="+ IGST" amount={money(r.totals.igstAmount)} tone="text-violet-700" />
            ) : (
              <>
                <Step label="+ CGST" amount={money(r.totals.cgstAmount)} tone="text-violet-700" />
                <Step label="+ SGST" amount={money(r.totals.sgstAmount)} tone="text-violet-700" />
              </>
            )}

            <Rule />
            <Step label="BILLING" amount={money(r.totals.grandTotal)} strong tone="text-slate-900" />

            {miscs.map((a) => (
              <Step
                key={a._id}
                label={`+ Misc charge · ${a.reason || "—"}`}
                amount={`+${money(a.amount)}`}
                tone="text-sky-700"
              />
            ))}

            {r.totals.tdsAmount > 0 && (
              <Step
                label="− TDS"
                formula={`${money(r.totals.basicAmount)} basic × ${r.totals.tdsRate}%`}
                amount={`−${money(r.totals.tdsAmount)}`}
                tone="text-amber-700"
              />
            )}

            {debits.map((a) => (
              <Step
                key={a._id}
                label={`− Debit note · ${a.reason || "—"}`}
                formula={
                  a.lines.length
                    ? a.lines.map((l) => `${l.quantity} × ${money(l.rate)} +${l.gstRate}% GST`).join(", ")
                    : ""
                }
                amount={`−${money(a.amount)}`}
                tone="text-rose-700"
              />
            ))}

            {(debits.length > 0 || miscs.length > 0 || r.totals.tdsAmount > 0) && <Rule />}
            <Step label="NET PAYABLE" amount={money(r.payable)} strong tone="text-slate-900" />

            {/* Recorded on the invoice but deliberately left out of the bill —
                shown so the breakup accounts for every charge, outside the sum. */}
            {(r.extraCharges || []).some((c) => c.includeInBilling === false) && (
              <>
                <Rule />
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Not billed · note only</p>
                {r.extraCharges.filter((c) => c.includeInBilling === false).map((c, i) => (
                  <Step key={i} label={c.note || "Extra charge"} amount={money(c.amount)} tone="text-slate-400" />
                ))}
              </>
            )}

            {(r.payments || []).map((p, i) => (
              <Step
                key={i}
                label={`− Paid · ${PAYMENT_MODE_LABEL[p.mode] || p.mode}${p.refNo ? ` · ${p.refNo}` : ""}`}
                formula={fmtDate(p.paidOn)}
                amount={`−${money(p.amount)}`}
                tone="text-emerald-700"
              />
            ))}

            {r.writtenOff > 0 && (
              <Step
                label="− Written off (closed short of the payable)"
                amount={`−${money(r.writtenOff)}`}
                tone="text-slate-500"
              />
            )}

            <Rule />
            <Step
              label="BALANCE DUE" amount={money(r.outstanding)} strong
              tone={r.outstanding > 0 ? "text-amber-700" : "text-slate-900"}
            />
          </div>
        </div>

        {/* ── Adjustments in full ──────────────────────────────── */}
        {/* A debit note's amount is only checkable against the units it
            claimed, which is why the lines come back rather than just a total. */}
        {(debits.length > 0 || miscs.length > 0) && (
          <Card title="Debit notes and misc charges">
            <div className="space-y-3">
              {(r.adjustments || []).map((a) => {
                const isDebit = a.type === "DEBIT_NOTE";
                return (
                  <div
                    key={a._id}
                    className={`rounded-xl border p-3 ${
                      isDebit ? "border-rose-200 bg-rose-50/40" : "border-sky-200 bg-sky-50/40"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-sm font-semibold ${isDebit ? "text-rose-700" : "text-sky-700"}`}>
                        {isDebit ? "Debit note" : "Misc charge"}
                      </span>
                      <span className="ml-auto font-bold tabular-nums text-slate-900">
                        {isDebit ? "−" : "+"}{money(a.amount)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-800">{a.reason || "—"}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {a.createdByName || "—"} · {fmtDate(a.createdOn)}
                    </p>

                    {a.lines.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {a.lines.map((l, i) => (
                          <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-white/70 px-2.5 py-1.5 text-xs">
                            <span className="font-medium text-slate-800">{l.productName}</span>
                            <span className="text-slate-500">
                              {l.quantity} × {money(l.rate)}
                              {l.gstRate > 0 ? ` + ${l.gstRate}% GST` : ""}
                            </span>
                            <span className="text-slate-400">
                              {money(l.basicAmount)} + {money(l.gstAmount)}
                            </span>
                            <span className="ml-auto font-semibold tabular-nums text-slate-800">
                              {money(l.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {a.extras.length > 0 && (
                      <div className="mt-1.5 space-y-1">
                        {a.extras.map((e, i) => (
                          <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-white/70 px-2.5 py-1.5 text-xs">
                            <span className="text-slate-700">{e.note || "—"}</span>
                            <span className="ml-auto font-semibold tabular-nums text-slate-800">
                              {money(e.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* ── Payments ─────────────────────────────────────────── */}
        {(r.payments || []).length > 0 && (
          <Card
            title={`Payments recorded (${r.payments.length})`}
            note="One row per bank entry. A single settlement paid partly by NEFT and partly by UPI appears as two rows with two references, because that is how it appears on the statement."
          >
            <div className="space-y-1.5">
              {r.payments.map((p, i) => (
                <div key={i} className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/40 px-3 py-2 text-sm">
                  <span className="font-semibold tabular-nums text-emerald-700">{money(p.amount)}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                    {PAYMENT_MODE_LABEL[p.mode] || p.mode}
                  </span>
                  <span className="text-xs text-slate-500">{fmtDate(p.paidOn)}</span>
                  {p.refNo && <span className="font-mono text-xs text-slate-500">{p.refNo}</span>}
                  {(p.proofs || []).length > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                      <Paperclip className="h-3 w-3" /> {p.proofs.length}
                    </span>
                  )}
                  <span className="ml-auto text-xs text-slate-400">{p.byName || "—"}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        <div className="flex justify-start">
          <button
            type="button" onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Invoice Breakup
          </button>
        </div>
      </div>
    </div>
  );
};

export default InvoiceCalculationView;
