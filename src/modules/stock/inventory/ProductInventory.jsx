"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import Pagination from "@/shared/ui/pagination/Pagination";
import { RotateCcw, History, Eye, ArrowLeft } from "lucide-react";
import { SearchableSelect, Modal, inputCls, unitLabel } from "@/modules/stock/shared/StockSharedUI";

const th = "px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-700";
const thRight = "px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-700";

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");

const STOCK_STATUS_OPTIONS = [
  { value: "", label: "All stock" },
  { value: "IN_STOCK", label: "In stock" },
  { value: "OUT_OF_STOCK", label: "Out of stock" },
];

/* ============================================================= */
/* History full page                                              */
/* ============================================================= */

const ProductInventoryHistory = ({ product, onBack }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true); setError(null);
      try {
        const res = await fetch(`${API_BACKEND_URL}/stock/inventory-items/history/${product.productDefinitionId}`, { credentials: "include" });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message || "Failed to load history");
        setRows(json.data || []);
      } catch (e) { setError(e.message); } finally { setLoading(false); }
    })();
  }, [product.productDefinitionId]);

  return (
    <div className="mx-auto max-w-3xl p-6 pb-12">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button
          type="button" onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="min-w-0">
          <h1 className="text-lg font-bold tracking-tight text-slate-900">Receiving history</h1>
          <p className="truncate text-sm text-slate-500">{product.productName} · {product.categoryPath}</p>
        </div>
      </div>

      {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {loading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />)}</div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No approved receiving history yet for this product.</p>
        ) : (
          <ol className="relative space-y-5 border-l-2 border-dashed border-slate-200 pl-5">
            {[...rows].reverse().map((r, i) => (
              <li key={r.invoiceId || i} className="relative">
                <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-indigo-500 shadow" />
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Invoice {r.invoiceNumber || "—"}</p>
                    <p className="text-xs text-slate-500">{fmtDate(r.invoiceDate)}</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                    Received {r.quantity} {unitLabel(product.unit)}
                  </span>
                </div>
              </li>
            ))}
            <li className="relative">
              <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-600 shadow" />
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
                <p className="text-sm font-bold text-emerald-800">Current Stock</p>
                <span className="rounded-full bg-emerald-600 px-3 py-1 text-sm font-semibold text-white">
                  {product.availableQty} {unitLabel(product.unit)}
                </span>
              </div>
            </li>
          </ol>
        )}
      </section>
    </div>
  );
};

/* ============================================================= */
/* Details popup                                                  */
/* ============================================================= */

const ProductDetailsPopup = ({ product, onClose }) => (
  <Modal onClose={onClose} title={product.productName}>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Category Path</p>
        <p className="mt-1 text-sm font-medium text-slate-900">{product.categoryPath || "—"}</p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Available Quantity</p>
        <p className="mt-1 text-sm font-semibold text-emerald-700 tabular-nums">{product.availableQty} {unitLabel(product.unit)}</p>
      </div>
    </div>
  </Modal>
);

/* ============================================================= */
/* Main                                                           */
/* ============================================================= */

const ProductInventory = () => {
  const router = useRouter();
  const [view, setView] = useState({ mode: "list" });

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [productId, setProductId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [stockStatus, setStockStatus] = useState("");

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
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (categoryId) params.set("categoryId", categoryId);
      if (productId) params.set("productDefinitionId", productId);
      if (warehouseId) params.set("warehouseId", warehouseId);
      if (stockStatus) params.set("stockStatus", stockStatus);
      const res = await fetch(`${API_BACKEND_URL}/stock/inventory-items/product-summary?${params.toString()}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to fetch product inventory");
      setRows(json.data || []);
      setTotal(json.pagination?.total ?? 0);
    } catch (err) { setError(err.message); setRows([]); setTotal(0); } finally { setLoading(false); }
  }, [page, limit, debouncedSearch, categoryId, productId, warehouseId, stockStatus]);

  useEffect(() => { loadList(); }, [loadList]);

  const categoryOptions = useMemo(() => categories.map((c) => ({ value: c._id, label: c.displayPath || c.name })), [categories]);

  const hasActiveFilters = !!search || !!categoryId || !!productId || !!warehouseId || !!stockStatus;
  const clearFilters = () => { setSearch(""); setCategoryId(""); setProductId(""); setWarehouseId(""); setStockStatus(""); setPage(1); };

  if (view.mode === "history") {
    return <ProductInventoryHistory product={view.product} onBack={() => setView({ mode: "list" })} />;
  }

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Product Inventory</h1>
        <p className="mt-0.5 text-sm text-slate-500">Available stock aggregated per product, across warehouses.</p>
      </div>

      {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <input
              type="text" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search product name..."
              className={inputCls}
            />
          </div>
          <SearchableSelect value={categoryId} onChange={(v) => { setCategoryId(v); setProductId(""); setPage(1); }} options={categoryOptions} placeholder="All categories" />
          <SearchableSelect value={productId} onChange={(v) => { setProductId(v); setPage(1); }} options={productOptions} placeholder={categoryId ? "All products" : "Select a category first"} disabled={!categoryId} />
          <SearchableSelect value={warehouseId} onChange={(v) => { setWarehouseId(v); setPage(1); }} options={warehouses.map((w) => ({ value: w._id, label: w.name }))} placeholder="All warehouses" />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <select value={stockStatus} onChange={(e) => { setStockStatus(e.target.value); setPage(1); }} className={`${inputCls} w-auto`}>
            {STOCK_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          {hasActiveFilters && (
            <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600 shadow-sm transition hover:border-rose-400 hover:bg-rose-100">
              <RotateCcw className="h-4 w-4" /> Reset
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50/60">
            <tr>
              <th className={th}>Category Path</th>
              <th className={th}>Product Name</th>
              <th className={thRight}>Available Quantity</th>
              <th className={thRight}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-12 text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
              </td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-16 text-center">
                <p className="text-sm font-medium text-slate-700">No products found</p>
                <p className="mt-1 text-sm text-slate-400">Adjust the filters above to widen the search.</p>
              </td></tr>
            ) : (
              rows.map((p) => (
                <tr key={p.productDefinitionId} className="transition hover:bg-slate-50/60">
                  <td className="px-4 py-3 text-sm text-slate-600">{p.categoryPath || "—"}</td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{p.productName}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => router.push(`/stock/item-inventory?productDefinitionId=${p.productDefinitionId}`)}
                      className={`text-sm font-semibold tabular-nums hover:underline ${p.availableQty > 0 ? "text-emerald-700" : "text-slate-400"}`}
                    >
                      {p.availableQty} {unitLabel(p.unit)}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button type="button" onClick={() => setDetailsFor(p)} className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-white px-2.5 py-1 text-xs font-medium text-indigo-600 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50">
                        <Eye className="h-3.5 w-3.5" /> View Details
                      </button>
                      <button type="button" onClick={() => setView({ mode: "history", product: p })} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50">
                        <History className="h-3.5 w-3.5" /> History
                      </button>
                    </div>
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

      {detailsFor && <ProductDetailsPopup product={detailsFor} onClose={() => setDetailsFor(null)} />}
    </div>
  );
};

export default ProductInventory;
