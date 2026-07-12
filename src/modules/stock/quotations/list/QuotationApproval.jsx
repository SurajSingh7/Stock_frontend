"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import { leafOf, hasPath, ViewPathIcon, CategoryPathModal, money } from "@/modules/stock/shared/StockSharedUI";

const DECISION = { APPROVED: "APPROVED", REJECTED: "REJECTED" };
const idOf = (v) => String(v?._id || v || "");
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const inr = (n) => `\u20B9${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const baseOf = (it) => round2((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0));
const gstOf = (it) => (it.gstAmount != null ? Number(it.gstAmount) : round2((baseOf(it) * (Number(it.gstRate) || 0)) / 100));
const totalOf = (it) => (it.lineTotal != null ? Number(it.lineTotal) : round2(baseOf(it) + gstOf(it)));

const STATUS_META = {
  PENDING: { label: "Pending", cls: "bg-amber-50 text-amber-700" },
  APPROVED: { label: "Approved", cls: "bg-green-50 text-green-700" },
  PARTIALLY_APPROVED: { label: "Partially approved", cls: "bg-indigo-50 text-indigo-700" },
  REJECTED: { label: "Rejected", cls: "bg-red-50 text-red-600" },
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
      vendorId: idOf(it.vendorId),
      vendorName: it.vendorName || "",
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      gstRate: it.gstRate,
      gstAmount: gstOf(it),
      lineTotal: totalOf(it),
    });
  });
  return [...cats.values()].map((c) => ({ ...c, products: [...c.products.values()] }));
};

/* one vendor offer line — same layout in review / details / view */
const VendorLine = ({ v, selectable = false, checked = false, disabled = false, onToggle, won = false }) => (
  <div className={`flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg px-3 py-2 text-sm ${
    won ? "bg-green-50" : checked ? "bg-green-50" : "hover:bg-gray-50"
  }`}>
    <span className="flex min-w-[130px] items-center gap-2 font-medium text-gray-900">
      {selectable && (
        <input type="checkbox" checked={checked} disabled={disabled} onChange={onToggle}
          className="rounded border-gray-300 text-green-600 focus:ring-green-500" />
      )}
      {won && <span className="text-green-600">&#10003;</span>}
      {v.vendorName}
      {won && <span className="rounded-full bg-green-100 px-1.5 text-[10px] font-medium text-green-700">approved</span>}
    </span>
    <span className="text-gray-500">Qty: <span className="text-gray-900">{v.quantity}</span></span>
    <span className="text-gray-500">Unit Price: <span className="text-gray-900">{inr(v.unitPrice)}</span></span>
    <span className="text-gray-500">GST: <span className="text-gray-900">{v.gstRate}%</span></span>
    <span className="text-gray-500">GST {inr(v.gstAmount)}</span>
    <span className="ml-auto font-semibold text-gray-900">Total: {inr(v.lineTotal)}</span>
  </div>
);

/* category card shell — colored by decision */
const CategoryCard = ({ categoryName, statusLabel, tone, remarks, onPath, children }) => {
  const leaf = leafOf(categoryName);
  const showView = hasPath(leaf, categoryName);
  const border = tone === "red" ? "border-red-300" : tone === "green" ? "border-green-300" : "border-gray-200";
  const head = tone === "red" ? "bg-red-50" : tone === "green" ? "bg-green-50" : "bg-gray-50";
  const badge = tone === "red" ? "bg-red-100 text-red-600" : tone === "green" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700";
  return (
    <div className={`mb-4 overflow-hidden rounded-xl border ${border} bg-white`}>
      <div className={`flex items-center justify-between px-4 py-3 ${head}`}>
        <span className="flex items-center gap-1 text-sm font-semibold text-gray-900">
          {leaf}
          {showView && <ViewPathIcon onClick={() => onPath({ label: leaf, path: categoryName })} />}
        </span>
        {statusLabel && <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badge}`}>{statusLabel}</span>}
      </div>
      {remarks ? <p className="px-4 pt-2 text-xs text-red-600">Reason: {remarks}</p> : null}
      <div className="p-4 pt-3">{children}</div>
    </div>
  );
};

