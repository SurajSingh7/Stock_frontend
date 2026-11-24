"use client";

/*
  Lost Items (side "items") and Approval → Lost Items (side "approval") —
  the same list. Lost Items makes entries (+ Add Lost / + Add Found) and lets
  whoever made a rejected one fix it; the approval side reviews them.
*/

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { SearchX, Eye, PencilLine, Plus, ShieldCheck, Info, Skull } from "lucide-react";
import Pagination from "@/shared/ui/pagination/Pagination";
import { SearchableSelect } from "@/modules/stock/shared/StockSharedUI";
import DateRangeButton from "@/modules/stock/shared/DateRangeButton";
import { fetchScopedBranches } from "@/modules/stock/shared/lookupsApi";
import {
  PageHeader, StatusChips, StatusBadge, PersonCell, SearchBox, ResetButton, EmptyRow, LoadingRows, RowButton, th,
} from "@/modules/stock/inventoryTransfer/shared";
import { fetchLostEntries } from "./lostApi";
import { LOST_STATUS, TypeBadge, ProductsCell, quantityText, useLostAccess, FAMILIES } from "./lostUi";

const STATUS_OPTIONS = [
  { key: "", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
];
const TYPE_OPTIONS = [{ value: "LOST", label: "Lost" }, { value: "FOUND", label: "Found" }];


// The status, with an ⓘ for why a rejected entry was rejected.
const StatusCell = ({ entry }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex items-center gap-1">
      <StatusBadge status={entry.status} map={LOST_STATUS} />
      {entry.status === "REJECTED" && entry.rejectReason && (
        <>
          <button type="button" onClick={() => setOpen((v) => !v)} aria-label="Why rejected" className="text-slate-400 hover:text-indigo-600">
            <Info className="h-3.5 w-3.5" />
          </button>
          {open && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
              <div className="absolute left-0 top-7 z-40 w-64 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-lg">
                <p className="mb-1 font-semibold text-rose-700">Rejected</p>
                {entry.rejectReason}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

const LostItemsList = ({ family = "lost", side = "items" }) => {
  const router = useRouter();
  const approval = side === "approval";
  const dead = family === "dead";
  const cfg = FAMILIES[family][side];
  const base = cfg.path;
  const access = useLostAccess(family);

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [branchId, setBranchId] = useState("");
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  // The approval list opens on what is waiting.
  const [status, setStatus] = useState(approval ? "PENDING" : "");
  const [branches, setBranches] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  useEffect(() => { const t = setTimeout(() => setDebounced(search.trim()), 350); return () => clearTimeout(t); }, [search]);
  useEffect(() => {
    fetchScopedBranches(cfg.module).then(setBranches).catch(() => setBranches([]));
  }, [cfg.module]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = { page, limit };
      if (debounced) query.search = debounced;
      if (branchId) query.branchId = branchId;
      if (type) query.type = type;
      if (status) query.status = status;
      if (from) query.from = from;
      if (to) query.to = to;
      const r = await fetchLostEntries(family, side, query);
      setRows(r.rows);
      setTotal(r.total);
      setCounts(r.counts);
    } catch (err) {
      toast.error(err.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [family, side, page, limit, debounced, branchId, type, status, from, to]);

  useEffect(() => { load(); }, [load]);

  const reset = (fn) => (v) => { fn(v); setPage(1); };
  const filtered = !!search || !!branchId || !!type || !!from || !!to;
  const clear = () => { setSearch(""); setBranchId(""); setType(""); setFrom(""); setTo(""); setPage(1); };
  // Dead Items has one type only — no Type column.
  const COLS = dead ? 8 : 9;

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <PageHeader icon={approval ? ShieldCheck : dead ? Skull : SearchX} title={cfg.title}>
        {!approval && access.canCreate && dead && (
          <button
            type="button" onClick={() => router.push(`${base}/new?type=DEAD`)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
          >
            <Plus className="h-4 w-4" /> Add Dead
          </button>
        )}
        {!approval && access.canCreate && !dead && (
          <>
            <button
              type="button" onClick={() => router.push(`${base}/new?type=FOUND`)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-100"
            >
              <Plus className="h-4 w-4" /> Add Found
            </button>
            <button
              type="button" onClick={() => router.push(`${base}/new?type=LOST`)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
            >
              <Plus className="h-4 w-4" /> Add Lost
            </button>
          </>
        )}
      </PageHeader>

      <div className="mb-2.5 flex flex-wrap items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="w-full sm:w-72"><SearchBox value={search} onChange={reset(setSearch)} placeholder="Entry no., serial or product…" /></div>
        <div className="w-full sm:w-52">
          <SearchableSelect value={branchId} onChange={reset(setBranchId)} options={branches.map((b) => ({ value: String(b._id), label: b.name }))} placeholder="All branches" />
        </div>
        {!dead && <div className="w-full sm:w-52"><SearchableSelect value={type} onChange={reset(setType)} options={TYPE_OPTIONS} placeholder="All types" /></div>}
        <DateRangeButton from={from} to={to} onFrom={reset(setFrom)} onTo={reset(setTo)} hint="Made between these dates" />
        {filtered && <ResetButton onClick={clear} />}
      </div>
      <div className="mb-5">
        <StatusChips options={STATUS_OPTIONS} counts={counts} value={status} onChange={reset(setStatus)} />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-250 border-collapse text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className={th}>Entry No.</th>
              {!dead && <th className={th}>Type</th>}
              <th className={th}>Branch</th>
              <th className={th}>Products</th>
              <th className={th}>Quantity</th>
              <th className={th}>Status</th>
              <th className={th}>Created By</th>
              <th className={th}>{approval ? "Decided By" : "Approved / Rejected By"}</th>
              <th className={`${th} text-right`}>Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <LoadingRows cols={COLS} />
            ) : rows.length === 0 ? (
              <EmptyRow colSpan={COLS} icon={dead ? Skull : SearchX} title="No entries" hint={filtered || status ? "Try changing or resetting the filters." : approval ? "Nothing waiting for approval." : dead ? "Write off dead units with + Add Dead." : "Report lost units with + Add Lost."} />
            ) : (
              rows.map((r) => {
                const canEdit = !approval && r.status === "REJECTED" && access.canCreate && access.isMine(r);
                return (
                  <tr key={r._id} className="transition hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-mono text-sm font-semibold text-slate-900">{r.entryNumber}</td>
                    {!dead && <td className="px-4 py-3"><TypeBadge type={r.type} /></td>}
                    <td className="px-4 py-3 text-slate-700">{r.branchId?.name || "—"}</td>
                    <td className="max-w-56 px-4 py-3"><ProductsCell entry={r} /></td>
                    <td className="px-4 py-3 font-semibold tabular-nums text-slate-800">{quantityText(r)}</td>
                    <td className="px-4 py-3"><StatusCell entry={r} /></td>
                    <td className="px-4 py-3"><PersonCell actor={r.createdBy} at={r.submittedAt || r.createdAt} /></td>
                    <td className="px-4 py-3"><PersonCell actor={r.decidedBy} at={r.decidedAt} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {approval && r.status === "PENDING" && access.canApprove ? (
                          <RowButton tone="indigo" icon={Eye} onClick={() => router.push(`${base}/${r._id}`)}>Review</RowButton>
                        ) : (
                          <>
                            {canEdit && <RowButton tone="amber" icon={PencilLine} title="Edit and resend" onClick={() => router.push(`${base}/${r._id}/edit`)} />}
                            <RowButton icon={Eye} title="View" onClick={() => router.push(`${base}/${r._id}`)} />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {total > 10 && (
        <div className="mt-5">
          <Pagination currentPage={page} totalItems={total} itemsPerPage={limit} onPageChange={setPage} onItemsPerPageChange={(n) => { setLimit(n); setPage(1); }} />
        </div>
      )}
    </div>
  );
};

export default LostItemsList;
