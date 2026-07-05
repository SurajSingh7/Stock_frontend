"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  ShieldCheck,
  Loader2,
  ChevronDown,
  Search,
  X,
} from "lucide-react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import { PAYMENT_TERMS, STATE_OPTIONS, mockVerifyGST } from "./vendorConstants";

/* ------------------------------------------------------------------ */
/* Generic small pieces                                                */
/* ------------------------------------------------------------------ */

const Card = ({ title, subtitle, children }) => (
  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
    <div className="mb-5">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
    {children}
  </div>
);

const Field = ({ label, required, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-sm font-medium text-gray-700">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
  </div>
);

const inputCls =
  "w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500";

// State dropdown — shared shape everywhere (Vendor address + Bank details).
// Reads from STATE_OPTIONS (constants/vendorConstants.js). Auto-shows the
// readonly state code once a state is picked.
const StateSelect = ({ value, onChange }) => (
  <div className="grid grid-cols-3 gap-3">
    <div className="col-span-2">
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
    </div>
    <input value={value?.code || ""} readOnly placeholder="Code" className={`${inputCls} bg-gray-50 text-gray-500`} />
  </div>
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

const BasicDetailsCard = ({ vendor, setVendor, isEdit }) => {
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState(null);

  const setGst = (patch) => setVendor((v) => ({ ...v, gst: { ...v.gst, ...patch } }));

  /*
   FUTURE GST API INTEGRATION — see constants/vendorConstants.js mockVerifyGST()
   for the exact expected response shape and swap instructions. Only that
   function needs to change; this handler stays as-is.
  */
  const handleVerifyGST = async () => {
    setVerifying(true);
    setVerifyError(null);
    try {
      const result = await mockVerifyGST(vendor.gst.gstNumber);
      setGst({
        isVerified: true,
        verifiedAt: new Date().toISOString(),
        legalName: result.legalName,
        tradeName: result.tradeName,
        gstAddress: result.address,
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

  return (
    <Card title="Vendor Basic Details">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field label="Company / Vendor Name" required>
          <input
            className={inputCls}
            value={vendor.name}
            onChange={(e) => setVendor((v) => ({ ...v, name: e.target.value }))}
            placeholder="e.g. Acme Distributors"
          />
        </Field>

        <Field label="Vendor Alias">
          <input
            className={inputCls}
            value={vendor.vendorAlias}
            onChange={(e) => setVendor((v) => ({ ...v, vendorAlias: e.target.value }))}
            placeholder="Short name used internally"
          />
        </Field>

        <Field label="Is GST Available?" required>
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 w-fit">
            {[true, false].map((val) => (
              <button
                key={String(val)}
                type="button"
                onClick={() => setGst({ isAvailable: val })}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  vendor.gst.isAvailable === val
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {val ? "YES" : "NO"}
              </button>
            ))}
          </div>
        </Field>

        <Field label="PAN Number">
          <input
            className={inputCls}
            value={vendor.panNumber}
            onChange={(e) => setVendor((v) => ({ ...v, panNumber: e.target.value.toUpperCase() }))}
            placeholder="ABCDE1234F"
            maxLength={10}
          />
        </Field>

        {vendor.gst.isAvailable && (
          <>
            <Field label="GST Number" required>
              <div className="flex gap-2">
                <input
                  className={inputCls}
                  value={vendor.gst.gstNumber}
                  onChange={(e) =>
                    setGst({ gstNumber: e.target.value.toUpperCase(), isVerified: false })
                  }
                  placeholder="29ABCDE1234F1Z5"
                  maxLength={15}
                />
                <button
                  type="button"
                  onClick={handleVerifyGST}
                  disabled={verifying || !vendor.gst.gstNumber}
                  className="shrink-0 px-3 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify GST"}
                </button>
              </div>
              {verifyError && <p className="text-xs text-red-500 mt-1">{verifyError}</p>}
            </Field>

            <Field label="GST Status">
              {vendor.gst.isVerified ? (
                <span className="inline-flex items-center gap-1.5 w-fit text-xs font-medium text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">
                  <ShieldCheck className="w-4 h-4" /> VERIFIED
                </span>
              ) : (
                <span className="inline-flex items-center w-fit text-xs font-medium text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                  NOT VERIFIED
                </span>
              )}
            </Field>
          </>
        )}

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

        {isEdit && (
          <Field label="Vendor Code">
            <input className={`${inputCls} bg-gray-50 text-gray-500`} value={vendor.vendorCode || ""} readOnly />
          </Field>
        )}
      </div>

      <div className="mt-5">
        <Field label="Notes">
          <textarea
            className={`${inputCls} min-h-[90px]`}
            value={vendor.notes}
            onChange={(e) => setVendor((v) => ({ ...v, notes: e.target.value }))}
            placeholder="Optional — also used to record blacklist/inactive reason later"
          />
        </Field>
      </div>
    </Card>
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

  const removeContact = (idx) =>
    setVendor((v) => ({ ...v, contacts: v.contacts.filter((_, i) => i !== idx) }));

  const addContact = () => {
    if (!newLabel.trim()) return;
    setVendor((v) => ({ ...v, contacts: [...v.contacts, emptyContact(newLabel.trim().toUpperCase())] }));
    setNewLabel("");
    setShowAdd(false);
  };

  return (
    <Card title="Contact Details" subtitle="Vendor can have multiple contacts.">
      <div className="space-y-6">
        {vendor.contacts.map((contact, idx) => (
          <div key={idx} className="border border-gray-100 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold tracking-wide text-indigo-600">{contact.label}</span>
              {contact.label !== "PRIMARY" && (
                <button
                  type="button"
                  onClick={() => removeContact(idx)}
                  className="text-red-500 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Name" required>
                <input
                  className={inputCls}
                  value={contact.name}
                  onChange={(e) => updateContact(idx, { name: e.target.value })}
                />
              </Field>
              <Field label="Email" required>
                <input
                  type="email"
                  className={inputCls}
                  value={contact.email}
                  onChange={(e) => updateContact(idx, { email: e.target.value })}
                />
              </Field>
              <Field label="Phone" required>
                <input
                  className={inputCls}
                  value={contact.phone}
                  onChange={(e) => updateContact(idx, { phone: e.target.value })}
                />
              </Field>
              <Field label="Designation">
                <input
                  className={inputCls}
                  value={contact.designation}
                  onChange={(e) => updateContact(idx, { designation: e.target.value })}
                />
              </Field>
              <Field label="Department">
                <input
                  className={inputCls}
                  value={contact.department}
                  onChange={(e) => updateContact(idx, { department: e.target.value })}
                />
              </Field>
            </div>
          </div>
        ))}

        {showAdd ? (
          <div className="flex gap-2">
            <input
              autoFocus
              className={inputCls}
              placeholder="Contact label, e.g. Technical"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addContact()}
            />
            <button
              type="button"
              onClick={addContact}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-600"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            <Plus className="w-4 h-4" /> Add More Contact
          </button>
        )}
      </div>
    </Card>
  );
};

/* ------------------------------------------------------------------ */
/* Card 3 — Address Information                                        */
/* ------------------------------------------------------------------ */

const AddressCard = ({ vendor, setVendor }) => {
  const setAddress = (patch) => setVendor((v) => ({ ...v, address: { ...v.address, ...patch } }));

  return (
    <Card title="Address Information">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="sm:col-span-2">
          <Field label="Complete Address" required>
            <input
              className={inputCls}
              value={vendor.address.fullAddress}
              onChange={(e) => setAddress({ fullAddress: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Area / Locality" required>
          <input className={inputCls} value={vendor.address.area} onChange={(e) => setAddress({ area: e.target.value })} />
        </Field>
        <Field label="City" required>
          <input className={inputCls} value={vendor.address.city} onChange={(e) => setAddress({ city: e.target.value })} />
        </Field>
        <Field label="PIN Code" required>
          <input
            className={inputCls}
            value={vendor.address.pinCode}
            onChange={(e) => setAddress({ pinCode: e.target.value })}
            maxLength={6}
          />
        </Field>
        <Field label="State" required>
          <StateSelect value={vendor.address.state} onChange={(state) => setAddress({ state })} />
        </Field>
      </div>
    </Card>
  );
};

/* ------------------------------------------------------------------ */
/* Card 4 — Assign Products                                             */
/* ------------------------------------------------------------------ */

const AssignProductsCard = ({ vendor, setVendor }) => {
  const [search, setSearch] = useState("");
  const [leafOptions, setLeafOptions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [productsByCategory, setProductsByCategory] = useState({}); // categoryId -> [{_id,name}]

  // RULE 23 / Section 20: leaf-category search filters SERVER-SIDE via
  // ?type=LEAF — same endpoint and pattern used by ProductDefinition.jsx's
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

  const loadProductsForCategory = async (categoryId) => {
    if (productsByCategory[categoryId]) return;
    try {
      const res = await fetch(`${API_BACKEND_URL}/stock/product-definitions/by-category/${categoryId}`, {
        credentials: "include",
      });
      const json = await res.json();
      if (json.success) {
        setProductsByCategory((prev) => ({ ...prev, [categoryId]: json.data || [] }));
      }
    } catch {
      setProductsByCategory((prev) => ({ ...prev, [categoryId]: [] }));
    }
  };

  const addCategory = async (category) => {
    const exists = vendor.assignedProducts.some((ap) => ap.categoryId === category._id);
    if (exists) return;
    setVendor((v) => ({
      ...v,
      assignedProducts: [...v.assignedProducts, { categoryId: category._id, categoryName: category.name, productIds: [] }],
    }));
    setSearch("");
    setLeafOptions([]);
    await loadProductsForCategory(category._id);
  };

  const removeCategory = (categoryId) =>
    setVendor((v) => ({
      ...v,
      assignedProducts: v.assignedProducts.filter((ap) => ap.categoryId !== categoryId),
    }));

  const toggleProduct = (categoryId, productId) =>
    setVendor((v) => ({
      ...v,
      assignedProducts: v.assignedProducts.map((ap) => {
        if (ap.categoryId !== categoryId) return ap;
        const has = ap.productIds.includes(productId);
        return {
          ...ap,
          productIds: has ? ap.productIds.filter((id) => id !== productId) : [...ap.productIds, productId],
        };
      }),
    }));

  return (
    <Card title="Assign Products" subtitle="Define which products this vendor supplies.">
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          className={`${inputCls} pl-9`}
          placeholder="Search leaf category, e.g. Poco"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (leafOptions.length > 0 || searching) && (
          <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
            {searching ? (
              <div className="px-3 py-2 text-sm text-gray-400">Searching...</div>
            ) : (
              leafOptions.map((cat) => (
                <button
                  key={cat._id}
                  type="button"
                  onClick={() => addCategory(cat)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between"
                >
                  <span>{cat.displayPath || cat.name}</span>
                  <Plus className="w-3.5 h-3.5 text-indigo-500" />
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className="space-y-5">
        {vendor.assignedProducts.length === 0 && (
          <p className="text-sm text-gray-400">No categories assigned yet.</p>
        )}
        {vendor.assignedProducts.map((ap) => (
          <div key={ap.categoryId} className="border border-gray-100 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-800">{ap.categoryName}</span>
              <button
                type="button"
                onClick={() => removeCategory(ap.categoryId)}
                className="text-red-500 hover:text-red-600"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(productsByCategory[ap.categoryId] || []).map((product) => (
                <label
                  key={product._id}
                  className="flex items-center gap-2 text-sm text-gray-600 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={ap.productIds.includes(product._id)}
                    onChange={() => toggleProduct(ap.categoryId, product._id)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  {product.name}
                </label>
              ))}
              {!productsByCategory[ap.categoryId] && (
                <span className="text-xs text-gray-400">Loading products...</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
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

  const removeBank = (idx) =>
    setVendor((v) => ({ ...v, bankAccounts: v.bankAccounts.filter((_, i) => i !== idx) }));

  const addBank = () => {
    if (!newLabel.trim()) return;
    setVendor((v) => ({ ...v, bankAccounts: [...v.bankAccounts, emptyBankAccount(newLabel.trim().toUpperCase())] }));
    setNewLabel("");
    setShowAdd(false);
  };

  return (
    <Card title="Bank Details" subtitle="Vendor can have multiple bank accounts.">
      <div className="space-y-6">
        {vendor.bankAccounts.map((bank, idx) => (
          <div key={idx} className="border border-gray-100 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold tracking-wide text-indigo-600">{bank.label}</span>
              {bank.label !== "PRIMARY" && (
                <button type="button" onClick={() => removeBank(idx)} className="text-red-500 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="IFSC Code" required>
                <input
                  className={inputCls}
                  value={bank.ifsc}
                  onChange={(e) => updateBank(idx, { ifsc: e.target.value.toUpperCase() })}
                />
              </Field>
              <Field label="Account Number" required>
                <input
                  className={inputCls}
                  value={bank.accountNumber}
                  onChange={(e) => updateBank(idx, { accountNumber: e.target.value })}
                />
              </Field>
              <Field label="Bank Name">
                <input className={inputCls} value={bank.bankName} onChange={(e) => updateBank(idx, { bankName: e.target.value })} />
              </Field>
              <Field label="Branch">
                <input className={inputCls} value={bank.branch} onChange={(e) => updateBank(idx, { branch: e.target.value })} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Branch Address">
                  <input
                    className={inputCls}
                    value={bank.branchAddress}
                    onChange={(e) => updateBank(idx, { branchAddress: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="City">
                <input className={inputCls} value={bank.city} onChange={(e) => updateBank(idx, { city: e.target.value })} />
              </Field>
              <Field label="State">
                <StateSelect value={bank.state} onChange={(state) => updateBank(idx, { state })} />
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

        {showAdd ? (
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
        ) : (
          <button type="button" onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700">
            <Plus className="w-4 h-4" /> Add More Bank Account
          </button>
        )}
      </div>
    </Card>
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
        assignedProducts: (data.assignedProducts || []).map((ap) => ({
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
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      const payload = {
        ...vendor,
        assignedProducts: vendor.assignedProducts.map((ap) => ({
          categoryId: ap.categoryId,
          productIds: ap.productIds,
        })),
      };
      // vendorCode is immutable — never send it on update (Rule 10 pattern)
      if (isEdit) delete payload.vendorCode;

      const res = await fetch(
        `${API_BACKEND_URL}/stock/vendors${isEdit ? `/${vendorId}` : ""}`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        }
      );
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to save vendor");
      router.push("/vendors");
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto pb-28">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">{isEdit ? "Edit Vendor" : "Add Vendor"}</h1>
        <p className="text-sm text-gray-500 mt-1">
          Fields marked with <span className="text-red-500">*</span> are required.
        </p>
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
        <BasicDetailsCard vendor={vendor} setVendor={setVendor} isEdit={isEdit} />
        <ContactDetailsCard vendor={vendor} setVendor={setVendor} />
        <AddressCard vendor={vendor} setVendor={setVendor} />
        <AssignProductsCard vendor={vendor} setVendor={setVendor} />
        <BankDetailsCard vendor={vendor} setVendor={setVendor} />
      </div>

      {/* Sticky action bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex justify-end gap-3">
          <button
            onClick={() => router.push("/vendors")}
            className="px-5 py-2.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2.5 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 inline-flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Vendor"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VendorForm;