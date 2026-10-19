"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Send, XCircle, CheckCircle2, History } from "lucide-react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import Pagination from "@/shared/ui/pagination/Pagination";
import { Modal, inputCls, money } from "@/modules/stock/shared/StockSharedUI";
import { dnStatusMeta } from "@/modules/stock/shared/debitNoteStatus";
import { DnChip, DebitNoteHistoryPopup } from "./DebitNoteParts";

/* ============================================================= */
/* A queue of debit notes, by status — the same screen for both    */
/* steps that decide one:                                          */
/*   review   (Payments)   Send for approval / Reject in review    */
/*   approval (Approvals)  Approve / Reject                        */
/* Which step it is decides the tabs, the buttons and the route.   */
/* ============================================================= */

const MODES = {
  review: {
    list: "payments-debit-notes",
    historyBase: "payments",
    statuses: ["REVIEW_PENDING", "REVIEW_REJECTED", "APPROVAL_PENDING", "APPROVED", "APPROVAL_REJECTED"],
    actionable: "REVIEW_PENDING",
    act: (id) => `payments/debit-notes/${id}/review`,
    yes: { label: "Send for approval", icon: Send, body: { decision: "SEND" }, tone: "bg-indigo-600 hover:bg-indigo-500" },
    no: { label: "Reject", body: { decision: "REJECT" }, title: "Reject in review", hint: "It goes back to whoever raised it, who can edit and resubmit it, or withdraw it." },
  },
  approval: {
    list: "payment-approval-debit-notes",
    historyBase: "payment-approval",
    statuses: ["APPROVAL_PENDING", "APPROVED", "APPROVAL_REJECTED"],
    actionable: "APPROVAL_PENDING",
    act: (id) => `payment-approval/debit-notes/${id}/decide`,
    yes: { label: "Approve", icon: CheckCircle2, body: { decision: "APPROVED" }, tone: "bg-emerald-600 hover:bg-emerald-500" },
    no: { label: "Reject", body: { decision: "REJECTED" }, title: "Reject debit note", hint: "This is final — nothing more happens to it, and its held units go back to stock. A new debit note can be raised if one is still needed." },
  },
};

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const th = "px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500";
const thRight = th + " text-right";
const td = "px-4 py-3 text-sm text-slate-700 align-middle";
const tdRight = td + " text-right tabular-nums";

