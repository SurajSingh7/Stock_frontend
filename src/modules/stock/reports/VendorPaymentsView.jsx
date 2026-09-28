"use client";

import React, { useState, useEffect, useCallback } from "react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import Pagination from "@/shared/ui/pagination/Pagination";
import { ArrowLeft, Wallet, Paperclip } from "lucide-react";
import { money } from "@/modules/stock/shared/StockSharedUI";
import { PAYMENT_MODE_LABEL, paymentStateMeta } from "@/modules/stock/shared/paymentStatus";
import { th, thRight, td, tdRight, fmtDate, Tile, ErrorBanner, FootNote } from "./reportUi";

/* ============================================================= */
/* The payments behind one vendor's row on Paid.                  */
/*                                                                */
/* Reads the transaction register with type=PAYMENT, so these are  */
/* literally the same rows that page shows — a drill-down building  */
/* its own list could drift from the register it mirrors.          */
/*                                                                */
/* One row per bank entry, never merged: a settlement paid partly  */
/* by NEFT and partly by UPI is two entries on the statement, and  */
/* summing them would destroy the only thing this page is for.     */
/*                                                                */
/* No invoice-detail popup here, deliberately. A payment row does   */
/* not carry its invoice's item lines — showing them would mean     */
/* either fattening every register response with lines nobody on    */
/* that page reads, or a second request per click. The invoice      */
/* number, its PO, and how much of its payable this payment covers  */
/* answer the question that actually gets asked; the lines are one  */
/* click away on Billing and Invoice Breakup.                       */
/* ============================================================= */

const VendorPaymentsView = ({ vendorId, vendorName, period = {}, periodLabel, onBack }) => {
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (period.from) params.set("from", period.from);
      if (period.to) params.set("to", period.to);

      const res = await fetch(
        `${API_BACKEND_URL}/stock/reports/paid/${vendorId}/payments?${params.toString()}`,
        { credentials: "include" }
      );
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to load payments");
      setRows(json.data?.rows || []);
      setTotals(json.data?.totals || {});
      setTotal(json.pagination?.total || 0);
    } catch (e) {
      setError(e.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [vendorId, page, limit, period.from, period.to]);

  useEffect(() => { load(); }, [load]);

  const byMode = totals.byMode || {};
  const activeModes = Object.keys(byMode).filter((m) => byMode[m] > 0);

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
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">Paid · {vendorName}</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {periodLabel || "Chosen period"} · {total} {total === 1 ? "payment" : "payments"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Tile icon={Wallet} label="Paid" value={money(totals.paid || 0)} tone="border-emerald-200 bg-emerald-50 text-emerald-800" />
          {/* Only the channels money actually left by — an empty Cheque tile
              tells nobody anything. */}
          {activeModes.map((m) => (
            <Tile key={m} label={PAYMENT_MODE_LABEL[m] || m} value={money(byMode[m])} tone="border-slate-200 bg-white text-slate-700" />
          ))}
        </div>
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50/60">
            <tr>
              <th className={th}>Date</th>
              <th className={th}>Invoice</th>
              <th className={th}>Mode</th>
              <th className={th}>Ref / UTR</th>
              <th className={thRight}>Amount</th>
              <th className={th}>Against Invoice</th>
              <th className={th}>Proof</th>
              <th className={th}>By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-400">
                No payment to this vendor in this period.
              </td></tr>
            ) : (
              rows.map((r) => {
                const pm = paymentStateMeta(r.paymentState);
                return (
                  <tr key={r.rowKey} className="transition hover:bg-slate-50/60">
                    <td className={td + " whitespace-nowrap text-xs"}>{fmtDate(r.date)}</td>
                    {/* Number, PO and billing date together: nothing in the
                        system makes an invoice number unique, so on its own it
                        cannot say which invoice this payment went against. */}
                    <td className={td}>
                      <span className="block font-semibold text-slate-900">{r.invoiceNumber || "—"}</span>
                      <span className="text-[11px] text-slate-400">
                        {r.poNumber || "—"}{r.invoiceDate ? ` · billed ${fmtDate(r.invoiceDate)}` : ""}
                      </span>
                    </td>
                    <td className={td}>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                        {PAYMENT_MODE_LABEL[r.mode] || r.mode}
                      </span>
                    </td>
                    <td className={td + " font-mono text-xs text-slate-600"}>{r.refNo || "—"}</td>
                    <td className={tdRight + " font-bold text-emerald-700"}>{money(r.amount)}</td>
                    {/* Where this payment sits in its invoice, so the row reads
                        without opening anything: 45,000 of a 2,53,160 payable. */}
                    <td className={td + " text-xs"}>
                      <span className="block text-slate-500">
                        {money(r.invoicePaidTotal)} of {money(r.invoicePayable)}
                      </span>
                      <span className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${pm.chip}`}>
                        {pm.label}
                      </span>
                    </td>
                    <td className={td}>
                      {(r.proofs || []).length > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                          <Paperclip className="h-3 w-3" /> {r.proofs.length}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className={td + " text-xs text-slate-500"}>{r.byName || "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="border-t-2 border-slate-200 bg-slate-50">
              <tr>
                <td className={td + " font-bold text-slate-900"} colSpan={4}>
                  TOTAL · {total} {total === 1 ? "payment" : "payments"}
                </td>
                <td className={tdRight + " font-bold text-emerald-700"}>{money(totals.paid || 0)}</td>
                <td colSpan={3} />
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
        One row per bank entry. A settlement paid partly by NEFT and partly by UPI appears as two rows with
        two references, because that is how it appears on the statement. Against Invoice shows how much of
        that invoice&apos;s payable has been met in total, not just by this payment.
      </FootNote>
    </div>
  );
};

export default VendorPaymentsView;
