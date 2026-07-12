"use client";

import React, { useState, useEffect } from "react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";

const INTERNAL_COMPANIES_URL =
  "https://gist.githubusercontent.com/SurajSingh7/ac8ffea18746e9fea058db22054bd3f3/raw/internal-companies.json";
const SHIPMENT_PREFERENCE_OPTIONS = [
  "Self Pickup", "Vendor Delivery", "Courier", "Transport", "Third-Party Logistics", "Hand Delivery",
];
const DEFAULT_TERMS =
  "1. Goods once sold will not be taken back.\n2. Delivery within the committed date.\n3. Payment as per agreed terms.";

/* =============================================================
   LOCK_CHECKBOX
   true  → every item is LOCKED on the PO (checkbox shown checked +
           disabled with a lock icon; no skip, no skip-reason input)
   false → original behavior (uncheck = permanent skip, reason required)
   ============================================================= */
const LOCK_CHECKBOX = true;

const money = (n) =>
  `\u20B9${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const leafOf = (c) => String(c || "").split("/").pop().trim();
const todayStr = () => {
  const d = new Date();
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/* ---------- shared class tokens ---------- */
const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition duration-200 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";
const labelCls = "mb-1.5 block text-xs font-semibold text-slate-700";

/* ---------- inline icons ---------- */
const IconArrowLeft = () => (
  <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
    <path d="M12.5 15 7.5 10l5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconEye = () => (
  <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
    <path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10Z" stroke="currentColor" strokeWidth="1.4" />
    <circle cx="10" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.4" />
  </svg>
);
const IconLock = () => (
  <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
    <rect x="4.5" y="9" width="11" height="8" rx="1.8" stroke="currentColor" strokeWidth="1.5" />
    <path d="M7 9V6.5a3 3 0 0 1 6 0V9" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);
const IconX = () => (
  <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
    <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const POCreateView = ({ mode = "create", context = {}, onBack, onDone }) => {
  const isEdit = mode === "edit";
  const { sourceQuotationId, vendorId, vendorName, vendorStateCode, poId } = context;

  const [entities, setEntities] = useState([]);
  const [alias, setAlias] = useState("");
  const [entityId, setEntityId] = useState(""); // resolved alias+state record
  const [requester, setRequester] = useState("Suraj");
  const [poDate, setPoDate] = useState(todayStr());
  const [shipment, setShipment] = useState(SHIPMENT_PREFERENCE_OPTIONS[1]);
  const [terms, setTerms] = useState(DEFAULT_TERMS);
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState(
    (context.items || []).map((it) => ({ ...it, checked: true, reason: "" }))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [openPath, setOpenPath] = useState(null);

  // distinct parent aliases
  const aliases = [...new Set(entities.map((e) => e.alias).filter(Boolean))];
  // states available for the chosen alias
  const statesForAlias = entities.filter((e) => e.alias === alias);
  const selectedEntity = entities.find((e) => String(e._id) === String(entityId)) || null;
  const sameState = selectedEntity && String(selectedEntity.stateCode) === String(vendorStateCode);

  /* -----------------------------------------------------------
     DISPLAY-ONLY tax math (Section 20 #6 — the backend always
     recomputes the real totals server-side from the snapshot;
     this preview just mirrors that GST-split rule in the UI).
     taxType: same state  → CGST_SGST (gstRate split in half)
              diff state  → IGST      (full gstRate)
     ----------------------------------------------------------- */
  const taxType = selectedEntity ? (sameState ? "CGST_SGST" : "IGST") : null;

  const calc = (r) => {
    const base = Number(r.quantity || 0) * Number(r.unitPrice || 0);
    const gst = (base * Number(r.gstRate || 0)) / 100;
    return {
      base,
      gst,
      cgst: gst / 2,
      sgst: gst / 2,
      igst: gst,
      total: base + gst,
    };
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(INTERNAL_COMPANIES_URL);
        const json = await res.json();
        const list = (json.data || []).filter((e) => e.isActive !== false && e.isShownOnDropDown !== false);
        setEntities(list);

        if (isEdit) {
          const poRes = await fetch(`${API_BACKEND_URL}/stock/purchase-orders/${poId}`, { credentials: "include" });
          const poJson = await poRes.json();
          const po = poJson.data;
          setRows(
            (po.items || []).map((it) => ({
              quotationItemId: it.quotationItemId, categoryName: it.categoryName, productName: it.productName,
              quantity: it.quantity, unitPrice: it.unitPrice, gstRate: it.gstRate, lineTotal: it.lineTotal,
              checked: true, reason: "",
            }))
          );
          setRequester(po.requester || "Suraj");
          if (po.poDate) setPoDate(new Date(po.poDate).toISOString().slice(0, 10));
          setShipment(po.shipmentPreference || SHIPMENT_PREFERENCE_OPTIONS[1]);
          setTerms(po.terms || DEFAULT_TERMS);
          setNotes(po.notes || "");
          const match =
            list.find((e) => String(e._id) === String(po.buyerEntity?.entityId)) ||
            list.find((e) => e.alias === po.buyerEntity?.alias && String(e.stateCode) === String(po.buyerEntity?.stateCode));
          if (match) { setAlias(match.alias); setEntityId(String(match._id)); }
        } else {
          // default: match vendor state → its alias + that state record
          const match = list.find((e) => String(e.stateCode) === String(vendorStateCode)) || list[0];
          if (match) { setAlias(match.alias); setEntityId(String(match._id)); }
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [isEdit, poId, vendorStateCode]);

  // when alias changes, snap state to vendor-state match within that alias, else first
  const onAliasChange = (a) => {
    setAlias(a);
    const list = entities.filter((e) => e.alias === a);
    const match = list.find((e) => String(e.stateCode) === String(vendorStateCode)) || list[0];
    setEntityId(match ? String(match._id) : "");
  };

  // when LOCK_CHECKBOX is on, items can never be toggled off
  const toggle = (id) => {
    if (LOCK_CHECKBOX) return;
    setRows((p) => p.map((r) => (String(r.quotationItemId) === String(id) ? { ...r, checked: !r.checked } : r)));
  };
  const setReason = (id, val) => setRows((p) => p.map((r) => (String(r.quotationItemId) === String(id) ? { ...r, reason: val } : r)));

  const checked = rows.filter((r) => r.checked);
  const unchecked = rows.filter((r) => !r.checked);

  // order summary (checked items only) — display-only preview
  const summary = checked.reduce(
    (acc, r) => {
      const c = calc(r);
      acc.base += c.base; acc.cgst += c.cgst; acc.sgst += c.sgst; acc.igst += c.igst; acc.total += c.total;
      return acc;
    },
    { base: 0, cgst: 0, sgst: 0, igst: 0, total: 0 }
  );

  const entityPayload = () =>
    selectedEntity
      ? {
        entityId: selectedEntity._id, name: selectedEntity.name, alias: selectedEntity.alias,
        gstNumber: selectedEntity.gstNumber, address: selectedEntity.address,
        state: selectedEntity.state, stateCode: selectedEntity.stateCode,
      }
      : null;

  const submit = async () => {
    if (!selectedEntity) return setError("Select entity and state");
    if (!isEdit) {
      if (checked.length === 0) return setError("Select at least one item for the PO");
      if (unchecked.some((r) => !r.reason.trim())) return setError("Give a reason for every unchecked (skipped) item");
    }
    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        const res = await fetch(`${API_BACKEND_URL}/stock/purchase-orders/${poId}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
          body: JSON.stringify({ buyerEntity: entityPayload(), requester, poDate, shipmentPreference: shipment, terms, notes }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message || "Failed to update PO");
      } else {
        const res = await fetch(`${API_BACKEND_URL}/stock/purchase-orders`, {
          method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
          body: JSON.stringify({
            sourceQuotationId, vendorId,
            quotationItemIds: checked.map((r) => r.quotationItemId),
            skippedItems: unchecked.map((r) => ({ itemId: r.quotationItemId, reason: r.reason.trim() })),
            buyerEntity: entityPayload(), requester, poDate, shipmentPreference: shipment, terms, notes,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message || "Failed to create PO");
      }
      onDone();
    } catch (err) {
      setError(err.message);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6 pb-12">
      {/* header */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button
          type="button" onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition duration-200 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
        >
          <IconArrowLeft /> Back
        </button>
        <div className="min-w-0">
          <h1 className="text-lg font-bold tracking-tight text-slate-900">
            {isEdit ? "Edit purchase order" : "Create purchase order"}
          </h1>
          <p className="truncate text-sm text-slate-500">Supplier · {vendorName || "\u2014"}</p>
        </div>
        <span className={`ml-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${isEdit ? "border-red-200 bg-red-50 text-red-700" : "border-orange-200 bg-orange-50 text-orange-700"
          }`}>
          <span className={`h-1.5 w-1.5 rounded-full ${isEdit ? "bg-red-500" : "bg-orange-500"}`} />
          {isEdit ? "Rejected · editing" : "PO creation pending"}
        </span>
      </div>

      {error && (
        <div className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="shrink-0 rounded p-0.5 text-red-400 transition duration-200 hover:text-red-700">
            <IconX />
          </button>
        </div>
      )}

      {/* buyer entity */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-700">Buyer entity</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Entity</label>
            <select value={alias} onChange={(e) => onAliasChange(e.target.value)} className={inputCls}>
              <option value="">Select entity</option>
              {aliases.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>State</label>
            <select value={entityId} onChange={(e) => setEntityId(e.target.value)} className={inputCls} disabled={!alias}>
              {statesForAlias.map((e) => (
                <option key={e._id} value={e._id}>{e.state} - {e.stateCode}</option>
              ))}
            </select>
            {selectedEntity && (
              <p className="mt-1.5 text-xs text-slate-400">
                GST {selectedEntity.gstNumber} ·{" "}
                <span className={sameState ? "text-green-600" : "text-indigo-600"}>
                  {sameState ? "Same state → CGST + SGST" : "Different state → IGST"}
                </span>
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelCls}>Requester</label>
            <input value={requester} onChange={(e) => setRequester(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>PO date</label>
            <input type="date" value={poDate} onChange={(e) => setPoDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Shipment preference</label>
            <select value={shipment} onChange={(e) => setShipment(e.target.value)} className={inputCls}>
              {SHIPMENT_PREFERENCE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </section>

      {/* items */}
      <section className="mt-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Items</p>
          {LOCK_CHECKBOX ? (
            <p className="inline-flex items-center gap-1.5 text-xs text-slate-500">
              <span className="text-slate-400"><IconLock /></span>
              All items locked on this PO
            </p>
          ) : (
            !isEdit && (
              <p className="text-xs text-slate-500">
                <span className="font-semibold text-slate-700 tabular-nums">{checked.length}</span> selected · unchecked = skipped
              </p>
            )
          )}
        </div>

        <div className="divide-y divide-slate-100">
          {rows.map((r) => {
            const c = calc(r);
            return (
              <div key={String(r.quotationItemId)} className={`px-5 py-3.5 transition duration-200 ${!isEdit && !r.checked ? "bg-slate-50/60" : ""}`}>
                <label className={`flex items-center gap-3 text-sm ${LOCK_CHECKBOX ? "cursor-default" : "cursor-pointer"}`}>
                  {!isEdit && (
                    <span className="inline-flex items-center gap-1.5">
                      <input
                        type="checkbox" checked={r.checked} onChange={() => toggle(r.quotationItemId)}
                        disabled={LOCK_CHECKBOX}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-70"
                      />
                      {LOCK_CHECKBOX && <span className="text-slate-400" title="Locked — this item cannot be removed"><IconLock /></span>}
                    </span>
                  )}
                  <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className={`font-semibold ${!isEdit && !r.checked ? "text-slate-400 line-through" : "text-slate-900"}`}>
                      {r.productName}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                      {leafOf(r.categoryName)}
                      <button
                        type="button" title="View full path"
                        onClick={(e) => { e.preventDefault(); setOpenPath(openPath === String(r.quotationItemId) ? null : String(r.quotationItemId)); }}
                        className="rounded p-0.5 text-slate-400 transition duration-200 hover:text-indigo-600"
                      >
                        <IconEye />
                      </button>
                    </span>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span>
                        <span className="font-medium text-slate-700">Qty:</span> {r.quantity}
                      </span>

                      <span>
                        <span className="font-medium text-slate-700">Unit Price:</span> {money(r.unitPrice)}
                      </span>

                      <span>
                        <span className="font-medium text-slate-700">GST:</span> {r.gstRate}%
                      </span>
                    </div>
                  </span>
                </label>

                {/* per-item price breakdown (display-only; server recomputes) */}
                <div className="ml-7 mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-slate-50 px-3 py-2 text-xs tabular-nums">
                  <span className="text-slate-500">Taxable <span className="font-semibold text-slate-800">{money(c.base)}</span></span>
                  {taxType === "CGST_SGST" ? (
                    <>
                      <span className="text-slate-500">CGST ({(Number(r.gstRate) / 2)}%) <span className="font-semibold text-slate-800">{money(c.cgst)}</span></span>
                      <span className="text-slate-500">SGST ({(Number(r.gstRate) / 2)}%) <span className="font-semibold text-slate-800">{money(c.sgst)}</span></span>
                    </>
                  ) : taxType === "IGST" ? (
                    <span className="text-slate-500">IGST ({r.gstRate}%) <span className="font-semibold text-slate-800">{money(c.igst)}</span></span>
                  ) : (
                    <span className="text-slate-500">GST ({r.gstRate}%) <span className="font-semibold text-slate-800">{money(c.gst)}</span></span>
                  )}
                  <span className="ml-auto text-slate-500">Total <span className="text-sm font-bold text-slate-900">{money(c.total)}</span></span>
                </div>

                {openPath === String(r.quotationItemId) && (
                  <p className="ml-7 mt-1.5 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs text-indigo-700">
                    Path · {r.categoryName}
                  </p>
                )}
                {!LOCK_CHECKBOX && !isEdit && !r.checked && (
                  <div className="ml-7 mt-2">
                    <input
                      value={r.reason} onChange={(e) => setReason(r.quotationItemId, e.target.value)}
                      placeholder="Reason for skipping (required)"
                      className="w-full rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-red-300 transition duration-200 focus:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-100"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* order summary — checked items only (display-only preview) */}
        <div className="rounded-b-2xl border-t-2 border-slate-200 bg-slate-50/70 px-5 py-4">
          <div className="ml-auto w-full max-w-xs space-y-1.5 text-sm tabular-nums">
            <div className="flex items-center justify-between text-slate-600">
              <span>Taxable amount</span><span className="font-medium text-slate-800">{money(summary.base)}</span>
            </div>
            {taxType === "CGST_SGST" ? (
              <>
                <div className="flex items-center justify-between text-slate-600">
                  <span>CGST</span><span className="font-medium text-slate-800">{money(summary.cgst)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>SGST</span><span className="font-medium text-slate-800">{money(summary.sgst)}</span>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between text-slate-600">
                <span>IGST</span><span className="font-medium text-slate-800">{money(summary.igst)}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
              <span>Grand total</span><span>{money(summary.total)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* terms & notes */}
      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-700">Terms &amp; notes</p>
        <label className={labelCls}>Terms and conditions</label>
        <textarea rows={3} value={terms} onChange={(e) => setTerms(e.target.value)} className={inputCls} />
        <label className={`${labelCls} mt-4`}>Notes (optional)</label>
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} />
      </section>

      {/* footer actions */}
      <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-slate-200 pt-5">
        <button
          type="button" onClick={onBack}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition duration-200 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
        >
          Cancel
        </button>
        <button
          type="button" onClick={submit} disabled={saving}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition duration-200 hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Working\u2026" : isEdit ? "Save & regenerate" : "Generate PO"}
        </button>
      </div>
    </div>
  );
};

export default POCreateView;