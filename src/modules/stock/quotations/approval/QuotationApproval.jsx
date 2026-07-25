"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import { ArrowLeft, Check, X, Pencil } from "lucide-react";
import { money } from "@/modules/stock/shared/StockSharedUI";

/* ============================================================= */
/* Constants — SAME tokens as PurchaseOrderPage                   */
/* ============================================================= */

const DECISION = { APPROVED: "APPROVED", REJECTED: "REJECTED" };
const idOf = (v) => String(v?._id || v || "");
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const inr = (n) => `\u20B9${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const baseOf = (it) => round2((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0));
const gstOf = (it) => (it.gstAmount != null ? Number(it.gstAmount) : round2((baseOf(it) * (Number(it.gstRate) || 0)) / 100));
const totalOf = (it) => (it.lineTotal != null ? Number(it.lineTotal) : round2(baseOf(it) + gstOf(it)));

const STATUS_META = {
  PENDING: { label: "Pending", badge: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500" },
  APPROVED: { label: "Approved", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  PARTIALLY_APPROVED: { label: "Partially approved", badge: "bg-indigo-50 text-indigo-700 ring-indigo-200", dot: "bg-indigo-500" },
  REJECTED: { label: "Rejected", badge: "bg-rose-50 text-rose-700 ring-rose-200", dot: "bg-rose-500" },
};

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
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${cls}`}>
      L-{rank}
    </span>
  );
};

/*
  Ranking is computed per LEAF CATEGORY, across every vendor-product
  combination inside that category — not per product — within a SINGLE
  quotation only (never across quotations). Priority: higher warrantyYears
  first, then lower unitPrice. Array.sort is spec-stable, so equal
  warranty+price ties fall back to insertion (bid) order for free. Returns a
  Map of item._id -> rank (1-based), purely derived, never persisted.
*/
const computeCategoryRanks = (items = []) => {
  const byCategory = new Map();
  items.forEach((it) => {
    const cId = idOf(it.categoryId) || it.categoryName;
    const list = byCategory.get(cId) || [];
    list.push(it);
    byCategory.set(cId, list);
  });
  const rankMap = new Map();
  byCategory.forEach((list) => {
    const sorted = [...list].sort(
      (a, b) =>
        (Number(b.warrantyYears) || 0) - (Number(a.warrantyYears) || 0) ||
        (Number(a.unitPrice) || 0) - (Number(b.unitPrice) || 0)
    );
    sorted.forEach((it, idx) => rankMap.set(idOf(it._id), idx + 1));
  });
  return rankMap;
};

const cardTitleCls = "text-xs font-bold uppercase tracking-wider text-slate-600";
const fieldLabelCls = "text-xs font-bold uppercase tracking-wider text-slate-600";
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

/* items[] → CATEGORY → PRODUCT → [vendor offers with full numbers] */
const groupCatProductVendor = (items = []) => {
  const cats = new Map();
  items.forEach((it) => {
    const cId = idOf(it.categoryId) || it.categoryName;
    if (!cats.has(cId)) cats.set(cId, { categoryId: cId, categoryName: it.categoryName || "", products: new Map() });
    const cat = cats.get(cId);
    const pId = idOf(it.productDefinitionId);
    if (!cat.products.has(pId)) cat.products.set(pId, { productDefinitionId: pId, productName: it.productName || "", vendors: [] });
    cat.products.get(pId).vendors.push({
      itemId: idOf(it._id),
      vendorId: idOf(it.vendorId),
      vendorName: it.vendorName || "",
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      warrantyYears: it.warrantyYears,
      gstRate: it.gstRate,
      gstAmount: gstOf(it),
      lineTotal: totalOf(it),
    });
  });
  return [...cats.values()].map((c) => ({ ...c, products: [...c.products.values()] }));
};

// Soft row background per rank (L-1/L-2/L-3 only — L-4+ stays default/hover).
const RANK_ROW_BG = {
  1: "bg-emerald-50",
  2: "bg-orange-50",
  3: "bg-rose-50",
};

