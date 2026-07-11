"use client";

import React, { useState, useEffect } from "react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";

const money = (n) => `\u20B9${Number(n || 0).toLocaleString("en-IN")}`;
const fmt = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "\u2014");

const Field = ({ label, value }) => (
  <div>
    <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
    <p className="text-sm text-gray-900">{value || "\u2014"}</p>
  </div>
);

const Card = ({ title, children }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4">
    <p className="mb-3 text-sm font-semibold text-gray-900">{title}</p>
    {children}
  </div>
);

const PODetailsView = ({ context = {}, onBack }) => {
  const { poId, row, quotationNumber, quotationApprovalDate } = context;
  const [po, setPo] = useState(null);
  const [loading, setLoading] = useState(Boolean(poId));
  const [openPath, setOpenPath] = useState(null);
  const leafOf = (c) => String(c || "").split("/").pop().trim();

  useEffect(() => {
    if (!poId) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BACKEND_URL}/stock/purchase-orders/${poId}`, { credentials: "include" });
        const json = await res.json();
        if (json.success) setPo(json.data);
      } finally {
        setLoading(false);
      }
    })();
  }, [poId]);

  const items = po ? po.items : row?.items || [];
  const vendorName = po ? po.vendorName : row?.vendorName;

  if (loading) return <div className="p-6"><div className="h-64 animate-pulse rounded-xl bg-gray-100" /></div>;

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6 pb-10">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">&larr; Back</button>
        <h1 className="text-lg font-semibold text-gray-900">Details</h1>
        {po && <span className="ml-auto rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">{po.poNumber}</span>}
      </div>

      <Card title="Quotation">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Quotation no" value={quotationNumber} />
          <Field label="Approval date" value={fmt(quotationApprovalDate)} />
          <Field label="PO number" value={po?.poNumber || "\u2014"} />
          <Field label="Status" value={po ? po.status : "PO Pending"} />
        </div>
      </Card>

      <Card title="Vendor (supplier)">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Name" value={vendorName} />
          <Field label="GSTIN" value={po?.vendorGstin || row?.gstNumber} />
          <Field label="State" value={po ? `${po.vendorState} (${po.vendorStateCode})` : `${row?.state} (${row?.stateCode})`} />
          <Field label="Phone" value={po?.vendorPhone || row?.phone} />
          <Field label="Email" value={po?.vendorEmail || row?.email} />
          <Field label="Payment terms" value={po?.paymentTerms || row?.paymentTerms} />
          <Field label="Address" value={po?.vendorAddress || row?.address} />
        </div>
      </Card>

      {po && (
        <Card title="Buyer entity">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Alias" value={po.buyerEntity?.alias} />
            <Field label="Name" value={po.buyerEntity?.name} />
            <Field label="GSTIN" value={po.buyerEntity?.gstNumber} />
            <Field label="State" value={`${po.buyerEntity?.state} (${po.buyerEntity?.stateCode})`} />
            <Field label="Requester" value={po.requester} />
            <Field label="PO date" value={fmt(po.poDate)} />
            <Field label="Shipment" value={po.shipmentPreference} />
            <Field label="GST type" value={po.taxType === "CGST_SGST" ? "CGST + SGST" : "IGST"} />
          </div>
        </Card>
      )}

      <Card title="Products">
        <div className="overflow-hidden rounded-lg border border-gray-100">
          <div className="grid grid-cols-[1fr_1fr_50px_80px_50px_80px_90px] gap-2 bg-gray-50 px-3 py-2 text-[11px] text-gray-500">
            <span>Category</span><span>Product</span><span className="text-right">Qty</span><span className="text-right">Rate</span>
            <span className="text-right">GST</span><span className="text-right">GST ₹</span><span className="text-right">Total</span>
          </div>
          {items.map((it, i) => (
            <div key={i} className="border-t border-gray-100">
              <div className="grid grid-cols-[1fr_1fr_50px_80px_50px_80px_90px] items-center gap-2 px-3 py-2 text-sm">
                <span className="flex items-center gap-1 text-gray-900">
                  <span className="truncate">{leafOf(it.categoryName)}</span>
                  <button type="button" title="View full path" onClick={() => setOpenPath(openPath === i ? null : i)}
                    className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-indigo-600">👁</button>
                </span>
                <span className="truncate font-medium text-gray-900">{it.productName}</span>
                <span className="text-right">{it.quantity}</span>
                <span className="text-right">{Number(it.unitPrice).toLocaleString("en-IN")}</span>
                <span className="text-right">{it.gstRate}%</span>
                <span className="text-right">{Number(it.gstAmount).toLocaleString("en-IN")}</span>
                <span className="text-right">{Number(it.lineTotal).toLocaleString("en-IN")}</span>
              </div>
              {openPath === i && (
                <p className="bg-indigo-50 px-3 py-1.5 text-xs text-indigo-700">Path: {it.categoryName}</p>
              )}
            </div>
          ))}
        </div>
      </Card>

      {po && (
        <Card title="Tax & totals">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Taxable" value={money(po.subTotal)} />
            {po.taxType === "CGST_SGST" ? (
              <>
                <Field label="CGST" value={money(po.cgstTotal)} />
                <Field label="SGST" value={money(po.sgstTotal)} />
              </>
            ) : (
              <Field label="IGST" value={money(po.igstTotal)} />
            )}
            <Field label="Grand total" value={money(po.grandTotal)} />
          </div>
          {po.terms && <p className="mt-3 whitespace-pre-line text-xs text-gray-500">Terms: {po.terms}</p>}
        </Card>
      )}

      {row?.skipped?.length > 0 && (
        <Card title="Skipped items">
          {row.skipped.map((s, i) => (
            <p key={i} className="text-sm text-gray-600">
              <span className="line-through">{s.productName} · {s.categoryName}</span>
              <span className="text-gray-400"> — {s.poSkipReason || "no reason"}</span>
            </p>
          ))}
        </Card>
      )}
    </div>
  );
};

export default PODetailsView;