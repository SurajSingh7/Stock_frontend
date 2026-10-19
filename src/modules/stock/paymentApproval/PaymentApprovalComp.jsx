"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import Pagination from "@/shared/ui/pagination/Pagination";
import { RotateCcw, Eye, Check, X } from "lucide-react";
import { SearchableSelect, Modal, inputCls, money } from "@/modules/stock/shared/StockSharedUI";
import { paymentTermShort, paymentTermLabel } from "@/modules/stock/shared/paymentTerms";
import { APPROVAL_STATUS } from "@/modules/stock/shared/paymentStatus";
import { usePermissions } from "@/context/PermissionContext";
import { ADJUSTMENT_META } from "@/modules/stock/invoiceList/AdjustmentPopups";
import DebitNoteQueue from "@/modules/stock/invoiceList/DebitNoteQueue";

/* ============================================================= */
/* Approvals — the approval team's screen: payments, and debit    */
/* notes that have passed review (their own tab).                 */
/*                                                                */
/* Read and decide, nothing else. This team holds no action that   */
/* can change a payable: they agree to a number accounts computed, */
/* which is why the adjustments below are shown but not editable.  */
/* ============================================================= */

/*
  Three, and only three. This team decides one thing — clear it to pay or send
  it back — so the tabs are the three states of that decision. What happens to
  the money afterwards is the account team's screen, not this one.
*/
const TABS = [
  { key: APPROVAL_STATUS.PENDING, label: "Pending", count: "PENDING", active: "border-amber-600 bg-amber-600" },
  { key: APPROVAL_STATUS.APPROVED, label: "Approved", count: "APPROVED", active: "border-emerald-600 bg-emerald-600" },
  { key: APPROVAL_STATUS.REJECTED, label: "Rejected", count: "REJECTED", active: "border-rose-600 bg-rose-600" },
];

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const th = "px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500";
const thRight = th + " text-right";
const td = "px-4 py-3 text-sm text-slate-700 align-middle";
const tdRight = td + " text-right tabular-nums";

