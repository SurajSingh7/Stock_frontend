"use client";

import React, { useState, useEffect, useCallback } from "react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import Pagination from "@/shared/ui/pagination/Pagination";
import { RotateCcw } from "lucide-react";
import { inputCls, money } from "@/modules/stock/shared/StockSharedUI";
import { paymentStateMeta } from "@/modules/stock/shared/paymentStatus";
import {
  MOVEMENT_FILTER, MOVEMENT_OPTIONS, STAGE_ORDER, stageMeta,
} from "@/modules/stock/shared/ledgerStages";

/* ============================================================= */
/* One vendor, invoice by invoice — the level this module was      */
/* missing.                                                       */
/*                                                                */
/* There were only two views: a single rolled-up row per vendor,   */
/* and a month of transactions. Neither answers "which invoice is  */
/* this and what is happening to it", so an unexpected figure had  */
/* nowhere to be traced back to.                                   */
/*                                                                */
/* It also fixes a real ambiguity: nothing makes invoiceNumber     */
/* unique, so two invoices can carry the same number. PO number    */
/* and invoice date sit beside it here, which is what tells them    */
/* apart on sight.                                                 */
/* ============================================================= */

const th = "px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500";
const thRight = th + " text-right";
const td = "px-3 py-2.5 text-sm text-slate-700 align-top";
const tdRight = td + " text-right tabular-nums";

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const num = (n, cls = "text-slate-700") =>
  n ? <span className={cls}>{money(n)}</span> : <span className="text-slate-300">—</span>;

const STAGE_OPTIONS = [
  { value: "ALL", label: "Any stage" },
  ...STAGE_ORDER.map((k) => ({ value: k, label: stageMeta(k).label })),
];

