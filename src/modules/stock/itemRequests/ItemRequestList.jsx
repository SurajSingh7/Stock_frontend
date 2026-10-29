"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Inbox, RotateCcw } from "lucide-react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import Pagination from "@/shared/ui/pagination/Pagination";
import { SearchableSelect, inputCls } from "@/modules/stock/shared/StockSharedUI";
import { fetchRequests, fetchStatusCounts, fetchTypeCounts } from "./itemRequestApi";
import {
  REQUEST_STATUS,
  REQUEST_STATUS_TABS,
  RequestStatusBadge,
  IssuedProgress,
  fmtDateTime,
  requestSummary,
  ReasonChip,
} from "./requestUi";

// One tab per kind of request; each has its own statuses and progress.
const TYPE_TABS = [
  { key: "ISSUE", label: "Issue", progress: "Given" },
  { key: "REPLACE", label: "Replace", progress: "Replaced" },
  { key: "RETURN", label: "Return", progress: "Received" },
];

const th = "px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 whitespace-nowrap";

const ItemRequestList = () => {
  const router = useRouter();
  const params = useSearchParams();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Open work first — that is what the store comes here for.
  const [status, setStatus] = useState("PENDING");
  const [branchId, setBranchId] = useState("");
  const [type, setType] = useState(() => (TYPE_TABS.some((t) => t.key === params.get("type")) ? params.get("type") : "ISSUE"));
  const [typeCounts, setTypeCounts] = useState({});
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [branches, setBranches] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BACKEND_URL}/stock/scoped-branches?module=item-requests`, { credentials: "include" });
        const j = await r.json();
        if (j.success) setBranches(j.data?.branches || []);
      } catch {
        setBranches([]);
      }
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const base = {};
      if (branchId) base.branchId = branchId;
      if (debounced) base.search = debounced;
      const [list, c, tc] = await Promise.all([
        fetchRequests({ ...base, type, ...(status ? { status } : {}), page: String(page), limit: String(limit) }),
        fetchStatusCounts({ ...base, type }),
        fetchTypeCounts(base),
      ]);
      setRows(list.rows);
      setTotal(list.total);
      setCounts(c);
      setTypeCounts(tc);
    } catch (err) {
      setError(err.message);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [status, branchId, type, debounced, page, limit]);

  useEffect(() => { load(); }, [load]);

  const changeFilter = (setter) => (v) => { setter(v); setPage(1); };
  const changeType = (t) => {
    setType(t);
    setStatus("PENDING");
    setPage(1);
    router.replace(`/stock/item-requests?type=${t}`, { scroll: false });
  };
  const tabMeta = TYPE_TABS.find((t) => t.key === type) || TYPE_TABS[0];
  const allCount = Object.values(counts).reduce((a, b) => a + b, 0);
  const tabs = [{ value: "", label: "All", n: allCount }, ...REQUEST_STATUS_TABS.map((s) => ({ value: s, label: REQUEST_STATUS[s].label, n: counts[s] || 0 }))];

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Item Requests</h1>
        <p className="mt-0.5 text-sm text-slate-500">Subscribers&apos; requests for stock — issue what you have now, the rest later.</p>
      </div>

      <div className="mb-5 flex gap-1 border-b border-slate-200">
        {TYPE_TABS.map((t) => (
          <button
            key={t.key} type="button" onClick={() => changeType(t.key)}
            className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              type === t.key ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
            title="Open (pending or partial) requests"
          >
            {t.label}
            {typeCounts[t.key] > 0 && (
              <span className="rounded-full bg-violet-100 px-1.5 text-xs tabular-nums text-violet-700">{typeCounts[t.key]}</span>
            )}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {tabs.map((t) => (
            <button
              key={t.value || "all"}
              type="button"
              onClick={() => changeFilter(setStatus)(t.value)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                status === t.value ? "bg-indigo-600 text-white shadow-sm" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {t.label}
              <span className={`rounded-full px-1.5 text-xs ${status === t.value ? "bg-white/20" : "bg-white text-slate-500"}`}>{t.n}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-72">
            <input value={search} onChange={(e) => changeFilter(setSearch)(e.target.value)} placeholder="Search request no., order ID, username…" className={inputCls} />
          </div>
          <div className="w-56">
            <SearchableSelect value={branchId} onChange={changeFilter(setBranchId)} options={branches.map((b) => ({ value: b._id, label: b.name }))} placeholder="All branches" />
          </div>
          {(branchId || search) && (
            <button
              type="button"
              onClick={() => { setBranchId(""); setSearch(""); setPage(1); }}
              className="inline-flex items-center gap-1 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-100"
            >
              <RotateCcw className="h-4 w-4" /> Reset
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[1000px] border-collapse text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className={th}>Request No.</th>
              <th className={th}>Order ID</th>
              <th className={th}>Username</th>
              <th className={th}>Service Type</th>
              <th className={th}>Items</th>
              <th className={th}>Branch</th>
              <th className={th}>{tabMeta.progress}</th>
              <th className={th}>Status</th>
              <th className={th}>Raised</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={9} className="px-4 py-3"><div className="h-5 animate-pulse rounded bg-slate-100" /></td></tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-14 text-center">
                  <Inbox className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-3 text-sm font-medium text-slate-700">No requests here</p>
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r._id} onClick={() => router.push(`/stock/item-requests/${r._id}`)} className="cursor-pointer transition hover:bg-indigo-50/40">
                  <td className="px-4 py-3 font-mono font-semibold text-indigo-700">
                    {r.requestNumber}
                    {r.revision > 1 && <span className="ml-1 text-[10px] font-semibold text-slate-400">rev {r.revision}</span>}
                    {r.channel === "TEST_SIMULATOR" && <span className="ml-1 rounded bg-yellow-100 px-1 text-[10px] font-bold text-yellow-800">TEST</span>}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">{r.subscriber?.orderId}</td>
                  <td className="px-4 py-3 text-slate-700">{r.subscriber?.username || "—"}</td>
                  <td className="px-4 py-3 text-slate-700">{r.subscriber?.serviceType || "—"}</td>
                  <td className="max-w-56 px-4 py-3 text-slate-600">
                    <p className="truncate" title={requestSummary(r)}>{requestSummary(r)}</p>
                    {r.reason?.code && <div className="mt-0.5"><ReasonChip type={r.type} reason={r.reason} /></div>}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{r.branchId?.name || "—"}</td>
                  <td className="px-4 py-3">
                    {r.type === "RETURN" ? (
                      <IssuedProgress issued={r.returnReceivedQty} requested={r.returnRequestedQty} />
                    ) : (
                      <IssuedProgress issued={r.issuedQty} requested={r.requestedQty} />
                    )}
                  </td>
                  <td className="px-4 py-3"><RequestStatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {fmtDateTime(r.createdAt)}
                    {r.requestedBy?.name ? <div>{r.requestedBy.name}</div> : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-5">
        <Pagination currentPage={page} totalItems={total} itemsPerPage={limit} onPageChange={setPage} onItemsPerPageChange={(n) => { setLimit(n); setPage(1); }} />
      </div>
    </div>
  );
};

export default ItemRequestList;
