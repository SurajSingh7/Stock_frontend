"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Pagination from "@/shared/ui/pagination/Pagination";
import { Eye } from "lucide-react";
import { SearchableSelect, inputCls } from "@/modules/stock/shared/StockSharedUI";
import ViewTransferRequestModal from "./ViewTransferRequestModal";
import {
  STATUS_TAB_STYLES, th, thRight,
  StatusBadge, LocationPair, ItemsCell, fmtDateTime, fetchActiveLocations, fetchTransferBoard,
} from "./shared";

/*
  "Transfer History" — the closed-out record of every request: completed
  (full or partial) or rejected. Read-only — no actions here, just full
  traceability of what happened.
*/
const TransferHistoryComp = () => {
  const [locations, setLocations] = useState([]);
  const [locationId, setLocationId] = useState("");

  const [status, setStatus] = useState("COMPLETED");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({ ALL: 0, PENDING: 0, COMPLETED: 0, REJECTED: 0 });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewingId, setViewingId] = useState(null);

  useEffect(() => {
    fetchActiveLocations().then(setLocations).catch(() => setLocations([]));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchTransferBoard({ locationId, status, search: debouncedSearch, page, limit });
      setRows(result.rows);
      setCounts(result.counts);
      setTotal(result.total);
    } catch (err) {
      setError(err.message);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [locationId, status, debouncedSearch, page, limit]);

  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => { setPage(1); }, [locationId, status, debouncedSearch]);

  const locationOptions = useMemo(() => locations.map((l) => ({ value: l._id, label: `${l.name} (${l.code})` })), [locations]);

  // Closed statuses only — PENDING has its own home on the other two pages.
  // No combined "all" tab: with just these two closed statuses left, an
  // unfiltered board fetch would also pull in PENDING rows, which don't
  // belong on a history page.
  const statusTabs = [
    { key: "COMPLETED", label: "Completed", count: counts.COMPLETED },
    { key: "REJECTED", label: "Rejected", count: counts.REJECTED },
  ];

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Transfer History</h1>
        <p className="mt-0.5 text-sm text-slate-500">Complete record of every transfer request from creation to close.</p>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="font-bold">&times;</button>
        </div>
      )}

      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Location</label>
            <SearchableSelect value={locationId} onChange={setLocationId} options={locationOptions} placeholder="All locations" />
          </div>
          <div className="lg:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Search</label>
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search request number or product…" className={inputCls}
            />
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {statusTabs.map((t) => {
          const st = STATUS_TAB_STYLES[t.key || "ALL"];
          const active = status === t.key;
          return (
            <button
              key={t.key || "all-status"} type="button" onClick={() => setStatus(t.key)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold shadow-sm transition ${active ? st.active : st.inactive}`}
            >
              {t.label}
              <span className={`rounded-full px-1.5 text-xs tabular-nums ${active ? "bg-white/20" : "bg-black/5"}`}>{t.count ?? 0}</span>
            </button>
          );
        })}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50/60">
            <tr>
              <th className={th}>Transfer Ref</th>
              <th className={th}>Source → Destination</th>
              <th className={th}>Products</th>
              <th className={thRight}>Transferred Qty</th>
              <th className={th}>Transfer Date/Time</th>
              <th className={th}>Completed By</th>
              <th className={th}>Status</th>
              <th className={thRight}>Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                <p className="mt-2 text-sm text-slate-500">Loading…</p>
              </td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-16 text-center">
                <p className="text-sm font-medium text-slate-700">No history found</p>
                <p className="mt-1 text-sm text-slate-400">Closed transfer requests will show up here.</p>
              </td></tr>
            ) : (
              rows.map((row) => (
                <tr key={row._id} className="transition hover:bg-slate-50/60">
                  <td className="px-4 py-3 text-sm font-semibold text-indigo-600">{row.requestNumber}</td>
                  <td className="px-4 py-3"><LocationPair from={row.sourceLocationId} to={row.requestingLocationId} /></td>
                  <td className="px-4 py-3"><ItemsCell row={row} /></td>
                  <td className="px-4 py-3 text-right text-sm tabular-nums text-slate-700">
                    {row.totalTransferredQty} <span className="text-slate-400">/ {row.totalRequestedQty}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">{fmtDateTime(row.processedAt)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{row.processedByName || "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button" onClick={() => setViewingId(row._id)} title="View details"
                      className="rounded-md border border-indigo-200 bg-white p-1.5 text-indigo-600 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-5">
        <Pagination
          currentPage={page} totalItems={total} itemsPerPage={limit} onPageChange={setPage}
          onItemsPerPageChange={(n) => { setLimit(n); setPage(1); }}
        />
      </div>

      {viewingId && <ViewTransferRequestModal requestId={viewingId} onClose={() => setViewingId(null)} />}
    </div>
  );
};

export default TransferHistoryComp;
