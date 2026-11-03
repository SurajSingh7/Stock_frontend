"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { fetchQuotation, reviewQuotation } from "@/modules/stock/quotations/quotationApi";
import {
  ArrowLeft, Check, X, Pencil, Layers, Package, AlertTriangle, Info, User, CalendarDays, StickyNote,
  Star, Trophy, FileText, Sparkles, ArrowDown, ArrowUp,
} from "lucide-react";
import { Modal, unitLabel } from "@/modules/stock/shared/StockSharedUI";
import { formatWarrantyShort } from "@/shared/warranty/warranty";
import { QUOTATION_STATUS_META as STATUS_META } from "@/modules/stock/quotations/quotationStatus";
import {
  fetchPendingOrders, usePendingOrders, PendingOrdersConfirm, PendingOrdersBadge,
} from "@/modules/stock/quotations/PendingOrdersNotice";

/* ============================================================= */
/* Constants — SAME tokens as PurchaseOrderPage                   */
/* ============================================================= */

/*
  GET /quotations/:id already returns the shape this screen draws —
  categories[] -> products[] -> offers[], each offer carrying its L-rank and
  its approved flag. Both the grouping and the ranking are procurement rules,
  not layout, so they belong to the server; this file only renders them.
*/

const DECISION = { APPROVED: "APPROVED", REJECTED: "REJECTED" };
const inr = (n) => `\u20B9${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;


// L-1/L-2/L-3 get a colored badge, L-4+ stays neutral (per spec — only the
// top three ranks are visually escalated).
const RANK_META = {
  1: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  2: "bg-amber-50 text-amber-700 ring-amber-200",
  3: "bg-rose-50 text-rose-700 ring-rose-200",
};
const RankBadge = ({ rank }) => {
  if (!rank) return null;
  const cls = RANK_META[rank] || "bg-slate-100 text-slate-600 ring-slate-200";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${cls}`}>
      {rank === 1 && <Trophy className="h-3 w-3" />}
      L-{rank}
    </span>
  );
};

const backBtnCls =
  "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200";

