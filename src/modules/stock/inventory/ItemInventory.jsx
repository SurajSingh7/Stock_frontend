"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import Pagination from "@/shared/ui/pagination/Pagination";
import { RotateCcw, Boxes, Info, Eye } from "lucide-react";
import { SearchableSelect, Modal, inputCls, unitLabel, money } from "@/modules/stock/shared/StockSharedUI";
import { ConditionBadge, SourceBadge, ReservedBadge, AssignedBadge, WarrantyBadge, SOURCE_LABEL, fmtDate } from "./itemBadges";

const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const APPROVAL_STATUS_LABEL = { PENDING: "Pending", APPROVED: "Approved", REJECTED: "Rejected" };

const colLabel = "text-xs font-bold text-slate-800";
const colValue = "mt-1 text-sm text-slate-600";

const Col = ({ label, children, className = "" }) => (
  <div className={`min-w-0 ${className}`}>
    <p className={colLabel}>{label}</p>
    <div className={colValue}>{children}</div>
  </div>
);

/* ============================================================= */
/* Batch breakdown — every receiving event that makes up a Group   */
/* card's total, opened via the small "info" button next to Qty.   */
/* ============================================================= */
const BatchBreakdownModal = ({ productName, unitText, defId, branchId, status, fields = [], onClose }) => {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const params = new URLSearchParams();
        if (branchId) params.set("branchId", branchId);
        if (status) params.set("status", status);
        const res = await fetch(`${API_BACKEND_URL}/stock/inventory-items/history/${defId}?${params.toString()}`, { credentials: "include" });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message || "Failed to load batches");
        setRows(json.data || []);
      } catch (err) {
        setError(err.message);
        setRows([]);
      }
    })();
  }, [defId, branchId, status]);

  return (
    <Modal onClose={onClose} title={`Batch Breakdown — ${productName}`} maxWidth={fields.length > 0 ? "max-w-2xl" : "max-w-lg"}>
      {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}
      {rows === null ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />)}</div>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">No receiving batches found.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-100">
          <table className="w-full min-w-full border-collapse text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2.5">Received via</th>
                <th className="px-3 py-2.5">Date</th>
                {fields.map((fd) => (
                  <th key={fd._id} className="px-3 py-2.5">{fd.label}</th>
                ))}
                <th className="px-3 py-2.5 text-right">Quantity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.refId || r.refNumber || "unknown"}>
                  <td className="px-3 py-2 font-medium text-slate-900">
                    {r.refNumber || "—"}
                    {r.sourceType && <span className="ml-1.5 text-xs font-normal text-slate-500">{SOURCE_LABEL[r.sourceType] || r.sourceType}</span>}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{fmtDate(r.receivedAt)}</td>
                  {fields.map((fd) => (
                    <td key={fd._id} className="px-3 py-2 text-slate-700">{r.fieldValues?.[fd.code] ?? "—"}</td>
                  ))}
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">{r.quantity} {unitText}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
};

/* ============================================================= */
/* Full details popup — Action "View". Individual: every selected   */
/* field + vendor/invoice/date/status. Group: product/unit/total/    */
/* branch/batch summary.                                          */
/* ============================================================= */
const DetailField = ({ label, value, valueCls = "text-slate-900" }) => (
  <div>
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className={`mt-1 text-sm font-medium ${valueCls}`}>{value ?? "—"}</p>
  </div>
);

/* ============================================================= */
/* Timeline — where this unit came from and everything since.     */
/* ============================================================= */
const REF_LABEL = { INVOICE: "Invoice", OPENING_STOCK: "Opening Stock", TRANSFER_REQUEST: "Transfer", ITEM_REQUEST: "Request" };
const describeMovement = (m) => {
  if (m.type === "RECEIVED")
    return `Received via ${REF_LABEL[m.ref?.type] || "—"} ${m.ref?.refNumber || ""}${m.toBranchId?.name ? ` at ${m.toBranchId.name}` : ""}`;
  if (m.type === "TRANSFERRED")
    return `Transferred ${m.fromBranchId?.name || "—"} → ${m.toBranchId?.name || "—"}${m.ref?.refNumber ? ` (${m.ref.refNumber})` : ""}`;
  if (m.type === "ISSUED") return `${m.note || "Issued"}${m.ref?.refNumber ? ` (${m.ref.refNumber})` : ""}`;
  return m.type;
};

