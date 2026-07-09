"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { API_BACKEND_URL } from "@/config/getEnvVariables";

const DECISION = { APPROVED: "APPROVED", REJECTED: "REJECTED" };

const money = (n) => `\u20B9${Number(n || 0).toLocaleString()}`;
const idOf = (v) => String(v?._id || v || "");

// items[] -> [{ categoryId, categoryName, products: [{ productDefinitionId,
// productName, vendors: [{ vendorId, vendorName, unitPrice, gstRate }] }] }]
const groupByCategory = (items = []) => {
  const cats = new Map();
  items.forEach((it) => {
    const cId = idOf(it.categoryId);
    if (!cats.has(cId)) {
      cats.set(cId, {
        categoryId: cId,
        categoryName: it.categoryName || it.categoryId?.name || "",
        products: new Map(),
      });
    }
    const cat = cats.get(cId);
    const pId = idOf(it.productDefinitionId);
    if (!cat.products.has(pId)) {
      cat.products.set(pId, {
        productDefinitionId: pId,
        productName: it.productName || it.productDefinitionId?.name || "",
        vendors: [],
      });
    }
    cat.products.get(pId).vendors.push({
      vendorId: idOf(it.vendorId),
      vendorName: it.vendorName || it.vendorId?.name || "",
      unitPrice: it.unitPrice,
      gstRate: it.gstRate,
    });
  });
  return [...cats.values()].map((c) => ({
    categoryId: c.categoryId,
    categoryName: c.categoryName,
    products: [...c.products.values()],
  }));
};

/* ------------------------------------------------------------------ */
/* Review mode                                                         */
/* ------------------------------------------------------------------ */

