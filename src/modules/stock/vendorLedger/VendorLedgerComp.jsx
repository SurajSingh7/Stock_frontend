"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import Pagination from "@/shared/ui/pagination/Pagination";
import { RotateCcw, Info, Users, Receipt, FileMinus, PlusCircle, Wallet, AlertTriangle } from "lucide-react";
import { SearchableSelect, inputCls, money } from "@/modules/stock/shared/StockSharedUI";
import {
  MOVEMENT_FILTER, MOVEMENT_OPTIONS, STAGE_ORDER, stageMeta, stageBreakdown,
} from "@/modules/stock/shared/ledgerStages";
import PeriodPicker, { defaultPeriod } from "./PeriodPicker";
import VendorLedgerDetail from "./VendorLedgerDetail";

/* ============================================================= */
/* Vendor Ledger — one row per vendor.                            */
/*                                                                */
/* Two kinds of number live side by side here, and the difference  */
/* matters: the billing columns answer "what happened in the       */
/* chosen period", while Outstanding and Ageing answer "what is    */
/* stuck RIGHT NOW". The second pair ignores the period on         */
/* purpose — "how much is overdue" is not a question about a date   */
/* range, and the header says so rather than leaving it to be      */
/* worked out.                                                     */
/* ============================================================= */

const th = "px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500";
const thRight = th + " text-right";
const td = "px-4 py-3 text-sm text-slate-700 align-middle";
const tdRight = td + " text-right tabular-nums";

const AGEING_OPTIONS = [
  { value: "", label: "Any ageing" },
  { value: "D0_30", label: "Overdue 0-30 days" },
  { value: "D31_60", label: "Overdue 31-60 days" },
  { value: "D61_90", label: "Overdue 61-90 days" },
  { value: "D90_PLUS", label: "Overdue 90+ days" },
];

