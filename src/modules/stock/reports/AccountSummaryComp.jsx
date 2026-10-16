"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import Pagination from "@/shared/ui/pagination/Pagination";
import { RotateCcw, Users, Receipt, Percent, FileMinus, IndianRupee, Wallet, AlertTriangle, Info, Eye, ArrowRight, PlusCircle, MoreVertical, BookOpen } from "lucide-react";
import { SearchableSelect, Modal, inputCls, money } from "@/modules/stock/shared/StockSharedUI";
import { STAGE_ORDER, stageMeta } from "@/modules/stock/shared/ledgerStages";
import { PAYMENT_MODE_LABEL } from "@/modules/stock/shared/paymentStatus";
import { usePermissions } from "@/context/PermissionContext";
import { anchorRect } from "@/modules/stock/shared/anchorRect";
import VendorLedgerDetail from "@/modules/stock/vendorLedger/VendorLedgerDetail";
import PeriodPicker, { allTimePeriod } from "@/modules/stock/vendorLedger/PeriodPicker";
import VendorInvoicesView, { MODE } from "./VendorInvoicesView";
import { BillingCell, BillingBreakupPopup } from "./taxBreakup";
import {
  thRight, thSticky, tdRight, tdSticky,
  num, fmtDate, ReportHeader, Tile, ErrorBanner, FootNote,
} from "./reportUi";

/* ============================================================= */
/* Vendor Outstanding Overview — a vendor's whole story in a row: */
/* what they billed, what we held back or adjusted, what we owe,  */
/* what has gone and what is still due.                           */
/*                                                                */
/* The period picks invoices by INVOICE DATE and every figure on  */
/* them is as on today, so a row always adds up:                  */
/*   Net Payable = Billing + Misc − TDS − Debit Notes             */
/*   Balance Due = Net Payable − Paid − Written Off               */
/* Opens on All time, so nothing owed is hidden by default.       */
/* ============================================================= */

const minus = (v, tone) => (v ? <span className={tone}>−{money(v)}</span> : <span className="text-slate-300">—</span>);
const plus = (v, tone) => (v ? <span className={tone}>+{money(v)}</span> : <span className="text-slate-300">—</span>);


