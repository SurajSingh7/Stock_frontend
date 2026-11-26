"use client";

/*
  One Lost Items / Dead Items entry (family lost | dead). On the approval side, a PENDING entry gets Reject
  (reason) and Approve; on Lost Items, whoever made a REJECTED entry gets
  Edit & Resend.
*/

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ClipboardList, Boxes, History, CheckCircle2, XCircle, PencilLine } from "lucide-react";
import { BackHeader, StatusBadge, ConfirmDialog, ReasonDialog, PersonCell, fmtDateTime } from "@/modules/stock/inventoryTransfer/shared";
import { fetchLostEntry, approveLostEntry, rejectLostEntry } from "./lostApi";
import { LOST_STATUS, TypeBadge, REASON_LABEL, FOUND_LABEL, qtyText, useLostAccess, FAMILIES } from "./lostUi";

const Section = ({ icon: Icon, title, children }) => (
  <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-5 py-3">
      <Icon className="h-4 w-4 text-indigo-600" />
      <p className="text-xs font-bold uppercase tracking-wider text-slate-700">{title}</p>
    </div>
    <div className="px-5 py-4">{children}</div>
  </section>
);

const Info = ({ label, children }) => (
  <div>
    <p className="text-xs text-slate-500">{label}</p>
    <div className="mt-0.5 text-sm font-medium text-slate-900">{children || "—"}</div>
  </div>
);

const HISTORY_LABEL = { CREATED: "Sent for approval", RESUBMITTED: "Edited and sent again", APPROVED: "Approved", REJECTED: "Rejected" };
const HISTORY_DOT = { CREATED: "bg-indigo-500", RESUBMITTED: "bg-indigo-500", APPROVED: "bg-emerald-500", REJECTED: "bg-rose-500" };

const holderOf = (l) =>
  l.holder?.kind === "EMPLOYEE" ? `${l.holder.name}${l.holder.code ? ` (${l.holder.code})` : ""}`
    : l.holder?.kind === "SUBSCRIBER" ? [l.holder.name, l.holder.orderId, l.holder.requestNumber].filter(Boolean).join(" · ")
      : "Store";

const STATUS_TEXT = { AVAILABLE: "In store", FAULTY: "Faulty", ASSIGNED: "With", IN_REPAIR: "In repair", LOST: "Lost" };

