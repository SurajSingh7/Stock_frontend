/*
  The payment side of an invoice is TWO questions, and the screens show both at
  once — which is only possible because the server keeps them apart.

      approvalStatus   stored     has it been cleared to pay
      paymentState     derived    how much of it has been paid

  One combined field was the original mistake: the moment a part-payment
  landed, "was this ever approved" became unanswerable.

  "Not due" and "Due" live in neither: they are paymentStartDate + termDays
  against today, returned as dueStatus / payableNow.
*/

export const APPROVAL_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
};

export const APPROVAL_STATUS_META = {
  PENDING: {
    label: "Pending",
    chip: "bg-amber-50 text-amber-700 ring-amber-200",
    dot: "bg-amber-500",
    hint: "Waiting on the approval team",
  },
  APPROVED: {
    label: "Approved",
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    dot: "bg-emerald-500",
    hint: "Cleared to pay",
  },
  REJECTED: {
    label: "Rejected",
    chip: "bg-rose-50 text-rose-700 ring-rose-200",
    dot: "bg-rose-500",
    hint: "Sent back — fix the adjustments and send again",
  },
};

// Null is a real state and needs a word: nothing has been asked for yet.
export const approvalMeta = (status) =>
  APPROVAL_STATUS_META[status] || {
    label: "Not sent",
    chip: "bg-slate-50 text-slate-500 ring-slate-200",
    dot: "bg-slate-300",
    hint: "No payment approval has been requested",
  };

export const PAYMENT_STATE = {
  UNPAID: "UNPAID",
  PARTIAL: "PARTIAL",
  PAID: "PAID",
};

export const PAYMENT_STATE_META = {
  UNPAID: { label: "Unpaid", chip: "bg-slate-50 text-slate-600 ring-slate-200", dot: "bg-slate-400" },
  PARTIAL: { label: "Partial Paid", chip: "bg-blue-50 text-blue-700 ring-blue-200", dot: "bg-blue-500" },
  PAID: { label: "Paid", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
};

export const paymentStateMeta = (state) => PAYMENT_STATE_META[state] || PAYMENT_STATE_META.UNPAID;

/*
  Whether the clock has run out. "Payable Now" is what an accounts desk opens
  the screen for, so it is the default everywhere it appears.
*/
export const PAYABLE_FILTER = {
  ALL: "ALL",
  NOW: "NOW",
  LATER: "LATER",
};

export const PAYABLE_OPTIONS = [
  { value: PAYABLE_FILTER.NOW, label: "Payable Now" },
  { value: PAYABLE_FILTER.LATER, label: "Payable Later" },
  { value: PAYABLE_FILTER.ALL, label: "All" },
];

export const PAYMENT_MODES = ["NEFT", "RTGS", "CHEQUE", "CASH", "UPI"];

export const PAYMENT_MODE_LABEL = {
  NEFT: "NEFT",
  RTGS: "RTGS",
  CHEQUE: "Cheque",
  CASH: "Cash",
  UPI: "UPI",
};
