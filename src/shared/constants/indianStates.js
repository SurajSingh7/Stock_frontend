// shared/constants/indianStates.js
// The single Indian-state list for the whole app: state name, its 2-digit GST
// state code, and the 2-letter key. Every screen with a state picker (vendor
// GST/address/bank details, branch master) reads it from here so the code a
// user sees can never disagree between two modules.
//
// FUTURE:
// Replace STATES with a State API. Keep the same object shape:
// { [key]: { name, code } } — no UI change required, since every screen
// reads it through buildStateOption()/STATE_OPTIONS.

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

// For screens that persist the state flat (name + code) instead of the whole
// { key, name, code } object — branch master, and anything modelled on the
// purchase/tracking order buyer entity. Matches on name first, then on code,
// so a record saved before the picker existed still rehydrates its dropdown.
export const findStateOption = ({ name, code } = {}) => {
  const wantedName = String(name || "").trim().toLowerCase();
  const wantedCode = String(code || "").trim();
  return (
    STATE_OPTIONS.find((s) => wantedName && s.name.toLowerCase() === wantedName) ||
    STATE_OPTIONS.find((s) => wantedCode && s.code === wantedCode) ||
    null
  );
};