/* ── Decide one request ────────────────────────────────────────── */
/* Shows how the payable got to its number before asking for a     */
/* verdict — approving a bare total without seeing what was taken  */
/* off it is not really a decision.                                 */
const DecisionPopup = ({ row, onClose, onDone }) => {
  const [adjustments, setAdjustments] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  // Read through the approval module own route, not the accounts one: this
  // team does not hold `payments` permissions, so borrowing that endpoint
  // would 403 for exactly the people this screen is for.
  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BACKEND_URL}/stock/payment-approval/${row._id}/adjustments`, { credentials: "include" });
      const json = await res.json();
      // Only what is in the payable: misc charges and APPROVED debit notes.
      // One still in review/approval is not part of this number.
      setAdjustments(
        res.ok && json.success
          ? (json.data || []).filter((a) => a.type !== "DEBIT_NOTE" || !a.status || a.status === "APPROVED")
          : []
      );
    } catch {
      // Non-fatal — the totals above still tell the whole money story.
      setAdjustments([]);
    }
  }, [row._id]);

  useEffect(() => { load(); }, [load]);

  const decide = async (decision) => {
    setBusy(decision); setError(null);
    try {
      const res = await fetch(`${API_BACKEND_URL}/stock/payment-approval/${row._id}/decide`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ decision, reason: reason.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to save");
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  // Every live adjustment is in force — they no longer carry a status of their
  // own, so what is on the invoice is simply what comes back.
  const live = adjustments || [];
  const pendingDecision = row.approvalStatus === APPROVAL_STATUS.PENDING;

  return (
    <Modal onClose={onClose} title={`Payment approval · Invoice ${row.invoiceNumber}`} maxWidth="max-w-2xl">
      {error && (
        <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-100">{error}</div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 px-3 py-3 text-sm sm:grid-cols-4">
        <div>
          <p className="text-xs text-slate-500">Vendor</p>
          <p className="font-medium text-slate-900">{row.vendorName || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">PO number</p>
          <p className="font-medium text-slate-900">{row.poNumber || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Terms</p>
          <p className="font-medium text-slate-900">{paymentTermLabel(row.paymentTerms)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Payable on</p>
          <p className="font-medium text-slate-900">
            {fmtDate(row.scheduledOn)}
            {row.daysLeft < 0 && (
              <span className="ml-1 text-xs font-semibold text-rose-600">{Math.abs(row.daysLeft)}d over</span>
            )}
          </p>
          {/* Both dates, because this team is signing off a payment and
              "we chose to pay this early / late" is part of what they are
              agreeing to. */}
          {row.rescheduled && (
            <p className={`text-xs font-semibold ${row.scheduleOffset < 0 ? "text-amber-600" : "text-violet-600"}`}>
              due {fmtDate(row.dueDate)} · {row.scheduleOffset < 0 ? `${Math.abs(row.scheduleOffset)}d early` : `${row.scheduleOffset}d deferred`}
            </p>
          )}
        </div>
      </div>

      {/* How the number was reached, not just the number. */}
      <div className="mb-4 space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500">Invoice total (incl. GST)</span>
          <span className="tabular-nums text-slate-800">{money(row.grossAmount)}</span>
        </div>
        {row.tdsAmount > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-500">TDS <span className="text-xs text-slate-400">{row.tdsRate}% on basic</span></span>
            <span className="tabular-nums text-amber-700">&minus;{money(row.tdsAmount)}</span>
          </div>
        )}
        {live.map((a) => {
          const meta = ADJUSTMENT_META[a.type] || {};
          return (
            <div key={a._id} className="flex justify-between">
              <span className="text-slate-500">
                {meta.label || a.type}
                <span className="ml-1.5 text-xs text-slate-400">{a.reason || ""}</span>
              </span>
              <span className={`tabular-nums ${a.direction === "DEDUCT" ? "text-rose-600" : "text-sky-600"}`}>
                {a.direction === "DEDUCT" ? "−" : "+"}{money(a.amount)}
              </span>
            </div>
          );
        })}
        <div className="flex justify-between border-t border-slate-200 pt-1.5 text-base">
          <span className="font-semibold text-slate-900">Payable</span>
          <span className="font-bold tabular-nums text-slate-900">{money(row.payable)}</span>
        </div>
        {row.paymentApproval?.payableAtRequest != null &&
          row.paymentApproval.payableAtRequest !== row.payable && (
            <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700 ring-1 ring-inset ring-amber-100">
              This was sent as {money(row.paymentApproval.payableAtRequest)} and now computes to {money(row.payable)}.
            </p>
          )}
      </div>

      {/* A resend: the reason it was sent back, and what accounts say about it. */}
      {(row.paymentApproval?.previousRejectedReason || row.paymentApproval?.sentNote) && (
        <div className="mb-4 space-y-2">
          {row.paymentApproval?.previousRejectedReason && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/60 px-3 py-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-rose-600">
                Sent back earlier{row.paymentApproval.previousRejectedByName ? ` by ${row.paymentApproval.previousRejectedByName}` : ""}
              </p>
              <p className="mt-0.5 text-sm text-rose-900">{row.paymentApproval.previousRejectedReason}</p>
            </div>
          )}
          {row.paymentApproval?.sentNote && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 px-3 py-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-600">
                Note from {row.paymentApproval?.sentByName || "accounts"}
              </p>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-indigo-950">{row.paymentApproval.sentNote}</p>
            </div>
          )}
        </div>
      )}

      <div className="mb-4 text-xs text-slate-500">
        Sent by {row.paymentApproval?.sentByName || "—"} · {fmtDateTime(row.paymentApproval?.sentAt)}
      </div>

      {pendingDecision ? (
        <>
          {/* Required to reject, optional to approve. Rejecting means
              "something on this is wrong", and the person who has to fix it
              cannot act on silence. */}
          <label htmlFor="pa-reason" className="mb-1.5 block text-xs font-semibold text-slate-700">
            Note <span className="font-normal text-slate-400">(required to reject, optional to approve)</span>
          </label>
          <textarea
            id="pa-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="Why this is being sent back…" className={inputCls}
          />

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button" onClick={onClose} disabled={!!busy}
              className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button" onClick={() => decide(APPROVAL_STATUS.REJECTED)} disabled={!!busy || !reason.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3.5 py-2 text-sm font-semibold text-rose-600 shadow-sm transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X className="h-4 w-4" /> {busy === "REJECTED" ? "Saving…" : "Reject"}
            </button>
            <button
              type="button" onClick={() => decide(APPROVAL_STATUS.APPROVED)} disabled={!!busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-60"
            >
              <Check className="h-4 w-4" /> {busy === "APPROVED" ? "Saving…" : "Approve"}
            </button>
          </div>
        </>
      ) : (
        <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
          Already decided by {row.paymentApproval?.reviewedByName || "—"} · {fmtDateTime(row.paymentApproval?.reviewedAt)}
          {row.paymentApproval?.rejectedReason && (
            <p className="mt-1 text-xs text-rose-600">{row.paymentApproval.rejectedReason}</p>
          )}
        </div>
      )}
    </Modal>
  );
};

/* ============================================================= */
/* Main                                                           */
/* ============================================================= */

const PaymentApprovalComp = () => {
  const { permissions, isAdmin } = usePermissions();
  const canApprove = useMemo(() => {
    if (isAdmin) return true;
    const mod = (permissions || []).find((m) => m.moduleKey === "payment-approval");
    return (mod?.actions || []).map((a) => String(a).toUpperCase()).includes("APPROVE");
  }, [permissions, isAdmin]);
  const canApproveDn = useMemo(() => {
    if (isAdmin) return true;
    const mod = (permissions || []).find((m) => m.moduleKey === "payment-approval");
    return (mod?.actions || []).map((a) => String(a).toUpperCase()).includes("APPROVE_DEBIT_NOTE");
  }, [permissions, isAdmin]);

  // Payments, or debit notes waiting on approval.
  const [section, setSection] = useState("payments");
  const [dnCounts, setDnCounts] = useState({});
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BACKEND_URL}/stock/payment-approval-debit-notes?limit=1&status=APPROVAL_PENDING`, { credentials: "include" });
        const j = await r.json();
        if (j.success) setDnCounts(j.data?.counts || {});
      } catch {
        // Non-fatal — the badge just stays empty.
      }
    })();
  }, []);

  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [tab, setTab] = useState(APPROVAL_STATUS.PENDING);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [vendors, setVendors] = useState([]);
  const [deciding, setDeciding] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BACKEND_URL}/stock/vendors?limit=500`, { credentials: "include" });
        const j = await r.json();
        if (j.success) setVendors(j.data || []);
      } catch {
        // Non-fatal — the vendor filter just stays empty.
      }
    })();
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit), approvalStatus: tab });
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (vendorId) params.set("vendorId", vendorId);

      const res = await fetch(`${API_BACKEND_URL}/stock/payment-approval?${params.toString()}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to load");
      setRows(json.data?.rows || []);
      setCounts(json.data?.counts || {});
      setTotal(json.pagination?.total || 0);
    } catch (e) {
      setError(e.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, vendorId, tab]);

  useEffect(() => { loadList(); }, [loadList]);

  const vendorOptions = useMemo(() => vendors.map((v) => ({ value: v._id, label: v.name })), [vendors]);
  const refresh = () => { setDeciding(null); loadList(); };

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Approvals</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Approve or reject what accounts have asked to pay, and debit notes that have passed review.
        </p>
      </div>

      <div className="mb-5 flex gap-1 border-b border-slate-200">
        {[
          { key: "payments", label: "Payments", badge: counts.PENDING },
          { key: "dn", label: "Debit Notes", badge: dnCounts.APPROVAL_PENDING },
        ].map((t) => (
          <button
            key={t.key} type="button" onClick={() => setSection(t.key)}
            className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              section === t.key ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
            {t.badge > 0 && <span className="rounded-full bg-amber-100 px-1.5 text-xs tabular-nums text-amber-700">{t.badge}</span>}
          </button>
        ))}
      </div>

      {section === "dn" ? (
        <DebitNoteQueue mode="approval" canAct={canApproveDn} onCounts={setDnCounts} />
      ) : (
      <>

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="font-bold">&times;</button>
        </div>
      )}

      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoice number, PO number or vendor..." className={inputCls}
            />
          </div>
          <SearchableSelect
            value={vendorId} onChange={(v) => { setVendorId(v); setPage(1); }}
            options={vendorOptions} placeholder="All vendors"
          />
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key} type="button" onClick={() => { setTab(t.key); setPage(1); }}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold shadow-sm transition ${
                active
                  ? `${t.active} text-white`
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {t.label}
              <span className={`rounded-full px-1.5 text-xs tabular-nums ${active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                {counts[t.count] ?? 0}
              </span>
            </button>
          );
        })}
        {(search || vendorId) && (
          <button
            type="button" onClick={() => { setSearch(""); setVendorId(""); setPage(1); }}
            className="ml-auto inline-flex items-center gap-1 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2 text-sm font-semibold text-rose-600 shadow-sm transition hover:bg-rose-100"
          >
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50/60">
            <tr>
              <th className={th}>Invoice</th>
              <th className={th}>Vendor</th>
              <th className={thRight}>Invoice total</th>
              <th className={thRight}>TDS</th>
              <th className={thRight}>Adjust</th>
              <th className={thRight}>Payable</th>
              <th className={th}>Terms</th>
              <th className={th}>Payable On</th>
              <th className={th}>Sent By</th>
              <th className={thRight}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={10} className="px-4 py-12 text-center text-sm text-slate-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-12 text-center text-sm text-slate-400">
                Nothing here with these filters.
              </td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r._id} className="transition hover:bg-slate-50/60">
                  <td className={td}>
                    <span className="block font-semibold text-slate-900">{r.invoiceNumber}</span>
                    <span className="text-[11px] text-slate-400">{r.poNumber || "—"}</span>
                  </td>
                  <td className={td}>{r.vendorName || "—"}</td>
                  <td className={tdRight + " text-slate-500"}>{money(r.grossAmount)}</td>
                  <td className={tdRight}>
                    {r.tdsAmount > 0 ? (
                      <span className="font-semibold text-amber-700" title={`TDS ${r.tdsRate}% on basic`}>
                        &minus;{money(r.tdsAmount)}
                        <span className="ml-1 text-[10px] font-medium text-amber-500">{r.tdsRate}%</span>
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  {/* Broken out because it IS the question: why is the ask not
                      the invoice total. */}
                  <td className={tdRight}>
                    {r.adjustmentTotal === 0 ? (
                      <span className="text-slate-300">—</span>
                    ) : (
                      <span className={`font-semibold ${r.adjustmentTotal < 0 ? "text-rose-600" : "text-sky-600"}`}>
                        {r.adjustmentTotal < 0 ? "−" : "+"}{money(Math.abs(r.adjustmentTotal))}
                      </span>
                    )}
                  </td>
                  <td className={tdRight + " font-semibold text-slate-900"}>{money(r.payable)}</td>
                  <td className={td}>{paymentTermShort(r.paymentTerms)}</td>
                  <td className={td}>
                    <span className="block">{fmtDate(r.scheduledOn)}</span>
                    {r.rescheduled ? (
                      <span className={`text-[11px] font-semibold ${r.scheduleOffset < 0 ? "text-amber-600" : "text-violet-600"}`}>
                        due {fmtDate(r.dueDate)}
                      </span>
                    ) : r.daysLeft < 0 ? (
                      <span className="text-[11px] font-semibold text-rose-600">{Math.abs(r.daysLeft)} days overdue</span>
                    ) : null}
                  </td>
                  <td className={td}>
                    <span className="block">{r.paymentApproval?.sentByName || "—"}</span>
                    <span className="text-[11px] text-slate-400">{fmtDate(r.paymentApproval?.sentAt)}</span>
                    {r.paymentApproval?.previousRejectedReason && (
                      <span className="mt-0.5 block w-fit rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-700 ring-1 ring-inset ring-orange-200">
                        Resent
                      </span>
                    )}
                    {r.paymentApproval?.sentNote && (
                      <span className="mt-0.5 block max-w-[200px] truncate text-[11px] text-indigo-600" title={r.paymentApproval.sentNote}>
                        “{r.paymentApproval.sentNote}”
                      </span>
                    )}
                  </td>
                  <td className={tdRight}>
                    <button
                      type="button" onClick={() => setDeciding(r)}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold shadow-sm transition ${
                        canApprove && r.approvalStatus === APPROVAL_STATUS.PENDING
                          ? "bg-indigo-600 text-white hover:bg-indigo-500"
                          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      {canApprove && r.approvalStatus === APPROVAL_STATUS.PENDING ? "Review" : "View"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <Pagination
          currentPage={page} totalItems={total} itemsPerPage={limit} onPageChange={setPage}
          onItemsPerPageChange={(n) => { setLimit(n); setPage(1); }}
        />
      </div>

      </>
      )}

      {deciding && <DecisionPopup row={deciding} onClose={() => setDeciding(null)} onDone={refresh} />}
    </div>
  );
};

export default PaymentApprovalComp;
