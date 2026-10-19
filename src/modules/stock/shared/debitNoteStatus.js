/*
  A debit note's chain, named and coloured once for every screen.

  Mirrors DEBIT_NOTE_STATUS in the backend. Named for the STEP, never the team
  doing it — who reviews or approves is a permission, not a status.
*/
export const DN_STATUS = {
  REVIEW_PENDING: "REVIEW_PENDING",
  REVIEW_REJECTED: "REVIEW_REJECTED",
  APPROVAL_PENDING: "APPROVAL_PENDING",
  APPROVED: "APPROVED",
  APPROVAL_REJECTED: "APPROVAL_REJECTED",
  WITHDRAWN: "WITHDRAWN",
};

export const DN_STATUS_META = {
  REVIEW_PENDING: {
    label: "Review Pending",
    chip: "bg-violet-50 text-violet-700 ring-violet-200",
    dot: "bg-violet-500",
    hint: "Submitted — waiting to be reviewed",
  },
  REVIEW_REJECTED: {
    label: "Review Rejected",
    chip: "bg-orange-50 text-orange-700 ring-orange-200",
    dot: "bg-orange-500",
    hint: "Sent back in review — edit and resubmit, or withdraw",
  },
  APPROVAL_PENDING: {
    label: "Approval Pending",
    chip: "bg-amber-50 text-amber-700 ring-amber-200",
    dot: "bg-amber-500",
    hint: "Reviewed — waiting on approval",
  },
  APPROVED: {
    label: "Approved",
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    dot: "bg-emerald-500",
    hint: "Approved — taken off the payable",
  },
  APPROVAL_REJECTED: {
    label: "Approval Rejected",
    chip: "bg-rose-50 text-rose-700 ring-rose-200",
    dot: "bg-rose-500",
    hint: "Rejected in approval — final. Raise a new debit note if one is still needed",
  },
  WITHDRAWN: {
    label: "Withdrawn",
    chip: "bg-slate-100 text-slate-500 ring-slate-200",
    dot: "bg-slate-400",
    hint: "Withdrawn by whoever raised it",
  },
};

export const dnStatusMeta = (s) => DN_STATUS_META[s] || DN_STATUS_META.APPROVED;

// What each history step reads as.
export const DN_ACTION_LABEL = {
  RAISED: "Raised",
  RESUBMITTED: "Edited & resubmitted",
  REVIEW_REJECTED: "Rejected in review",
  SENT_FOR_APPROVAL: "Sent for approval",
  APPROVED: "Approved",
  APPROVAL_REJECTED: "Rejected in approval",
  WITHDRAWN: "Withdrawn",
};
