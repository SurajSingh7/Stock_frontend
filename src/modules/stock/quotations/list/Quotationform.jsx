"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { fetchVendorsForCategory, createQuotation } from "@/modules/stock/quotations/quotationApi";
import { fetchLeafCategories } from "@/modules/stock/shared/lookupsApi";
import { ArrowLeft, Plus, Trash2, Star, Settings2, ChevronDown, Package, Layers, Info, AlertTriangle } from "lucide-react";
import { SearchableSelect, Modal, unitLabel } from "@/modules/stock/shared/StockSharedUI";
import WarrantyInput from "@/shared/warranty/WarrantyInput";
import { usePendingOrders, PendingOrdersBadge } from "@/modules/stock/quotations/PendingOrdersNotice";
import { formatWarrantyShort, isValidWarrantyMonths, WARRANTY_RANGE_MESSAGE } from "@/shared/warranty/warranty";

/* ============================================================= */
/* Constants                                                      */
/* ============================================================= */

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const inr = (n) => `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Tab shows the last part of the path ("WIRELESS ONT / Single Band" → "Single Band").
const tabLabel = (path = "") => path.split(/\s*[/›>]\s*/).filter(Boolean).pop() || path;

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";

const th = "px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-slate-500";
const thRight = `${th} text-right`;

const okQty = (q) => Number.isInteger(Number(q)) && Number(q) >= 1 && q !== "";
const okPrice = (p) => p !== "" && Number.isFinite(Number(p)) && Number(p) > 0;

/* checkbox-style option row for the ⚙ Options menu */
const OptionRow = ({ checked, onChange, label, hint }) => (
  <button
    type="button" onClick={() => onChange(!checked)}
    className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-slate-50"
  >
    <span className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${checked ? "bg-indigo-600" : "bg-slate-300"}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
    </span>
    <span>
      <span className="block text-sm font-medium text-slate-800">{label}</span>
      <span className="block text-xs text-slate-500">{hint}</span>
    </span>
  </button>
);

const OptionsMenu = ({ children, activeCount }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button" onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium shadow-sm transition ${
          open ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        <Settings2 className="h-4 w-4" /> Options
        {activeCount > 0 && (
          <span className="rounded-full bg-indigo-600 px-1.5 text-xs font-semibold text-white tabular-nums">{activeCount}</span>
        )}
        <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
          {children}
        </div>
      )}
    </div>
  );
};

/*
  The API already sends the form's shape — Category -> Products -> Vendors,
  with previous qty/price, rating and the vendor's default warranty resolved
  server-side (GET /quotations/vendors-for-category/:catId). This only adds
  the editable UI state: product quantity, and per vendor checked /
  unitPrice / warrantyMonths.
*/
const toBlock = (data, { autoSelect, qty }) => ({
  categoryId: String(data.categoryId),
  categoryName: data.categoryName || "",
  products: (data.products || []).map((p) => ({
    productDefinitionId: String(p.productDefinitionId),
    name: p.name,
    unit: p.unit || "",
    gstRate: p.gstRate,
    quantity: qty,
    vendors: (p.vendors || []).map((v) => ({
      vendorId: String(v.vendorId),
      vendorName: v.vendorName,
      defaultWarrantyMonths: v.defaultWarrantyMonths ?? null,
      warrantyMonths: v.defaultWarrantyMonths ?? null,
      previousQuantity: v.previousQuantity ?? null,
      previousPrice: v.previousPrice ?? null,
      previousPurchaseDate: v.previousPurchaseDate ?? null,
      averageRating: v.averageRating ?? null,
      checked: autoSelect,
      unitPrice: "",
    })),
  })),
});

const mapProducts = (blocks, fn) =>
  blocks.map((b) => ({ ...b, products: b.products.map((p) => fn(p, b)) }));

const mapVendors = (blocks, fn) =>
  mapProducts(blocks, (p, b) => ({ ...p, vendors: p.vendors.map((v) => fn(v, p, b)) }));

/*
  ⓘ popup — the vendor's last purchase of this product, worked out at the
  product's current GST rate (the rate paid then is not stored), plus how
  today's price compares once one is entered.
*/
const LastPurchaseModal = ({ product, vendor, onClose }) => {
  const unit = unitLabel(product.unit);
  const hasPrev = vendor.previousPrice != null;
  const prevQty = Number(vendor.previousQuantity) || 0;
  const prevBase = round2(prevQty * Number(vendor.previousPrice || 0));
  const prevGst = round2((prevBase * (Number(product.gstRate) || 0)) / 100);
  const diff = okPrice(vendor.unitPrice) && hasPrev ? round2(Number(vendor.unitPrice) - Number(vendor.previousPrice)) : null;
  const row = "flex items-center justify-between py-2 text-sm";
  return (
    <Modal onClose={onClose} title={`Last purchase · ${vendor.vendorName}`} maxWidth="max-w-sm">
      <p className="mb-2 text-sm font-medium text-slate-500">{product.name}</p>
      {!hasPrev ? (
        <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          No previous purchase from this vendor.
        </p>
      ) : (
        <>
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 px-4">
            <div className={row}><span className="text-slate-500">Purchased on</span><span className="font-medium text-slate-900">{fmtDate(vendor.previousPurchaseDate)}</span></div>
            <div className={row}><span className="text-slate-500">Quantity</span><span className="font-medium text-slate-900 tabular-nums">{vendor.previousQuantity ?? "—"} {unit}</span></div>
            <div className={row}><span className="text-slate-500">Unit price</span><span className="font-medium text-slate-900 tabular-nums">{inr(vendor.previousPrice)}</span></div>
            <div className={row}><span className="text-slate-500">GST ({product.gstRate}%)</span><span className="font-medium text-slate-900 tabular-nums">{inr(prevGst)}</span></div>
            <div className={row}><span className="font-semibold text-slate-700">Total</span><span className="font-semibold text-slate-900 tabular-nums">{inr(round2(prevBase + prevGst))}</span></div>
          </div>
          {diff != null && (
            <p className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium ${
              diff < 0 ? "bg-emerald-50 text-emerald-700" : diff > 0 ? "bg-rose-50 text-rose-700" : "bg-slate-50 text-slate-600"
            }`}>
              Now {inr(vendor.unitPrice)} —{" "}
              {diff === 0 ? "same as last time" : `${inr(Math.abs(diff))} ${diff < 0 ? "less ↓" : "more ↑"} per unit`}
            </p>
          )}
          <p className="mt-2 text-[11px] text-slate-400">GST is worked out at the product’s current rate.</p>
        </>
      )}
    </Modal>
  );
};

