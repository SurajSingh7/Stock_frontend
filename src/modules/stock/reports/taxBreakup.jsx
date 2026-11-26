"use client";

import React from "react";
import { Info } from "lucide-react";
import { Modal, money } from "@/modules/stock/shared/StockSharedUI";

/* ============================================================= */
/* Tax breakup — Basic, CGST, SGST, IGST, GST behind one          */
/* Billing figure.                                                */
/*                                                                */
/* Not columns on the Vendor Outstanding Overview (or its invoice */
/* drill-down) so the money columns fit; the ⓘ beside Billing      */
/* shows them for that row, and for the TOTAL row.                 */
/* ============================================================= */

/* Billing figure with the ⓘ that opens its breakup. */
export const BillingCell = ({ value, onInfo, className = "font-medium text-blue-700" }) => (
  <span className="inline-flex items-center justify-end gap-1.5">
    <span className={className}>{value ? money(value) : <span className="text-slate-300">—</span>}</span>
    {value > 0 && (
      <button
        type="button" onClick={onInfo} title="Basic, extra and GST behind this figure"
        className="rounded-md border border-blue-200 bg-white p-0.5 text-blue-600 shadow-sm transition hover:bg-blue-50"
      >
        <Info className="h-3 w-3" />
      </button>
    )}
  </span>
);

const Line = ({ label, value, tone = "text-slate-900", strong }) => (
  <div className={`flex justify-between py-1.5 ${strong ? "text-base" : "text-sm"}`}>
    <span className={strong ? "font-semibold text-slate-900" : "text-slate-500"}>{label}</span>
    <span className={`tabular-nums ${strong ? "font-bold" : "font-medium"} ${value ? tone : "text-slate-300"}`}>
      {value ? money(value) : "—"}
    </span>
  </div>
);

/* b: { basic, cgst, sgst, igst, gst, billing } — Billing is Basic + GST; misc sits outside it. */
export const BillingBreakupPopup = ({ title, subtitle, b, onClose }) => (
  <Modal onClose={onClose} maxWidth="max-w-sm">
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <p className="text-base font-semibold text-slate-900">{title}</p>
        <p className="text-xs text-slate-500">{subtitle || "Billing breakup"}</p>
      </div>
      <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
    </div>
    <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 px-3">
      <Line label="Basic" value={b.basic} />
      <Line label="CGST" value={b.cgst} tone="text-violet-700" />
      <Line label="SGST" value={b.sgst} tone="text-violet-700" />
      <Line label="IGST" value={b.igst} tone="text-violet-700" />
      <Line label="GST" value={b.gst} tone="text-violet-700" />
      <Line label="= Billing" value={b.billing} tone="text-blue-700" strong />
    </div>
  </Modal>
);
