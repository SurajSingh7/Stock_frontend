"use client";

import React, { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useSearchParams } from "next/navigation";
import { Search, RotateCw, Eye, Ban, RefreshCw, FlaskConical, Paperclip } from "lucide-react";
import Pagination from "@/shared/ui/pagination/Pagination";
import { alertApi } from "../shared/alertApi";
import { useAlertEvents } from "../templates/AlertTemplates";
import {
  AlertsShell, Modal, ErrorBox, Empty, ChannelBadge, StatusBadge, MESSAGE_STATUS_META, inputCls, th, td, btnGhost, btnPrimary, fmtDateTime, useAlertActions,
} from "../shared/AlertUI";

const STATUS_ORDER = ["QUEUED", "SENDING", "SENT", "DELIVERED", "READ", "FAILED", "SKIPPED", "CANCELLED"];
const TRIGGER_LABEL = { EVENT: "Rule", ESCALATION: "Escalation", MANUAL: "Manual", RESEND: "Resend", TEST: "Test", DIGEST: "Summary" };

const MessageModal = ({ id, onClose, onChanged, can }) => {
  const [m, setM] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    alertApi(`/messages/${id}`).then((r) => setM(r.data)).catch((e) => toast.error(e.message));
  }, [id]);

  const act = async (path, method, ok) => {
    setBusy(true);
    try {
      const r = await alertApi(`/messages/${id}/${path}`, { method });
      toast.success(typeof ok === "function" ? ok(r.data) : ok);
      onChanged();
    } catch (e) {
      toast.error(e.message);
      setBusy(false);
    }
  };

  return (
    <Modal
      title={m ? `${m.recordRef || "Message"} · ${m.to?.name || m.to?.address}` : "Message"}
      onClose={onClose}
      maxWidth="max-w-3xl"
      footer={m && (
        <>
          {m.status === "QUEUED" && can("CANCEL") && <button type="button" className={btnGhost} disabled={busy} onClick={() => act("cancel", "PATCH", "Cancelled")}><Ban className="h-4 w-4" />Cancel</button>}
          {!["QUEUED", "SENDING"].includes(m.status) && m.to?.address && can("RESEND") && (
            <button type="button" className={btnPrimary} disabled={busy} onClick={() => act("resend", "POST", "Resend queued")}><RotateCw className="h-4 w-4" />Resend</button>
          )}
          {/* Skipped for want of a recipient: look the rule's recipients up again
              (a number added, a contact linked since) and send to whoever is new. */}
          {m.status === "SKIPPED" && !m.to?.address && m.ruleId && can("RESEND") && (
            <button
              type="button" className={btnPrimary} disabled={busy}
              title="Find the rule's recipients again — e.g. after adding a WhatsApp number or linking a contact — and send to anyone who hasn't got it"
              onClick={() => act("resend", "POST", (d) => `Sent to ${d?.to?.join(", ") || "recipients"}`)}
            >
              <RotateCw className="h-4 w-4" />Try again
            </button>
          )}
        </>
      )}
    >
      {!m ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <ChannelBadge channel={m.channel} />
            <StatusBadge meta={MESSAGE_STATUS_META[m.status]} />
            <span className="text-xs text-slate-500">{TRIGGER_LABEL[m.trigger]}{m.stepType ? ` · ${m.stepType.toLowerCase()}` : ""}{m.ruleName ? ` · ${m.ruleName}` : ""}</span>
          </div>
          {m.sandboxedFrom && (
            <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
              <FlaskConical className="h-4 w-4" />Sandbox — would have gone to {m.sandboxedFrom}
            </p>
          )}
          {(m.lastError || m.skipReason) && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-100">{m.skipReason || m.lastError}</p>
          )}
          <dl className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-4">
            <div><dt className="text-xs text-slate-500">To</dt><dd className="break-all text-slate-900">{m.to?.address || "—"}</dd></div>
            {m.cc?.length > 0 && <div><dt className="text-xs text-slate-500">CC</dt><dd className="break-all text-slate-900">{m.cc.join(", ")}</dd></div>}
            <div><dt className="text-xs text-slate-500">Attempts</dt><dd className="text-slate-900">{m.attempts}</dd></div>
            <div><dt className="text-xs text-slate-500">Sent</dt><dd className="text-slate-900">{fmtDateTime(m.sentAt)}</dd></div>
            {m.channel === "WHATSAPP" && <div><dt className="text-xs text-slate-500">Delivered / Read</dt><dd className="text-slate-900">{fmtDateTime(m.deliveredAt)} / {fmtDateTime(m.readAt)}</dd></div>}
          </dl>
          <div>
            {m.subject && <p className="mb-2 text-sm font-semibold text-slate-900">{m.subject}</p>}
            {m.channel === "EMAIL" ? (
              <div className="rounded-lg border border-slate-200 p-3 text-sm" dangerouslySetInnerHTML={{ __html: m.body }} />
            ) : (
              <pre className="whitespace-pre-wrap rounded-lg bg-[#dcf8c6] p-3 font-sans text-sm text-slate-900">{m.body}</pre>
            )}
            {m.attachments?.length > 0 && (
              <p className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500"><Paperclip className="h-3 w-3" />{m.attachments.map((a) => a.fileName).join(", ")}</p>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-600">Timeline</p>
            <ol className="space-y-1 text-xs text-slate-600">
              {(m.log || []).map((l, i) => (
                <li key={i}><span className="text-slate-400">{fmtDateTime(l.at)}</span> · <strong>{l.event}</strong> {l.detail}</li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </Modal>
  );
};

const AlertLog = () => {
  const can = useAlertActions("alert-log");
  const events = useAlertEvents();
  const params = useSearchParams();
  const [filters, setFilters] = useState({ channel: "", status: "", eventKey: "", search: "", dateFrom: "", dateTo: "", recordId: params?.get("recordId") || "" });
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [viewing, setViewing] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await alertApi("/messages", { query: { ...filters, page, limit } });
      setRows(r.data || []);
      setTotal(r.pagination?.total || 0);
      setCounts(r.pagination?.counts || {});
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filters, page, limit]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const setF = (k, v) => { setFilters((f) => ({ ...f, [k]: v })); setPage(1); };

  return (
    <AlertsShell
      title="Message Log"
      description="Every message — sent, failed or skipped — with who it went to and why. Failed ones can be resent."
      actions={<button type="button" className={btnGhost} onClick={load}><RefreshCw className="h-4 w-4" />Refresh</button>}
    >
      <div className="mb-3 flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setF("status", "")} className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${!filters.status ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white text-slate-600 ring-slate-200"}`}>
          All
        </button>
        {STATUS_ORDER.map((s) => (
          <button key={s} type="button" onClick={() => setF("status", filters.status === s ? "" : s)}
            className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${filters.status === s ? "bg-indigo-600 text-white ring-indigo-600" : `${MESSAGE_STATUS_META[s].cls}`}`}>
            {MESSAGE_STATUS_META[s].label} {counts[s] ? `· ${counts[s]}` : ""}
          </button>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input className={`${inputCls} pl-9`} value={filters.search} onChange={(e) => setF("search", e.target.value)} placeholder="Record, person, number, rule…" />
        </div>
        <select className={`${inputCls} max-w-36`} value={filters.channel} onChange={(e) => setF("channel", e.target.value)}>
          <option value="">All channels</option><option value="WHATSAPP">WhatsApp</option><option value="EMAIL">Email</option><option value="IN_APP">In-App</option>
        </select>
        <select className={`${inputCls} max-w-xs`} value={filters.eventKey} onChange={(e) => setF("eventKey", e.target.value)}>
          <option value="">All events</option>
          {events.map((ev) => <option key={ev.key} value={ev.key}>{ev.group} · {ev.label}</option>)}
        </select>
        <input type="date" className={`${inputCls} max-w-40`} value={filters.dateFrom} onChange={(e) => setF("dateFrom", e.target.value)} />
        <input type="date" className={`${inputCls} max-w-40`} value={filters.dateTo} onChange={(e) => setF("dateTo", e.target.value)} />
        {filters.recordId && (
          <button type="button" className={btnGhost} onClick={() => setF("recordId", "")}>One record only · clear</button>
        )}
      </div>

      <ErrorBox>{error}</ErrorBox>
      {!loading && rows.length === 0 ? (
        <Empty title="No messages" message="Messages appear here as soon as a rule fires or a test is sent." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50"><tr>{["Time", "Channel", "To", "Record", "Why", "Status", ""].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((m) => (
                <tr key={m._id} className="hover:bg-slate-50/60">
                  <td className={`${td} whitespace-nowrap`}>{fmtDateTime(m.createdAt)}</td>
                  <td className={td}><ChannelBadge channel={m.channel} /></td>
                  <td className={td}>
                    <p className="font-medium text-slate-900">{m.to?.name || "—"}</p>
                    <p className="text-xs text-slate-500">{m.to?.address}{m.sandboxedFrom ? " · sandbox" : ""}</p>
                  </td>
                  <td className={td}><p className="font-medium">{m.recordRef || "—"}</p><p className="text-xs text-slate-500">{m.recordType}</p></td>
                  <td className={td}><p>{TRIGGER_LABEL[m.trigger]}{m.stepType && m.stepType !== "INITIAL" ? ` · ${m.stepType.toLowerCase()}` : ""}</p><p className="text-xs text-slate-500">{m.ruleName}</p></td>
                  <td className={td}>
                    <StatusBadge meta={MESSAGE_STATUS_META[m.status]} />
                    {(m.skipReason || (m.status === "FAILED" && m.lastError)) && <p className="mt-1 max-w-64 text-xs text-slate-500">{m.skipReason || m.lastError}</p>}
                  </td>
                  <td className={`${td} text-right`}>
                    <button type="button" title="View" onClick={() => setViewing(m._id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600"><Eye className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-slate-100 px-4 py-3">
            <Pagination currentPage={page} totalItems={total} itemsPerPage={limit} onPageChange={setPage} onItemsPerPageChange={(n) => { setLimit(n); setPage(1); }} />
          </div>
        </div>
      )}
      {viewing && <MessageModal id={viewing} can={can} onClose={() => setViewing(null)} onChanged={() => { setViewing(null); load(); }} />}
    </AlertsShell>
  );
};

export default AlertLog;
