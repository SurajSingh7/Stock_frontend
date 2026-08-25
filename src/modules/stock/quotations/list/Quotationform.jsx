"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import { ArrowLeft, Plus, Trash2, Star } from "lucide-react";
import { SearchableSelect, unitLabel } from "@/modules/stock/shared/StockSharedUI";

/* ============================================================= */
/* Constants — SAME tokens as PurchaseOrderPage                   */
/* ============================================================= */

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const previewTotal = (qty, price, gstRate) => {
  const base = (Number(qty) || 0) * (Number(price) || 0);
  return round2(base + (base * (Number(gstRate) || 0)) / 100);
};
const dash = (v) => (v === null || v === undefined || v === "" ? "—" : v);

const localInputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-800 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";
const cardTitleCls = "text-xs font-bold uppercase tracking-wider text-slate-600";
const labelCls = "mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-800";

const th = "px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-slate-700";
const thRight = `${th} text-right`;

/* meaningful-label toggle switch */
const Toggle = ({ checked, onChange, label }) => (
  <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-2">
    <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${checked ? "bg-indigo-600" : "bg-slate-300"}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
    </span>
    <span className="text-sm font-medium text-slate-700">{label}</span>
  </button>
);

/*
  Pure display-only pivot: block.vendors (Vendor -> Products, the actual state
  shape used by toggleRow/mutateRow/collectItems below — unchanged) grouped
  instead as Product -> Vendors, to match the Review page's Category -> Product
  -> Vendor hierarchy. Every row keeps its original vendorId/productDefinitionId
  so the same mutator handlers still apply — only the rendering grouping changes.
*/
const groupByProduct = (vendors = []) => {
  const products = new Map();
  vendors.forEach((v) => {
    v.products.forEach((p) => {
      if (!products.has(p.productDefinitionId)) {
        products.set(p.productDefinitionId, { productDefinitionId: p.productDefinitionId, name: p.name, rows: [] });
      }
      products.get(p.productDefinitionId).rows.push({ vendorId: v.vendorId, vendorName: v.vendorName, ...p });
    });
  });
  return [...products.values()];
};

