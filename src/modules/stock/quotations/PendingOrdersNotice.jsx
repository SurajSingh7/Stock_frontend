"use client";

import React, { useState, useEffect } from "react";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import { Modal } from "@/modules/stock/shared/StockSharedUI";

/* ============================================================= */
/* "This category already has stock on its way."                  */
/*                                                                */
/* Orders still open (not fully received, not closed) for the      */
/* same leaf category, across every branch. Shown inline while a   */
/* quotation is built, and as a confirm before it is approved. A   */
/* warning only — it never stops anything.                         */
/* ============================================================= */

const STATUS_LABEL = {
  ENTITY_PENDING: "Order decided",
  PO_PENDING: "PO to be made",
  PO_GENERATED: "PO made",
  PO_APPROVED: "PO approved",
  IN_PROGRESS: "In progress",
  PARTIAL: "Partly received",
};

// Groups keyed by categoryId, refetched whenever the set of categories changes.
export const usePendingOrders = (categoryIds, excludeQuotationId = null) => {
  const key = [...new Set((categoryIds || []).map(String))].sort().join(",");
  const [groups, setGroups] = useState({});
  useEffect(() => {
    if (!key) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const qs = new URLSearchParams({ categoryIds: key });
        if (excludeQuotationId) qs.set("excludeQuotationId", excludeQuotationId);
        const res = await fetch(`${API_BACKEND_URL}/stock/quotations/pending-orders?${qs.toString()}`, { credentials: "include" });
        const json = await res.json();
        if (!cancelled && res.ok && json.success) {
          setGroups(Object.fromEntries((json.data || []).map((g) => [String(g.categoryId), g])));
        }
      } catch {
        // Non-fatal — no warning is shown if this cannot be loaded.
      }
    })();
    return () => { cancelled = true; };
  }, [key, excludeQuotationId]);
  return key ? groups : {};
};

// One-shot fetch for the approve confirm.
export const fetchPendingOrders = async (categoryIds, excludeQuotationId = null) => {
  const ids = [...new Set((categoryIds || []).map(String))];
  if (!ids.length) return [];
  const qs = new URLSearchParams({ categoryIds: ids.join(",") });
  if (excludeQuotationId) qs.set("excludeQuotationId", excludeQuotationId);
  const res = await fetch(`${API_BACKEND_URL}/stock/quotations/pending-orders?${qs.toString()}`, { credentials: "include" });
  const json = await res.json();
  return res.ok && json.success ? json.data || [] : [];
};

const LineRow = ({ l }) => (
  <tr className="border-t border-amber-100">
    <td className="py-1.5 pr-3 font-semibold text-slate-800">{l.poNumber || <span className="font-normal text-slate-400">no PO yet</span>}</td>
    <td className="py-1.5 pr-3 text-slate-700">{l.vendorName || "—"}</td>
    <td className="py-1.5 pr-3 text-slate-500">{l.entity || "—"}</td>
    <td className="py-1.5 pr-3 text-slate-700">{l.productName}</td>
    <td className="py-1.5 pr-3 text-right tabular-nums text-slate-500">{l.ordered}</td>
    <td className="py-1.5 pr-3 text-right tabular-nums text-slate-500">{l.received}</td>
    <td className="py-1.5 pr-3 text-right font-bold tabular-nums text-amber-800">{l.pending}</td>
    <td className="py-1.5 text-xs text-slate-500">{STATUS_LABEL[l.status] || l.status}</td>
  </tr>
);

const LinesTable = ({ lines }) => (
  <div className="overflow-x-auto">
    <table className="w-full min-w-[640px] text-sm">
      <thead>
        <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-amber-700">
          <th className="py-1 pr-3">PO</th>
          <th className="py-1 pr-3">Vendor</th>
          <th className="py-1 pr-3">Entity</th>
          <th className="py-1 pr-3">Product</th>
          <th className="py-1 pr-3 text-right">Ordered</th>
          <th className="py-1 pr-3 text-right">Received</th>
          <th className="py-1 pr-3 text-right">Pending</th>
          <th className="py-1">Status</th>
        </tr>
      </thead>
      <tbody>{lines.map((l, i) => <LineRow key={i} l={l} />)}</tbody>
    </table>
  </div>
);

/* Inline, under one category while the quotation is being built. */
export const PendingOrdersInline = ({ group }) => {
  const [open, setOpen] = useState(false);
  if (!group || !group.lines?.length) return null;
  const orders = new Set(group.lines.map((l) => l.trackingOrderId)).size;
  return (
    <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 text-left">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
        <span className="text-sm text-amber-900">
          <strong>{group.totalPending}</strong> already on order for this category and not received yet
          <span className="text-amber-700"> · {orders} open {orders === 1 ? "order" : "orders"}</span>
        </span>
        <span className="ml-auto text-amber-700">{open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</span>
      </button>
      {open && <div className="mt-2"><LinesTable lines={group.lines} /></div>}
    </div>
  );
};

/* Before approving: every approved category that still has stock on its way. */
export const PendingOrdersConfirm = ({ groups, busy, onCancel, onConfirm }) => (
  <Modal onClose={onCancel} maxWidth="max-w-4xl">
    <div className="mb-3 flex items-start gap-2">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
      <div>
        <p className="text-base font-semibold text-slate-900">Items already pending for these categories</p>
        <p className="text-sm text-slate-500">These orders are not fully received or closed yet. Approving orders more of the same.</p>
      </div>
    </div>
    <div className="max-h-[60vh] space-y-3 overflow-y-auto">
      {groups.map((g) => (
        <div key={g.categoryId} className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
          <p className="mb-1 text-sm font-semibold text-slate-900">
            {g.categoryName || "Category"} <span className="font-normal text-amber-800">· {g.totalPending} pending</span>
          </p>
          <LinesTable lines={g.lines} />
        </div>
      ))}
    </div>
    <div className="mt-4 flex justify-end gap-2">
      <button
        type="button" onClick={onCancel} disabled={busy}
        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="button" onClick={onConfirm} disabled={busy}
        className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-500 disabled:opacity-60"
      >
        {busy ? "Submitting…" : "I understand, approve anyway"}
      </button>
    </div>
  </Modal>
);
