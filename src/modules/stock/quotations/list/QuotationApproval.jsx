"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import { Modal, leafOf, hasPath, ViewPathIcon, CategoryPathModal, money } from "@/modules/stock/shared/StockSharedUI";

const DECISION = { APPROVED: "APPROVED", REJECTED: "REJECTED" };
const idOf = (v) => String(v?._id || v || "");
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const baseOf = (it) => round2((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0));
const gstOf = (it) => (it.gstAmount != null ? Number(it.gstAmount) : round2((baseOf(it) * (Number(it.gstRate) || 0)) / 100));
const totalOf = (it) => (it.lineTotal != null ? Number(it.lineTotal) : round2(baseOf(it) + gstOf(it)));

const STATUS_META = {
  PENDING: { label: "Pending", cls: "bg-amber-50 text-amber-700" },
  APPROVED: { label: "Approved", cls: "bg-green-50 text-green-700" },
  PARTIALLY_APPROVED: { label: "Partially approved", cls: "bg-indigo-50 text-indigo-700" },
  REJECTED: { label: "Rejected", cls: "bg-red-50 text-red-600" },
};

const groupByCategory = (items = []) => {
  const cats = new Map();
  items.forEach((it) => {
    const cId = idOf(it.categoryId) || it.categoryName;
    if (!cats.has(cId)) cats.set(cId, { categoryId: cId, categoryName: it.categoryName || it.categoryId?.name || "", products: new Map() });
    const cat = cats.get(cId);
    const pId = idOf(it.productDefinitionId);
    if (!cat.products.has(pId)) cat.products.set(pId, { productDefinitionId: pId, productName: it.productName || it.productDefinitionId?.name || "", vendors: [] });
    cat.products.get(pId).vendors.push({ vendorId: idOf(it.vendorId), vendorName: it.vendorName || it.vendorId?.name || "", unitPrice: it.unitPrice, gstRate: it.gstRate });
  });
  return [...cats.values()].map((c) => ({ categoryId: c.categoryId, categoryName: c.categoryName, products: [...c.products.values()] }));
};

