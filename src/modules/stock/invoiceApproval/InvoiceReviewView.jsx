"use client";

import React, { useState, useEffect, useMemo } from "react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import { ArrowLeft, Download, CheckCircle2, XCircle } from "lucide-react";
import { inputCls, money } from "@/modules/stock/shared/StockSharedUI";

const ROWS_PAGE_SIZE = 10;

const fmt = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const STATUS_META = {
  PENDING: { label: "Pending", badge: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500" },
  APPROVED: { label: "Approved", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  REJECTED: { label: "Rejected", badge: "bg-rose-50 text-rose-700 ring-rose-200", dot: "bg-rose-500" },
};
const StatusBadge = ({ status }) => {
  const m = STATUS_META[status] || {};
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${m.badge || "bg-slate-50 text-slate-600 ring-slate-200"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot || "bg-slate-400"}`} />
      {m.label || status}
    </span>
  );
};

const unitPriceBreakdown = (unitPrice, gstRate, taxType) => {
  const basic = Number(unitPrice) || 0;
  const rate = Number(gstRate) || 0;
  let cgst = 0, sgst = 0, igst = 0;
  if (taxType === "IGST") {
    igst = round2((basic * rate) / 100);
  } else {
    cgst = round2((basic * rate) / 200);
    sgst = cgst;
  }
  return { basic, cgst, sgst, igst, total: round2(basic + cgst + sgst + igst) };
};

async function fetchInvoiceDetail(id) {
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

const DetailField = ({ label, value }) => (
  <div>
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 text-sm font-medium text-slate-900">{value ?? "—"}</p>
  </div>
);

const UnitStat = ({ label, value }) => (
  <div className="rounded-lg bg-slate-50 px-3 py-2 text-center">
    <p className="text-sm font-bold tabular-nums text-slate-900">{money(value)}</p>
    <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
  </div>
);

/* ============================================================= */
/* One product line — tracking method, unit price breakdown,      */
/* FOC qty, and (for individual-tracked) the row table paginated   */
/* 10-at-a-time so a 50+ row line doesn't overwhelm the reviewer.  */
/* ============================================================= */

const LineCard = ({ line, taxType }) => {
  const [visible, setVisible] = useState(ROWS_PAGE_SIZE);
  const isIndividual = line.trackingMethod === "individual";
  const b = unitPriceBreakdown(line.unitPrice, line.gstRate, taxType);
  const qty = line.receivedQuantity || 0;
  const lineTotals = {
    basic: round2(b.basic * qty),
    cgst: round2(b.cgst * qty),
    sgst: round2(b.sgst * qty),
    igst: round2(b.igst * qty),
    grandTotal: round2(b.total * qty),
  };
  const selectedFields = (line.productDef?.selectedFields || [])
    .slice()
    .sort((a, c) => (a.order ?? 0) - (c.order ?? 0))
    .map((sf) => sf.fieldDefId)
    .filter(Boolean);
  const rows = line.rows || [];
  const visibleRows = rows.slice(0, visible);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-5 py-3">
        <div>
          <p className="text-sm font-bold text-slate-900">{line.productName}</p>
          <p className="text-xs text-slate-500">{line.categoryName}</p>
        </div>
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
          {isIndividual ? "Individual Tracking" : "Group Tracking"}
        </span>
      </div>

      <div className="p-5">
        <div className="mb-4 rounded-lg border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 p-2.5 shadow-sm">
          <div className="mb-1.5 flex items-center justify-between border-b border-green-200 pb-1">
            <h3 className="text-xs font-semibold text-green-900">
              Per Unit Cost Summary
            </h3>
          </div>

          <div
            className={`grid items-center gap-2 ${taxType === "IGST" ? "grid-cols-3" : "grid-cols-4"
              }`}
          >
            <div className="text-center">
              <p className="text-[10px] font-medium uppercase tracking-wide text-green-700">
                Basic
              </p>
              <p className="mt-0.5 text-sm font-bold text-slate-900">
                ₹{Number(b.basic || 0).toFixed(2)}
              </p>
            </div>

            {taxType === "IGST" ? (
              <div className="text-center border-x border-green-200">
                <p className="text-[10px] font-medium uppercase tracking-wide text-green-700">
                  IGST
                </p>
                <p className="mt-0.5 text-sm font-bold text-slate-900">
                  ₹{Number(b.igst || 0).toFixed(2)}
                </p>
              </div>
            ) : (
              <>
                <div className="text-center border-l border-green-200">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-green-700">
                    CGST
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-slate-900">
                    ₹{Number(b.cgst || 0).toFixed(2)}
                  </p>
                </div>

                <div className="text-center border-l border-green-200">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-green-700">
                    SGST
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-slate-900">
                    ₹{Number(b.sgst || 0).toFixed(2)}
                  </p>
                </div>
              </>
            )}

            <div className="rounded-md bg-green-100 px-2 py-1 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-green-800">
                Total Cost
              </p>
              <p className="mt-0.5 text-base font-extrabold text-green-950">
                ₹{Number(b.total || 0).toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
          <UnitStat label="Basic" value={lineTotals.basic} />
          {taxType === "IGST" ? (
            <UnitStat label="IGST" value={lineTotals.igst} />
          ) : (
            <>
              <UnitStat label="CGST" value={lineTotals.cgst} />
              <UnitStat label="SGST" value={lineTotals.sgst} />
            </>
          )}
          <UnitStat label="Grand Total" value={lineTotals.grandTotal} />
        </div>

        <div className="mb-4 grid grid-cols-3 gap-4">
          <DetailField label="Qty Received (Paid)" value={line.receivedQuantity ?? 0} />
          <DetailField label="FOC Qty" value={line.focQuantity ?? 0} />
          <DetailField label="Rating" value={line.rating?.rating ? `${line.rating.rating} / 5` : "—"} />
        </div>
        {line.rating?.notes && (
          <p className="mb-4 rounded-lg bg-amber-50/60 px-3 py-2 text-xs text-amber-700">{line.rating.notes}</p>
        )}

        {isIndividual && rows.length > 0 && (
          <>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/60 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2 w-10">#</th>
                    <th className="px-3 py-2 w-16">Type</th>
                    {selectedFields.map((fd) => (
                      <th key={fd._id} className="px-3 py-2">{fd.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleRows.map((row, idx) => (
                    <tr key={idx} className={row.isFoc ? "bg-amber-50/60" : ""}>
                      <td className="px-3 py-2 tabular-nums text-slate-400">{idx + 1}</td>
                      <td className="px-3 py-2">
                        {row.isFoc ? (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">FOC</span>
                        ) : (
                          <span className="text-[10px] font-medium text-slate-400">Paid</span>
                        )}
                      </td>
                      {selectedFields.map((fd) => (
                        <td key={fd._id} className="px-3 py-2 text-slate-700">{row.fieldValues?.[fd.code] ?? "—"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > visible && (
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <span>Showing {Math.min(visible, rows.length)} of {rows.length} rows</span>
                <button
                  type="button" onClick={() => setVisible((v) => v + ROWS_PAGE_SIZE)}
                  className="rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-600 shadow-sm transition hover:bg-blue-50"
                >
                  Show {Math.min(ROWS_PAGE_SIZE, rows.length - visible)} more
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

/* ============================================================= */
/* Main                                                            */
/* ============================================================= */

const InvoiceReviewView = ({ invoiceId, onBack, onDone }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [productDefs, setProductDefs] = useState({});

  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const detail = await fetchInvoiceDetail(invoiceId);
        setInvoice(detail);

        const ids = [...new Set((detail.lines || []).map((l) => String(l.productDefinitionId)))];
        const defs = {};
        await Promise.all(
          ids.map(async (id) => {
            try {
              defs[id] = await fetchProductDefinition(id);
            } catch {
              defs[id] = null;
            }
          })
        );
        setProductDefs(defs);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [invoiceId]);

  const lines = useMemo(
    () => (invoice?.lines || []).map((l) => ({ ...l, productDef: productDefs[String(l.productDefinitionId)] })),
    [invoice, productDefs]
  );

  const approve = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`${API_BACKEND_URL}/stock/invoices/${invoiceId}/approve`, { method: "PATCH", credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to approve");
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submitReject = async () => {
    if (!reason.trim()) { setError("A reason is required to reject"); return; }
    setBusy(true); setError(null);
    try {
      const res = await fetch(`${API_BACKEND_URL}/stock/invoices/${invoiceId}/reject`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to reject");
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
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

  const isPending = invoice?.status === "PENDING";
  const fileUrl = invoice?.invoiceFile ? `${API_BACKEND_URL.replace(/\/api\/v1$/, "")}${invoice.invoiceFile}` : "";

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-6 pb-12">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button" onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="min-w-0">
          <h1 className="text-lg font-bold tracking-tight text-slate-900">Review Invoice {invoice?.invoiceNumber}</h1>
          <p className="truncate text-sm text-slate-500">PO {invoice?.poNumber || "—"} · {invoice?.vendorName || "—"}</p>
        </div>
        <span className="ml-auto"><StatusBadge status={invoice?.status} /></span>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      {invoice?.status === "REJECTED" && invoice?.rejectedReason && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Rejected: {invoice.rejectedReason}
        </div>
      )}

      {isPending && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {!rejecting ? (
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button" onClick={approve} disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" /> {busy ? "Approving…" : "Approve"}
              </button>
              <button
                type="button" onClick={() => setRejecting(true)} disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <XCircle className="h-4 w-4" /> Reject
              </button>
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">Reason for rejection</label>
              <textarea
                rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="Explain what needs to be corrected before resubmission"
                className={inputCls}
              />
              <div className="mt-3 flex justify-end gap-2.5">
                <button
                  type="button" onClick={() => { setRejecting(false); setReason(""); }}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button" onClick={submitReject} disabled={busy}
                  className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? "Submitting…" : "Submit Rejection"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <p className="border-b border-slate-100 bg-slate-50/60 px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-700">
          Invoice Details
        </p>
        <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
          <DetailField label="Invoice Date" value={fmt(invoice?.invoiceDate)} />
          <DetailField label="Received By" value={invoice?.receivedByName || invoice?.createdByName} />
          <DetailField label="Basic Amount" value={money(invoice?.basicAmount)} />
          <DetailField
            label="Attachment"
            value={fileUrl ? <a href={fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:underline"><Download className="h-3.5 w-3.5" /> View file</a> : "—"}
          />
          <DetailField label="CGST" value={money(invoice?.cgstAmount)} />
          <DetailField label="SGST" value={money(invoice?.sgstAmount)} />
          <DetailField label="IGST" value={money(invoice?.igstAmount)} />
        </div>
        {invoice?.extraCharges?.length > 0 && (
          <div className="border-t border-slate-100 px-5 py-4">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Extra Charges</p>
            <ul className="space-y-1 text-sm text-slate-700">
              {invoice.extraCharges.map((c, i) => (
                <li key={i} className="flex justify-between"><span>{c.note || "—"}</span><span className="tabular-nums">{money(c.amount)}</span></li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-700">Total Amount</p>
          <p className="text-base font-bold tabular-nums text-slate-900">{money(invoice?.grandTotal)}</p>
        </div>
      </div>

      <div className="space-y-4">
        {lines.map((line) => (
          <LineCard key={line._id || line.quotationItemId} line={line} taxType={invoice?.taxType} />
        ))}
      </div>
    </div>
  );
};

export default InvoiceReviewView;
