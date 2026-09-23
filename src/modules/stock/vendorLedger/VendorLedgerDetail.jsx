"use client";

import React, { useState, useEffect, useCallback } from "react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import { ArrowLeft, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { Modal, money } from "@/modules/stock/shared/StockSharedUI";
import { paymentTermLabel } from "@/modules/stock/shared/paymentTerms";

/* ============================================================= */
/* One vendor, twelve months, balance carried forward.            */
/*                                                                */
/* The closing column is what makes this a ledger and not a pile  */
/* of monthly summaries: read down it and every month explains     */
/* the next. Each row's columns come from three different dates    */
/* (bill date, accepted date, paid date), which is exactly why     */
/* the carry-forward has to be there.                              */
/* ============================================================= */

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const th = "px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500";
const thRight = th + " text-right";
const td = "px-3 py-2.5 text-sm align-middle";
const tdRight = td + " text-right tabular-nums";

// Zero is noise in a money column — the eye should land on what happened.
const num = (n, cls = "text-slate-700") =>
  n ? <span className={cls}>{money(n)}</span> : <span className="text-slate-300">—</span>;

/*
  Module scope, not inside the popup: a component declared during a render is
  a NEW component type on every render, so React unmounts and remounts its
  whole subtree each time — losing scroll position and any local state with it.
*/
const Section = ({ title, rows, render, tone }) =>
  rows.length === 0 ? null : (
    <div className="mb-4">
      <p className={`mb-1.5 text-xs font-bold uppercase tracking-wider ${tone}`}>
        {title} ({rows.length})
      </p>
      <div className="space-y-1">{rows.map(render)}</div>
    </div>
  );

