"use client";

import React, { useState, useEffect } from "react";
import { fetchPurchaseOrder } from "./purchaseOrderApi";
import {
  ArrowLeft, FileText, Building2, Store, Package, ScrollText, User, CalendarDays, Truck,
  Wallet, StickyNote, Link2,
} from "lucide-react";
import { unitLabel } from "@/modules/stock/shared/StockSharedUI";

/* ============================================================= */
/* Constants                                                      */
/* ============================================================= */

const PAYMENT_TERMS_MAP = {
  IMMEDIATE: "Immediate Payment",
  NET_30: "Payment Within 30 Days",
  NET_60: "Payment Within 60 Days",
  NET_90: "Payment Within 90 Days",
};

const TERMS_SOURCE_META = {
  VENDOR: { label: "Vendor-specific term", cls: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
  DEFAULT: { label: "Default term", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  MANUAL: { label: "Manually selected", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  NONE: { label: "No term configured", cls: "bg-slate-100 text-slate-500 ring-slate-200" },
};

// The PO's own status (PO_STATUS), as the board names and colours it.
const PO_STATUS_META = {
  GENERATED: { label: "PO Generated", cls: "bg-sky-50 text-sky-700 ring-sky-200", dot: "bg-sky-500" },
  APPROVED: { label: "PO Approved", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  REJECTED: { label: "PO Rejected", cls: "bg-rose-50 text-rose-700 ring-rose-200", dot: "bg-rose-500" },
};

const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");

const sanitizeForPreview = (html) =>
  String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "");

const labelCls = "mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500";

/* A white card with a tinted header: coloured icon tile, bold title, optional right side. */
const Section = ({ icon: Icon, tone, title, right, children, className = "", flush = false }) => (
  <section className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
    <div className="flex items-center gap-2.5 border-b border-slate-100 bg-linear-to-r from-slate-50 to-white px-5 py-3.5">
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-white shadow-sm ${tone}`}>
        <Icon className="h-4 w-4" />
      </span>
      <p className="flex items-center text-sm font-extrabold uppercase tracking-wider text-slate-800">{title}</p>
      {right && <span className="ml-auto">{right}</span>}
    </div>
    {flush ? children : <div className="p-5">{children}</div>}
  </section>
);

/* One label/value pair, value bold. */
const Field = ({ icon: Icon, iconCls = "text-slate-400", label, value }) => (
  <div className="min-w-0">
    <p className={labelCls}>{Icon && <Icon className={`h-3.5 w-3.5 ${iconCls}`} />}{label}</p>
    <p className="break-words text-sm font-bold text-slate-900">{value || "—"}</p>
  </div>
);

/* Buyer / supplier side by side — each its own tinted panel. */
const Party = ({ icon: Icon, tone, title, name, sub, gstin, state }) => (
  <div className={`rounded-xl p-4 ring-1 ring-inset ${tone.panel}`}>
    <p className={`mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${tone.title}`}>
      <Icon className="h-3.5 w-3.5" /> {title}
    </p>
    <p className="text-base font-extrabold text-slate-900">{name || "—"}</p>
    {sub && <p className="text-xs font-medium text-slate-500">{sub}</p>}
    <div className="mt-3 grid grid-cols-2 gap-3">
      <Field label="GSTIN" value={gstin} />
      <Field label="State" value={state} />
    </div>
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
        setPo(await fetchPurchaseOrder(poId));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [poId]);

  const backBtn = (
    <button
      type="button" onClick={onBack}
      className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
    >
      <ArrowLeft className="h-4 w-4" /> Back
    </button>
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 p-6">
        <div className="h-12 w-72 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-48 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  if (error || !po) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <div className="mb-4">{backBtn}</div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error || "Purchase order not found"}
        </div>
      </div>
    );
  }

  const isSplit = po.taxType === "CGST_SGST";
  const buyer = po.buyerEntity || {};
  const status = PO_STATUS_META[po.status] || { label: po.status, cls: "bg-slate-100 text-slate-700 ring-slate-200", dot: "bg-slate-400" };
  const termsMeta = TERMS_SOURCE_META[po.termsSource] || TERMS_SOURCE_META.NONE;

  return (
    <div className="mx-auto max-w-7xl p-6 pb-12">
      {/* header — Back left, title centred, status right */}
      <div className="mb-5 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div className="justify-self-start">{backBtn}</div>
        <div className="flex min-w-0 flex-col items-center text-center">
          <h1 className="flex items-center gap-2.5 text-xl font-extrabold tracking-tight text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-200">
              <FileText className="h-4 w-4" />
            </span>
            Purchase Order Details
          </h1>
          <p className="mt-1 flex flex-wrap items-center justify-center gap-1.5 text-sm font-medium text-slate-500">
            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700 ring-1 ring-inset ring-indigo-200">{po.poNumber}</span>
            Supplier
            <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-bold text-violet-700 ring-1 ring-inset ring-violet-200">{po.vendorName}</span>
          </p>
        </div>
        <span className={`inline-flex w-fit items-center gap-1.5 justify-self-end rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${status.cls}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
          {status.label}
        </span>
      </div>

      {/* where the PO came from */}
      <div className="mb-5 flex flex-wrap items-center justify-end gap-2.5">
        {(quotationNumber || quotationApprovalDate) && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-200">
            <Link2 className="h-3.5 w-3.5 text-slate-400" />
            Source quotation <span className="font-bold text-indigo-700">{quotationNumber || "—"}</span>
            {quotationApprovalDate && <> · approved <span className="font-semibold text-slate-700">{fmtDate(quotationApprovalDate)}</span></>}
          </span>
        )}
      </div>

      {/* buyer + supplier */}
      <Section icon={Building2} tone="bg-emerald-500" title="Buyer & Supplier">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Party
            icon={Building2} title="Buyer"
            tone={{ panel: "bg-emerald-50/40 ring-emerald-100", title: "text-emerald-700" }}
            name={buyer.name} sub={buyer.alias ? `(${buyer.alias})` : ""}
            gstin={buyer.gstNumber} state={buyer.state ? `${buyer.state} (${buyer.stateCode})` : "—"}
          />
          <Party
            icon={Store} title="Supplier"
            tone={{ panel: "bg-violet-50/40 ring-violet-100", title: "text-violet-700" }}
            name={po.vendorName}
            gstin={po.vendorGstin} state={po.vendorState ? `${po.vendorState} (${po.vendorStateCode})` : "—"}
          />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 lg:grid-cols-4">
          <Field icon={User} iconCls="text-sky-500" label="Requester" value={po.requester} />
          <Field icon={CalendarDays} iconCls="text-sky-500" label="PO date" value={fmtDate(po.poDate)} />
          <Field icon={Truck} iconCls="text-sky-500" label="Shipment preference" value={po.shipmentPreference} />
          <Field icon={Wallet} iconCls="text-sky-500" label="Payment terms" value={PAYMENT_TERMS_MAP[po.paymentTerms] || po.paymentTerms} />
        </div>
      </Section>

      {/* items */}
      <Section
        className="mt-5" flush
        icon={Package} tone="bg-indigo-500"
        title={<>Items <span className="ml-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-700">{(po.items || []).length}</span></>}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-indigo-100 bg-indigo-50/50 text-left text-xs font-bold uppercase tracking-wide text-indigo-900/70">
                <th className="w-12 px-4 py-3">Sr.</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">Basic Price</th>
                {isSplit ? (
                  <>
                    <th className="px-4 py-3 text-right">CGST</th>
                    <th className="px-4 py-3 text-right">SGST</th>
                  </>
                ) : (
                  <th className="px-4 py-3 text-right">IGST</th>
                )}
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(po.items || []).map((it, idx) => (
                <tr key={String(it._id || it.quotationItemId || idx)} className="transition hover:bg-indigo-50/30">
                  <td className="px-4 py-3.5 align-top">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 tabular-nums">{idx + 1}</span>
                  </td>
                  <td className="px-4 py-3.5 align-top font-medium text-slate-600">{it.categoryName}</td>
                  <td className="px-4 py-3.5 align-top font-bold text-slate-900">{it.productName}</td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-right align-top font-semibold tabular-nums text-slate-800">
                    {it.quantity} <span className="text-xs font-medium text-slate-400">{unitLabel(it.unit)}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-right align-top tabular-nums text-slate-700">{money(it.taxable)}</td>
                  {isSplit ? (
                    <>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right align-top tabular-nums text-slate-700">{money(it.cgst)}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right align-top tabular-nums text-slate-700">{money(it.sgst)}</td>
                    </>
                  ) : (
                    <td className="whitespace-nowrap px-4 py-3.5 text-right align-top tabular-nums text-slate-700">{money(it.igst)}</td>
                  )}
                  <td className="whitespace-nowrap px-4 py-3.5 text-right align-top font-extrabold tabular-nums text-slate-900">{money(it.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* totals — server-authoritative, read directly off the PO */}
        <div className="border-t border-slate-200 px-5 py-4">
          <dl className="ml-auto w-full max-w-xs text-sm tabular-nums">
            <div className="flex justify-between py-1">
              <dt className="text-slate-500">Basic Price</dt>
              <dd className="font-semibold text-slate-800">{money(po.subTotal)}</dd>
            </div>
            {isSplit ? (
              <>
                <div className="flex justify-between py-1">
                  <dt className="text-slate-500">CGST</dt>
                  <dd className="font-semibold text-slate-800">{money(po.cgstTotal)}</dd>
                </div>
                <div className="flex justify-between py-1">
                  <dt className="text-slate-500">SGST</dt>
                  <dd className="font-semibold text-slate-800">{money(po.sgstTotal)}</dd>
                </div>
              </>
            ) : (
              <div className="flex justify-between py-1">
                <dt className="text-slate-500">IGST</dt>
                <dd className="font-semibold text-slate-800">{money(po.igstTotal)}</dd>
              </div>
            )}
            <div className="mt-2 flex items-baseline justify-between border-t border-slate-200 pt-3">
              <dt className="font-bold text-slate-900">Grand total</dt>
              <dd className="text-xl font-extrabold text-indigo-700">{money(po.grandTotal)}</dd>
            </div>
          </dl>
        </div>
      </Section>

      {/* terms & notes */}
      <Section
        className="mt-5"
        icon={ScrollText} tone="bg-violet-500" title="Terms & Notes"
        right={
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ${termsMeta.cls}`}>
            {termsMeta.label}
          </span>
        }
      >
        <p className={labelCls}><ScrollText className="h-3.5 w-3.5 text-violet-500" /> Terms and conditions</p>
        {po.terms ? (
          <div
            className="max-h-72 overflow-y-auto rounded-xl border border-violet-100 bg-violet-50/30 px-4 py-3 text-sm leading-relaxed text-slate-700 [&_a]:text-indigo-600 [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: sanitizeForPreview(po.terms) }}
          />
        ) : (
          <p className="text-sm text-slate-400">—</p>
        )}

        {po.notes && (
          <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50/40 px-4 py-3">
            <p className={labelCls}><StickyNote className="h-3.5 w-3.5 text-amber-500" /> Notes</p>
            <p className="whitespace-pre-wrap text-sm font-medium text-slate-800">{po.notes}</p>
          </div>
        )}
      </Section>
    </div>
  );
};

export default PODetailsView;
