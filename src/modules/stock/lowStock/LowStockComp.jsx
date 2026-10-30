"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import Pagination from "@/shared/ui/pagination/Pagination";
import { PackageX, TriangleAlert, RotateCcw } from "lucide-react";
import { SearchableSelect, inputCls } from "@/modules/stock/shared/StockSharedUI";
import { th, thRight, td, tdRight, fmtDate, ReportHeader, Tile, ErrorBanner, FootNote } from "@/modules/stock/reports/reportUi";

/* ============================================================= */
/* Low Stock — every product at or below its alert threshold in   */
/* a branch the viewer can see. Live: computed on every load, so   */
/* it is right the moment stock moves. The alerts (Alerts &        */
/* Escalations → "Stock low / out in a branch") link here.         */
/* ============================================================= */

const LEVELS = [
  { key: "", label: "All", count: "ALL", on: "bg-slate-800 text-white border-slate-800" },
  { key: "OUT", label: "Out of stock", count: "OUT", dot: "bg-rose-500", on: "bg-rose-600 text-white border-rose-600" },
  { key: "LOW", label: "Low", count: "LOW", dot: "bg-amber-500", on: "bg-amber-500 text-white border-amber-500" },
];

const qty = (n, unit) => `${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 })}${unit === "meter" ? " m" : ""}`;

const LevelChip = ({ level }) =>
  level === "OUT" ? (
    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">Out of stock</span>
  ) : (
    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">Low</span>
  );

const LowStockComp = () => {
  const searchParams = useSearchParams();
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [branchId, setBranchId] = useState(searchParams.get("branchId") || "");
  const [level, setLevel] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BACKEND_URL}/stock/scoped-branches?module=inventory-items`, { credentials: "include" });
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
      const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (debounced.trim()) qs.set("search", debounced.trim());
      if (branchId) qs.set("branchId", branchId);
      if (level) qs.set("level", level);
      const res = await fetch(`${API_BACKEND_URL}/stock/low-stock?${qs.toString()}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to load");
      setRows(json.data?.rows || []);
      setCounts(json.data?.counts || {});
      setTotal(json.pagination?.total || 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debounced, branchId, level]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const branchOptions = useMemo(() => branches.map((b) => ({ value: b._id, label: `${b.name}${b.code ? ` (${b.code})` : ""}` })), [branches]);
  const hasFilters = !!search || !!branchId || !!level;
  const reset = () => { setSearch(""); setBranchId(""); setLevel(""); setPage(1); };
  const COLS = 7;

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <ReportHeader
        title="Low Stock" onRefresh={load}
        subtitle="Products at or below their stock alert threshold, branch by branch — out of stock first."
        right={
          <div className="flex flex-wrap gap-2">
            <Tile icon={PackageX} label="Out of stock" value={counts.OUT ?? 0} tone="border-rose-200 bg-rose-50 text-rose-700" />
            <Tile icon={TriangleAlert} label="Low" value={counts.LOW ?? 0} tone="border-amber-200 bg-amber-50 text-amber-700" />
          </div>
        }
      />

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {LEVELS.map((s) => {
          const on = level === s.key;
          return (
            <button
              key={s.key || "all"} type="button" onClick={() => { setLevel(s.key); setPage(1); }}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-semibold shadow-sm transition ${
                on ? s.on : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {s.dot && !on && <span className={`h-2 w-2 rounded-full ${s.dot}`} />}
              {s.label}
              <span className={`rounded-full px-1.5 text-xs tabular-nums ${on ? "bg-white/25" : "bg-slate-100 text-slate-500"}`}>{counts[s.count] ?? 0}</span>
            </button>
          );
        })}
      </div>

      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search product or branch…" className={inputCls + " lg:col-span-2"}
          />
          {branches.length > 1 && (
            <div className="lg:col-span-2">
              <SearchableSelect value={branchId} onChange={(v) => { setBranchId(v); setPage(1); }} options={branchOptions} placeholder="All my branches" />
            </div>
          )}
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
              <th className={th}>Product</th>
              <th className={th}>Branch</th>
              <th className={thRight}>Available</th>
              <th className={thRight}>Threshold</th>
              <th className={thRight}>Short by</th>
              <th className={th}>Status</th>
              <th className={th}>Low since</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={COLS} className="px-4 py-12 text-center text-sm text-slate-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={COLS} className="px-4 py-12 text-center text-sm text-slate-400">Nothing is low — every product is above its threshold.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={`${r.productDefinitionId}-${r.branchId}`} className="transition hover:bg-slate-50/60">
                  <td className={td}>
                    <span className="block font-semibold text-slate-900">{r.productName}</span>
                    {r.categoryName && <span className="text-[11px] text-slate-400">{r.categoryName}</span>}
                  </td>
                  <td className={td}>{r.branchName}</td>
                  <td className={tdRight + ` font-bold ${r.level === "OUT" ? "text-rose-700" : "text-amber-700"}`}>{qty(r.available, r.unit)}</td>
                  <td className={tdRight}>{qty(r.threshold, r.unit)}</td>
                  <td className={tdRight + " text-slate-500"}>{qty(r.shortBy, r.unit)}</td>
                  <td className={td}><LevelChip level={r.level} /></td>
                  <td className={td + " whitespace-nowrap text-xs"}>{r.since ? fmtDate(r.since) : <span className="text-slate-400">just now</span>}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <Pagination
          currentPage={page} totalItems={total} itemsPerPage={limit} onPageChange={setPage}
          onItemsPerPageChange={(n) => { setLimit(n); setPage(1); }}
        />
      </div>

      <FootNote>
        Available counts approved units on the shelf (status Available) — issued, in transit, faulty or in repair stock is
        not counted. Low = at or below the threshold set in Product Definition for that branch; a threshold of 0 switches
        the alert off. Short by is how many it takes to get back to the threshold.
      </FootNote>
    </div>
  );
};

export default LowStockComp;