/* product block — name, then its vendor lines */
const ProductBlock = ({ product, children, highlight = false }) => (
  <div className={`mb-3 rounded-lg border p-3 last:mb-0 ${highlight ? "border-green-200 bg-green-50/40" : "border-gray-100"}`}>
    <p className="mb-1.5 border-b border-gray-100 pb-1.5 text-sm font-semibold text-gray-900">{product.productName}</p>
    <div className="space-y-0.5">{children}</div>
  </div>
);

const Card = ({ title, children }) => (
  <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
    <p className="mb-3 text-sm font-semibold text-gray-900">{title}</p>
    {children}
  </div>
);
const Field = ({ label, value }) => (
  <div>
    <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
    <p className="text-sm text-gray-900">{value || "\u2014"}</p>
  </div>
);

/* ================================================================= */
/* Review mode — category → product → vendor lines (selectable)       */
/* ================================================================= */

const ReviewMode = ({ quotation, onDone }) => {
  const router = useRouter();
  const categories = groupCatProductVendor(quotation.items);

  const [decisions, setDecisions] = useState({});
  const [rowError, setRowError] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [pathModal, setPathModal] = useState(null);

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
    setDecision(catId, { status: DECISION.APPROVED });
  };
  const reject = (catId) => { setRowError((p) => ({ ...p, [catId]: null })); setDecision(catId, { status: DECISION.REJECTED, sel: null }); };

  const allDecided = categories.every((c) => decisions[c.categoryId]?.status);

  const submit = async () => {
    if (!allDecided) { setError("Every category must be approved or rejected"); return; }
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
      onDone();
    } catch (err) { setError(err.message); window.scrollTo({ top: 0, behavior: "smooth" }); } finally { setSubmitting(false); }
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <button type="button" onClick={() => router.push("/stock/quotations/approval")} className="rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">&larr; Back to list</button>
        <div><p className="text-base font-semibold text-gray-900">{quotation.quotationNumber}</p><p className="text-xs text-gray-500">Decide every category, then submit once</p></div>
        <span className="ml-auto rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">Awaiting decision</span>
      </div>
      {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {categories.map((cat) => {
        const d = decisions[cat.categoryId] || {};
        const tone = d.status === DECISION.APPROVED ? "green" : d.status === DECISION.REJECTED ? "red" : "gray";
        const statusLabel = d.status === DECISION.APPROVED ? "Approved" : d.status === DECISION.REJECTED ? "Rejected" : "Pending";
        return (
          <CategoryCard key={cat.categoryId} categoryName={cat.categoryName} statusLabel={statusLabel} tone={tone} onPath={setPathModal}>
            {cat.products.map((p) => {
              const isSelProduct = d.sel?.productDefinitionId === p.productDefinitionId;
              return (
                <ProductBlock key={p.productDefinitionId} product={p} highlight={isSelProduct}>
                  {p.vendors.map((v) => {
                    const checked = d.sel?.productDefinitionId === p.productDefinitionId && d.sel?.vendorId === v.vendorId;
                    return (
                      <VendorLine key={v.vendorId} v={v} selectable checked={!!checked}
                        disabled={d.status === DECISION.REJECTED}
                        onToggle={() => pickVendor(cat.categoryId, p.productDefinitionId, v.vendorId)} />
                    );
                  })}
                </ProductBlock>
              );
            })}

            {d.status === DECISION.REJECTED && (
              <input type="text" value={d.remarks || ""} onChange={(e) => setDecision(cat.categoryId, { remarks: e.target.value })}
                placeholder="Reason (optional)" className="mb-2 mt-1 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
            )}
            {rowError[cat.categoryId] && <p className="mb-2 text-xs text-red-600">{rowError[cat.categoryId]}</p>}

            <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-3">
              <span className="text-xs text-gray-500">Pick one product · one vendor</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => reject(cat.categoryId)} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">Reject</button>
                <button type="button" onClick={() => approve(cat.categoryId)} className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700">Approve</button>
              </div>
            </div>
          </CategoryCard>
        );
      })}

      <div className="rounded-xl border border-gray-300 bg-gray-50 p-4">
        <p className="mb-2 text-sm font-medium text-gray-900">Decision summary</p>
        <div className="mb-3 flex flex-col gap-1.5">
          {categories.map((c) => {
            const d = decisions[c.categoryId] || {};
            const leaf = leafOf(c.categoryName);
            if (d.status === DECISION.APPROVED) return <span key={c.categoryId} className="text-sm text-green-700">&#10003; {leaf} — approved</span>;
            if (d.status === DECISION.REJECTED) return <span key={c.categoryId} className="text-sm text-red-600">&#10007; {leaf} — rejected</span>;
            return <span key={c.categoryId} className="text-sm text-gray-400">&middot; {leaf} — no decision yet</span>;
          })}
        </div>
        <div className="flex items-center justify-between border-t border-gray-200 pt-3">
          <span className="text-xs text-gray-500">{allDecided ? "All categories decided" : "Every category must be decided before you can submit"}</span>
          <button type="button" onClick={submit} disabled={!allDecided || submitting} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            {submitting ? "Submitting\u2026" : "Submit approval"}
          </button>
        </div>
      </div>

      {pathModal && <CategoryPathModal label={pathModal.label} path={pathModal.path} onClose={() => setPathModal(null)} />}
    </div>
  );
};

