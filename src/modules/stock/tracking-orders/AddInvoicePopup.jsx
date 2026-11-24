"use client";

import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/constants/api";
import { saveInvoice, invoiceReadUrl } from "./trackingApi";
import toast from "react-hot-toast";
import { Upload, FileText, ArrowLeft } from "lucide-react";
import { Modal, money } from "@/modules/stock/shared/StockSharedUI";
import { aiApi } from "@/modules/master/aiSettings/aiSettingsShared";
import { INVOICE_MANUAL_ENTRY } from "@/config/getEnvVariables";
import {
  uploadWithProgress, ScanProgress, ScanSkeleton, ScanResultBanner, ScanFailedBanner,
} from "./InvoiceScanParts";

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";
const labelCls = "mb-1.5 block text-xs font-semibold text-slate-700";
// A value the AI filled in and nobody has changed yet.
const aiCls = "border-emerald-300 bg-emerald-50/60 ring-1 ring-emerald-100";

const ACCEPTED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg", "application/pdf"];
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const getData = async (path, query, fallback) => (await api.get(path, { query, fallback })).data;

/*
  Add Invoice (and ⋮ → Edit invoice): the details exactly as the vendor's
  invoice states them — number, date, amount, and how many of each product.
  Uploading the file has Claude read it (model from Master → AI Settings —
  only there); what it filled is highlighted and checked here before saving.
  "Amount on invoice" and the invoice quantities are locked to what the scan
  read unless NEXT_PUBLIC_INVOICE_MANUAL_ENTRY is "true". Items are entered
  afterwards, from the invoice row's "+ Add Items".
*/
const AddInvoicePopup = ({ mode = "create", layout = "modal", trackingOrderId, invoice, onClose, onDone }) => {
  const isEdit = mode === "edit";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // AI scan: idle → uploading → scanning → done | failed
  const [scan, setScan] = useState({ phase: "idle", uploadPct: 0, startedAt: null, meta: null, error: "" });
  const [warnings, setWarnings] = useState([]);
  const [aiFilled, setAiFilled] = useState({}); // field key -> true while untouched
  const [scanCfg, setScanCfg] = useState(null); // { invoiceScan: { enabled, model }, models }
  const reading = scan.phase === "uploading" || scan.phase === "scanning";
  const untouch = (key) => setAiFilled((p) => (p[key] ? { ...p, [key]: false } : p));

  const [po, setPo] = useState(null);
  const [invoicedElsewhere, setInvoicedElsewhere] = useState({}); // quotationItemId -> qty on other invoices
  const [branches, setBranches] = useState([]);

  const [file, setFile] = useState(null);
  const [readSource, setReadSource] = useState(""); // "AI" once the scan filled the form, "MANUAL" if it failed
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
          getData(API_ENDPOINTS.purchase.trackingOrders.byId(trackingOrderId), undefined, "Failed to load order"),
          getData(API_ENDPOINTS.purchase.invoices.board, { trackingOrderId, limit: 200 }, "Failed to load invoices"),
          isEdit
            ? null
            : getData(API_ENDPOINTS.master.branches.scoped, { module: "invoices" }, "Failed to load branches").catch(() => null),
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
        toast.error(e.message);
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
  // Amount + quantities by hand only when the env allows it; otherwise they
  // are what the scan read (or, when editing, what was saved).
  const amountLocked = !INVOICE_MANUAL_ENTRY;
  const qtyInputLocked = qtyLocked || !INVOICE_MANUAL_ENTRY;

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

  // Which model will read the file — shown while scanning. Non-fatal: the
  // scan works without it. The model itself is changed only in AI Settings.
  useEffect(() => {
    if (isEdit) return;
    aiApi("/invoice-scan").then(setScanCfg).catch(() => {});
  }, [isEdit]);
  const modelLabel = (id) => scanCfg?.models?.find((m) => m.id === id)?.label || id;

  const runScan = async (f) => {
    setWarnings([]);
    setScan({ phase: "uploading", uploadPct: 0, startedAt: null, meta: null, error: "" });
    try {
      const fd = new FormData();
      fd.append("invoiceFile", f);
      const d = await uploadWithProgress(
        invoiceReadUrl(trackingOrderId),
        fd,
        (pct, uploaded) => setScan((s) => ({ ...s, uploadPct: pct, ...(uploaded ? { phase: "scanning", startedAt: Date.now() } : {}) }))
      );
      setInvoiceNumber(d.invoiceNumber || "");
      setInvoiceDate(d.invoiceDate || "");
      setInvoiceAmount(d.invoiceAmount ? String(d.invoiceAmount) : "");
      const q = {};
      const filled = { invoiceNumber: !!d.invoiceNumber, invoiceDate: !!d.invoiceDate, invoiceAmount: !!d.invoiceAmount };
      (d.lines || []).forEach((l) => {
        const k = String(l.quotationItemId);
        q[k] = l.invoiceQuantity ? String(l.invoiceQuantity) : "";
        if (l.invoiceQuantity) filled[`qty:${k}`] = true;
      });
      setQty(q);
      setExtraCharges(d.extraCharges || []);
      (d.extraCharges || []).forEach((_, i) => (filled[`misc:${i}`] = true));
      setAiFilled(filled);
      setWarnings(d.warnings || []);
      setReadSource("AI");
      setScan({ phase: "done", uploadPct: 100, startedAt: null, meta: { seconds: d.seconds, modelLabel: modelLabel(d.model) }, error: "" });
    } catch (err) {
      // The form still opens — empty, to fill by hand.
      setAiFilled({});
      setReadSource((s) => s || "MANUAL");
      setScan({ phase: "failed", uploadPct: 100, startedAt: null, meta: null, error: err.message });
    }
  };

  const pickFile = async (e) => {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    if (!ACCEPTED_UPLOAD_TYPES.includes(picked.type)) return toast.error("Only JPG, PNG, WEBP or PDF files are allowed");
    if (picked.size > MAX_UPLOAD_BYTES) return toast.error("Invoice file is too large. Maximum is 5MB.");
    setFile(picked);
    if (isEdit) return; // a replacement file does not overwrite what was checked by hand
    runScan(picked);
  };

  const updateCharge = (idx, field, value) =>
    setExtraCharges((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));

  const save = async () => {
    if (!isEdit && !file) return toast.error("Upload the invoice file first");
    if (!invoiceNumber.trim()) return toast.error("Invoice number is required");
    if (!invoiceDate) return toast.error("Invoice date is required");
    if (!isEdit && !branchId) return toast.error("Select the branch receiving this invoice");
    const lines = items
      .map((it) => ({ quotationItemId: it.quotationItemId, invoiceQuantity: Number(qty[String(it.quotationItemId)] || 0) }))
      .filter((l) => l.invoiceQuantity > 0);
    if (!lines.length) return toast.error("Enter the invoice quantity for at least one product");
    for (const it of items) {
      const k = String(it.quotationItemId);
      const q = Number(qty[k] || 0);
      const max = (it.quantity || 0) - (invoicedElsewhere[k] || 0);
      if (q > max) return toast.error(`${it.productName}: ${q} is more than is left on the PO (${Math.max(0, max)})`);
      if (q < (enteredByKey[k] || 0)) return toast.error(`${it.productName}: ${enteredByKey[k]} already entered — can't be less`);
    }
    const badCharge = extraCharges.findIndex((c) => !(Number(c.amount) > 0));
    if (badCharge !== -1) return toast.error(`Misc ${badCharge + 1}: enter an amount greater than 0, or remove it`);

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
      await saveInvoice(isEdit ? { invoiceId: invoice._id } : { trackingOrderId }, fd);
      toast.success(isEdit ? `Invoice ${invoiceNumber.trim()} updated` : `Invoice ${invoiceNumber.trim()} uploaded`);
      onDone();
    } catch (err) {
      toast.error(err.message);
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

          {/* Upload — while the AI reads it, the progress card takes its place */}
          {reading ? (
            <ScanProgress
              fileName={file?.name} phase={scan.phase} uploadPct={scan.uploadPct} scanStartedAt={scan.startedAt}
              modelId={scanCfg?.invoiceScan?.model} modelLabel={scanCfg ? modelLabel(scanCfg.invoiceScan.model) : ""}
            />
          ) : (
            <label className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed text-center transition ${file ? "border-emerald-300 bg-emerald-50/50 px-4 py-3" : "border-slate-300 bg-slate-50 px-4 py-6 hover:border-emerald-300 hover:bg-emerald-50/40"}`}>
              {file ? <FileText className="h-5 w-5 text-emerald-600" /> : <Upload className="h-6 w-6 text-slate-400" />}
              <span className="text-sm font-semibold text-slate-700">
                {file ? file.name : isEdit ? "Replace invoice file (optional)" : "Upload invoice (PDF / Image)"}
              </span>
              {!isEdit && !file && <span className="text-xs text-slate-500">AI reads the invoice and fills in the details</span>}
              {!isEdit && file && <span className="text-[11px] text-slate-500">Click to upload a different file</span>}
              {isEdit && !file && invoice.invoiceFile && <span className="text-xs text-slate-500">Current: {invoice.invoiceFile.split("/").pop()}</span>}
              <input type="file" accept={ACCEPTED_UPLOAD_TYPES.join(",")} onChange={pickFile} className="hidden" />
            </label>
          )}

          {reading && <ScanSkeleton />}
          {scan.phase === "done" && scan.meta && (
            <ScanResultBanner
              meta={scan.meta} warnings={warnings} busy={reading}
              onRescan={() => runScan(file)}
            />
          )}
          {scan.phase === "failed" && (
            <ScanFailedBanner
              message={scan.error} busy={reading} manualEntry={INVOICE_MANUAL_ENTRY}
              onRescan={() => runScan(file)}
            />
          )}

          {formReady && !reading && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className={labelCls}>Invoice Number</label>
                  <input value={invoiceNumber} onChange={(e) => { setInvoiceNumber(e.target.value); untouch("invoiceNumber"); }} className={`${inputCls} ${aiFilled.invoiceNumber ? aiCls : ""}`} />
                </div>
                <div>
                  <label className={labelCls}>Invoice Date</label>
                  <input type="date" value={invoiceDate} onChange={(e) => { setInvoiceDate(e.target.value); untouch("invoiceDate"); }} className={`${inputCls} ${aiFilled.invoiceDate ? aiCls : ""}`} />
                </div>
                <div>
                  <label className={labelCls}>Amount on invoice (₹){amountLocked && <span className="ml-1 font-normal text-slate-400">· from scan</span>}</label>
                  <input
                    type="number" min="0" value={invoiceAmount} disabled={amountLocked}
                    title={amountLocked ? "Filled from the AI scan — it cannot be typed by hand" : undefined}
                    onChange={(e) => { setInvoiceAmount(e.target.value); untouch("invoiceAmount"); }}
                    className={`${inputCls} ${aiFilled.invoiceAmount ? aiCls : ""}`}
                  />
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
                      <th className="px-3 py-2 w-36 text-right">Invoice qty{!qtyLocked && qtyInputLocked && <span className="ml-1 font-normal normal-case text-slate-400">· from scan</span>}</th>
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
                              type="number" min="0" value={qty[k] ?? ""} disabled={qtyInputLocked}
                              title={!qtyLocked && qtyInputLocked ? "Filled from the AI scan — it cannot be typed by hand" : undefined}
                              onChange={(e) => { setQty((p) => ({ ...p, [k]: e.target.value })); untouch(`qty:${k}`); }}
                              className={`${inputCls} text-right ${aiFilled[`qty:${k}`] ? aiCls : ""}`}
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
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Misc <span className="font-semibold normal-case tracking-normal text-slate-400">(Extra Charges)</span></p>
                  <button
                    type="button" onClick={() => setExtraCharges((p) => [...p, { amount: "", note: "", includeInBilling: true }])}
                    className="rounded-lg border border-blue-300 bg-white px-2.5 py-1 text-xs font-semibold text-blue-600 shadow-sm hover:bg-blue-50"
                  >
                    + Add Misc
                  </button>
                </div>
                {extraCharges.length === 0 ? (
                  <p className="text-sm text-slate-400">No misc (freight, handling…).</p>
                ) : (
                  <div className="space-y-2">
                    {extraCharges.map((c, idx) => (
                      <div key={idx} className={`flex items-center gap-2 ${c.includeInBilling === false ? "opacity-75" : ""}`}>
                        <input placeholder="e.g. Transport" value={c.note} onChange={(e) => { updateCharge(idx, "note", e.target.value); untouch(`misc:${idx}`); }} className={`${inputCls} w-auto! min-w-0 flex-1 ${aiFilled[`misc:${idx}`] ? aiCls : ""}`} />
                        <input type="number" placeholder="Amount" value={c.amount} onChange={(e) => { updateCharge(idx, "amount", e.target.value); untouch(`misc:${idx}`); }} className={`${inputCls} w-32! shrink-0 text-right ${aiFilled[`misc:${idx}`] ? aiCls : ""}`} />
                        <div className="inline-flex shrink-0 rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-semibold">
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
                        <button
                          type="button"
                          onClick={() => {
                            setExtraCharges((p) => p.filter((_, i) => i !== idx));
                            // Highlights are keyed by position — after a removal they would point at the wrong rows.
                            setAiFilled((p) => Object.fromEntries(Object.entries(p).filter(([key]) => !key.startsWith("misc:"))));
                          }}
                          className="shrink-0 rounded px-2 py-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className={`grid items-start gap-3 ${!isEdit && branches.length > 1 ? "sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]" : ""}`}>
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
                  <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} placeholder="Optional" />
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
