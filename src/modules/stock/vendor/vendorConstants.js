// constants/vendorConstants.js
// No API currently for payment terms / states — frontend constants only,
// same posture as constants/stockFieldOptions.js (Section 11 of the spec).

export const PAYMENT_TERMS = [
  { label: "Due 30 Days", value: "DUE_30" },
  { label: "Due 60 Days", value: "DUE_60" },
  { label: "Immediate", value: "IMMEDIATE" },
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

/*
 FUTURE GST API INTEGRATION

 Replace mock data with third party GST API.

 Expected API Response:

 {
   gstNumber:"",
   legalName:"",
   tradeName:"",
   panNumber:"",
   state:"",
   stateCode:"",
   address:"",
   verified:true
 }

 After successful verify auto fill:
 - Company Name
 - PAN Number
 - State
 - State Code
 - Address

 IMPORTANT: only replace the body of handleVerifyGST() / mockVerifyGST()
 below with the real API call. No UI changes required in Vendors.jsx or
 VendorForm.jsx — they only consume the shape returned here.
*/
export const mockVerifyGST = async (gstNumber) => {
  await new Promise((resolve) => setTimeout(resolve, 900));

  if (!gstNumber || gstNumber.trim().length < 15) {
    throw new Error("Enter a valid 15-character GST number before verifying");
  }

  return {
    gstNumber: gstNumber.toUpperCase(),
    legalName: "Sample Legal Name Pvt Ltd",
    tradeName: "Sample Trade Name",
    panNumber: gstNumber.toUpperCase().substring(2, 12),
    state: "Haryana",
    stateCode: "06",
    address: "Sample address auto-filled from GST verification",
    verified: true,
  };
};