/*
  One product inside its category card, every vendor offering it below.
  Quantity is per PRODUCT, so each row shows the same read-only value; it is
  edited in the product header, and only while "Different quantity per
  product" is on. GST and total are a preview — the server works out the
  stored figures.
*/
const ProductSection = ({
  product, quantityEditable, warrantyEditable, showErrors,
  onQtyChange, onToggle, onPriceChange, onWarrantyChange,
}) => {
  const [infoVendor, setInfoVendor] = useState(null);
  const qtyBad = !okQty(product.quantity);
  const unit = unitLabel(product.unit);
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-slate-50 px-4 py-2.5">
        <Package className="h-4 w-4 text-slate-400" />
        <span className="text-sm font-semibold text-slate-900">{product.name}</span>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200 tabular-nums">
          {product.vendors.length} vendor{product.vendors.length > 1 ? "s" : ""}
        </span>
        {quantityEditable && (
          <label className="ml-auto flex items-center gap-1.5 text-sm text-slate-600">
            Qty
            <input
              type="number" min="1" step="1" value={product.quantity}
              onChange={(e) => onQtyChange(e.target.value)}
              className={`h-8 w-20 rounded-lg border bg-white px-2 text-sm tabular-nums text-slate-900 shadow-sm transition focus:outline-none focus:ring-2 ${
                qtyBad ? "border-rose-300 focus:ring-rose-100" : "border-slate-200 focus:ring-indigo-100"
              }`}
            />
            <span className="text-xs text-slate-400">{unit}</span>
          </label>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="w-10 px-3 py-2.5" title="Include this vendor in the quotation" />
              <th className={th}>Vendor</th>
              <th className={th}>Warranty</th>
              <th className={th}>Qty</th>
              <th className={th}>Unit price (₹)</th>
              <th className={th}>GST</th>
              <th className={thRight}>GST amt</th>
              <th className={thRight}>Total</th>
              <th className={th}>Rating</th>
              <th className="w-10 px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {product.vendors.map((v) => {
              const priceBad = showErrors && v.checked && !okPrice(v.unitPrice);
              const warrantyBad = v.checked && warrantyEditable && !isValidWarrantyMonths(v.warrantyMonths);
              const overridden = v.warrantyMonths !== v.defaultWarrantyMonths;
              const priced = v.checked && okPrice(v.unitPrice);
              const base = round2((Number(product.quantity) || 0) * (Number(v.unitPrice) || 0));
              const gstAmt = round2((base * (Number(product.gstRate) || 0)) / 100);
              const hasPrev = v.previousPrice != null;
              return (
                <tr key={v.vendorId} className={`transition ${v.checked ? "bg-white" : "bg-slate-50/60"}`}>
                  <td className="px-3 py-3 text-center">
                    <input
                      type="checkbox" checked={v.checked} onChange={() => onToggle(v.vendorId)}
                      title="Include this vendor"
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>
                  <td className={`px-3 py-3 text-sm font-medium text-slate-900 ${v.checked ? "" : "opacity-50"}`}>{v.vendorName}</td>
                  <td className={`px-3 py-3 text-sm text-slate-700 tabular-nums ${v.checked ? "" : "opacity-50"}`}>
                    {warrantyEditable && v.checked ? (
                      <div className="flex flex-col gap-1">
                        <WarrantyInput
                          size="sm" months={v.warrantyMonths} invalid={warrantyBad}
                          onChange={(m) => onWarrantyChange(v.vendorId, m)}
                        />
                        {overridden && (
                          <span className="text-[11px] text-amber-600">Vendor default: {formatWarrantyShort(v.defaultWarrantyMonths)}</span>
                        )}
                      </div>
                    ) : (
                      formatWarrantyShort(v.warrantyMonths)
                    )}
                  </td>
                  <td className={`whitespace-nowrap px-3 py-3 text-sm tabular-nums ${qtyBad ? "text-rose-600" : "text-slate-700"} ${v.checked ? "" : "opacity-50"}`}>
                    {product.quantity || "—"} <span className="text-xs text-slate-400">{unit}</span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="relative w-28">
                      <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-slate-400">₹</span>
                      <input
                        type="number" min="0" value={v.unitPrice} placeholder="Price"
                        disabled={!v.checked}
                        onChange={(e) => onPriceChange(v.vendorId, e.target.value)}
                        className={`h-9 w-full rounded-lg border bg-white pl-6 pr-2 text-sm tabular-nums text-slate-900 shadow-sm transition placeholder:text-slate-300 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100 ${
                          priceBad
                            ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
                            : "border-slate-200 focus:border-indigo-400 focus:ring-indigo-100"
                        }`}
                      />
                    </div>
                  </td>
                  <td className={`px-3 py-3 text-sm text-slate-500 tabular-nums ${v.checked ? "" : "opacity-50"}`}>{product.gstRate}%</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right text-sm tabular-nums">
                    {priced ? <span className="text-slate-700">{inr(gstAmt)}</span> : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right text-sm tabular-nums">
                    {priced ? <span className="font-semibold text-slate-900">{inr(round2(base + gstAmt))}</span> : <span className="text-slate-300">—</span>}
                  </td>
                  <td className={`px-3 py-3 text-sm text-slate-500 ${v.checked ? "" : "opacity-50"}`}>
                    {v.averageRating == null ? (
                      <span className="text-xs font-medium text-slate-400" title="Not rated yet">N/A</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 tabular-nums text-amber-600">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" /> {v.averageRating}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <button
                      type="button" onClick={() => setInfoVendor(v)}
                      title={hasPrev ? "Last purchase" : "No previous purchase"} aria-label="Last purchase"
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ring-1 ring-inset transition ${
                        hasPrev
                          ? "bg-indigo-50 text-indigo-600 ring-indigo-100 hover:bg-indigo-100 hover:text-indigo-700"
                          : "bg-slate-50 text-slate-300 ring-slate-200 hover:text-slate-400"
                      }`}
                    >
                      <Info className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {infoVendor && (
        <LastPurchaseModal
          product={product}
          // read the live row, so "vs now" follows the price being typed
          vendor={product.vendors.find((x) => x.vendorId === infoVendor.vendorId) || infoVendor}
          onClose={() => setInfoVendor(null)}
        />
      )}
    </div>
  );
};

/* ============================================================= */
/* Main                                                           */
/* ============================================================= */

// Create only — a quotation is never edited. A mistake is rejected at review
// and entered again as a new quotation.
const QuotationForm = () => {
  const router = useRouter();

  const [blocks, setBlocks] = useState([]);
  // Stock already on its way for the categories picked — warned, never blocked.
  const pendingByCat = usePendingOrders(blocks.map((b) => b.categoryId));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false); // red fields only after a submit attempt
  const [adding, setAdding] = useState(false);
  const [activeCatId, setActiveCatId] = useState(null); // the category tab being priced

  const [categories, setCategories] = useState([]);   // leaf + hasProducts
  const [pickCatId, setPickCatId] = useState("");

  // global options
  const [quantityEditable, setQuantityEditable] = useState(false); // Off: every product uses globalQty
  const [warrantyEditable, setWarrantyEditable] = useState(false); // Off: every vendor's own warranty
  const [autoSelectAll, setAutoSelectAll] = useState(true);        // On: new vendors come ticked
  const [globalQty, setGlobalQty] = useState(1);

  useEffect(() => {
    (async () => {
      try { setCategories(await fetchLeafCategories()); } catch { /* picker stays empty */ }
    })();
  }, []);

  // Categories already added are left out of the picker.
  const categoryOptions = categories
    .filter((c) => !blocks.some((b) => b.categoryId === c._id))
    .map((c) => ({ value: c._id, label: c.displayPath || c.name }));

  /* ---- add / remove category ---- */
  const addCategory = async () => {
    const cat = categories.find((c) => c._id === pickCatId);
    if (!cat) return;
    if (blocks.some((b) => b.categoryId === cat._id)) { setPickCatId(""); return; }
    setAdding(true);
    try {
      const data = await fetchVendorsForCategory(cat._id);
      // A new category becomes the first tab, opened straight away for pricing.
      setBlocks((prev) => [toBlock(data, { autoSelect: autoSelectAll, qty: globalQty }), ...prev]);
      setActiveCatId(String(data.categoryId));
      setPickCatId("");
    } catch (err) {
      toast.error(err.message || "Failed to load vendors");
    } finally { setAdding(false); }
  };

  // Removing the open tab opens its neighbour.
  const removeCategory = (categoryId) => {
    const idx = blocks.findIndex((b) => b.categoryId === categoryId);
    const rest = blocks.filter((b) => b.categoryId !== categoryId);
    setBlocks(rest);
    if (activeCatId === categoryId) setActiveCatId(rest[Math.min(idx, rest.length - 1)]?.categoryId ?? null);
  };

  const patchVendor = (categoryId, productId, vendorId, patch) =>
    setBlocks((prev) => mapVendors(prev, (v, p, b) =>
      b.categoryId === categoryId && p.productDefinitionId === productId && v.vendorId === vendorId
        ? { ...v, ...(typeof patch === "function" ? patch(v) : patch) }
        : v
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

  /* ---- progress (bottom bar) ---- */
  const allProducts = blocks.flatMap((b) => b.products);
  const pickedOffers = allProducts.flatMap((p) => p.vendors.filter((v) => v.checked));
  const pricedOffers = pickedOffers.filter((v) => okPrice(v.unitPrice)).length;

  /* ---- submit ---- */
  // Only what a person decided goes to the API; category, GST, default
  // warranty, history and totals are all resolved server-side.
  const buildPayload = () => ({
    notes,
    products: allProducts
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

  // The first thing stopping a submit, and the category tab it is in.
  const firstProblem = () => {
    const picked = blocks.flatMap((b) =>
      b.products.filter((p) => p.vendors.some((v) => v.checked)).map((p) => ({ p, categoryId: b.categoryId }))
    );
    if (picked.length === 0) return { message: "Select at least one vendor before submitting" };
    const badQty = picked.find(({ p }) => !okQty(p.quantity));
    if (badQty) return { message: `Enter a whole-number quantity for ${badQty.p.name}`, categoryId: badQty.categoryId };
    const badPrice = picked.find(({ p }) => p.vendors.some((v) => v.checked && !okPrice(v.unitPrice)));
    if (badPrice) return { message: `Enter a price for every selected vendor of ${badPrice.p.name}`, categoryId: badPrice.categoryId };
    if (warrantyEditable) {
      const badW = picked.find(({ p }) => p.vendors.some((v) => v.checked && !isValidWarrantyMonths(v.warrantyMonths)));
      if (badW) return { message: `${badW.p.name}: ${WARRANTY_RANGE_MESSAGE}`, categoryId: badW.categoryId };
    }
    return null;
  };

  const handleSubmit = async () => {
    const problem = firstProblem();
    if (problem) {
      setShowErrors(true);
      if (problem.categoryId) setActiveCatId(problem.categoryId);
      toast.error(problem.message);
      return;
    }
    setSaving(true);
    try {
      await createQuotation(buildPayload());
      toast.success("Quotation submitted");
      router.push("/stock/purchase/quotations");
    } catch (err) {
      toast.error(err.message || "Failed to save quotation");
    } finally { setSaving(false); }
  };

  const goBack = () => router.push("/stock/purchase/quotations");
  const optionsOn = [quantityEditable, warrantyEditable, !autoSelectAll].filter(Boolean).length;
  const block = blocks.find((b) => b.categoryId === activeCatId) || blocks[0];

  return (
    <div className="min-h-screen bg-slate-50/60">
      <div className="mx-auto max-w-7xl p-6 pb-4">
        {/* header */}
        <div className="mb-5 flex flex-wrap items-center gap-4">
          <button
            type="button" onClick={goBack}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">Add quotation</h1>
            <p className="text-sm text-slate-500">Pick categories, then enter each vendor’s price.</p>
          </div>
        </div>

        {/* setup — category picker, common quantity and options in one card */}
        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1">
              <SearchableSelect
                value={pickCatId} onChange={setPickCatId} options={categoryOptions} placeholder="Select a category to add…"
              />
            </div>
            <button
              type="button" onClick={addCategory} disabled={!pickCatId || adding}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> {adding ? "Adding…" : "Add category"}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              Quantity for all products
              <input
                type="number" min="1" step="1" value={globalQty} onChange={(e) => applyGlobalQty(e.target.value)}
                disabled={quantityEditable}
                title={quantityEditable ? "Set on each product while “Different quantity per product” is on" : undefined}
                className="h-9 w-20 rounded-lg border border-slate-200 bg-white px-2 text-sm tabular-nums text-slate-900 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              />
            </label>
            <div className="ml-auto">
              <OptionsMenu activeCount={optionsOn}>
                <OptionRow
                  checked={quantityEditable} onChange={applyQuantityEditable}
                  label="Different quantity per product" hint="Set the quantity on each product instead of one for all."
                />
                <OptionRow
                  checked={warrantyEditable} onChange={applyWarrantyEditable}
                  label="Change vendor warranty" hint="Override the vendor’s default warranty for this quotation."
                />
                <OptionRow
                  checked={autoSelectAll} onChange={applyAutoSelect}
                  label="Tick all vendors automatically" hint="Every vendor starts included; untick the ones to leave out."
                />
              </OptionsMenu>
            </div>
          </div>
        </div>

        {/* category cards */}
        {blocks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-16 text-center">
            <Layers className="mx-auto h-9 w-9 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-700">Add a category to start pricing</p>
            <p className="mt-1 text-sm text-slate-400">Its products and the vendors who supply them will appear here.</p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              {/* One tab per category, with how many of its prices are in.
                  Newest first; removing is the 🗑 inside the open tab. */}
              <div className="border-b border-slate-100 p-3">
                <div className="flex gap-1.5 overflow-x-auto rounded-xl bg-slate-100/80 p-1.5 pb-2.5">
                  {blocks.map((b) => {
                    const offers = b.products.flatMap((p) => p.vendors.filter((v) => v.checked));
                    const priced = offers.filter((v) => okPrice(v.unitPrice)).length;
                    const done = offers.length > 0 && priced === offers.length;
                    const pct = offers.length ? Math.round((priced / offers.length) * 100) : 0;
                    const active = b.categoryId === block.categoryId;
                    const hasPending = !!pendingByCat[String(b.categoryId)]?.lines?.length;
                    return (
                      <button
                        key={b.categoryId} type="button" onClick={() => setActiveCatId(b.categoryId)} title={b.categoryName}
                        className={`relative flex min-w-37.5 shrink-0 flex-col gap-1.5 rounded-lg px-3.5 pb-2.5 pt-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 ${
                          active
                            ? "bg-slate-700 text-white shadow-md shadow-slate-300"
                            : "bg-white/60 text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-white hover:text-slate-900"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Layers className={`h-3.5 w-3.5 shrink-0 ${active ? "text-slate-300" : "text-slate-400"}`} />
                          <span className="max-w-45 truncate text-sm font-semibold">
                            {tabLabel(b.categoryName)}
                          </span>
                          {hasPending && <AlertTriangle className={`h-3.5 w-3.5 shrink-0 animate-blink ${active ? "text-rose-300" : "text-rose-500"}`} />}
                          <span className={`ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                            active ? "bg-white/15 text-white"
                              : done ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
                              : priced > 0 ? "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200"
                              : "bg-white text-slate-500 ring-1 ring-inset ring-slate-200"
                          }`}>
                            {done ? "✓ " : ""}{priced}/{offers.length}
                          </span>
                        </span>
                        {/* pointer under the open tab, aimed at its content below */}
                        {active && (
                          <span className="absolute -bottom-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 rounded-[2px] bg-slate-700" />
                        )}
                        {/* how much of this category is priced */}
                        <span className={`h-1 w-full overflow-hidden rounded-full ${active ? "bg-white/25" : "bg-slate-200/70"}`}>
                          <span
                            className={`block h-full rounded-full transition-all ${
                              done ? (active ? "bg-emerald-400" : "bg-emerald-500") : active ? "bg-white" : "bg-indigo-500"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {(() => {
                const vendorCount = new Set(block.products.flatMap((p) => p.vendors.map((v) => v.vendorId))).size;
                return (
                  <>
                      <div className="flex flex-wrap items-center gap-3 border-y border-slate-200 bg-slate-100/80 px-5 py-3.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-emerald-600 shadow-sm ring-1 ring-inset ring-emerald-100">
                          <Layers className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900" title={block.categoryName}>{block.categoryName}</p>
                          <p className="text-xs text-slate-500">
                            {block.products.length} product{block.products.length === 1 ? "" : "s"} · {vendorCount} vendor{vendorCount === 1 ? "" : "s"}
                          </p>
                        </div>
                        <PendingOrdersBadge group={pendingByCat[String(block.categoryId)]} categoryName={block.categoryName} />
                        <button
                          type="button" onClick={() => removeCategory(block.categoryId)}
                          title="Remove category" aria-label="Remove category"
                          className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600 ring-1 ring-inset ring-rose-100 transition hover:bg-rose-100 hover:text-rose-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="space-y-4 rounded-b-2xl bg-slate-50 p-4">
                        {block.products.length === 0 ? (
                          <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
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
                              onToggle={(vid) => patchVendor(block.categoryId, product.productDefinitionId, vid, (v) => ({ checked: !v.checked }))}
                              onPriceChange={(vid, val) => patchVendor(block.categoryId, product.productDefinitionId, vid, { unitPrice: val })}
                              onWarrantyChange={(vid, m) => patchVendor(block.categoryId, product.productDefinitionId, vid, { warrantyMonths: m })}
                            />
                          ))
                        )}
                      </div>
                  </>
                );
              })()}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Notes <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <textarea
                rows={3} className={inputCls} value={notes} maxLength={500}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything the approver should know about this quotation"
              />
              <p className="mt-1.5 text-right text-xs text-slate-400 tabular-nums">{notes.length}/500</p>
            </div>
          </div>
        )}
      </div>

      {/* sticky action bar — progress on the left, Cancel / Submit on the right */}
      <div className="sticky bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-6 py-3">
          <p className="text-sm text-slate-600">
            {blocks.length === 0 ? (
              "No categories added yet"
            ) : (
              <>
                {blocks.length} categor{blocks.length === 1 ? "y" : "ies"} · {allProducts.length} product{allProducts.length === 1 ? "" : "s"} ·{" "}
                <span className={pricedOffers === pickedOffers.length && pickedOffers.length > 0 ? "font-semibold text-emerald-600" : "font-semibold text-amber-600"}>
                  {pricedOffers} of {pickedOffers.length} prices entered
                </span>
              </>
            )}
          </p>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button" onClick={goBack} disabled={saving}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button" onClick={handleSubmit} disabled={saving || blocks.length === 0}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Submitting…" : "Submit quotation"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuotationForm;
