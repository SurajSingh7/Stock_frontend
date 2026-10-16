"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import Pagination from "@/shared/ui/pagination/Pagination";
import { RotateCcw, Users, Receipt, PlusCircle, Percent, IndianRupee, Info } from "lucide-react";
import { SearchableSelect, inputCls, money } from "@/modules/stock/shared/StockSharedUI";
import PeriodPicker, { defaultPeriod } from "@/modules/stock/vendorLedger/PeriodPicker";
import VendorInvoicesView, { MODE } from "./VendorInvoicesView";
import {
  th, thRight, thSticky, td, tdRight, tdSticky,
  num, ReportHeader, Tile, ErrorBanner, FootNote,
} from "./reportUi";

/* ============================================================= */
/* Billing — what each vendor billed us in the chosen period.     */
/*                                                                */
/* Reads the vendor ledger's own summary through the              */
/* billing-report module, so the figures here and on the ledger   */
/* can never disagree. What makes it a different page is the       */
/* columns: this one opens up the tax split — basic, CGST, SGST,   */
/* IGST — which the ledger rolls into one Billing figure.          */
/*                                                                */
/* Only what is ON the vendor's invoice: basic, extra, the GST     */
/* split and the billed total. TDS, debit notes and misc happen    */
/* after the bill and live on Vendor Outstanding Overview.         */
/* ============================================================= */

const BillingReportComp = () => {
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [branchId, setBranchId] = useState("");
  const [period, setPeriod] = useState(defaultPeriod);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [branches, setBranches] = useState([]);
  // The invoices behind one vendor's row replace the list rather than opening
  // over it, the same way every other drill-down in this app does.
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
      if (period.from) params.set("from", period.from);
      if (period.to) params.set("to", period.to);

      const res = await fetch(`${API_BACKEND_URL}/stock/reports/billing?${params.toString()}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to load billing report");
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

  /*
    Whatever the period picker is currently showing, in words — so the
    drill-down can say which period its figures belong to instead of leaving
    the reader to remember what they had selected.
  */
  const periodLabel = useMemo(() => {
    if (!period.from && !period.to) return "All time";
    const fmt = (d) =>
      d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "";
    return [fmt(period.from), fmt(period.to)].filter(Boolean).join(" – ");
  }, [period.from, period.to]);

  if (view.mode === "invoices") {
    return (
      <VendorInvoicesView
        mode={MODE.BILLING}
        vendorId={view.vendorId} vendorName={view.vendorName}
        period={period} periodLabel={periodLabel}
        onBack={() => setView({ mode: "list" })}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <ReportHeader
        title="Billing" onRefresh={load}
        subtitle="Vendor billing and tax details."
        right={
          <div className="flex flex-wrap gap-2">
            <Tile icon={Users} label="Vendors" value={totals.vendors ?? 0} tone="border-slate-200 bg-white text-slate-700" />
            <Tile icon={Receipt} label="Invoices" value={totals.invoiceCount ?? 0} tone="border-slate-200 bg-white text-slate-700" />
            <Tile icon={IndianRupee} label="Basic" value={money(totals.basic || 0)} tone="border-slate-200 bg-white text-slate-700" />
            <Tile icon={PlusCircle} label="Extra" value={money(totals.extraCharges || 0)} tone="border-slate-200 bg-white text-slate-700" />
            <Tile icon={Percent} label="GST" value={money(totals.gst || 0)} tone="border-violet-200 bg-violet-50 text-violet-700" />
            <Tile icon={Receipt} label="Billing" value={money(totals.billing || 0)} tone="border-blue-200 bg-blue-50 text-blue-700" />
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
        <PeriodPicker value={period} onChange={(p) => { setPeriod(p); setPage(1); }} />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50/60">
            <tr>
              <th className={thSticky}>Vendor</th>
              {/* "Invoices", matching the tile above it — one thing with two
                  names on one screen is how a reader starts doubting both. */}
              <th className={thRight}>Invoices</th>
              <th className={thRight}>Basic</th>
              {/* Billing is (Basic + Extra) + GST. Without this column any
                  invoice carrying freight leaves an unexplained gap and the
                  row simply does not add up. */}
              <th className={thRight}>+Extra</th>
              <th className={thRight}>CGST</th>
              <th className={thRight}>SGST</th>
              <th className={thRight}>IGST</th>
              <th className={thRight}>GST</th>
              <th className={thRight}>Billing</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-400">
                No vendor billed anything in this period.
              </td></tr>
            ) : (
              rows.map((r) => {
                const gst = (r.cgst || 0) + (r.sgst || 0) + (r.igst || 0);
                return (
                  <tr key={String(r.vendorId)} className="group transition hover:bg-slate-50/60">
                    {/* Sticky, because the money columns scroll sideways and a
                        number whose vendor has scrolled off is not worth
                        reading. */}
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
                    <td className={tdRight}>{num(r.basic)}</td>
                    <td className={tdRight}>{num(r.extraCharges, "text-slate-600")}</td>
                    {/* CGST/SGST blank on an inter-state vendor, IGST blank on an
                        intra-state one. Both columns stay on screen so the
                        difference is visible rather than inferred. */}
                    <td className={tdRight}>{num(r.cgst)}</td>
                    <td className={tdRight}>{num(r.sgst)}</td>
                    <td className={tdRight}>{num(r.igst)}</td>
                    <td className={tdRight}>{num(gst, "text-violet-700")}</td>
                    <td className={tdRight}>{num(r.billing, "font-bold text-blue-700")}</td>
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
                <td className={tdRight + " font-semibold"}>{money(totals.basic || 0)}</td>
                <td className={tdRight + " font-semibold"}>{money(totals.extraCharges || 0)}</td>
                <td className={tdRight + " font-semibold"}>{money(totals.cgst || 0)}</td>
                <td className={tdRight + " font-semibold"}>{money(totals.sgst || 0)}</td>
                <td className={tdRight + " font-semibold"}>{money(totals.igst || 0)}</td>
                <td className={tdRight + " font-bold text-violet-700"}>{money(totals.gst || 0)}</td>
                <td className={tdRight + " font-bold text-blue-700"}>{money(totals.billing || 0)}</td>
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
        Every column here follows the period above. Billing is (Basic + Extra) + GST, as the vendor billed
        it — Extra is freight, handling and anything else outside the item lines, which is why it is not
        taxed with them. Click the info icon on any invoice count to see the invoices behind it. TDS, debit
        notes, misc charges and what is still due come after the bill — see Vendor Outstanding Overview.
      </FootNote>
    </div>
  );
};

export default BillingReportComp;
