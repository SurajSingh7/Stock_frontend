"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, PackageOpen, RotateCcw } from "lucide-react";
import Pagination from "@/shared/ui/pagination/Pagination";
import { usePermissions } from "@/context/PermissionContext";
import { SearchableSelect, inputCls } from "@/modules/stock/shared/StockSharedUI";
import { entryApi } from "./openingStockApi";
import { kindConfig } from "./openingKinds";
import { fmtDate } from "@/modules/stock/inventory/itemBadges";
import { KindBadge, personSummary } from "@/modules/stock/people/PersonSearch";

export const canDo = (permissions, isAdmin, action, moduleKey = "opening-stock") => {
  if (isAdmin) return true;
  const mod = (permissions || []).find((m) => m.moduleKey === moduleKey);
  return (mod?.actions || []).map((a) => String(a).toUpperCase()).includes(action);
};

export const StatusBadge = ({ status }) => (
  <span
    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
      status === "POSTED" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-700 ring-amber-200"
    }`}
  >
    {status === "POSTED" ? "Posted" : "Draft"}
  </span>
);

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "POSTED", label: "Posted" },
];

const th = "px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600";

// Faulty / beyond-repair lines on a store entry, as one short label.
const notWorking = (r) =>
  [r.faultyCount ? `${r.faultyCount} faulty` : "", r.beyondRepairCount ? `${r.beyondRepairCount} dead` : ""].filter(Boolean).join(" · ") || "—";

const OpeningStockList = ({ kind = "STORE" }) => {
  const router = useRouter();
  const cfg = kindConfig(kind);
  const api = useMemo(() => entryApi(cfg.kind), [cfg.kind]);
  const issued = cfg.kind === "ISSUED";
  const { permissions, isAdmin } = usePermissions();
  const canCreate = canDo(permissions, isAdmin, "CREATE", cfg.moduleKey);

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [status, setStatus] = useState("");
  const [branchId, setBranchId] = useState("");
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
    api.fetchFormOptions().then((o) => setBranches(o.branches || [])).catch(() => setBranches([]));
  }, [api]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = { page: String(page), limit: String(limit) };
      if (status) query.status = status;
      if (branchId) query.branchId = branchId;
      if (debounced) query.search = debounced;
      const { rows: r, total: t } = await api.fetchEntries(query);
      setRows(r);
      setTotal(t);
    } catch (err) {
      setError(err.message);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [api, page, limit, status, branchId, debounced]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [status, branchId, debounced]);

  const hasFilters = !!status || !!branchId || !!search;

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">{cfg.title}</h1>
          <p className="mt-0.5 max-w-3xl text-sm text-slate-500">{cfg.subtitle}</p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => router.push(`${cfg.path}/new`)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" /> New Entry
          </button>
        )}
      </div>

      {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            {STATUS_TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setStatus(t.value)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  status === t.value ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className={issued ? "w-72" : "w-56"}>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={cfg.searchPlaceholder} className={inputCls} />
          </div>
          <div className="w-56">
            <SearchableSelect
              value={branchId}
              onChange={setBranchId}
              options={branches.map((b) => ({ value: b._id, label: b.name }))}
              placeholder="All branches"
            />
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={() => { setStatus(""); setBranchId(""); setSearch(""); }}
              className="inline-flex items-center gap-1 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-100"
            >
              <RotateCcw className="h-4 w-4" /> Reset
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className={th}>Entry No.</th>
              {issued && <th className={th}>With</th>}
              <th className={th}>Branch</th>
              <th className={th}>Entry Date</th>
              {issued && <th className={th}>Issued Since</th>}
              <th className={`${th} text-right`}>Lines</th>
              {!issued && <th className={`${th} text-right`}>Not Working</th>}
              <th className={th}>Status</th>
              <th className={th}>Created By</th>
              <th className={th}>Posted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={issued ? 9 : 8} className="px-4 py-3"><div className="h-5 animate-pulse rounded bg-slate-100" /></td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={issued ? 9 : 8} className="px-4 py-14 text-center">
                  <PackageOpen className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-3 text-sm font-medium text-slate-700">{cfg.empty}</p>
                  {canCreate && <p className="mt-1 text-sm text-slate-400">Start one with “New Entry”.</p>}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r._id}
                  onClick={() => router.push(`${cfg.path}/${r._id}`)}
                  className="cursor-pointer transition hover:bg-indigo-50/40"
                >
                  <td className="px-4 py-3 font-mono font-semibold text-indigo-700">{r.entryNumber}</td>
                  {issued && (
                    <td className="px-4 py-3">
                      {r.issuedTo ? (
                        <>
                          <span className="flex items-center gap-1.5">
                            <span className="font-medium text-slate-900">{r.issuedTo.name || r.issuedTo.username}</span>
                            <KindBadge kind={r.issuedTo.kind} />
                          </span>
                          <span className="text-xs text-slate-500">{personSummary(r.issuedTo)}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3 text-slate-700">{r.branchId?.name || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{fmtDate(r.entryDate)}</td>
                  {issued && <td className="px-4 py-3 text-slate-600">{r.issuedSince ? fmtDate(r.issuedSince) : "—"}</td>}
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{r.lineCount}</td>
                  {!issued && <td className="px-4 py-3 text-right text-slate-700">{notWorking(r)}</td>}
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-slate-600">{r.createdBy?.name || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.postedAt ? `${fmtDate(r.postedAt)}${r.postedBy?.name ? ` · ${r.postedBy.name}` : ""}` : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-5">
        <Pagination
          currentPage={page}
          totalItems={total}
          itemsPerPage={limit}
          onPageChange={setPage}
          onItemsPerPageChange={(n) => { setLimit(n); setPage(1); }}
        />
      </div>
    </div>
  );
};

export default OpeningStockList;