/* one vendor offer line — same layout in review / details / view */
const VendorLine = ({ v, selectable = false, checked = false, disabled = false, onToggle, won = false, rank }) => (
  <div
    className={`flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg px-3 py-2 text-sm transition ${
      RANK_ROW_BG[rank] || "hover:bg-slate-50"
    } ${won || checked ? "ring-1 ring-inset ring-emerald-300" : ""}`}
  >
    <span className="flex min-w-[150px] items-center gap-2 font-semibold text-slate-900">
      {selectable && (
        <input
          type="checkbox" checked={checked} disabled={disabled} onChange={onToggle}
          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
        />
      )}
      {won && <Check className="h-4 w-4 text-emerald-600" />}
      {v.vendorName}
      {won && (
        <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">approved</span>
      )}
    </span>
    <span className="text-xs text-slate-600">Qty <span className="font-semibold text-slate-900 tabular-nums">{v.quantity}</span></span>
    <span className="text-xs text-slate-600">Unit price <span className="font-semibold text-slate-900 tabular-nums">{inr(v.unitPrice)}</span></span>
    <span className="text-xs text-slate-600">
      Warranty <span className="font-semibold text-slate-900 tabular-nums">{v.warrantyYears ? `${v.warrantyYears} yr${v.warrantyYears === 1 ? "" : "s"}` : "—"}</span>
    </span>
    <span className="text-xs text-slate-600">GST <span className="font-semibold text-slate-900 tabular-nums">{v.gstRate}%</span></span>
    <span className="text-xs text-slate-600">GST ₹ <span className="font-semibold text-slate-900 tabular-nums">{inr(v.gstAmount)}</span></span>
    <span className="ml-auto flex items-center gap-2 text-xs text-slate-600">
      Total <span className="text-sm font-bold text-slate-900 tabular-nums">{inr(v.lineTotal)}</span>
      <RankBadge rank={rank} />
    </span>
  </div>
);

/* category card shell — colored by decision */
const CategoryCard = ({ categoryName, statusLabel, tone, remarks, children }) => {
  const border = tone === "red" ? "border-rose-200" : tone === "green" ? "border-emerald-200" : "border-slate-200";
  const head = tone === "red" ? "bg-rose-50" : tone === "green" ? "bg-emerald-50" : "bg-slate-50/60";
  const badge =
    tone === "red"
      ? "bg-rose-50 text-rose-700 ring-rose-200"
      : tone === "green"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : "bg-amber-50 text-amber-700 ring-amber-200";
  const dot = tone === "red" ? "bg-rose-500" : tone === "green" ? "bg-emerald-500" : "bg-amber-500";

  return (
    <div className={`mb-4 rounded-2xl border ${border} bg-white shadow-sm`}>
      <div className={`flex items-center justify-between rounded-t-2xl border-b border-slate-100 px-5 py-3 ${head}`}>
        <span className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
          {categoryName}
        </span>
        {statusLabel && (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${badge}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
            {statusLabel}
          </span>
        )}
      </div>
      {remarks ? <p className="px-5 pt-3 text-xs font-medium text-rose-600">Reason · {remarks}</p> : null}
      <div className="p-5 pt-4">{children}</div>
    </div>
  );
};

/* product block — name, then its vendor lines */
const ProductBlock = ({ product, children, highlight = false }) => (
  <div className={`mb-3 rounded-xl border p-3 last:mb-0 transition ${highlight ? "border-emerald-200 bg-emerald-50/40" : "border-slate-100"}`}>
    <p className="mb-2 border-b border-slate-100 pb-2 text-sm font-bold text-slate-900">{product.productName}</p>
    <div className="space-y-0.5">{children}</div>
  </div>
);

