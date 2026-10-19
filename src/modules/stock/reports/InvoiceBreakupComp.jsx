"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import Pagination from "@/shared/ui/pagination/Pagination";
import { RotateCcw, Receipt, Calculator, AlertTriangle, Wallet, PlusCircle, Percent, FileMinus } from "lucide-react";
import { SearchableSelect, inputCls, money } from "@/modules/stock/shared/StockSharedUI";
import { paymentTermShort } from "@/modules/stock/shared/paymentTerms";
import { PAYMENT_MODE_LABEL, paymentStateMeta, PAYMENT_STATE } from "@/modules/stock/shared/paymentStatus";
import { stageMeta } from "@/modules/stock/shared/ledgerStages";
import PeriodPicker, { defaultPeriod } from "@/modules/stock/vendorLedger/PeriodPicker";
import InvoiceCalculationView from "./InvoiceCalculationView";
import {
  th, thRight, td, tdRight, fmtDate, ReportHeader, Tile, ErrorBanner, FootNote,
} from "./reportUi";

/* ============================================================= */
/* Invoice Breakup — how each amount was arrived at.               */
/*                                                                */
/* The other three reports are aggregates: per vendor, per period. */
/* This one is per invoice, per LINE, which is why it is named     */
/* after the invoice rather than after billing.                    */
/*                                                                */
/* Columns alone cannot answer "how was this number reached" — a   */
/* reader has to follow the arithmetic in the order it ran. That    */
/* working lives on its own full page (InvoiceCalculationView),     */
/* reached from the Calculation button on each card, because it is  */
/* read carefully and often beside a vendor's own statement.        */
/* ============================================================= */

const STATE_OPTIONS = [
  { value: "", label: "Any payment status" },
  { value: PAYMENT_STATE.UNPAID, label: "Unpaid" },
  { value: PAYMENT_STATE.PARTIAL, label: "Partial Paid" },
  { value: PAYMENT_STATE.PAID, label: "Paid" },
];

const TAX_OPTIONS = [
  { value: "", label: "Any tax type" },
  { value: "CGST_SGST", label: "CGST + SGST (same state)" },
  { value: "IGST", label: "IGST (inter-state)" },
];

