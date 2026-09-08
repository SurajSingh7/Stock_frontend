// constants/vendorConstants.js
// No API currently for payment terms — frontend constants only, same posture
// as constants/stockFieldOptions.js (Section 11 of the spec).

export const PAYMENT_TERMS = [
  { label: "Immediate Payment", value: "IMMEDIATE" },
  { label: "Payment Within 30 Days", value: "NET_30" },
  { label: "Payment Within 60 Days", value: "NET_60" },
  { label: "Payment Within 90 Days", value: "NET_90" },
];

// The state list moved to shared/constants/indianStates.js once the branch
// master grew its own state picker — one list, so the GST state code a user
// sees on a vendor and on a branch can never drift apart.
export { STATES, buildStateOption, STATE_OPTIONS } from "@/shared/constants/indianStates";

// GST verification calls the real third-party API through the ERP
// backend — see ./gstVerification.js. It lives in its own module so this
// file stays what its header promises: frontend constants only.
