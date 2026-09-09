"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import Pagination from "@/shared/ui/pagination/Pagination";
import { RotateCcw, Boxes, Info, Eye } from "lucide-react";
import { SearchableSelect, Modal, inputCls, unitLabel } from "@/modules/stock/shared/StockSharedUI";

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");
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
const BatchBreakdownModal = ({ productName, unitText, defId, branchId, onClose }) => {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const params = new URLSearchParams();
        if (branchId) params.set("branchId", branchId);
        const res = await fetch(`${API_BACKEND_URL}/stock/inventory-items/history/${defId}?${params.toString()}`, { credentials: "include" });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message || "Failed to load batches");
        setRows(json.data || []);
      } catch (err) {
        setError(err.message);
        setRows([]);
      }
    })();
  }, [defId, branchId]);

  return (
    <Modal onClose={onClose} title={`Batch Breakdown — ${productName}`} maxWidth="max-w-lg">
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
                <th className="px-3 py-2.5">Invoice</th>
                <th className="px-3 py-2.5">Date</th>
                <th className="px-3 py-2.5 text-right">Quantity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.invoiceId || r.invoiceNumber}>
                  <td className="px-3 py-2 font-medium text-slate-900">{r.invoiceNumber || "—"}</td>
                  <td className="px-3 py-2 text-slate-600">{fmtDate(r.invoiceDate)}</td>
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
            <DetailField label="Invoice Number" value={card.invoiceId?.invoiceNumber} />
            <DetailField label="Vendor" value={card.vendorId?.name} />
            <DetailField label="Received By" value={card.invoiceId?.receivedByName} />
            <DetailField label="Received Date" value={fmtDateTime(card.receivedAt)} />
            <DetailField
              label="Approval Status"
              value={APPROVAL_STATUS_LABEL[card.approvalStatus] || card.approvalStatus}
              valueCls={card.approvalStatus === "APPROVED" ? "text-emerald-700" : card.approvalStatus === "REJECTED" ? "text-rose-700" : "text-amber-700"}
            />
          </>
        )}
      </div>

      {!isGroup && fields.length > 0 && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Product Fields</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {fields.map((fd) => (
              <div key={fd._id}>
                <p className="text-xs text-slate-400">{fd.label}</p>
                <p className="text-sm font-medium text-slate-900">{card.fieldValues?.[fd.code] ?? "—"}</p>
              </div>
            ))}
          </div>
        </div>
      )}
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

      {isGroup ? (
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
      ) : (
        fields.map((fd) => (
          <Col key={fd._id} label={fd.label} className="w-32">{card.fieldValues?.[fd.code] ?? "—"}</Col>
        ))
      )}

      <Col label="Branch" className="w-36">{card.branchId?.name || "—"}</Col>

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
      try {
        const r = await fetch(`${API_BACKEND_URL}/stock/branches/active`, { credentials: "include" });
        const j = await r.json(); if (j.success) setBranches(j.data || []);
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
      const res = await fetch(`${API_BACKEND_URL}/stock/inventory-items/cards?${params.toString()}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to fetch items");
      setRows(json.data || []);
      setTotal(json.pagination?.total ?? 0);
    } catch (err) { setError(err.message); setRows([]); setTotal(0); } finally { setLoading(false); }
  }, [page, limit, debouncedSearch, categoryId, productId, branchId]);

  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => { setPage(1); }, [debouncedSearch, categoryId, productId, branchId]);

  const categoryOptions = useMemo(() => categories.map((c) => ({ value: c._id, label: c.displayPath || c.name })), [categories]);

  const hasActiveFilters = !!search || !!categoryId || !!productId || !!branchId;
  const clearFilters = () => { setSearch(""); setCategoryId(""); setProductId(""); setBranchId(""); setPage(1); };

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
          onClose={() => setBatchesFor(null)}
        />
      )}
    </div>
  );
};

export default ItemInventory;