const ReviewMode = ({ quotation, onDone }) => {
  const router = useRouter();
  const categories = groupByCategory(quotation.items);

  // { [categoryId]: { status, sel: {productDefinitionId, vendorId}|null, remarks } }
  const [decisions, setDecisions] = useState({});
  const [rowError, setRowError] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const setDecision = (catId, patch) =>
    setDecisions((prev) => ({ ...prev, [catId]: { ...prev[catId], ...patch } }));

  // vendor pick behaves like a radio for the whole category
  const pickVendor = (catId, productDefinitionId, vendorId) =>
    setDecisions((prev) => {
      const cur = prev[catId] || {};
      const same =
        cur.sel &&
        cur.sel.productDefinitionId === productDefinitionId &&
        cur.sel.vendorId === vendorId;
      return {
        ...prev,
        [catId]: {
          ...cur,
          sel: same ? null : { productDefinitionId, vendorId },
        },
      };
    });

  const approve = (catId) => {
    const d = decisions[catId];
    if (!d?.sel) {
      setRowError((p) => ({ ...p, [catId]: "Pick one product and vendor first" }));
      return;
    }
    setRowError((p) => ({ ...p, [catId]: null }));
    setDecision(catId, { status: DECISION.APPROVED });
  };

  const reject = (catId) => {
    setRowError((p) => ({ ...p, [catId]: null }));
    setDecision(catId, { status: DECISION.REJECTED, sel: null });
  };

  const allDecided = categories.every((c) => decisions[c.categoryId]?.status);

  const submit = async () => {
    if (!allDecided) {
      setError("Every category must be approved or rejected");
      return;
    }
    const payload = categories.map((c) => {
      const d = decisions[c.categoryId];
      if (d.status === DECISION.APPROVED) {
        return {
          categoryId: c.categoryId,
          status: DECISION.APPROVED,
          selection: d.sel,
          remarks: d.remarks || "",
        };
      }
      return { categoryId: c.categoryId, status: DECISION.REJECTED, remarks: d.remarks || "" };
    });

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BACKEND_URL}/stock/quotations/${quotation._id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ decisions: payload }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to submit");
      onDone();
    } catch (err) {
      setError(err.message);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/stock/quotations/approval")}
          className="rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
        >
          &larr; Back to list
        </button>
        <div>
          <p className="text-base font-semibold text-gray-900">{quotation.quotationNumber}</p>
          <p className="text-xs text-gray-500">Decide every category, then submit once</p>
        </div>
        <span className="ml-auto rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
          Awaiting decision
        </span>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {categories.map((cat) => {
        const d = decisions[cat.categoryId] || {};
        const decidedApproved = d.status === DECISION.APPROVED;
        const decidedRejected = d.status === DECISION.REJECTED;
        const borderCls = decidedApproved
          ? "border-green-200"
          : decidedRejected
          ? "border-red-200"
          : "border-gray-200";

        return (
          <div
            key={cat.categoryId}
            className={`mb-4 rounded-xl border bg-white p-4 ${borderCls}`}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">
                {cat.categoryName}
                <span className="ml-2 rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600">
                  leaf
                </span>
              </span>
              {decidedApproved && (
                <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                  Approved
                </span>
              )}
              {decidedRejected && (
                <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">
                  Rejected
                </span>
              )}
              {!d.status && (
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                  Pending
                </span>
              )}
            </div>

            {cat.products.map((p) => {
              const isSelProduct = d.sel?.productDefinitionId === p.productDefinitionId;
              return (
                <div
                  key={p.productDefinitionId}
                  className={`mb-2 rounded-lg border p-3 ${
                    isSelProduct ? "border-green-200 bg-green-50" : "border-gray-100"
                  }`}
                >
                  <p className="mb-1.5 text-sm font-medium text-gray-900">{p.productName}</p>
                  <div className="flex flex-wrap gap-2">
                    {p.vendors.map((v) => {
                      const checked =
                        d.sel?.productDefinitionId === p.productDefinitionId &&
                        d.sel?.vendorId === v.vendorId;
                      return (
                        <label
                          key={v.vendorId}
                          className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-sm ${
                            checked
                              ? "border-green-300 text-green-700"
                              : "border-gray-200 text-gray-700"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={!!checked}
                            disabled={decidedRejected}
                            onChange={() => pickVendor(cat.categoryId, p.productDefinitionId, v.vendorId)}
                          />
                          {v.vendorName}
                          <span className="text-gray-400">{money(v.unitPrice)}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {decidedRejected && (
              <input
                type="text"
                value={d.remarks || ""}
                onChange={(e) => setDecision(cat.categoryId, { remarks: e.target.value })}
                placeholder="Reason (optional)"
                className="mt-1 mb-2 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            )}

            {rowError[cat.categoryId] && (
              <p className="mb-2 text-xs text-red-600">{rowError[cat.categoryId]}</p>
            )}

            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-gray-500">One product · one vendor</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => reject(cat.categoryId)}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                >
                  Reject {cat.categoryName}
                </button>
                <button
                  type="button"
                  onClick={() => approve(cat.categoryId)}
                  className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
                >
                  Approve {cat.categoryName}
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {/* summary + submit */}
      <div className="rounded-xl border border-gray-300 bg-gray-50 p-4">
        <p className="mb-2 text-sm font-medium text-gray-900">Decision summary</p>
        <div className="mb-3 flex flex-col gap-1.5">
          {categories.map((c) => {
            const d = decisions[c.categoryId] || {};
            if (d.status === DECISION.APPROVED) {
              return (
                <span key={c.categoryId} className="text-sm text-green-700">
                  &#10003; {c.categoryName} — approved
                </span>
              );
            }
            if (d.status === DECISION.REJECTED) {
              return (
                <span key={c.categoryId} className="text-sm text-red-600">
                  &#10007; {c.categoryName} — rejected
                </span>
              );
            }
            return (
              <span key={c.categoryId} className="text-sm text-gray-400">
                &middot; {c.categoryName} — no decision yet
              </span>
            );
          })}
        </div>
        <div className="flex items-center justify-between border-t border-gray-200 pt-3">
          <span className="text-xs text-gray-500">
            {allDecided ? "All categories decided" : "Every category must be decided before you can submit"}
          </span>
          <button
            type="button"
            onClick={submit}
            disabled={!allDecided || submitting}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? "Submitting\u2026" : "Submit approval"}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* View mode — read-only decision result                              */
/* ------------------------------------------------------------------ */

const STATUS_META = {
  PENDING: { label: "Pending", cls: "bg-amber-50 text-amber-700" },
  APPROVED: { label: "Approved", cls: "bg-green-50 text-green-700" },
  PARTIALLY_APPROVED: { label: "Partially approved", cls: "bg-indigo-50 text-indigo-700" },
  REJECTED: { label: "Rejected", cls: "bg-red-50 text-red-600" },
};

const ViewMode = ({ quotation, backTo }) => {
  const router = useRouter();
  const badge = STATUS_META[quotation.status] || STATUS_META.PENDING;
  const approvals = quotation.categoryApprovals || [];

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push(backTo)}
          className="rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
        >
          &larr; Back to list
        </button>
        <p className="text-base font-semibold text-gray-900">{quotation.quotationNumber}</p>
        <span className={`ml-auto rounded-full px-3 py-1 text-xs font-medium ${badge.cls}`}>
          {badge.label}
        </span>
      </div>

      {approvals.length === 0 ? (
        <div className="rounded-lg bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
          This quotation is still pending review. Use "Details" to see everything that was quoted.
        </div>
      ) : (
        approvals.map((ca) => {
          const approved = ca.status === "APPROVED";
          return (
            <div
              key={idOf(ca.categoryId) + ca.categoryName}
              className={`mb-3 rounded-xl border bg-white p-4 ${
                approved ? "border-green-200" : "border-red-200"
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-900">{ca.categoryName}</span>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    approved ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                  }`}
                >
                  {approved ? "Approved" : "Rejected"}
                </span>
              </div>
              {approved ? (
                (ca.selections || []).map((s, i) => (
                  <p key={i} className="text-sm text-gray-700">
                    <span className="font-medium">{s.productName}</span> &rarr; {s.vendorName}
                    <span className="text-gray-500">
                      {" "}
                      &middot; qty {s.quantity} &middot; {money(s.unitPrice)}
                    </span>
                  </p>
                ))
              ) : (
                <p className="text-sm text-gray-500">{ca.remarks || "No reason given"}</p>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Details mode — everything the creator submitted (read-only)         */
/* ------------------------------------------------------------------ */

const DetailsMode = ({ quotation, backTo }) => {
  const router = useRouter();
  const categories = groupByCategory(quotation.items);
  const badge = STATUS_META[quotation.status] || STATUS_META.PENDING;

  // which (product, vendor) pairs were the winning approved selections
  const approvedPairs = new Set(
    (quotation.categoryApprovals || []).flatMap((ca) =>
      (ca.selections || []).map((s) => `${idOf(s.productDefinitionId)}::${idOf(s.vendorId)}`)
    )
  );

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push(backTo)}
          className="rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
        >
          &larr; Back to list
        </button>
        <div>
          <p className="text-base font-semibold text-gray-900">{quotation.quotationNumber}</p>
          <p className="text-xs text-gray-500">
            Submitted by {quotation.createdByName || "\u2014"} &middot; what was quoted
          </p>
        </div>
        <span className={`ml-auto rounded-full px-3 py-1 text-xs font-medium ${badge.cls}`}>
          {badge.label}
        </span>
      </div>

      {categories.map((cat) => (
        <div key={cat.categoryId} className="mb-3 overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 bg-gray-50 px-4 py-2.5">
            <span className="text-sm font-semibold text-gray-900">{cat.categoryName}</span>
            <span className="ml-2 rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600">leaf</span>
          </div>
          {cat.products.map((p) => (
            <div key={p.productDefinitionId} className="border-b border-gray-100 px-4 py-3 last:border-b-0">
              <p className="mb-1.5 text-sm font-medium text-gray-900">{p.productName}</p>
              <div className="flex flex-col gap-1">
                {p.vendors.map((v) => {
                  const won = approvedPairs.has(`${p.productDefinitionId}::${v.vendorId}`);
                  return (
                    <div
                      key={v.vendorId}
                      className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-sm ${
                        won ? "bg-green-50" : ""
                      }`}
                    >
                      <span className="flex items-center gap-2 text-gray-700">
                        {won && <span className="text-green-600">&#10003;</span>}
                        {v.vendorName}
                        {won && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
                            approved
                          </span>
                        )}
                      </span>
                      <span className="text-gray-600">
                        {money(v.unitPrice)} <span className="text-gray-400">· GST {v.gstRate}%</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ))}

      {quotation.notes ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="mb-1 text-xs font-medium text-gray-500">Notes</p>
          <p className="text-sm text-gray-700">{quotation.notes}</p>
        </div>
      ) : null}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Wrapper                                                             */
/* ------------------------------------------------------------------ */

const QuotationApproval = ({ quotationId, mode = "review" }) => {
  const [quotation, setQuotation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BACKEND_URL}/stock/quotations/${quotationId}`, {
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to load quotation");
      setQuotation(json.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [quotationId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      </div>
    );
  }
  if (!quotation) return null;

  const isDetails = mode === "details";
  const isViewMode = mode === "view";
  // Review UI only when still pending; a reviewed quotation always shows read-only.
  const showReview = !isViewMode && !isDetails && quotation.status === "PENDING";
  // details/view are opened from the creator list; review from the approver list
  const backTo = isViewMode || isDetails ? "/stock/quotations/list" : "/stock/quotations/approval";

  return (
    <div className="mx-auto max-w-4xl p-6">
      {isDetails ? (
        <DetailsMode quotation={quotation} backTo={backTo} />
      ) : showReview ? (
        <ReviewMode quotation={quotation} onDone={load} />
      ) : (
        <ViewMode quotation={quotation} backTo={backTo} />
      )}
    </div>
  );
};

export default QuotationApproval;