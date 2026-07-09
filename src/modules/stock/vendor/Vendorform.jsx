"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  ShieldCheck,
  Loader2,
  ChevronUp,
  ChevronDown,
  Search,
  X,
  Lock,
  MoreVertical,
  MapPin,
  User,
  FileText,
  Landmark,
} from "lucide-react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import { PAYMENT_TERMS, STATE_OPTIONS, mockVerifyGST } from "./vendorConstants";

/* ------------------------------------------------------------------ */
/* Generic small pieces                                                */
/* ------------------------------------------------------------------ */

const inputCls =
  "w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500";

const Field = ({ label, required, children, hint }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-medium text-gray-600">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
    {hint && <p className="text-xs text-gray-400">{hint}</p>}
  </div>
);

// Numbered, collapsible card — matches the "1 / 2 / 3..." step badges in the
// reference screenshots. `action` renders a button/element in the header row
// (e.g. "+ Add More Contact").
const CollapsibleCard = ({ index, title, subtitle, action, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white text-sm font-semibold shrink-0">
            {index}
          </span>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {action}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="text-gray-400 hover:text-gray-600"
          >
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>
      {open && <div className="px-6 pb-6 border-t border-gray-100 pt-5">{children}</div>}
    </div>
  );
};

// State dropdown — shared shape everywhere (Vendor address + Bank details).
// Reads from STATE_OPTIONS (vendorConstants.js). Auto-shows the readonly
// state code once a state is picked.
const StateSelect = ({ value, onChange }) => (
  <select
    value={value?.key || ""}
    onChange={(e) => {
      const opt = STATE_OPTIONS.find((s) => s.key === e.target.value);
      onChange(opt ? { key: opt.key, name: opt.name, code: opt.code } : { key: "", name: "", code: "" });
    }}
    className={inputCls}
  >
    <option value="">Select state</option>
    {STATE_OPTIONS.map((s) => (
      <option key={s.key} value={s.key}>
        {s.label}
      </option>
    ))}
  </select>
);

const StateCodeReadOnly = ({ code }) => (
  <input value={code || ""} readOnly placeholder="—" className={`${inputCls} bg-gray-50 text-gray-400`} />
);

const PrimaryTag = () => (
  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
    Primary <Lock className="w-3 h-3" />
  </span>
);

const emptyContact = (label) => ({
  label,
  name: "",
  email: "",
  phone: "",
  designation: "",
  department: "",
});

const emptyBankAccount = (label) => ({
  label,
  ifsc: "",
  bankName: "",
  branch: "",
  branchAddress: "",
  state: { key: "", name: "", code: "" },
  city: "",
  accountNumber: "",
  rtgsCode: "",
  neftCode: "",
});

const defaultVendor = () => ({
  name: "",
  vendorCode: "",
  vendorAlias: "",
  gst: {
    isAvailable: true,
    gstNumber: "",
    isVerified: false,
    verifiedAt: null,
    legalName: "",
    tradeName: "",
    gstAddress: "",
    state: { key: "", name: "", code: "" },
  },
  panNumber: "",
  paymentTerms: "",
  notes: "",
  contacts: [emptyContact("PRIMARY")],
  address: { fullAddress: "", area: "", city: "", pinCode: "", state: { key: "", name: "", code: "" } },
  assignedProducts: [],
  bankAccounts: [emptyBankAccount("PRIMARY")],
});

/* ------------------------------------------------------------------ */
/* Card 1 — Basic Details                                              */
/* ------------------------------------------------------------------ */