/* small reusable card + field */
const Card = ({ title, children, right }) => (
  <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
    <div className="mb-3 flex items-center justify-between">
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      {right}
    </div>
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
/* Review mode (unchanged logic)                                      */
/* ================================================================= */

const ReviewMode = ({ quotation, onDone }) => {
  const router = useRouter();
  const categories = groupByCategory(quotation.items);
  const [decisions, setDecisions] = useState({});
  const [rowError, setRowError] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [pathModal, setPathModal] = useState(null);

  const setDecision = (catId, patch) => setDecisions((prev) => ({ ...prev, [catId]: { ...prev[catId], ...patch } }));
  const pickVendor = (catId, productDefinitionId, vendorId) => setDecisions((prev) => {
    const cur = prev[catId] || {};
    const same = cur.sel && cur.sel.productDefinitionId === productDefinitionId && cur.sel.vendorId === vendorId;
    return { ...prev, [catId]: { ...cur, sel: same ? null : { productDefinitionId, vendorId } } };
  });
  const approve = (catId) => { const d = decisions[catId]; if (!d?.sel) { setRowError((p) => ({ ...p, [catId]: "Pick one product and vendor first" })); return; } setRowError((p) => ({ ...p, [catId]: null })); setDecision(catId, { status: DECISION.APPROVED }); };
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
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ decisions: payload }),
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
        const leaf = leafOf(cat.categoryName);
        const showView = hasPath(leaf, cat.categoryName);
        const borderCls = d.status === DECISION.APPROVED ? "border-green-200" : d.status === DECISION.REJECTED ? "border-red-200" : "border-gray-200";
        return (
          <div key={cat.categoryId} className={`mb-4 rounded-xl border bg-white p-4 ${borderCls}`}>
            <div className="mb-3 flex items-center justify-between">
              <span className="flex items-center gap-1 text-sm font-semibold text-gray-900">
                {leaf}{showView && <ViewPathIcon onClick={() => setPathModal({ label: leaf, path: cat.categoryName })} />}
              </span>
              {d.status === DECISION.APPROVED && <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">Approved</span>}
              {d.status === DECISION.REJECTED && <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">Rejected</span>}
              {!d.status && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">Pending</span>}
            </div>
            {cat.products.map((p) => {
              const isSelProduct = d.sel?.productDefinitionId === p.productDefinitionId;
              return (
                <div key={p.productDefinitionId} className={`mb-2 rounded-lg border p-3 ${isSelProduct ? "border-green-200 bg-green-50" : "border-gray-100"}`}>
                  <p className="mb-1.5 text-sm font-medium text-gray-900">{p.productName}</p>
                  <div className="flex flex-wrap gap-2">
                    {p.vendors.map((v) => {
                      const checked = d.sel?.productDefinitionId === p.productDefinitionId && d.sel?.vendorId === v.vendorId;
                      return (
                        <label key={v.vendorId} className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-sm ${checked ? "border-green-300 text-green-700" : "border-gray-200 text-gray-700"}`}>
                          <input type="checkbox" checked={!!checked} disabled={d.status === DECISION.REJECTED} onChange={() => pickVendor(cat.categoryId, p.productDefinitionId, v.vendorId)} />
                          {v.vendorName}<span className="text-gray-400">{money(v.unitPrice)}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {d.status === DECISION.REJECTED && (
              <input type="text" value={d.remarks || ""} onChange={(e) => setDecision(cat.categoryId, { remarks: e.target.value })} placeholder="Reason (optional)" className="mt-1 mb-2 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
            )}
            {rowError[cat.categoryId] && <p className="mb-2 text-xs text-red-600">{rowError[cat.categoryId]}</p>}
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-gray-500">One product · one vendor</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => reject(cat.categoryId)} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">Reject</button>
                <button type="button" onClick={() => approve(cat.categoryId)} className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700">Approve</button>
              </div>
            </div>
          </div>
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
          <button type="button" onClick={submit} disabled={!allDecided || submitting} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">{submitting ? "Submitting\u2026" : "Submit approval"}</button>
        </div>
      </div>
      {pathModal && <CategoryPathModal label={pathModal.label} path={pathModal.path} onClose={() => setPathModal(null)} />}
    </div>
  );
};

/* ================================================================= */
/* View mode — clean read-only decision result, section-wise          */
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
          <Field label="Categories" value={String(approvals.length || groupByCategory(quotation.items).length)} />
        </div>
      </Card>

      {approvals.length === 0 ? (
        <div className="rounded-lg bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">Still pending review. Use "Details" to see everything that was quoted.</div>
      ) : (
        approvals.map((ca) => {
          const approved = ca.status === "APPROVED";
          const leaf = leafOf(ca.categoryName);
          const showView = hasPath(leaf, ca.categoryName);
          return (
            <div key={idOf(ca.categoryId) + ca.categoryName} className={`mb-3 rounded-xl border bg-white p-4 ${approved ? "border-green-200" : "border-red-200"}`}>
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1 text-sm font-semibold text-gray-900">{leaf}{showView && <ViewPathIcon onClick={() => setPathModal({ label: leaf, path: ca.categoryName })} />}</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${approved ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{approved ? "Approved" : "Rejected"}</span>
              </div>
              {approved ? (ca.selections || []).map((s, i) => (
                <p key={i} className="text-sm text-gray-700"><span className="font-medium">{s.productName}</span> &rarr; {s.vendorName}<span className="text-gray-500"> &middot; qty {s.quantity} &middot; {money(s.unitPrice)}</span></p>
              )) : <p className="text-sm text-gray-500">{ca.remarks || "No reason given"}</p>}
            </div>
          );
        })
      )}
      {pathModal && <CategoryPathModal label={pathModal.label} path={pathModal.path} onClose={() => setPathModal(null)} />}
    </div>
  );
};

/* ================================================================= */
/* Details mode — complete details page                               */
/* ================================================================= */

const DetailsMode = ({ quotation, backTo }) => {
  const router = useRouter();
  const badge = STATUS_META[quotation.status] || STATUS_META.PENDING;
  const items = quotation.items || [];
  const [pathModal, setPathModal] = useState(null);

  // per-category approval status (by categoryId or name)
  const caByCat = new Map((quotation.categoryApprovals || []).map((ca) => [idOf(ca.categoryId) || ca.categoryName, ca]));
  const approvedPairs = new Set(
    (quotation.categoryApprovals || []).flatMap((ca) => (ca.selections || []).map((s) => `${idOf(s.productDefinitionId)}::${idOf(s.vendorId)}`))
  );

  // group: category -> vendor -> products (like create time)
  const cats = new Map();
  items.forEach((it) => {
    const cId = idOf(it.categoryId) || it.categoryName;
    if (!cats.has(cId)) cats.set(cId, { categoryId: cId, categoryName: it.categoryName || "", vendors: new Map() });
    const cat = cats.get(cId);
    const vId = idOf(it.vendorId);
    if (!cat.vendors.has(vId)) cat.vendors.set(vId, { vendorId: vId, vendorName: it.vendorName || "", products: [] });
    cat.vendors.get(vId).products.push(it);
  });
  const catList = [...cats.values()].map((c) => ({ ...c, vendors: [...c.vendors.values()] }));

  const totalBase = round2(items.reduce((s, it) => s + baseOf(it), 0));
  const totalGst = round2(items.reduce((s, it) => s + gstOf(it), 0));
  const grand = round2(items.reduce((s, it) => s + totalOf(it), 0));

  const HEAD = "grid min-w-[640px] grid-cols-[1.4fr_60px_90px_60px_90px_100px] gap-2 px-3 py-2";

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

      {catList.map((cat) => {
        const ca = caByCat.get(cat.categoryId);
        const st = ca?.status; // APPROVED | REJECTED | undefined
        const leaf = leafOf(cat.categoryName);
        const showView = hasPath(leaf, cat.categoryName);
        const border = st === "REJECTED" ? "border-red-300" : st === "APPROVED" ? "border-green-300" : "border-gray-200";
        const headBg = st === "REJECTED" ? "bg-red-50" : st === "APPROVED" ? "bg-green-50" : "bg-gray-50";
        const headBadge = st === "REJECTED" ? ["Rejected", "bg-red-100 text-red-600"] : st === "APPROVED" ? ["Approved", "bg-green-100 text-green-700"] : ["Pending", "bg-amber-100 text-amber-700"];
        return (
          <div key={cat.categoryId} className={`mb-4 overflow-hidden rounded-xl border ${border} bg-white`}>
            <div className={`flex items-center justify-between px-4 py-3 ${headBg}`}>
              <span className="flex items-center gap-1 text-sm font-semibold text-gray-900">{leaf}{showView && <ViewPathIcon onClick={() => setPathModal({ label: leaf, path: cat.categoryName })} />}</span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${headBadge[1]}`}>{headBadge[0]}</span>
            </div>
            {st === "REJECTED" && ca?.remarks ? <p className="px-4 pt-2 text-xs text-red-600">Reason: {ca.remarks}</p> : null}
            <div className="p-4 pt-3">
              {cat.vendors.map((v) => (
                <div key={v.vendorId} className="mb-3 overflow-hidden rounded-lg border border-gray-100 last:mb-0">
                  <div className="border-b border-gray-100 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-800">{v.vendorName}</div>
                  <div className="overflow-x-auto">
                    <div className={`${HEAD} bg-white text-[11px] text-gray-400`}>
                      <span>Product</span><span className="text-right">Qty</span><span className="text-right">Unit price</span><span className="text-right">GST</span><span className="text-right">GST ₹</span><span className="text-right">Total</span>
                    </div>
                    {v.products.map((it, i) => {
                      const won = approvedPairs.has(`${idOf(it.productDefinitionId)}::${idOf(it.vendorId)}`);
                      return (
                        <div key={i} className={`${HEAD} items-center border-t border-gray-100 text-sm ${won ? "bg-green-50" : ""}`}>
                          <span className="font-medium text-gray-900">{it.productName}{won && <span className="ml-1 rounded-full bg-green-100 px-1.5 text-[10px] text-green-700">approved</span>}</span>
                          <span className="text-right">{it.quantity}</span>
                          <span className="text-right">{Number(it.unitPrice).toLocaleString("en-IN")}</span>
                          <span className="text-right">{it.gstRate}%</span>
                          <span className="text-right">{gstOf(it).toLocaleString("en-IN")}</span>
                          <span className="text-right font-medium">{totalOf(it).toLocaleString("en-IN")}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
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
    <div className="mx-auto max-w-4xl p-6">
      {isDetails ? <DetailsMode quotation={quotation} backTo={backTo} />
        : showReview ? <ReviewMode quotation={quotation} onDone={load} />
        : <ViewMode quotation={quotation} backTo={backTo} />}
    </div>
  );
};

export default QuotationApproval;