const StatusBadge = ({ status }) => {
  const m = STATUS_META[status] || STATUS_META.PENDING;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${m.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
};


/* ================================================================= */
/* Review mode — one tab per category, decided one at a time          */
/* ================================================================= */

// Tab shows the last part of the path ("WIRELESS ONT / Single Band" → "Single Band").
const tabLabel = (path = "") => path.split(/\s*[/›>]\s*/).filter(Boolean).pop() || path;

const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const th = "px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-slate-500";
const thRight = `${th} text-right`;

/* One product's offers as a table; one radio-like tick across the whole category. */
// approved: the category's decision is locked as Approved on this pick.
// readOnly: the View page — no tick column, nothing to pick.
const ReviewProductTable = ({ product, selectedVendorId, locked, approved, quotedOn, onPick, readOnly = false }) => {
  const unit = unitLabel(product.unit);
  const picked = !!selectedVendorId;
  const [infoOffer, setInfoOffer] = useState(null);
  return (
    <div className={`overflow-hidden rounded-xl border bg-white shadow-sm transition ${picked ? "border-emerald-300 ring-1 ring-emerald-200" : "border-slate-200"}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-100 bg-white px-4 py-2.5">
        <Package className={`h-4 w-4 ${picked ? "text-emerald-600" : "text-slate-400"}`} />
        <span className="text-sm font-semibold text-slate-900">{product.productName}</span>
        <span className="rounded-full bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200 tabular-nums">
          {product.offers.length} offer{product.offers.length === 1 ? "" : "s"}
        </span>
        {picked && (
          <span className={`ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            approved ? "bg-emerald-600 text-white shadow-sm" : "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
          }`}>
            <Check className="h-3 w-3" /> {approved ? "Approved" : "Selected"}
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60">
              {!readOnly && <th className="w-10 px-3 py-2.5" />}
              <th className={th}>Vendor</th>
              <th className={th}>Warranty</th>
              <th className={th}>Qty</th>
              <th className={thRight}>Unit price</th>
              <th className={th}>GST</th>
              <th className={thRight}>GST amt</th>
              <th className={thRight}>Total</th>
              <th className={th}>
                <span className="inline-flex items-center gap-1" title="Ranked across every product and vendor in this category: warranty first, then price.">
                  Rank <Info className="h-3 w-3 text-slate-400" />
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {product.offers.map((v) => {
              const checked = selectedVendorId === v.vendorId;
              const changedWarranty = v.defaultWarrantyMonths != null && v.warrantyMonths !== v.defaultWarrantyMonths;
              return (
                <tr
                  key={v.vendorId}
                  onClick={() => !locked && !readOnly && onPick(v.vendorId)}
                  className={`transition ${
                    checked
                      ? "bg-emerald-50 shadow-[inset_4px_0_0_0_#10b981]"
                      : locked || readOnly ? "" : "cursor-pointer hover:bg-slate-50"
                  } ${(locked || readOnly) && picked && !checked ? "opacity-60" : ""}`}
                >
                  {!readOnly && (
                    <td className="px-3 py-3 text-center">
                      <input
                        type="checkbox" checked={checked} disabled={locked}
                        onChange={() => onPick(v.vendorId)} onClick={(e) => e.stopPropagation()}
                        title="Approve this vendor for the category"
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </td>
                  )}
                  <td className="px-3 py-3">
                    <p className="flex flex-wrap items-center gap-1.5">
                      <span className={`text-sm font-medium ${checked ? "text-emerald-800" : "text-slate-900"}`}>{v.vendorName}</span>
                      {checked && (
                        <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          approved ? "bg-emerald-600 text-white" : "bg-emerald-100 text-emerald-700"
                        }`}>
                          <Check className="h-3 w-3" /> {approved ? "Approved" : "Selected"}
                        </span>
                      )}
                      {/* approved, but the buyer later chose not to order it */}
                      {v.excluded && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200"
                          title={v.excludedReason}
                        >
                          ⊘ Not ordered{v.excludedReason ? ` — ${v.excludedReason}` : ""}
                        </span>
                      )}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-sm text-slate-700 tabular-nums">
                    {formatWarrantyShort(v.warrantyMonths)}
                    {/* Changed for this quotation only — flagged because ranking puts warranty first. */}
                    {changedWarranty && (
                      <span
                        className="ml-1.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200"
                        title="Warranty was changed for this quotation"
                      >
                        vendor: {formatWarrantyShort(v.defaultWarrantyMonths)}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-sm text-slate-700 tabular-nums">
                    {v.quantity} <span className="text-xs text-slate-400">{unit}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right text-sm font-medium text-slate-900 tabular-nums">{inr(v.unitPrice)}</td>
                  <td className="px-3 py-3 text-sm text-slate-500 tabular-nums">{v.gstRate}%</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right text-sm text-slate-700 tabular-nums">{inr(v.gstAmount)}</td>
                  <td className={`whitespace-nowrap px-3 py-3 text-right text-sm font-semibold tabular-nums ${checked ? "text-emerald-700" : "text-slate-900"}`}>{inr(v.lineTotal)}</td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      <RankBadge rank={v.rank} />
                      <button
                        type="button" onClick={(e) => { e.stopPropagation(); setInfoOffer(v); }}
                        title="Offer details" aria-label="Offer details"
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100 transition hover:bg-indigo-100 hover:text-indigo-700"
                      >
                        <Info className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {infoOffer && (
        <OfferInfoModal product={product} offer={infoOffer} quotedOn={quotedOn} onClose={() => setInfoOffer(null)} />
      )}
    </div>
  );
};