const BasicDetailsCard = ({ vendor, setVendor }) => {
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState(null);

  const setGst = (patch) => setVendor((v) => ({ ...v, gst: { ...v.gst, ...patch } }));
  const setState = (state) => setGst({ state });

  /*
   FUTURE GST API INTEGRATION — see vendorConstants.js mockVerifyGST() for the
   exact expected response shape and swap instructions. Only that function
   needs to change; this handler stays as-is.
  */
  const handleVerifyGST = async () => {
    setVerifying(true);
    setVerifyError(null);
    try {
      const result = await mockVerifyGST(vendor.gst.gstNumber);
      const matchedState = STATE_OPTIONS.find(
        (s) => s.code === result.stateCode || s.name === result.state
      );
      setGst({
        isVerified: true,
        verifiedAt: new Date().toISOString(),
        legalName: result.legalName,
        tradeName: result.tradeName,
        gstAddress: result.address,
        state: matchedState
          ? { key: matchedState.key, name: matchedState.name, code: matchedState.code }
          : vendor.gst.state,
      });
      setVendor((v) => ({
        ...v,
        name: v.name || result.legalName,
        panNumber: result.panNumber?.toUpperCase() || v.panNumber,
      }));
    } catch (err) {
      setVerifyError(err.message);
    } finally {
      setVerifying(false);
    }
  };

  const lastVerifiedLabel = vendor.gst.verifiedAt
    ? new Date(vendor.gst.verifiedAt).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <CollapsibleCard index={1} title="Vendor Basic Details" subtitle="Enter primary information about the vendor">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field label="Company / Vendor Name" required>
          <input
            className={inputCls}
            value={vendor.name}
            onChange={(e) => setVendor((v) => ({ ...v, name: e.target.value }))}
            placeholder="e.g. Acme Distributors"
          />
        </Field>

        <Field label="Is GST Available?" required>
          <div className="inline-flex rounded-lg border border-gray-200 p-1 w-fit gap-1">
            <button
              type="button"
              onClick={() => setGst({ isAvailable: true })}
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                vendor.gst.isAvailable
                  ? "bg-indigo-600 text-white"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              ✓ Yes
            </button>
            <button
              type="button"
              onClick={() => setGst({ isAvailable: false })}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                !vendor.gst.isAvailable
                  ? "bg-gray-200 text-gray-700"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              No
            </button>
          </div>
        </Field>

        {vendor.gst.isAvailable && (
          <>
            <Field label="GST Number" required hint="Click verify to auto-fill company details from GST database (future)">
              <div className="flex gap-2">
                <input
                  className={inputCls}
                  value={vendor.gst.gstNumber}
                  onChange={(e) => setGst({ gstNumber: e.target.value.toUpperCase(), isVerified: false })}
                  placeholder="29ABCDE1234F1Z5"
                  maxLength={15}
                />
                <button
                  type="button"
                  onClick={handleVerifyGST}
                  disabled={verifying || !vendor.gst.gstNumber}
                  className="shrink-0 px-3 py-2 text-sm font-medium rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  Verify GST
                </button>
              </div>
              {verifyError && <p className="text-xs text-red-500 mt-1">{verifyError}</p>}
            </Field>

            <Field label="GST Status">
              <div
                className={`rounded-lg px-4 py-2.5 text-sm ${
                  vendor.gst.isVerified ? "bg-emerald-50" : "bg-amber-50"
                }`}
              >
                {vendor.gst.isVerified ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-100 px-2.5 py-1 rounded-full">
                    <ShieldCheck className="w-3.5 h-3.5" /> VERIFIED
                  </span>
                ) : (
                  <span className="inline-flex items-center text-xs font-medium text-amber-600 bg-amber-100 px-2.5 py-1 rounded-full">
                    NOT VERIFIED
                  </span>
                )}
                {lastVerifiedLabel && (
                  <p className="text-xs text-gray-500 mt-1.5">Last Verified: {lastVerifiedLabel}</p>
                )}
              </div>
            </Field>
          </>
        )}

        <Field label="PAN Number">
          <input
            className={inputCls}
            value={vendor.panNumber}
            onChange={(e) => setVendor((v) => ({ ...v, panNumber: e.target.value.toUpperCase() }))}
            placeholder="ABCDE1234F"
            maxLength={10}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="State" required>
            <StateSelect value={vendor.gst.state} onChange={setState} />
          </Field>
          <Field label="State Code">
            <StateCodeReadOnly code={vendor.gst.state?.code} />
          </Field>
        </div>

        <Field label="Vendor Alias">
          <input
            className={inputCls}
            value={vendor.vendorAlias}
            onChange={(e) => setVendor((v) => ({ ...v, vendorAlias: e.target.value }))}
            placeholder="Enter alias (optional)"
          />
        </Field>

        <Field label="Payment Terms" required>
          <select
            className={inputCls}
            value={vendor.paymentTerms}
            onChange={(e) => setVendor((v) => ({ ...v, paymentTerms: e.target.value }))}
          >
            <option value="">Select payment term</option>
            {PAYMENT_TERMS.map((pt) => (
              <option key={pt.value} value={pt.value}>
                {pt.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Notes">
          <textarea
            className={`${inputCls} min-h-[70px]`}
            value={vendor.notes}
            maxLength={500}
            onChange={(e) => setVendor((v) => ({ ...v, notes: e.target.value }))}
            placeholder="Enter notes about this vendor (optional)"
          />
          <p className="text-xs text-gray-400 text-right">{vendor.notes.length} / 500</p>
        </Field>
      </div>

      {vendor.gst.isVerified && (
        <div className="mt-5 rounded-lg bg-indigo-50 px-5 py-4">
          <p className="text-xs font-semibold text-indigo-600 mb-3">AUTO FILL (After GST Verify)</p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="flex items-start gap-2">
              <User className="w-4 h-4 text-indigo-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-400">Legal Name</p>
                <p className="text-sm text-gray-800">{vendor.gst.legalName || "—"}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <FileText className="w-4 h-4 text-indigo-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-400">Trade Name</p>
                <p className="text-sm text-gray-800">{vendor.gst.tradeName || "—"}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-indigo-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-400">GST Address</p>
                <p className="text-sm text-gray-800">{vendor.gst.gstAddress || "—"}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Landmark className="w-4 h-4 text-indigo-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-400">State</p>
                <p className="text-sm text-gray-800">
                  {vendor.gst.state?.name ? `${vendor.gst.state.name} (${vendor.gst.state.code}-${vendor.gst.state.key})` : "—"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </CollapsibleCard>
  );
};

/* ------------------------------------------------------------------ */
/* Card 2 — Contact Details                                            */
/* ------------------------------------------------------------------ */

const ContactDetailsCard = ({ vendor, setVendor }) => {
  const [newLabel, setNewLabel] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const updateContact = (idx, patch) =>
    setVendor((v) => {
      const contacts = [...v.contacts];
      contacts[idx] = { ...contacts[idx], ...patch };
      return { ...v, contacts };
    });

  const removeContact = (idx) => setVendor((v) => ({ ...v, contacts: v.contacts.filter((_, i) => i !== idx) }));

  const addContact = () => {
    if (!newLabel.trim()) return;
    setVendor((v) => ({ ...v, contacts: [...v.contacts, emptyContact(newLabel.trim().toUpperCase())] }));
    setNewLabel("");
    setShowAdd(false);
  };

  return (
    <CollapsibleCard
      index={2}
      title="Contact Details"
      subtitle="Add primary and other contact persons"
      action={
        !showAdd && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50"
          >
            <Plus className="w-3.5 h-3.5" /> Add More Contact
          </button>
        )
      }
    >
      <div className="space-y-5">
        {showAdd && (
          <div className="flex gap-2">
            <input
              autoFocus
              className={inputCls}
              placeholder="Contact label, e.g. Technical"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addContact()}
            />
            <button type="button" onClick={addContact} className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
              Add
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-600">
              Cancel
            </button>
          </div>
        )}

        {vendor.contacts.map((contact, idx) => (
          <div key={idx} className="border border-gray-100 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span
                className={`inline-flex text-xs font-semibold tracking-wide px-2.5 py-1 rounded-full ${
                  contact.label === "PRIMARY" ? "bg-indigo-50 text-indigo-600" : "bg-purple-50 text-purple-600"
                }`}
              >
                {contact.label}
              </span>
              {contact.label === "PRIMARY" ? (
                <PrimaryTag />
              ) : (
                <button type="button" onClick={() => removeContact(idx)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
              <Field label="Contact Name" required>
                <input className={inputCls} value={contact.name} onChange={(e) => updateContact(idx, { name: e.target.value })} />
              </Field>
              <Field label="Email" required>
                <input type="email" className={inputCls} value={contact.email} onChange={(e) => updateContact(idx, { email: e.target.value })} />
              </Field>
              <Field label="Phone" required>
                <input className={inputCls} value={contact.phone} onChange={(e) => updateContact(idx, { phone: e.target.value })} />
              </Field>
              <Field label="Designation">
                <input className={inputCls} value={contact.designation} onChange={(e) => updateContact(idx, { designation: e.target.value })} />
              </Field>
              <Field label="Department">
                <input className={inputCls} value={contact.department} onChange={(e) => updateContact(idx, { department: e.target.value })} />
              </Field>
            </div>
          </div>
        ))}
      </div>
    </CollapsibleCard>
  );
};

/* ------------------------------------------------------------------ */
/* Card 3 — Address Information                                        */
/* ------------------------------------------------------------------ */

const AddressCard = ({ vendor, setVendor }) => {
  const setAddress = (patch) => setVendor((v) => ({ ...v, address: { ...v.address, ...patch } }));

  return (
    <CollapsibleCard index={3} title="Address Information" subtitle="Enter complete address of the vendor">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
        <div className="sm:col-span-1">
          <Field label="Complete Address" required>
            <input className={inputCls} value={vendor.address.fullAddress} onChange={(e) => setAddress({ fullAddress: e.target.value })} />
          </Field>
        </div>
        <Field label="Area / Locality" required>
          <input className={inputCls} value={vendor.address.area} onChange={(e) => setAddress({ area: e.target.value })} />
        </Field>
        <Field label="City" required>
          <input className={inputCls} value={vendor.address.city} onChange={(e) => setAddress({ city: e.target.value })} />
        </Field>
        <div className="hidden sm:flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center">
            <MapPin className="w-6 h-6 text-red-400" />
          </div>
        </div>

        <Field label="PIN Code" required>
          <input className={inputCls} value={vendor.address.pinCode} onChange={(e) => setAddress({ pinCode: e.target.value })} maxLength={6} />
        </Field>
        <Field label="State" required>
          <StateSelect value={vendor.address.state} onChange={(state) => setAddress({ state })} />
        </Field>
        <Field label="State Code">
          <StateCodeReadOnly code={vendor.address.state?.code} />
        </Field>
      </div>
    </CollapsibleCard>
  );
};

/* ------------------------------------------------------------------ */
/* Card 4 — Assign Products                                             */
/* ------------------------------------------------------------------ */

const AssignProductsCard = ({ vendor, setVendor }) => {
  const [search, setSearch] = useState("");
  const [leafOptions, setLeafOptions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [productsByCategory, setProductsByCategory] = useState({});
  const [selectedCategory, setSelectedCategory] = useState(null);

  // RULE 23 / Section 20: leaf-category search filters SERVER-SIDE via
  // ?type=LEAF — same endpoint/pattern used by ProductDefinition.jsx's
  // category picker. Never fetch-all-then-filter client-side.
  useEffect(() => {
    if (!search) {
      setLeafOptions([]);
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
        if (json.success) setLeafOptions(json.data || []);
      } catch {
        setLeafOptions([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [search]);

  const loadProductsForCategory = useCallback(
    async (categoryId) => {
      if (productsByCategory[categoryId]) return;
      try {
        const res = await fetch(`${API_BACKEND_URL}/stock/product-definitions/by-category/${categoryId}`, {
          credentials: "include",
        });
        const json = await res.json();
        if (json.success) setProductsByCategory((prev) => ({ ...prev, [categoryId]: json.data || [] }));
        else setProductsByCategory((prev) => ({ ...prev, [categoryId]: [] }));
      } catch {
        setProductsByCategory((prev) => ({ ...prev, [categoryId]: [] }));
      }
    },
    [productsByCategory]
  );

  // ── EDIT-MODE FIX ────────────────────────────────────────────────────
  // In edit mode, assignedProducts arrives pre-filled from GET /vendors/:id,
  // but nothing had fetched those categories' products — so every card was
  // stuck on "Loading products..." forever. This effect fetches products for
  // any assigned category not yet in productsByCategory. The early-return
  // inside loadProductsForCategory prevents duplicate fetches. Create mode
  // is unaffected (its categories load via addSelectedCategory as before).
  useEffect(() => {
    vendor.assignedProducts.forEach((ap) => {
      if (ap.categoryId && !productsByCategory[ap.categoryId]) {
        loadProductsForCategory(ap.categoryId);
      }
    });
  }, [vendor.assignedProducts, productsByCategory, loadProductsForCategory]);
  // ─────────────────────────────────────────────────────────────────────

  const addSelectedCategory = async () => {
    if (!selectedCategory) return;
    const exists = vendor.assignedProducts.some((ap) => ap.categoryId === selectedCategory._id);
    if (!exists) {
      setVendor((v) => ({
        ...v,
        assignedProducts: [
          ...v.assignedProducts,
          { categoryId: selectedCategory._id, categoryName: selectedCategory.name, productIds: [] },
        ],
      }));
      await loadProductsForCategory(selectedCategory._id);
    }
    setSelectedCategory(null);
    setSearch("");
    setLeafOptions([]);
  };

  const removeCategory = (categoryId) =>
    setVendor((v) => ({ ...v, assignedProducts: v.assignedProducts.filter((ap) => ap.categoryId !== categoryId) }));

  const toggleProduct = (categoryId, productId) =>
    setVendor((v) => ({
      ...v,
      assignedProducts: v.assignedProducts.map((ap) => {
        if (ap.categoryId !== categoryId) return ap;
        const has = ap.productIds.includes(productId);
        return { ...ap, productIds: has ? ap.productIds.filter((id) => id !== productId) : [...ap.productIds, productId] };
      }),
    }));

  return (
    <CollapsibleCard index={4} title="Assign Products" subtitle="Select categories and products supplied by this vendor">
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className={`${inputCls} pl-9`}
            placeholder="Select Last Category (Leaf)"
            value={selectedCategory ? selectedCategory.displayPath || selectedCategory.name : search}
            onChange={(e) => {
              setSelectedCategory(null);
              setSearch(e.target.value);
            }}
          />
          {search && !selectedCategory && (leafOptions.length > 0 || searching) && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
              {searching ? (
                <div className="px-3 py-2 text-sm text-gray-400">Searching...</div>
              ) : (
                leafOptions.map((cat) => (
                  <button
                    key={cat._id}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    {cat.displayPath || cat.name}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={addSelectedCategory}
          disabled={!selectedCategory}
          className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> Add Category
        </button>
        <div className="hidden sm:flex items-center gap-2 px-3 py-2 text-xs font-medium text-amber-700 bg-amber-50 rounded-lg whitespace-nowrap">
          <MapPin className="w-3.5 h-3.5" /> Select multiple products from each category
        </div>
      </div>

      {vendor.assignedProducts.length === 0 ? (
        <p className="text-sm text-gray-400">No categories assigned yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {vendor.assignedProducts.map((ap) => (
            <div key={ap.categoryId} className="border border-gray-100 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800">
                  {ap.categoryName}
                  <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    LEAF
                  </span>
                </span>
                <button type="button" onClick={() => removeCategory(ap.categoryId)} className="text-xs font-medium text-red-500 hover:text-red-600">
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(productsByCategory[ap.categoryId] || []).map((product) => (
                  <label key={product._id} className="flex items-center gap-2 text-sm text-gray-600 px-1 py-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ap.productIds.includes(product._id)}
                      onChange={() => toggleProduct(ap.categoryId, product._id)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    {product.name}
                  </label>
                ))}
                {/* EDIT-MODE FIX: distinguish "still fetching" (key absent)
                    from "fetched, category has zero products" (empty array) */}
                {!productsByCategory[ap.categoryId] && (
                  <span className="text-xs text-gray-400 inline-flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" /> Loading products...
                  </span>
                )}
                {productsByCategory[ap.categoryId]?.length === 0 && (
                  <span className="text-xs text-gray-400">No products in this category</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </CollapsibleCard>
  );
};

/* ------------------------------------------------------------------ */
/* Card 5 — Bank Details                                                */
/* ------------------------------------------------------------------ */

const BankDetailsCard = ({ vendor, setVendor }) => {
  const [newLabel, setNewLabel] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const updateBank = (idx, patch) =>
    setVendor((v) => {
      const bankAccounts = [...v.bankAccounts];
      bankAccounts[idx] = { ...bankAccounts[idx], ...patch };
      return { ...v, bankAccounts };
    });

  const removeBank = (idx) => setVendor((v) => ({ ...v, bankAccounts: v.bankAccounts.filter((_, i) => i !== idx) }));

  const addBank = () => {
    if (!newLabel.trim()) return;
    setVendor((v) => ({ ...v, bankAccounts: [...v.bankAccounts, emptyBankAccount(newLabel.trim().toUpperCase())] }));
    setNewLabel("");
    setShowAdd(false);
  };

  return (
    <CollapsibleCard
      index={5}
      title="Bank Details"
      subtitle="Add bank account details for payments"
      action={
        !showAdd && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50"
          >
            <Plus className="w-3.5 h-3.5" /> Add More Bank Account
          </button>
        )
      }
    >
      <div className="space-y-5">
        {showAdd && (
          <div className="flex gap-2">
            <input
              autoFocus
              className={inputCls}
              placeholder="Account label, e.g. Secondary Account"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addBank()}
            />
            <button type="button" onClick={addBank} className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
              Add
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-600">
              Cancel
            </button>
          </div>
        )}

        {vendor.bankAccounts.map((bank, idx) => (
          <div key={idx} className="border border-gray-100 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span
                className={`inline-flex text-xs font-semibold tracking-wide px-2.5 py-1 rounded-full ${
                  bank.label === "PRIMARY" ? "bg-indigo-50 text-indigo-600" : "bg-purple-50 text-purple-600"
                }`}
              >
                {bank.label === "PRIMARY" ? "PRIMARY BANK ACCOUNT" : bank.label}
              </span>
              {bank.label === "PRIMARY" ? (
                <div className="flex items-center gap-2">
                  <PrimaryTag />
                  <button type="button" className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => removeBank(idx)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <Field label="IFSC Code" required>
                <input className={inputCls} value={bank.ifsc} onChange={(e) => updateBank(idx, { ifsc: e.target.value.toUpperCase() })} />
              </Field>
              <Field label="Bank Name" required>
                <input className={inputCls} value={bank.bankName} onChange={(e) => updateBank(idx, { bankName: e.target.value })} />
              </Field>
              <Field label="Branch" required>
                <input className={inputCls} value={bank.branch} onChange={(e) => updateBank(idx, { branch: e.target.value })} />
              </Field>
              <Field label="Branch Address" required>
                <input className={inputCls} value={bank.branchAddress} onChange={(e) => updateBank(idx, { branchAddress: e.target.value })} />
              </Field>

              <Field label="State" required>
                <StateSelect value={bank.state} onChange={(state) => updateBank(idx, { state })} />
              </Field>
              <Field label="State Code">
                <StateCodeReadOnly code={bank.state?.code} />
              </Field>
              <Field label="City" required>
                <input className={inputCls} value={bank.city} onChange={(e) => updateBank(idx, { city: e.target.value })} />
              </Field>
              <Field label="Account Number" required>
                <input className={inputCls} value={bank.accountNumber} onChange={(e) => updateBank(idx, { accountNumber: e.target.value })} />
              </Field>

              <Field label="RTGS Code">
                <input className={inputCls} value={bank.rtgsCode} onChange={(e) => updateBank(idx, { rtgsCode: e.target.value })} />
              </Field>
              <Field label="NEFT Code">
                <input className={inputCls} value={bank.neftCode} onChange={(e) => updateBank(idx, { neftCode: e.target.value })} />
              </Field>
            </div>
          </div>
        ))}
      </div>
    </CollapsibleCard>
  );
};

/* ------------------------------------------------------------------ */
/* Main form                                                            */
/* ------------------------------------------------------------------ */

const VendorForm = ({ vendorId = null }) => {
  const router = useRouter();
  const isEdit = Boolean(vendorId);

  const [vendor, setVendor] = useState(defaultVendor());
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const loadVendor = useCallback(async () => {
    if (!isEdit) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BACKEND_URL}/stock/vendors/${vendorId}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to load vendor");

      const data = json.data;
      setVendor({
        ...defaultVendor(),
        ...data,
        gst: { ...defaultVendor().gst, ...data.gst },
        // populate gives categoryId as an object ({_id, name, type}) — flatten
        // to id + name so the Assign Products card can render immediately.
        // Soft-deleted categories populate as null → filtered out safely.
        assignedProducts: (data.assignedProducts || [])
          .filter((ap) => ap.categoryId)
          .map((ap) => ({
            categoryId: ap.categoryId?._id || ap.categoryId,
            categoryName: ap.categoryId?.name || ap.categoryName || "",
            productIds: (ap.productIds || []).map((p) => p?._id || p),
          })),
      });
    } catch (err) {
      setFormError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isEdit, vendorId]);

  useEffect(() => {
    loadVendor();
  }, [loadVendor]);

  const validate = () => {
    if (!vendor.name.trim()) return "Company / Vendor Name is required";
    if (!vendor.paymentTerms) return "Payment Terms is required";
    if (vendor.gst.isAvailable && !vendor.gst.gstNumber.trim()) return "GST Number is required";
    const primaryContact = vendor.contacts.find((c) => c.label === "PRIMARY");
    if (!primaryContact?.name || !primaryContact?.email || !primaryContact?.phone) {
      return "Primary contact name, email, and phone are required";
    }
    if (!vendor.address.fullAddress.trim() || !vendor.address.city.trim() || !vendor.address.pinCode.trim()) {
      return "Complete address, city, and PIN code are required";
    }
    const primaryBank = vendor.bankAccounts.find((b) => b.label === "PRIMARY");
    if (!primaryBank?.ifsc || !primaryBank?.accountNumber) {
      return "Primary bank account IFSC and account number are required";
    }
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      setFormError(err);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      const payload = {
        ...vendor,
        assignedProducts: vendor.assignedProducts.map((ap) => ({ categoryId: ap.categoryId, productIds: ap.productIds })),
      };
      // vendorCode is immutable — never send it on update (Rule 10 pattern)
      if (isEdit) delete payload.vendorCode;

      const res = await fetch(`${API_BACKEND_URL}/stock/vendors${isEdit ? `/${vendorId}` : ""}`, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to save vendor");
      router.push("/stock/vendors");
    } catch (err) {
      setFormError(err.message);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="animate-pulse space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{isEdit ? "Edit Vendor" : "Create Vendor"}</h1>
          <p className="text-sm text-gray-500 mt-1">Add vendor details and manage product & payment information</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/stock/vendors")}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Vendors
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Vendor
          </button>
        </div>
      </div>

      {formError && (
        <div className="mb-5 flex items-center justify-between px-4 py-3 rounded-lg bg-red-50 text-red-600 text-sm">
          {formError}
          <button onClick={() => setFormError(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="space-y-6">
        <BasicDetailsCard vendor={vendor} setVendor={setVendor} />
        <ContactDetailsCard vendor={vendor} setVendor={setVendor} />
        <AddressCard vendor={vendor} setVendor={setVendor} />
        <AssignProductsCard vendor={vendor} setVendor={setVendor} />
        <BankDetailsCard vendor={vendor} setVendor={setVendor} />
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <button
          onClick={() => router.push("/vendors")}
          className="px-5 py-2.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Saving..." : "Save Vendor"}
        </button>
      </div>
    </div>
  );
};

export default VendorForm;