"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { History, Eye } from "lucide-react";
import Pagination from "@/shared/ui/pagination/Pagination";
import { SearchableSelect } from "@/modules/stock/shared/StockSharedUI";
import DateRangeButton from "@/modules/stock/shared/DateRangeButton";
import { fetchRequests } from "./transferApi";
import { useTransferBranches, useDebounced } from "./useTransferBase";
import { PageHeader, StatusChips, ResetButton, SearchBox, StatusCell, LinesColumns, BranchPair, EmptyRow, LoadingRows, RowButton, RowMenu, PersonCell, th } from "./shared";
import { RequestDetailModal, RequestHistoryModal } from "./DetailModals";

// Read from our branch's side: we asked, or we were asked.
const DIRECTIONS = [
  { value: "mine", label: "My Requests" },
  { value: "to-us", label: "Requests to Us" },
];
const STATUS_OPTIONS = [
  { key: "", label: "All" },
  { key: "RECEIVED", label: "Received" },
  { key: "DECLINED", label: "Declined" },
];

/* Transfer History — every finished request (received or declined), both ways. */
const TransferHistoryPage = () => {
  const params = useSearchParams();
  const base = useTransferBranches("stock-transfer-history");

  const [status, setStatus] = useState("");
  const [search, setSearch] = useState(params.get("search") || "");
  const [direction, setDirection] = useState("");
  const [branchId, setBranchId] = useState("");
  const [otherBranchId, setOtherBranchId] = useState("");
  const ours = base.ourBranch(branchId); // "" = every branch (All branches)
  // On All branches there is no "us", so My Requests / Requests to Us mean nothing.
  const noOurs = base.coversMany && !ours;
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const q = useDebounced(search);
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [popup, setPopup] = useState(null); // { kind: "view" | "history", id }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchRequests({ side: "history", status, search: q, direction: noOurs ? "" : direction, branchId: ours, otherBranchId, from, to, page, limit });
      setRows(res.rows);
      setTotal(res.total);
      setCounts(res.counts);
    } catch (e) {
      toast.error(e.message);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [status, q, direction, noOurs, ours, otherBranchId, from, to, page, limit]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [status, q, direction, ours, otherBranchId, from, to]);

  const filtered = search || direction || branchId || otherBranchId || from || to;
  const reset = () => { setSearch(""); setDirection(""); setBranchId(""); setOtherBranchId(""); setFrom(""); setTo(""); };
  const cols = 10;

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <PageHeader icon={History} title="Transfer History" />

      {/* One row of filters — search, direction, branch, dates — then the status tabs. */}
      <div className="mb-2.5 flex flex-wrap items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="w-full sm:w-72"><SearchBox value={search} onChange={setSearch} placeholder="Search request / TRF no. or category…" /></div>
        <div className="w-full sm:w-48" title={noOurs ? "Pick one branch in Our branch to use this" : undefined}>
          <SearchableSelect value={noOurs ? "" : direction} onChange={setDirection} options={DIRECTIONS} placeholder="All requests" disabled={noOurs} />
        </div>
        <div className="w-full sm:w-48">
          <SearchableSelect
            value={otherBranchId} onChange={setOtherBranchId} placeholder="Other branch"
            options={base.branches.filter((b) => String(b._id) !== ours).map((b) => ({ value: String(b._id), label: b.name }))}
          />
        </div>
        {base.coversMany && (
          <div className="w-full sm:w-48">
            <SearchableSelect value={base.ourValue(branchId)} onChange={setBranchId} placeholder="Our branch" options={base.ourOptions} />
          </div>
        )}
        <DateRangeButton from={from} to={to} onFrom={setFrom} onTo={setTo} hint="Finished between these dates" />
        {filtered && <ResetButton onClick={reset} />}
      </div>
      <div className="mb-5">
        <StatusChips options={STATUS_OPTIONS} counts={counts} value={status} onChange={setStatus} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className={th}>Request No.</th>
                <th className={th}>Branch</th>
                <th className={th}>Category</th>
                <th className={`${th} text-right!`}>Asked</th>
                <th className={`${th} text-right!`}>Sent</th>
                <th className={`${th} text-right!`}>Short</th>
                <th className={th}>Requested By</th>
                <th className={th}>Closed By</th>
                <th className={th}>Status</th>
                <th className={`${th} text-right!`}>Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? <LoadingRows cols={cols} /> : rows.length === 0 ? (
                <EmptyRow colSpan={cols} icon={History} title="Nothing here yet" hint={filtered ? "Try changing or resetting the filters." : "Received and declined requests show here."} />
              ) : rows.map((r) => {
                return (
                  <tr key={r._id} className="transition hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-indigo-600">{r.requestNumber}</p>
                      {r.transferNumber && <p className="text-[11px] text-slate-400">{r.transferNumber}</p>}
                    </td>
                    {/* Stock goes from the branch asked to the branch that asked. */}
                    <td className="px-4 py-3"><BranchPair from={r.sourceBranchId} to={r.requestingBranchId} /></td>
                    <LinesColumns request={r} />
                    <td className="px-4 py-3"><PersonCell actor={r.createdBy} name={r.requestedByName} at={r.requestedAt} /></td>
                    <td className="px-4 py-3"><PersonCell actor={r.closedBy} at={r.closedAt} /></td>
                    <td className="px-4 py-3"><StatusCell request={r} /></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <RowButton icon={Eye} title="View" onClick={() => setPopup({ kind: "view", id: r._id })} />
                        <RowMenu items={[{ label: "History", icon: History, onClick: () => setPopup({ kind: "history", id: r._id }) }]} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {total > 10 && (
        <div className="mt-4">
          <Pagination currentPage={page} totalItems={total} itemsPerPage={limit} onPageChange={setPage} onItemsPerPageChange={(n) => { setLimit(n); setPage(1); }} />
        </div>
      )}

      {popup?.kind === "view" && <RequestDetailModal side="history" requestId={popup.id} onClose={() => setPopup(null)} />}
      {popup?.kind === "history" && <RequestHistoryModal side="history" requestId={popup.id} onClose={() => setPopup(null)} />}
    </div>
  );
};

export default TransferHistoryPage;
