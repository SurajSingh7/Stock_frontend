/*
  Payment-term labels, in one place.

  These labels were written out twice before this file existed — in
  purchaseOrder/Podetailsview.jsx and vendor/Vendorform.jsx — and a third copy
  was about to be added for the Invoice List. The values themselves are what a
  vendor's `paymentTerms` holds, snapshotted onto the purchase order.

  Only labels live here. How many DAYS each term means is business logic and
  stays on the server (constants/stock.enums.js -> PAYMENT_TERM_DAYS), so a due
  date is never worked out twice in two places and allowed to disagree.
*/
export const PAYMENT_TERM_LABEL = {
  IMMEDIATE: "Immediate Payment",
  NET_30: "Payment Within 30 Days",
  NET_60: "Payment Within 60 Days",
  NET_90: "Payment Within 90 Days",
};

// Short form, for table cells where the full sentence does not fit.
export const PAYMENT_TERM_SHORT = {
  IMMEDIATE: "Immediate",
  NET_30: "Net 30",
  NET_60: "Net 60",
  NET_90: "Net 90",
};

export const paymentTermLabel = (term) => PAYMENT_TERM_LABEL[term] || term || "—";
export const paymentTermShort = (term) => PAYMENT_TERM_SHORT[term] || term || "—";

// The picker options, in the order a user expects to read them.
export const PAYMENT_TERM_OPTIONS = Object.entries(PAYMENT_TERM_LABEL).map(([value, label]) => ({
  value,
  label,
}));
