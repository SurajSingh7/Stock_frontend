"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import Pagination from "@/shared/ui/pagination/Pagination";
import { RotateCcw, AlertTriangle, Clock, Users, Wallet, Info } from "lucide-react";
import { SearchableSelect, inputCls, money } from "@/modules/stock/shared/StockSharedUI";
import {
  MOVEMENT_FILTER, MOVEMENT_OPTIONS, STAGE_ORDER, stageMeta, stageBreakdown,
} from "@/modules/stock/shared/ledgerStages";
import VendorInvoicesView, { MODE } from "./VendorInvoicesView";
import {
  th, thRight, thSticky, td, tdRight, tdSticky,
  num, ReportHeader, Tile, ErrorBanner, FootNote,
} from "./reportUi";

/* ============================================================= */
/* Outstanding — what is still owed, as on today.                 */
/*                                                                */
/* No period picker, and that is the whole design. "How much is    */
/* stuck" is not a question about a date range: an invoice from    */
/* March that is still unpaid belongs on this page in September.   */
/* A period selector here would let somebody filter a debt out of  */
/* existence, which is the one thing this page must never do.      */
/*                                                                */
/* Two different questions, and both stay answerable:              */
/*   Overdue  HOW OLD — one column, not five buckets. The buckets  */
/*            only ever showed one non-empty cell at a time and    */
/*            cost four columns to do it; bucket analysis lives on */
/*            the Ageing filter, which is still here.              */
/*   Stage    WHY it has not moved. A rejected approval is still   */
/*            owed, so without this a rejected row reads exactly   */
/*            like one about to be paid.                            */
/* ============================================================= */

const AGEING_OPTIONS = [
  { value: "", label: "Any ageing" },
  { value: "D0_30", label: "Overdue 0-30 days" },
  { value: "D31_60", label: "Overdue 31-60 days" },
  { value: "D61_90", label: "Overdue 61-90 days" },
  { value: "D90_PLUS", label: "Overdue 90+ days" },
];