/*
  Rank ⓘ — everything about one offer that the table leaves out: the vendor's
  rating, the amounts behind the total, and the last purchase from this vendor
  (as snapshotted when the quotation was made) compared with today's price.
*/
const OfferInfoModal = ({ product, offer: v, quotedOn, onClose }) => {
  const unit = unitLabel(product.unit);
  const row = "flex items-center justify-between gap-4 py-2 text-sm";
  const hasPrev = v.previousPrice != null;
  const diff = hasPrev ? Number(v.unitPrice) - Number(v.previousPrice) : null;
  const changedWarranty = v.defaultWarrantyMonths != null && v.warrantyMonths !== v.defaultWarrantyMonths;
  return (
    <Modal onClose={onClose} title={v.vendorName} maxWidth="max-w-md">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-500">{product.productName}</span>
        <RankBadge rank={v.rank} />
        {v.averageRating != null ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200 tabular-nums">
            <Star className="h-3 w-3 fill-amber-400 text-amber-500" /> {v.averageRating}
          </span>
        ) : (
          <span className="rounded-full bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-200">Rating N/A</span>
        )}
      </div>

      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">This offer</p>
      <div className="mb-4 divide-y divide-slate-100 rounded-xl border border-slate-200 px-4">
        <div className={row}><span className="text-slate-500">Quoted on</span><span className="font-medium text-slate-900">{fmtDateTime(quotedOn)}</span></div>
        <div className={row}>
          <span className="text-slate-500">Warranty</span>
          <span className="text-right font-medium text-slate-900">
            {formatWarrantyShort(v.warrantyMonths)}
            {changedWarranty && <span className="block text-[11px] font-normal text-amber-700">vendor default {formatWarrantyShort(v.defaultWarrantyMonths)}</span>}
          </span>
        </div>
        <div className={row}><span className="text-slate-500">Quantity</span><span className="font-medium text-slate-900 tabular-nums">{v.quantity} {unit}</span></div>
        <div className={row}><span className="text-slate-500">Unit price</span><span className="font-medium text-slate-900 tabular-nums">{inr(v.unitPrice)}</span></div>
        <div className={row}><span className="text-slate-500">Amount</span><span className="font-medium text-slate-900 tabular-nums">{inr(v.baseAmount)}</span></div>
        <div className={row}><span className="text-slate-500">GST ({v.gstRate}%)</span><span className="font-medium text-slate-900 tabular-nums">{inr(v.gstAmount)}</span></div>
        <div className={row}><span className="font-semibold text-slate-700">Total</span><span className="font-semibold text-slate-900 tabular-nums">{inr(v.lineTotal)}</span></div>
      </div>

      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Last purchase from this vendor</p>
      {hasPrev ? (
        <>
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 px-4">
            <div className={row}><span className="text-slate-500">Quantity</span><span className="font-medium text-slate-900 tabular-nums">{v.previousQuantity ?? "—"} {unit}</span></div>
            <div className={row}><span className="text-slate-500">Unit price</span><span className="font-medium text-slate-900 tabular-nums">{inr(v.previousPrice)}</span></div>
          </div>
          <p className={`mt-3 inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium ${
            diff < 0 ? "bg-emerald-50 text-emerald-700" : diff > 0 ? "bg-rose-50 text-rose-700" : "bg-slate-50 text-slate-600"
          }`}>
            {diff < 0 && <ArrowDown className="h-4 w-4" />}
            {diff > 0 && <ArrowUp className="h-4 w-4" />}
            {diff === 0 ? "Same price as last time" : `${inr(Math.abs(diff))} ${diff < 0 ? "less" : "more"} per unit than last time`}
          </p>
        </>
      ) : (
        <p className="rounded-xl bg-slate-50 px-4 py-4 text-center text-sm text-slate-500">No previous purchase from this vendor.</p>
      )}
    </Modal>
  );
};

