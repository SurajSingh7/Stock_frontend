"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import Pagination from "@/shared/ui/pagination/Pagination";
import { ChevronDown, ChevronRight, PackageX, IndianRupee, Users, RotateCcw } from "lucide-react";
import { SearchableSelect, inputCls, money } from "@/modules/stock/shared/StockSharedUI";
import { th, thRight, td, tdRight, fmtDate, ReportHeader, Tile, ErrorBanner, FootNote } from "@/modules/stock/reports/reportUi";
import { DnChip } from "@/modules/stock/invoiceList/DebitNoteParts";

/* ============================================================= */
/* Faulty Items — every unit a debit note claimed as faulty.      */
/*                                                                */
/* "100 came in, 10 were faulty": per invoice line, how much       */
/* arrived, how much was claimed, which debit note, and (for       */
/* serial-tracked products) exactly which units. A second tab      */
/* rolls it up per vendor to show who sends bad stock.             */
/*                                                                */
/* Debited = the note is approved. Under review = still in review  */
/* or approval (units held). Rejected / withdrawn notes gave their */
/* units back and are not listed.                                  */
/* ============================================================= */

const STATES = [
  { key: "", label: "All", count: "ALL", on: "bg-slate-800 text-white border-slate-800" },
  { key: "DEBITED", label: "Debited", count: "DEBITED", dot: "bg-emerald-500", on: "bg-emerald-600 text-white border-emerald-600" },
  { key: "UNDER_REVIEW", label: "Under review", count: "UNDER_REVIEW", dot: "bg-amber-500", on: "bg-amber-500 text-white border-amber-500" },
];

const pctTone = (p) => (p == null ? "text-slate-400" : p >= 10 ? "text-rose-600" : p >= 5 ? "text-amber-600" : "text-slate-700");

