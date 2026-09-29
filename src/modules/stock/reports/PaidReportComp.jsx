"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import Pagination from "@/shared/ui/pagination/Pagination";
import { RotateCcw, Users, Wallet, Clock, Info, Receipt } from "lucide-react";
import { SearchableSelect, inputCls, money } from "@/modules/stock/shared/StockSharedUI";
import { PAYMENT_MODE_LABEL } from "@/modules/stock/shared/paymentStatus";
import PeriodPicker, { defaultPeriod } from "@/modules/stock/vendorLedger/PeriodPicker";
import VendorPaymentsView from "./VendorPaymentsView";
import { th, thRight, td, tdRight, fmtDate, ReportHeader, Tile, ErrorBanner, FootNote } from "./reportUi";

/* ============================================================= */
/* Paid — what has actually gone out to each vendor.              */
/*                                                                */
/* The third of the vendor-money set: Billing asks what was        */
/* billed, Outstanding what is still owed, this one what left.     */
/*                                                                */
/* Deliberately short. Billing needs twelve columns because a bill */
/* is BUILT from basic, extra and three taxes; a payment has no    */
/* such parts — money left, and the only breakdown that means      */
/* anything is which channel it left by.                           */
/*                                                                 */
/* So mode never becomes five mostly-empty columns. Per vendor it  */
/* is chips in one column; across the page it is the mode dropdown */
/* in the filter row, whose options carry their own totals — one   */
/* control that both filters and reports.                          */
/*                                                                */
/* Rolled up from the same rows the Transaction Register lists, so */
/* a vendor's figure here and the payments on that page can never  */
/* disagree.                                                       */
/* ============================================================= */

/*
  Module scope, not declared inside the page: a component created during a
  render is a new type every render, so React would rebuild every strip on each
  keystroke in the search box.
*/
const ModeStrip = ({ byMode }) => {
  const parts = Object.keys(byMode || {}).filter((m) => byMode[m] > 0);
  if (!parts.length) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {parts.map((m) => (
        <span
          key={m}
          className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200"
        >
          {PAYMENT_MODE_LABEL[m] || m} {money(byMode[m])}
        </span>
      ))}
    </span>
  );
};