/*
  Module scope, not declared inside the page: a component created during a
  render is a new type every render, so React would remount every strip on
  each keystroke in the search box.
*/
const StageStrip = ({ outstandingBy, stageCount }) => {
  const parts = stageBreakdown(outstandingBy, stageCount);
  if (!parts.length) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {parts.map((p) => (
        <span
          key={p.key}
          title={`${p.label} — ${p.count} ${p.count === 1 ? "invoice" : "invoices"}. ${p.hint}`}
          className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${p.chip}`}
        >
          {p.short} {money(p.amount)}
          {p.count > 1 && <span className="ml-0.5 opacity-60">&times;{p.count}</span>}
        </span>
      ))}
    </span>
  );
};

const OutstandingReportComp = () => {
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({});

  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [branchId, setBranchId] = useState("");
  const [ageing, setAgeing] = useState("");
  const [stage, setStage] = useState("");
  const [movement, setMovement] = useState(MOVEMENT_FILTER.ALL);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [branches, setBranches] = useState([]);
  // Which invoices make up a vendor's outstanding — the question this page
  // raises and, until now, could not answer.
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
      if (ageing) params.set("ageing", ageing);
      if (stage) params.set("stage", stage);
      if (movement !== MOVEMENT_FILTER.ALL) params.set("movement", movement);
      /*
        No from/to is sent, on purpose. The endpoint would honour it — it is
        the ledger's summary — but every column this page shows is as-on-today
        and a period here would only produce a smaller, wrong number.
      */

      const res = await fetch(`${API_BACKEND_URL}/stock/reports/outstanding?${params.toString()}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to load outstanding report");
      setRows(json.data?.rows || []);
      setTotals(json.data?.totals || {});

      setTotal(json.pagination?.total || 0);
    } catch (e) {
      setError(e.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, branchId, ageing, stage, movement]);

  useEffect(() => { load(); }, [load]);

  const branchOptions = useMemo(() => branches.map((b) => ({ value: b._id, label: b.name })), [branches]);
  const hasFilters =
    !!search || !!branchId || !!ageing || !!stage || movement !== MOVEMENT_FILTER.ALL;
  const stageTotals = totals.outstandingBy || {};
  const colCount = 8;

  if (view.mode === "invoices") {
    return (
      <VendorInvoicesView
        mode={MODE.OUTSTANDING}
        vendorId={view.vendorId} vendorName={view.vendorName}
        onBack={() => setView({ mode: "list" })}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <ReportHeader
        title="Outstanding" onRefresh={load}
        subtitle="What is still owed to each vendor — as on today, across every invoice."
        right={
          <div className="flex flex-wrap gap-2">
            <Tile icon={Users} label="Vendors" value={totals.vendors ?? 0} tone="border-slate-200 bg-white text-slate-700" />
            <Tile icon={Wallet} label="Paid" value={money(totals.paid || 0)} tone="border-emerald-200 bg-emerald-50 text-emerald-700" />
            <Tile icon={AlertTriangle} label="Outstanding" value={money(totals.outstanding || 0)} tone="border-amber-300 bg-amber-50 text-amber-800" />
            {(totals.writtenOff || 0) > 0 && (
              <Tile icon={Clock} label="Written Off" value={money(totals.writtenOff)} tone="border-slate-300 bg-slate-100 text-slate-600" />
            )}
          </div>
        }
      />

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendor..." className={inputCls}
          />
          <SearchableSelect
            value={branchId} onChange={(v) => { setBranchId(v); setPage(1); }}
            options={branchOptions} placeholder="All branches"
          />
          <select
            value={ageing} onChange={(e) => { setAgeing(e.target.value); setPage(1); }}
            className={inputCls} aria-label="Ageing bucket"
          >
            {AGEING_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select
            value={movement} onChange={(e) => { setMovement(e.target.value); setPage(1); }}
            className={inputCls} aria-label="Money movement"
          >
            {MOVEMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {/*
            The approval stage, as a filter AND as the totals.

            This replaced a strip of chips above the table. A plain dropdown
            would have lost what that strip was for — how much is sitting at
            each stage — so each option carries its own amount. One control,
            both answers, and four columns of screen saved.
          */}
          <select
            value={stage} onChange={(e) => { setStage(e.target.value); setPage(1); }}
            className={inputCls} aria-label="Approval stage"
          >
            <option value="">All stages · {money(totals.outstanding || 0)}</option>
            {STAGE_ORDER.map((k) => (
              <option key={k} value={k}>
                {stageMeta(k).label} · {money(stageTotals[k] || 0)}
              </option>
            ))}
          </select>
        </div>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setSearch(""); setBranchId(""); setAgeing(""); setStage("");
              setMovement(MOVEMENT_FILTER.ALL); setPage(1);
            }}
            className="mt-3 inline-flex items-center gap-1 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-1.5 text-sm font-semibold text-rose-600 shadow-sm transition hover:bg-rose-100"
          >
            <RotateCcw className="h-4 w-4" /> Clear Filter
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50/60">
            <tr>
              <th className={thSticky}>Vendor</th>
              <th className={thRight}>Invoices</th>
              <th className={thRight}>Billing</th>
              <th className={thRight}>Net Payable</th>
              <th className={thRight}>Paid</th>
              <th className={thRight}>Outstanding</th>
              <th className={thRight}>Overdue</th>
              <th className={th}>Stage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={colCount} className="px-4 py-12 text-center text-sm text-slate-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={colCount} className="px-4 py-12 text-center text-sm text-slate-400">
                Nothing outstanding with these filters.
              </td></tr>
            ) : (
              rows.map((r) => (
                <tr key={String(r.vendorId)} className="group transition hover:bg-slate-50/60">
                  {/* Sticky, because the money columns scroll sideways and a
                      number whose vendor has scrolled off the screen is not
                      worth reading. */}
                  <td className={tdSticky + " font-semibold text-slate-900"}>
                    {r.vendorName}
                  </td>
                  <td className={tdRight}>
                    <span className="inline-flex items-center justify-end gap-1.5">
                      {r.invoiceCount || <span className="text-slate-300">—</span>}
                      {r.invoiceCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setView({ mode: "invoices", vendorId: r.vendorId, vendorName: r.vendorName })}
                          title={`Show the ${r.invoiceCount} invoices behind this row`}
                          className="rounded-md border border-indigo-200 bg-white p-1 text-indigo-600 shadow-sm transition hover:bg-indigo-50"
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </span>
                  </td>
                  {/* Billing before Net Payable, in the order the arithmetic
                      runs: billed, then less credit notes and plus misc. */}
                  <td className={tdRight}>{num(r.billing, "text-blue-700")}</td>
                  <td className={tdRight}>{num(r.netPayable)}</td>
                  <td className={tdRight}>{num(r.paid, "text-emerald-700")}</td>
                  <td className={tdRight + " font-bold text-slate-900"}>
                    {r.outstanding ? money(r.outstanding) : <span className="text-slate-300">—</span>}
                    {r.writtenOff > 0 && (
                      <span
                        className="mt-0.5 block text-[10px] font-normal text-slate-400"
                        title="Closed for less than the payable — this will never be paid, so it is not outstanding"
                      >
                        {money(r.writtenOff)} written off
                      </span>
                    )}
                  </td>
                  {/* Money the terms said should already have gone. Counted
                      from the CONTRACTUAL due date, never from a rescheduled
                      one — the vendor counts from the terms, and this ledger
                      has to reconcile against their books, not our intentions. */}
                  <td className={tdRight}>
                    {r.overdueAmount > 0 ? (
                      <>
                        <span className="font-semibold text-rose-700">{money(r.overdueAmount)}</span>
                        <span className="mt-0.5 block text-[10px] font-normal text-rose-500">
                          {r.overdueCount} {r.overdueCount === 1 ? "invoice" : "invoices"}
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className={td}>
                    <StageStrip outstandingBy={r.outstandingBy} stageCount={r.stageCount} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="border-t-2 border-slate-200 bg-slate-50">
              <tr>
                <td className={tdSticky + " font-bold text-slate-900"}>TOTAL</td>
                <td className={tdRight + " font-bold"}>{totals.invoiceCount || 0}</td>
                <td className={tdRight + " font-bold text-blue-700"}>{money(totals.billing || 0)}</td>
                <td className={tdRight + " font-semibold"}>{money(totals.netPayable || 0)}</td>
                <td className={tdRight + " font-bold text-emerald-700"}>{money(totals.paid || 0)}</td>
                <td className={tdRight + " font-bold text-slate-900"}>{money(totals.outstanding || 0)}</td>
                <td className={tdRight + " font-bold text-rose-700"}>
                  {totals.overdueAmount > 0 ? money(totals.overdueAmount) : <span className="font-normal text-slate-300">—</span>}
                </td>
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
        Click the info icon on any invoice count to see which invoices make up that outstanding.
        No period selector here on purpose — an unpaid March invoice is still outstanding in September,
        and a date filter would let it disappear. <strong>Overdue</strong> is what the payment terms said
        should already have gone: invoice date + terms against today. It counts from that contractual due
        date, never from a date we rescheduled the payment to — the vendor counts from the terms, and this
        has to reconcile against their books. Use the Ageing filter to split it by how old it is. Money
        settled short is written off rather than left outstanding for ever.
      </FootNote>
    </div>
  );
};

export default OutstandingReportComp;