/* The units behind one line, loaded when the row is opened. */
const UnitsRow = ({ row, colSpan }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BACKEND_URL}/stock/faulty-items/${row.debitNoteId}/lines/${row.lineIndex}/units`, { credentials: "include" });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message || "Failed to load units");
        setData(json.data);
      } catch (e) {
        setError(e.message);
      }
    })();
  }, [row.debitNoteId, row.lineIndex]);

  return (
    <tr className="bg-slate-50/70">
      <td colSpan={colSpan} className="px-10 py-3">
        {error ? (
          <p className="text-sm text-rose-600">{error}</p>
        ) : !data ? (
          <p className="text-xs text-slate-400">Loading units…</p>
        ) : data.units.length === 0 ? (
          <p className="text-sm text-slate-600">
            {row.faulty} {data.unit || "units"} faulty — this product is tracked by quantity, so there are no serial numbers.
            {row.reason ? <span className="text-slate-400"> · Reason: {row.reason}</span> : null}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[420px] text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="py-1 pr-6">#</th>
                  {data.fields.map((f) => <th key={f.code} className="py-1 pr-6">{f.label}</th>)}
                  <th className="py-1 pr-6">Stock status</th>
                </tr>
              </thead>
              <tbody>
                {data.units.map((u, i) => (
                  <tr key={u._id} className="border-t border-slate-200/70">
                    <td className="py-1.5 pr-6 tabular-nums text-slate-400">{i + 1}</td>
                    {data.fields.map((f) => <td key={f.code} className="py-1.5 pr-6 font-mono text-xs text-slate-800">{u.fieldValues?.[f.code] ?? "—"}</td>)}
                    <td className="py-1.5 pr-6 text-xs text-slate-500">{String(u.status || "").toLowerCase().replace(/_/g, " ")}{u.isFoc ? " · FOC" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {row.reason && <p className="mt-2 text-xs text-slate-500">Reason: {row.reason}</p>}
          </div>
        )}
      </td>
    </tr>
  );
};

const FaultyItemsComp = () => {
  const [view, setView] = useState("items"); // items | vendors
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [totals, setTotals] = useState({});
  const [total, setTotal] = useState(0);
  const [vendorRows, setVendorRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [state, setState] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [open, setOpen] = useState({});
  const [vendors, setVendors] = useState([]);

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BACKEND_URL}/stock/vendors?limit=500`, { credentials: "include" });
        const j = await r.json();
        if (j.success) setVendors(j.data || []);
      } catch {
        // Non-fatal — the vendor filter just stays empty.
      }
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError(null); setOpen({});
    try {
      if (view === "vendors") {
        const qs = new URLSearchParams();
        if (state) qs.set("state", state);
        const res = await fetch(`${API_BACKEND_URL}/stock/faulty-items/by-vendor?${qs.toString()}`, { credentials: "include" });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message || "Failed to load");
        setVendorRows(json.data || []);
      } else {
        const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
        if (debounced.trim()) qs.set("search", debounced.trim());
        if (vendorId) qs.set("vendorId", vendorId);
        if (state) qs.set("state", state);
        if (from) qs.set("from", from);
        if (to) qs.set("to", to);
        const res = await fetch(`${API_BACKEND_URL}/stock/faulty-items?${qs.toString()}`, { credentials: "include" });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message || "Failed to load");
        setRows(json.data?.rows || []);
        setCounts(json.data?.counts || {});
        setTotals(json.data?.totals || {});
        setTotal(json.pagination?.total || 0);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [view, page, limit, debounced, vendorId, state, from, to]);

  useEffect(() => { load(); }, [load]);

  const vendorOptions = useMemo(() => vendors.map((v) => ({ value: v._id, label: v.name })), [vendors]);
  const hasFilters = !!search || !!vendorId || !!state || !!from || !!to;
  const reset = () => { setSearch(""); setVendorId(""); setState(""); setFrom(""); setTo(""); setPage(1); };
  const COLS = 10;

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <ReportHeader
        title="Faulty Items" onRefresh={load}
        subtitle="Everything a debit note claimed as faulty — how much came in, how much was bad, and which units."
        right={
          <div className="flex flex-wrap gap-2">
            <Tile icon={PackageX} label="Faulty" value={totals.faulty ?? 0} tone="border-rose-200 bg-rose-50 text-rose-700" />
            <Tile icon={IndianRupee} label="Debited value" value={money(totals.amount || 0)} tone="border-slate-200 bg-white text-slate-700" />
          </div>
        }
      />

      <div className="mb-4 flex gap-1 border-b border-slate-200">
        {[
          { key: "items", label: "Items" },
          { key: "vendors", label: "By Vendor" },
        ].map((t) => (
          <button
            key={t.key} type="button" onClick={() => { setView(t.key); setPage(1); }}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              view === t.key ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STATES.map((s) => {
          const on = state === s.key;
          return (
            <button
              key={s.key || "all"} type="button" onClick={() => { setState(s.key); setPage(1); }}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-semibold shadow-sm transition ${
                on ? s.on : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {s.dot && !on && <span className={`h-2 w-2 rounded-full ${s.dot}`} />}
              {s.label}
              {view === "items" && (
                <span className={`rounded-full px-1.5 text-xs tabular-nums ${on ? "bg-white/25" : "bg-slate-100 text-slate-500"}`}>{counts[s.count] ?? 0}</span>
              )}
            </button>
          );
        })}
      </div>

      {view === "items" ? (
        <>
          <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-6">
              <input
                type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search invoice, PO, vendor, product, DN…" className={inputCls + " lg:col-span-2"}
              />
              <div className="lg:col-span-1">
                <SearchableSelect value={vendorId} onChange={(v) => { setVendorId(v); setPage(1); }} options={vendorOptions} placeholder="All vendors" />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-500">
                From <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className={inputCls} />
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-500">
                To <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className={inputCls} />
              </label>
              <button
                type="button" onClick={reset} disabled={!hasFilters}
                className={`inline-flex items-center justify-center gap-1 rounded-lg border px-4 py-2 text-sm font-semibold shadow-sm transition ${
                  hasFilters ? "border-rose-300 bg-rose-50 text-rose-600 hover:bg-rose-100" : "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                }`}
              >
                <RotateCcw className="h-4 w-4" /> Reset
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50/60">
                <tr>
                  <th className={th}>Invoice</th>
                  <th className={th}>Vendor</th>
                  <th className={th}>Product</th>
                  <th className={thRight}>Received</th>
                  <th className={thRight}>Faulty</th>
                  <th className={thRight}>%</th>
                  <th className={th}>Debit Note</th>
                  <th className={thRight}>Amount</th>
                  <th className={th}>Date</th>
                  <th className={th}>&nbsp;</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={COLS} className="px-4 py-12 text-center text-sm text-slate-400">Loading…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={COLS} className="px-4 py-12 text-center text-sm text-slate-400">No faulty items here.</td></tr>
                ) : (
                  rows.flatMap((r) => {
                    const isOpen = !!open[r.key];
                    const main = (
                      <tr key={r.key} className="transition hover:bg-slate-50/60">
                        <td className={td}>
                          <span className="block font-semibold text-slate-900">{r.invoiceNumber}</span>
                          <span className="text-[11px] text-slate-400">{r.poNumber || "—"} · {fmtDate(r.invoiceDate)}</span>
                        </td>
                        <td className={td}>{r.vendorName || "—"}</td>
                        <td className={td}>
                          <span className="block text-slate-900">{r.productName}</span>
                          <span className="text-[11px] text-slate-400">{r.categoryName}</span>
                        </td>
                        <td className={tdRight}>{r.received}</td>
                        <td className={tdRight + " font-bold text-rose-700"}>{r.faulty}</td>
                        <td className={tdRight + " font-semibold " + pctTone(r.percent)}>{r.percent == null ? "—" : `${r.percent}%`}</td>
                        <td className={td}>
                          <span className="inline-flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-slate-700">DN-{r.dnNumber}</span>
                            <DnChip status={r.dnStatus} />
                          </span>
                        </td>
                        <td className={tdRight + " text-rose-700"}>−{money(r.amount)}</td>
                        <td className={td + " whitespace-nowrap text-xs"}>
                          <span className="block">{fmtDate(r.date)}</span>
                          <span className="text-[11px] text-slate-400">{r.raisedByName}</span>
                        </td>
                        <td className={td}>
                          <button
                            type="button" onClick={() => setOpen((p) => ({ ...p, [r.key]: !p[r.key] }))}
                            title={r.unitCount ? `Show the ${r.unitCount} faulty units` : "Show details"}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
                          >
                            {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            {r.unitCount ? `${r.unitCount} units` : "Details"}
                          </button>
                        </td>
                      </tr>
                    );
                    return isOpen ? [main, <UnitsRow key={`${r.key}-units`} row={r} colSpan={COLS} />] : [main];
                  })
                )}
              </tbody>
            </table>
            <Pagination
              currentPage={page} totalItems={total} itemsPerPage={limit} onPageChange={setPage}
              onItemsPerPageChange={(n) => { setLimit(n); setPage(1); }}
            />
          </div>
        </>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50/60">
              <tr>
                <th className={th}>Vendor</th>
                <th className={thRight}>Received</th>
                <th className={thRight}>Faulty</th>
                <th className={thRight}>Faulty %</th>
                <th className={thRight}>Invoices</th>
                <th className={thRight}>Debit Notes</th>
                <th className={thRight}>Debited value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">Loading…</td></tr>
              ) : vendorRows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">No vendor has faulty items.</td></tr>
              ) : (
                vendorRows.map((v) => (
                  <tr key={String(v.vendorId)} className="transition hover:bg-slate-50/60">
                    <td className={td + " font-semibold text-slate-900"}>
                      <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-slate-400" />{v.vendorName}</span>
                    </td>
                    <td className={tdRight}>{v.received}</td>
                    <td className={tdRight + " font-bold text-rose-700"}>{v.faulty}</td>
                    <td className={tdRight + " font-bold " + pctTone(v.percent)}>{v.percent == null ? "—" : `${v.percent}%`}</td>
                    <td className={tdRight}>{v.invoiceCount}</td>
                    <td className={tdRight}>{v.debitNoteCount}</td>
                    <td className={tdRight + " text-rose-700"}>−{money(v.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <FootNote>
        Debited = the debit note is approved; Under review = it is still in review or approval and its units are held.
        Debit notes rejected in approval or withdrawn gave their units back, so they are not listed. Received counts
        what came in on that invoice line (FOC included); % is faulty out of received — red at 10% and above.
      </FootNote>
    </div>
  );
};

export default FaultyItemsComp;
