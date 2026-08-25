// constants/vendorConstants.js
// No API currently for payment terms / states — frontend constants only,
// same posture as constants/stockFieldOptions.js (Section 11 of the spec).

export const PAYMENT_TERMS = [
  { label: "Immediate Payment", value: "IMMEDIATE" },
  { label: "Payment Within 30 Days", value: "NET_30" },
  { label: "Payment Within 60 Days", value: "NET_60" },
  { label: "Payment Within 90 Days", value: "NET_90" },
];

/*
 FUTURE:
 Replace STATES constant with a State API.
 Keep the same object shape: { [key]: { name, code } }.
 No UI change required — every screen (Vendor details, Address, Bank
 details) reads STATES the same way via buildStateOption().
*/
export const STATES = {
  AN: { name: "Andaman and Nicobar Islands", code: "35" },
  AP: { name: "Andhra Pradesh", code: "37" },
  AR: { name: "Arunachal Pradesh", code: "12" },
  AS: { name: "Assam", code: "18" },
  BR: { name: "Bihar", code: "10" },
  CH: { name: "Chandigarh", code: "04" },
  CG: { name: "Chhattisgarh", code: "22" },
  DN: { name: "Dadra and Nagar Haveli and Daman and Diu", code: "26" },
  DL: { name: "Delhi", code: "07" },
  GA: { name: "Goa", code: "30" },
  GJ: { name: "Gujarat", code: "24" },
  HR: { name: "Haryana", code: "06" },
  HP: { name: "Himachal Pradesh", code: "02" },
  JK: { name: "Jammu and Kashmir", code: "01" },
  JH: { name: "Jharkhand", code: "20" },
  KA: { name: "Karnataka", code: "29" },
  KL: { name: "Kerala", code: "32" },
  LA: { name: "Ladakh", code: "38" },
  LD: { name: "Lakshadweep", code: "31" },
  MP: { name: "Madhya Pradesh", code: "23" },
  MH: { name: "Maharashtra", code: "27" },
  MN: { name: "Manipur", code: "14" },
  ML: { name: "Meghalaya", code: "17" },
  MZ: { name: "Mizoram", code: "15" },
  NL: { name: "Nagaland", code: "13" },
  OD: { name: "Odisha", code: "21" },
  PY: { name: "Puducherry", code: "34" },
  PB: { name: "Punjab", code: "03" },
  RJ: { name: "Rajasthan", code: "08" },
  SK: { name: "Sikkim", code: "11" },
  TN: { name: "Tamil Nadu", code: "33" },
  TS: { name: "Telangana", code: "36" },
  TR: { name: "Tripura", code: "16" },
  UP: { name: "Uttar Pradesh", code: "09" },
  UK: { name: "Uttarakhand", code: "05" },
  WB: { name: "West Bengal", code: "19" },
};

// Returns { key, name, code, label } for a dropdown option, e.g.
// "Haryana (06-HR)" — used identically wherever a state picker appears.
export const buildStateOption = (key) => {
  const s = STATES[key];
  if (!s) return null;
  return { key, name: s.name, code: s.code, label: `${s.name} (${s.code}-${key})` };
};

export const STATE_OPTIONS = Object.keys(STATES).map((key) => buildStateOption(key));

// GST verification now calls the real third-party API through the ERP
// backend — see ./gstVerification.js. It lives in its own module so this
// file stays what its header promises: frontend constants only.