// Mirrors AGEING_BUCKETS in stock.vendor.ledger.service.js.
const AGEING = [
  { key: "CURRENT", label: "Not due" },
  { key: "D0_30", label: "0-30 days" },
  { key: "D31_60", label: "31-60 days" },
  { key: "D61_90", label: "61-90 days" },
  { key: "D90_PLUS", label: "90+ days" },
];

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/* ── ⋮ menu on a row ───────────────────────────────────────────── */
/*
  Things needed now and then, kept off the row itself. Rendered into
  document.body at the button's position: inside the table it would be cut
  off by the horizontal scroll container.
*/
const RowMenu = ({ items }) => {
  const [pos, setPos] = useState(null);
  const btn = useRef(null);

  useEffect(() => {
    if (!pos) return undefined;
    const close = () => setPos(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [pos]);

  const open = () => {
    const r = anchorRect(btn.current);
    setPos({ top: r.bottom + 4, right: r.vw - r.right });
  };

  return (
    <>
      <button
        ref={btn} type="button" onClick={() => (pos ? setPos(null) : open())} title="More"
        className="rounded-lg border border-slate-200 bg-white p-1 text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-800"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {pos && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onMouseDown={() => setPos(null)} />
          <div
            className="fixed z-[9999] min-w-[160px] rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
            style={{ top: pos.top, right: pos.right }}
          >
            {items.map((it) => (
              <button
                key={it.label} type="button"
                onClick={() => { setPos(null); it.onClick(); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
              >
                {it.icon} {it.label}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </>
  );
};

/* ── Where one vendor stands today ─────────────────────────────── */
/*
  Always as on today, across every invoice — "who do we pay first" is a
  question about now, not about the period the table is showing. Module scope
  so it is not a new component type on every render.
*/
const PaymentStatusPopup = ({ row, onClose, onInvoices }) => {
  const t = row.tillDate || {};
  const by = t.outstandingBy || {};
  const count = t.stageCount || {};
  const ageing = t.ageing || {};
  const last = t.lastPaid;

  return (
    <Modal onClose={onClose} maxWidth="max-w-2xl">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-slate-900">{row.vendorName}</p>
          <p className="text-xs text-slate-500">Payment status · as on today, across every invoice</p>
        </div>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">Total Outstanding</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-amber-900">{money(t.outstanding || 0)}</p>
          {(t.writtenOff || 0) > 0 && (
            <p className="text-[11px] text-slate-500">{money(t.writtenOff)} written off</p>
          )}
        </div>
        <div className={`rounded-xl border p-3 ${t.overdueAmount > 0 ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-white"}`}>
          <p className={`text-[11px] font-bold uppercase tracking-wide ${t.overdueAmount > 0 ? "text-rose-700" : "text-slate-500"}`}>Overdue</p>
          <p className={`mt-1 text-lg font-bold tabular-nums ${t.overdueAmount > 0 ? "text-rose-800" : "text-slate-400"}`}>
            {t.overdueAmount > 0 ? money(t.overdueAmount) : "Nothing overdue"}
          </p>
          {t.overdueCount > 0 && (
            <p className="text-[11px] text-rose-600">{plural(t.overdueCount, "invoice")} past the payment terms</p>
          )}
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Last Paid</p>
          {last ? (
            <>
              <p className="mt-1 text-lg font-bold tabular-nums text-emerald-900">{money(last.amount)}</p>
              <p className="text-[11px] text-emerald-700">
                {fmtDate(last.at)} · {PAYMENT_MODE_LABEL[last.mode] || last.mode || "—"}
                {last.invoiceNumber ? ` · ${last.invoiceNumber}` : ""}
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm font-semibold text-slate-400">Never paid yet</p>
          )}
        </div>
      </div>

      <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wider text-slate-700">Where is the money stuck</p>
      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
        {STAGE_ORDER.map((k) => {
          const m = stageMeta(k);
          return (
            <div key={k} className="flex items-center justify-between px-3 py-2 text-sm" title={m.hint}>
              <span className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${m.chip}`}>{m.label}</span>
                {count[k] > 0 && <span className="text-[11px] text-slate-400">{plural(count[k], "invoice")}</span>}
              </span>
              <span className={`tabular-nums ${by[k] > 0 ? "font-semibold text-slate-900" : "text-slate-300"}`}>
                {by[k] > 0 ? money(by[k]) : "—"}
              </span>
            </div>
          );
        })}
      </div>

      <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wider text-slate-700">How old (overdue by)</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {AGEING.map((b) => {
          const v = ageing[b.key] || 0;
          const late = b.key !== "CURRENT" && v > 0;
          return (
            <div key={b.key} className={`rounded-lg border px-2.5 py-2 ${late ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-white"}`}>
              <p className="text-[11px] font-semibold text-slate-500">{b.label}</p>
              <p className={`text-sm font-bold tabular-nums ${v > 0 ? (late ? "text-rose-700" : "text-slate-900") : "text-slate-300"}`}>
                {v > 0 ? money(v) : "—"}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
        <button
          type="button" onClick={onClose}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          Close
        </button>
        <button
          type="button" onClick={onInvoices}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
        >
          View invoices <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </Modal>
  );
};

const AccountSummaryComp = () => {
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [branchId, setBranchId] = useState("");
  const [period, setPeriod] = useState(allTimePeriod);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [branches, setBranches] = useState([]);
  const [view, setView] = useState({ mode: "list" });
  const [statusRow, setStatusRow] = useState(null);
  const [breakupRow, setBreakupRow] = useState(null);

  // The ledger reads /vendor-ledger, so the menu offers it only to whoever
  // that route would let in.
  const { permissions, isAdmin } = usePermissions();
  const canLedger = useMemo(() => {
    if (isAdmin) return true;
    const mod = (permissions || []).find((m) => m.moduleKey === "vendor-ledger");
    return (mod?.actions || []).map((a) => String(a).toUpperCase()).includes("READ");
  }, [permissions, isAdmin]);
  const COLS = 12;

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
      // Sent as from/to; the endpoint reads them as INVOICE-date bounds.
      if (period.from) params.set("from", period.from);
      if (period.to) params.set("to", period.to);

      const res = await fetch(`${API_BACKEND_URL}/stock/reports/account-summary?${params.toString()}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to load vendor account summary");
      setRows(json.data?.rows || []);
      setTotals(json.data?.totals || {});
      setTotal(json.pagination?.total || 0);
    } catch (e) {
      setError(e.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, branchId, period.from, period.to]);

  useEffect(() => { load(); }, [load]);

  const branchOptions = useMemo(() => branches.map((b) => ({ value: b._id, label: b.name })), [branches]);
  const hasFilters = !!search || !!branchId;

  const periodLabel = useMemo(() => {
    if (period.allTime || (!period.from && !period.to)) return "All time";
    const fmt = (d) =>
      d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "";
    return [fmt(period.from), fmt(period.to)].filter(Boolean).join(" – ");
  }, [period.allTime, period.from, period.to]);

  if (view.mode === "ledger") {
    return (
      <VendorLedgerDetail
        vendorId={view.vendorId}
        vendorName={view.vendorName}
        initialYear={period.allTime ? undefined : period.year}
        onBack={() => setView({ mode: "list" })}
      />
    );
  }

  if (view.mode === "invoices") {
    return (
      <VendorInvoicesView
        mode={MODE.ACCOUNT}
        vendorId={view.vendorId} vendorName={view.vendorName}
        period={period} periodLabel={periodLabel}
        onBack={() => setView({ mode: "list" })}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <ReportHeader
        title="Vendor Outstanding Overview" onRefresh={load}
        subtitle="Billing to balance due, per vendor — everything in one row."
        right={
          <div className="flex flex-wrap gap-2">
            <Tile icon={Users} label="Vendors" value={totals.vendors ?? 0} tone="border-slate-200 bg-white text-slate-700" />
            <Tile icon={Receipt} label="Billing" value={money(totals.billing || 0)} tone="border-blue-200 bg-blue-50 text-blue-700" />
            <Tile icon={PlusCircle} label="Misc" value={money(totals.misc || 0)} tone="border-sky-200 bg-sky-50 text-sky-700" />
            <Tile icon={Percent} label="TDS" value={money(totals.tds || 0)} tone="border-amber-200 bg-amber-50 text-amber-700" />
            <Tile icon={FileMinus} label="Debit Notes" value={money(totals.debitNotes || 0)} tone="border-rose-200 bg-rose-50 text-rose-700" />
            <Tile icon={IndianRupee} label="Net Payable" value={money(totals.netPayable || 0)} tone="border-slate-200 bg-white text-slate-800" />
            <Tile icon={Wallet} label="Paid" value={money(totals.paid || 0)} tone="border-emerald-200 bg-emerald-50 text-emerald-700" />
            {(totals.writtenOff || 0) > 0 && (
              <Tile icon={FileMinus} label="Written Off" value={money(totals.writtenOff)} tone="border-slate-300 bg-slate-100 text-slate-600" />
            )}
            <Tile icon={AlertTriangle} label="Balance Due" value={money(totals.outstanding || 0)} tone="border-amber-300 bg-amber-50 text-amber-800" />
            <Tile icon={AlertTriangle} label="Total Outstanding · till date" value={money(totals.outstandingTillDate || 0)} tone="border-rose-200 bg-rose-50 text-rose-800" />
          </div>
        }
      />

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

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
          {hasFilters && (
            <button
              type="button"
              onClick={() => { setSearch(""); setBranchId(""); setPage(1); }}
              className="inline-flex items-center justify-center gap-1 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2 text-sm font-semibold text-rose-600 shadow-sm transition hover:bg-rose-100"
            >
              <RotateCcw className="h-4 w-4" /> Clear Filter
            </button>
          )}
        </div>
      </div>

      <div className="mb-5">
        <PeriodPicker allowAllTime value={period} onChange={(p) => { setPeriod(p); setPage(1); }} />
      </div>


      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50/60">
            <tr>
              <th className={thSticky}>Vendor</th>
              <th className={thRight}>Invoices</th>
              <th className={thRight}>Billing</th>
              <th className={thRight}>Misc</th>
              <th className={thRight}>TDS</th>
              <th className={thRight}>Debit Notes</th>
              <th className={thRight}>Net Payable</th>
              <th className={thRight}>Paid</th>
              <th className={thRight}>Written Off</th>
              <th className={thRight}>Balance Due</th>
              <th className={thRight}>
                Total Outstanding
                <span className="block text-[10px] font-medium normal-case tracking-normal text-slate-400">till date</span>
              </th>
              <th className={thRight}>Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={COLS} className="px-4 py-12 text-center text-sm text-slate-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={COLS} className="px-4 py-12 text-center text-sm text-slate-400">
                No vendor has an invoice in this period.
              </td></tr>
            ) : (
              rows.map((r) => {
                const gst = (r.cgst || 0) + (r.sgst || 0) + (r.igst || 0);
                return (
                  <tr key={String(r.vendorId)} className="group transition hover:bg-slate-50/60">
                    <td className={tdSticky + " font-semibold text-slate-900"}>{r.vendorName}</td>
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
                    <td className={tdRight}>
                      <BillingCell
                        value={r.billing}
                        onInfo={() => setBreakupRow({
                          title: r.vendorName,
                          b: { basic: r.basic, extra: r.extraCharges, cgst: r.cgst, sgst: r.sgst, igst: r.igst, gst, billing: r.billing },
                        })}
                      />
                    </td>
                    <td className={tdRight}>{plus(r.misc, "text-sky-700")}</td>
                    <td className={tdRight}>{minus(r.tds, "text-amber-700")}</td>
                    <td className={tdRight}>{minus(r.debitNotes, "text-rose-700")}</td>
                    <td className={tdRight + " font-semibold text-slate-900"}>{money(r.netPayable)}</td>
                    <td className={tdRight}>{minus(r.paid, "text-emerald-700")}</td>
                    <td className={tdRight}>{minus(r.writtenOff, "text-slate-500")}</td>
                    <td className={tdRight + " font-bold text-amber-800"}>
                      {r.outstanding ? money(r.outstanding) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className={tdRight + " font-bold text-slate-900"}>
                      {r.tillDate?.outstanding ? money(r.tillDate.outstanding) : <span className="text-slate-300">—</span>}
                      {r.tillDate?.overdueAmount > 0 && (
                        <span className="block text-[10px] font-semibold text-rose-600">{money(r.tillDate.overdueAmount)} overdue</span>
                      )}
                    </td>
                    <td className={tdRight}>
                      <span className="inline-flex items-center gap-1.5">
                        <button
                          type="button" onClick={() => setStatusRow(r)}
                          title="Overdue, approval stage, ageing and last payment"
                          className="inline-flex items-center gap-1 rounded-lg border border-indigo-300 bg-white px-2.5 py-1 text-xs font-semibold text-indigo-600 shadow-sm transition hover:bg-indigo-50"
                        >
                          <Eye className="h-3.5 w-3.5" /> View
                        </button>
                        {canLedger && (
                          <RowMenu
                            items={[
                              {
                                label: "Ledger",
                                icon: <BookOpen className="h-4 w-4 text-slate-400" />,
                                onClick: () => setView({ mode: "ledger", vendorId: r.vendorId, vendorName: r.vendorName }),
                              },
                            ]}
                          />
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="border-t-2 border-slate-200 bg-slate-50">
              <tr>
                <td className={tdSticky + " font-bold text-slate-900"}>TOTAL</td>
                <td className={tdRight + " font-bold"}>{totals.invoiceCount || 0}</td>
                <td className={tdRight}>
                  <BillingCell
                    value={totals.billing || 0}
                    className="font-bold text-blue-700"
                    onInfo={() => setBreakupRow({
                      title: "All vendors",
                      b: {
                        basic: totals.basic, extra: totals.extraCharges, cgst: totals.cgst,
                        sgst: totals.sgst, igst: totals.igst, gst: totals.gst, billing: totals.billing,
                      },
                    })}
                  />
                </td>
                <td className={tdRight + " font-bold text-sky-700"}>{totals.misc ? `+${money(totals.misc)}` : money(0)}</td>
                <td className={tdRight + " font-bold text-amber-700"}>{totals.tds ? `−${money(totals.tds)}` : money(0)}</td>
                <td className={tdRight + " font-bold text-rose-700"}>{totals.debitNotes ? `−${money(totals.debitNotes)}` : money(0)}</td>
                <td className={tdRight + " font-bold text-slate-900"}>{money(totals.netPayable || 0)}</td>
                <td className={tdRight + " font-bold text-emerald-700"}>{totals.paid ? `−${money(totals.paid)}` : money(0)}</td>
                <td className={tdRight + " font-bold text-slate-500"}>{totals.writtenOff ? `−${money(totals.writtenOff)}` : money(0)}</td>
                <td className={tdRight + " font-bold text-amber-800"}>{money(totals.outstanding || 0)}</td>
                <td className={tdRight + " font-bold text-slate-900"}>{money(totals.outstandingTillDate || 0)}</td>
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
        The period picks invoices by their invoice date; every figure on them is as on today. Net Payable is
        Billing + Misc − TDS − Debit Notes. Balance Due is Net Payable − Paid − Written Off — Written Off is
        what was left when an invoice was closed short of its payable, so it is never going to be paid. Click
        the info icon on any invoice count to see the invoices behind the row. Total Outstanding (till date)
        ignores the period — it is everything the vendor is owed today — and View shows where that money
        is: overdue, at which approval stage, how old, and when they were last paid.
      </FootNote>

      {breakupRow && (
        <BillingBreakupPopup
          title={breakupRow.title}
          subtitle={`Billing breakup · ${periodLabel}`}
          b={breakupRow.b}
          onClose={() => setBreakupRow(null)}
        />
      )}

      {statusRow && (
        <PaymentStatusPopup
          row={statusRow}
          onClose={() => setStatusRow(null)}
          onInvoices={() => {
            setStatusRow(null);
            setView({ mode: "invoices", vendorId: statusRow.vendorId, vendorName: statusRow.vendorName });
          }}
        />
      )}
    </div>
  );
};

export default AccountSummaryComp;
