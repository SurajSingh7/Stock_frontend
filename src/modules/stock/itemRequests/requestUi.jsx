"use client";

/* Read-outs shared by the store's Item Requests screens and the test simulator,
   so both describe a request the same way. */

export const REQUEST_STATUS = {
  PENDING: { label: "Pending", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  PARTIAL: { label: "Partial", cls: "bg-sky-50 text-sky-700 ring-sky-200" },
  COMPLETED: { label: "Completed", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  PARTIALLY_CLOSED: { label: "Partially Closed", cls: "bg-slate-100 text-slate-700 ring-slate-300" },
  REJECTED: { label: "Rejected", cls: "bg-rose-50 text-rose-700 ring-rose-200" },
};

export const REQUEST_STATUS_TABS = ["PENDING", "PARTIAL", "COMPLETED", "PARTIALLY_CLOSED", "REJECTED"];

export const RequestStatusBadge = ({ status }) => {
  const s = REQUEST_STATUS[status] || { label: status, cls: "bg-slate-50 text-slate-600 ring-slate-200" };
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${s.cls}`}>{s.label}</span>;
};

export const fmtQty = (n) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000));

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
  COMPLETED: "Completed",
  SHORT_CLOSED: "Short-closed",
  REJECTED: "Rejected",
  RESENT: "Edited and sent again",
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