/* ── One month, transaction by transaction ─────────────────────── */
const MonthDetailPopup = ({ vendor, year, month, onClose }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_BACKEND_URL}/stock/vendor-ledger/${vendor._id}/month?year=${year}&month=${month}`,
        { credentials: "include" }
      );
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to load");
      setData(json.data);
    } catch (e) {
      setError(e.message);
      setData({ billing: [], credits: [], miscs: [], payments: [] });
    }
  }, [vendor._id, year, month]);

  useEffect(() => { load(); }, [load]);

  return (
    <Modal
      onClose={onClose}
      title={`${MONTH_NAMES[month - 1]} ${year} · ${vendor.name}`}
      maxWidth="max-w-3xl"
    >
      {error && (
        <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-100">{error}</div>
      )}

      {data === null ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}
        </div>
      ) : (
        <>
          <Section
            title="Invoices" tone="text-slate-700" rows={data.billing}
            render={(r) => (
              <div key={r.invoiceId} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <span className="font-semibold text-slate-900">{r.invoiceNumber}</span>
                <span className="text-xs text-slate-400">{r.poNumber}</span>
                <span className="text-xs text-slate-500">{fmtDate(r.date)}</span>
                <span className="text-xs text-slate-400">due {fmtDate(r.dueDate)}</span>
                <span className="ml-auto text-xs text-slate-500">
                  basic {money(r.basic)}
                  {r.igst > 0 ? ` + IGST ${money(r.igst)}` : ` + GST ${money(r.cgst + r.sgst)}`}
                </span>
                <span className="w-28 text-right font-semibold tabular-nums text-slate-900">{money(r.amount)}</span>
              </div>
            )}
          />
          <Section
            title="Credit notes" tone="text-rose-700" rows={data.credits}
            render={(r, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-rose-200 bg-rose-50/40 px-3 py-2 text-sm">
                <span className="font-medium text-slate-800">{r.invoiceNumber}</span>
                <span className="text-xs text-slate-500">{fmtDate(r.date)}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-slate-500">{r.reason}</span>
                <span className="text-xs text-slate-500">
                  {money(r.basicAmount)} + GST {money(r.gstAmount)}
                </span>
                <span className="w-28 text-right font-semibold tabular-nums text-rose-700">−{money(r.amount)}</span>
              </div>
            )}
          />
          <Section
            title="Misc charges" tone="text-sky-700" rows={data.miscs}
            render={(r, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-sky-200 bg-sky-50/40 px-3 py-2 text-sm">
                <span className="font-medium text-slate-800">{r.invoiceNumber}</span>
                <span className="text-xs text-slate-500">{fmtDate(r.date)}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-slate-500">{r.reason}</span>
                <span className="w-28 text-right font-semibold tabular-nums text-sky-700">+{money(r.amount)}</span>
              </div>
            )}
          />
          <Section
            title="Payments" tone="text-emerald-700" rows={data.payments}
            render={(r, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/40 px-3 py-2 text-sm">
                <span className="font-medium text-slate-800">{r.invoiceNumber}</span>
                <span className="text-xs text-slate-500">{fmtDate(r.date)}</span>
                <span className="text-xs text-slate-500">{r.mode}</span>
                {r.refNo && <span className="text-xs text-slate-400">{r.refNo}</span>}
                <span className="ml-auto w-28 text-right font-semibold tabular-nums text-emerald-700">{money(r.amount)}</span>
              </div>
            )}
          />

          {data.billing.length === 0 && data.credits.length === 0 &&
           data.miscs.length === 0 && data.payments.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-400">Nothing happened in this month.</p>
          )}
        </>
      )}
    </Modal>
  );
};

/* ============================================================= */

const VendorLedgerDetail = ({ vendorId, vendorName, initialYear, onBack }) => {
  const [year, setYear] = useState(initialYear || new Date().getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openMonth, setOpenMonth] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(
        `${API_BACKEND_URL}/stock/vendor-ledger/${vendorId}?year=${year}`,
        { credentials: "include" }
      );
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to load ledger");
      setData(json.data);
    } catch (e) {
      setError(e.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [vendorId, year]);

  useEffect(() => { load(); }, [load]);

  const vendor = data?.vendor || { _id: vendorId, name: vendorName };
  const rows = data?.rows || [];
  const t = data?.totals || {};

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      {/* The header carries the vendor's identity because this page is what
          gets printed and sent to them — a statement with no GSTIN on it is
          not a statement. */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button" onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-900">
              Vendor Ledger — {vendor.name}
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              {vendor.gstNumber ? `GSTIN ${vendor.gstNumber} · ` : ""}
              {vendor.paymentTerms ? paymentTermLabel(vendor.paymentTerms) : "No payment term set"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button" onClick={() => setYear((y) => y - 1)}
            className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[68px] rounded-lg bg-slate-900 px-3 py-1.5 text-center text-sm font-bold text-white tabular-nums">
            {year}
          </span>
          <button
            type="button" onClick={() => setYear((y) => y + 1)}
            disabled={year >= new Date().getFullYear()}
            className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button" onClick={load}
            className="ml-1 rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 shadow-sm transition hover:bg-slate-50"
            title="Reload"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="font-bold">&times;</button>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full">
          <thead className="bg-slate-50/80">
            <tr>
              <th className={th}>Month</th>
              <th className={thRight}>Inv</th>
              <th className={thRight}>Basic</th>
              <th className={thRight}>CGST</th>
              <th className={thRight}>SGST</th>
              <th className={thRight}>IGST</th>
              <th className={thRight}>Billing</th>
              <th className={thRight}>Misc</th>
              <th className={thRight}>Credit Notes</th>
              <th className={thRight}>Net Payable</th>
              <th className={thRight}>Paid</th>
              <th className={thRight}>Closing</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {/* The opening line is the whole point of a ledger: this year did
                not start from zero unless it actually did. */}
            <tr className="bg-slate-50/60">
              <td className={td + " font-semibold text-slate-600"} colSpan={11}>
                Opening balance carried forward
              </td>
              <td className={tdRight + " font-bold text-slate-900"}>{money(data?.opening || 0)}</td>
            </tr>

            {loading ? (
              <tr><td colSpan={12} className="px-4 py-12 text-center text-sm text-slate-400">Loading…</td></tr>
            ) : (
              rows.map((r) => {
                const quiet = r.invoiceCount === 0 && !r.paid && !r.creditNotes && !r.misc;
                return (
                  <tr
                    key={r.month}
                    onClick={() => !quiet && setOpenMonth(r.month)}
                    className={`transition ${quiet ? "text-slate-300" : "cursor-pointer hover:bg-indigo-50/40"}`}
                  >
                    <td className={td + (quiet ? "" : " font-semibold text-slate-900")}>
                      {MONTH_NAMES[r.month - 1]}-{year}
                    </td>
                    <td className={tdRight}>{r.invoiceCount || <span className="text-slate-300">—</span>}</td>
                    <td className={tdRight}>{num(r.basic)}</td>
                    <td className={tdRight}>{num(r.cgst)}</td>
                    <td className={tdRight}>{num(r.sgst)}</td>
                    <td className={tdRight}>{num(r.igst)}</td>
                    <td className={tdRight}>{num(r.billing, "font-medium text-blue-700")}</td>
                    <td className={tdRight}>{r.misc ? <span className="text-sky-700">+{money(r.misc)}</span> : <span className="text-slate-300">—</span>}</td>
                    <td className={tdRight}>{r.creditNotes ? <span className="text-rose-700">−{money(r.creditNotes)}</span> : <span className="text-slate-300">—</span>}</td>
                    <td className={tdRight}>{num(r.netPayable, "font-semibold text-slate-900")}</td>
                    <td className={tdRight}>{num(r.paid, "font-medium text-emerald-700")}</td>
                    <td className={tdRight + " font-bold text-slate-900"}>{money(r.closing)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot className="border-t-2 border-slate-200 bg-slate-50">
            <tr>
              <td className={td + " font-bold text-slate-900"}>TOTAL</td>
              <td className={tdRight + " font-bold"}>{t.invoiceCount || 0}</td>
              <td className={tdRight + " font-semibold"}>{money(t.basic || 0)}</td>
              <td className={tdRight + " font-semibold"}>{money(t.cgst || 0)}</td>
              <td className={tdRight + " font-semibold"}>{money(t.sgst || 0)}</td>
              <td className={tdRight + " font-semibold"}>{money(t.igst || 0)}</td>
              <td className={tdRight + " font-bold text-blue-700"}>{money(t.billing || 0)}</td>
              <td className={tdRight + " font-bold text-sky-700"}>{t.misc ? `+${money(t.misc)}` : money(0)}</td>
              <td className={tdRight + " font-bold text-rose-700"}>{t.creditNotes ? `−${money(t.creditNotes)}` : money(0)}</td>
              <td className={tdRight + " font-bold text-slate-900"}>{money(t.netPayable || 0)}</td>
              <td className={tdRight + " font-bold text-emerald-700"}>{money(t.paid || 0)}</td>
              <td className={tdRight + " font-bold text-slate-900"}>{money(data?.closing || 0)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="mt-3 text-xs text-slate-400">
        Billing sits in the month of the invoice date, credit notes and misc in the month they were accepted,
        payments in the month they were paid. Click any month to see the documents behind it.
      </p>

      {openMonth && (
        <MonthDetailPopup
          vendor={vendor} year={year} month={openMonth}
          onClose={() => setOpenMonth(null)}
        />
      )}
    </div>
  );
};

export default VendorLedgerDetail;
