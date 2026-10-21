"use client";

/* Small, shared read-outs for a unit's origin, condition and warranty — used
   by Item Inventory and Opening Stock so both say the same thing the same way. */

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export const SOURCE_LABEL = { PURCHASE: "Invoice", OPENING_STOCK: "Opening Stock" };
export const CONDITION_LABEL = { NEW: "New", USED: "Used" };

const pill = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset";

export const ConditionBadge = ({ condition }) =>
  condition ? (
    <span className={`${pill} ${condition === "NEW" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-700 ring-amber-200"}`}>
      {CONDITION_LABEL[condition] || condition}
    </span>
  ) : null;

export const SourceBadge = ({ source }) =>
  source?.type ? (
    <span className={`${pill} bg-slate-50 text-slate-600 ring-slate-200`} title={source.refNumber}>
      {SOURCE_LABEL[source.type] || source.type}
      {source.refNumber ? <span className="font-mono font-medium text-slate-500">· {source.refNumber}</span> : null}
    </span>
  ) : null;

export const ReservedBadge = ({ heldByNote }) => (
  <span className={`${pill} bg-violet-50 text-violet-700 ring-violet-200`} title="With an employee — not available until assigned">
    Reserved{heldByNote ? ` · ${heldByNote}` : ""}
  </span>
);

// "In warranty till …", "Expired …" or "Unknown" — from the unit's own end date.
export const warrantyState = (endDate) => {
  if (!endDate) return { key: "UNKNOWN", label: "Warranty unknown", cls: "bg-slate-50 text-slate-500 ring-slate-200" };
  const end = new Date(endDate);
  if (end < new Date()) return { key: "EXPIRED", label: `Warranty expired ${fmtDate(end)}`, cls: "bg-rose-50 text-rose-700 ring-rose-200" };
  return { key: "ACTIVE", label: `Warranty till ${fmtDate(end)}`, cls: "bg-sky-50 text-sky-700 ring-sky-200" };
};

export const WarrantyBadge = ({ endDate }) => {
  const w = warrantyState(endDate);
  return <span className={`${pill} ${w.cls}`}>{w.label}</span>;
};

export const AssignedBadge = ({ assignedTo }) => (
  <span className={`${pill} bg-indigo-50 text-indigo-700 ring-indigo-200`} title={assignedTo?.requestNumber || ""}>
    Assigned{assignedTo?.orderId ? ` · ${assignedTo.orderId}` : ""}
  </span>
);
