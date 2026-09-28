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
  th, thRight, td, tdRight, num, ReportHeader, Tile, ErrorBanner, FootNote,
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
/* Ageing buckets answer HOW OLD. The stage columns answer WHY it  */
/* has not moved — the two are different questions and a rejected  */
/* approval needs the second one to be visible, or the row looks   */
/* identical to one about to be paid.                              */
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
  const [buckets, setBuckets] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [branchId, setBranchId] = useState("");
  const [ageing, setAgeing] = useState("");
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
      setBuckets(json.data?.buckets || []);
      setTotal(json.pagination?.total || 0);
    } catch (e) {
      setError(e.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, branchId, ageing, movement]);

  useEffect(() => { load(); }, [load]);

  const branchOptions = useMemo(() => branches.map((b) => ({ value: b._id, label: b.name })), [branches]);
  const hasFilters = !!search || !!branchId || !!ageing || movement !== MOVEMENT_FILTER.ALL;
  const stageTotals = totals.outstandingBy || {};
  const colCount = 5 + buckets.length + 1;

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

      {/* The same outstanding, split by why it has not moved. A rejected
          payment approval still counts as owed — the vendor billed us either
          way — so this strip is what stops a rejected invoice looking like an
          arithmetic error. */}
      {(totals.outstanding || 0) > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <span className="mr-1 text-xs font-bold uppercase tracking-wider text-slate-500">
            Outstanding is sitting at
          </span>
          {STAGE_ORDER.map((k) => {
            const m = stageMeta(k);
            const amount = stageTotals[k] || 0;
            return (
              <span
                key={k} title={m.hint}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-semibold ${
                  amount > 0 ? m.tile : "border-slate-200 bg-slate-50 text-slate-300"
                }`}
              >
                {m.label} <span className="tabular-nums">{money(amount)}</span>
              </span>
            );
          })}
        </div>
      )}

      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
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
        </div>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setSearch(""); setBranchId(""); setAgeing("");
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
              <th className={th}>Vendor</th>
              <th className={thRight}>Invoices</th>
              <th className={thRight}>Net Payable</th>
              <th className={thRight}>Paid</th>
              <th className={thRight}>Outstanding</th>
              {/* Bucket labels come from the server, so the columns and the
                  arithmetic behind them can never drift apart. */}
              {buckets.map((b) => <th key={b.key} className={thRight}>{b.label}</th>)}
              <th className={th}>Where it&apos;s stuck</th>
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
                <tr key={String(r.vendorId)} className="transition hover:bg-slate-50/60">
                  <td className={td + " font-semibold text-slate-900"}>
                    {r.vendorName}
                    {r.overdueCount > 0 && (
                      <span className="mt-0.5 block text-[11px] font-semibold text-rose-600">
                        {r.overdueCount} overdue · {money(r.overdueAmount)}
                      </span>
                    )}
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
                  {buckets.map((b) => (
                    <td key={b.key} className={tdRight}>
                      {num(r.ageing?.[b.key], b.key === "D90_PLUS" ? "font-semibold text-rose-700" : "text-slate-700")}
                    </td>
                  ))}
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
                <td className={td + " font-bold text-slate-900"}>TOTAL</td>
                <td className={tdRight + " font-bold"}>{totals.invoiceCount || 0}</td>
                <td className={tdRight + " font-semibold"}>{money(totals.netPayable || 0)}</td>
                <td className={tdRight + " font-bold text-emerald-700"}>{money(totals.paid || 0)}</td>
                <td className={tdRight + " font-bold text-slate-900"}>{money(totals.outstanding || 0)}</td>
                <td colSpan={buckets.length + 1} />
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
        and a date filter would let it disappear. Ageing counts from the contractual due date (invoice
        date + terms), not from when we scheduled the payment. Money settled short is written off rather
        than left outstanding for ever.
      </FootNote>
    </div>
  );
};

export default OutstandingReportComp;
