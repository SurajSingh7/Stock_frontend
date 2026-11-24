"use client";

import React, { useState } from "react";
import { ChevronRight } from "lucide-react";
import { usePermissions } from "@/context/PermissionContext";
import { Modal, unitLabel } from "@/modules/stock/shared/StockSharedUI";

/* Shared bits of the Lost Items and Dead Items pages. */

/*
  The two families on the same pages:
    lost  LOST / FOUND entries — Stock → Lost Items, Approval → Lost Items
    dead  DEAD entries          — Stock → Dead Items, Approval → Dead Items
*/
export const FAMILIES = {
  lost: {
    items: { title: "Lost Items", path: "/stock/inventory/lost-items", module: "lost-items" },
    approval: { title: "Lost Items Approval", path: "/stock/approval/lost-items", module: "lost-approval" },
  },
  dead: {
    items: { title: "Dead Items", path: "/stock/inventory/dead-items", module: "dead-items" },
    approval: { title: "Dead Items Approval", path: "/stock/approval/dead-items", module: "dead-approval" },
  },
};
export const familyOf = (type) => (type === "DEAD" ? "dead" : "lost");

export const LOST_STATUS = {
  PENDING: { label: "Pending", badge: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500" },
  APPROVED: { label: "Approved", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  REJECTED: { label: "Rejected", badge: "bg-rose-50 text-rose-700 ring-rose-200", dot: "bg-rose-500" },
};

export const LOST_TYPE = {
  LOST: { label: "Lost", cls: "bg-red-50 text-red-700 ring-red-200" },
  FOUND: { label: "Found", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  DEAD: { label: "Dead / Scrapped", cls: "bg-slate-100 text-slate-700 ring-slate-300" },
};

export const TypeBadge = ({ type }) => {
  const t = LOST_TYPE[type] || LOST_TYPE.LOST;
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${t.cls}`}>{t.label}</span>;
};

export const REASON_LABEL = { STORE: "Store", SUBSCRIBER: "Subscriber", EMPLOYEE: "Employee" };
// A found unit is Working or Faulty — a dead one goes on Dead Items.
export const FOUND_LABEL = { WORKING: "Working", FAULTY: "Faulty" };

export const qtyText = (n, unit) => {
  const v = Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });
  return unit === "meter" ? `${v} m` : `${v} ${unitLabel(unit) || "pcs"}`;
};
export const quantityText = (entry) => (entry.quantity || []).map((q) => qtyText(q.quantity, q.unit)).join(" · ") || "—";

// "UB-5021" or "3 products ▸" — the popup lists each with its quantity.
export const ProductsCell = ({ entry }) => {
  const [open, setOpen] = useState(false);
  const products = entry.products || [];
  if (!products.length) return <span className="text-slate-300">—</span>;
  if (products.length === 1) return <span className="text-slate-800">{products[0].name}</span>;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-0.5 font-semibold text-indigo-600 hover:underline">
        {products.length} products <ChevronRight className="h-3.5 w-3.5" />
      </button>
      {open && (
        <Modal title={`${entry.entryNumber} — ${products.length} products`} onClose={() => setOpen(false)} maxWidth="max-w-md">
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {products.map((p) => (
              <li key={p.productDefinitionId} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="text-slate-800">{p.name}</span>
                <span className="font-semibold tabular-nums text-slate-900">{qtyText(p.quantity, p.unit)}</span>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </>
  );
};

// Who may do what in a family — make entries, and decide them.
export const useLostAccess = (family = "lost") => {
  const { permissions, isAdmin, userData } = usePermissions();
  const of = (key) => ((permissions || []).find((m) => m.moduleKey === key)?.actions || []).map((a) => String(a).toUpperCase());
  return {
    canCreate: isAdmin || of(FAMILIES[family].items.module).includes("CREATE"),
    canApprove: isAdmin || of(FAMILIES[family].approval.module).includes("APPROVE"),
    // Only whoever made a rejected entry may fix and resend it.
    isMine: (entry) => !!userData?.employeeCode && entry?.createdBy?.employeeCode === userData.employeeCode,
  };
};