const RejectPopup = ({ dn, cfg, onClose, onDone }) => {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`${API_BACKEND_URL}/stock/${cfg.act(dn._id)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ ...cfg.no.body, reason: reason.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed");
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal onClose={onClose} title={`${cfg.no.title} · DN-${dn.dnNumber} · ${dn.invoiceNumber}`}>
      <p className="mb-3 text-sm text-slate-600">{cfg.no.hint}</p>
      <label className="mb-1 block text-xs font-semibold text-slate-600">Reason <span className="text-rose-500">*</span></label>
      <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} placeholder="What is wrong with it" />
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50">Cancel</button>
        <button
          type="button" onClick={submit} disabled={busy || !reason.trim()}
          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {busy ? "Saving…" : "Reject"}
        </button>
      </div>
    </Modal>
  );
};

const DebitNoteQueue = ({ mode = "review", canAct = false, onCounts }) => {
  const cfg = MODES[mode];
  const [status, setStatus] = useState(cfg.actionable);
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [busyId, setBusyId] = useState(null);
  const [popup, setPopup] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit), status });
      if (debounced.trim()) params.set("search", debounced.trim());
      const res = await fetch(`${API_BACKEND_URL}/stock/${cfg.list}?${params.toString()}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to load debit notes");
      setRows(json.data?.rows || []);
      setCounts(json.data?.counts || {});
      setTotal(json.pagination?.total || 0);
      onCounts?.(json.data?.counts || {});
    } catch (e) {
      setError(e.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [cfg.list, page, limit, status, debounced, onCounts]);

  useEffect(() => { load(); }, [load]);

  const approve = async (dn) => {
    setBusyId(dn._id); setError(null);
    try {
      const res = await fetch(`${API_BACKEND_URL}/stock/${cfg.act(dn._id)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(cfg.yes.body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed");
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const YesIcon = cfg.yes.icon;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {cfg.statuses.map((s) => {
          const m = dnStatusMeta(s);
          const on = status === s;
          return (
            <button
              key={s} type="button" onClick={() => { setStatus(s); setPage(1); }}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-semibold shadow-sm transition ${
                on ? `ring-2 ${m.chip} ring-offset-0` : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${m.dot}`} />
              {m.label}
              <span className="rounded-full bg-white/70 px-1.5 text-xs tabular-nums">{counts[s] ?? 0}</span>
            </button>
          );
        })}
        {/* Every status at once — the server returns all of them for "ALL". */}
        <button
          type="button" onClick={() => { setStatus("ALL"); setPage(1); }}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-semibold shadow-sm transition ${
            status === "ALL" ? "border-slate-700 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          All
          <span className={`rounded-full px-1.5 text-xs tabular-nums ${status === "ALL" ? "bg-white/20" : "bg-slate-100"}`}>
            {cfg.statuses.reduce((t, k) => t + (counts[k] || 0), 0)}
          </span>
        </button>
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search invoice, vendor or PO…" className={inputCls + " ml-auto max-w-xs"}
        />
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="font-bold">&times;</button>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50/60">
            <tr>
              <th className={th}>Debit Note</th>
              <th className={th}>Invoice</th>
              <th className={th}>Vendor</th>
              <th className={th}>What is claimed</th>
              <th className={thRight}>Amount</th>
              <th className={th}>Raised</th>
              <th className={th}>Status</th>
              <th className={thRight}>Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-400">No debit note here.</td></tr>
            ) : (
              rows.map((d) => {
                const last = (d.history || [])[d.history.length - 1];
                const raised = (d.history || []).find((h) => h.action === "RAISED");
                return (
                  <tr key={d._id} className="transition hover:bg-slate-50/60">
                    <td className={td + " font-semibold text-slate-900"}>DN-{d.dnNumber}</td>
                    <td className={td}>
                      <span className="block font-medium text-slate-900">{d.invoiceNumber}</span>
                      <span className="text-[11px] text-slate-400">{d.poNumber || "—"} · {fmtDate(d.invoiceDate)}</span>
                    </td>
                    <td className={td}>{d.vendorName || "—"}</td>
                    <td className={td}>
                      <span className="block max-w-[260px] truncate" title={(d.lines || []).map((l) => `${l.quantity} × ${l.productName}`).join(", ")}>
                        {(d.lines || []).map((l) => `${l.quantity} × ${l.productName}`).join(", ") || "—"}
                        {(d.extras || []).length ? ` + ${d.extras.length} other` : ""}
                      </span>
                      <span className="block max-w-[260px] truncate text-[11px] text-slate-400" title={d.reason}>{d.reason || ""}</span>
                    </td>
                    <td className={tdRight + " font-semibold text-rose-700"}>−{money(d.amount)}</td>
                    <td className={td}>
                      <span className="block">{raised?.byName || d.createdByName || "—"}</span>
                      <span className="text-[11px] text-slate-400">{fmtDate(raised?.at || d.createdOn)}</span>
                    </td>
                    <td className={td}>
                      <DnChip status={d.status} />
                      {last?.note && d.status !== cfg.actionable && (
                        <span className="mt-0.5 block max-w-[180px] truncate text-[11px] text-slate-400" title={`${last.byName}: ${last.note}`}>
                          {last.note}
                        </span>
                      )}
                    </td>
                    <td className={tdRight}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button" onClick={() => setPopup({ type: "history", dn: d })} title="Full history"
                          className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 shadow-sm transition hover:bg-slate-50"
                        >
                          <History className="h-3.5 w-3.5" />
                        </button>
                        {canAct && d.status === cfg.actionable && (
                          <>
                            <button
                              type="button" onClick={() => setPopup({ type: "reject", dn: d })}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-600 shadow-sm transition hover:bg-rose-50"
                            >
                              <XCircle className="h-3.5 w-3.5" /> {cfg.no.label}
                            </button>
                            <button
                              type="button" onClick={() => approve(d)} disabled={busyId === d._id}
                              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition disabled:opacity-60 ${cfg.yes.tone}`}
                            >
                              <YesIcon className="h-3.5 w-3.5" /> {busyId === d._id ? "Saving…" : cfg.yes.label}
                            </button>
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
        <Pagination
          currentPage={page} totalItems={total} itemsPerPage={limit} onPageChange={setPage}
          onItemsPerPageChange={(n) => { setLimit(n); setPage(1); }}
        />
      </div>

      {popup?.type === "history" && (
        <DebitNoteHistoryPopup
          invoice={{ _id: popup.dn.invoiceId, invoiceNumber: popup.dn.invoiceNumber, vendorName: popup.dn.vendorName }}
          basePath={cfg.historyBase}
          onClose={() => setPopup(null)}
        />
      )}
      {popup?.type === "reject" && (
        <RejectPopup dn={popup.dn} cfg={cfg} onClose={() => setPopup(null)} onDone={() => { setPopup(null); load(); }} />
      )}
    </div>
  );
};

export default DebitNoteQueue;
