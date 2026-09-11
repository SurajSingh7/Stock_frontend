"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import { AlertTriangle, ArrowLeft, Plus, Trash2, Star } from "lucide-react";
import { SearchableSelect, unitLabel } from "@/modules/stock/shared/StockSharedUI";
import WarrantyInput from "@/shared/warranty/WarrantyInput";
import { formatWarrantyShort, isValidWarrantyMonths, WARRANTY_RANGE_MESSAGE } from "@/shared/warranty/warranty";

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

const okQty = (q) => Number.isInteger(Number(q)) && Number(q) >= 1 && q !== "";
const okPrice = (p) => p !== "" && Number.isFinite(Number(p)) && Number(p) > 0;

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
  The API already sends the form's shape — Category -> Products -> Vendors,
  with previous qty/price, rating and the vendor's default warranty resolved
  server-side (GET /quotations/vendors-for-category/:catId for a new category,
  GET /quotations/:id/form for edit). This only adds the editable UI state:
  product quantity, and per vendor checked / unitPrice / warrantyMonths.
  Fields the edit form sends (quantity, checked, unitPrice, warrantyMonths)
  win over the defaults.
*/
const toBlock = (data, { autoSelect, qty }) => ({
  categoryId: String(data.categoryId),
  categoryName: data.categoryName || "",
  unavailableOffers: data.unavailableOffers || [],
  products: (data.products || []).map((p) => ({
    productDefinitionId: String(p.productDefinitionId),
    name: p.name,
    unit: p.unit || "",
    gstRate: p.gstRate,
    quantity: p.quantity ?? qty,
    vendors: (p.vendors || []).map((v) => ({
      vendorId: String(v.vendorId),
      vendorName: v.vendorName,
      defaultWarrantyMonths: v.defaultWarrantyMonths ?? null,
      warrantyMonths: v.warrantyMonths ?? v.defaultWarrantyMonths ?? null,
      previousQuantity: v.previousQuantity ?? null,
      previousPrice: v.previousPrice ?? null,
      averageRating: v.averageRating ?? null,
      checked: v.checked ?? autoSelect,
      unitPrice: v.unitPrice ?? "",
    })),
  })),
});

const mapProducts = (blocks, fn) =>
  blocks.map((b) => ({ ...b, products: b.products.map((p) => fn(p, b)) }));
const mapVendors = (blocks, fn) =>
  mapProducts(blocks, (p, b) => ({ ...p, vendors: p.vendors.map((v) => fn(v, p, b)) }));

