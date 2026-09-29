/*
  WHERE an outstanding amount is stuck — which is a different question from
  how old it is, and the one the ledger could not answer.

  Rejecting a payment approval does not cancel a debt: the vendor still billed
  us, so a rejected invoice stays in the ledger and keeps counting towards
  what we owe. Dropping it would make outstanding fall the moment somebody
  rejected something. But a total with no explanation is why a rejected
  invoice looked identical to one about to be paid — so the same money is also
  split by the stage its payment has reached.

  Mirrors OUTSTANDING_STAGE in stock.vendor.ledger.service.js. The server
  decides the stage; this file only names and colours it.
*/

export const OUTSTANDING_STAGE = {
  NOT_SENT: "NOT_SENT",
  IN_APPROVAL: "IN_APPROVAL",
  REJECTED: "REJECTED",
  CLEARED: "CLEARED",
};

// Read in the order money travels, so the strip tells the story left to right.
export const STAGE_ORDER = [
  OUTSTANDING_STAGE.NOT_SENT,
  OUTSTANDING_STAGE.IN_APPROVAL,
  OUTSTANDING_STAGE.REJECTED,
  OUTSTANDING_STAGE.CLEARED,
];

/*
  The labels name the state of the REQUEST, never the team holding it.

  An earlier draft read "Stock Team" and "Approval Team", which was wrong: the
  moment that work is reassigned the label lies, and nothing in the data says
  which department does what. A status describes the thing, not the room it is
  sitting in.

  Only the labels changed — the keys below and in the service are untouched, so
  nothing stored has to move.
*/
export const STAGE_META = {
  NOT_SENT: {
    label: "Not Requested",
    short: "not requested",
    hint: "No payment approval has been requested for this invoice yet",
    chip: "bg-slate-100 text-slate-600 ring-slate-200",
    tile: "border-slate-200 bg-white text-slate-700",
  },
  IN_APPROVAL: {
    label: "Awaiting Approval",
    short: "awaiting",
    hint: "Requested, and waiting on a decision",
    chip: "bg-amber-50 text-amber-700 ring-amber-200",
    tile: "border-amber-200 bg-amber-50 text-amber-800",
  },
  REJECTED: {
    label: "Rejected",
    short: "rejected",
    hint: "Sent back — the credit notes or charges need fixing before it can go again. The money is still owed.",
    chip: "bg-rose-50 text-rose-700 ring-rose-200",
    tile: "border-rose-300 bg-rose-50 text-rose-800",
  },
  /*
    "Cleared to Pay", not "Approved": an invoice has its own APPROVED status
    for the goods it covers, and one word meaning two things on one screen is
    how a reader stops trusting either.
  */
  CLEARED: {
    label: "Cleared to Pay",
    short: "to pay",
    hint: "Approved — the money has not gone out yet",
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    tile: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
};

export const stageMeta = (key) =>
  STAGE_META[key] || {
    label: key || "—",
    short: key || "—",
    hint: "",
    chip: "bg-slate-100 text-slate-600 ring-slate-200",
    tile: "border-slate-200 bg-white text-slate-700",
  };

/*
  Whether money has actually moved on an invoice.

  Offered as a FILTER, not as the ledger's only reality. Hiding every unpaid
  invoice would make outstanding always zero and the ageing buckets always
  empty — the one number this page exists to produce could never be shown.
*/
export const MOVEMENT_FILTER = {
  ALL: "ALL",
  MOVED: "MOVED",
  NONE: "NONE",
};

export const MOVEMENT_OPTIONS = [
  { value: MOVEMENT_FILTER.ALL, label: "All invoices" },
  { value: MOVEMENT_FILTER.MOVED, label: "Where money has moved" },
  { value: MOVEMENT_FILTER.NONE, label: "Nothing paid yet" },
];

/* Non-zero stages only, ready to render. An empty strip is the correct answer
   for a vendor who owes nothing. The count rides along because "rejected
   45,000" and "rejected 45,000 across 3 invoices" are different problems. */
export const stageBreakdown = (outstandingBy = {}, stageCount = {}) =>
  STAGE_ORDER
    .filter((k) => (outstandingBy[k] || 0) > 0)
    .map((k) => ({
      key: k,
      amount: outstandingBy[k],
      count: stageCount[k] || 0,
      ...stageMeta(k),
    }));
