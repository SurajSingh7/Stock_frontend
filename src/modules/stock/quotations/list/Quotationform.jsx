"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { API_BACKEND_URL } from "@/config/getEnvVariables";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const inputCls =
  "w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500";

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Client-side preview of the total. The backend recomputes authoritatively —
// this is only for immediate UX feedback (design lesson #6).
const previewTotal = (qty, price, gstRate) => {
  const base = (Number(qty) || 0) * (Number(price) || 0);
  const gst = (base * (Number(gstRate) || 0)) / 100;
  return round2(base + gst);
};

const dash = (v) => (v === null || v === undefined || v === "" ? "—" : v);

/* ------------------------------------------------------------------ */
/* Category picker — server-side ?type=LEAF search (Rule 23)           */
/* ------------------------------------------------------------------ */

const CategoryPicker = ({ onPick }) => {
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!search || selected) {
      setOptions([]);
      return;
    }
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({ type: "LEAF", search, limit: "10" });
        const res = await fetch(`${API_BACKEND_URL}/stock/categories/flat?${params.toString()}`, {
          credentials: "include",
        });
        const json = await res.json();
        if (json.success) setOptions(json.data || []);
      } catch {
        setOptions([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [search, selected]);

  return {
    selected,
    reset: () => {
      setSelected(null);
      setSearch("");
      setOptions([]);
    },
    node: (
      <div className="relative">
        <input
          className={inputCls}
          placeholder="Search POCO, Redmi…"
          value={selected ? selected.displayPath || selected.name : search}
          onChange={(e) => {
            setSelected(null);
            setSearch(e.target.value);
            onPick(null);
          }}
        />
        {search && !selected && (options.length > 0 || searching) && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-56 overflow-y-auto">
            {searching ? (
              <div className="px-3 py-2 text-sm text-gray-400">Searching…</div>
            ) : (
              options.map((cat) => (
                <button
                  key={cat._id}
                  type="button"
                  onClick={() => {
                    setSelected(cat);
                    onPick(cat);
                    setOptions([]);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                >
                  {cat.displayPath || cat.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    ),
  };
};

/* ------------------------------------------------------------------ */
/* Vendor section — one card per vendor, rows unchecked by default     */
/* ------------------------------------------------------------------ */

const VendorSection = ({ block, onToggle, onPriceChange, onQtyChange }) => (
  <div className="mb-3 overflow-hidden rounded-xl border border-gray-200 bg-white">
    <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2.5">
      <span className="text-sm font-medium text-gray-900">{block.vendorName}</span>
    </div>
    <table className="w-full text-xs" style={{ tableLayout: "fixed" }}>
      <thead className="text-gray-400">
        <tr>
          <th className="w-8 px-2 py-2" />
          <th className="px-2 py-2 text-left font-normal">Product</th>
          <th className="px-2 py-2 text-left font-normal">Qty</th>
          <th className="px-2 py-2 text-left font-normal">Price</th>
          <th className="px-2 py-2 text-left font-normal">Prev qty</th>
          <th className="px-2 py-2 text-left font-normal">Prev ₹</th>
          <th className="px-2 py-2 text-left font-normal">Rating</th>
          <th className="px-2 py-2 text-left font-normal">GST</th>
          <th className="px-2 py-2 text-right font-normal">Total</th>
        </tr>
      </thead>
      <tbody className="text-gray-800">
        {block.products.map((row) => (
          <tr
            key={row.productDefinitionId}
            className={`border-t border-gray-100 ${row.checked ? "bg-indigo-50" : ""}`}
          >
            <td className="px-2 py-2 text-center">
              <input
                type="checkbox"
                checked={row.checked}
                onChange={() => onToggle(block.vendorId, row.productDefinitionId)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
            </td>
            <td className="px-2 py-2 font-medium">{row.name}</td>
            <td className="px-2 py-2">
              <input
                type="number"
                value={row.quantity}
                onChange={(e) => onQtyChange(block.vendorId, row.productDefinitionId, e.target.value)}
                className="h-7 w-14 rounded border border-gray-200 px-1.5 text-xs"
              />
            </td>
            <td className="px-2 py-2">
              <input
                type="number"
                value={row.unitPrice}
                placeholder="—"
                onChange={(e) => onPriceChange(block.vendorId, row.productDefinitionId, e.target.value)}
                className="h-7 w-16 rounded border border-gray-200 px-1.5 text-xs"
              />
            </td>
            <td className="px-2 py-2 text-gray-500">{dash(row.previousQuantity)}</td>
            <td className="px-2 py-2 text-gray-500">{dash(row.previousPrice)}</td>
            <td className="px-2 py-2 text-gray-500">
              {row.averageRating === null || row.averageRating === undefined
                ? "—"
                : `★ ${row.averageRating}`}
            </td>
            <td className="px-2 py-2 text-gray-500">{row.gstRate}%</td>
            <td className="px-2 py-2 text-right font-medium">
              {row.checked ? previewTotal(row.quantity, row.unitPrice, row.gstRate).toLocaleString() : 0}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

/* ------------------------------------------------------------------ */
/* Main form                                                           */
/* ------------------------------------------------------------------ */

const QuotationForm = ({ quotationId = null }) => {
  const router = useRouter();
  const isEdit = Boolean(quotationId);

  // category-block list: each = { categoryId, categoryName, vendors: [ { vendorId, vendorName, products: [...] } ] }
  const [blocks, setBlocks] = useState([]);
  const [globalQty, setGlobalQty] = useState(10);
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const picker = CategoryPicker({ onPick: () => {} });

  /* ------------------------- load (edit) -------------------------- */

  const loadForEdit = useCallback(async () => {
    if (!isEdit) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BACKEND_URL}/stock/quotations/${quotationId}`, {
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to load quotation");

      // Reconstruct category → vendor → product blocks from the saved items,
      // pre-checking the ones that were part of the quotation.
      const data = json.data;
      const byCategory = new Map();
      (data.items || []).forEach((it) => {
        const catId = String(it.categoryId?._id || it.categoryId);
        if (!byCategory.has(catId)) {
          byCategory.set(catId, {
            categoryId: catId,
            categoryName: it.categoryName || it.categoryId?.name || "",
            vendors: new Map(),
          });
        }
        const cat = byCategory.get(catId);
        const venId = String(it.vendorId?._id || it.vendorId);
        if (!cat.vendors.has(venId)) {
          cat.vendors.set(venId, {
            vendorId: venId,
            vendorName: it.vendorName || it.vendorId?.name || "",
            products: [],
          });
        }
        cat.vendors.get(venId).products.push({
          productDefinitionId: String(it.productDefinitionId?._id || it.productDefinitionId),
          name: it.productName || it.productDefinitionId?.name || "",
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          gstRate: it.gstRate,
          previousQuantity: it.previousQuantity,
          previousPrice: it.previousPrice,
          averageRating: it.averageRating,
          checked: true,
        });
      });

      setBlocks(
        [...byCategory.values()].map((cat) => ({
          categoryId: cat.categoryId,
          categoryName: cat.categoryName,
          vendors: [...cat.vendors.values()],
        }))
      );
      setNotes(data.notes || "");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isEdit, quotationId]);

  useEffect(() => {
    loadForEdit();
  }, [loadForEdit]);

  /* --------------------------- add category ----------------------- */

  const addCategory = async () => {
    const cat = picker.selected;
    if (!cat) return;
    if (blocks.some((b) => b.categoryId === cat._id)) {
      picker.reset();
      return;
    }
    setError(null);
    try {
      const res = await fetch(
        `${API_BACKEND_URL}/stock/quotations/vendors-for-category/${cat._id}`,
        { credentials: "include" }
      );
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to load vendors");

      const vendors = (json.data || []).map((v) => ({
        vendorId: String(v.vendorId),
        vendorName: v.vendorName,
        products: (v.products || []).map((p) => ({
          productDefinitionId: String(p.productDefinitionId),
          name: p.name,
          gstRate: p.gstRate,
          quantity: globalQty, // global qty pre-fills every row
          unitPrice: "",
          previousQuantity: null,
          previousPrice: null,
          averageRating: null,
          checked: false, // all rows start unchecked
        })),
      }));

      setBlocks((prev) => [
        ...prev,
        { categoryId: cat._id, categoryName: cat.displayPath || cat.name, vendors },
      ]);
      picker.reset();
    } catch (err) {
      setError(err.message);
    }
  };

  const removeCategory = (categoryId) =>
    setBlocks((prev) => prev.filter((b) => b.categoryId !== categoryId));

  /* ------------------------- row mutations ------------------------ */

  const mutateRow = (vendorId, productId, patch) =>
    setBlocks((prev) =>
      prev.map((block) => ({
        ...block,
        vendors: block.vendors.map((v) =>
          v.vendorId !== vendorId
            ? v
            : {
                ...v,
                products: v.products.map((p) =>
                  p.productDefinitionId === productId ? { ...p, ...patch } : p
                ),
              }
        ),
      }))
    );

  const toggleRow = (vendorId, productId) =>
    setBlocks((prev) =>
      prev.map((block) => ({
        ...block,
        vendors: block.vendors.map((v) =>
          v.vendorId !== vendorId
            ? v
            : {
                ...v,
                products: v.products.map((p) =>
                  p.productDefinitionId === productId ? { ...p, checked: !p.checked } : p
                ),
              }
        ),
      }))
    );

  // global qty change fills every row's qty
  const applyGlobalQty = (val) => {
    const q = Number(val) || 0;
    setGlobalQty(val);
    setBlocks((prev) =>
      prev.map((block) => ({
        ...block,
        vendors: block.vendors.map((v) => ({
          ...v,
          products: v.products.map((p) => ({ ...p, quantity: q })),
        })),
      }))
    );
  };

  /* ---------------------------- submit ---------------------------- */

  const collectCheckedItems = () => {
    const items = [];
    blocks.forEach((block) => {
      block.vendors.forEach((v) => {
        v.products.forEach((p) => {
          if (p.checked) {
            items.push({
              productDefinitionId: p.productDefinitionId,
              vendorId: v.vendorId,
              categoryId: block.categoryId,
              categoryName: block.categoryName,
              quantity: Number(p.quantity) || 0,
              unitPrice: Number(p.unitPrice) || 0,
            });
          }
        });
      });
    });
    return items;
  };

  const handleSubmit = async () => {
    const items = collectCheckedItems();
    if (items.length === 0) {
      setError("Select at least one product before submitting");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const bad = items.find((it) => it.unitPrice <= 0);
    if (bad) {
      setError("Enter a price for every selected product");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BACKEND_URL}/stock/quotations${isEdit ? `/${quotationId}` : ""}`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ items, notes }),
        }
      );
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to save quotation");
      router.push("/stock/quotations/list");
    } catch (err) {
      setError(err.message);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  };

  /* ---------------------------- render ---------------------------- */

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-6 pb-10">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">
          {isEdit ? "Edit quotation" : "Add quotation"}
        </h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.push("/stock/quotations/list")}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Submit quotation"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="font-bold">
            ×
          </button>
        </div>
      )}

      {/* Category picker + global qty + Add */}
      <div className="mb-5 rounded-xl border border-gray-200 bg-white p-4">
        <p className="mb-2 text-xs text-gray-500">
          Pick a leaf category, set quantity, then add. Repeat for more categories.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-[2]">
            <label className="mb-1 block text-xs text-gray-600">Last category (leaf)</label>
            {picker.node}
          </div>
          <div className="min-w-[100px] flex-1">
            <label className="mb-1 block text-xs text-gray-600">Global qty</label>
            <input
              type="number"
              value={globalQty}
              onChange={(e) => applyGlobalQty(e.target.value)}
              className={inputCls}
            />
          </div>
          <button
            type="button"
            onClick={addCategory}
            disabled={!picker.selected}
            className="rounded-lg border border-indigo-200 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
          >
            + Add
          </button>
        </div>
      </div>

      {/* Category blocks */}
      {blocks.length === 0 ? (
        <p className="text-sm text-gray-400">No categories added yet. Add one above to begin.</p>
      ) : (
        blocks.map((block) => (
          <div key={block.categoryId} className="mb-6">
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                {block.categoryName}
                <span className="text-[10px]">LEAF</span>
              </span>
              <button
                type="button"
                onClick={() => removeCategory(block.categoryId)}
                className="text-xs font-medium text-red-500 hover:text-red-600"
              >
                Remove
              </button>
            </div>
            {block.vendors.length === 0 ? (
              <p className="text-xs text-gray-400">No vendors supply products in this category.</p>
            ) : (
              block.vendors.map((v) => (
                <VendorSection
                  key={v.vendorId}
                  block={v}
                  onToggle={toggleRow}
                  onPriceChange={(vendorId, productId, val) =>
                    mutateRow(vendorId, productId, { unitPrice: val })
                  }
                  onQtyChange={(vendorId, productId, val) =>
                    mutateRow(vendorId, productId, { quantity: val })
                  }
                />
              ))
            )}
          </div>
        ))
      )}

      {/* Notes */}
      {blocks.length > 0 && (
        <div className="mt-2">
          <label className="mb-1 block text-xs text-gray-600">Notes</label>
          <textarea
            className={`${inputCls} min-h-[70px]`}
            value={notes}
            maxLength={500}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes about this quotation"
          />
        </div>
      )}
    </div>
  );
};

export default QuotationForm;