const LostEntryView = ({ family = "lost", side = "items", id }) => {
  const router = useRouter();
  const approval = side === "approval";
  const access = useLostAccess(family);
  const [entry, setEntry] = useState(null);
  const [action, setAction] = useState(null); // "approve" | "reject"
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setEntry(await fetchLostEntry(family, side, id)); } catch (err) { toast.error(err.message); }
  }, [family, side, id]);
  useEffect(() => { load(); }, [load]);

  if (!entry) return <div className="mx-auto w-full max-w-6xl p-6"><div className="h-40 animate-pulse rounded-2xl bg-slate-100" /></div>;

  const found = entry.type === "FOUND";
  const dead = entry.type === "DEAD";
  const kind = found ? "Found" : dead ? "Dead" : "Lost";
  const back = () => router.push(FAMILIES[family][side].path);
  const canDecide = approval && entry.status === "PENDING" && access.canApprove;
  const canEdit = !approval && entry.status === "REJECTED" && access.canCreate && access.isMine(entry);

  const approve = async () => {
    setBusy(true);
    try { await approveLostEntry(family, entry._id); toast.success(`${entry.entryNumber} approved`); back(); } catch (err) { toast.error(err.message); setAction(null); } finally { setBusy(false); }
  };
  const reject = async (reason) => {
    try { await rejectLostEntry(family, entry._id, reason); toast.success(`${entry.entryNumber} rejected`); back(); } catch (err) { toast.error(err.message); }
  };

  return (
    <div className="min-h-screen bg-slate-50/60">
      <div className="mx-auto w-full max-w-6xl space-y-5 p-6 pb-12">
        <BackHeader onBack={back} title={entry.entryNumber} subtitle={`${kind} · ${entry.branchId?.name || ""}`}>
          <div className="flex items-center gap-2">
            <TypeBadge type={entry.type} />
            <StatusBadge status={entry.status} map={LOST_STATUS} />
          </div>
        </BackHeader>

        {entry.status === "REJECTED" && entry.rejectReason && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <span className="font-semibold">Rejected:</span> {entry.rejectReason}
          </div>
        )}

        <Section icon={ClipboardList} title="Details">
          <div className="grid gap-4 sm:grid-cols-4">
            <Info label="Branch">{entry.branchId?.name}</Info>
            <div className="sm:col-span-3"><Info label={found ? "Where it was found" : dead ? "Why it is dead" : "How it was lost"}>{entry.note}</Info></div>
            <Info label="Created By"><PersonCell actor={entry.createdBy} at={entry.submittedAt || entry.createdAt} /></Info>
            <Info label={entry.status === "REJECTED" ? "Rejected By" : "Approved By"}><PersonCell actor={entry.decidedBy} at={entry.decidedAt} /></Info>
          </div>
        </Section>

        <Section icon={Boxes} title={`${kind} Units · ${entry.lines.length}`}>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-180 text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                  <th className="w-10 px-3 py-2.5">#</th>
                  <th className="px-3 py-2.5">Product</th>
                  <th className="px-3 py-2.5">Serial / From</th>
                  <th className="px-3 py-2.5 text-right">Qty</th>
                  <th className="px-3 py-2.5">{found ? "Lost entry" : dead ? "Was" : "Where it was"}</th>
                  <th className="px-3 py-2.5">{found ? "How it was found" : "Reason"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entry.lines.map((l, i) => (
                  <tr key={l._id}>
                    <td className="px-3 py-2.5 text-xs font-bold text-slate-400">{i + 1}</td>
                    <td className="px-3 py-2.5 font-medium text-slate-800">{l.productName}</td>
                    <td className="px-3 py-2.5">{l.inventoryItemId ? <span className="font-mono text-slate-900">{l.label}</span> : <span className="text-slate-600">{l.label}</span>}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-800">{l.inventoryItemId ? 1 : qtyText(l.quantity, l.unit)}</td>
                    <td className="px-3 py-2.5 text-slate-600">{found ? l.lostEntryNumber || "—" : dead ? STATUS_TEXT[l.fromStatus] || "—" : holderOf(l)}</td>
                    <td className="px-3 py-2.5">
                      {dead ? (
                        <span className="text-slate-700">{l.deadNote || <span className="text-slate-400">As the entry</span>}</span>
                      ) : found ? (
                        <span className="text-slate-800">{FOUND_LABEL[l.foundState] || "—"}{l.foundNote ? <span className="text-xs text-slate-500"> · {l.foundNote}</span> : null}</span>
                      ) : (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200">{REASON_LABEL[l.reason] || "—"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section icon={History} title="History">
          <ol className="relative ml-2 space-y-4 border-l border-slate-200 pl-6">
            {[...(entry.history || [])].reverse().map((h, i) => (
              <li key={i} className="relative">
                <span className={`absolute -left-7.75 top-1 h-3 w-3 rounded-full ring-4 ring-white ${HISTORY_DOT[h.action] || "bg-slate-400"}`} />
                <p className="text-sm font-semibold text-slate-800">{HISTORY_LABEL[h.action] || h.action}{h.note ? <span className="font-normal text-slate-600"> — {h.note}</span> : null}</p>
                <p className="text-xs text-slate-400">{fmtDateTime(h.at)}{h.by?.name ? ` · ${h.by.name}` : ""}</p>
              </li>
            ))}
          </ol>
        </Section>

        {(canDecide || canEdit) && (
          <div className="flex justify-end gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
            {canEdit && (
              <button type="button" onClick={() => router.push(`${FAMILIES[family].items.path}/${entry._id}/edit`)} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500">
                <PencilLine className="h-4 w-4" /> Edit &amp; Resend
              </button>
            )}
            {canDecide && (
              <>
                <button type="button" onClick={() => setAction("reject")} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100">
                  <XCircle className="h-4 w-4" /> Reject
                </button>
                <button type="button" onClick={() => setAction("approve")} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> Approve
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {action === "approve" && (
        <ConfirmDialog
          tone="emerald" busy={busy} confirmLabel="Yes, approve" onConfirm={approve} onClose={() => setAction(null)}
          message={`Approve ${entry.entryNumber}?`}
          detail={found ? `${entry.lines.length} line(s) go back to stock as marked.` : dead ? `${entry.lines.length} line(s) are written off as Dead / Scrapped.` : `${entry.lines.length} line(s) become Lost and leave stock.`}
        />
      )}
      {action === "reject" && (
        <ReasonDialog
          title={`Reject ${entry.entryNumber}`} message="It goes back to whoever made it, to fix and send again." placeholder="What needs fixing…"
          confirmLabel="Reject" onSubmit={reject} onClose={() => setAction(null)}
        />
      )}
    </div>
  );
};

export default LostEntryView;
