"use client";

import React from "react";
import { ExternalLink } from "lucide-react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import { Modal, money } from "@/modules/stock/shared/StockSharedUI";

/* ============================================================= */
/* Two popups for an invoice row: the vendor's own document, and  */
/* how its Net Payable was reached. Shared so every list that      */
/* shows an invoice can offer the same two answers.                */
/* ============================================================= */

// Uploads are served by the backend host itself, outside /api/v1.
export const invoiceFileUrl = (path) =>
  path ? `${API_BACKEND_URL.replace(/\/api\/v1$/, "")}${path}` : "";

const isPdf = (path) => /\.pdf$/i.test(path || "");

/* The uploaded bill — a PDF in a viewer, an image as itself. */
export const InvoiceFilePopup = ({ invoiceNumber, vendorName, file, onClose }) => {
  const url = invoiceFileUrl(file);
  return (
    <Modal onClose={onClose} maxWidth="max-w-5xl">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-slate-900">{invoiceNumber}</p>
          <p className="truncate text-xs text-slate-500">{vendorName || "—"} · invoice as uploaded</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={url} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Open in new tab
          </a>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        {isPdf(file) ? (
          <iframe src={url} title={invoiceNumber} className="h-[75vh] w-full" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- an uploaded file on another host, sized by the viewer
          <img src={url} alt={invoiceNumber} className="mx-auto max-h-[75vh] w-auto object-contain" />
        )}
      </div>
    </Modal>
  );
};

const Line = ({ label, value, tone = "text-slate-900", sign = "", strong, muted }) => (
  <div className={`flex justify-between py-1.5 ${strong ? "text-base" : "text-sm"}`}>
    <span className={strong ? "font-semibold text-slate-900" : muted ? "text-slate-400" : "text-slate-500"}>{label}</span>
    <span className={`tabular-nums ${strong ? "font-bold" : "font-medium"} ${value ? tone : "text-slate-300"}`}>
      {value ? `${sign}${money(value)}` : "—"}
    </span>
  </div>
);

/*
  row: an invoice-list/payments row — derivePayment's fields plus `breakup`.
  Billing + Misc − TDS − Debit Notes = Net Payable, the same order every
  report uses.
*/
export const NetPayablePopup = ({ row, onClose }) => {
  const b = row.breakup || {};
  return (
    <Modal onClose={onClose} maxWidth="max-w-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-slate-900">{row.invoiceNumber}</p>
          <p className="text-xs text-slate-500">Net Payable · {row.vendorName || "—"}</p>
        </div>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
      </div>
      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 px-3">
        <Line label="Basic" value={b.basicAmount} />
        <Line label="+ Extra" value={b.extraChargesTotal} tone="text-slate-700" />
        <Line label="CGST" value={b.cgstAmount} tone="text-violet-700" />
        <Line label="SGST" value={b.sgstAmount} tone="text-violet-700" />
        <Line label="IGST" value={b.igstAmount} tone="text-violet-700" />
        <Line label="GST" value={b.gstAmount} tone="text-violet-700" />
        <Line label="= Billing" value={row.grossAmount} tone="text-blue-700" strong />
        <Line label="+ Misc" value={b.miscTotal} tone="text-sky-700" sign="+" />
        <Line label={`− TDS${row.tdsRate ? ` (${row.tdsRate}%)` : ""}`} value={row.tdsAmount} tone="text-amber-700" sign="−" />
        <Line label="− Debit Notes" value={b.debitTotal} tone="text-rose-700" sign="−" />
        <Line label="= Net Payable" value={row.payable} strong />
      </div>
    </Modal>
  );
};
