"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Send as SendIcon, Inbox, Plus, Eye, Truck, Ban, PackageCheck, PencilLine, History } from "lucide-react";
import Pagination from "@/shared/ui/pagination/Pagination";
import { SearchableSelect } from "@/modules/stock/shared/StockSharedUI";
import DateRangeButton from "@/modules/stock/shared/DateRangeButton";
import { fetchRequests, declineRequest } from "./transferApi";
import { useTransferBranches, useDebounced } from "./useTransferBase";
import {
  PageHeader, PrimaryButton, StatusChips, ResetButton, SearchBox, StatusCell, LinesColumns,
  EmptyRow, LoadingRows, RowButton, RowMenu, ReasonDialog, PersonCell, th, useTransferAccess,
} from "./shared";
import { RequestDetailModal, RequestHistoryModal } from "./DetailModals";

const STATUS_OPTIONS = [
  { key: "", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "ON_THE_WAY", label: "On the Way" },
  { key: "MISMATCH", label: "Mismatch" },
  { key: "RECEIVED", label: "Received" },
  { key: "DECLINED", label: "Declined" },
];

const SIDES = {
  mine: {
    module: "my-stock-requests",
    icon: SendIcon,
    title: "My Requests",
    branchCol: "Requested To",
    otherPicker: "Requested To",
    empty: "You have not asked for stock yet",
    branchPicker: "All our branches",
  },
  "to-us": {
    module: "stock-requests-to-us",
    icon: Inbox,
    title: "Requests to Us",
    branchCol: "Requesting Branch",
    otherPicker: "Requesting Branch",
    empty: "No branch has asked you for stock yet",
    branchPicker: "All asked branches",
  },
};

/*
  My Requests (side "mine") and Requests to Us (side "to-us") — every request
  of each side, every step done from the row:
    Pending             to-us: Send / Decline
    On the Way          mine:  Receive (its own page) → All Received / Report Problem
    Mismatch    to-us: Correct & Resend
    Received, Declined  finished — View / History only
  Asked / Sent / Short show at a glance when less than asked went.
*/
const StockRequestsPage = ({ side }) => {
  const cfg = SIDES[side];
  const mine = side === "mine";
  const params = useSearchParams();
  const router = useRouter();
  const access = useTransferAccess();
  const base = useTransferBranches(cfg.module);

  const [status, setStatus] = useState("");
  const [search, setSearch] = useState(params.get("search") || "");
  const [branchId, setBranchId] = useState("");
  const ours = base.ourBranch(branchId); // "" = every branch (All branches)
  const [otherBranchId, setOtherBranchId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const q = useDebounced(search);
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [popup, setPopup] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchRequests({ side, status, search: q, branchId: ours, otherBranchId, from, to, page, limit });
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
  }, [side, status, q, ours, otherBranchId, from, to, page, limit]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [status, q, branchId, otherBranchId, from, to]);

  const filtered = search || branchId || otherBranchId || from || to;
  const reset = () => { setSearch(""); setBranchId(""); setOtherBranchId(""); setFrom(""); setTo(""); };

  const refresh = () => { setPopup(null); load(); };

  const cols = 10;
  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <PageHeader icon={cfg.icon} title={cfg.title}>
        {mine && access.canRequest && <PrimaryButton icon={Plus} onClick={() => router.push("/stock/inventory/transfers/my-requests/new")}>Request Stock</PrimaryButton>}
      </PageHeader>

      {/* One row of filters — search, the other branch, our branch, dates — then the status tabs. */}
      <div className="mb-2.5 flex flex-wrap items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="w-full sm:w-72"><SearchBox value={search} onChange={setSearch} placeholder="Search request no. or category…" /></div>
        <div className="w-full sm:w-52">
          <SearchableSelect
            value={otherBranchId} onChange={setOtherBranchId} placeholder={cfg.otherPicker}
            options={base.branches.filter((b) => String(b._id) !== ours && (base.myBranchIds === null || !base.isMine(b._id))).map((b) => ({ value: String(b._id), label: b.name }))}
          />
        </div>
        {base.coversMany && (
          <div className="w-full sm:w-52">
            <SearchableSelect
              value={base.ourValue(branchId)} onChange={setBranchId} placeholder={cfg.branchPicker}
              options={base.ourOptions}
            />
          </div>
        )}
        <DateRangeButton from={from} to={to} onFrom={setFrom} onTo={setTo} hint="Requested between these dates" />
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
                <th className={th}>{cfg.branchCol}</th>
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
                <EmptyRow
                  colSpan={cols} icon={cfg.icon} title={cfg.empty}
                  hint={mine && access.canRequest ? "Use Request Stock to ask another branch." : null}
                />
              ) : rows.map((r) => {
                const ours = base.isMine(mine ? r.requestingBranchId : r.sourceBranchId);
                return (
                  <tr key={r._id} className="transition hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-sm font-semibold text-indigo-600">{r.requestNumber}</td>
                    <td className="px-4 py-3 text-sm">
                      <p className="font-semibold text-slate-900">{mine ? r.sourceBranchId?.name : r.requestingBranchId?.name}</p>
                      {base.myBranchIds?.length !== 1 && <p className="text-xs text-slate-400">{mine ? `for ${r.requestingBranchId?.name}` : `to ${r.sourceBranchId?.name}`}</p>}
                    </td>
                    <LinesColumns request={r} />
                    <td className="px-4 py-3"><PersonCell actor={r.createdBy} name={r.requestedByName} at={r.requestedAt} /></td>
                    <td className="px-4 py-3"><PersonCell actor={r.closedBy} at={r.closedAt} /></td>
                    <td className="px-4 py-3"><StatusCell request={r} /></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        {mine && ours && r.status === "ON_THE_WAY" && access.canReceive && (
                          <RowButton tone="emerald" icon={PackageCheck} onClick={() => router.push(`/stock/inventory/transfers/my-requests/${r._id}/receive`)}>Receive</RowButton>
                        )}
                        {!mine && ours && r.status === "PENDING" && access.canSend && <RowButton tone="emerald" icon={Truck} onClick={() => router.push(`/stock/inventory/transfers/requests-to-us/${r._id}/send`)}>Send</RowButton>}
                        {!mine && ours && r.status === "PENDING" && access.canDecline && <RowButton tone="rose" icon={Ban} onClick={() => setPopup({ kind: "decline", row: r })}>Decline</RowButton>}
                        {!mine && ours && r.status === "MISMATCH" && access.canSend && (
                          <RowButton tone="indigo" icon={PencilLine} onClick={() => router.push(`/stock/inventory/transfers/requests-to-us/${r._id}/correct`)}>Correct &amp; Resend</RowButton>
                        )}
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

      {popup?.kind === "decline" && (
        <ReasonDialog
          title={`Decline ${popup.row.requestNumber}`} confirmLabel="Decline" placeholder="e.g. out of stock"
          message={<>Decline <b>{popup.row.requestingBranchId?.name}</b>&apos;s request? Nothing will be sent.</>}
          onSubmit={async (reason) => {
            try { await declineRequest(popup.row._id, reason); toast.success("Request declined"); refresh(); } catch (e) { toast.error(e.message); }
          }}
          onClose={() => setPopup(null)}
        />
      )}
      {popup?.kind === "view" && <RequestDetailModal side={side} requestId={popup.id} onClose={() => setPopup(null)} />}
      {popup?.kind === "history" && <RequestHistoryModal side={side} requestId={popup.id} onClose={() => setPopup(null)} />}
    </div>
  );
};

export default StockRequestsPage;
