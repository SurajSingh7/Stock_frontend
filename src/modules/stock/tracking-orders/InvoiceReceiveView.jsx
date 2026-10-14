"use client";

import React, { useState, useEffect, useMemo } from "react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import { pathLabel } from "@/shared/category/categoryPath";
import { unitLabel } from "@/modules/stock/shared/StockSharedUI";

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";
const labelCls = "mb-1.5 block text-xs font-semibold text-slate-700";

const IconArrowLeft = () => (
  <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
    <path d="M12.5 15 7.5 10l5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconStar = ({ filled, large }) => (
  <svg viewBox="0 0 20 20" fill={filled ? "currentColor" : "none"} className={large ? "h-8 w-8" : "h-5 w-5"} aria-hidden="true">
    <path d="M10 2.5l2.35 4.76 5.25.76-3.8 3.7.9 5.23L10 14.5l-4.7 2.45.9-5.23-3.8-3.7 5.25-.76L10 2.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
);
const IconX = () => (
  <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
    <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const IconTrash = () => (
  <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
    <path d="M3 5.5h14M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M5.5 5.5 6 16a1.5 1.5 0 0 0 1.5 1.4h5a1.5 1.5 0 0 0 1.5-1.4l.5-10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const rupees = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const ADD_ROW_COUNTS = [1, 3, 5, 10];
async function fetchTrackingDetail(trackingOrderId) {
  const res = await fetch(`${API_BACKEND_URL}/stock/tracking-orders/${trackingOrderId}`, { credentials: "include" });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to load tracking order");
  return json.data;
}
async function fetchInvoice(id) {
  const res = await fetch(`${API_BACKEND_URL}/stock/invoices/${id}`, { credentials: "include" });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to load invoice");
  return json.data;
}
async function fetchProductDefinition(id) {
  const res = await fetch(`${API_BACKEND_URL}/stock/product-definitions/${id}`, { credentials: "include" });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to load product");
  return json.data;
}
// selectedFields in display order, keeping each one's isRequired flag. Both
// tracking methods draw from the same list — Individual renders one set of
// these per unit row, Group renders one set per batch.
const orderedFields = (productDef) =>
  (productDef?.selectedFields || [])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .filter((sf) => sf.fieldDefId)
    .map((sf) => ({ def: sf.fieldDefId, isRequired: !!sf.isRequired }));

// The tracked values a Group line carries. Group keeps exactly ONE row per
// line — never one per unit, and never a separate one for FOC: the free units
// arrive in the same physical lot as the paid ones (20 meters delivered, 3 of
// them free) and share its unique number. The isFoc flag is read leniently so
// a line saved before that rule still resolves.
const groupBatchValues = (lineState) => {
  const rows = lineState.rows || [];
  return (rows.find((r) => !r.isFoc) || rows[0])?.fieldValues || {};
};

const emptyLineState = () => ({
  rows: [],
  quantity: "",
  focEnabled: true,
  focQuantity: "",
  rating: { rating: null, notes: "" },
});

// Per-unit Basic/CGST/SGST/IGST/Total breakdown for the active PO line —
// purely a display computation, derived from the PO's own snapshot
// (unitPrice/gstRate/taxType), no backend round-trip needed.
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const unitPriceBreakdown = (poLine, taxType) => {
  const basic = Number(poLine?.unitPrice) || 0;
  const gstRate = Number(poLine?.gstRate) || 0;
  let cgst = 0, sgst = 0, igst = 0;
  if (taxType === "IGST") {
    igst = round2((basic * gstRate) / 100);
  } else {
    cgst = round2((basic * gstRate) / 200);
    sgst = cgst;
  }
  const total = round2(basic + cgst + sgst + igst);
  return { basic, cgst, sgst, igst, total };
};

/* ============================================================= */
/* Rating popup                                                   */
/* ============================================================= */

const RatingPopup = ({ initial, vendorName, productName, onClose, onSave }) => {
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [notes, setNotes] = useState(initial?.notes || "");

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4" onMouseDown={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Vendor Rating - {vendorName}</p>
            <p className="text-xs text-slate-500">{productName}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <IconX />
          </button>
        </div>
        <label className={labelCls}>Your Rating</label>
        <div className="mb-4 flex items-center gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n} type="button" onClick={() => setRating(n)}
              className={`transition hover:scale-110 hover:text-amber-400 ${n <= rating ? "text-amber-400 drop-shadow-sm" : "text-slate-200"}`}
            >
              <IconStar filled={n <= rating} large />
            </button>
          ))}
        </div>
        <label className={labelCls}>Add Note (Optional)</label>
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} placeholder="Good quality products and on-time delivery." />
        <div className="mt-4 flex justify-end gap-2.5">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => { onSave({ rating: rating || null, notes: notes.trim() }); onClose(); }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
          >
            Save Rating
          </button>
        </div>
      </div>
    </div>
  );
};

