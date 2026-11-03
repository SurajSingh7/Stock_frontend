/*
  Tracking-order status — the ONE place its on-screen name, one-line meaning
  and colours live, used by the Tracking Orders board (card, filter, tracker)
  and the quotation "on order" notice. Keys are the backend enum values
  (TRACKING_STATUS in stock-backend/constants/stock.enums.js).

  `badge`/`dot` = soft ring style (filter dropdown, small chips).
  `pill` = solid fill used on the card header. `border` = the card's top rule.
*/
export const TRACKING_STATUS = {
  ENTITY_PENDING: "ENTITY_PENDING",
  PO_PENDING: "PO_PENDING",
  PO_GENERATED: "PO_GENERATED",
  REJECTED: "REJECTED",
  PO_APPROVED: "PO_APPROVED",
  AWAITING_DELIVERY: "AWAITING_DELIVERY",
  PARTLY_RECEIVED: "PARTLY_RECEIVED",
  FULLY_RECEIVED: "FULLY_RECEIVED",
  CLOSED_SHORT: "CLOSED_SHORT",
  NOT_REQUIRED: "NOT_REQUIRED",
};

export const TRACKING_STATUS_META = {
  ENTITY_PENDING: {
    label: "Entity Pending", hint: "Waiting for the buying entity to be chosen",
    badge: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500", border: "border-l-amber-400", pill: "bg-amber-500 text-white",
  },
  PO_PENDING: {
    label: "PO Pending", hint: "Entity chosen — the PO is still to be made",
    badge: "bg-orange-50 text-orange-700 ring-orange-200", dot: "bg-orange-500", border: "border-l-orange-400", pill: "bg-orange-500 text-white",
  },
  PO_GENERATED: {
    label: "PO Generated", hint: "PO made, waiting for approval",
    badge: "bg-sky-50 text-sky-700 ring-sky-200", dot: "bg-sky-500", border: "border-l-sky-400", pill: "bg-sky-500 text-white",
  },
  REJECTED: {
    label: "PO Rejected", hint: "The PO was rejected at approval",
    badge: "bg-rose-50 text-rose-700 ring-rose-200", dot: "bg-rose-500", border: "border-l-rose-400", pill: "bg-rose-500 text-white",
  },
  PO_APPROVED: {
    label: "PO Approved", hint: "PO approved and sent to the vendor",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500", border: "border-l-emerald-400", pill: "bg-emerald-500 text-white",
  },
  AWAITING_DELIVERY: {
    label: "Awaiting Delivery", hint: "PO approved, nothing received yet",
    badge: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500", border: "border-l-amber-400", pill: "bg-amber-500 text-white",
  },
  PARTLY_RECEIVED: {
    label: "Partly Received", hint: "Some received, the rest still due",
    badge: "bg-yellow-50 text-yellow-700 ring-yellow-200", dot: "bg-yellow-500", border: "border-l-yellow-400", pill: "bg-yellow-500 text-white",
  },
  FULLY_RECEIVED: {
    label: "Fully Received", hint: "Everything ordered has arrived",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500", border: "border-l-emerald-400", pill: "bg-emerald-500 text-white",
  },
  // Violet, not emerald: both are end states, but this one did not get
  // everything that was ordered and should not read as a success.
  CLOSED_SHORT: {
    label: "Closed Short", hint: "Closed early — the balance will not come",
    badge: "bg-violet-50 text-violet-700 ring-violet-200", dot: "bg-violet-500", border: "border-l-violet-400", pill: "bg-violet-500 text-white",
  },
  NOT_REQUIRED: {
    label: "Skipped", hint: "This vendor's whole order was skipped",
    badge: "bg-slate-100 text-slate-500 ring-slate-200", dot: "bg-slate-400", border: "border-l-slate-300", pill: "bg-slate-400 text-white",
  },
};

export const trackingStatusLabel = (status) => TRACKING_STATUS_META[status]?.label || status || "—";
