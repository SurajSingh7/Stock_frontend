"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Pagination from "@/shared/ui/pagination/Pagination";
import { Plus, Eye } from "lucide-react";
import { SearchableSelect, inputCls } from "@/modules/stock/shared/StockSharedUI";
import CreateTransferRequestModal from "./CreateTransferRequestModal";
import ViewTransferRequestModal from "./ViewTransferRequestModal";
import {
  STATUS_TAB_STYLES, th, thRight,
  StatusBadge, BranchPair, ItemsCell, fetchTransferBranches, fetchTransferBoard,
} from "./shared";

/*
  "Transfer Requests" — everything THIS branch has asked for from other
  branches (role=requesting on the API). Create new requests here, or just
  review past ones. Once created, a request can only be closed by the source
  branch (Full/Partial transfer or Reject) — the requester cannot withdraw it.
*/
const TransferRequestsComp = () => {
  const [branches, setBranches] = useState([]);
  // The branch this user raises requests *for* — read-only in the create form.
  // Kept apart from `branches`, which is every branch and feeds the
  // source/counterparty picker.
  const [defaultBranchId, setDefaultBranchId] = useState("");
  // Plain in-memory state, no persistence — "viewing as branch" is a
  // temporary filter for this page session, not a saved preference. Always
  // starts at "" (All Branches) and resets on every page load/refresh.
  const [viewBranchId, setViewBranchId] = useState("");

  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({ ALL: 0, PENDING: 0, COMPLETED: 0, REJECTED: 0 });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showCreate, setShowCreate] = useState(false);
  const [viewingId, setViewingId] = useState(null);

  useEffect(() => {
    fetchTransferBranches()
      .then(({ branches: locs, defaultBranchId: own }) => {
        setBranches(locs);
        setDefaultBranchId(own);
      })
      .catch(() => setBranches([]));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchTransferBoard({ branchId: viewBranchId, role: "requesting", status, search: debouncedSearch, page, limit });
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
  }, [viewBranchId, status, debouncedSearch, page, limit]);

  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => { setPage(1); }, [viewBranchId, status, debouncedSearch]);

  const branchOptions = useMemo(() => branches.map((l) => ({ value: l._id, label: `${l.name} (${l.code})` })), [branches]);

  const statusTabs = [
    { key: "", label: "All", count: counts.ALL },
    { key: "PENDING", label: "Pending", count: counts.PENDING },
    { key: "COMPLETED", label: "Completed", count: counts.COMPLETED },
    { key: "REJECTED", label: "Rejected", count: counts.REJECTED },
  ];

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Transfer Requests</h1>
          <p className="mt-0.5 text-sm text-slate-500">Requests your branch has raised for stock from other branches or branches.</p>
        </div>
        <button
          type="button" onClick={() => setShowCreate(true)}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
        >
          <Plus className="h-4 w-4" /> New Transfer Request
        </button>
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
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Requesting branch (you)</label>
            <SearchableSelect value={viewBranchId} onChange={setViewBranchId} options={branchOptions} placeholder="All branches" />
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
              <th className={th}>Source → Destination</th>
              <th className={th}>Products / Qty</th>
              <th className={th}>Request Date</th>
              <th className={th}>Status</th>
              <th className={thRight}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                <p className="mt-2 text-sm text-slate-500">Loading…</p>
              </td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-16 text-center">
                <p className="text-sm font-medium text-slate-700">No transfer requests found</p>
                <p className="mt-1 text-sm text-slate-400">Create a new request to pull stock from another branch.</p>
              </td></tr>
            ) : (
              rows.map((row) => (
                <tr key={row._id} className="transition hover:bg-slate-50/60">
                  <td className="px-4 py-3 text-sm font-semibold text-indigo-600">{row.requestNumber}</td>
                  <td className="px-4 py-3"><BranchPair from={row.sourceBranchId} to={row.requestingBranchId} /></td>
                  <td className="px-4 py-3"><ItemsCell row={row} /></td>
                  <td className="px-4 py-3 text-sm text-slate-500">{new Date(row.requestedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
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

      {showCreate && (
        <CreateTransferRequestModal
          branches={branches}
          defaultRequestingBranchId={defaultBranchId}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadList(); }}
        />
      )}

      {viewingId && <ViewTransferRequestModal requestId={viewingId} onClose={() => setViewingId(null)} />}
    </div>
  );
};

export default TransferRequestsComp;
