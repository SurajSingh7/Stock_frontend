"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import Pagination from "@/shared/ui/pagination/Pagination";
import { RotateCcw, Eye } from "lucide-react";
import { SearchableSelect, Modal, inputCls } from "@/modules/stock/shared/StockSharedUI";

const th = "px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-700";
const thRight = "px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-700";

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");

// Renders the union of `showList` fields present across the currently loaded
// page's products, so a mixed-product list still shows every relevant column
// (rows without a given field render "—").
const collectShowListFields = (rows) => {
  const map = new Map();
  rows.forEach((item) => {
    (item.productDefinitionId?.selectedFields || []).forEach((sf) => {
      const fd = sf.fieldDefId;
      if (fd && fd.showList && !map.has(fd.code)) map.set(fd.code, fd);
    });
  });
  return [...map.values()];
};

const APPROVAL_STATUS_LABEL = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

const DetailField = ({ label, value, valueCls = "text-slate-900" }) => (
  <div>
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className={`mt-1 text-sm font-medium ${valueCls}`}>{value ?? "—"}</p>
  </div>
);

const ItemDetailsPopup = ({ item, onClose }) => {
  const def = item.productDefinitionId || {};
  const allFields = (def.selectedFields || []).map((sf) => sf.fieldDefId).filter(Boolean);
  return (
    <Modal onClose={onClose} title={def.name || "Item details"} maxWidth="max-w-xl">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DetailField label="Category Path" value={def.categoryPath} />
        <DetailField label="Product Name" value={def.name} />
        <DetailField label="Warehouse" value={item.warehouseId?.name} />
        <DetailField label="Invoice Number" value={item.invoiceId?.invoiceNumber} />
        <DetailField label="Vendor" value={item.vendorId?.name} />
        <DetailField label="Created By" value={item.invoiceId?.receivedByName} />
        <DetailField label="Created Date" value={fmtDate(item.createdAt || item.receivedAt)} />
        <DetailField
          label="Approval Status"
          value={APPROVAL_STATUS_LABEL[item.approvalStatus] || item.approvalStatus}
          valueCls={item.approvalStatus === "APPROVED" ? "text-emerald-700" : item.approvalStatus === "REJECTED" ? "text-rose-700" : "text-amber-700"}
        />
        {item.quantity != null && <DetailField label="Quantity" value={item.quantity} />}
      </div>

      {allFields.length > 0 && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Product Fields</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {allFields.map((fd) => (
              <div key={fd._id}>
                <p className="text-xs text-slate-400">{fd.label}</p>
                <p className="text-sm font-medium text-slate-900">{item.fieldValues?.[fd.code] ?? "—"}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
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
  const [warehouseId, setWarehouseId] = useState("");

  const [categories, setCategories] = useState([]);
  const [productOptions, setProductOptions] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);

  const [detailsFor, setDetailsFor] = useState(null);

  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 350); return () => clearTimeout(t); }, [search]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BACKEND_URL}/stock/categories/flat?type=LEAF&hasProducts=true&limit=500`, { credentials: "include" });
        const j = await r.json(); if (j.success) setCategories(j.data || []);
      } catch {}
      try {
        const r = await fetch(`${API_BACKEND_URL}/stock/warehouses/active`, { credentials: "include" });
        const j = await r.json(); if (j.success) setWarehouses(j.data || []);
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
      const params = new URLSearchParams({ page: String(page), limit: String(limit), approvalStatus: "APPROVED", status: "AVAILABLE" });
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (categoryId) params.set("categoryId", categoryId);
      if (productId) params.set("productDefinitionId", productId);
      if (warehouseId) params.set("warehouseId", warehouseId);
      const res = await fetch(`${API_BACKEND_URL}/stock/inventory-items?${params.toString()}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to fetch items");
      setRows(json.data || []);
      setTotal(json.pagination?.total ?? 0);
    } catch (err) { setError(err.message); setRows([]); setTotal(0); } finally { setLoading(false); }
  }, [page, limit, debouncedSearch, categoryId, productId, warehouseId]);

  useEffect(() => { loadList(); }, [loadList]);

  const categoryOptions = useMemo(() => categories.map((c) => ({ value: c._id, label: c.displayPath || c.name })), [categories]);
  const listColumns = useMemo(() => collectShowListFields(rows), [rows]);

  const hasActiveFilters = !!search || !!categoryId || !!productId || !!warehouseId;
  const clearFilters = () => { setSearch(""); setCategoryId(""); setProductId(""); setWarehouseId(""); setPage(1); };

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Item Inventory</h1>
        <p className="mt-0.5 text-sm text-slate-500">Every individually tracked unit currently in stock.</p>
      </div>

      {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <input
              type="text" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search serial number, MAC address..."
              className={inputCls}
            />
          </div>
          <SearchableSelect value={categoryId} onChange={(v) => { setCategoryId(v); setProductId(""); setPage(1); }} options={categoryOptions} placeholder="All categories" />
          <SearchableSelect value={productId} onChange={(v) => { setProductId(v); setPage(1); }} options={productOptions} placeholder={categoryId ? "All products" : "Select a category first"} disabled={!categoryId} />
          <SearchableSelect value={warehouseId} onChange={(v) => { setWarehouseId(v); setPage(1); }} options={warehouses.map((w) => ({ value: w._id, label: w.name }))} placeholder="All warehouses" />
        </div>
        {hasActiveFilters && (
          <div className="mt-3">
            <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600 shadow-sm transition hover:border-rose-400 hover:bg-rose-100">
              <RotateCcw className="h-4 w-4" /> Reset
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50/60">
            <tr>
              <th className={th}>Category Path</th>
              <th className={th}>Product Name</th>
              {listColumns.map((fd) => <th key={fd._id} className={th}>{fd.label}</th>)}
              <th className={thRight}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={3 + listColumns.length} className="px-4 py-12 text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
              </td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={3 + listColumns.length} className="px-4 py-16 text-center">
                <p className="text-sm font-medium text-slate-700">No items found</p>
                <p className="mt-1 text-sm text-slate-400">Adjust the filters above to widen the search.</p>
              </td></tr>
            ) : (
              rows.map((item) => (
                <tr key={item._id} className="transition hover:bg-slate-50/60">
                  <td className="px-4 py-3 text-sm text-slate-600">{item.productDefinitionId?.categoryPath || "—"}</td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{item.productDefinitionId?.name || "—"}</td>
                  {listColumns.map((fd) => (
                    <td key={fd._id} className="px-4 py-3 text-sm text-slate-700">{item.fieldValues?.[fd.code] ?? "—"}</td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => setDetailsFor(item)} className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-white px-2.5 py-1 text-xs font-medium text-indigo-600 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50">
                      <Eye className="h-3.5 w-3.5" /> View Details
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-5">
        <Pagination currentPage={page} totalItems={total} itemsPerPage={limit} onPageChange={setPage} onItemsPerPageChange={(n) => { setLimit(n); setPage(1); }} />
      </div>

      {detailsFor && <ItemDetailsPopup item={detailsFor} onClose={() => setDetailsFor(null)} />}
    </div>
  );
};

export default ItemInventory;
