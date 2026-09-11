/*
  Quotation status — the ONE place its on-screen label and colours live, used
  by the quotation list, the approval list and the review/view page so the
  same status always reads the same way. The keys are the backend enum values
  (QUOTATION_STATUS in stock-backend/constants/stock.enums.js); only the
  labels are friendlier.
*/
export const QUOTATION_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  PARTIALLY_APPROVED: "PARTIALLY_APPROVED",
  REJECTED: "REJECTED",
};

export const QUOTATION_STATUS_META = {
  PENDING: { label: "Pending", badge: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500" },
  APPROVED: { label: "Fully Approved", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  PARTIALLY_APPROVED: { label: "Partially Approved", badge: "bg-indigo-50 text-indigo-700 ring-indigo-200", dot: "bg-indigo-500" },
  REJECTED: { label: "Rejected", badge: "bg-rose-50 text-rose-700 ring-rose-200", dot: "bg-rose-500" },
};

export const quotationStatusLabel = (status) => QUOTATION_STATUS_META[status]?.label || status || "—";
