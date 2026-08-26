"use client";

import React, { useState, useEffect, useMemo } from "react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import { usePermissions } from "@/context/PermissionContext";
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

// Key-value row for the Invoice Details table — label on the left, editable
// (or read-only) value on the right, matching the approved layout.
const DetailRow = ({ label, children }) => (
  <div className="grid grid-cols-1 gap-1 px-5 py-3 sm:grid-cols-3 sm:items-center sm:gap-4">
    <span className="text-sm font-medium text-slate-500">{label}</span>
    <div className="sm:col-span-2">{children}</div>
  </div>
);

const NO_BRANCH_MESSAGE =
  "You do not have access to any branch/warehouse. Ask an administrator to assign you a branch before receiving stock.";

const ADD_ROW_COUNTS = [1, 3, 5, 10];
const ACCEPTED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg", "application/pdf"];
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const todayStr = () => {
  const d = new Date();
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

async function fetchTrackingDetail(trackingOrderId) {
  const res = await fetch(`${API_BACKEND_URL}/stock/tracking-orders/${trackingOrderId}`, { credentials: "include" });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to load tracking order");
  return json.data;
}
// Warehouses this user may receive goods into — their own HRMS branch, or a
// wider set if an admin gave them one. Scoped on the invoices module, so
// receiving staff don't need the Master > Warehouse permission to fill this
// field. An empty list means "no branch assigned", not a failure.
async function fetchReceivingWarehouses() {
  const res = await fetch(`${API_BACKEND_URL}/stock/invoices/receiving-warehouses`, { credentials: "include" });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to load warehouses");
  return {
    warehouses: json.data?.warehouses || [],
    defaultWarehouseId: json.data?.defaultWarehouseId ? String(json.data.defaultWarehouseId) : "",
    ownBranchId: json.data?.ownBranchId ? String(json.data.ownBranchId) : "",
  };
}
async function fetchProductDefinition(id) {
  const res = await fetch(`${API_BACKEND_URL}/stock/product-definitions/${id}`, { credentials: "include" });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to load product");
  return json.data;
}
async function fetchInvoicesForTracking(trackingOrderId) {
  const res = await fetch(`${API_BACKEND_URL}/stock/invoices/board?trackingOrderId=${trackingOrderId}&limit=200`, {
    credentials: "include",
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to load invoices");
  return json.data?.rows || [];
}

function buildInvoiceFormData(payload, file) {
  const formData = new FormData();
  formData.append("data", JSON.stringify(payload));
  if (file) formData.append("invoiceFile", file);
  return formData;
}

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

  const selectedFields = (productDef?.selectedFields || [])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((sf) => sf.fieldDefId)
    .filter(Boolean);

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
          Ordered {orderedQty} {unit} · Already in other invoices {usedByOthers} · Remaining {remaining}
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
          This exceeds the ordered quantity — reduce rows/quantity before submitting.
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

const InvoiceReceiveView = ({ mode = "create", trackingOrderId, invoice, onBack, onDone }) => {
  const isEdit = mode === "edit";

  // "Received By" is the signed-in user, not a free-text claim — whoever books
  // the stock in is who the audit trail should name. Sent as undefined while
  // the identity context is still loading: the backend resolves the session
  // user's name itself, so an empty value here can never blank the field.
  const { userData } = usePermissions();
  const receivedByName = [userData?.firstName, userData?.lastName].filter(Boolean).join(" ");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [tracking, setTracking] = useState(null);
  const [po, setPo] = useState(null);
  const [vendor, setVendor] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [ownBranchId, setOwnBranchId] = useState("");
  const [warehouseNotice, setWarehouseNotice] = useState("");
  const [productDefs, setProductDefs] = useState({}); // productDefinitionId -> def
  const [alreadyReceivedByLine, setAlreadyReceivedByLine] = useState({}); // quotationItemId -> qty

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayStr());
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [existingFile, setExistingFile] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [extraCharges, setExtraCharges] = useState([]);
  const [lines, setLines] = useState({}); // quotationItemId -> lineState
  const [activeTabId, setActiveTabId] = useState(null);
  const [ratingPopupFor, setRatingPopupFor] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const detail = await fetchTrackingDetail(trackingOrderId);
        setTracking(detail.tracking);
        setPo(detail.po);
        setVendor(detail.vendor);

        // Fail-soft on purpose: a warehouse-access problem belongs in the
        // warehouse field, not in a page-wide banner that hides the rest of a
        // form the user can otherwise fill in.
        const [warehouseAccess, invoicesForTracking] = await Promise.all([
          fetchReceivingWarehouses().catch((err) => ({
            warehouses: [],
            defaultWarehouseId: "",
            ownBranchId: "",
            error: err.message,
          })),
          fetchInvoicesForTracking(trackingOrderId),
        ]);
        setWarehouses(warehouseAccess.warehouses);
        setOwnBranchId(warehouseAccess.ownBranchId || "");
        setWarehouseNotice(warehouseAccess.error || "");

        const received = {};
        invoicesForTracking.forEach((inv) => {
          if (inv.status === "REJECTED") return;
          if (isEdit && String(inv._id) === String(invoice._id)) return;
          (inv.lines || []).forEach((l) => {
            const key = String(l.quotationItemId);
            received[key] = (received[key] || 0) + (l.receivedQuantity || 0);
          });
        });
        setAlreadyReceivedByLine(received);

        const defs = {};
        await Promise.all(
          (detail.po?.items || []).map(async (it) => {
            if (defs[it.productDefinitionId]) return;
            try {
              defs[it.productDefinitionId] = await fetchProductDefinition(it.productDefinitionId);
            } catch {
              defs[it.productDefinitionId] = null;
            }
          })
        );
        setProductDefs(defs);

        const initialLines = {};
        (detail.po?.items || []).forEach((it) => {
          const key = String(it.quotationItemId);
          if (isEdit) {
            const existing = (invoice.lines || []).find((l) => String(l.quotationItemId) === key);
            const existingRows = (existing?.rows || []).map((r) => ({ fieldValues: r.fieldValues || {}, isFoc: !!r.isFoc }));
            const focQty = existing?.focQuantity || 0;
            initialLines[key] = existing
              ? {
                  rows: existingRows,
                  quantity: existingRows.length ? "" : String(existing.receivedQuantity ?? ""),
                  focEnabled: true,
                  focQuantity: focQty ? String(focQty) : "",
                  rating: existing.rating || { rating: null, notes: "" },
                }
              : emptyLineState();
          } else {
            initialLines[key] = emptyLineState();
          }
        });
        setLines(initialLines);
        setActiveTabId(detail.po?.items?.[0] ? String(detail.po.items[0].quotationItemId) : null);

        // The warehouse is the receiver's own branch, not a free pick — the
        // backend resolves the default, so the field is prefilled rather than
        // guessed from whichever warehouse happened to sort first. An invoice
        // being re-submitted keeps its original warehouse, but only while that
        // one is still inside the editor's scope.
        const inScope = (id) =>
          !!id && warehouseAccess.warehouses.some((w) => String(w._id) === String(id));
        if (isEdit) {
          setInvoiceNumber(invoice.invoiceNumber || "");
          setInvoiceDate(invoice.invoiceDate ? invoice.invoiceDate.slice(0, 10) : todayStr());
          setExistingFile(invoice.invoiceFile || "");
          setWarehouseId(
            inScope(invoice.warehouseId) ? String(invoice.warehouseId) : warehouseAccess.defaultWarehouseId
          );
          setExtraCharges(invoice.extraCharges || []);
        } else {
          setWarehouseId(warehouseAccess.defaultWarehouseId);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackingOrderId]);

  // A single option is the norm: the user's own branch. Nothing to choose, so
  // the field reads as a statement of fact rather than an open dropdown.
  const hasWarehouseAccess = warehouses.length > 0;
  const isSingleWarehouse = warehouses.length === 1;

  const poItems = useMemo(() => po?.items || [], [po]);
  const activeItem = poItems.find((it) => String(it.quotationItemId) === activeTabId);
  const activeLineState = activeTabId ? lines[activeTabId] || emptyLineState() : emptyLineState();

  const setLineState = (quotationItemId, next) => {
    setLines((prev) => ({ ...prev, [String(quotationItemId)]: next }));
  };

  const addExtraCharge = () => setExtraCharges((prev) => [...prev, { amount: "", note: "" }]);
  const updateExtraCharge = (idx, field, value) =>
    setExtraCharges((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  const removeExtraCharge = (idx) => setExtraCharges((prev) => prev.filter((_, i) => i !== idx));

  const handleFilePick = (e) => {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    if (!ACCEPTED_UPLOAD_TYPES.includes(picked.type)) {
      setError("Only JPG, PNG, WEBP or PDF files are allowed for the invoice attachment");
      return;
    }
    if (picked.size > MAX_UPLOAD_BYTES) {
      setError("Invoice file is too large. Maximum is 5MB.");
      return;
    }
    setInvoiceFile(picked);
  };

  const isRowFilled = (r) => Object.values(r.fieldValues || {}).some((v) => v !== "" && v != null);

  const builtLines = useMemo(() => {
    return poItems
      .map((it) => {
        const key = String(it.quotationItemId);
        const ls = lines[key] || emptyLineState();
        const isIndividual = productDefs[it.productDefinitionId]?.trackingMethod === "individual";
        const rows = isIndividual ? ls.rows.filter(isRowFilled) : [];
        const receivedQuantity = isIndividual ? rows.filter((r) => !r.isFoc).length : Number(ls.quantity || 0);
        const focQuantity = isIndividual ? rows.filter((r) => r.isFoc).length : Math.max(0, Number(ls.focQuantity) || 0);
        return { quotationItemId: it.quotationItemId, receivedQuantity, focQuantity, rows, rating: ls.rating?.rating ? ls.rating : null };
      })
      .filter((l) => l.receivedQuantity > 0 || l.focQuantity > 0);
  }, [poItems, lines, productDefs]);

  const submit = async () => {
    setError(null);
    if (!invoiceNumber.trim()) return setError("Invoice number is required");
    if (!invoiceDate) return setError("Invoice date is required");
    if (!warehouseId) {
      return setError(
        hasWarehouseAccess
          ? "Select the warehouse where these items were received"
          : warehouseNotice || NO_BRANCH_MESSAGE
      );
    }
    if (builtLines.length === 0) return setError("Receive at least one item before submitting");

    for (const it of poItems) {
      const key = String(it.quotationItemId);
      const built = builtLines.find((l) => String(l.quotationItemId) === key);
      const receivedQuantity = built?.receivedQuantity || 0;
      const used = alreadyReceivedByLine[key] || 0;
      if (used + receivedQuantity > it.quantity) {
        return setError(`${it.productName}: received quantity exceeds the ordered quantity`);
      }

      const isIndividual = productDefs[it.productDefinitionId]?.trackingMethod === "individual";
      if (isIndividual) {
        const ls = lines[key] || emptyLineState();
        const targetFoc = Math.max(0, Number(ls.focQuantity) || 0);
        const filledFoc = ls.rows.filter((r) => r.isFoc && isRowFilled(r)).length;
        if (targetFoc > 0 && filledFoc < targetFoc) {
          return setError(`${it.productName}: fill all ${targetFoc} FOC row(s) before submitting`);
        }
      }
    }

    setSaving(true);
    try {
      const payload = {
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate,
        warehouseId: warehouseId || null,
        receivedByName: receivedByName || undefined,
        extraCharges: extraCharges
          .filter((c) => c.amount !== "" && c.amount != null)
          .map((c) => ({ amount: Number(c.amount) || 0, note: c.note || "" })),
        lines: builtLines,
      };

      const url = isEdit
        ? `${API_BACKEND_URL}/stock/invoices/${invoice._id}`
        : `${API_BACKEND_URL}/stock/tracking-orders/${trackingOrderId}/invoices`;
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        credentials: "include",
        body: buildInvoiceFormData(payload, invoiceFile),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to save invoice");
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
      <div className="mx-auto max-w-4xl space-y-4 p-6">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

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
          <h1 className="text-lg font-bold tracking-tight text-slate-900">
            {isEdit ? "Edit received invoice" : "Add Items · Receive invoice"}
          </h1>
          <p className="truncate text-sm text-slate-500">
            PO {po?.poNumber || "—"} · {vendor?.name || po?.vendorName || "—"}
          </p>
        </div>
        {isEdit && (
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Rejected · editing
          </span>
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

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <p className="border-b border-slate-100 bg-slate-50/60 px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-700">
            Invoice Details
          </p>
          <div className="divide-y divide-slate-100">
            <DetailRow label="PO Number"><p className="text-sm font-medium text-slate-900">{po?.poNumber || "—"}</p></DetailRow>
            <DetailRow label="Vendor"><p className="text-sm font-medium text-slate-900">{vendor?.name || po?.vendorName || "—"}</p></DetailRow>
            <DetailRow label="Invoice Number">
              <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className={inputCls} placeholder="e.g. INV-1042" />
            </DetailRow>
            <DetailRow label="Invoice Date">
              <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className={inputCls} />
            </DetailRow>
            <DetailRow label="Invoice PDF / Image">
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">
                  {invoiceFile || existingFile ? "Replace File" : "Upload File"}
                  <input type="file" accept={ACCEPTED_UPLOAD_TYPES.join(",")} onChange={handleFilePick} className="hidden" />
                </label>
                {(invoiceFile || existingFile) && (
                  <span className="text-xs text-slate-500">{invoiceFile ? invoiceFile.name : existingFile.split("/").pop()}</span>
                )}
              </div>
            </DetailRow>
            <DetailRow label="Received By">
              <p className="text-sm font-medium text-slate-900">{receivedByName || "—"}</p>
            </DetailRow>
          </div>
        </section>

        <div className="space-y-5">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-5 py-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Extra Charges</p>
              <button
                type="button" onClick={addExtraCharge}
                className="inline-flex items-center gap-1 rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-600 shadow-sm transition hover:bg-blue-50"
              >
                + Add Charge
              </button>
            </div>
            <div className="p-5">
              {extraCharges.length === 0 ? (
                <p className="text-sm text-slate-400">No extra charges added.</p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full min-w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/60 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-2">Description</th>
                        <th className="px-3 py-2 w-32 text-right">Amount</th>
                        <th className="px-3 py-2 w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {extraCharges.map((c, idx) => (
                        <tr key={idx}>
                          <td className="px-3 py-2">
                            <input
                              type="text" placeholder="e.g. Transport" value={c.note}
                              onChange={(e) => updateExtraCharge(idx, "note", e.target.value)}
                              className={inputCls}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number" placeholder="Amount" value={c.amount}
                              onChange={(e) => updateExtraCharge(idx, "amount", e.target.value)}
                              className={`${inputCls} text-right`}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <button type="button" onClick={() => removeExtraCharge(idx)} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                              <IconX />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <label className={labelCls}>Warehouse</label>
            {!hasWarehouseAccess ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                {warehouseNotice || NO_BRANCH_MESSAGE}
              </p>
            ) : (
              <>
                <select
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  disabled={isSingleWarehouse}
                  className={inputCls}
                >
                  {!warehouseId && <option value="">Select a warehouse</option>}
                  {warehouses.map((w) => (
                    <option key={w._id} value={w._id}>
                      {w.name} ({w.code}){String(w._id) === ownBranchId ? " — your branch" : ""}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-slate-500">
                  {isSingleWarehouse
                    ? "Your assigned branch — received stock is booked in here."
                    : "Defaults to your branch. Change it only when receiving for another branch you have access to."}
                </p>
              </>
            )}
          </section>
        </div>
      </div>

      <p className="mb-3 mt-6 text-xs font-bold uppercase tracking-wider text-slate-700">Product Tabs</p>
      <div className="mb-4 flex flex-wrap gap-3">
        {poItems.map((it) => {
          const def = productDefs[it.productDefinitionId];
          const key = String(it.quotationItemId);
          const isActive = activeTabId === key;
          const received = lines[key]
            ? (def?.trackingMethod === "individual" ? lines[key].rows.filter((r) => !r.isFoc).length : Number(lines[key].quantity || 0))
            : 0;
          return (
            <button
              key={key} type="button" onClick={() => setActiveTabId(key)}
              className={`min-w-[200px] rounded-xl border px-4 py-3 text-left shadow-sm transition ${
                isActive ? "border-indigo-300 bg-indigo-50/70 ring-1 ring-indigo-200" : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <span className={`block text-sm font-semibold ${isActive ? "text-indigo-700" : "text-slate-900"}`}>
                {it.productName}{received > 0 && <span className="ml-1.5 text-xs font-semibold text-emerald-600">({received})</span>}
              </span>
              <span className="block text-xs font-normal text-slate-400">{pathLabel(def) || it.categoryName}</span>
            </button>
          );
        })}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {activeItem && (
          <ProductTab
            poLine={activeItem}
            productDef={productDefs[activeItem.productDefinitionId]}
            taxType={po?.taxType}
            lineState={activeLineState}
            onLineChange={(next) => setLineState(activeTabId, next)}
            alreadyReceived={alreadyReceivedByLine[activeTabId]}
            onOpenRating={() => setRatingPopupFor(activeTabId)}
          />
        )}
      </section>

      <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-slate-200 pt-5">
        <button
          type="button" onClick={onBack}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button" onClick={submit} disabled={saving || !hasWarehouseAccess}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving…" : "Submit Invoice"}
        </button>
      </div>

      {ratingPopupFor && (
        <RatingPopup
          initial={lines[ratingPopupFor]?.rating}
          vendorName={vendor?.name || po?.vendorName || ""}
          productName={poItems.find((it) => String(it.quotationItemId) === ratingPopupFor)?.productName || ""}
          onClose={() => setRatingPopupFor(null)}
          onSave={(rating) => setLineState(ratingPopupFor, { ...(lines[ratingPopupFor] || emptyLineState()), rating })}
        />
      )}
    </div>
  );
};

export default InvoiceReceiveView;
