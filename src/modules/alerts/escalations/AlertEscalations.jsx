"use client";

import React, { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Search, Square, ChevronRight, RefreshCw, ExternalLink } from "lucide-react";
import Link from "next/link";
import Pagination from "@/shared/ui/pagination/Pagination";
import { alertApi } from "../shared/alertApi";
import { useAlertEvents } from "../templates/AlertTemplates";
import {
  AlertsShell, ErrorBox, Empty, ConfirmModal, StatusBadge, ESCALATION_STATUS_META, inputCls, th, td, btnGhost, fmtDateTime, useAlertActions,
} from "../shared/AlertUI";

const STATUS_TABS = [
  ["ACTIVE", "Waiting"],
  ["RESOLVED", "Resolved"],
  ["FINISHED", "Last step sent"],
  ["STOPPED", "Stopped"],
  ["CANCELLED", "Cancelled"],
  ["ALL", "All"],
];

const relative = (d) => {
  if (!d) return "";
  const mins = Math.round((new Date(d).getTime() - Date.now()) / 60000);
  const abs = Math.abs(mins);
  const txt = abs < 60 ? `${abs} min` : abs < 48 * 60 ? `${Math.round(abs / 60)} h` : `${Math.round(abs / 1440)} d`;
  return mins >= 0 ? `in ${txt}` : `${txt} overdue`;
};

const AlertEscalations = () => {
  const can = useAlertActions("alert-escalations");
  const events = useAlertEvents();
  const [status, setStatus] = useState("ACTIVE");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [open, setOpen] = useState(null);
  const [stopping, setStopping] = useState(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await alertApi("/escalations", { query: { status, search, page, limit } });
      setRows(r.data || []);
      setTotal(r.pagination?.total || 0);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [status, search, page, limit]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const stop = async () => {
    try {
      await alertApi(`/escalations/${stopping._id}/stop`, { method: "PATCH", body: { reason } });
      toast.success("Escalation stopped");
      setStopping(null);
      setReason("");
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const evLabel = (k) => events.find((e) => e.key === k)?.label || k;

  return (
    <AlertsShell
      title="Escalations"
      description="Every record a rule is still chasing: which step went last, and when the next one is due. A chain closes by itself the moment the work is done."
      actions={<button type="button" className={btnGhost} onClick={load}><RefreshCw className="h-4 w-4" />Refresh</button>}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {STATUS_TABS.map(([k, label]) => (
            <button key={k} type="button" onClick={() => { setStatus(k); setPage(1); }}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${status === k ? "bg-indigo-600 text-white" : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input className={`${inputCls} pl-9`} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Record number or rule…" />
        </div>
      </div>

      <ErrorBox>{error}</ErrorBox>
      {!loading && rows.length === 0 ? (
        <Empty title={status === "ACTIVE" ? "Nothing is waiting" : "Nothing here"} message={status === "ACTIVE" ? "When a rule with reminders fires, its record shows up here until the work is done." : ""} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>{["", "Record", "Rule", "Started", "Steps sent", "Next", "Status", ""].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <React.Fragment key={r._id}>
                  <tr className="hover:bg-slate-50/60">
                    <td className={`${td} w-8`}>
                      <button type="button" onClick={() => setOpen(open === r._id ? null : r._id)} className="text-slate-400 hover:text-slate-700">
                        <ChevronRight className={`h-4 w-4 transition ${open === r._id ? "rotate-90" : ""}`} />
                      </button>
                    </td>
                    <td className={td}>
                      <p className="font-semibold text-slate-900">{r.recordRef}</p>
                      <p className="text-xs text-slate-500">{r.recordType}</p>
                    </td>
                    <td className={td}><p>{r.ruleName}</p><p className="text-xs text-slate-500">{evLabel(r.eventKey)}</p></td>
                    <td className={td}>{fmtDateTime(r.startedAt)}</td>
                    <td className={td}>{Math.max(0, r.nextStepIndex - 1)} after the first</td>
                    <td className={td}>
                      {r.status === "ACTIVE" && r.nextDueAt ? (
                        <>
                          <p>Step {r.nextStepIndex + 1} · {fmtDateTime(r.nextDueAt)}</p>
                          <p className={`text-xs ${new Date(r.nextDueAt) < new Date() ? "text-rose-600" : "text-slate-500"}`}>{relative(r.nextDueAt)}</p>
                        </>
                      ) : (
                        <p className="text-xs text-slate-500">{r.closedReason || "—"}</p>
                      )}
                    </td>
                    <td className={td}><StatusBadge meta={ESCALATION_STATUS_META[r.status]} /></td>
                    <td className={`${td} text-right`}>
                      <div className="inline-flex gap-1">
                        <Link href={`/alerts/log?recordId=${r.recordId}`} title="Messages for this record" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600"><ExternalLink className="h-4 w-4" /></Link>
                        {r.status === "ACTIVE" && can("STOP") && (
                          <button type="button" onClick={() => setStopping(r)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"><Square className="h-3.5 w-3.5" />Stop</button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {open === r._id && (
                    <tr className="bg-slate-50/60">
                      <td />
                      <td colSpan={7} className="px-4 pb-4">
                        <ol className="relative ml-2 border-l border-slate-200">
                          {(r.history || []).map((h, i) => (
                            <li key={i} className="mb-2 ml-4">
                              <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-indigo-400" />
                              <p className="text-xs text-slate-500">{fmtDateTime(h.at)}{h.stepIndex !== null && h.stepIndex !== undefined ? ` · step ${h.stepIndex + 1}` : ""}</p>
                              <p className="text-sm text-slate-800"><strong>{h.event}</strong> {h.detail}</p>
                            </li>
                          ))}
                        </ol>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          <div className="border-t border-slate-100 px-4 py-3">
            <Pagination currentPage={page} totalItems={total} itemsPerPage={limit} onPageChange={setPage} onItemsPerPageChange={(n) => { setLimit(n); setPage(1); }} />
          </div>
        </div>
      )}

      {stopping && (
        <ConfirmModal title={`Stop escalation for ${stopping.recordRef}?`} message="No more reminders or escalations go out for it under this rule." confirmLabel="Stop" danger onConfirm={stop} onClose={() => setStopping(null)}>
          <input className={`${inputCls} mt-3`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional) — e.g. handled on call" />
        </ConfirmModal>
      )}
    </AlertsShell>
  );
};

export default AlertEscalations;
