"use client";

import React, { useEffect, useMemo, useState } from "react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import { Upload, FileText, Sparkles, ArrowLeft } from "lucide-react";
import { Modal, money } from "@/modules/stock/shared/StockSharedUI";

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";
const labelCls = "mb-1.5 block text-xs font-semibold text-slate-700";

const ACCEPTED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg", "application/pdf"];
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

async function getJson(path, failMessage) {
  const res = await fetch(`${API_BACKEND_URL}${path}`, { credentials: "include" });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || failMessage);
  return json.data;
}

/*
  Add Invoice (and ⋮ → Edit invoice): the details exactly as the vendor's
  invoice states them — number, date, amount, and how many of each product.
  Uploading the file fills these in (dummy values for now, the Claude API
  later); they are checked and corrected here before saving. Items are
  entered afterwards, from the invoice row's "+ Add Items".
*/
const AddInvoicePopup = ({ mode = "create", layout = "modal", trackingOrderId, invoice, onClose, onDone }) => {
  const isEdit = mode === "edit";

  const [loading, setLoading] = useState(true);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [po, setPo] = useState(null);
  const [invoicedElsewhere, setInvoicedElsewhere] = useState({}); // quotationItemId -> qty on other invoices
  const [branches, setBranches] = useState([]);

  const [file, setFile] = useState(null);
  const [readSource, setReadSource] = useState(""); // "DUMMY" once the upload filled the form
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [qty, setQty] = useState({}); // quotationItemId -> invoice quantity (string)
  const [extraCharges, setExtraCharges] = useState([]);
  const [notes, setNotes] = useState("");
  const [branchId, setBranchId] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [detail, board, branchAccess] = await Promise.all([
          getJson(`/stock/tracking-orders/${trackingOrderId}`, "Failed to load order"),
          getJson(`/stock/invoices/board?trackingOrderId=${trackingOrderId}&limit=200`, "Failed to load invoices"),
          isEdit
            ? null
            : getJson(`/stock/scoped-branches?module=invoices`, "Failed to load branches").catch(() => null),
        ]);
        setPo(detail.po);

        const elsewhere = {};
        (board?.rows || []).forEach((inv) => {
          if (isEdit && String(inv._id) === String(invoice._id)) return;
          (inv.lines || []).forEach((l) => {
            const k = String(l.quotationItemId);
            elsewhere[k] = (elsewhere[k] || 0) + (l.invoiceQuantity || 0);
          });
        });
        setInvoicedElsewhere(elsewhere);

        if (branchAccess) {
          setBranches(branchAccess.branches || []);
          setBranchId(branchAccess.defaultBranchId ? String(branchAccess.defaultBranchId) : "");
        }

        if (isEdit) {
          setInvoiceNumber(invoice.invoiceNumber || "");
          setInvoiceDate(invoice.invoiceDate ? String(invoice.invoiceDate).slice(0, 10) : "");
          setInvoiceAmount(invoice.invoiceAmount ? String(invoice.invoiceAmount) : "");
          const q = {};
          (invoice.lines || []).forEach((l) => (q[String(l.quotationItemId)] = String(l.invoiceQuantity ?? "")));
          setQty(q);
          setExtraCharges((invoice.extraCharges || []).map((c) => ({ ...c, includeInBilling: c.includeInBilling !== false })));
          setNotes(invoice.notes || "");
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackingOrderId]);

  const items = useMemo(() => po?.items || [], [po]);
  // Once an item is entered against an invoice line, its quantity can't drop
  // below that (the server refuses it too) — shown so the floor is visible.
  const enteredByKey = useMemo(() => {
    const m = {};
    (invoice?.lines || []).forEach((l) => (m[String(l.quotationItemId)] = l.receivedQuantity || 0));
    return m;
  }, [invoice]);
  const qtyLocked = isEdit && ["PENDING", "APPROVED"].includes(invoice?.status);

  // The same invoice priced at PO rates (+GST, + billed charges) — shown beside
  // the amount on the invoice so a mismatch is visible before saving.
  const poRateAmount = useMemo(() => {
    const lines = items.reduce((s, it) => {
      const q = Number(qty[String(it.quotationItemId)] || 0);
      return s + q * (it.unitPrice || 0) * (1 + (it.gstRate || 0) / 100);
    }, 0);
    const charges = extraCharges
      .filter((c) => c.includeInBilling !== false)
      .reduce((s, c) => s + (Number(c.amount) || 0), 0);
    return round2(lines + charges);
  }, [items, qty, extraCharges]);

  const pickFile = async (e) => {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    if (!ACCEPTED_UPLOAD_TYPES.includes(picked.type)) return setError("Only JPG, PNG, WEBP or PDF files are allowed");
    if (picked.size > MAX_UPLOAD_BYTES) return setError("Invoice file is too large. Maximum is 5MB.");
    setError(null);
    setFile(picked);
    if (isEdit) return; // a replacement file does not overwrite what was checked by hand

    setReading(true);
    try {
      const fd = new FormData();
      fd.append("invoiceFile", picked);
      const res = await fetch(`${API_BACKEND_URL}/stock/tracking-orders/${trackingOrderId}/invoices/read`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Could not read the invoice");
      const d = json.data;
      setReadSource(d.source || "");
      setInvoiceNumber(d.invoiceNumber || "");
      setInvoiceDate(d.invoiceDate || "");
      setInvoiceAmount(d.invoiceAmount ? String(d.invoiceAmount) : "");
      const q = {};
      (d.lines || []).forEach((l) => (q[String(l.quotationItemId)] = String(l.invoiceQuantity ?? "")));
      setQty(q);
    } catch (err) {
      setError(err.message);
    } finally {
      setReading(false);
    }
  };

  const updateCharge = (idx, field, value) =>
    setExtraCharges((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));

  const save = async () => {
    setError(null);
    if (!isEdit && !file) return setError("Upload the invoice file first");
    if (!invoiceNumber.trim()) return setError("Invoice number is required");
    if (!invoiceDate) return setError("Invoice date is required");
    if (!isEdit && !branchId) return setError("Select the branch receiving this invoice");
    const lines = items
      .map((it) => ({ quotationItemId: it.quotationItemId, invoiceQuantity: Number(qty[String(it.quotationItemId)] || 0) }))
      .filter((l) => l.invoiceQuantity > 0);
    if (!lines.length) return setError("Enter the invoice quantity for at least one product");
    for (const it of items) {
      const k = String(it.quotationItemId);
      const q = Number(qty[k] || 0);
      const max = (it.quantity || 0) - (invoicedElsewhere[k] || 0);
      if (q > max) return setError(`${it.productName}: ${q} is more than is left on the PO (${Math.max(0, max)})`);
      if (q < (enteredByKey[k] || 0)) return setError(`${it.productName}: ${enteredByKey[k]} already entered — can't be less`);
    }
    const badCharge = extraCharges.findIndex((c) => !(Number(c.amount) > 0));
    if (badCharge !== -1) return setError(`Extra charge ${badCharge + 1}: enter an amount greater than 0, or remove it`);

    const payload = {
      invoiceNumber: invoiceNumber.trim(),
      invoiceDate,
      invoiceAmount: Number(invoiceAmount) || 0,
      notes: notes.trim(),
      extraCharges: extraCharges.map((c) => ({
        amount: Number(c.amount),
        note: c.note || "",
        includeInBilling: c.includeInBilling !== false,
      })),
      lines,
      ...(isEdit ? {} : { branchId }),
    };
    const fd = new FormData();
    fd.append("data", JSON.stringify(payload));
    if (file) fd.append("invoiceFile", file);

    setSaving(true);
    try {
      const res = await fetch(
        isEdit ? `${API_BACKEND_URL}/stock/invoices/${invoice._id}` : `${API_BACKEND_URL}/stock/tracking-orders/${trackingOrderId}/invoices`,
        { method: isEdit ? "PUT" : "POST", credentials: "include", body: fd }
      );
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to save invoice");
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const formReady = isEdit || !!readSource;

  const title = isEdit ? `Edit invoice · ${invoice.invoiceNumber}` : "Add Invoice";

  const body = (
    <>
      {loading ? (
        <div className="h-48 animate-pulse rounded-xl bg-slate-100" />
      ) : (
        <div className="space-y-4">
          {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

          {/* Upload */}
          <label className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${file ? "border-emerald-300 bg-emerald-50/50" : "border-slate-300 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/40"}`}>
            {file ? <FileText className="h-6 w-6 text-emerald-600" /> : <Upload className="h-6 w-6 text-slate-400" />}
            <span className="text-sm font-semibold text-slate-700">
              {reading ? "Reading invoice…" : file ? file.name : isEdit ? "Replace invoice file (optional)" : "Upload invoice (PDF / Image)"}
            </span>
            {!isEdit && !file && <span className="text-xs text-slate-500">Details fill in automatically from the invoice</span>}
            {isEdit && !file && invoice.invoiceFile && <span className="text-xs text-slate-500">Current: {invoice.invoiceFile.split("/").pop()}</span>}
            <input type="file" accept={ACCEPTED_UPLOAD_TYPES.join(",")} onChange={pickFile} className="hidden" disabled={reading} />
          </label>

          {readSource === "DUMMY" && (
            <p className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <Sparkles className="h-3.5 w-3.5" /> Sample details filled in — reading the actual invoice comes later. Check and correct them before saving.
            </p>
          )}

          {formReady && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className={labelCls}>Invoice Number</label>
                  <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Invoice Date</label>
                  <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Amount on invoice (₹)</label>
                  <input type="number" min="0" value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} className={inputCls} />
                  <p className={`mt-1 text-[11px] ${Math.abs((Number(invoiceAmount) || 0) - poRateAmount) > 1 ? "font-semibold text-amber-600" : "text-slate-400"}`}>
                    At PO rates: {money(poRateAmount)}
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2">Product</th>
                      <th className="px-3 py-2 text-right">PO qty</th>
                      <th className="px-3 py-2 text-right">On other invoices</th>
                      <th className="px-3 py-2 w-36 text-right">Invoice qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((it) => {
                      const k = String(it.quotationItemId);
                      return (
                        <tr key={k}>
                          <td className="px-3 py-2 font-medium text-slate-900">
                            {it.productName}
                            {enteredByKey[k] > 0 && <span className="ml-1.5 text-[11px] font-normal text-slate-400">({enteredByKey[k]} entered)</span>}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-600">{it.quantity}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-600">{invoicedElsewhere[k] || 0}</td>
                          <td className="px-3 py-2">
                            <input
                              type="number" min="0" value={qty[k] ?? ""} disabled={qtyLocked}
                              onChange={(e) => setQty((p) => ({ ...p, [k]: e.target.value }))}
                              className={`${inputCls} text-right`}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {qtyLocked && <p className="text-xs text-slate-500">Items are already submitted on this invoice, so its quantities can&apos;t change.</p>}

              <div className="rounded-xl border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Extra Charges</p>
                  <button
                    type="button" onClick={() => setExtraCharges((p) => [...p, { amount: "", note: "", includeInBilling: true }])}
                    className="rounded-lg border border-blue-300 bg-white px-2.5 py-1 text-xs font-semibold text-blue-600 shadow-sm hover:bg-blue-50"
                  >
                    + Add Charge
                  </button>
                </div>
                {extraCharges.length === 0 ? (
                  <p className="text-sm text-slate-400">No extra charges.</p>
                ) : (
                  <div className="space-y-2">
                    {extraCharges.map((c, idx) => (
                      <div key={idx} className={`flex flex-wrap items-center gap-2 ${c.includeInBilling === false ? "opacity-75" : ""}`}>
                        <input placeholder="e.g. Transport" value={c.note} onChange={(e) => updateCharge(idx, "note", e.target.value)} className={`${inputCls} min-w-0 flex-1`} />
                        <input type="number" placeholder="Amount" value={c.amount} onChange={(e) => updateCharge(idx, "amount", e.target.value)} className={`${inputCls} w-28 text-right`} />
                        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-semibold">
                          {[
                            { value: true, label: "In bill", on: "bg-blue-600 text-white" },
                            { value: false, label: "Note", on: "bg-slate-600 text-white" },
                          ].map((opt) => (
                            <button
                              key={opt.label} type="button" onClick={() => updateCharge(idx, "includeInBilling", opt.value)}
                              className={`rounded-md px-2.5 py-1 transition ${(c.includeInBilling !== false) === opt.value ? opt.on : "text-slate-500 hover:bg-slate-100"}`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        <button type="button" onClick={() => setExtraCharges((p) => p.filter((_, i) => i !== idx))} className="rounded px-2 py-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className={`grid gap-3 ${isEdit || branches.length <= 1 ? "" : "sm:grid-cols-2"}`}>
                {!isEdit && branches.length > 1 && (
                  <div>
                    <label className={labelCls}>Branch</label>
                    <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={inputCls}>
                      {!branchId && <option value="">Select a branch</option>}
                      {branches.map((b) => <option key={b._id} value={b._id}>{b.name} ({b.code})</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className={labelCls}>Notes</label>
                  <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} placeholder="Optional" />
                </div>
              </div>
              {!isEdit && branches.length === 0 && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  You do not have access to any branch. Ask an administrator to assign you a branch.
                </p>
              )}
            </>
          )}

          <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50">
              Cancel
            </button>
            <button
              type="button" onClick={save} disabled={saving || reading || !formReady}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving…" : isEdit ? "Save changes" : "Save Invoice"}
            </button>
          </div>
        </div>
      )}
    </>
  );

  if (layout === "page") {
    return (
      <div className="mx-auto max-w-4xl p-6 pb-12">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <button
            type="button" onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight text-slate-900">{title}</h1>
            <p className="truncate text-sm text-slate-500">PO {po?.poNumber || "—"} · {po?.vendorName || "—"}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">{body}</div>
      </div>
    );
  }
  return (
    <Modal onClose={onClose} title={isEdit ? title : `${title} · ${po?.poNumber || ""}`} maxWidth="max-w-3xl">
      {body}
    </Modal>
  );
};

export default AddInvoicePopup;
