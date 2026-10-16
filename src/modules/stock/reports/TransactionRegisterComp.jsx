"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import Pagination from "@/shared/ui/pagination/Pagination";
import {
  RotateCcw, Wallet, Users, Paperclip, Clock, FileMinus, PlusCircle,
  LayoutGrid, ChevronDown, ChevronRight, History,
} from "lucide-react";
import { SearchableSelect, inputCls, money } from "@/modules/stock/shared/StockSharedUI";
import { PAYMENT_MODE_LABEL, paymentStateMeta } from "@/modules/stock/shared/paymentStatus";
import PeriodPicker, { defaultPeriod } from "@/modules/stock/vendorLedger/PeriodPicker";
import {
  th, thRight, td, tdRight, fmtDate, fmtDateTime, ReportHeader, Tile, ErrorBanner, FootNote,
} from "./reportUi";

/* ============================================================= */
/* Transaction Register — everything that has happened against a  */
/* vendor invoice, newest first.                                  */
/*                                                                */
/* Three kinds of row, one page. A payment, a debit note and a    */
/* misc charge are different documents but the same kind of event: */
/* dated, with an amount, changing what we owe. Splitting them     */
/* across three screens would mean nobody could ever see the order */
/* things happened in, which is the whole question.                */
/*                                                                */
/* Hence the All tab. The per-type tabs exist because each carries */
/* columns the others have no use for — a mode and a UTR on a      */
/* payment, an edit trail on an adjustment.                        */
/* ============================================================= */

const TYPE = { ALL: "ALL", PAYMENT: "PAYMENT", DEBIT_NOTE: "DEBIT_NOTE", MISC: "MISC" };

const TABS = [
  { key: TYPE.ALL, label: "All", icon: LayoutGrid, on: "border-slate-300 bg-slate-100 text-slate-800" },
  { key: TYPE.PAYMENT, label: "Payments", icon: Wallet, on: "border-emerald-300 bg-emerald-50 text-emerald-700" },
  { key: TYPE.DEBIT_NOTE, label: "Debit Notes", icon: FileMinus, on: "border-rose-300 bg-rose-50 text-rose-700" },
  { key: TYPE.MISC, label: "Misc Charges", icon: PlusCircle, on: "border-sky-300 bg-sky-50 text-sky-700" },
];

