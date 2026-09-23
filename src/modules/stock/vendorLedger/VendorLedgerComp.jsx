"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import Pagination from "@/shared/ui/pagination/Pagination";
import { RotateCcw, Info, Users, Receipt, FileMinus, PlusCircle, Wallet, AlertTriangle } from "lucide-react";
import { SearchableSelect, inputCls, money } from "@/modules/stock/shared/StockSharedUI";
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
  }, [page, limit, debouncedSearch, branchId, ageing, period.from, period.to]);

  useEffect(() => { loadList(); }, [loadList]);

  const branchOptions = useMemo(
    () => branches.map((b) => ({ value: b._id, label: b.name })),
    [branches]
  );

  const hasFilters = !!search || !!branchId || !!ageing;

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
        </div>
        {hasFilters && (
          <button
            type="button"
            onClick={() => { setSearch(""); setBranchId(""); setAgeing(""); setPage(1); }}
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
              <th className={thRight}>Inv</th>
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
                  <td className={tdRight + " font-bold text-slate-900"}>{money(r.outstanding)}</td>
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
        across every invoice — how much is stuck is not a question about a date range.
      </p>
    </div>
  );
};

export default VendorLedgerComp;