/*
  One tab per category, numbered, with its decision on the chip and the bar.
  statusOf(c) → "APPROVED" | "REJECTED" | null (still pending).
*/
const CategoryTabs = ({ categories, activeId, onSelect, statusOf, pendingByCat = {} }) => (
  <div className="border-b border-slate-100 p-3">
    <div className="flex gap-1.5 overflow-x-auto rounded-xl bg-slate-100/80 p-1.5 pb-2.5">
      {categories.map((c, idx) => {
        const status = statusOf(c);
        const decided = status ? DECISION_CHIP[status] : null;
        const active = c.categoryId === activeId;
        const hasPending = !!pendingByCat[String(c.categoryId)]?.lines?.length;
        return (
          <button
            key={c.categoryId} type="button" onClick={() => onSelect(c.categoryId)} title={c.categoryName}
            className={`relative flex min-w-37.5 shrink-0 flex-col gap-1.5 rounded-lg px-3.5 pb-2.5 pt-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 ${
              active
                ? "bg-slate-700 text-white shadow-md shadow-slate-300"
                : "bg-white/60 text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-white hover:text-slate-900"
            }`}
          >
            <span className="flex items-center gap-2">
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums ${
                active ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
              }`}>
                {idx + 1}
              </span>
              <span className="max-w-45 truncate text-sm font-semibold">{tabLabel(c.categoryName)}</span>
              {hasPending && <AlertTriangle className={`h-3.5 w-3.5 shrink-0 animate-blink ${active ? "text-rose-300" : "text-rose-500"}`} />}
              <span className={`ml-auto shrink-0 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                active ? "bg-white/15 text-white" : decided ? decided.cls : "bg-white text-slate-500 ring-1 ring-inset ring-slate-200"
              }`}>
                {decided ? decided.label : "Pending"}
              </span>
            </span>
            {/* pointer under the open tab, aimed at its content below */}
            {active && (
              <span className="absolute -bottom-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 rounded-[2px] bg-slate-700" />
            )}
            {/* green / red once decided */}
            <span className={`h-1 w-full overflow-hidden rounded-full ${active ? "bg-white/25" : "bg-slate-200/70"}`}>
              {decided && <span className={`block h-full w-full rounded-full ${decided.bar}`} />}
            </span>
          </button>
        );
      })}
    </div>
  </div>
);

// A decision as plain text with a small mark — a status, not an action.
const DecisionText = ({ status, remarks }) => (
  <span className={`inline-flex items-center gap-2 text-sm font-semibold ${
    status === DECISION.APPROVED ? "text-emerald-700" : "text-rose-600"
  }`}>
    <span className={`flex h-5 w-5 items-center justify-center rounded-full ${
      status === DECISION.APPROVED ? "bg-emerald-100" : "bg-rose-100"
    }`}>
      {status === DECISION.APPROVED ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
    </span>
    {status === DECISION.APPROVED ? "Approved" : "Rejected"}
    {remarks && <span className="max-w-60 truncate font-normal text-slate-500" title={remarks}>· {remarks}</span>}
  </span>
);

const DECISION_CHIP = {
  [DECISION.APPROVED]: { label: "✓ Approved", cls: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200", bar: "bg-emerald-500" },
  [DECISION.REJECTED]: { label: "✕ Rejected", cls: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200", bar: "bg-rose-500" },
};

const ReviewMode = ({ quotation }) => {
  const router = useRouter();
  const categories = quotation.categories || [];

  const [decisions, setDecisions] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [activeCatId, setActiveCatId] = useState(categories[0]?.categoryId ?? null);
  // Open orders for approved categories, shown as a confirm before submitting.
  const [pendingWarn, setPendingWarn] = useState(null);
  // Same open-order note the creator saw, per category (this quotation excluded).
  const pendingByCat = usePendingOrders(categories.map((c) => c.categoryId), quotation._id);

  const setDecision = (catId, patch) => setDecisions((prev) => ({ ...prev, [catId]: { ...prev[catId], ...patch } }));

  // one (product + vendor) per category — the tick behaves like a radio
  const pickVendor = (catId, productDefinitionId, vendorId) => setDecisions((prev) => {
    const cur = prev[catId] || {};
    const same = cur.sel && cur.sel.productDefinitionId === productDefinitionId && cur.sel.vendorId === vendorId;
    return { ...prev, [catId]: { ...cur, sel: same ? null : { productDefinitionId, vendorId } } };
  });

  // After a decision, open the next category still waiting for one.
  const goToNextUndecided = (catId, next) => {
    const order = categories.map((c) => c.categoryId);
    const start = order.indexOf(catId);
    const rest = [...order.slice(start + 1), ...order.slice(0, start)];
    const target = rest.find((id) => !(next[id]?.status && next[id]?.locked));
    if (target) setActiveCatId(target);
  };

  const approve = (catId) => {
    const d = decisions[catId];
    if (!d?.sel) { toast.error("Pick one product and vendor first"); return; }
    const next = { ...decisions, [catId]: { ...d, status: DECISION.APPROVED, locked: true } };
    setDecisions(next);
    goToNextUndecided(catId, next);
  };
  const reject = (catId) => {
    const next = { ...decisions, [catId]: { ...decisions[catId], status: DECISION.REJECTED, sel: null, locked: true } };
    setDecisions(next);
    goToNextUndecided(catId, next);
  };
  // brings Approve / Reject back for this category so the decision can be
  // changed, until the whole quotation is submitted
  const changeDecision = (catId) => setDecision(catId, { locked: false });

  const decidedCount = categories.filter((c) => decisions[c.categoryId]?.status && decisions[c.categoryId]?.locked).length;
  const approvedCount = categories.filter((c) => decisions[c.categoryId]?.status === DECISION.APPROVED).length;
  const rejectedCount = categories.filter((c) => decisions[c.categoryId]?.status === DECISION.REJECTED).length;
  const allDone = categories.length > 0 && decidedCount === categories.length;

  /*
    Before submitting: if any APPROVED category already has stock on its way
    (open orders not fully received or closed), say so and ask once. Rejected
    categories order nothing, so they are not checked.
  */
  const submit = async () => {
    const open = categories.find((c) => !(decisions[c.categoryId]?.status && decisions[c.categoryId]?.locked));
    if (open) {
      setActiveCatId(open.categoryId);
      toast.error(`Decide ${tabLabel(open.categoryName)} before submitting`);
      return;
    }
    const approvedIds = categories.filter((c) => decisions[c.categoryId]?.status === DECISION.APPROVED).map((c) => c.categoryId);
    setSubmitting(true);
    let pending = [];
    try { pending = await fetchPendingOrders(approvedIds, quotation._id); } catch { pending = []; }
    setSubmitting(false);
    if (pending.length) { setPendingWarn(pending); return; }
    doSubmit();
  };

  const doSubmit = async () => {
    const payload = categories.map((c) => {
      const d = decisions[c.categoryId];
      return d.status === DECISION.APPROVED
        ? { categoryId: c.categoryId, status: DECISION.APPROVED, selection: d.sel, remarks: d.remarks || "" }
        : { categoryId: c.categoryId, status: DECISION.REJECTED, remarks: d.remarks || "" };
    });
    setSubmitting(true);
    try {
      await reviewQuotation(quotation._id, payload);
      toast.success("Decision submitted");
      // Back to the approval list so it reloads (fresh list + tab counts).
      router.push("/stock/approval/quotations");
    } catch (err) {
      toast.error(err.message || "Failed to submit");
      setPendingWarn(null);
    } finally { setSubmitting(false); }
  };

  const cat = categories.find((c) => c.categoryId === activeCatId) || categories[0];
  const d = (cat && decisions[cat.categoryId]) || {};
  const isLocked = !!(d.status && d.locked);
  const offerCount = cat ? cat.products.reduce((n, p) => n + p.offers.length, 0) : 0;

  // The best-ranked offer of the open category, and the one ticked (if any).
  const offersOf = (c) => c.products.flatMap((p) => p.offers.map((v) => ({ ...v, product: p })));
  const best = cat ? offersOf(cat).find((v) => v.rank === 1) : null;
  const chosen = cat && d.sel
    ? offersOf(cat).find((v) => v.product.productDefinitionId === d.sel.productDefinitionId && v.vendorId === d.sel.vendorId)
    : null;

  return (
    <div>
      {/* header */}
      <div className="mb-5 flex flex-wrap items-center gap-4">
        <button type="button" onClick={() => router.push("/stock/approval/quotations")} className={backBtnCls}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100">
          <FileText className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">{quotation.quotationNumber}</h1>
          <p className="text-sm text-slate-500">Decide every category, then submit once.</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="inline-flex items-center gap-1.5 text-slate-500">
            <User className="h-4 w-4 text-indigo-500" />
            Created by <span className="font-semibold text-slate-900">{quotation.createdBy?.name || "—"}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-slate-500">
            <CalendarDays className="h-4 w-4 text-sky-500" />
            <span className="font-semibold text-slate-900">{fmtDateTime(quotation.createdAt)}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Awaiting decision
          </span>
        </div>
      </div>

      {quotation.notes ? (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
          <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <p className="whitespace-pre-wrap"><span className="font-medium text-slate-900">Notes · </span>{quotation.notes}</p>
        </div>
      ) : null}

      {pendingWarn && (
        <PendingOrdersConfirm
          groups={pendingWarn}
          busy={submitting}
          onCancel={() => setPendingWarn(null)}
          onConfirm={doSubmit}
        />
      )}

      {cat && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <CategoryTabs
            categories={categories}
            activeId={cat.categoryId}
            onSelect={setActiveCatId}
            statusOf={(c) => {
              const cd = decisions[c.categoryId];
              return cd?.status && cd.locked ? cd.status : null;
            }}
            pendingByCat={pendingByCat}
          />

          {/* the open category */}
          <div className="flex flex-wrap items-center gap-3 border-y border-slate-200 bg-slate-100/80 px-5 py-3.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-emerald-600 shadow-sm ring-1 ring-inset ring-emerald-100">
              <Layers className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900" title={cat.categoryName}>{cat.categoryName}</p>
              <p className="text-xs text-slate-500">
                {cat.products.length} product{cat.products.length === 1 ? "" : "s"} · {offerCount} offer{offerCount === 1 ? "" : "s"}
              </p>
            </div>
            <PendingOrdersBadge group={pendingByCat[String(cat.categoryId)]} categoryName={cat.categoryName} />
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              {isLocked ? (
                <>
                  <DecisionText status={d.status} remarks={d.remarks} />
                  <button
                    type="button" onClick={() => changeDecision(cat.categoryId)}
                    title="Edit decision" aria-label="Edit decision"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-100 transition hover:bg-amber-100 hover:text-amber-700"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  {best && !(chosen && chosen.rank === 1) && (
                    <button
                      type="button"
                      onClick={() => pickVendor(cat.categoryId, best.product.productDefinitionId, best.vendorId)}
                      title={`Select the L-1 offer: ${best.product.productName} from ${best.vendorName}`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200 transition hover:bg-emerald-100"
                    >
                      <Sparkles className="h-4 w-4" /> Select L-1
                    </button>
                  )}
                  <input
                    type="text" value={d.remarks || ""} onChange={(e) => setDecision(cat.categoryId, { remarks: e.target.value })}
                    placeholder="Remarks (optional)"
                    className="w-56 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                  <button
                    type="button" onClick={() => reject(cat.categoryId)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-600 shadow-sm transition hover:border-rose-300 hover:bg-rose-50"
                  >
                    <X className="h-4 w-4" /> Reject
                  </button>
                  <button
                    type="button" onClick={() => approve(cat.categoryId)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                  >
                    <Check className="h-4 w-4" /> Approve
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="space-y-4 rounded-b-2xl bg-slate-50 p-4">
            {cat.products.map((p) => (
              <ReviewProductTable
                key={p.productDefinitionId}
                product={p}
                selectedVendorId={d.sel?.productDefinitionId === p.productDefinitionId ? d.sel.vendorId : null}
                locked={isLocked}
                approved={isLocked && d.status === DECISION.APPROVED}
                quotedOn={quotation.createdAt}
                onPick={(vendorId) => pickVendor(cat.categoryId, p.productDefinitionId, vendorId)}
              />
            ))}

          </div>
        </div>
      )}

      {/* sticky action bar — progress on the left, Submit on the right */}
      <div className="sticky bottom-0 z-20 -mx-6 mt-6 border-t border-slate-200 bg-white/95 px-6 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          {/* one segment per category — green approved, red rejected, grey waiting */}
          <div className="flex items-center gap-1">
            {categories.map((c) => {
              const cd = decisions[c.categoryId] || {};
              const decided = cd.status && cd.locked ? DECISION_CHIP[cd.status] : null;
              return (
                <button
                  key={c.categoryId} type="button" onClick={() => setActiveCatId(c.categoryId)} title={c.categoryName}
                  className={`h-2 w-7 rounded-full transition hover:opacity-80 ${decided ? decided.bar : "bg-slate-200"} ${
                    c.categoryId === cat?.categoryId ? "ring-2 ring-slate-400 ring-offset-1" : ""
                  }`}
                />
              );
            })}
          </div>
          <p className="text-sm text-slate-600">
            <span className={`font-semibold ${allDone ? "text-emerald-600" : "text-amber-600"}`}>
              {decidedCount} of {categories.length} categories decided
            </span>
            {approvedCount > 0 && <span className="text-emerald-700"> · {approvedCount} approved</span>}
            {rejectedCount > 0 && <span className="text-rose-600"> · {rejectedCount} rejected</span>}
          </p>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button" onClick={() => router.push("/stock/approval/quotations")} disabled={submitting}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button" onClick={submit} disabled={submitting}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Submitting…" : "Submit approval"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ================================================================= */
/* View mode — the review layout, read-only, with the decisions taken  */
/* ================================================================= */

const ViewMode = ({ quotation, backTo }) => {
  const router = useRouter();
  const categories = quotation.categories || [];
  const [activeCatId, setActiveCatId] = useState(categories[0]?.categoryId ?? null);
  const cat = categories.find((c) => c.categoryId === activeCatId) || categories[0];
  const offerCount = cat ? cat.products.reduce((n, p) => n + p.offers.length, 0) : 0;
  const decisionOf = (c) => (c.status === DECISION.APPROVED || c.status === DECISION.REJECTED ? c.status : null);

  return (
    <div>
      {/* header */}
      <div className="mb-5 flex flex-wrap items-center gap-4">
        <button type="button" onClick={() => router.push(backTo)} className={backBtnCls}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100">
          <FileText className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">{quotation.quotationNumber}</h1>
          <p className="text-sm text-slate-500">Complete quotation details</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="inline-flex items-center gap-1.5 text-slate-500">
            <User className="h-4 w-4 text-indigo-500" />
            Created by <span className="font-semibold text-slate-900">{quotation.createdBy?.name || "—"}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-slate-500">
            <CalendarDays className="h-4 w-4 text-sky-500" />
            <span className="font-semibold text-slate-900">{fmtDateTime(quotation.createdAt)}</span>
          </span>
          <StatusBadge status={quotation.status} />
        </div>
      </div>

      {quotation.notes ? (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
          <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <p className="whitespace-pre-wrap"><span className="font-medium text-slate-900">Notes · </span>{quotation.notes}</p>
        </div>
      ) : null}

      {cat && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <CategoryTabs
            categories={categories}
            activeId={cat.categoryId}
            onSelect={setActiveCatId}
            statusOf={decisionOf}
          />

          {/* the open category */}
          <div className="flex flex-wrap items-center gap-3 border-y border-slate-200 bg-slate-100/80 px-5 py-3.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-emerald-600 shadow-sm ring-1 ring-inset ring-emerald-100">
              <Layers className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900" title={cat.categoryName}>{cat.categoryName}</p>
              <p className="text-xs text-slate-500">
                {cat.products.length} product{cat.products.length === 1 ? "" : "s"} · {offerCount} offer{offerCount === 1 ? "" : "s"}
              </p>
            </div>
            <div className="ml-auto">
              {decisionOf(cat) ? (
                <DecisionText status={cat.status} remarks={cat.remarks} />
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Awaiting decision
                </span>
              )}
            </div>
          </div>

          <div className="space-y-4 rounded-b-2xl bg-slate-50 p-4">
            {cat.products.map((p) => (
              <ReviewProductTable
                key={p.productDefinitionId}
                product={p}
                selectedVendorId={p.offers.find((v) => v.isApproved)?.vendorId ?? null}
                approved
                readOnly
                quotedOn={quotation.createdAt}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ================================================================= */
/* Wrapper                                                            */
/* ================================================================= */

const QuotationApproval = ({ quotationId, mode = "review" }) => {
  const [quotation, setQuotation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      setQuotation(await fetchQuotation(quotationId));
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }, [quotationId]);

  useEffect(() => { load(); }, [load]);

  if (loading)
    return (
      <div className="min-h-screen bg-slate-50/60 p-6">
        <div className="mx-auto max-w-5xl animate-pulse space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 rounded-2xl bg-slate-100" />)}
        </div>
      </div>
    );

  if (error)
    return (
      <div className="min-h-screen bg-slate-50/60 p-6">
        <div className="mx-auto max-w-5xl rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      </div>
    );

  if (!quotation) return null;

  const isViewMode = mode === "view";
  const showReview = !isViewMode && quotation.status === "PENDING";
  // "View" is reached from two different origins (the Quotation List's View
  // button, and the Quotation Approval list's View button for non-pending
  // rows) that both land on the SAME /stock/quotations/[id]/view URL, so the
  // origin has to travel as a ?from= query param — the Approval list appends
  // it, the plain Quotation List doesn't, and Back returns to wherever the
  // user actually came from instead of a hardcoded destination.
  // Read the query param directly (rather than next/navigation's
  // useSearchParams) so this client component doesn't force a Suspense
  // boundary requirement onto its page.js at build time.
  const cameFromApproval =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("from") === "approval";
  const backTo = isViewMode
    ? (cameFromApproval ? "/stock/approval/quotations" : "/stock/purchase/quotations")
    : "/stock/approval/quotations";

  return (
    <div className="min-h-screen bg-slate-50/60">
      <div className={`mx-auto max-w-7xl p-6 ${showReview ? "pb-0" : "pb-12"}`}>
        {showReview ? (
          <ReviewMode quotation={quotation} />
        ) : (
          <ViewMode quotation={quotation} backTo={backTo} />
        )}
      </div>
    </div>
  );
};

export default QuotationApproval;