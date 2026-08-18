"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Pagination from "@/shared/ui/pagination/Pagination";
import { CheckCircle2, XCircle, Eye } from "lucide-react";
import { SearchableSelect, inputCls } from "@/modules/stock/shared/StockSharedUI";
import ProcessTransferRequestModal from "./ProcessTransferRequestModal";
import ReasonModal from "./ReasonModal";
import ViewTransferRequestModal from "./ViewTransferRequestModal";
import {
  STATUS_TAB_STYLES, th, thRight,
  StatusBadge, LocationPair, ItemsCell, fmtDateTime, fetchActiveLocations, fetchTransferBoard,
} from "./shared";

/*
  "Incoming Requests" — everything OTHER locations have asked from THIS one
  (role=source on the API). Approve (full/partial) or reject with a reason.
*/
const IncomingRequestsComp = () => {
  const [locations, setLocations] = useState([]);
  // Plain in-memory state, no persistence — "viewing as location" is a
  // temporary filter for this page session, not a saved preference. Always
  // starts at "" (All Locations) and resets on every page load/refresh.
  const [viewLocationId, setViewLocationId] = useState("");

  const [status, setStatus] = useState("PENDING");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({ ALL: 0, PENDING: 0, COMPLETED: 0, REJECTED: 0 });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [processingRow, setProcessingRow] = useState(null);
  const [rejectingRow, setRejectingRow] = useState(null);
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
      const result = await fetchTransferBoard({ locationId: viewLocationId, role: "source", status, search: debouncedSearch, page, limit });
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
  }, [viewLocationId, status, debouncedSearch, page, limit]);

  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => { setPage(1); }, [viewLocationId, status, debouncedSearch]);

  const locationOptions = useMemo(() => locations.map((l) => ({ value: l._id, label: `${l.name} (${l.code})` })), [locations]);

  const statusTabs = [
    { key: "PENDING", label: "Pending", count: counts.PENDING },
    { key: "COMPLETED", label: "Completed", count: counts.COMPLETED },
    { key: "REJECTED", label: "Rejected", count: counts.REJECTED },
    { key: "", label: "All", count: counts.ALL },
  ];

  const afterAction = () => { setProcessingRow(null); setRejectingRow(null); loadList(); };

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Incoming Requests</h1>
        <p className="mt-0.5 text-sm text-slate-500">Stock requests other branches or warehouses have raised against your location.</p>
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
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Source location (you)</label>
            <SearchableSelect value={viewLocationId} onChange={setViewLocationId} options={locationOptions} placeholder="All locations" />
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
              <th className={th}>Request #</th>
              <th className={th}>Requester</th>
              <th className={th}>Source → Destination</th>
              <th className={th}>Products / Qty</th>
              <th className={th}>Request Date</th>
              <th className={th}>Status</th>
              <th className={thRight}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                <p className="mt-2 text-sm text-slate-500">Loading…</p>
              </td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-16 text-center">
                <p className="text-sm font-medium text-slate-700">No incoming requests found</p>
                <p className="mt-1 text-sm text-slate-400">Requests other locations raise against you will show up here.</p>
              </td></tr>
            ) : (
              rows.map((row) => (
                <tr key={row._id} className="transition hover:bg-slate-50/60">
                  <td className="px-4 py-3 text-sm font-semibold text-indigo-600">{row.requestNumber}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{row.requestedByName || "—"}</td>
                  <td className="px-4 py-3"><LocationPair from={row.sourceLocationId} to={row.requestingLocationId} /></td>
                  <td className="px-4 py-3"><ItemsCell row={row} /></td>
                  <td className="px-4 py-3 text-sm text-slate-500">{fmtDateTime(row.requestedAt)}</td>
                  <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {row.status === "PENDING" ? (
                        <>
                          <button
                            type="button" onClick={() => setProcessingRow(row)} title="Approve"
                            className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-500"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                          </button>
                          <button
                            type="button" onClick={() => setRejectingRow(row)} title="Reject"
                            className="rounded-md border border-rose-200 bg-white p-1.5 text-rose-600 shadow-sm transition hover:border-rose-300 hover:bg-rose-50"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : null}
                      <button
                        type="button" onClick={() => setViewingId(row._id)} title="View details"
                        className="rounded-md border border-indigo-200 bg-white p-1.5 text-indigo-600 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </div>
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

      {processingRow && (
        <ProcessTransferRequestModal
          requestId={processingRow._id}
          onClose={() => setProcessingRow(null)}
          onDone={afterAction}
        />
      )}

      {rejectingRow && (
        <ReasonModal
          title={`Reject ${rejectingRow.requestNumber}`}
          description="This will decline the entire request. Nothing will be transferred."
          confirmLabel="Reject request"
          path={`transfer-requests/${rejectingRow._id}/reject`}
          onClose={() => setRejectingRow(null)}
          onDone={afterAction}
        />
      )}

      {viewingId && <ViewTransferRequestModal requestId={viewingId} onClose={() => setViewingId(null)} />}
    </div>
  );
};

export default IncomingRequestsComp;
