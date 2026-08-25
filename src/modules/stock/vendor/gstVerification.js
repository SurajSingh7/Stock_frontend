// Real GST verification, served by the ERP backend's third-party module
// (POST /third-party/gst/verify) — the very same endpoint erp-sales calls, so
// a GSTIN verified here resolves to identical data and shares the ERP-side
// response cache, rate limiting and audit log.
//
// The request goes through the same-origin /erp-api rewrite (next.config.mjs).
// The ERP backend authenticates it with the same `userSession` cookie this app
// already sets — the proxy forwards it upstream — so no extra token handling
// is needed here.

import { STATE_OPTIONS } from "./vendorConstants";

const GST_VERIFY_URL = "/erp-api/third-party/gst/verify";

const GSTIN_RX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

// A GSTIN encodes its state in the first two digits. That is the authoritative
// source for state/state code — and the ERP payload does not always carry a
// state of its own. Resolving it against STATE_OPTIONS also guarantees the
// name matches the form's dropdown entries exactly.
const stateFromGstin = (gstin) => {
  const stateCode = String(gstin || "").substring(0, 2);
  return { stateCode, state: STATE_OPTIONS.find((s) => s.code === stateCode)?.name || "" };
};

/**
 * Verifies a GSTIN against the third-party GST API and returns the shape
 * VendorForm consumes:
 *   { gstNumber, legalName, tradeName, panNumber, state, stateCode, address, verified }
 * Throws with the server's message when verification fails.
 */
export const verifyGST = async (gstNumber) => {
  const gstin = String(gstNumber || "").trim().toUpperCase();

  if (!GSTIN_RX.test(gstin)) {
    throw new Error("Enter a valid 15-character GST number before verifying");
  }

  const res = await fetch(GST_VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ gstNumber: gstin }),
  });

  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error("GST verification is unavailable right now — please try again");
  }

  if (!res.ok || !json.success) {
    throw new Error(json?.message || "GST verification failed");
  }

  const d = json.data || {};
  const { state, stateCode } = stateFromGstin(d.gstin || gstin);

  return {
    gstNumber: d.gstin || gstin,
    // The ERP side already substitutes legal_name when business_name is "N/A".
    legalName: d.legal_name || d.business_name || "",
    tradeName: d.business_name || d.legal_name || "",
    panNumber: (d.pan_number || gstin.substring(2, 12)).toUpperCase(),
    state: state || d.state || "",
    stateCode,
    address: d.address || "",
    verified: true,
  };
};
