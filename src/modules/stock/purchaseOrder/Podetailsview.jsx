"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import { ArrowLeft, Download, ExternalLink } from "lucide-react";
import { unitLabel } from "@/modules/stock/shared/StockSharedUI";

/* ============================================================= */
/* Constants — SAME tokens as PurchaseOrderPage                   */
/* ============================================================= */

const PAYMENT_TERMS_MAP = {
  IMMEDIATE: "Immediate Payment",
  NET_30: "Payment Within 30 Days",
  NET_60: "Payment Within 60 Days",
  NET_90: "Payment Within 90 Days",
};

const TERMS_SOURCE_LABEL = { VENDOR: "Vendor-specific term", DEFAULT: "Default term", MANUAL: "Manually selected", NONE: "No term configured" };

const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");

const TRUNCATE_LEN = 40;

const cardTitleCls = "text-xs font-bold uppercase tracking-wider text-slate-600";
const fieldLabelCls = "text-xs font-bold uppercase tracking-wider text-slate-500";

/* ---------- inline icon (same as board) ---------- */
const IconX = () => (
  <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
    <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

/* ============================================================= */
/* Portal Modal — same as PurchaseOrderPage                       */
/* ============================================================= */

const Modal = ({ onClose, title, children, maxWidth = "max-w-lg" }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="max-h-full w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/5"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
            <p className="text-base font-semibold tracking-tight text-slate-900">{title}</p>
            <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700">
              <IconX />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body
  );
};

/* ============================================================= */
/* Truncate long text + "...more" popup — same as board           */
/* ============================================================= */

const TruncateText = ({ text, max = TRUNCATE_LEN, title = "Full details", className = "" }) => {
  const [open, setOpen] = useState(false);
  const str = text == null || text === "" ? "—" : String(text);
  if (str.length <= max) return <span className={className}>{str}</span>;
  return (
    <>
      <span className={className}>
        {str.slice(0, max)}...
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
          className="ml-1 text-xs font-semibold text-indigo-600 hover:underline"
        >
          more
        </button>
      </span>
      {open && (
        <Modal onClose={() => setOpen(false)} title={title}>
          <p className="whitespace-pre-wrap break-words text-sm text-slate-900">{str}</p>
        </Modal>
      )}
    </>
  );
};

const sanitizeForPreview = (html) =>
  String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "");

const Field = ({ label, value, className = "" }) => (
  <div className={`min-w-0 ${className}`}>
    <p className={fieldLabelCls}>{label}</p>
    <p className="mt-0.5 truncate text-sm text-slate-900">{value || "—"}</p>
  </div>
);

/* ============================================================= */
/* Main — a genuine READ-ONLY snapshot of the saved PO, sourced   */
/* from GET /purchase-orders/:id (never re-derived / editable).   */
/* ============================================================= */