/* one card per product — quantity in the header, every vendor offering it below */
const ProductSection = ({
  product, quantityEditable, warrantyEditable, showErrors,
  onQtyChange, onToggle, onPriceChange, onWarrantyChange,
}) => {
  const qtyBad = !okQty(product.quantity);
  return (
    <div className="mb-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-100 bg-slate-50/60 px-5 py-3">
        <span className="text-sm font-bold text-slate-900">{product.name}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 tabular-nums">
          {product.vendors.length} vendor{product.vendors.length > 1 ? "s" : ""}
        </span>
        <label className="ml-auto flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
          Qty
          <input
            type="number" min="1" step="1" value={product.quantity} readOnly={!quantityEditable}
            onChange={(e) => onQtyChange(e.target.value)}
            className={`h-8 w-20 rounded-lg border px-2 text-sm font-normal tabular-nums shadow-sm transition focus:outline-none focus:ring-2 ${
              qtyBad
                ? "border-rose-300 bg-white text-slate-900 focus:ring-rose-100"
                : quantityEditable
                  ? "border-slate-200 bg-white text-slate-900 focus:ring-indigo-100"
                  : "border-transparent bg-slate-100 text-slate-500 focus:ring-indigo-100"
            }`}
          />
          <span className="font-normal normal-case text-slate-400">{unitLabel(product.unit)}</span>
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-full border-collapse">
          <thead className="bg-white">
            <tr className="border-b border-slate-100">
              <th className="w-10 px-3 py-2.5" />
              <th className={th}>Vendor</th>
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
            {product.vendors.map((v) => {
              const priceBad = showErrors && v.checked && !okPrice(v.unitPrice);
              const warrantyBad = v.checked && warrantyEditable && !isValidWarrantyMonths(v.warrantyMonths);
              const overridden = v.warrantyMonths !== v.defaultWarrantyMonths;
              return (
                <tr key={v.vendorId} className={`transition ${v.checked ? "bg-indigo-50/60" : "hover:bg-slate-50/60"}`}>
                  <td className="px-3 py-2.5 text-center">
                    <input
                      type="checkbox" checked={v.checked} onChange={() => onToggle(v.vendorId)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="px-3 py-2.5 text-sm font-medium text-slate-900">{v.vendorName}</td>
                  <td className="px-3 py-2.5 text-sm text-slate-700 tabular-nums">
                    {warrantyEditable ? (
                      <div className="flex flex-col gap-1">
                        <WarrantyInput
                          size="sm" months={v.warrantyMonths} invalid={warrantyBad}
                          onChange={(m) => onWarrantyChange(v.vendorId, m)}
                        />
                        {overridden && (
                          <span className="text-[11px] text-amber-600">
                            Vendor: {formatWarrantyShort(v.defaultWarrantyMonths)}
                          </span>
                        )}
                      </div>
                    ) : (
                      formatWarrantyShort(v.warrantyMonths)
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <input
                      type="number" min="0" value={v.unitPrice} placeholder="—"
                      onChange={(e) => onPriceChange(v.vendorId, e.target.value)}
                      className={`h-8 w-20 rounded-lg border bg-white px-2 text-sm tabular-nums text-slate-900 shadow-sm transition focus:outline-none focus:ring-2 ${
                        priceBad
                          ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
                          : "border-slate-200 focus:border-indigo-400 focus:ring-indigo-100"
                      }`}
                    />
                  </td>
                  <td className="px-3 py-2.5 text-sm text-slate-500 tabular-nums">
                    {dash(v.previousQuantity)}{v.previousQuantity != null ? ` ${unitLabel(product.unit)}` : ""}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-slate-500 tabular-nums">{dash(v.previousPrice)}</td>
                  <td className="px-3 py-2.5 text-sm text-slate-500">
                    {v.averageRating == null ? (
                      "—"
                    ) : (
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Star className="h-3.5 w-3.5 text-amber-500" /> {v.averageRating}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-slate-500 tabular-nums">{product.gstRate}%</td>
                  <td className="px-3 py-2.5 text-right text-sm font-bold text-slate-900 tabular-nums">
                    {v.checked ? previewTotal(product.quantity, v.unitPrice, product.gstRate).toLocaleString("en-IN") : 0}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

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
  const [showErrors, setShowErrors] = useState(false); // red fields only after a submit attempt

  const [categories, setCategories] = useState([]);   // leaf + hasProducts
  const [pickCatId, setPickCatId] = useState("");

  // global product-selection options
  const [quantityEditable, setQuantityEditable] = useState(false); // default Off: every product uses globalQty
  const [warrantyEditable, setWarrantyEditable] = useState(false); // default Off: every vendor's own warranty
  const [autoSelectAll, setAutoSelectAll] = useState(true);        // default On
  const [globalQty, setGlobalQty] = useState(1);

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

  /* ---- edit load: same blocks, rebuilt live, saved values laid over ---- */
  const loadForEdit = useCallback(async () => {
    if (!isEdit) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BACKEND_URL}/stock/quotations/${quotationId}/form`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to load quotation");
      const data = json.data;

      const quantities = data.categories.flatMap((c) => c.products.map((p) => p.quantity)).filter((q) => q != null);
      const qty = quantities[0] ?? 1;
      const loaded = data.categories.map((c) => toBlock(c, { autoSelect: false, qty }));
      const offers = loaded.flatMap((b) => b.products.flatMap((p) => p.vendors));

      setGlobalQty(qty);
      // Toggles open already when the saved quotation uses what they unlock.
      setQuantityEditable(new Set(quantities).size > 1);
      setWarrantyEditable(offers.some((v) => v.checked && v.warrantyMonths !== v.defaultWarrantyMonths));
      setAutoSelectAll(offers.length > 0 && offers.every((v) => v.checked));
      setBlocks(loaded);
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
      setBlocks((prev) => [...prev, toBlock(json.data, { autoSelect: autoSelectAll, qty: globalQty })]);
      setPickCatId("");
    } catch (err) { setError(err.message); }
  };

  const removeCategory = (categoryId) => setBlocks((prev) => prev.filter((b) => b.categoryId !== categoryId));

  const patchVendor = (categoryId, productId, vendorId, patch) =>
    setBlocks((prev) => mapVendors(prev, (v, p, b) =>
      b.categoryId === categoryId && p.productDefinitionId === productId && v.vendorId === vendorId ? { ...v, ...patch } : v
    ));

  const setProductQty = (categoryId, productId, quantity) =>
    setBlocks((prev) => mapProducts(prev, (p, b) =>
      b.categoryId === categoryId && p.productDefinitionId === productId ? { ...p, quantity } : p
    ));

  // Global quantity → every product
  const applyGlobalQty = (val) => {
    setGlobalQty(val);
    setBlocks((prev) => mapProducts(prev, (p) => ({ ...p, quantity: val })));
  };

  // Off means "every product uses the global quantity" — turning it off
  // puts them all back on it.
  const applyQuantityEditable = (on) => {
    setQuantityEditable(on);
    if (!on) setBlocks((prev) => mapProducts(prev, (p) => ({ ...p, quantity: globalQty })));
  };

  // Off means "every vendor's own warranty" — turning it off reverts any
  // override for this quotation back to the vendor default.
  const applyWarrantyEditable = (on) => {
    setWarrantyEditable(on);
    if (!on) setBlocks((prev) => mapVendors(prev, (v) => ({ ...v, warrantyMonths: v.defaultWarrantyMonths })));
  };

  const applyAutoSelect = (on) => {
    setAutoSelectAll(on);
    setBlocks((prev) => mapVendors(prev, (v) => ({ ...v, checked: on })));
  };

  /* ---- submit ---- */
  // Only what a person decided goes to the API; category, GST, default
  // warranty, history and totals are all resolved server-side.
  const buildPayload = () => ({
    notes,
    products: blocks.flatMap((b) => b.products)
      .map((p) => ({
        productDefinitionId: p.productDefinitionId,
        quantity: Number(p.quantity),
        offers: p.vendors.filter((v) => v.checked).map((v) => ({
          vendorId: v.vendorId,
          unitPrice: Number(v.unitPrice),
          // sent only as an override; absent = the vendor's own warranty
          ...(warrantyEditable && v.warrantyMonths !== v.defaultWarrantyMonths ? { warrantyMonths: v.warrantyMonths } : {}),
        })),
      }))
      .filter((p) => p.offers.length > 0),
  });

  const firstProblem = () => {
    const picked = blocks.flatMap((b) => b.products).filter((p) => p.vendors.some((v) => v.checked));
    if (picked.length === 0) return "Select at least one vendor before submitting";
    const badQty = picked.find((p) => !okQty(p.quantity));
    if (badQty) return `Enter a whole-number quantity for ${badQty.name}`;
    const badPrice = picked.find((p) => p.vendors.some((v) => v.checked && !okPrice(v.unitPrice)));
    if (badPrice) return `Enter a price for every selected vendor of ${badPrice.name}`;
    if (warrantyEditable) {
      const badW = picked.find((p) => p.vendors.some((v) => v.checked && !isValidWarrantyMonths(v.warrantyMonths)));
      if (badW) return `${badW.name}: ${WARRANTY_RANGE_MESSAGE}`;
    }
    return null;
  };

  const handleSubmit = async () => {
    const problem = firstProblem();
    if (problem) {
      setShowErrors(true);
      setError(problem);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setSaving(true); setError(null);
    try {
      const res = await fetch(`${API_BACKEND_URL}/stock/quotations${isEdit ? `/${quotationId}` : ""}`, {
        method: isEdit ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(buildPayload()),
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
                type="number" min="1" step="1" value={globalQty} onChange={(e) => applyGlobalQty(e.target.value)}
                className="h-9 w-20 rounded-lg border border-slate-200 bg-white px-2 text-sm tabular-nums text-slate-900 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <Toggle checked={quantityEditable} onChange={applyQuantityEditable} label="Allow per-product quantity editing" />
            <Toggle checked={warrantyEditable} onChange={applyWarrantyEditable} label="Allow warranty editing" />
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
          blocks.map((block) => (
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

              {block.unavailableOffers.length > 0 && (
                <div className="mb-3 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                  <span>
                    {block.unavailableOffers.length} saved offer{block.unavailableOffers.length > 1 ? "s are" : " is"} no
                    longer available and will be removed when you save:{" "}
                    {block.unavailableOffers.map((o) => `${o.productName} — ${o.vendorName}`).join(", ")}
                  </span>
                </div>
              )}

              {block.products.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-400">
                  No vendors you can quote supply products in this category.
                </p>
              ) : (
                block.products.map((product) => (
                  <ProductSection
                    key={product.productDefinitionId}
                    product={product}
                    quantityEditable={quantityEditable}
                    warrantyEditable={warrantyEditable}
                    showErrors={showErrors}
                    onQtyChange={(q) => setProductQty(block.categoryId, product.productDefinitionId, q)}
                    onToggle={(vid) => {
                      const v = product.vendors.find((x) => x.vendorId === vid);
                      patchVendor(block.categoryId, product.productDefinitionId, vid, { checked: !v.checked });
                    }}
                    onPriceChange={(vid, val) => patchVendor(block.categoryId, product.productDefinitionId, vid, { unitPrice: val })}
                    onWarrantyChange={(vid, m) => patchVendor(block.categoryId, product.productDefinitionId, vid, { warrantyMonths: m })}
                  />
                ))
              )}
            </div>
          ))
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