/* ================================================================= */
/* Details mode — same category → product → vendor layout, read-only  */
/* ================================================================= */

const DetailsMode = ({ quotation, backTo }) => {
  const router = useRouter();
  const badge = STATUS_META[quotation.status] || STATUS_META.PENDING;
  const items = quotation.items || [];
  const categories = groupCatProductVendor(items);
  const [pathModal, setPathModal] = useState(null);

  const caByCat = new Map((quotation.categoryApprovals || []).map((ca) => [idOf(ca.categoryId) || ca.categoryName, ca]));
  const approvedPairs = new Set(
    (quotation.categoryApprovals || []).flatMap((ca) => (ca.selections || []).map((s) => `${idOf(s.productDefinitionId)}::${idOf(s.vendorId)}`))
  );

  const totalBase = round2(items.reduce((s, it) => s + baseOf(it), 0));
  const totalGst = round2(items.reduce((s, it) => s + gstOf(it), 0));
  const grand = round2(items.reduce((s, it) => s + totalOf(it), 0));

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <button type="button" onClick={() => router.push(backTo)} className="rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">&larr; Back to list</button>
        <div><p className="text-base font-semibold text-gray-900">{quotation.quotationNumber}</p><p className="text-xs text-gray-500">Complete quotation details</p></div>
        <span className={`ml-auto rounded-full px-3 py-1 text-xs font-medium ${badge.cls}`}>{badge.label}</span>
      </div>

      <Card title="Quotation information">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Quotation no" value={quotation.quotationNumber} />
          <Field label="Status" value={badge.label} />
          <Field label="Created by" value={quotation.createdByName} />
          <Field label="Grand total" value={money(grand)} />
        </div>
      </Card>

      {categories.map((cat) => {
        const ca = caByCat.get(cat.categoryId);
        const st = ca?.status;
        const tone = st === "REJECTED" ? "red" : st === "APPROVED" ? "green" : "gray";
        const statusLabel = st === "REJECTED" ? "Rejected" : st === "APPROVED" ? "Approved" : "Pending";
        return (
          <CategoryCard key={cat.categoryId} categoryName={cat.categoryName} statusLabel={statusLabel} tone={tone}
            remarks={st === "REJECTED" ? ca?.remarks : ""} onPath={setPathModal}>
            {cat.products.map((p) => {
              const anyWon = p.vendors.some((v) => approvedPairs.has(`${p.productDefinitionId}::${v.vendorId}`));
              return (
                <ProductBlock key={p.productDefinitionId} product={p} highlight={anyWon}>
                  {p.vendors.map((v) => (
                    <VendorLine key={v.vendorId} v={v} won={approvedPairs.has(`${p.productDefinitionId}::${v.vendorId}`)} />
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
          <Field label="Grand total" value={money(grand)} />
        </div>
      </Card>

      {quotation.notes ? <Card title="Notes"><p className="text-sm text-gray-700">{quotation.notes}</p></Card> : null}

      {pathModal && <CategoryPathModal label={pathModal.label} path={pathModal.path} onClose={() => setPathModal(null)} />}
    </div>
  );
};

/* ================================================================= */
/* View mode — decision result (read-only)                            */
/* ================================================================= */

const ViewMode = ({ quotation, backTo }) => {
  const router = useRouter();
  const badge = STATUS_META[quotation.status] || STATUS_META.PENDING;
  const approvals = quotation.categoryApprovals || [];
  const [pathModal, setPathModal] = useState(null);

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <button type="button" onClick={() => router.push(backTo)} className="rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">&larr; Back to list</button>
        <p className="text-base font-semibold text-gray-900">{quotation.quotationNumber}</p>
        <span className={`ml-auto rounded-full px-3 py-1 text-xs font-medium ${badge.cls}`}>{badge.label}</span>
      </div>

      <Card title="Quotation information">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Quotation no" value={quotation.quotationNumber} />
          <Field label="Status" value={badge.label} />
          <Field label="Created by" value={quotation.createdByName} />
          <Field label="Categories" value={String(approvals.length)} />
        </div>
      </Card>

      {approvals.length === 0 ? (
        <div className="rounded-lg bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">Still pending review. Use "Details" to see everything that was quoted.</div>
      ) : (
        approvals.map((ca) => {
          const approved = ca.status === "APPROVED";
          return (
            <CategoryCard key={idOf(ca.categoryId) + ca.categoryName} categoryName={ca.categoryName}
              statusLabel={approved ? "Approved" : "Rejected"} tone={approved ? "green" : "red"}
              remarks={!approved ? ca.remarks || "No reason given" : ""} onPath={setPathModal}>
              {approved ? (
                (ca.selections || []).map((s, i) => (
                  <ProductBlock key={i} product={{ productName: s.productName }} highlight>
                    <VendorLine won v={{
                      vendorName: s.vendorName, quantity: s.quantity, unitPrice: s.unitPrice,
                      gstRate: s.gstRate, gstAmount: s.gstAmount, lineTotal: s.lineTotal,
                    }} />
                  </ProductBlock>
                ))
              ) : (
                <p className="text-sm text-gray-500">No product was approved for this category.</p>
              )}
            </CategoryCard>
          );
        })
      )}

      {pathModal && <CategoryPathModal label={pathModal.label} path={pathModal.path} onClose={() => setPathModal(null)} />}
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

  if (loading) return <div className="p-6"><div className="animate-pulse space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 rounded-xl bg-gray-100" />)}</div></div>;
  if (error) return <div className="p-6"><div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div></div>;
  if (!quotation) return null;

  const isDetails = mode === "details";
  const isViewMode = mode === "view";
  const showReview = !isViewMode && !isDetails && quotation.status === "PENDING";
  const backTo = isViewMode || isDetails ? "/stock/quotations/list" : "/stock/quotations/approval";

  return (
    <div className="mx-auto max-w-5xl p-6">
      {isDetails ? <DetailsMode quotation={quotation} backTo={backTo} />
        : showReview ? <ReviewMode quotation={quotation} onDone={load} />
        : <ViewMode quotation={quotation} backTo={backTo} />}
    </div>
  );
};

export default QuotationApproval;