const PaidReportComp = () => {
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({});
  const [modes, setModes] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [branchId, setBranchId] = useState("");
  const [mode, setMode] = useState("");
  const [period, setPeriod] = useState(defaultPeriod);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [branches, setBranches] = useState([]);
  const [view, setView] = useState({ mode: "list" });

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BACKEND_URL}/stock/scoped-branches?module=invoice-list`, { credentials: "include" });
        const j = await r.json();
        if (j.success) setBranches(j.data?.branches || []);
      } catch {
        // Non-fatal — the branch filter just stays empty.
      }
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (branchId) params.set("branchId", branchId);
      if (mode) params.set("mode", mode);
      // The window follows the PAID date — when money left, not when it was
      // billed. That is the whole difference between this page and Billing.
      if (period.from) params.set("from", period.from);
      if (period.to) params.set("to", period.to);

      const res = await fetch(`${API_BACKEND_URL}/stock/reports/paid?${params.toString()}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to load paid report");
      setRows(json.data?.rows || []);
      setTotals(json.data?.totals || {});
      setModes(json.data?.modes || []);
      setTotal(json.pagination?.total || 0);
    } catch (e) {
      setError(e.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, branchId, mode, period.from, period.to]);

  useEffect(() => { load(); }, [load]);

  const branchOptions = useMemo(() => branches.map((b) => ({ value: b._id, label: b.name })), [branches]);
  const hasFilters = !!search || !!branchId || !!mode;
  const byMode = totals.byMode || {};

  /*
    Whatever the period picker is showing, in words — so the drill-down can say
    which period its figures belong to instead of leaving the reader to
    remember what they had selected.
  */
  const periodLabel = useMemo(() => {
    if (!period.from && !period.to) return "All time";
    const fmt = (d) =>
      d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "";
    return [fmt(period.from), fmt(period.to)].filter(Boolean).join(" – ");
  }, [period.from, period.to]);

  if (view.mode === "payments") {
    return (
      <VendorPaymentsView
        vendorId={view.vendorId} vendorName={view.vendorName}
        period={period} periodLabel={periodLabel}
        onBack={() => setView({ mode: "list" })}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <ReportHeader
        title="Paid" onRefresh={load}
        subtitle="What has actually been paid to each vendor in the chosen period."
        right={
          <div className="flex flex-wrap gap-2">
            <Tile icon={Users} label="Vendors" value={totals.vendors ?? 0} tone="border-slate-200 bg-white text-slate-700" />
            <Tile icon={Receipt} label="Payments" value={totals.payments ?? 0} tone="border-slate-200 bg-white text-slate-700" />
            <Tile icon={Wallet} label="Paid" value={money(totals.paid || 0)} tone="border-emerald-200 bg-emerald-50 text-emerald-800" />
            {/* A tile, never a column: a write-off is not a payment, but anyone
                checking payable against paid comes up short by exactly this and
                would otherwise hunt for a missing transfer. */}
            {(totals.writtenOff || 0) > 0 && (
              <Tile icon={Clock} label="Written Off" value={money(totals.writtenOff)} tone="border-slate-300 bg-slate-100 text-slate-600" />
            )}
          </div>
        }
      />

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vendor..." className={inputCls}
            />
          </div>
          <SearchableSelect
            value={branchId} onChange={(v) => { setBranchId(v); setPage(1); }}
            options={branchOptions} placeholder="All branches"
          />
          {/*
            The payment mode, as a filter AND as the totals.

            This replaced a strip of chips above the table. A plain dropdown
            would have lost what that strip was for — a bank reconciliation is
            done one channel at a time, and the NEFT statement does not contain
            the UPI rows — so each option carries its own amount. One control,
            both answers, and a whole band of screen saved.
          */}
          <select
            value={mode} onChange={(e) => { setMode(e.target.value); setPage(1); }}
            className={inputCls} aria-label="Payment mode"
          >
            <option value="">All modes · {money(totals.paid || 0)}</option>
            {modes.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_MODE_LABEL[m] || m} · {money(byMode[m] || 0)}
              </option>
            ))}
          </select>
          {hasFilters && (
            <button
              type="button"
              onClick={() => { setSearch(""); setBranchId(""); setMode(""); setPage(1); }}
              className="inline-flex items-center justify-center gap-1 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2 text-sm font-semibold text-rose-600 shadow-sm transition hover:bg-rose-100"
            >
              <RotateCcw className="h-4 w-4" /> Clear Filter
            </button>
          )}
        </div>
      </div>

      <div className="mb-5">
        <PeriodPicker value={period} onChange={(p) => { setPeriod(p); setPage(1); }} />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50/60">
            <tr>
              <th className={th}>Vendor</th>
              <th className={thRight}>Payments</th>
              <th className={thRight}>Paid</th>
              <th className={th}>Last Paid</th>
              <th className={th}>How it went out</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-400">
                Nothing was paid to any vendor in this period.
              </td></tr>
            ) : (
              rows.map((r) => (
                <tr key={String(r.vendorId)} className="transition hover:bg-slate-50/60">
                  <td className={td + " font-semibold text-slate-900"}>
                    {r.vendorName}
                    {/* Distinct invoices, not payments — five transfers against
                        one invoice is a different picture from five invoices. */}
                    <span className="mt-0.5 block text-[11px] font-normal text-slate-400">
                      across {r.invoiceCount} {r.invoiceCount === 1 ? "invoice" : "invoices"}
                    </span>
                  </td>
                  <td className={tdRight}>
                    <span className="inline-flex items-center justify-end gap-1.5">
                      {r.payments}
                      <button
                        type="button"
                        onClick={() => setView({ mode: "payments", vendorId: r.vendorId, vendorName: r.vendorName })}
                        title={`Show the ${r.payments} payments behind this row`}
                        className="rounded-md border border-indigo-200 bg-white p-1 text-indigo-600 shadow-sm transition hover:bg-indigo-50"
                      >
                        <Info className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </td>
                  <td className={tdRight + " font-bold text-emerald-700"}>
                    {money(r.paid)}
                    {r.writtenOff > 0 && (
                      <span
                        className="mt-0.5 block text-[10px] font-normal text-slate-400"
                        title="Invoices closed for less than their payable — no money left for this"
                      >
                        {money(r.writtenOff)} written off
                      </span>
                    )}
                  </td>
                  <td className={td + " whitespace-nowrap text-xs"}>{fmtDate(r.lastPaidOn)}</td>
                  <td className={td}><ModeStrip byMode={r.byMode} /></td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="border-t-2 border-slate-200 bg-slate-50">
              <tr>
                <td className={td + " font-bold text-slate-900"}>TOTAL</td>
                <td className={tdRight + " font-bold"}>{totals.payments || 0}</td>
                <td className={tdRight + " font-bold text-emerald-700"}>{money(totals.paid || 0)}</td>
                <td colSpan={2} />
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
        The period follows the date money left, not the date it was billed. Click the info icon on any
        payment count to see the individual transfers. Written off is not a payment — no money left — but a
        payable-versus-paid check comes up short by exactly that, so it is shown above. What is still owed
        is a different question — see Outstanding.
      </FootNote>
    </div>
  );
};

export default PaidReportComp;