/*
  What a row DID, which is not the same as its sign. A payment and a debit
  note both leave us owing less, but only one of them moved money — and
  somebody reconciling a bank statement has to tell them apart at a glance.
*/
const TYPE_META = {
  PAYMENT: { label: "Payment", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", tone: "text-emerald-700", sign: "" },
  DEBIT_NOTE: { label: "Debit Note", chip: "bg-rose-50 text-rose-700 ring-rose-200", tone: "text-rose-700", sign: "−" },
  MISC: { label: "Misc Charge", chip: "bg-sky-50 text-sky-700 ring-sky-200", tone: "text-sky-700", sign: "+" },
};
const typeMeta = (t) => TYPE_META[t] || { label: t, chip: "bg-slate-50 text-slate-600 ring-slate-200", tone: "text-slate-700", sign: "" };

const isAdjustment = (t) => t === TYPE.DEBIT_NOTE || t === TYPE.MISC;

/* A payment's description is assembled here, not on the server: the mode's
   display label belongs with the other client labels, and the service sends a
   code plus the bare reference. */
const paymentDetail = (r) =>
  [PAYMENT_MODE_LABEL[r.mode] || r.mode, r.refNo].filter(Boolean).join(" · ");

/*
  Module scope, not inside the page: a component created during a render is a
  new type every render, so React would rebuild every open history block on
  each keystroke in the search box.
*/
const AdjustmentHistory = ({ row: r }) => (
  <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
    <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
      <History className="h-3 w-3" /> History
    </p>
    <div className="space-y-1 text-xs">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="w-24 shrink-0 text-slate-400">{fmtDate(r.date)}</span>
        <span className="font-semibold text-slate-800">
          raised {money(r.edits.length ? r.edits[0].fromAmount : r.amount)}
        </span>
        <span className="text-slate-500">{r.byName || "—"}</span>
        {r.reason && <span className="text-slate-400">&ldquo;{r.reason}&rdquo;</span>}
      </div>

      {/* Every amount change, straight off the document. Nothing else in the
          system shows this, and "it used to be 60,000, who changed it" is the
          second question after "where did the debit note go". */}
      {r.edits.map((e, i) => (
        <div key={i} className="flex flex-wrap items-baseline gap-2">
          <span className="w-24 shrink-0 text-slate-400">{fmtDate(e.at)}</span>
          <span className="font-semibold text-slate-800">
            {money(e.fromAmount)} &rarr; {money(e.toAmount)}
          </span>
          <span className="text-slate-500">{e.byName || "—"}</span>
          {e.reason && <span className="text-slate-400">&ldquo;{e.reason}&rdquo;</span>}
        </div>
      ))}

      {r.status === "WITHDRAWN" && (
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="w-24 shrink-0 text-slate-400">{fmtDate(r.deletedAt)}</span>
          <span className="font-semibold text-slate-600">withdrawn</span>
          <span className="text-slate-500">{r.deletedByName || "—"}</span>
          {r.deletedReason && <span className="text-slate-400">&ldquo;{r.deletedReason}&rdquo;</span>}
        </div>
      )}
    </div>

    {r.lines.length > 0 && (
      <div className="mt-2 space-y-1">
        {r.lines.map((l, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-md bg-white px-2.5 py-1.5 text-xs">
            <span className="font-medium text-slate-800">{l.productName}</span>
            <span className="text-slate-500">
              {l.quantity} × {money(l.rate)}{l.gstRate > 0 ? ` + ${l.gstRate}% GST` : ""}
            </span>
            <span className="ml-auto font-semibold tabular-nums text-slate-800">{money(l.amount)}</span>
          </div>
        ))}
      </div>
    )}

    {r.extras.length > 0 && (
      <div className="mt-2 space-y-1">
        {r.extras.map((e, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-md bg-white px-2.5 py-1.5 text-xs">
            <span className="text-slate-700">{e.note || "—"}</span>
            <span className="ml-auto font-semibold tabular-nums text-slate-800">{money(e.amount)}</span>
          </div>
        ))}
      </div>
    )}
  </div>
);

const TransactionRegisterComp = () => {
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({});
  const [modes, setModes] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState({});

  const [tab, setTab] = useState(TYPE.ALL);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [mode, setMode] = useState("");
  // Off by default: a withdrawn debit note is history, not a live figure.
  const [includeWithdrawn, setIncludeWithdrawn] = useState(false);
  const [period, setPeriod] = useState(defaultPeriod);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [vendors, setVendors] = useState([]);
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    (async () => {
      try {
        const [vr, br] = await Promise.all([
          fetch(`${API_BACKEND_URL}/stock/vendors?limit=500`, { credentials: "include" }),
          fetch(`${API_BACKEND_URL}/stock/scoped-branches?module=invoice-list`, { credentials: "include" }),
        ]);
        const vj = await vr.json();
        const bj = await br.json();
        if (vj.success) setVendors(vj.data || []);
        if (bj.success) setBranches(bj.data?.branches || []);
      } catch {
        // Non-fatal — the dropdowns just stay empty.
      }
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit), type: tab });
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (vendorId) params.set("vendorId", vendorId);
      if (branchId) params.set("branchId", branchId);
      if (mode) params.set("mode", mode);
      if (includeWithdrawn) params.set("includeWithdrawn", "true");
      // The window applies to the date the event happened on — when money
      // left, or when the note was put on the invoice.
      if (period.from) params.set("from", period.from);
      if (period.to) params.set("to", period.to);

      const res = await fetch(`${API_BACKEND_URL}/stock/reports/transactions?${params.toString()}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to load transaction register");
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
  }, [tab, page, limit, debouncedSearch, vendorId, branchId, mode, includeWithdrawn, period.from, period.to]);

  useEffect(() => { load(); }, [load]);

  const vendorOptions = useMemo(() => vendors.map((v) => ({ value: v._id, label: v.name })), [vendors]);
  const branchOptions = useMemo(() => branches.map((b) => ({ value: b._id, label: b.name })), [branches]);

  const counts = totals.counts || {};
  const byMode = totals.byMode || {};
  const hasFilters = !!search || !!vendorId || !!branchId || !!mode || includeWithdrawn;
  const showMode = tab === TYPE.ALL || tab === TYPE.PAYMENT;
  const showWithdrawn = tab !== TYPE.PAYMENT;

  const toggle = (key) => setOpen((p) => ({ ...p, [key]: !p[key] }));

  const switchTab = (key) => {
    setTab(key);
    setPage(1);
    // Mode is payment-only. Leaving it set while moving to Debit Notes would
    // silently empty the tab for a reason the screen no longer shows.
    if (key === TYPE.DEBIT_NOTE || key === TYPE.MISC) setMode("");
  };

  const clearAll = () => {
    setSearch(""); setVendorId(""); setBranchId(""); setMode("");
    setIncludeWithdrawn(false); setPage(1);
  };

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <ReportHeader
        title="Transaction Register" onRefresh={load}
        subtitle="Every payment, debit note and misc charge raised against a vendor invoice — newest first."
        right={
          <div className="flex flex-wrap gap-2">
            <Tile icon={Users} label="Vendors" value={totals.vendors ?? 0} tone="border-slate-200 bg-white text-slate-700" />
            <Tile icon={Wallet} label="Paid" value={money(totals.paid || 0)} tone="border-emerald-200 bg-emerald-50 text-emerald-800" />
            <Tile icon={FileMinus} label="Debit Notes" value={money(totals.debitNotes || 0)} tone="border-rose-200 bg-rose-50 text-rose-700" />
            <Tile icon={PlusCircle} label="Misc" value={money(totals.misc || 0)} tone="border-sky-200 bg-sky-50 text-sky-700" />
            {(totals.writtenOff || 0) > 0 && (
              <Tile icon={Clock} label="Written Off" value={money(totals.writtenOff)} tone="border-slate-300 bg-slate-100 text-slate-600" />
            )}
          </div>
        }
      />

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      {/* Tab counts are worked out with every filter EXCEPT the tab's own
          applied, so a badge answers "how many will I get if I click this". */}
      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        {TABS.map((t) => {
          const active = tab === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key} type="button" onClick={() => switchTab(t.key)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-semibold shadow-sm transition ${
                active ? t.on : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              }`}
              aria-pressed={active}
            >
              <Icon className="h-4 w-4" />
              {t.label}
              <span className={`rounded-full px-1.5 text-xs tabular-nums ${active ? "bg-white/60" : "bg-slate-100 text-slate-500"}`}>
                {counts[t.key] ?? 0}
              </span>
            </button>
          );
        })}

        {showWithdrawn && (
          <label className="ml-auto flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox" checked={includeWithdrawn}
              onChange={(e) => { setIncludeWithdrawn(e.target.checked); setPage(1); }}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            Show withdrawn
            {counts.WITHDRAWN > 0 && (
              <span className="rounded-full bg-slate-100 px-1.5 text-xs tabular-nums text-slate-500">
                {counts.WITHDRAWN}
              </span>
            )}
          </label>
        )}
      </div>

      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendor, invoice, PO, UTR or reason..." className={inputCls}
          />
          <SearchableSelect
            value={vendorId} onChange={(v) => { setVendorId(v); setPage(1); }}
            options={vendorOptions} placeholder="All vendors"
          />
          <SearchableSelect
            value={branchId} onChange={(v) => { setBranchId(v); setPage(1); }}
            options={branchOptions} placeholder="All branches"
          />
          {/*
            The payment mode, as a filter AND as the totals.

            This replaced a strip of chips above the table. A plain dropdown
            would have lost what that strip was for — a bank reconciliation is
            done one channel at a time, and the NEFT statement does not contain
            the UPI rows — so each option carries its own amount.

            Only on the tabs where it means anything. A debit note was not
            paid by NEFT, so offering the filter on those tabs would only let
            somebody empty the page for a reason the screen could not explain.
          */}
          {showMode && (
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
          )}
          {hasFilters && (
            <button
              type="button" onClick={clearAll}
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
              <th className={th}>Date</th>
              {tab === TYPE.ALL && <th className={th}>Type</th>}
              <th className={th}>Vendor</th>
              <th className={th}>Invoice</th>
              <th className={th}>{tab === TYPE.PAYMENT ? "Mode / Reference" : "Detail"}</th>
              <th className={thRight}>Amount</th>
              {tab === TYPE.PAYMENT && <th className={th}>Against Invoice</th>}
              {isAdjustment(tab) && <th className={th}>Status</th>}
              <th className={th}>By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-400">
                Nothing happened with these filters.
              </td></tr>
            ) : (
              rows.map((r) => {
                const m = typeMeta(r.type);
                const withdrawn = r.status === "WITHDRAWN";
                const canExpand = isAdjustment(r.type);
                const isOpen = !!open[r.rowKey];
                const pm = r.type === TYPE.PAYMENT ? paymentStateMeta(r.paymentState) : null;
                return (
                  <React.Fragment key={r.rowKey}>
                    <tr className={`transition hover:bg-slate-50/60 ${withdrawn ? "bg-slate-50/60 text-slate-400" : ""}`}>
                      <td className={td + " whitespace-nowrap text-xs"}>{fmtDate(r.date)}</td>

                      {tab === TYPE.ALL && (
                        <td className={td}>
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${m.chip}`}>
                            {m.label}
                          </span>
                        </td>
                      )}

                      <td className={td + " font-medium text-slate-900"}>{r.vendorName}</td>

                      {/* Number, PO and invoice date together: nothing makes an
                          invoice number unique, so on its own it cannot
                          identify which invoice this event belongs to. */}
                      <td className={td}>
                        <span className="block font-semibold text-slate-900">{r.invoiceNumber || "—"}</span>
                        <span className="text-[11px] text-slate-400">
                          {r.poNumber || "—"}{r.invoiceDate ? ` · billed ${fmtDate(r.invoiceDate)}` : ""}
                        </span>
                      </td>

                      <td className={td}>
                        <span className="block text-slate-700">
                          {r.type === TYPE.PAYMENT ? paymentDetail(r) : r.detail || "—"}
                        </span>
                        {isAdjustment(r.type) && r.reason && r.reason !== r.detail && (
                          <span className="block text-[11px] text-slate-400">{r.reason}</span>
                        )}
                        {r.type === TYPE.PAYMENT && (r.proofs || []).length > 0 && (
                          <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-slate-400">
                            <Paperclip className="h-3 w-3" /> {r.proofs.length}
                          </span>
                        )}
                      </td>

                      <td className={tdRight}>
                        <span className={`font-bold ${withdrawn ? "text-slate-400 line-through" : m.tone}`}>
                          {m.sign}{money(r.amount)}
                        </span>
                      </td>

                      {tab === TYPE.PAYMENT && (
                        <td className={td + " text-xs"}>
                          <span className="block text-slate-500">
                            {money(r.invoicePaidTotal)} of {money(r.invoicePayable)}
                          </span>
                          {pm && (
                            <span className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${pm.chip}`}>
                              {pm.label}
                            </span>
                          )}
                        </td>
                      )}

                      {isAdjustment(tab) && (
                        <td className={td + " text-xs"}>
                          {withdrawn ? (
                            <>
                              <span className="inline-flex rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                                Withdrawn
                              </span>
                              <span className="mt-0.5 block text-[11px] text-slate-400">
                                {fmtDate(r.deletedAt)} · {r.deletedReason || "no reason given"}
                              </span>
                            </>
                          ) : (
                            <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 ring-1 ring-inset ring-emerald-200">
                              Active
                            </span>
                          )}
                          {r.edits?.length > 0 && (
                            <span className="mt-0.5 block text-[11px] text-amber-600">
                              edited {r.edits.length}&times;
                            </span>
                          )}
                        </td>
                      )}

                      <td className={td + " text-xs text-slate-500"}>
                        {r.byName || "—"}
                        {canExpand && (
                          <button
                            type="button" onClick={() => toggle(r.rowKey)}
                            className="ml-2 inline-flex items-center gap-0.5 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-500 shadow-sm transition hover:bg-slate-50"
                            aria-expanded={isOpen}
                            title="Show how this adjustment changed over time"
                          >
                            {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            history
                          </button>
                        )}
                      </td>
                    </tr>

                    {/* Inline rather than a page: a history is two to four
                        lines, and losing the row it belongs to would cost more
                        than the room it takes. */}
                    {canExpand && isOpen && (
                      <tr>
                        <td colSpan={9} className="bg-slate-50/40 px-4 py-3">
                          <AdjustmentHistory row={r} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="border-t-2 border-slate-200 bg-slate-50">
              <tr>
                <td className={td + " font-bold text-slate-900"} colSpan={tab === TYPE.ALL ? 5 : 4}>
                  TOTAL · {total} {total === 1 ? "transaction" : "transactions"} on this tab
                </td>
                <td className={tdRight + " font-bold text-slate-900"}>
                  {tab === TYPE.PAYMENT
                    ? money(totals.paid || 0)
                    : tab === TYPE.DEBIT_NOTE
                      ? `−${money(totals.debitNotes || 0)}`
                      : tab === TYPE.MISC
                        ? `+${money(totals.misc || 0)}`
                        : ""}
                </td>
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
        A payment sits on the day the money left; a debit note or misc charge on the day it was put on the
        invoice. One settlement paid partly by NEFT and partly by UPI appears as two rows with two
        references, because that is how it appears on the statement. Withdrawn debit notes are hidden by
        default — switch them on above to see what was raised and later taken back, and why. Written off is
        not a payment: no money left, but a payable-versus-paid check will be short by exactly that.
      </FootNote>
    </div>
  );
};

export default TransactionRegisterComp;