/* ============================================================= */
/* Dynamic field input — one per row, per field definition         */
/* ============================================================= */

const DynamicFieldInput = ({ fieldDef, value, onChange }) => {
  const common = { value: value ?? "", onChange: (e) => onChange(e.target.value), className: inputCls, placeholder: fieldDef.label };
  if (fieldDef.inputType === "number" || fieldDef.inputType === "decimal") {
    return <input type="number" {...common} />;
  }
  if (fieldDef.inputType === "date") return <input type="date" {...common} />;
  if (fieldDef.inputType === "boolean") {
    return (
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={inputCls}>
        <option value="">—</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }
  return <input type="text" {...common} />;
};

/* ============================================================= */
/* Product tab body                                                */
/* ============================================================= */

// Small on/off pill switch — used for the FOC toggle.
const ToggleSwitch = ({ checked, onChange, label }) => (
  <button
    type="button" onClick={() => onChange(!checked)}
    className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700"
  >
    <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${checked ? "bg-blue-600" : "bg-slate-300"}`}>
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition ${checked ? "translate-x-4.5" : "translate-x-1"}`} />
    </span>
    {label}
  </button>
);

const UnitStat = ({ label, value }) => (
  <div className="rounded-lg bg-slate-50 px-3 py-2 text-center">
    <p className="text-sm font-bold tabular-nums text-slate-900">₹{value.toLocaleString("en-IN")}</p>
    <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
  </div>
);

// Basic/CGST/SGST/IGST/Total-per-unit strip — shown above the Add Rows /
// Quantity controls so accounts can see the unit economics while receiving.
const UnitPriceSummary = ({ poLine, taxType }) => {
  const b = unitPriceBreakdown(poLine, taxType);
  return (
    <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
      <UnitStat label="Basic / Unit" value={b.basic} />
      {taxType === "IGST" ? (
        <UnitStat label="IGST / Unit" value={b.igst} />
      ) : (
        <>
          <UnitStat label="CGST / Unit" value={b.cgst} />
          <UnitStat label="SGST / Unit" value={b.sgst} />
        </>
      )}
      <UnitStat label="Total / Unit" value={b.total} />
    </div>
  );
};

// One set of tracked fields covering the whole Group receipt: 3 pieces
// received together share a single unique number, they are not three separate
// units — and the FOC units are part of that same lot, so they are covered by
// this one set too rather than asking for the number a second time.
const GroupFieldSet = ({ label, fields, values, onChange }) => (
  <div className="mb-3 rounded-xl border border-slate-200 bg-white p-3">
    <div className="mb-2.5">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-700">{label}</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      {fields.map(({ def, isRequired }) => (
        <div key={def._id}>
          <label className={labelCls}>
            {def.label}
            {isRequired && <span className="ml-0.5 text-rose-500">*</span>}
          </label>
          <DynamicFieldInput
            fieldDef={def}
            value={values[def.code]}
            onChange={(v) => onChange(def.code, v)}
          />
        </div>
      ))}
    </div>
  </div>
);

const ProductTab = ({ poLine, productDef, taxType, lineState, onLineChange, alreadyReceived, onOpenRating }) => {
  const isIndividual = productDef?.trackingMethod === "individual";
  const unit = unitLabel(productDef?.unit);
  const orderedQty = poLine.quantity;
  const usedByOthers = alreadyReceived || 0;
  const paidRows = lineState.rows.filter((r) => !r.isFoc);
  const focRows = lineState.rows.filter((r) => r.isFoc);
  const receivedNow = isIndividual ? paidRows.length : Number(lineState.quantity || 0);
  const remaining = Math.max(0, orderedQty - usedByOthers - receivedNow);
  const overLimit = usedByOthers + receivedNow > orderedQty;
  const focQtyNum = Math.max(0, Number(lineState.focQuantity) || 0);

  const fields = orderedFields(productDef);
  const selectedFields = fields.map((f) => f.def);

  const addRows = (n) => {
    const rows = [...lineState.rows, ...Array.from({ length: n }, () => ({ fieldValues: {}, isFoc: false }))];
    onLineChange({ ...lineState, rows });
  };
  const removeRow = (idx) => {
    onLineChange({ ...lineState, rows: lineState.rows.filter((_, i) => i !== idx) });
  };
  const setRowField = (idx, code, value) => {
    const rows = lineState.rows.map((r, i) => (i === idx ? { ...r, fieldValues: { ...r.fieldValues, [code]: value } } : r));
    onLineChange({ ...lineState, rows });
  };

  // A Group edit writes into that one row, creating it on the first
  // keystroke — there is no "add row" step when the whole received quantity,
  // paid and FOC together, is a single lot.
  const setGroupField = (code, value) => {
    const current = groupBatchValues(lineState);
    const rows = [{ fieldValues: { ...current, [code]: value }, isFoc: false }];
    onLineChange({ ...lineState, rows });
  };

  const setFocEnabled = (on) => {
    if (!on) {
      onLineChange({ ...lineState, focEnabled: false, focQuantity: "", rows: paidRows });
    } else {
      onLineChange({ ...lineState, focEnabled: true });
    }
  };
  const setFocQuantity = (val) => {
    const n = Math.max(0, Number(val) || 0);
    let nextFoc = focRows;
    if (n > focRows.length) {
      nextFoc = [...focRows, ...Array.from({ length: n - focRows.length }, () => ({ fieldValues: {}, isFoc: true }))];
    } else if (n < focRows.length) {
      nextFoc = focRows.slice(0, n);
    }
    onLineChange({ ...lineState, focQuantity: val, rows: isIndividual ? [...paidRows, ...nextFoc] : lineState.rows });
  };

  const allRows = isIndividual ? [...paidRows, ...focRows] : [];

  return (
    <div>
      <UnitPriceSummary poLine={poLine} taxType={taxType} />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
          {isIndividual ? "Received units" : "Received quantity"} ({unit})
        </p>
        <p className={`text-xs font-semibold tabular-nums ${overLimit ? "text-rose-600" : "text-slate-500"}`}>
          Invoice qty {orderedQty} {unit}{usedByOthers > 0 ? ` · On other entries ${usedByOthers}` : ""} · Entering {receivedNow} · Left {remaining}
        </p>
      </div>

      <div className="mb-3">
        <ToggleSwitch checked={lineState.focEnabled} onChange={setFocEnabled} label="FOC (Free of Cost)" />
        {lineState.focEnabled && (
          <div className="mt-2 max-w-xs">
            <input
              type="number" min="0" value={lineState.focQuantity}
              onChange={(e) => setFocQuantity(e.target.value)}
              placeholder="FOC quantity"
              className={inputCls}
            />
            {isIndividual && focQtyNum > 0 && (
              <p className="mt-1 text-[11px] font-medium text-amber-600">
                {focQtyNum} FOC row{focQtyNum > 1 ? "s" : ""} added below — must be filled before submitting.
              </p>
            )}
          </div>
        )}
      </div>

      {overLimit && (
        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
          This is more than the invoice says — reduce rows/quantity.
        </div>
      )}

      {/* Add-row controls (left) + Vendor Rating trigger (right) — same row */}
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        {isIndividual ? (
          <div>
            <label className={labelCls}>Add Rows</label>
            <div className="flex flex-wrap gap-2">
              {ADD_ROW_COUNTS.map((n) => (
                <button
                  key={n} type="button" onClick={() => addRows(n)}
                  className="inline-flex items-center justify-center rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-600 shadow-sm transition hover:bg-blue-50"
                >
                  +{n} Row{n > 1 ? "s" : ""}
                </button>
              ))}
              {paidRows.length > 0 && (
                <button
                  type="button" onClick={() => onLineChange({ ...lineState, rows: focRows })}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 shadow-sm transition hover:bg-slate-50"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="max-w-xs">
            <label className={labelCls}>Quantity received ({unit})</label>
            <input
              type="number" min="0" value={lineState.quantity}
              onChange={(e) => onLineChange({ ...lineState, quantity: e.target.value })}
              className={inputCls}
            />
          </div>
        )}

        <button
          type="button" onClick={onOpenRating}
          className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3.5 py-2 text-sm font-semibold text-indigo-600 shadow-sm transition hover:bg-indigo-50"
        >
          <IconStar filled={!!lineState.rating.rating} />
          {lineState.rating.rating ? `Vendor Rating · ${lineState.rating.rating}/5` : "Vendor Rating"}
        </button>
      </div>

      {!isIndividual && fields.length > 0 && (receivedNow > 0 || focQtyNum > 0) && (
        <GroupFieldSet
          label={`Batch details · ${receivedNow} ${unit}${focQtyNum > 0 ? ` + ${focQtyNum} FOC` : ""}`}
          fields={fields}
          values={groupBatchValues(lineState)}
          onChange={setGroupField}
        />
      )}

      {!isIndividual && fields.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-3 py-2.5 text-sm text-slate-400">
          This product has no tracked fields configured — the quantity above is all that gets recorded.
        </p>
      )}

      {isIndividual && selectedFields.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-3 py-2.5 text-sm text-slate-400">
          This product has no tracked fields configured — add rows just to record a count.
        </p>
      )}

      {isIndividual && allRows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/60 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 w-10">#</th>
                <th className="px-3 py-2 w-16">Type</th>
                {selectedFields.map((fd) => (
                  <th key={fd._id} className="px-3 py-2">{fd.label}</th>
                ))}
                <th className="px-3 py-2 w-16">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allRows.map((row, idx) => {
                const realIdx = lineState.rows.indexOf(row);
                return (
                  <tr key={realIdx} className={row.isFoc ? "bg-amber-50/60" : ""}>
                    <td className="px-3 py-2 tabular-nums text-slate-400">{idx + 1}</td>
                    <td className="px-3 py-2">
                      {row.isFoc ? (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">FOC</span>
                      ) : (
                        <span className="text-[10px] font-medium text-slate-400">Paid</span>
                      )}
                    </td>
                    {selectedFields.map((fd) => (
                      <td key={fd._id} className="px-3 py-2">
                        <DynamicFieldInput
                          fieldDef={fd}
                          value={row.fieldValues[fd.code]}
                          onChange={(v) => setRowField(realIdx, fd.code, v)}
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => removeRow(realIdx)} title="Delete row" className="rounded-md border border-rose-200 bg-white p-1.5 text-rose-600 shadow-sm transition hover:bg-rose-50">
                        <IconTrash />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {lineState.rating.notes && (
        <p className="mt-3 rounded-lg bg-amber-50/60 px-3 py-2 text-xs text-amber-700">{lineState.rating.notes}</p>
      )}
    </div>
  );
};

/* ============================================================= */
/* Main                                                            */
/* ============================================================= */

const STATUS_PILL = {
  ADDED: { label: "Added", cls: "border-slate-200 bg-slate-50 text-slate-700" },
  DRAFT: { label: "Draft", cls: "border-sky-200 bg-sky-50 text-sky-700" },
  REJECTED: { label: "Rejected · fix and resubmit", cls: "border-rose-200 bg-rose-50 text-rose-700" },
};

const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

/*
  Add Items — entering the units an invoice says arrived. Anyone receiving
  can carry it forward draft by draft (the entry history records who entered
  what); Submit only unlocks once every product has exactly the invoice's
  quantity. The invoice's own details are read-only here — they are changed
  from the invoice row's ⋮ → Edit invoice, by whoever holds that permission.
*/
/*
  Partial submit (turned on per invoice): the screen fills ONE entry — the
  open draft, or a rejected entry being corrected (`entryId`). It may hold
  any part of what is still free on the invoice and is submitted on its own.
*/
const InvoiceReceiveView = ({ trackingOrderId, invoiceId, entryId, onBack, onDone }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(null); // "draft" | "submit" | null

  const [po, setPo] = useState(null);
  const [vendor, setVendor] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [productDefs, setProductDefs] = useState({}); // productDefinitionId -> def
  const [lines, setLines] = useState({}); // quotationItemId -> lineState
  const [activeTabId, setActiveTabId] = useState(null);
  const [ratingPopupFor, setRatingPopupFor] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [detail, inv] = await Promise.all([fetchTrackingDetail(trackingOrderId), fetchInvoice(invoiceId)]);
        setPo(detail.po);
        setVendor(detail.vendor);
        setInvoice(inv);

        const defs = {};
        await Promise.all(
          (inv.lines || []).map(async (l) => {
            if (defs[l.productDefinitionId]) return;
            try {
              defs[l.productDefinitionId] = await fetchProductDefinition(l.productDefinitionId);
            } catch {
              defs[l.productDefinitionId] = null;
            }
          })
        );
        setProductDefs(defs);

        // Whatever was entered earlier (a draft, or a rejected submission)
        // opens filled in. With partial submit that is the entry being filled.
        const target = inv.partialSubmit
          ? (inv.entries || []).find((e) => (entryId ? String(e._id) === String(entryId) : e.status === "DRAFT"))
          : null;
        const sourceByKey = new Map(
          (inv.partialSubmit ? target?.lines || [] : inv.lines || []).map((l) => [String(l.quotationItemId), l])
        );
        const initial = {};
        (inv.lines || []).forEach((l) => {
          const src = sourceByKey.get(String(l.quotationItemId)) || {};
          const isIndividual = defs[l.productDefinitionId]?.trackingMethod === "individual";
          initial[String(l.quotationItemId)] = {
            rows: (src.rows || []).map((r) => ({ fieldValues: r.fieldValues || {}, isFoc: !!r.isFoc })),
            // Individual derives its quantity from the rows; Group carries one.
            quantity: isIndividual || !src.receivedQuantity ? "" : String(src.receivedQuantity),
            focEnabled: true,
            focQuantity: src.focQuantity ? String(src.focQuantity) : "",
            rating: l.rating || { rating: null, notes: "" },
          };
        });
        setLines(initial);
        setActiveTabId(inv.lines?.[0] ? String(inv.lines[0].quotationItemId) : null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [trackingOrderId, invoiceId, entryId]);

  const invoiceLines = useMemo(() => invoice?.lines || [], [invoice]);
  const partial = !!invoice?.partialSubmit;
  const targetEntry = partial
    ? (invoice.entries || []).find((e) => (entryId ? String(e._id) === String(entryId) : e.status === "DRAFT"))
    : null;
  // Partial submit: what OTHER entries already hold per product (submitted,
  // approved, or another open draft) — this entry can take only the rest.
  const othersByKey = useMemo(() => {
    const m = {};
    if (!partial) return m;
    (invoice.entries || [])
      .filter((e) => e.status !== "REJECTED" && String(e._id) !== String(targetEntry?._id))
      .forEach((e) => (e.lines || []).forEach((l) => {
        const k = String(l.quotationItemId);
        m[k] = (m[k] || 0) + (l.receivedQuantity || 0);
      }));
    return m;
  }, [partial, invoice, targetEntry]);
  // The product tab works off a PO line; its "ordered" quantity here is what
  // the INVOICE says, so every cap and count on the tab is against the invoice.
  const tabLineFor = (l) => {
    const poLine = (po?.items || []).find((it) => String(it.quotationItemId) === String(l.quotationItemId)) || {};
    return { ...poLine, ...l, unitPrice: l.unitPrice ?? poLine.unitPrice, quantity: l.invoiceQuantity };
  };
  const activeLine = invoiceLines.find((l) => String(l.quotationItemId) === activeTabId);
  const activeLineState = activeTabId ? lines[activeTabId] || emptyLineState() : emptyLineState();
  const setLineState = (key, next) => setLines((prev) => ({ ...prev, [String(key)]: next }));

  const isRowFilled = (r) => Object.values(r.fieldValues || {}).some((v) => v !== "" && v != null);

  // What has been entered, per invoice line, as the backend wants it.
  const builtLines = useMemo(() => {
    return invoiceLines.map((l) => {
      const key = String(l.quotationItemId);
      const ls = lines[key] || emptyLineState();
      const isIndividual = productDefs[l.productDefinitionId]?.trackingMethod === "individual";
      const filledRows = isIndividual ? ls.rows.filter(isRowFilled) : [];
      const receivedQuantity = isIndividual ? filledRows.filter((r) => !r.isFoc).length : Number(ls.quantity || 0);
      const focQuantity = isIndividual ? filledRows.filter((r) => r.isFoc).length : Math.max(0, Number(ls.focQuantity) || 0);
      // Group sends a single row for the whole lot — paid and FOC share it.
      const rows = isIndividual
        ? filledRows
        : receivedQuantity > 0 || focQuantity > 0
          ? [{ fieldValues: groupBatchValues(ls), isFoc: false }]
          : [];
      return {
        quotationItemId: l.quotationItemId,
        productName: l.productName,
        invoiceQuantity: l.invoiceQuantity,
        cap: (l.invoiceQuantity || 0) - (othersByKey[key] || 0),
        receivedQuantity,
        focQuantity,
        rows,
        rating: ls.rating?.rating ? ls.rating : null,
      };
    });
  }, [invoiceLines, lines, productDefs, othersByKey]);

  const enteredTotal = builtLines.reduce((s, l) => s + l.receivedQuantity, 0);
  const invoiceTotal = builtLines.reduce((s, l) => s + (l.invoiceQuantity || 0), 0);
  const allEntered = builtLines.length > 0 && builtLines.every((l) => l.receivedQuantity === l.invoiceQuantity);
  // Partial: anything within what is still free; otherwise everything.
  const canSubmit = partial
    ? builtLines.some((l) => l.receivedQuantity > 0 || l.focQuantity > 0) && builtLines.every((l) => l.receivedQuantity <= l.cap)
    : allEntered;

  const validate = (submit) => {
    for (const l of builtLines) {
      if (l.receivedQuantity > l.cap) {
        return partial
          ? `${l.productName}: only ${Math.max(0, l.cap)} left to enter on this invoice`
          : `${l.productName}: ${l.receivedQuantity} entered but the invoice says ${l.invoiceQuantity}`;
      }
    }
    if (!submit) return null;
    if (!canSubmit) return partial ? "Enter at least one item on this entry" : "Enter every item on the invoice before submitting";

    for (const l of invoiceLines) {
      const key = String(l.quotationItemId);
      const ls = lines[key] || emptyLineState();
      const def = productDefs[l.productDefinitionId];
      if (def?.trackingMethod === "individual") {
        const targetFoc = Math.max(0, Number(ls.focQuantity) || 0);
        const filledFoc = ls.rows.filter((r) => r.isFoc && isRowFilled(r)).length;
        if (targetFoc > 0 && filledFoc < targetFoc) return `${l.productName}: fill all ${targetFoc} FOC row(s) before submitting`;
      } else {
        // Group: the backend's required-field rule, checked here so it reads
        // as a form error instead of a save failure.
        const required = orderedFields(def).filter((fd) => fd.isRequired);
        const lineQty = Number(ls.quantity || 0) + Math.max(0, Number(ls.focQuantity) || 0);
        if (required.length && lineQty > 0) {
          const values = groupBatchValues(ls);
          const missing = required.filter((fd) => {
            const v = values[fd.def.code];
            return v === undefined || v === null || v === "";
          });
          if (missing.length) return `${l.productName}: fill ${missing.map((fd) => fd.def.label).join(", ")} for this batch`;
        }
      }
    }
    return null;
  };

  const save = async (submit) => {
    setError(null);
    const problem = validate(submit);
    if (problem) {
      setError(problem);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setSaving(submit ? "submit" : "draft");
    try {
      const res = await fetch(`${API_BACKEND_URL}/stock/invoices/${invoiceId}/items`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submit,
          ...(partial && entryId ? { entryId } : {}),
          lines: builtLines.map(({ quotationItemId, receivedQuantity, focQuantity, rows, rating }) => ({
            quotationItemId, receivedQuantity, focQuantity, rows, rating,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to save");
      onDone();
    } catch (err) {
      setError(err.message);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-6">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  const pill = partial
    ? {
        label: `Partial submit · Entry ${targetEntry?.entryNumber || (invoice.entries || []).length + 1}${targetEntry?.status === "REJECTED" ? " · rejected" : ""}`,
        cls: "border-violet-200 bg-violet-50 text-violet-700",
      }
    : STATUS_PILL[invoice?.status];
  const fileUrl = invoice?.invoiceFile ? `${API_BACKEND_URL.replace(/\/api\/v1$/, "")}${invoice.invoiceFile}` : "";
  const log = (invoice?.entryLog || []).slice().reverse();

  return (
    <div className="mx-auto max-w-4xl p-6 pb-12">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button
          type="button" onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          <IconArrowLeft /> Back
        </button>
        <div className="min-w-0">
          <h1 className="text-lg font-bold tracking-tight text-slate-900">Add Items · {invoice?.invoiceNumber}</h1>
          <p className="truncate text-sm text-slate-500">
            PO {po?.poNumber || "—"} · {vendor?.name || po?.vendorName || "—"}
          </p>
        </div>
        {pill && (
          <span className={`ml-auto inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${pill.cls}`}>{pill.label}</span>
        )}
      </div>

      {error && (
        <div className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="shrink-0 rounded p-0.5 text-rose-400 hover:text-rose-700">
            <IconX />
          </button>
        </div>
      )}
      {partial && targetEntry?.status === "REJECTED" && targetEntry.rejectedReason && (
        <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span className="font-semibold">Entry {targetEntry.entryNumber} rejected{targetEntry.reviewedByName ? ` by ${targetEntry.reviewedByName}` : ""}:</span> {targetEntry.rejectedReason}
        </div>
      )}
      {!partial && invoice?.status === "REJECTED" && invoice?.rejectedReason && (
        <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span className="font-semibold">Rejected{invoice.reviewedByName ? ` by ${invoice.reviewedByName}` : ""}:</span> {invoice.rejectedReason}
        </div>
      )}

      {/* The invoice as added — read-only here. */}
      <section className="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-5 py-3">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Invoice 🔒</p>
          <p className="text-[11px] text-slate-400">Changed from ⋮ → Edit invoice</p>
        </div>
        <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Invoice No</p>
            <p className="mt-1 text-sm font-medium text-slate-900">{invoice?.invoiceNumber}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date</p>
            <p className="mt-1 text-sm font-medium text-slate-900">{invoice?.invoiceDate ? String(invoice.invoiceDate).slice(0, 10) : "—"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Amount on invoice</p>
            <p className="mt-1 text-sm font-medium text-slate-900">{rupees(invoice?.invoiceAmount)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">File</p>
            {fileUrl ? (
              <a href={fileUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm font-medium text-indigo-600 hover:underline">View invoice</a>
            ) : (
              <p className="mt-1 text-sm text-slate-400">—</p>
            )}
          </div>
        </div>
        {(invoice?.extraCharges?.length > 0 || invoice?.notes) && (
          <div className="grid gap-4 border-t border-slate-100 px-5 py-4 sm:grid-cols-2">
            {invoice?.extraCharges?.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Extra Charges</p>
                <ul className="space-y-1 text-sm text-slate-700">
                  {invoice.extraCharges.map((c, i) => (
                    <li key={i} className={`flex items-center justify-between gap-2 ${c.includeInBilling === false ? "text-slate-400" : ""}`}>
                      <span>
                        {c.note || "—"}
                        {c.includeInBilling === false && (
                          <span className="ml-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Not billed</span>
                        )}
                      </span>
                      <span className="tabular-nums">{rupees(c.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {invoice?.notes && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</p>
                <p className="whitespace-pre-wrap text-sm text-slate-700">{invoice.notes}</p>
              </div>
            )}
          </div>
        )}
      </section>

      <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-700">Products</p>
      <div className="mb-4 flex flex-wrap gap-3">
        {invoiceLines.map((l) => {
          const key = String(l.quotationItemId);
          const def = productDefs[l.productDefinitionId];
          const isActive = activeTabId === key;
          const built = builtLines.find((b) => String(b.quotationItemId) === key);
          const others = othersByKey[key] || 0;
          const done = partial ? others + (built?.receivedQuantity || 0) >= l.invoiceQuantity : built?.receivedQuantity === l.invoiceQuantity;
          return (
            <button
              key={key} type="button" onClick={() => setActiveTabId(key)}
              className={`min-w-[200px] rounded-xl border px-4 py-3 text-left shadow-sm transition ${
                isActive ? "border-indigo-300 bg-indigo-50/70 ring-1 ring-indigo-200" : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <span className={`block text-sm font-semibold ${isActive ? "text-indigo-700" : "text-slate-900"}`}>{l.productName}</span>
              <span className={`block text-xs font-semibold tabular-nums ${done ? "text-emerald-600" : "text-amber-600"}`}>
                {partial
                  ? `${others} done + ${built?.receivedQuantity || 0} now / ${l.invoiceQuantity}`
                  : `${built?.receivedQuantity || 0} / ${l.invoiceQuantity} entered`}
                {done ? " ✓" : ""}
              </span>
              <span className="block text-xs font-normal text-slate-400">{pathLabel(def) || l.categoryName}</span>
            </button>
          );
        })}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {activeLine && (
          <ProductTab
            poLine={tabLineFor(activeLine)}
            productDef={productDefs[activeLine.productDefinitionId]}
            taxType={po?.taxType}
            lineState={activeLineState}
            onLineChange={(next) => setLineState(activeTabId, next)}
            alreadyReceived={othersByKey[activeTabId] || 0}
            onOpenRating={() => setRatingPopupFor(activeTabId)}
          />
        )}
      </section>

      {log.length > 0 && (
        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-700">Entry history</p>
          <ul className="space-y-1 text-sm text-slate-700">
            {log.map((e, i) => (
              <li key={i} className="flex flex-wrap gap-x-2">
                <span className="font-semibold text-slate-900">{e.byName || "—"}</span>
                <span className="text-slate-400">· {fmtDateTime(e.at)} ·</span>
                <span>{(e.items || []).map((it) => `${it.productName} ${it.quantity >= 0 ? "+" : ""}${it.quantity}`).join(", ") || "—"}</span>
                <span className={`text-xs font-semibold ${e.action === "SUBMIT" ? "text-indigo-600" : "text-slate-400"}`}>
                  · {e.entryNumber ? `Entry ${e.entryNumber} ` : ""}{e.action === "SUBMIT" ? "submitted" : "draft saved"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-200 pt-5">
        {!partial && !allEntered && (
          <span className="mr-auto text-xs font-medium text-amber-700">
            {enteredTotal} / {invoiceTotal} entered — enter everything on the invoice to submit
          </span>
        )}
        {partial && (
          <span className="mr-auto text-xs font-medium text-violet-700">
            Partial submit is on — this entry goes for approval with what it holds ({enteredTotal}).
          </span>
        )}
        <button
          type="button" onClick={onBack}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          Cancel
        </button>
        {!(partial && targetEntry?.status === "REJECTED") && <button
          type="button" onClick={() => save(false)} disabled={!!saving}
          className="rounded-lg border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-600 shadow-sm transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving === "draft" ? "Saving…" : "Save as Draft"}
        </button>}
        <button
          type="button" onClick={() => save(true)} disabled={!!saving || !canSubmit}
          title={canSubmit ? "" : partial ? "Enter at least one item" : "Enter every item on the invoice first"}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving === "submit" ? "Submitting…" : partial ? "Submit this entry" : "Submit for approval"}
        </button>
      </div>

      {ratingPopupFor && (
        <RatingPopup
          initial={lines[ratingPopupFor]?.rating}
          vendorName={vendor?.name || po?.vendorName || ""}
          productName={invoiceLines.find((l) => String(l.quotationItemId) === ratingPopupFor)?.productName || ""}
          onClose={() => setRatingPopupFor(null)}
          onSave={(rating) => setLineState(ratingPopupFor, { ...(lines[ratingPopupFor] || emptyLineState()), rating })}
        />
      )}
    </div>
  );
};

export default InvoiceReceiveView;
