"use client";

/* Read-outs shared by the store's Item Requests screens and the test simulator,
   so both describe a request the same way. */

import { unitLabel, inputCls } from "@/modules/stock/shared/StockSharedUI";

export const REQUEST_STATUS = {
  PENDING: { label: "Pending", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  PARTIAL: { label: "Partial", cls: "bg-sky-50 text-sky-700 ring-sky-200" },
  COMPLETED: { label: "Completed", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  PARTIALLY_CLOSED: { label: "Partially Closed", cls: "bg-slate-100 text-slate-700 ring-slate-300" },
  REJECTED: { label: "Rejected", cls: "bg-rose-50 text-rose-700 ring-rose-200" },
  WITHDRAWN: { label: "Withdrawn", cls: "bg-zinc-100 text-zinc-600 ring-zinc-300" },
};

export const REQUEST_STATUS_TABS = ["PENDING", "PARTIAL", "COMPLETED", "PARTIALLY_CLOSED", "REJECTED", "WITHDRAWN"];

export const RequestStatusBadge = ({ status }) => {
  const s = REQUEST_STATUS[status] || { label: status, cls: "bg-slate-50 text-slate-600 ring-slate-200" };
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${s.cls}`}>{s.label}</span>;
};

export const fmtQty = (n) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000));

// One outgoing line of a request — see ITEM_REQUEST_LINE_STATUS on the server.
export const LINE_STATUS = {
  PENDING: { label: "Pending", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  PARTIAL: { label: "Partial", cls: "bg-sky-50 text-sky-700 ring-sky-200" },
  DONE: { label: "Done", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  CLOSED: { label: "Closed", cls: "bg-slate-100 text-slate-600 ring-slate-300" },
};

export const LineStatusBadge = ({ status }) => {
  const s = LINE_STATUS[status] || LINE_STATUS.PENDING;
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${s.cls}`}>{s.label}</span>;
};

// One row of a REPLACE — an old item and the new one in its place.
export const SWAP_STATUS = {
  PENDING: { label: "Old item due", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  RECEIVED: { label: "Received — give new", cls: "bg-sky-50 text-sky-700 ring-sky-200" },
  PARTIAL: { label: "Part replaced", cls: "bg-sky-50 text-sky-700 ring-sky-200" },
  REPLACED: { label: "Replaced", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  CLOSED: { label: "Closed", cls: "bg-slate-100 text-slate-600 ring-slate-300" },
};

export const SwapStatusBadge = ({ status }) => {
  const s = SWAP_STATUS[status] || SWAP_STATUS.PENDING;
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${s.cls}`}>{s.label}</span>;
};

// The rows of a REPLACE: each old item with its outgoing line and the new
// unit(s) given on it. Works on the store and the requester shape alike.
export const replaceRows = (r) =>
  (r.returnLines || []).map((old) => {
    const line = (r.lines || []).find((l) => String(l.returnLineId) === String(old._id)) || null;
    const given = (r.issues || []).flatMap((i) =>
      (i.lines || [])
        .filter((l) => line && String(l.requestLineId) === String(line._id))
        .flatMap((l) => (l.units || []).map((u) => (typeof u === "string" ? u : u.quantity ? `${u.label} (${fmtQty(u.quantity)})` : u.label)))
    );
    return { old, line, given };
  });

/* Why a return / replace was sent — the codes the server takes (see RETURN_REASON / REPLACE_REASON). */
export const RETURN_REASONS = {
  CONNECTION_CLOSED: "Connection Closed",
  SHIFTING: "Shifting / Relocation",
  SERVICE_CHANGE: "Service Change",
  NOT_NEEDED: "Not Needed / Extra",
  WRONG_ITEM: "Wrong Item Given",
  OTHER: "Other",
};
export const REPLACE_REASONS = { NOT_WORKING: "Not Working", INTERMITTENT: "Intermittent Problem", DAMAGED: "Physically Damaged", OTHER: "Other" };

export const reasonLabel = (type, reason) => {
  if (!reason?.code) return "";
  const label = (type === "REPLACE" ? REPLACE_REASONS : RETURN_REASONS)[reason.code] || reason.code;
  return reason.note ? `${label} — ${reason.note}` : label;
};

export const ReasonChip = ({ type, reason }) =>
  reason?.code ? (
    <span className="inline-flex max-w-full truncate rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200" title={reasonLabel(type, reason)}>
      {reasonLabel(type, reason)}
    </span>
  ) : null;

/* ============================================================= */
/* How a unit came back, as the store checks it — the same two   */
/* choices as Opening Stock: Condition and Working State.        */
/* value: { itemCondition: NEW|USED, workingState, note }        */
/* ============================================================= */
export const WORKING_STATES = { WORKING: "Working", FAULTY: "Faulty (Repairable)", BEYOND_REPAIR: "Beyond Repair (Dead)" };
export const emptyReturnState = () => ({ itemCondition: "USED", workingState: "WORKING", note: "" });
export const returnStateOk = (s) => s.workingState === "WORKING" || !!s.note.trim();
export const returnStateBody = (s) => ({ itemCondition: s.itemCondition, workingState: s.workingState, note: s.note.trim() });

export const ReturnStateFields = ({ value, onChange, compact = false }) => {
  const set = (patch) => onChange({ ...value, ...patch });
  const lbl = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500";
  return (
    <div className={compact ? "flex flex-wrap items-start gap-2" : ""}>
      <div className={compact ? "flex flex-wrap gap-2" : "grid grid-cols-2 gap-3"}>
        <label className={compact ? "w-32" : ""}>
          {!compact && <span className={lbl}>Condition</span>}
          <select value={value.itemCondition} onChange={(e) => set({ itemCondition: e.target.value })} className={inputCls} title="Condition">
            <option value="USED">Used</option>
            <option value="NEW">New (unused)</option>
          </select>
        </label>
        <label className={compact ? "w-48" : ""}>
          {!compact && <span className={lbl}>Working State</span>}
          <select
            value={value.workingState}
            onChange={(e) => set({ workingState: e.target.value })}
            title="Working State"
            className={`${inputCls} ${value.workingState === "FAULTY" ? "border-amber-300 bg-amber-50" : value.workingState === "BEYOND_REPAIR" ? "border-rose-300 bg-rose-50" : ""}`}
          >
            {Object.entries(WORKING_STATES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </div>
      <div className={compact ? "min-w-40 flex-1" : "mt-2"}>
        <input
          value={value.note}
          onChange={(e) => set({ note: e.target.value })}
          placeholder={value.workingState === "WORKING" ? "Note (optional)" : "Fault / reason *"}
          className={`${inputCls} ${!returnStateOk(value) ? "border-rose-300" : ""}`}
        />
        {value.workingState === "FAULTY" && <p className="mt-0.5 text-[11px] font-medium text-amber-700">Goes to Repair &amp; Warranty</p>}
        {value.workingState === "BEYOND_REPAIR" && <p className="mt-0.5 text-[11px] font-medium text-rose-700">Kept on record as scrapped — never stock again</p>}
        {value.workingState === "WORKING" && !compact && <p className="mt-0.5 text-[11px] text-slate-500">Back on the shelf as {value.itemCondition === "NEW" ? "New" : "Used"}</p>}
      </div>
    </div>
  );
};

// A receipt line's state: "Working · New", or the old Good / Faulty.
export const ReturnStateBadge = ({ line }) => {
  const ws = line.workingState || (line.condition === "GOOD" ? "WORKING" : "FAULTY");
  const cls = ws === "WORKING" ? "bg-emerald-50 text-emerald-700" : ws === "FAULTY" ? "bg-amber-50 text-amber-800" : "bg-rose-50 text-rose-700";
  const name = ws === "WORKING" ? "Working" : ws === "FAULTY" ? "Faulty" : "Beyond Repair";
  return (
    <span className={`rounded px-1.5 text-[11px] font-semibold ${cls}`}>
      {name}{line.itemCondition ? ` · ${line.itemCondition === "NEW" ? "New" : "Used"}` : ""}
    </span>
  );
};

// "3" for units, "50 Meter" for a batch line.
export const lineQty = (n, line) => `${fmtQty(n || 0)}${line?.trackingMethod === "quantity" ? ` ${unitLabel(line.unit)}` : ""}`;

export const REQUEST_TYPE = {
  ISSUE: { label: "Issue", cls: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
  RETURN: { label: "Return", cls: "bg-teal-50 text-teal-700 ring-teal-200" },
  REPLACE: { label: "Replace", cls: "bg-orange-50 text-orange-700 ring-orange-200" },
};

export const RequestTypeBadge = ({ type }) => {
  const t = REQUEST_TYPE[type || "ISSUE"] || REQUEST_TYPE.ISSUE;
  return <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1 ring-inset ${t.cls}`}>{t.label}</span>;
};

export const hasIssueSide = (type) => !type || type === "ISSUE" || type === "REPLACE";
export const hasReturnSide = (type) => type === "RETURN" || type === "REPLACE";

// The one-line "what is this request" for lists.
export const requestSummary = (r) =>
  hasReturnSide(r.type)
    ? (r.returnLines || []).map((l) => l.label || l.productName).join(", ")
    : (r.lines || []).map((l) => `${l.categoryPath} ×${lineQty(l.requestedQty, l)}`).join(", ");

// "2 / 5" with a bar — how much of a request has been handed over.
export const IssuedProgress = ({ issued, requested }) => {
  const pct = requested > 0 ? Math.min(100, Math.round((issued / requested) * 100)) : 0;
  return (
    <div className="min-w-24">
      <p className="text-sm tabular-nums text-slate-800">
        <span className="font-semibold">{fmtQty(issued || 0)}</span>
        <span className="text-slate-400"> / {fmtQty(requested || 0)}</span>
      </p>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${pct >= 100 ? "bg-emerald-500" : "bg-indigo-500"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

export const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const HISTORY_LABEL = {
  CREATED: "Request raised",
  ISSUED: "Items issued",
  RECEIVED: "Items received back",
  REPLACED: "Item replaced",
  COMPLETED: "Completed",
  LINE_CLOSED: "Item closed",
  CLOSED: "Closed — some items short",
  SHORT_CLOSED: "Short-closed",
  REJECTED: "Rejected",
  RESENT: "Edited and sent again",
  WITHDRAWN: "Withdrawn by the requester",
};

export const RequestHistory = ({ history = [] }) => (
  <ol className="relative ml-2 space-y-3 border-l border-slate-200 pl-5">
    {history.map((h, i) => (
      <li key={i} className="relative">
        <span
          className={`absolute -left-6.75 top-1 h-3 w-3 rounded-full ring-4 ${
            h.action === "REJECTED" ? "bg-rose-500 ring-rose-50" : h.action === "COMPLETED" ? "bg-emerald-500 ring-emerald-50" : "bg-indigo-500 ring-indigo-50"
          }`}
        />
        <p className="text-xs text-slate-400">
          {fmtDateTime(h.at)}
          {h.byName ? ` · ${h.byName}` : ""}
        </p>
        <p className="text-sm font-medium text-slate-800">{HISTORY_LABEL[h.action] || h.action}</p>
        {h.note && <p className="text-xs text-slate-500">{h.note}</p>}
      </li>
    ))}
  </ol>
);