/* one card per product — lists every vendor offering it */
const ProductSection = ({ product, quantityEditable, onToggle, onPriceChange, onQtyChange }) => (
  <div className="mb-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-5 py-3">
      <span className="text-sm font-bold text-slate-900">{product.name}</span>
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 tabular-nums">
        {product.rows.length} vendor{product.rows.length > 1 ? "s" : ""}
      </span>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-full border-collapse">
        <thead className="bg-white">
          <tr className="border-b border-slate-100">
            <th className="w-10 px-3 py-2.5" />
            <th className={th}>Vendor</th>
            <th className={th}>Qty</th>
            <th className={th}>Warranty</th>
            <th className={th}>Price</th>
            <th className={th}>Prev Qty</th>
            <th className={th}>Prev ₹</th>
            <th className={th}>Rating</th>
            <th className={th}>GST</th>
            <th className={thRight}>Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {product.rows.map((row) => (
            <tr key={row.vendorId} className={`transition ${row.checked ? "bg-indigo-50/60" : "hover:bg-slate-50/60"}`}>
              <td className="px-3 py-2.5 text-center">
                <input
                  type="checkbox" checked={row.checked}
                  onChange={() => onToggle(row.vendorId, row.productDefinitionId)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
              </td>
              <td className="px-3 py-2.5 text-sm font-medium text-slate-900">{row.vendorName}</td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-1.5">
                  <input
                    type="number" value={row.quantity} readOnly={!quantityEditable}
                    onChange={(e) => onQtyChange(row.vendorId, row.productDefinitionId, e.target.value)}
                    className={`h-8 w-16 rounded-lg border px-2 text-sm tabular-nums shadow-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-100 ${
                      quantityEditable ? "border-slate-200 bg-white text-slate-900" : "border-transparent bg-slate-50 text-slate-500"
                    }`}
                  />
                  <span className="text-xs text-slate-400">{unitLabel(row.unit)}</span>
                </div>
              </td>
              <td className="px-3 py-2.5 text-sm text-slate-700 tabular-nums">
                {row.warrantyYears ? `${row.warrantyYears} yr${row.warrantyYears === 1 ? "" : "s"}` : "—"}
              </td>
              <td className="px-3 py-2.5">
                <input
                  type="number" value={row.unitPrice} placeholder="—"
                  onChange={(e) => onPriceChange(row.vendorId, row.productDefinitionId, e.target.value)}
                  className="h-8 w-20 rounded-lg border border-slate-200 bg-white px-2 text-sm tabular-nums text-slate-900 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </td>
              <td className="px-3 py-2.5 text-sm text-slate-500 tabular-nums">
                {dash(row.previousQuantity)}{row.previousQuantity != null ? ` ${unitLabel(row.unit)}` : ""}
              </td>
              <td className="px-3 py-2.5 text-sm text-slate-500 tabular-nums">{dash(row.previousPrice)}</td>
              <td className="px-3 py-2.5 text-sm text-slate-500">
                {row.averageRating == null ? (
                  "—"
                ) : (
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Star className="h-3.5 w-3.5 text-amber-500" /> {row.averageRating}
                  </span>
                )}
              </td>
              <td className="px-3 py-2.5 text-sm text-slate-500 tabular-nums">{row.gstRate}%</td>
              <td className="px-3 py-2.5 text-right text-sm font-bold text-slate-900 tabular-nums">
                {row.checked ? previewTotal(row.quantity, row.unitPrice, row.gstRate).toLocaleString("en-IN") : 0}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

/* ============================================================= */
/* Main                                                           */
/* ============================================================= */

const QuotationForm = ({ quotationId = null }) => {
  const router = useRouter();
  const isEdit = Boolean(quotationId);

  const [blocks, setBlocks] = useState([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [categories, setCategories] = useState([]);   // leaf + hasProducts
  const [pickCatId, setPickCatId] = useState("");

  // global product-selection options
  const [quantityEditable, setQuantityEditable] = useState(false); // default No
  const [autoSelectAll, setAutoSelectAll] = useState(true);        // default Yes
  const [globalQty, setGlobalQty] = useState(1);                   // applies to all rows

  /* ---- leaf categories that have products (server-side) ---- */
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BACKEND_URL}/stock/categories/flat?type=LEAF&hasProducts=true&limit=500`, { credentials: "include" });
        const j = await r.json();
        if (j.success) setCategories(j.data || []);
      } catch { /* ignore */ }
    })();
  }, []);

  const categoryOptions = categories.map((c) => ({ value: c._id, label: c.displayPath || c.name }));

  /* ---- edit load ---- */
  const loadForEdit = useCallback(async () => {
    if (!isEdit) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BACKEND_URL}/stock/quotations/${quotationId}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to load quotation");
      const data = json.data;
      const byCat = new Map();
      (data.items || []).forEach((it) => {
        const catId = String(it.categoryId?._id || it.categoryId);
        if (!byCat.has(catId)) byCat.set(catId, { categoryId: catId, categoryName: it.categoryName || it.categoryId?.name || "", vendors: new Map() });
        const cat = byCat.get(catId);
        const venId = String(it.vendorId?._id || it.vendorId);
        if (!cat.vendors.has(venId)) cat.vendors.set(venId, { vendorId: venId, vendorName: it.vendorName || it.vendorId?.name || "", products: [] });
        cat.vendors.get(venId).products.push({
          productDefinitionId: String(it.productDefinitionId?._id || it.productDefinitionId),
          name: it.productName || it.productDefinitionId?.name || "",
          trackingMethod: it.trackingMethod || it.productDefinitionId?.trackingMethod || "",
          unit: it.unit || it.productDefinitionId?.unit || "",
          quantity: it.quantity, unitPrice: it.unitPrice, warrantyYears: it.warrantyYears, gstRate: it.gstRate,
          previousQuantity: it.previousQuantity, previousPrice: it.previousPrice,
          averageRating: it.averageRating, checked: true,
        });
      });
      setBlocks([...byCat.values()].map((c) => ({ categoryId: c.categoryId, categoryName: c.categoryName, vendors: [...c.vendors.values()] })));
      setNotes(data.notes || "");
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }, [isEdit, quotationId]);

  useEffect(() => { loadForEdit(); }, [loadForEdit]);

  /* ---- add category ---- */
  const addCategory = async () => {
    const cat = categories.find((c) => c._id === pickCatId);
    if (!cat) return;
    if (blocks.some((b) => b.categoryId === cat._id)) { setPickCatId(""); return; }
    setError(null);
    try {
      const res = await fetch(`${API_BACKEND_URL}/stock/quotations/vendors-for-category/${cat._id}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to load vendors");
      const vendors = (json.data || []).map((v) => ({
        vendorId: String(v.vendorId), vendorName: v.vendorName,
        products: (v.products || []).map((p) => ({
          productDefinitionId: String(p.productDefinitionId), name: p.name, gstRate: p.gstRate,
          trackingMethod: p.trackingMethod || "",
          unit: p.unit || "",
          warrantyYears: p.warrantyYears ?? null,
          quantity: Number(globalQty) || 1, unitPrice: "", previousQuantity: null, previousPrice: null, averageRating: null,
          checked: autoSelectAll, // auto-select toggle drives the initial state
        })),
      }));
      setBlocks((prev) => [...prev, { categoryId: cat._id, categoryName: cat.displayPath || cat.name, vendors }]);
      setPickCatId("");
    } catch (err) { setError(err.message); }
  };

  const removeCategory = (categoryId) => setBlocks((prev) => prev.filter((b) => b.categoryId !== categoryId));

  const mutateRow = (vendorId, productId, patch) =>
    setBlocks((prev) => prev.map((block) => ({
      ...block,
      vendors: block.vendors.map((v) => v.vendorId !== vendorId ? v : {
        ...v, products: v.products.map((p) => p.productDefinitionId === productId ? { ...p, ...patch } : p),
      }),
    })));

  const toggleRow = (vendorId, productId) =>
    setBlocks((prev) => prev.map((block) => ({
      ...block,
      vendors: block.vendors.map((v) => v.vendorId !== vendorId ? v : {
        ...v, products: v.products.map((p) => p.productDefinitionId === productId ? { ...p, checked: !p.checked } : p),
      }),
    })));

  // "Select all products automatically" toggle → check/uncheck every row
  const applyAutoSelect = (val) => {
    setAutoSelectAll(val);
    setBlocks((prev) => prev.map((block) => ({
      ...block, vendors: block.vendors.map((v) => ({ ...v, products: v.products.map((p) => ({ ...p, checked: val })) })),
    })));
  };

  // Global quantity → fills every product row's quantity
  const applyGlobalQty = (val) => {
    setGlobalQty(val);
    const q = val === "" ? "" : Number(val);
    setBlocks((prev) => prev.map((block) => ({
      ...block, vendors: block.vendors.map((v) => ({ ...v, products: v.products.map((p) => ({ ...p, quantity: q })) })),
    })));
  };

  /* ---- submit ---- */
  const collectItems = () => {
    const items = [];
    blocks.forEach((block) => block.vendors.forEach((v) => v.products.forEach((p) => {
      if (p.checked) items.push({
        productDefinitionId: p.productDefinitionId, vendorId: v.vendorId,
        categoryId: block.categoryId, categoryName: block.categoryName,
        quantity: Number(p.quantity) || 0, unitPrice: Number(p.unitPrice) || 0,
        warrantyYears: p.warrantyYears ?? null,
      });
    })));
    return items;
  };

  const handleSubmit = async () => {
    const items = collectItems();
    if (items.length === 0) { setError("Select at least one product before submitting"); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    if (items.find((it) => it.unitPrice <= 0)) { setError("Enter a price for every selected product"); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch(`${API_BACKEND_URL}/stock/quotations${isEdit ? `/${quotationId}` : ""}`, {
        method: isEdit ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ items, notes }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to save quotation");
      router.push("/stock/quotations/list");
    } catch (err) { setError(err.message); window.scrollTo({ top: 0, behavior: "smooth" }); } finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50/60 p-6">
        <div className="mx-auto max-w-5xl animate-pulse space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 rounded-2xl bg-slate-100" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/60">
      <div className="mx-auto max-w-5xl p-6 pb-12">
        {/* header */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button" onClick={() => router.push("/stock/quotations/list")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-slate-900">
                {isEdit ? "Edit quotation" : "Add quotation"}
              </h1>
              <p className="text-sm text-slate-500">Pick categories, then price each vendor’s products.</p>
            </div>
          </div>
          <button
            type="button" onClick={handleSubmit} disabled={saving}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving…" : "Submit quotation"}
          </button>
        </div>

        {error && (
          <div className="mb-5 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} className="font-bold">×</button>
          </div>
        )}

        {/* Category picker (searchable, leaf + has-products, path popup) */}
        <div className="mb-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="rounded-t-2xl border-b border-slate-100 bg-slate-50/60 px-5 py-3">
            <p className={cardTitleCls}>Add category</p>
          </div>
          <div className="p-5">
            <p className="mb-3 text-xs text-slate-500">Pick a last category, then add. Repeat for more categories.</p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[240px] flex-[2]">
                {/* <label className={labelCls}>Category (last / leaf)</label> */}
                    <label className={labelCls}>Category</label>
                <SearchableSelect
                  value={pickCatId} onChange={setPickCatId} options={categoryOptions} placeholder="Select category"
                />
              </div>
              <button
                type="button" onClick={addCategory} disabled={!pickCatId}
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-600 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
          </div>
        </div>

        {/* Global product-selection options */}
        {blocks.length > 0 && (
          <div className="mb-5 flex flex-wrap items-center gap-6 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">Quantity (all products)</label>
              <input
                type="number" min="1" value={globalQty} onChange={(e) => applyGlobalQty(e.target.value)}
                className="h-9 w-20 rounded-lg border border-slate-200 bg-white px-2 text-sm tabular-nums text-slate-900 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <Toggle checked={quantityEditable} onChange={setQuantityEditable} label="Allow per-row quantity editing" />
            <Toggle checked={autoSelectAll} onChange={applyAutoSelect} label="Select all products automatically" />
          </div>
        )}

        {/* Category blocks */}
        {blocks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-16 text-center">
            <p className="text-sm font-medium text-slate-700">No categories added yet</p>
            <p className="mt-1 text-sm text-slate-400">Add one above to begin building this quotation.</p>
          </div>
        ) : (
          blocks.map((block) => {
            return (
              <div key={block.categoryId} className="mb-6">
                <div className="mb-3 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {block.categoryName}
                  </span>
                  <button
                    type="button" onClick={() => removeCategory(block.categoryId)}
                    className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-white px-2 py-1 text-xs font-medium text-rose-600 shadow-sm transition hover:border-rose-300 hover:bg-rose-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </button>
                </div>
                {block.vendors.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-400">
                    No vendors supply products in this category.
                  </p>
                ) : (
                  groupByProduct(block.vendors).map((product) => (
                    <ProductSection
                      key={product.productDefinitionId} product={product} quantityEditable={quantityEditable}
                      onToggle={toggleRow}
                      onPriceChange={(vid, pid, val) => mutateRow(vid, pid, { unitPrice: val })}
                      onQtyChange={(vid, pid, val) => mutateRow(vid, pid, { quantity: val })}
                    />
                  ))
                )}
              </div>
            );
          })
        )}

        {blocks.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="rounded-t-2xl border-b border-slate-100 bg-slate-50/60 px-5 py-3">
              <p className={cardTitleCls}>Notes</p>
            </div>
            <div className="p-5">
              <textarea
                rows={3} className={localInputCls} value={notes} maxLength={500}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes about this quotation"
              />
              <p className="mt-1.5 text-right text-xs text-slate-400 tabular-nums">{notes.length}/500</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuotationForm;