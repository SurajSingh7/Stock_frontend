"use client";

import React, { useState, useEffect, useMemo } from "react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import { unitLabel, Modal } from "@/modules/stock/shared/StockSharedUI";
import { EntriesContent, entryView } from "./InvoiceEntries";

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
// Every invoice of this order — for the PO's received figures and the
// "Previous invoices" box.
async function fetchInvoicesForTracking(trackingOrderId) {
  const res = await fetch(`${API_BACKEND_URL}/stock/invoices/board?trackingOrderId=${trackingOrderId}&limit=200`, {
    credentials: "include",
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to load invoices");
  return json.data?.rows || [];
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

const UnitStat = ({ label, value }) => (
  <div className="rounded-lg bg-slate-50 px-3 py-2 text-center">
    <p className="text-sm font-bold tabular-nums text-slate-900">₹{value.toLocaleString("en-IN")}</p>
    <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
  </div>
);


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
  // Serial products: the FOC count IS the number of FOC rows, so deleting a
  // row from the table brings the count down with it.
  const focQtyNum = isIndividual ? focRows.length : Math.max(0, Number(lineState.focQuantity) || 0);

  const fields = orderedFields(productDef);
  const selectedFields = fields.map((f) => f.def);

  // New rows go on top — the one being typed into is always the first.
  const addRows = (n) => {
    const rows = [...Array.from({ length: n }, () => ({ fieldValues: {}, isFoc: false })), ...lineState.rows];
    onLineChange({ ...lineState, rows });
  };
  const removeRow = (idx) => {
    const rows = lineState.rows.filter((_, i) => i !== idx);
    const removedFoc = lineState.rows[idx]?.isFoc;
    onLineChange({
      ...lineState,
      rows,
      ...(removedFoc ? { focQuantity: String(rows.filter((r) => r.isFoc).length || "") } : {}),
    });
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

  // FOC rows follow the same rule: new ones on top; lowering the count drops
  // the newest (top) FOC rows first, which are the ones least likely filled.
  const setFocQuantity = (val) => {
    const n = Math.max(0, Number(val) || 0);
    let rows = lineState.rows;
    if (isIndividual) {
      if (n > focRows.length) {
        rows = [...Array.from({ length: n - focRows.length }, () => ({ fieldValues: {}, isFoc: true })), ...lineState.rows];
      } else if (n < focRows.length) {
        let drop = focRows.length - n;
        rows = lineState.rows.filter((r) => !(r.isFoc && drop-- > 0));
      }
    }
    onLineChange({ ...lineState, focQuantity: val, rows });
  };

  // Shown in stored order — newest first.
  const allRows = isIndividual ? lineState.rows : [];

  // FOC is entered from a small popup rather than an always-open field.
  const [focPopup, setFocPopup] = useState(null); // draft value while the popup is open
  const saveFoc = () => {
    setFocQuantity(focPopup === "" ? "" : String(Math.max(0, Number(focPopup) || 0)));
    setFocPopup(null);
  };

  return (
    <div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
          {isIndividual ? "Received units" : "Received quantity"} ({unit})
        </p>
        <p className={`text-xs font-semibold tabular-nums ${overLimit ? "text-rose-600" : "text-slate-500"}`}>
          Invoice qty {orderedQty} {unit}{usedByOthers > 0 ? ` · On other entries ${usedByOthers}` : ""} · Entering {receivedNow} · Left {remaining}
        </p>
      </div>

      {overLimit && (
        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
          This is more than the invoice says — reduce rows/quantity.
        </div>
      )}

      {/* One row: Add Rows (or quantity) · FOC · Vendor Rating */}
      <div className="mb-3 flex flex-wrap items-end gap-2">
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
          <div className="w-44">
            <label className={labelCls}>Quantity received ({unit})</label>
            <input
              type="number" min="0" value={lineState.quantity}
              onChange={(e) => onLineChange({ ...lineState, quantity: e.target.value })}
              className={inputCls}
            />
          </div>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
        <button
          type="button" onClick={() => setFocPopup(focQtyNum ? String(focQtyNum) : "")}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-sm transition ${
            focQtyNum > 0 ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          🎁 FOC{focQtyNum > 0 ? ` · ${focQtyNum}` : ""}
        </button>

        <button
          type="button" onClick={onOpenRating}
          className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-600 shadow-sm transition hover:bg-indigo-50"
        >
          <IconStar filled={!!lineState.rating.rating} />
          {lineState.rating.rating ? `Vendor Rating · ${lineState.rating.rating}/5` : "Vendor Rating"}
        </button>
        </div>
      </div>

      {isIndividual && focQtyNum > 0 && (
        <p className="mb-3 text-[11px] font-medium text-amber-600">
          {focQtyNum} FOC row{focQtyNum > 1 ? "s" : ""} added below — must be filled before submitting.
        </p>
      )}

      {focPopup !== null && (
        <Modal onClose={() => setFocPopup(null)} title="FOC (Free of Cost)" maxWidth="max-w-sm">
          <label className={labelCls}>FOC quantity ({unit || "units"})</label>
          <input
            type="number" min="0" autoFocus value={focPopup}
            onChange={(e) => setFocPopup(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveFoc()}
            placeholder="0" className={inputCls}
          />
          <p className="mt-1.5 text-[11px] text-slate-500">
            Free units received with this product — not priced into the invoice.
            {isIndividual ? " One row is added for each FOC unit." : ""}
          </p>
          <div className="mt-4 flex justify-end gap-2">
            {focQtyNum > 0 && (
              <button type="button" onClick={() => { setFocQuantity(""); setFocPopup(null); }} className="mr-auto rounded-lg px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50">
                Remove FOC
              </button>
            )}
            <button type="button" onClick={() => setFocPopup(null)} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button type="button" onClick={saveFoc} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
              Save
            </button>
          </div>
        </Modal>
      )}

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
                    <td className="px-3 py-2 tabular-nums text-slate-400">{allRows.length - idx}</td>
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

// PO Details + Previous Invoices boxes on the Add Items screen. Hidden for
// now — only the current invoice is shown. Flip to true to bring them back.
const SHOW_ORDER_CONTEXT = false;

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const INVOICE_STATUS_META = {
  ADDED: { label: "Added", cls: "bg-slate-100 text-slate-700" },
  DRAFT: { label: "Draft", cls: "bg-sky-100 text-sky-700" },
  PENDING: { label: "Pending approval", cls: "bg-amber-100 text-amber-800" },
  IN_PROGRESS: { label: "In progress", cls: "bg-violet-100 text-violet-700" },
  APPROVED: { label: "Approved", cls: "bg-emerald-100 text-emerald-700" },
  REJECTED: { label: "Rejected", cls: "bg-rose-100 text-rose-700" },
};
const StatusChip = ({ status }) => {
  const m = INVOICE_STATUS_META[status] || { label: status, cls: "bg-slate-100 text-slate-600" };
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.cls}`}>{m.label}</span>;
};
// What an invoice is worth on screen: as written on it, else at PO rates.
const invoiceWorth = (inv) => (inv.invoiceAmount > 0 ? inv.invoiceAmount : inv.grandTotal || 0);

// One previous invoice — number, date, status, each product and the amount.
const PreviousInvoiceRow = ({ inv }) => (
  <li className="rounded-lg border border-amber-100 bg-white px-3 py-2">
    <div className="flex items-center justify-between gap-2">
      <span className="truncate text-sm font-semibold text-slate-900">{inv.invoiceNumber}</span>
      <StatusChip status={inv.status} />
    </div>
    <p className="mt-0.5 text-[11px] text-slate-500">{fmtDate(inv.invoiceDate)}</p>
    <div className="mt-1 flex items-end justify-between gap-2 text-xs">
      <span className="text-slate-600">{(inv.lines || []).map((l) => `${l.productName} ${l.invoiceQuantity}`).join(", ") || "—"}</span>
      <span className="shrink-0 font-semibold tabular-nums text-slate-900">{rupees(invoiceWorth(inv))}</span>
    </div>
  </li>
);

// 👁 Unit price — every product of the invoice at the PO rate, per unit.
const UnitPricePopup = ({ invoiceNumber, lines, taxType, onClose }) => {
  const igst = taxType === "IGST";
  const th = "px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-600";
  const td = "px-3 py-2.5 text-sm";
  return (
    <Modal onClose={onClose} title={`${invoiceNumber} · Unit price (PO rate)`} maxWidth="max-w-4xl">
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-full border-collapse">
          <thead className="bg-slate-50">
            <tr>
              <th className={`${th} text-left`}>Category path</th>
              <th className={`${th} text-left`}>Product</th>
              <th className={`${th} text-right`}>Basic / Unit</th>
              {igst ? (
                <th className={`${th} text-right`}>IGST / Unit</th>
              ) : (
                <>
                  <th className={`${th} text-right`}>CGST / Unit</th>
                  <th className={`${th} text-right`}>SGST / Unit</th>
                </>
              )}
              <th className={`${th} text-right`}>Total / Unit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map((l) => {
              const b = unitPriceBreakdown(l, taxType);
              return (
                <tr key={String(l.quotationItemId)}>
                  <td className={`${td} text-slate-500`}>{l.categoryPath || "—"}</td>
                  <td className={`${td} font-semibold text-slate-900`}>{l.productName}</td>
                  <td className={`${td} text-right tabular-nums`}>{rupees(b.basic)}</td>
                  {igst ? (
                    <td className={`${td} text-right tabular-nums`}>{rupees(b.igst)}</td>
                  ) : (
                    <>
                      <td className={`${td} text-right tabular-nums`}>{rupees(b.cgst)}</td>
                      <td className={`${td} text-right tabular-nums`}>{rupees(b.sgst)}</td>
                    </>
                  )}
                  <td className={`${td} text-right font-bold tabular-nums text-indigo-700`}>{rupees(b.total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">PO rates — the price each unit on this invoice is billed at.</p>
    </Modal>
  );
};

/*
  The "Entries" line under the current invoice: a one-line total, and the
  cards / Σ total / detailed log (shared with the Tracking card) in a popup.
*/
const EntryCards = ({ invoice }) => {
  const [open, setOpen] = useState(false);
  const { partial, cards, sum } = entryView(invoice);
  return (
    <div>
      <button
        type="button" onClick={() => setOpen(true)}
        className="flex w-full items-center gap-1.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900"
      >
        <span className="text-slate-400">▸</span>
        {partial ? "Entries" : "Entry"}
        <span className="rounded-full bg-slate-200 px-1.5 text-[10px] font-semibold normal-case text-slate-700">{cards.length}</span>
        <span className="ml-auto text-[11px] font-medium normal-case tracking-normal text-slate-500">
          Total {partial ? sum("approved") + sum("pending") + sum("draft") : sum("entered")} / {sum("invoiceQty")} · FOC {sum("foc")}
        </span>
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)} title={`${partial ? "Entries" : "Entry"} · ${invoice.invoiceNumber}`} maxWidth="max-w-3xl">
          <EntriesContent invoice={invoice} />
        </Modal>
      )}
    </div>
  );
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
  const [orderInvoices, setOrderInvoices] = useState([]); // every invoice of this order
  const [sidePopup, setSidePopup] = useState(null); // "unitPrice" | "allInvoices"

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [detail, inv, siblings] = await Promise.all([
          fetchTrackingDetail(trackingOrderId),
          fetchInvoice(invoiceId),
          fetchInvoicesForTracking(trackingOrderId).catch(() => []),
        ]);
        setPo(detail.po);
        setVendor(detail.vendor);
        setInvoice(inv);
        setOrderInvoices(siblings);

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
      <div className="mx-auto max-w-5xl space-y-4 p-6">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  // Cancel / Save as Draft / Submit — at the bottom of the page.
  const actionButtons = (
    <div className="flex flex-wrap items-center gap-2.5">
      <button
        type="button" onClick={onBack}
        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
      >
        Cancel
      </button>
      {!(partial && targetEntry?.status === "REJECTED") && (
        <button
          type="button" onClick={() => save(false)} disabled={!!saving}
          className="rounded-lg border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-600 shadow-sm transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving === "draft" ? "Saving…" : "Save as Draft"}
        </button>
      )}
      <button
        type="button" onClick={() => save(true)} disabled={!!saving || !canSubmit}
        title={canSubmit ? "" : partial ? "Enter at least one item" : "Enter every item on the invoice first"}
        className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving === "submit" ? "Submitting…" : partial ? "Submit this entry" : "Submit for approval"}
      </button>
    </div>
  );

  const pill = partial
    ? {
        label: `Partial submit · Entry ${targetEntry?.entryNumber || (invoice.entries || []).length + 1}${targetEntry?.status === "REJECTED" ? " · rejected" : ""}`,
        cls: "border-violet-200 bg-violet-50 text-violet-700",
      }
    : STATUS_PILL[invoice?.status];
  const fileUrl = invoice?.invoiceFile ? `${API_BACKEND_URL.replace(/\/api\/v1$/, "")}${invoice.invoiceFile}` : "";

  // PO: received = approved, across every invoice of the order (a partial
  // invoice's lines carry its approved total).
  const receivedByKey = {};
  orderInvoices.forEach((inv) => {
    if (inv.status !== "APPROVED" && !inv.partialSubmit) return;
    (inv.lines || []).forEach((l) => {
      const k = String(l.quotationItemId);
      receivedByKey[k] = (receivedByKey[k] || 0) + (l.receivedQuantity || 0);
    });
  });
  const previousInvoices = orderInvoices
    .filter((inv) => String(inv._id) !== String(invoiceId))
    .sort((a, b) => new Date(b.invoiceDate || 0) - new Date(a.invoiceDate || 0));
  const prevTotals = {};
  previousInvoices.forEach((inv) =>
    (inv.lines || []).forEach((l) => (prevTotals[l.productName] = (prevTotals[l.productName] || 0) + (l.invoiceQuantity || 0)))
  );
  const prevAmount = previousInvoices.reduce((t, inv) => t + invoiceWorth(inv), 0);
  const unitPriceLines = invoiceLines.map((l) => ({
    ...tabLineFor(l),
    categoryPath: l.categoryPath || l.categoryName,
  }));
  const log = (invoice?.entryLog || []).slice().reverse();

  return (
    <div className="mx-auto max-w-5xl p-6 pb-12">
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

      <div className="grid grid-cols-1 gap-5">
        {/* Left — PO, previous invoices and this invoice, each its own colour. */}
        <div className="space-y-4 rounded-2xl bg-slate-100/80 p-4">
          {SHOW_ORDER_CONTEXT && <div className="grid gap-4 xl:grid-cols-2">
            {/* PO details */}
            <section className="overflow-hidden rounded-xl border border-blue-200 bg-white shadow-sm">
              <div className="border-b border-blue-100 bg-blue-50 px-4 py-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-blue-800">📦 PO Details</p>
                <p className="text-sm font-semibold text-slate-900">{po?.poNumber || "—"}</p>
                <p className="text-[11px] text-slate-500">{fmtDate(po?.poDate || po?.createdAt)} · {vendor?.name || po?.vendorName || "—"}</p>
              </div>
              <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2">Product</th>
                    <th className="whitespace-nowrap px-2 py-2 text-right">Ordered</th>
                    <th className="whitespace-nowrap px-2 py-2 text-right">Received</th>
                    <th className="whitespace-nowrap px-3 py-2 text-right">Pending</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(po?.items || []).map((it) => {
                    const got = receivedByKey[String(it.quotationItemId)] || 0;
                    return (
                      <tr key={String(it.quotationItemId)}>
                        <td className="px-3 py-1.5 font-medium text-slate-800">{it.productName}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{it.quantity}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-emerald-700">{got}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-amber-700">{Math.max(0, (it.quantity || 0) - got)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
              <p className="border-t border-blue-100 px-3 py-2 text-right text-xs text-slate-600">
                PO total <span className="font-semibold text-slate-900">{rupees(po?.grandTotal)}</span>
              </p>
            </section>

            {/* Previous invoices */}
            <section className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50/40 shadow-sm">
              <div className="border-b border-amber-100 bg-amber-50 px-4 py-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">🧾 Previous Invoices</p>
                <p className="text-[11px] text-slate-500">{previousInvoices.length} on this PO</p>
              </div>
              {previousInvoices.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-slate-400">This is the first invoice on this PO.</p>
              ) : (
                <>
                  <ul className="space-y-2 p-3">
                    {previousInvoices.slice(0, 3).map((inv) => <PreviousInvoiceRow key={inv._id} inv={inv} />)}
                  </ul>
                  <div className="border-t border-amber-100 px-3 py-2 text-xs text-slate-600">
                    <p>Total: {Object.entries(prevTotals).map(([n, q]) => `${n} ${q}`).join(" · ")}</p>
                    <p className="font-semibold text-slate-900">{rupees(prevAmount)}</p>
                    {previousInvoices.length > 3 && (
                      <button type="button" onClick={() => setSidePopup("allInvoices")} className="mt-1.5 rounded-md border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-50">
                        View all ({previousInvoices.length})
                      </button>
                    )}
                  </div>
                </>
              )}
            </section>
          </div>}

          {/* Current invoice */}
          <section className="overflow-hidden rounded-xl border-2 border-indigo-300 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 bg-indigo-50 px-4 py-2.5">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-800">✏️ Current Invoice 🔒</p>
                <p className="truncate text-sm font-semibold text-slate-900">{invoice?.invoiceNumber}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusChip status={invoice?.status} />
                <button
                  type="button" onClick={() => setSidePopup("unitPrice")}
                  className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-white px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50"
                >
                  👁 Unit price
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2.5 text-xs text-slate-600">
              <span>Date <span className="font-medium text-slate-900">{fmtDate(invoice?.invoiceDate)}</span></span>
              <span>Amount <span className="font-medium text-slate-900">{rupees(invoice?.invoiceAmount)}</span></span>
              <span>Total qty <span className="font-medium text-slate-900">{invoiceTotal}</span></span>
              <span>Entered now <span className={`font-semibold ${enteredTotal >= invoiceTotal ? "text-emerald-700" : "text-indigo-700"}`}>{enteredTotal}</span></span>
              {fileUrl ? (
                <a href={fileUrl} target="_blank" rel="noreferrer" className="font-medium text-indigo-600 hover:underline">View file</a>
              ) : (
                <span className="text-slate-400">No file</span>
              )}
            </div>
            <table className="w-full border-t border-slate-100 text-xs">
              <thead>
                <tr className="text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2">Category</th>
                  <th className="px-2 py-2">Product</th>
                  <th className="px-2 py-2 text-right">Invoice qty</th>
                  {partial && <th className="px-2 py-2 text-right">Earlier entries</th>}
                  <th className="px-2 py-2 text-right">FOC</th>
                  <th className="px-2 py-2 text-right">Entered now</th>
                  <th className="px-4 py-2 text-right">Left</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoiceLines.map((l) => {
                  const k = String(l.quotationItemId);
                  const built = builtLines.find((x) => String(x.quotationItemId) === k);
                  const now = built?.receivedQuantity || 0;
                  // Same count as the FOC button: FOC rows (filled or not) for
                  // serial products, the FOC quantity for quantity products.
                  const ls = lines[k] || emptyLineState();
                  const foc = productDefs[l.productDefinitionId]?.trackingMethod === "individual"
                    ? ls.rows.filter((r) => r.isFoc).length
                    : Math.max(0, Number(ls.focQuantity) || 0);
                  const earlier = othersByKey[k] || 0;
                  const left = Math.max(0, (l.invoiceQuantity || 0) - earlier - now);
                  return (
                    <tr key={k}>
                      <td className="px-4 py-1.5 text-slate-500">{l.categoryPath || l.categoryName || "—"}</td>
                      <td className="px-2 py-1.5 font-medium text-slate-800">{l.productName}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{l.invoiceQuantity}</td>
                      {partial && <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">{earlier}</td>}
                      <td className={`px-2 py-1.5 text-right tabular-nums ${foc ? "font-semibold text-amber-700" : "text-slate-400"}`}>{foc}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-indigo-700">{now}</td>
                      <td className={`px-4 py-1.5 text-right tabular-nums font-semibold ${left ? "text-amber-700" : "text-emerald-700"}`}>{left}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {(invoice?.extraCharges?.length > 0 || invoice?.notes) && (
              <div className="space-y-1 border-t border-slate-100 px-4 py-2.5 text-xs text-slate-600">
                {invoice?.extraCharges?.length > 0 && (
                  <p>
                    Extra:{" "}
                    {invoice.extraCharges.map((c, i) => (
                      <span key={i} className={c.includeInBilling === false ? "text-slate-400" : ""}>
                        {i > 0 && " · "}{c.note || "Charge"} {rupees(c.amount)}{c.includeInBilling === false ? " (not billed)" : ""}
                      </span>
                    ))}
                  </p>
                )}
                {invoice?.notes && <p className="whitespace-pre-wrap">Notes: {invoice.notes}</p>}
              </div>
            )}
            <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-2">
              <EntryCards invoice={invoice} />
            </div>
          </section>
        </div>

        {/* Right — products: pick a tab, enter its units. */}
        <div className="min-w-0">
      <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-700">Products</p>
      <div className="mb-4 flex flex-wrap gap-3">
        {invoiceLines.map((l) => {
          const key = String(l.quotationItemId);
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
        </div>
      </div>

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
        {actionButtons}
      </div>

      {sidePopup === "unitPrice" && (
        <UnitPricePopup invoiceNumber={invoice?.invoiceNumber} lines={unitPriceLines} taxType={po?.taxType} onClose={() => setSidePopup(null)} />
      )}
      {sidePopup === "allInvoices" && (
        <Modal onClose={() => setSidePopup(null)} title={`Previous invoices · ${po?.poNumber || ""}`} maxWidth="max-w-lg">
          <ul className="space-y-2">
            {previousInvoices.map((inv) => <PreviousInvoiceRow key={inv._id} inv={inv} />)}
          </ul>
        </Modal>
      )}
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