/* Headline tiles — the six figures someone opens this page for. */
const Tile = ({ icon: Icon, label, value, tone }) => (
  <div className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2 ${tone}`}>
    <Icon className="h-4 w-4 shrink-0 opacity-70" />
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">{label}</p>
      <p className="truncate text-sm font-bold tabular-nums">{value}</p>
    </div>
  </div>
);

/*
  Where the outstanding is stuck, under one vendor's figure.

  Only non-zero stages are drawn: an empty strip is the right answer for a
  vendor who owes nothing, and four zeroes on every settled row would bury the
  rows that need attention.
*/
const StageStrip = ({ outstandingBy, stageCount }) => {
  const parts = stageBreakdown(outstandingBy, stageCount);
  if (!parts.length) return null;
  return (
    <span className="mt-1 flex flex-wrap justify-end gap-1">
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

const VendorLedgerComp = () => {
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [branchId, setBranchId] = useState("");
  const [ageing, setAgeing] = useState("");
  // Every invoice by default. This is a filter, never the page's only truth.
  const [movement, setMovement] = useState(MOVEMENT_FILTER.ALL);
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

  const loadList = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (branchId) params.set("branchId", branchId);
      if (ageing) params.set("ageing", ageing);
      if (movement && movement !== MOVEMENT_FILTER.ALL) params.set("movement", movement);
      // Whichever tab produced them, only from/to ever reach the API.
      if (period.from) params.set("from", period.from);
      if (period.to) params.set("to", period.to);

      const res = await fetch(`${API_BACKEND_URL}/stock/vendor-ledger?${params.toString()}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to load ledger");
      setRows(json.data?.rows || []);
      setTotals(json.data?.totals || {});
      setTotal(json.pagination?.total || 0);
    } catch (e) {
      setError(e.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, branchId, ageing, movement, period.from, period.to]);

  useEffect(() => { loadList(); }, [loadList]);

  const branchOptions = useMemo(
    () => branches.map((b) => ({ value: b._id, label: b.name })),
    [branches]
  );

  const hasFilters = !!search || !!branchId || !!ageing || movement !== MOVEMENT_FILTER.ALL;
  const stageTotals = totals.outstandingBy || {};

  if (view.mode === "ledger") {
    return (
      <VendorLedgerDetail
        vendorId={view.vendorId}
        vendorName={view.vendorName}
        initialYear={period.year}
        onBack={() => setView({ mode: "list" })}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Vendor Ledger</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            What each vendor was billed, credited and paid in the chosen period — and what is still outstanding today.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Tile icon={Users} label="Vendors" value={totals.vendors ?? 0} tone="border-slate-200 bg-white text-slate-700" />
          <Tile icon={Receipt} label="Billing" value={money(totals.billing || 0)} tone="border-blue-200 bg-blue-50 text-blue-700" />
          <Tile icon={FileMinus} label="Credit Notes" value={money(totals.creditNotes || 0)} tone="border-rose-200 bg-rose-50 text-rose-700" />
          <Tile icon={PlusCircle} label="Misc" value={money(totals.misc || 0)} tone="border-sky-200 bg-sky-50 text-sky-700" />
          <Tile icon={Wallet} label="Paid" value={money(totals.paid || 0)} tone="border-emerald-200 bg-emerald-50 text-emerald-700" />
          <Tile icon={AlertTriangle} label="Outstanding" value={money(totals.outstanding || 0)} tone="border-amber-300 bg-amber-50 text-amber-800" />
        </div>
      </div>

      {/* The same outstanding, split by why it has not moved.

          This is the answer to "I rejected that approval, why is it still
          here": the money is still owed, and now the page says where it is
          stuck instead of leaving a rejected invoice looking identical to one
          about to be paid. */}
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
                {m.label}
                <span className="tabular-nums">{money(amount)}</span>
              </span>
            );
          })}
          {(totals.writtenOff || 0) > 0 && (
            <span
              className="ml-auto flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-600"
              title="Invoices closed for less than their payable. This money will never be paid, so it is not outstanding."
            >
              Written off <span className="tabular-nums">{money(totals.writtenOff)}</span>
            </span>
          )}
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="font-bold">&times;</button>
        </div>
      )}

      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
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
          <select
            value={ageing} onChange={(e) => { setAgeing(e.target.value); setPage(1); }}
            className={inputCls}
          >
            {AGEING_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {/* "Only show it once an amount is entered", as a filter. Applied per
              invoice, so a vendor whose invoices all fail it drops off the
              list rather than showing a row of zeroes. */}
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

      <div className="mb-5">
        <PeriodPicker value={period} onChange={(p) => { setPeriod(p); setPage(1); }} />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50/60">
            <tr>
              <th className={th}>Vendor</th>
              <th className={thRight}>Inv COUNT</th>
              <th className={thRight}>Billing</th>
              <th className={thRight}>Credit Notes</th>
              <th className={thRight}>Misc</th>
              <th className={thRight}>Net Payable</th>
              <th className={thRight}>Paid</th>
              <th className={thRight}>Outstanding</th>
              <th className={th}>Overdue</th>
              <th className={thRight}>Ledger</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={10} className="px-4 py-12 text-center text-sm text-slate-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-12 text-center text-sm text-slate-400">
                No vendor activity in this period.
              </td></tr>
            ) : (
              rows.map((r) => (
                <tr key={String(r.vendorId)} className="transition hover:bg-slate-50/60">
                  <td className={td + " font-semibold text-slate-900"}>{r.vendorName}</td>
                  <td className={tdRight}>{r.invoiceCount || <span className="text-slate-300">—</span>}</td>
                  <td className={tdRight + " font-medium text-blue-700"}>{money(r.billing)}</td>
                  <td className={tdRight}>
                    {r.creditNotes ? <span className="text-rose-700">−{money(r.creditNotes)}</span> : <span className="text-slate-300">—</span>}
                  </td>
                  <td className={tdRight}>
                    {r.misc ? <span className="text-sky-700">+{money(r.misc)}</span> : <span className="text-slate-300">—</span>}
                  </td>
                  <td className={tdRight + " font-semibold text-slate-900"}>{money(r.netPayable)}</td>
                  <td className={tdRight + " text-emerald-700"}>{r.paid ? money(r.paid) : <span className="text-slate-300">—</span>}</td>
                  <td className={tdRight}>
                    <span className="block font-bold text-slate-900">{money(r.outstanding)}</span>
                    <StageStrip outstandingBy={r.outstandingBy} stageCount={r.stageCount} />
                    {r.writtenOff > 0 && (
                      <span
                        className="mt-0.5 block text-[10px] text-slate-400"
                        title="Closed for less than the payable — this will never be paid, so it is not outstanding"
                      >
                        {money(r.writtenOff)} written off
                      </span>
                    )}
                  </td>
                  <td className={td}>
                    {r.overdueCount > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
                        {r.overdueCount} inv · {money(r.overdueAmount)}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                  <td className={tdRight}>
                    <button
                      type="button"
                      onClick={() => setView({ mode: "ledger", vendorId: r.vendorId, vendorName: r.vendorName })}
                      title="Open the month-wise ledger"
                      className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-indigo-600 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
                    >
                      <Info className="h-3.5 w-3.5" /> Ledger
                    </button>
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
                <td className={tdRight + " font-bold text-blue-700"}>{money(totals.billing || 0)}</td>
                <td className={tdRight + " font-bold text-rose-700"}>{totals.creditNotes ? `−${money(totals.creditNotes)}` : money(0)}</td>
                <td className={tdRight + " font-bold text-sky-700"}>{totals.misc ? `+${money(totals.misc)}` : money(0)}</td>
                <td className={tdRight + " font-bold text-slate-900"}>{money(totals.netPayable || 0)}</td>
                <td className={tdRight + " font-bold text-emerald-700"}>{money(totals.paid || 0)}</td>
                <td className={tdRight + " font-bold text-slate-900"}>{money(totals.outstanding || 0)}</td>
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

      <p className="mt-3 text-xs text-slate-400">
        Billing, credit notes, misc and paid follow the period above. Outstanding and overdue are as on today,
        across every invoice — how much is stuck is not a question about a date range. A rejected payment
        approval still counts as outstanding: the vendor billed us either way, so the ledger says where it is
        stuck rather than hiding it. Open a vendor&apos;s ledger to see it invoice by invoice.
      </p>
    </div>
  );
};

export default VendorLedgerComp;