const PODetailsView = ({ context = {}, onBack }) => {
  const { poId, quotationNumber, quotationApprovalDate } = context;

  const [po, setPo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BACKEND_URL}/stock/purchase-orders/${poId}`, { credentials: "include" });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message || "Failed to load purchase order");
        setPo(json.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [poId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  if (error || !po) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <button
          type="button" onClick={onBack}
          className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error || "Purchase order not found"}
        </div>
      </div>
    );
  }

  const isSplit = po.taxType === "CGST_SGST";
  const buyer = po.buyerEntity || {};
  const pdfUrl = `${API_BACKEND_URL}/stock/purchase-orders/${po._id}/pdf`;

  return (
    <div className="mx-auto max-w-3xl p-6 pb-12">
      {/* header */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button
          type="button" onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">Purchase Order Details</h1>
          <p className="text-sm text-slate-500">
            {po.poNumber} · Supplier <TruncateText text={po.vendorName} title="Vendor name" />
          </p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200">
          {po.status}
        </span>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <a
          href={pdfUrl} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-600 shadow-sm transition hover:bg-indigo-50"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Open PDF
        </a>
        <a
          href={pdfUrl} download={`${po.poNumber}.pdf`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          <Download className="h-3.5 w-3.5" /> Download PDF
        </a>
      </div>

      {(quotationNumber || quotationApprovalDate) && (
        <p className="mb-5 text-xs text-slate-500">
          Source quotation <span className="font-medium text-slate-700">{quotationNumber || "—"}</span>
          {quotationApprovalDate && <> · approved {fmtDate(quotationApprovalDate)}</>}
        </p>
      )}

      {/* buyer + supplier */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="rounded-t-2xl border-b border-slate-100 bg-slate-50/60 px-5 py-3">
          <p className={cardTitleCls}>Buyer &amp; Supplier</p>
        </div>
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <Field label="Buyer entity" value={buyer.alias ? `${buyer.name} (${buyer.alias})` : buyer.name} />
          <Field label="Buyer GSTIN" value={buyer.gstNumber} />
          <Field label="Buyer state" value={buyer.state ? `${buyer.state} (${buyer.stateCode})` : "—"} />
          <Field label="Supplier" value={po.vendorName} />
          <Field label="Supplier GSTIN" value={po.vendorGstin} />
          <Field label="Supplier state" value={po.vendorState ? `${po.vendorState} (${po.vendorStateCode})` : "—"} />
          <Field label="Requester" value={po.requester} />
          <Field label="PO date" value={fmtDate(po.poDate)} />
          <Field label="Shipment preference" value={po.shipmentPreference} />
          <Field label="Payment terms" value={PAYMENT_TERMS_MAP[po.paymentTerms] || po.paymentTerms} />
        </div>
      </section>

      {/* items */}
      <section className="mt-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="rounded-t-2xl border-b border-slate-100 bg-slate-50/60 px-5 py-3">
          <p className={cardTitleCls}>Items</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/60 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2.5 w-10">Sr.</th>
                <th className="px-3 py-2.5">Description</th>
                <th className="px-3 py-2.5">Product</th>
                <th className="px-3 py-2.5 text-right">Qty</th>
                <th className="px-3 py-2.5 text-right">Basic Price</th>
                {isSplit ? (
                  <>
                    <th className="px-3 py-2.5 text-right">CGST</th>
                    <th className="px-3 py-2.5 text-right">SGST</th>
                  </>
                ) : (
                  <th className="px-3 py-2.5 text-right">IGST</th>
                )}
                <th className="px-3 py-2.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(po.items || []).map((it, idx) => (
                <tr key={String(it._id || it.quotationItemId || idx)}>
                  <td className="px-3 py-2.5 align-top tabular-nums text-slate-500">{idx + 1}</td>
                  <td className="px-3 py-2.5 align-top text-slate-700">{it.categoryName}</td>
                  <td className="px-3 py-2.5 align-top font-medium text-slate-900">{it.productName}</td>
                  <td className="px-3 py-2.5 align-top text-right tabular-nums text-slate-700">{it.quantity} {unitLabel(it.unit)}</td>
                  <td className="px-3 py-2.5 align-top text-right tabular-nums text-slate-700">{money(it.taxable)}</td>
                  {isSplit ? (
                    <>
                      <td className="px-3 py-2.5 align-top text-right tabular-nums text-slate-700">{money(it.cgst)}</td>
                      <td className="px-3 py-2.5 align-top text-right tabular-nums text-slate-700">{money(it.sgst)}</td>
                    </>
                  ) : (
                    <td className="px-3 py-2.5 align-top text-right tabular-nums text-slate-700">{money(it.igst)}</td>
                  )}
                  <td className="px-3 py-2.5 align-top text-right tabular-nums font-semibold text-slate-900">{money(it.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* totals — server-authoritative, read directly off the PO */}
        <div className="rounded-b-2xl border-t-2 border-slate-200 bg-slate-50/70 px-5 py-4">
          <div className="ml-auto w-full max-w-xs space-y-1.5 text-sm tabular-nums">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Basic Price</span>
              <span className="font-medium text-slate-900">{money(po.subTotal)}</span>
            </div>
            {isSplit ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">CGST</span>
                  <span className="font-medium text-slate-900">{money(po.cgstTotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">SGST</span>
                  <span className="font-medium text-slate-900">{money(po.sgstTotal)}</span>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">IGST</span>
                <span className="font-medium text-slate-900">{money(po.igstTotal)}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
              <span>Grand Total</span><span>{money(po.grandTotal)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* terms & notes */}
      <section className="mt-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between rounded-t-2xl border-b border-slate-100 bg-slate-50/60 px-5 py-3">
          <p className={cardTitleCls}>Terms &amp; Notes</p>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {TERMS_SOURCE_LABEL[po.termsSource] || "No term configured"}
          </span>
        </div>
        <div className="p-5">
          <p className={fieldLabelCls}>Terms and Conditions</p>
          {po.terms ? (
            <div
              className="mt-1.5 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-sm leading-relaxed text-slate-700 [&_a]:text-indigo-600 [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
              dangerouslySetInnerHTML={{ __html: sanitizeForPreview(po.terms) }}
            />
          ) : (
            <p className="mt-1.5 text-sm text-slate-400">—</p>
          )}

          {po.notes && (
            <>
              <p className={`${fieldLabelCls} mt-4`}>Notes</p>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-700">{po.notes}</p>
            </>
          )}
        </div>
      </section>
    </div>
  );
};

export default PODetailsView;
