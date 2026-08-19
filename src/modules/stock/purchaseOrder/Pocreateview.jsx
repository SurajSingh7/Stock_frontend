"use client";

import React, { useState, useEffect } from "react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import { unitLabel } from "@/modules/stock/shared/StockSharedUI";

const SHIPMENT_PREFERENCE_OPTIONS = [
  "Self Pickup", "Vendor Delivery", "Courier", "Transport", "Third-Party Logistics", "Hand Delivery",
];

// Terms & conditions are never typed here — they're auto-attached server-side
// from the Terms & Conditions master (vendor-specific match, else the single
// Default term) and are immutable once the PO is created. This view only
// renders whatever the API resolved. Defense-in-depth strip before
// dangerouslySetInnerHTML — the backend already sanitizes on save.
const sanitizeForPreview = (html) =>
  String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "");

/* =============================================================
   LOCK_CHECKBOX
   true  → every item is LOCKED on the PO (checkbox shown checked +
           disabled with a lock icon; no skip, no skip-reason input)
   false → original behavior (uncheck = permanent skip, reason required)
   ============================================================= */
const LOCK_CHECKBOX = true;

const money = (n) =>
  `\u20B9${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
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
  const { sourceQuotationId, vendorId, vendorName, vendorStateCode, poId, buyerEntity: contextBuyerEntity } = context;

  // Entity/State is no longer chosen here — it's assigned once on the
  // Tracking Orders page and consumed here read-only (see Backend
  // createPurchaseOrder, which derives it server-side from the tracking
  // order rather than trusting anything sent from this form).
  const selectedEntity = contextBuyerEntity || null;
  const [requester, setRequester] = useState("Suraj");
  const [poDate, setPoDate] = useState(todayStr());
  const [shipment, setShipment] = useState(SHIPMENT_PREFERENCE_OPTIONS[1]);
  // Read-only — resolved from the Terms & Conditions master API, never
  // client-editable (see sanitizeForPreview comment above).
  const [termsContent, setTermsContent] = useState("");
  const [termsSource, setTermsSource] = useState("NONE"); // "VENDOR" | "DEFAULT" | "NONE"
  // Manual fallback — only used (and only shown) when nothing auto-resolves.
  const [activeTerms, setActiveTerms] = useState([]);
  const [selectedTermsId, setSelectedTermsId] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState(
    (context.items || []).map((it) => ({ ...it, checked: true, reason: "" }))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

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
          // Already-resolved snapshot from when this PO was created — never re-resolved on edit.
          setTermsContent(po.terms || "");
          setTermsSource(po.termsSource || "NONE");
          setNotes(po.notes || "");
        } else {
          // Auto-pick terms for this vendor: vendor-specific match, else the
          // single Default term. Read-only — see resolveForVendor on the backend.
          let resolvedSource = "NONE";
          try {
            const termsRes = await fetch(`${API_BACKEND_URL}/stock/terms-conditions/resolve/${vendorId}`, {
              credentials: "include",
            });
            const termsJson = await termsRes.json();
            if (termsRes.ok && termsJson.success) {
              setTermsContent(termsJson.data?.term?.termsContent || "");
              resolvedSource = termsJson.data?.source || "NONE";
              setTermsSource(resolvedSource);
            }
          } catch {
            // non-fatal — PO creation still works with empty terms
          }

          // Nothing auto-resolved (no vendor-specific term, no Default term
          // configured) — Terms & Conditions is mandatory, so the user must
          // pick one by hand from the active templates.
          if (resolvedSource === "NONE") {
            try {
              const listRes = await fetch(`${API_BACKEND_URL}/stock/terms-conditions?status=ACTIVE&limit=100`, {
                credentials: "include",
              });
              const listJson = await listRes.json();
              if (listRes.ok && listJson.success) setActiveTerms(listJson.data?.data || []);
            } catch {
              // non-fatal — the dropdown just stays empty; submit remains blocked
            }
          }
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [isEdit, poId, vendorId, vendorStateCode]);

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

  const submit = async () => {
    if (!selectedEntity) return setError("No entity assigned yet — add one in Tracking Orders first");
    if (!isEdit) {
      if (checked.length === 0) return setError("Select at least one item for the PO");
      if (unchecked.some((r) => !r.reason.trim())) return setError("Give a reason for every unchecked (skipped) item");
      if (termsSource === "NONE" && !selectedTermsId) return setError("Terms & Conditions is required.");
    }
    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        const res = await fetch(`${API_BACKEND_URL}/stock/purchase-orders/${poId}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
          // terms/buyerEntity are immutable after create — never sent from here.
          body: JSON.stringify({ requester, poDate, shipmentPreference: shipment, notes }),
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
            requester, poDate, shipmentPreference: shipment, notes,
            termsConditionId: selectedTermsId || undefined,
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

      {/* buyer entity — read-only: assigned once on Tracking Orders */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Buyer entity</p>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500">Set in Tracking Orders</span>
        </div>
        {selectedEntity ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Entity</label>
              <p className={`${inputCls} bg-slate-50 text-slate-700`}>{selectedEntity.alias}</p>
            </div>
            <div>
              <label className={labelCls}>State</label>
              <p className={`${inputCls} bg-slate-50 text-slate-700`}>{selectedEntity.state} - {selectedEntity.stateCode}</p>
              <p className="mt-1.5 text-xs text-slate-400">
                GST {selectedEntity.gstNumber} ·{" "}
                <span className={sameState ? "text-green-600" : "text-indigo-600"}>
                  {sameState ? "Same state → CGST + SGST" : "Different state → IGST"}
                </span>
              </p>
            </div>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-amber-200 bg-amber-50/60 px-3 py-2.5 text-sm text-amber-700">
            No entity assigned yet — add one on the Tracking Orders page before creating this PO.
          </p>
        )}

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelCls}>Requester</label>
            <input value={requester} onChange={(e) => setRequester(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>PO date</label>
            <input
              type="date" value={poDate} onChange={(e) => setPoDate(e.target.value)}
              disabled={!isEdit} className={inputCls}
            />
            {!isEdit && <p className="mt-1 text-xs text-slate-400">Always today&rsquo;s date &mdash; not editable.</p>}
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

        <div className="overflow-x-auto">
          <table className="w-full min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/60 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                {!isEdit && <th className="px-3 py-2.5 w-8"></th>}
                <th className="px-3 py-2.5 w-10">Sr.</th>
                <th className="px-3 py-2.5">Description</th>
                <th className="px-3 py-2.5">Product</th>
                <th className="px-3 py-2.5 text-right">Qty</th>
                <th className="px-3 py-2.5 text-right">Basic Price</th>
                {taxType === "CGST_SGST" ? (
                  <>
                    <th className="px-3 py-2.5 text-right">CGST</th>
                    <th className="px-3 py-2.5 text-right">SGST</th>
                  </>
                ) : taxType === "IGST" ? (
                  <th className="px-3 py-2.5 text-right">IGST</th>
                ) : (
                  <th className="px-3 py-2.5 text-right">GST</th>
                )}
                <th className="px-3 py-2.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, idx) => {
                const c = calc(r);
                const skipped = !isEdit && !r.checked;
                return (
                  <React.Fragment key={String(r.quotationItemId)}>
                    <tr className={`transition duration-200 ${skipped ? "bg-slate-50/60" : ""}`}>
                      {!isEdit && (
                        <td className="px-3 py-2.5 align-top">
                          <span className="inline-flex items-center gap-1">
                            <input
                              type="checkbox" checked={r.checked} onChange={() => toggle(r.quotationItemId)}
                              disabled={LOCK_CHECKBOX}
                              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-70"
                            />
                            {LOCK_CHECKBOX && <span className="text-slate-400" title="Locked — this item cannot be removed"><IconLock /></span>}
                          </span>
                        </td>
                      )}
                      <td className="px-3 py-2.5 align-top tabular-nums text-slate-500">{idx + 1}</td>
                      <td className={`px-3 py-2.5 align-top ${skipped ? "text-slate-400 line-through" : "text-slate-700"}`}>{r.categoryName}</td>
                      <td className={`px-3 py-2.5 align-top font-medium ${skipped ? "text-slate-400 line-through" : "text-slate-900"}`}>{r.productName}</td>
                      <td className="px-3 py-2.5 align-top text-right tabular-nums text-slate-700">{r.quantity} {unitLabel(r.unit)}</td>
                      <td className="px-3 py-2.5 align-top text-right tabular-nums text-slate-700">{money(c.base)}</td>
                      {taxType === "CGST_SGST" ? (
                        <>
                          <td className="px-3 py-2.5 align-top text-right tabular-nums text-slate-700">{money(c.cgst)}</td>
                          <td className="px-3 py-2.5 align-top text-right tabular-nums text-slate-700">{money(c.sgst)}</td>
                        </>
                      ) : taxType === "IGST" ? (
                        <td className="px-3 py-2.5 align-top text-right tabular-nums text-slate-700">{money(c.igst)}</td>
                      ) : (
                        <td className="px-3 py-2.5 align-top text-right tabular-nums text-slate-700">{money(c.gst)}</td>
                      )}
                      <td className="px-3 py-2.5 align-top text-right tabular-nums font-semibold text-slate-900">{money(c.total)}</td>
                    </tr>
                    {!LOCK_CHECKBOX && !isEdit && !r.checked && (
                      <tr>
                        <td colSpan={9} className="px-3 pb-2.5">
                          <input
                            value={r.reason} onChange={(e) => setReason(r.quotationItemId, e.target.value)}
                            placeholder="Reason for skipping (required)"
                            className="w-full rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-red-300 transition duration-200 focus:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-100"
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* order summary — checked items only (display-only preview) */}
        <div className="rounded-b-2xl border-t-2 border-slate-200 bg-slate-50/70 px-5 py-4">
          <div className="ml-auto w-full max-w-xs space-y-1.5 text-sm tabular-nums">
            <div className="flex items-center justify-between text-slate-600">
              <span>Basic Price</span><span className="font-medium text-slate-800">{money(summary.base)}</span>
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

        <div className="mb-1.5 flex items-center justify-between">
          <label className={labelCls}>
            Terms and conditions
            {!isEdit && termsSource === "NONE" && <span className="ml-0.5 text-red-500">*</span>}
          </label>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
              termsSource === "VENDOR"
                ? "bg-indigo-50 text-indigo-700"
                : termsSource === "DEFAULT"
                ? "bg-amber-50 text-amber-700"
                : termsSource === "MANUAL"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {termsSource === "VENDOR"
              ? "Vendor-specific term"
              : termsSource === "DEFAULT"
              ? "Default term"
              : termsSource === "MANUAL"
              ? "Manually selected"
              : "No term configured"}
          </span>
        </div>

        {!isEdit && termsSource === "NONE" ? (
          <>
            {/* No vendor-specific or Default term exists — Terms & Conditions
                is mandatory, so a template must be picked by hand. */}
            <select
              value={selectedTermsId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedTermsId(id);
                const picked = activeTerms.find((t) => String(t._id) === id);
                setTermsContent(picked?.termsContent || "");
                setTermsSource(picked ? "MANUAL" : "NONE");
              }}
              className={inputCls}
            >
              <option value="">Select a Terms &amp; Conditions template&hellip;</option>
              {activeTerms.map((t) => (
                <option key={t._id} value={t._id}>{t.termName}</option>
              ))}
            </select>
            {activeTerms.length === 0 && (
              <p className="mt-1.5 text-xs text-red-500">
                No active Terms &amp; Conditions templates exist. Configure one in Master &rarr; Terms &amp; Conditions before generating this PO.
              </p>
            )}
          </>
        ) : null}

        {/* Read-only preview — auto-attached (or, when nothing resolved, the
            manually selected template above) — never typed here. */}
        {termsContent ? (
          <div
            className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-sm leading-relaxed text-slate-700 [&_a]:text-indigo-600 [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: sanitizeForPreview(termsContent) }}
          />
        ) : (isEdit || termsSource !== "NONE") ? (
          <p className="mt-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-3 py-2.5 text-sm text-slate-400">
            No applicable or default Terms &amp; Conditions found. Configure one in Master &rarr; Terms &amp; Conditions.
          </p>
        ) : null}

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