const VendorInvoicesTab = ({ vendorId, year }) => {
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [movement, setMovement] = useState(MOVEMENT_FILTER.ALL);
  const [stage, setStage] = useState("ALL");
  /*
    Off by default, unlike the Months tab.

    An invoice is one thing whatever year its payments landed in, and the
    question here is usually "where is this invoice" rather than "what
    happened in 2026". The year filter is offered because the tab sits under a
    year pager and it would be strange not to honour it on request.
  */
  const [byYear, setByYear] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (movement !== MOVEMENT_FILTER.ALL) params.set("movement", movement);
      if (stage !== "ALL") params.set("stage", stage);
      if (byYear) params.set("year", String(year));

      const res = await fetch(
        `${API_BACKEND_URL}/stock/vendor-ledger/${vendorId}/invoices?${params.toString()}`,
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
  }, [vendorId, page, limit, debouncedSearch, movement, stage, byYear, year]);

  useEffect(() => { load(); }, [load]);

  const hasFilters =
    !!search || movement !== MOVEMENT_FILTER.ALL || stage !== "ALL" || byYear;

  const clear = () => {
    setSearch(""); setMovement(MOVEMENT_FILTER.ALL); setStage("ALL");
    setByYear(false); setPage(1);
  };

  return (
    <>
      {error && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="font-bold">&times;</button>
        </div>
      )}

      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice or PO number..." className={inputCls}
          />
          <select
            value={movement} onChange={(e) => { setMovement(e.target.value); setPage(1); }}
            className={inputCls} aria-label="Money movement"
          >
            {MOVEMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select
            value={stage} onChange={(e) => { setStage(e.target.value); setPage(1); }}
            className={inputCls} aria-label="Where the outstanding is stuck"
          >
            {STAGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox" checked={byYear}
              onChange={(e) => { setByYear(e.target.checked); setPage(1); }}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            Only {year}
          </label>
        </div>
        {hasFilters && (
          <button
            type="button" onClick={clear}
            className="mt-3 inline-flex items-center gap-1 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-1.5 text-sm font-semibold text-rose-600 shadow-sm transition hover:bg-rose-100"
          >
            <RotateCcw className="h-4 w-4" /> Clear Filter
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full">
          <thead className="bg-slate-50/80">
            <tr>
              <th className={th}>Invoice</th>
              <th className={th}>Date</th>
              <th className={th}>Due</th>
              <th className={thRight}>Billing</th>
              <th className={thRight}>Credit Notes</th>
              <th className={thRight}>Misc</th>
              <th className={thRight}>Payable</th>
              <th className={thRight}>Paid</th>
              <th className={thRight}>Outstanding</th>
              <th className={th}>Where it stands</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={10} className="px-4 py-12 text-center text-sm text-slate-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-12 text-center text-sm text-slate-400">
                No invoice matches these filters.
              </td></tr>
            ) : (
              rows.map((r) => {
                const pm = paymentStateMeta(r.paymentState);
                const sm = stageMeta(r.stage);
                return (
                  <tr key={String(r.invoiceId)} className="transition hover:bg-slate-50/60">
                    {/* Number, PO and date together: the number alone is not
                        unique, so on its own it cannot identify a row. */}
                    <td className={td}>
                      <span className="block font-semibold text-slate-900">{r.invoiceNumber}</span>
                      <span className="text-[11px] text-slate-400">{r.poNumber || "—"}</span>
                    </td>
                    <td className={td + " whitespace-nowrap text-xs"}>{fmtDate(r.invoiceDate)}</td>
                    <td className={td + " whitespace-nowrap text-xs"}>
                      <span className="block">{fmtDate(r.dueDate)}</span>
                      {r.daysOverdue > 0 && (
                        <span className="text-[11px] font-semibold text-rose-600">
                          {r.daysOverdue} days overdue
                        </span>
                      )}
                    </td>
                    <td className={tdRight}>{num(r.billing, "font-medium text-blue-700")}</td>
                    <td className={tdRight}>
                      {r.creditNotes ? <span className="text-rose-700">−{money(r.creditNotes)}</span> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className={tdRight}>
                      {r.misc ? <span className="text-sky-700">+{money(r.misc)}</span> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className={tdRight + " font-semibold text-slate-900"}>{money(r.payable)}</td>
                    <td className={tdRight}>
                      {num(r.paid, "font-medium text-emerald-700")}
                      {r.paymentCount > 1 && (
                        <span className="block text-[10px] text-slate-400">{r.paymentCount} entries</span>
                      )}
                    </td>
                    <td className={tdRight + " font-bold text-slate-900"}>
                      {r.outstanding ? money(r.outstanding) : <span className="text-slate-300">—</span>}
                      {r.writtenOff > 0 && (
                        <span
                          className="block text-[10px] text-slate-400"
                          title="Closed for less than the payable — this will never be paid, so it is not outstanding"
                        >
                          {money(r.writtenOff)} written off
                        </span>
                      )}
                    </td>
                    {/* Both axes, because they answer different questions: how
                        much has been paid, and why the rest has not moved. */}
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
                        <span className="mt-0.5 block max-w-[200px] text-[11px] text-rose-600" title={r.rejectedReason}>
                          {r.rejectedReason}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="border-t-2 border-slate-200 bg-slate-50">
              <tr>
                <td className={td + " font-bold text-slate-900"}>TOTAL</td>
                <td colSpan={2} className={td + " text-xs text-slate-500"}>
                  {totals.invoiceCount || 0} {totals.invoiceCount === 1 ? "invoice" : "invoices"}
                </td>
                <td className={tdRight + " font-bold text-blue-700"}>{money(totals.billing || 0)}</td>
                <td className={tdRight + " font-bold text-rose-700"}>{totals.creditNotes ? `−${money(totals.creditNotes)}` : money(0)}</td>
                <td className={tdRight + " font-bold text-sky-700"}>{totals.misc ? `+${money(totals.misc)}` : money(0)}</td>
                <td className={tdRight + " font-bold text-slate-900"}>{money(totals.payable || 0)}</td>
                <td className={tdRight + " font-bold text-emerald-700"}>{money(totals.paid || 0)}</td>
                <td className={tdRight + " font-bold text-slate-900"}>{money(totals.outstanding || 0)}</td>
                <td className={td}>
                  {totals.writtenOff > 0 && (
                    <span className="text-[11px] text-slate-500">{money(totals.writtenOff)} written off</span>
                  )}
                </td>
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
        Every invoice this vendor has raised, whatever year its payments landed in. A rejected payment approval
        still counts as outstanding — the vendor billed us either way — so the row says where it is stuck instead
        of disappearing.
      </p>
    </>
  );
};

export default VendorInvoicesTab;