const Card = ({ title, children }) => (
  <div className="mb-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="rounded-t-2xl border-b border-slate-100 bg-slate-50/60 px-5 py-3">
      <p className={cardTitleCls}>{title}</p>
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const Field = ({ label, value }) => (
  <div className="min-w-0">
    <p className={fieldLabelCls}>{label}</p>
    <p className="mt-0.5 truncate text-sm text-slate-900">{value || "\u2014"}</p>
  </div>
);

/* ================================================================= */
/* Review mode — category → product → vendor lines (selectable)       */
/* ================================================================= */

const ReviewMode = ({ quotation, onDone }) => {
  const router = useRouter();
  const categories = groupCatProductVendor(quotation.items);
  const rankMap = computeCategoryRanks(quotation.items);

  const [decisions, setDecisions] = useState({});
  const [rowError, setRowError] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const setDecision = (catId, patch) => setDecisions((prev) => ({ ...prev, [catId]: { ...prev[catId], ...patch } }));

  // one (product + vendor) per category — checkbox behaves like a radio
  const pickVendor = (catId, productDefinitionId, vendorId) => setDecisions((prev) => {
    const cur = prev[catId] || {};
    const same = cur.sel && cur.sel.productDefinitionId === productDefinitionId && cur.sel.vendorId === vendorId;
    return { ...prev, [catId]: { ...cur, sel: same ? null : { productDefinitionId, vendorId } } };
  });

  const approve = (catId) => {
    const d = decisions[catId];
    if (!d?.sel) { setRowError((p) => ({ ...p, [catId]: "Pick one product and vendor first" })); return; }
    setRowError((p) => ({ ...p, [catId]: null }));
    setDecision(catId, { status: DECISION.APPROVED, locked: true });
  };
  const reject = (catId) => {
    setRowError((p) => ({ ...p, [catId]: null }));
    setDecision(catId, { status: DECISION.REJECTED, sel: null, locked: true });
  };
  // brings the Approve/Reject buttons back for this category so the
  // decision can be changed, until the whole quotation is submitted
  const changeDecision = (catId) => setDecision(catId, { locked: false });

  const allDecided = categories.every((c) => decisions[c.categoryId]?.status);
  const allLocked = categories.every((c) => decisions[c.categoryId]?.status && decisions[c.categoryId]?.locked);

  const submit = async () => {
    if (!allDecided) { setError("Every category must be approved or rejected"); return; }
    if (!allLocked) { setError("Finish changing decisions before submitting"); return; }
    const payload = categories.map((c) => {
      const d = decisions[c.categoryId];
      return d.status === DECISION.APPROVED
        ? { categoryId: c.categoryId, status: DECISION.APPROVED, selection: d.sel, remarks: d.remarks || "" }
        : { categoryId: c.categoryId, status: DECISION.REJECTED, remarks: d.remarks || "" };
    });
    setSubmitting(true); setError(null);
    try {
      const res = await fetch(`${API_BACKEND_URL}/stock/quotations/${quotation._id}/review`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ decisions: payload }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to submit");
      // Stay on Quotation Approval — go back to the list so it reloads
      // (fresh list + tab counts), rather than navigating away to Tracking Orders.
      router.push("/stock/quotations/approval");
    } catch (err) { setError(err.message); window.scrollTo({ top: 0, behavior: "smooth" }); } finally { setSubmitting(false); }
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => router.push("/stock/quotations/approval")} className={backBtnCls}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back to list
        </button>
        <div>
          <p className="text-base font-semibold tracking-tight text-slate-900">{quotation.quotationNumber}</p>
          <p className="text-xs text-slate-500">Decide every category, then submit once.</p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Awaiting decision
        </span>
      </div>

      {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      {categories.map((cat) => {
        const d = decisions[cat.categoryId] || {};
        const isLocked = d.status && d.locked;
        const tone = d.status === DECISION.APPROVED ? "green" : d.status === DECISION.REJECTED ? "red" : "gray";
        const statusLabel = d.status === DECISION.APPROVED ? "Approved" : d.status === DECISION.REJECTED ? "Rejected" : "Pending";
        return (
          <CategoryCard key={cat.categoryId} categoryName={cat.categoryName} statusLabel={statusLabel} tone={tone}>
            {cat.products.map((p) => {
              const isSelProduct = d.sel?.productDefinitionId === p.productDefinitionId;
              return (
                <ProductBlock key={p.productDefinitionId} product={p} highlight={isSelProduct}>
                  {p.vendors.map((v) => {
                    const checked = d.sel?.productDefinitionId === p.productDefinitionId && d.sel?.vendorId === v.vendorId;
                    return (
                      <VendorLine
                        key={v.vendorId} v={v} selectable checked={!!checked}
                        disabled={isLocked} rank={rankMap.get(v.itemId)}
                        onToggle={() => pickVendor(cat.categoryId, p.productDefinitionId, v.vendorId)}
                      />
                    );
                  })}
                </ProductBlock>
              );
            })}

            {d.status === DECISION.REJECTED && (
              <input
                type="text" value={d.remarks || ""} onChange={(e) => setDecision(cat.categoryId, { remarks: e.target.value })}
                placeholder="Reason (optional)" disabled={isLocked}
                className="mb-2 mt-1 w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-rose-300 shadow-sm transition focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100 disabled:cursor-not-allowed disabled:bg-rose-50/40 disabled:text-slate-500"
              />
            )}
            {rowError[cat.categoryId] && <p className="mb-2 text-xs font-medium text-rose-600">{rowError[cat.categoryId]}</p>}

            {isLocked ? (
              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-4">
                <span
                  className={`inline-flex items-center gap-1.5 text-sm font-semibold ${
                    d.status === DECISION.APPROVED ? "text-emerald-700" : "text-rose-600"
                  }`}
                >
                  {d.status === DECISION.APPROVED ? (
                    <>
                      <Check className="h-4 w-4" /> Approved
                    </>
                  ) : (
                    <>
                      <X className="h-4 w-4" /> Rejected{d.remarks ? ` — ${d.remarks}` : ""}
                    </>
                  )}
                </span>
                <button
                  type="button" onClick={() => changeDecision(cat.categoryId)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
                >
                  <Pencil className="h-3.5 w-3.5" /> Change
                </button>
              </div>
            ) : (
              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-4">
                <span className="text-xs text-slate-500">Pick one product · one vendor</span>
                <div className="flex gap-2">
                  <button
                    type="button" onClick={() => reject(cat.categoryId)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3.5 py-1.5 text-sm font-medium text-rose-600 shadow-sm transition hover:border-rose-300 hover:bg-rose-50"
                  >
                    <X className="h-3.5 w-3.5" /> Reject
                  </button>
                  <button
                    type="button" onClick={() => approve(cat.categoryId)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                  >
                    <Check className="h-3.5 w-3.5" /> Approve
                  </button>
                </div>
              </div>
            )}
          </CategoryCard>
        );
      })}

      {/* decision summary */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="rounded-t-2xl border-b border-slate-100 bg-slate-50/60 px-5 py-3">
          <p className={cardTitleCls}>Decision summary</p>
        </div>
        <div className="p-5">
          <div className="mb-4 flex flex-col gap-1.5">
            {categories.map((c) => {
              const d = decisions[c.categoryId] || {};
              if (d.status === DECISION.APPROVED)
                return (
                  <span key={c.categoryId} className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                    <Check className="h-3.5 w-3.5" /> {c.categoryName} — approved
                  </span>
                );
              if (d.status === DECISION.REJECTED)
                return (
                  <span key={c.categoryId} className="inline-flex items-center gap-1.5 text-sm font-medium text-rose-600">
                    <X className="h-3.5 w-3.5" /> {c.categoryName} — rejected
                  </span>
                );
              return (
                <span key={c.categoryId} className="inline-flex items-center gap-1.5 text-sm text-slate-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-300" /> {c.categoryName} — no decision yet
                </span>
              );
            })}
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <span className="text-xs text-slate-500">
              {allDecided ? "All categories decided" : "Every category must be decided before you can submit"}
            </span>
            <button
              type="button" onClick={submit} disabled={!allDecided || !allLocked || submitting}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Submitting\u2026" : "Submit approval"}
            </button>
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Pick one vendor per product. Rankings are calculated across all vendor-product combinations within the
        selected leaf category, using Warranty first and Price second.
      </p>
    </div>
  );
};

/* ================================================================= */
/* Details mode — same category → product → vendor layout, read-only  */
/* ================================================================= */

const DetailsMode = ({ quotation, backTo }) => {
  const router = useRouter();
  const items = quotation.items || [];
  const categories = groupCatProductVendor(items);
  const rankMap = computeCategoryRanks(items);

  const caByCat = new Map((quotation.categoryApprovals || []).map((ca) => [idOf(ca.categoryId) || ca.categoryName, ca]));
  const approvedPairs = new Set(
    (quotation.categoryApprovals || []).flatMap((ca) => (ca.selections || []).map((s) => `${idOf(s.productDefinitionId)}::${idOf(s.vendorId)}`))
  );

  const totalBase = round2(items.reduce((s, it) => s + baseOf(it), 0));
  const totalGst = round2(items.reduce((s, it) => s + gstOf(it), 0));
  const grand = round2(items.reduce((s, it) => s + totalOf(it), 0));

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => router.push(backTo)} className={backBtnCls}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back to list
        </button>
        <div>
          <p className="text-base font-semibold tracking-tight text-slate-900">{quotation.quotationNumber}</p>
          <p className="text-xs text-slate-500">Complete quotation details</p>
        </div>
        <span className="ml-auto"><StatusBadge status={quotation.status} /></span>
      </div>

      <Card title="Quotation information">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Quotation No" value={quotation.quotationNumber} />
          <Field label="Status" value={(STATUS_META[quotation.status] || STATUS_META.PENDING).label} />
          <Field label="Created By" value={quotation.createdByName} />
          <Field label="Grand Total" value={money(grand)} />
        </div>
      </Card>

      {categories.map((cat) => {
        const ca = caByCat.get(cat.categoryId);
        const st = ca?.status;
        const tone = st === "REJECTED" ? "red" : st === "APPROVED" ? "green" : "gray";
        const statusLabel = st === "REJECTED" ? "Rejected" : st === "APPROVED" ? "Approved" : "Pending";
        return (
          <CategoryCard
            key={cat.categoryId} categoryName={cat.categoryName} statusLabel={statusLabel} tone={tone}
            remarks={st === "REJECTED" ? ca?.remarks : ""}
          >
            {cat.products.map((p) => {
              const anyWon = p.vendors.some((v) => approvedPairs.has(`${p.productDefinitionId}::${v.vendorId}`));
              return (
                <ProductBlock key={p.productDefinitionId} product={p} highlight={anyWon}>
                  {p.vendors.map((v) => (
                    <VendorLine
                      key={v.vendorId} v={v} rank={rankMap.get(v.itemId)}
                      won={approvedPairs.has(`${p.productDefinitionId}::${v.vendorId}`)}
                    />
                  ))}
                </ProductBlock>
              );
            })}
          </CategoryCard>
        );
      })}

      <Card title="Totals">
        <div className="grid grid-cols-3 gap-4">
          <Field label="Taxable" value={money(totalBase)} />
          <Field label="GST" value={money(totalGst)} />
          <div className="min-w-0">
            <p className={fieldLabelCls}>Grand Total</p>
            <p className="mt-0.5 text-base font-bold text-slate-900 tabular-nums">{money(grand)}</p>
          </div>
        </div>
      </Card>

      {quotation.notes ? (
        <Card title="Notes">
          <p className="whitespace-pre-wrap text-sm text-slate-700">{quotation.notes}</p>
        </Card>
      ) : null}
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
      const res = await fetch(`${API_BACKEND_URL}/stock/quotations/${quotationId}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to load quotation");
      setQuotation(json.data);
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

  const isDetails = mode === "details";
  const isViewMode = mode === "view";
  const showReview = !isViewMode && !isDetails && quotation.status === "PENDING";
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
  const backTo = isDetails
    ? "/stock/quotations/list"
    : isViewMode
    ? (cameFromApproval ? "/stock/quotations/approval" : "/stock/quotations/list")
    : "/stock/quotations/approval";

  return (
    <div className="min-h-screen bg-slate-50/60">
      <div className="mx-auto max-w-5xl p-6 pb-12">
        {showReview ? (
          <ReviewMode quotation={quotation} onDone={load} />
        ) : (
          <DetailsMode quotation={quotation} backTo={backTo} />
        )}
      </div>
    </div>
  );
};

export default QuotationApproval;