const InvoiceBreakupComp = () => {
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  /*
    The calculation replaces the list rather than opening over it, the same
    way DebitNoteView and RecordPaymentView do. The row travels with the
    view, so opening a working costs no second request.
  */
  const [view, setView] = useState({ mode: "list" });

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [paymentState, setPaymentState] = useState("");
  const [taxType, setTaxType] = useState("");
  const [period, setPeriod] = useState(defaultPeriod);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

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
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (vendorId) params.set("vendorId", vendorId);
      if (branchId) params.set("branchId", branchId);
      if (paymentState) params.set("paymentState", paymentState);
      if (taxType) params.set("state", taxType);
      if (period.from) params.set("from", period.from);
      if (period.to) params.set("to", period.to);

      const res = await fetch(`${API_BACKEND_URL}/stock/reports/invoice-breakup?${params.toString()}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to load invoice breakup");
      setRows(json.data?.rows || []);
      setTotals(json.data?.totals || {});
      setTotal(json.pagination?.total || 0);
    } catch (e) {
      setError(e.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, vendorId, branchId, paymentState, taxType, period.from, period.to]);

  useEffect(() => { load(); }, [load]);

  const vendorOptions = useMemo(() => vendors.map((v) => ({ value: v._id, label: v.name })), [vendors]);
  const branchOptions = useMemo(() => branches.map((b) => ({ value: b._id, label: b.name })), [branches]);
  const hasFilters = !!search || !!vendorId || !!branchId || !!paymentState || !!taxType;

  if (view.mode === "calculation") {
    return (
      <InvoiceCalculationView row={view.row} onBack={() => setView({ mode: "list" })} />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <ReportHeader
        title="Invoice Breakup" onRefresh={load}
        subtitle="How each invoice was worked out — line by line, from unit price to balance due."
        right={
          <div className="flex flex-wrap gap-2">
            <Tile icon={Receipt} label="Invoices" value={totals.invoiceCount ?? 0} tone="border-slate-200 bg-white text-slate-700" />
            <Tile icon={Receipt} label="Billing" value={money(totals.billing || 0)} tone="border-blue-200 bg-blue-50 text-blue-700" />
            <Tile icon={PlusCircle} label="Misc" value={money(totals.misc || 0)} tone="border-sky-200 bg-sky-50 text-sky-700" />
            <Tile icon={Percent} label="TDS" value={money(totals.tds || 0)} tone="border-amber-200 bg-amber-50 text-amber-700" />
            <Tile icon={FileMinus} label="Debit Notes" value={money(totals.debitNotes || 0)} tone="border-rose-200 bg-rose-50 text-rose-700" />
            <Tile icon={Calculator} label="Net Payable" value={money(totals.payable || 0)} tone="border-slate-200 bg-white text-slate-700" />
            <Tile icon={Wallet} label="Paid" value={money(totals.paid || 0)} tone="border-emerald-200 bg-emerald-50 text-emerald-700" />
            {(totals.writtenOff || 0) > 0 && (
              <Tile icon={FileMinus} label="Written Off" value={money(totals.writtenOff)} tone="border-slate-300 bg-slate-100 text-slate-600" />
            )}
            <Tile icon={AlertTriangle} label="Balance Due" value={money(totals.outstanding || 0)} tone="border-amber-300 bg-amber-50 text-amber-800" />
          </div>
        }
      />

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice, PO, vendor or product name..." className={inputCls}
          />
          <SearchableSelect
            value={vendorId} onChange={(v) => { setVendorId(v); setPage(1); }}
            options={vendorOptions} placeholder="All vendors"
          />
          <SearchableSelect
            value={branchId} onChange={(v) => { setBranchId(v); setPage(1); }}
            options={branchOptions} placeholder="All branches"
          />
          <select
            value={paymentState} onChange={(e) => { setPaymentState(e.target.value); setPage(1); }}
            className={inputCls} aria-label="Payment status"
          >
            {STATE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select
            value={taxType} onChange={(e) => { setTaxType(e.target.value); setPage(1); }}
            className={inputCls} aria-label="Tax type"
          >
            {TAX_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setSearch(""); setVendorId(""); setBranchId("");
                setPaymentState(""); setTaxType(""); setPage(1);
              }}
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

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-16 text-center text-sm text-slate-400">
          No invoice matches these filters.
        </p>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => {
            const pm = paymentStateMeta(r.paymentState);
            const sm = stageMeta(r.stage);
            const isIgst = r.taxType === "IGST";
            return (
              <div key={String(r.invoiceId)} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                {/* Card head — identity. Invoice number, PO and date together,
                    because nothing makes the number unique on its own. */}
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-3">
                  <div>
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                      {r.invoiceNumber}
                      <span className="text-slate-300">·</span>
                      <span className="font-normal text-slate-500">{r.poNumber || "—"}</span>
                      <span className="text-slate-300">·</span>
                      <span className="font-normal text-slate-700">{r.vendorName}</span>
                    </p>
                    <p className="mt-0.5 flex flex-wrap gap-x-4 text-xs text-slate-500">
                      <span>Invoice {fmtDate(r.invoiceDate)}</span>
                      <span>Due {fmtDate(r.dueDate)}{r.paymentTerms ? ` · ${paymentTermShort(r.paymentTerms)}` : ""}</span>
                      <span className={isIgst ? "font-semibold text-violet-600" : "text-slate-500"}>
                        {isIgst ? "IGST · inter-state" : "CGST + SGST · same state"}
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${pm.chip}`}>
                      {pm.label}
                    </span>
                    {r.outstanding > 0 && (
                      <span
                        title={sm.hint}
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${sm.chip}`}
                      >
                        {sm.label}
                      </span>
                    )}
                    {/* Opens the full working on its own page. Named for what
                        it shows rather than for the click ("View"), because
                        every other icon on this card is also a view. */}
                    <button
                      type="button" onClick={() => setView({ mode: "calculation", row: r })}
                      className="inline-flex items-center gap-1 rounded-lg border border-indigo-300 bg-white px-2.5 py-1 text-xs font-semibold text-indigo-600 shadow-sm transition hover:bg-indigo-50"
                      title="Open the full working for this invoice"
                    >
                      <Calculator className="h-3.5 w-3.5" /> Calculation
                    </button>
                  </div>
                </div>

                {r.rejectedReason && (
                  <p className="border-b border-rose-100 bg-rose-50/60 px-5 py-2 text-xs text-rose-700">
                    Payment approval sent back: {r.rejectedReason}
                  </p>
                )}

                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-white">
                      <tr>
                        <th className={th}>Category</th>
                        <th className={th}>Product</th>
                        <th className={thRight}>Qty</th>
                        <th className={thRight}>FOC</th>
                        <th className={thRight}>Unit Price</th>
                        <th className={thRight}>Basic</th>
                        <th className={thRight}>GST %</th>
                        <th className={thRight}>GST</th>
                        <th className={thRight}>Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {r.lines.length === 0 ? (
                        <tr><td colSpan={9} className="px-4 py-6 text-center text-sm text-slate-400">
                          This invoice has no lines.
                        </td></tr>
                      ) : (
                        r.lines.map((l, i) => (
                          <tr key={i}>
                            <td className={td + " text-xs text-slate-500"}>{l.categoryName || "—"}</td>
                            <td className={td + " font-medium text-slate-900"}>{l.productName || "—"}</td>
                            <td className={tdRight}>{l.quantity}</td>
                            {/* FOC units arrive but are never priced. "40 came,
                                why is 36 billed" is answered here and nowhere
                                else in the system. */}
                            <td className={tdRight}>
                              {l.focQuantity
                                ? <span className="font-semibold text-amber-600">{l.focQuantity}</span>
                                : <span className="text-slate-300">—</span>}
                            </td>
                            <td className={tdRight}>{money(l.unitPrice)}</td>
                            <td className={tdRight + " font-medium text-slate-900"}>{money(l.basic)}</td>
                            <td className={tdRight + " text-xs text-slate-500"}>{l.gstRate}%</td>
                            <td className={tdRight + " text-violet-700"}>{money(l.gst)}</td>
                            <td className={tdRight + " font-semibold text-slate-900"}>{money(l.total)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* The one-line summary, always visible. This is for reading
                    the result; the Calculation page is for following it. */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 bg-slate-50/60 px-5 py-2.5 text-xs">
                  <span className="text-slate-500">Basic <strong className="text-slate-900">{money(r.totals.basicAmount)}</strong></span>
                  <span className="text-slate-500">+ GST <strong className="text-violet-700">{money(r.totals.gstAmount)}</strong></span>
                  <span className="text-slate-500">= Billing <strong className="text-blue-700">{money(r.totals.grandTotal)}</strong></span>
                  {r.miscTotal > 0 && (
                    <span className="text-slate-500">+ Misc <strong className="text-sky-700">{money(r.miscTotal)}</strong></span>
                  )}
                  {r.totals.tdsAmount > 0 && (
                    <span className="text-slate-500">− TDS {r.totals.tdsRate}% <strong className="text-amber-700">{money(r.totals.tdsAmount)}</strong></span>
                  )}
                  {r.debitTotal > 0 && (
                    <span className="text-slate-500">− Debit Notes <strong className="text-rose-700">{money(r.debitTotal)}</strong></span>
                  )}
                  <span className="text-slate-500">= Net Payable <strong className="text-slate-900">{money(r.payable)}</strong></span>
                  <span className="text-slate-500">− Paid <strong className="text-emerald-700">{money(r.paidTotal)}</strong></span>
                  {r.writtenOff > 0 && (
                    <span className="text-slate-500">− Written Off <strong className="text-slate-600">{money(r.writtenOff)}</strong></span>
                  )}
                  <span className="ml-auto font-semibold text-slate-500">
                    Balance Due <strong className={r.outstanding > 0 ? "text-amber-700" : "text-slate-900"}>{money(r.outstanding)}</strong>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <Pagination
          currentPage={page} totalItems={total} itemsPerPage={limit} onPageChange={setPage}
          onItemsPerPageChange={(n) => { setLimit(n); setPage(1); }}
        />
      </div>

      <FootNote>
        The period follows the invoice date. Unit price is what the invoice was billed at, snapshotted when
        it was created — it never re-reads the purchase order. GST rate comes off the PO line, and whether
        it splits into CGST + SGST or charges as IGST depends on the vendor&apos;s state against the
        branch&apos;s. FOC units are received but never priced. Net Payable is Billing + Misc − TDS − Debit
        Notes; Balance Due is Net Payable − Paid − Written Off.
      </FootNote>
    </div>
  );
};

export default InvoiceBreakupComp;