const ItemTimeline = ({ itemId }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BACKEND_URL}/stock/inventory-items/${itemId}/timeline`, { credentials: "include" });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message || "Failed to load history");
        setData(json.data);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, [itemId]);

  return (
    <div className="mt-5 border-t border-slate-100 pt-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">History</p>
      {error ? (
        <p className="text-sm text-rose-600">{error}</p>
      ) : !data ? (
        <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
      ) : (
        <ol className="relative ml-2 space-y-3 border-l border-slate-200 pl-5">
          {data.preSystem && (
            <li className="relative">
              <span className="absolute -left-6.75 top-1 h-3 w-3 rounded-full border-2 border-slate-300 bg-white" />
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Before this system</p>
              {data.preSystem.lastUsedBy && (
                <p className="text-sm text-slate-700">Last used by: <b>{data.preSystem.lastUsedBy}</b></p>
              )}
              {data.preSystem.remarks && <p className="text-sm text-slate-600">“{data.preSystem.remarks}”</p>}
            </li>
          )}
          {data.movements.map((m) => (
            <li key={m._id} className="relative">
              <span className="absolute -left-6.75 top-1 h-3 w-3 rounded-full bg-indigo-500 ring-4 ring-indigo-50" />
              <p className="text-xs text-slate-400">
                {fmtDate(m.at)}
                {m.createdBy?.name ? ` · ${m.createdBy.name}` : ""}
              </p>
              <p className="text-sm font-medium text-slate-800">
                {describeMovement(m)}
                {m.quantity ? <span className="font-normal text-slate-500"> · {m.quantity}</span> : null}
              </p>
              {m.note && <p className="text-xs text-violet-700">{m.note}</p>}
            </li>
          ))}
          {!data.preSystem && data.movements.length === 0 && <li className="text-sm text-slate-400">No history recorded yet.</li>}
        </ol>
      )}
    </div>
  );
};

const ViewDetailsModal = ({ card, onClose }) => {
  const def = card.productDefinitionId || {};
  const isGroup = card.cardType === "group";
  const fields = (def.selectedFields || []).map((sf) => sf.fieldDefId).filter(Boolean);

  return (
    <Modal onClose={onClose} title={def.name || "Item details"} maxWidth="max-w-xl">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DetailField label="Category Path" value={def.categoryPath} />
        <DetailField label="Product Name" value={def.name} />
        <DetailField label="Branch" value={card.branchId?.name} />
        <DetailField label="Unit" value={unitLabel(def.unit)} />

        {isGroup ? (
          <>
            <DetailField label="Available Quantity" value={`${card.totalQty} ${unitLabel(def.unit)}`.trim()} valueCls="text-indigo-700" />
            <DetailField label="Receiving Batches" value={card.batchCount} />
            <DetailField label="Last Received" value={fmtDate(card.latestReceivedAt)} />
          </>
        ) : (
          <>
            <DetailField
              label="Came In Via"
              value={card.source?.type ? `${SOURCE_LABEL[card.source.type] || card.source.type} · ${card.source.refNumber || "—"}` : card.invoiceId?.invoiceNumber}
            />
            <DetailField label="Condition" value={<ConditionBadge condition={card.condition} />} />
            <DetailField label="Vendor" value={card.vendorId?.name} />
            <DetailField label="Warranty" value={<WarrantyBadge endDate={card.warranty?.endDate} />} />
            <DetailField label="Purchase Date" value={fmtDate(card.purchaseDate)} />
            <DetailField label="Purchase Cost" value={card.purchaseCost === null || card.purchaseCost === undefined ? "Not known" : money(card.purchaseCost)} />
            {card.status === "RESERVED" && <DetailField label="Currently With" value={card.heldByNote || "—"} valueCls="text-violet-700" />}
            {card.status === "ASSIGNED" && (
              <DetailField
                label="Issued To"
                value={`${card.assignedTo?.orderId || "—"}${card.assignedTo?.username ? ` · ${card.assignedTo.username}` : ""} (${card.assignedTo?.requestNumber || "—"})`}
                valueCls="text-indigo-700"
              />
            )}
            {card.invoiceId?.receivedByName && <DetailField label="Received By" value={card.invoiceId.receivedByName} />}
            <DetailField label="Received Date" value={fmtDateTime(card.receivedAt)} />
            <DetailField
              label="Approval Status"
              value={APPROVAL_STATUS_LABEL[card.approvalStatus] || card.approvalStatus}
              valueCls={card.approvalStatus === "APPROVED" ? "text-emerald-700" : card.approvalStatus === "REJECTED" ? "text-rose-700" : "text-amber-700"}
            />
          </>
        )}
      </div>

      {fields.length > 0 && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Product Fields</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {fields.map((fd) => {
              const varies = isGroup && card.variedFields?.includes(fd.code);
              return (
                <div key={fd._id}>
                  <p className="text-xs text-slate-400">{fd.label}</p>
                  <p className={`text-sm font-medium ${varies ? "text-amber-600" : "text-slate-900"}`}>
                    {varies ? "Varies by batch" : card.fieldValues?.[fd.code] ?? "—"}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!isGroup && <ItemTimeline itemId={card._id} />}
    </Modal>
  );
};

/* ============================================================= */
/* One row — bordered box, label-over-value columns. Individual =   */
/* one row per physical unit (fields shown inline). Group = one row */
/* per product+branch (Quantity + info button for the batches).  */
/* ============================================================= */
const InventoryRow = ({ card, onView, onShowBatches }) => {
  const def = card.productDefinitionId || {};
  const isGroup = card.cardType === "group";
  const fields = (def.selectedFields || []).map((sf) => sf.fieldDefId).filter(Boolean);
  const unit = unitLabel(def.unit);

  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md">
      <Col label="Category Path" className="w-40">{def.categoryPath || "—"}</Col>
      <Col label="Product" className="w-40 font-medium text-slate-900">{def.name || "—"}</Col>

      {isGroup && (
        <Col label="Quantity" className="w-40">
          <span className="inline-flex items-center gap-1.5">
            <span className="font-semibold text-indigo-700">{card.totalQty} {unit}</span>
            <button
              type="button" onClick={() => onShowBatches(card)} title="Show batch-wise breakdown"
              className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-indigo-200 text-indigo-500 transition hover:bg-indigo-50"
            >
              <Info className="h-3 w-3" />
            </button>
          </span>
        </Col>
      )}

      {/* Both tracking methods show their tracked fields here. For Individual
          the value belongs to this one unit; for Group the card rolls up every
          batch, so a value only shows when all of them agree — otherwise it
          says Multiple and points at the batch breakdown. */}
      {fields.map((fd) => (
        <Col key={fd._id} label={fd.label} className="w-32">
          {isGroup && card.variedFields?.includes(fd.code) ? (
            <button
              type="button" onClick={() => onShowBatches(card)}
              className="font-medium text-indigo-600 underline decoration-dotted underline-offset-2 transition hover:text-indigo-700"
            >
              Multiple
            </button>
          ) : (
            card.fieldValues?.[fd.code] ?? "—"
          )}
        </Col>
      ))}

      <Col label="Branch" className="w-36">{card.branchId?.name || "—"}</Col>

      {!isGroup && (
        <Col label="Origin & Condition" className="min-w-56">
          <span className="flex flex-wrap gap-1">
            <ConditionBadge condition={card.condition} />
            <SourceBadge source={card.source} />
            <WarrantyBadge endDate={card.warranty?.endDate} />
            {card.status === "RESERVED" && <ReservedBadge heldByNote={card.heldByNote} />}
            {card.status === "ASSIGNED" && <AssignedBadge assignedTo={card.assignedTo} />}
          </span>
        </Col>
      )}

      <div className="ml-auto shrink-0">
        <p className={colLabel}>Action</p>
        <button
          type="button" onClick={() => onView(card)}
          className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600"
        >
          <Eye className="h-3.5 w-3.5" /> View
        </button>
      </div>
    </div>
  );
};

const ItemInventory = () => {
  const searchParams = useSearchParams();
  const initialProductId = searchParams.get("productDefinitionId") || "";

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [productId, setProductId] = useState(initialProductId);
  const [branchId, setBranchId] = useState("");
  // AVAILABLE = can be handed out; RESERVED = on the books but still with an
  // employee (opening stock not yet assigned).
  const [status, setStatus] = useState("AVAILABLE");
  const [sourceType, setSourceType] = useState("");
  const [condition, setCondition] = useState("");

  const [categories, setCategories] = useState([]);
  const [productOptions, setProductOptions] = useState([]);
  const [branches, setBranches] = useState([]);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(12);
  const [total, setTotal] = useState(0);

  const [viewing, setViewing] = useState(null);
  const [batchesFor, setBatchesFor] = useState(null);

  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 350); return () => clearTimeout(t); }, [search]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BACKEND_URL}/stock/categories/flat?type=LEAF&hasProducts=true&limit=500`, { credentials: "include" });
        const j = await r.json(); if (j.success) setCategories(j.data || []);
      } catch {}
      // Only the branches this user can actually see inventory in — offering a
      // branch whose rows are all scoped away would just filter to an empty
      // list. ?module=inventory-items keeps this off branches:READ, which a
      // stock viewer has no reason to hold.
      try {
        const r = await fetch(`${API_BACKEND_URL}/stock/scoped-branches?module=inventory-items`, { credentials: "include" });
        const j = await r.json(); if (j.success) setBranches(j.data?.branches || []);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!categoryId) { setProductOptions([]); return; }
      try {
        const r = await fetch(`${API_BACKEND_URL}/stock/product-definitions?categoryId=${categoryId}&limit=1000`, { credentials: "include" });
        const j = await r.json(); if (j.success) setProductOptions((j.data || []).map((p) => ({ value: p._id, label: p.name })));
      } catch { setProductOptions([]); }
    })();
  }, [categoryId]);

  const loadList = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (categoryId) params.set("categoryId", categoryId);
      if (productId) params.set("productDefinitionId", productId);
      if (branchId) params.set("branchId", branchId);
      params.set("status", status);
      if (sourceType) params.set("sourceType", sourceType);
      if (condition) params.set("condition", condition);
      const res = await fetch(`${API_BACKEND_URL}/stock/inventory-items/cards?${params.toString()}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to fetch items");
      setRows(json.data || []);
      setTotal(json.pagination?.total ?? 0);
    } catch (err) { setError(err.message); setRows([]); setTotal(0); } finally { setLoading(false); }
  }, [page, limit, debouncedSearch, categoryId, productId, branchId, status, sourceType, condition]);

  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => { setPage(1); }, [debouncedSearch, categoryId, productId, branchId, status, sourceType, condition]);

  const categoryOptions = useMemo(() => categories.map((c) => ({ value: c._id, label: c.displayPath || c.name })), [categories]);

  const hasActiveFilters = !!search || !!categoryId || !!productId || !!branchId || !!sourceType || !!condition;
  const clearFilters = () => {
    setSearch(""); setCategoryId(""); setProductId(""); setBranchId(""); setSourceType(""); setCondition(""); setPage(1);
  };

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Item Inventory</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Individually tracked units, one row each — group/batch stock rolled up into a single row per product and branch.
        </p>
      </div>

      {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            {[
              { value: "AVAILABLE", label: "Available" },
              { value: "RESERVED", label: "Reserved (with employees)" },
              { value: "ASSIGNED", label: "Assigned (with subscribers)" },
            ].map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setStatus(t.value)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  status === t.value ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="w-44">
            <SearchableSelect
              value={sourceType}
              onChange={setSourceType}
              options={[{ value: "PURCHASE", label: "Invoice" }, { value: "OPENING_STOCK", label: "Opening Stock" }]}
              placeholder="Any origin"
            />
          </div>
          <div className="w-36">
            <SearchableSelect
              value={condition}
              onChange={setCondition}
              options={[{ value: "NEW", label: "New" }, { value: "USED", label: "Used" }]}
              placeholder="Any condition"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <input
              type="text" value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search serial number, MAC address..."
              className={inputCls}
            />
          </div>
          <SearchableSelect value={categoryId} onChange={(v) => { setCategoryId(v); setProductId(""); }} options={categoryOptions} placeholder="All categories" />
          <SearchableSelect value={productId} onChange={setProductId} options={productOptions} placeholder={categoryId ? "All products" : "Select a category first"} disabled={!categoryId} />
          <SearchableSelect value={branchId} onChange={setBranchId} options={branches.map((w) => ({ value: w._id, label: w.name }))} placeholder="All branches" />
        </div>
        {hasActiveFilters && (
          <div className="mt-3">
            <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600 shadow-sm transition hover:border-rose-400 hover:bg-rose-100">
              <RotateCcw className="h-4 w-4" /> Reset
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl border border-slate-200 bg-white shadow-sm" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white py-16 text-center shadow-sm">
          <Boxes className="h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-700">No stock found</p>
          <p className="mt-1 text-sm text-slate-400">Adjust the filters above to widen the search.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((card) => (
            <InventoryRow key={card._id} card={card} onView={setViewing} onShowBatches={setBatchesFor} />
          ))}
        </div>
      )}

      <div className="mt-5">
        <Pagination currentPage={page} totalItems={total} itemsPerPage={limit} onPageChange={setPage} onItemsPerPageChange={(n) => { setLimit(n); setPage(1); }} />
      </div>

      {viewing && <ViewDetailsModal card={viewing} onClose={() => setViewing(null)} />}
      {batchesFor && (
        <BatchBreakdownModal
          productName={batchesFor.productDefinitionId?.name}
          unitText={unitLabel(batchesFor.productDefinitionId?.unit)}
          defId={batchesFor.productDefinitionId?._id}
          branchId={batchesFor.branchId?._id}
          status={status}
          fields={(batchesFor.productDefinitionId?.selectedFields || []).map((sf) => sf.fieldDefId).filter(Boolean)}
          onClose={() => setBatchesFor(null)}
        />
      )}
    </div>
  );
};

export default ItemInventory;
