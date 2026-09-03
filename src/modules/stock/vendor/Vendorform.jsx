"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Save, Plus, Trash2, ShieldCheck, Loader2, ChevronUp, ChevronDown,
  Search, X, Lock, MapPin, User, FileText, Landmark, AlertCircle, Check,
  DeleteIcon,
  Delete,
  LucideDelete,
} from "lucide-react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import { PAYMENT_TERMS, STATE_OPTIONS } from "./vendorConstants";
import { verifyGST } from "./gstVerification";
import { fetchAllLeafCategories } from "@/shared/category/categoryPath";

/* ------------------------------------------------------------------ */
/* Tokens — SAME as PurchaseOrderPage                                  */
/* ------------------------------------------------------------------ */

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";
const inputErrCls =
  "w-full rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-rose-300 shadow-sm transition focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100";
const lockedCls =
  "w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 shadow-sm";

/* ------------------------------------------------------------------ */
/* Validation rules (client-side; the backend re-validates anyway)     */
/* ------------------------------------------------------------------ */

const RX = {
  gstin: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
  pan: /^[A-Z]{5}[0-9]{4}[A-Z]$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  phone: /^[0-9]{10}$/,
  pin: /^[1-9][0-9]{5}$/,
  ifsc: /^[A-Z]{4}0[A-Z0-9]{6}$/,
  account: /^[0-9]{9,18}$/,
};
const digits = (s) => String(s || "").replace(/\D/g, "").slice(-10);

/* Suggested labels shown as one-click chips in the "+ Other" popover */
const CONTACT_LABEL_SUGGESTIONS = ["TECHNICAL", "BILLING", "SALES", "SUPPORT"];
const BANK_LABEL_SUGGESTIONS = ["SECONDARY ACCOUNT", "SALARY ACCOUNT", "ESCROW"];

/* ------------------------------------------------------------------ */
/* Generic pieces                                                      */
/* ------------------------------------------------------------------ */

// FIX 2: `min-w-0` lets each Field shrink to fit its grid/flex column
// instead of the default input min-width forcing the column (and long
// text like emails / branch addresses) to overflow the card.
const Field = ({ label, required, children, hint, error, locked }) => (
  <div className="flex min-w-0 flex-col gap-1.5">
    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
      {label} {required && <span className="text-rose-500">*</span>}
      {locked && (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
          <Lock className="h-3 w-3" /> From GST
        </span>
      )}
    </label>
    {children}
    {error ? (
      <p className="inline-flex items-center gap-1 text-xs font-medium text-rose-600">
        <AlertCircle className="h-3 w-3" /> {error}
      </p>
    ) : (
      hint && <p className="text-xs text-slate-400">{hint}</p>
    )}
  </div>
);

const CollapsibleCard = ({ index, title, subtitle, action, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between rounded-t-2xl bg-slate-50/60 px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
            {index}
          </span>
          <div>
            <h2 className="text-sm font-bold text-slate-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {action}
          <button type="button" onClick={() => setOpen((o) => !o)} className="text-slate-400 transition hover:text-slate-600">
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {open && <div className="border-t border-slate-100 px-6 pb-6 pt-5">{children}</div>}
    </div>
  );
};

const Toggle = ({ checked, onChange, label, disabled }) => (
  <button
    type="button" disabled={disabled} onClick={() => onChange(!checked)}
    className={`flex items-center gap-2 ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
  >
    <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${checked ? "bg-indigo-600" : "bg-slate-300"}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
    </span>
    <span className="text-xs font-semibold text-slate-700">{label}</span>
  </button>
);

const StateSelect = ({ value, onChange, locked, error }) => (
  <select
    value={value?.key || ""}
    disabled={locked}
    onChange={(e) => {
      const opt = STATE_OPTIONS.find((s) => s.key === e.target.value);
      onChange(opt ? { key: opt.key, name: opt.name, code: opt.code } : { key: "", name: "", code: "" });
    }}
    className={locked ? lockedCls : error ? inputErrCls : inputCls}
  >
    <option value="">Select state</option>
    {STATE_OPTIONS.map((s) => (
      <option key={s.key} value={s.key}>{s.label}</option>
    ))}
  </select>
);

const StateCodeReadOnly = ({ code }) => (
  <input value={code || ""} readOnly placeholder="—" className={lockedCls} />
);

const PrimaryTag = () => (
  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
    <ShieldCheck className="h-3.5 w-3.5" /> Primary
  </span>
);

/* ------------------------------------------------------------------ */
/* LabelTabs — side-by-side label pills + "+ Other" (reference UI).    */
/* Red dot = that tab has validation errors, so an error on a hidden   */
/* tab is never silently missed. Used by contacts AND bank accounts.   */
/* FIX 1: accepts a `trailing` node rendered at the END of this row    */
/* (used to place the "Primary" badge right after the "+ Other" btn).  */
/* ------------------------------------------------------------------ */

const LabelTabs = ({ items, activeIdx, onSelect, onAdd, errorsByIdx = [], suggestions = [], addLabel = "Other", trailing }) => {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const commit = (raw) => {
    const label = String(raw || draft).trim().toUpperCase();
    if (!label) return;
    if (items.some((i) => i.label === label)) return; // no duplicate labels
    onAdd(label);
    setDraft("");
    setAdding(false);
  };

  return (
    <div className="mb-5 border-b border-slate-100 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {items.map((item, idx) => {
            const active = idx === activeIdx;
            const hasError = Object.keys(errorsByIdx[idx] || {}).length > 0;
            const isPrimary = item.label === "PRIMARY";
            return (
              <button
                key={item.label + idx} type="button" onClick={() => onSelect(idx)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                  active ? "bg-indigo-600 text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {isPrimary ? "Primary" : item.label}
                {isPrimary && <span className={active ? "text-rose-200" : "text-rose-500"}>*</span>}
                {hasError && <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />}
              </button>
            );
          })}

          {adding ? (
            <span className="inline-flex items-center gap-1.5">
              <input
                autoFocus value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit();
                  if (e.key === "Escape") { setAdding(false); setDraft(""); }
                }}
                placeholder="Label name"
                className="h-[42px] w-40 rounded-lg border border-indigo-200 bg-white px-3 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
              <button
                type="button" onClick={() => commit()}
                className="inline-flex h-[42px] items-center gap-1 rounded-lg bg-indigo-600 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
              >
                <Check className="h-4 w-4" /> Add
              </button>
              <button
                type="button" onClick={() => { setAdding(false); setDraft(""); }}
                className="inline-flex h-[42px] items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button" onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-200"
            >
              <Plus className="h-4 w-4" /> {addLabel}
            </button>
          )}
        </div>

        {trailing && <div className="shrink-0">{trailing}</div>}
      </div>

      {adding && suggestions.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-400">Quick add:</span>
          {suggestions
            .filter((s) => !items.some((i) => i.label === s))
            .map((s) => (
              <button
                key={s} type="button" onClick={() => commit(s)}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
              >
                {s}
              </button>
            ))}
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Defaults                                                            */
/* ------------------------------------------------------------------ */

const emptyContact = (label) => ({
  label, name: "", email: "", phone: "", designation: "", department: "",
  // Mirrors the backend default (models/stock.vendor.model.js): the primary
  // contact is the one you write to; every other contact is opt-in.
  recipientType: label === "PRIMARY" ? "TO" : "NONE",
});

const emptyBankAccount = (label) => ({
  label, ifsc: "", bankName: "", branch: "", branchAddress: "",
  state: { key: "", name: "", code: "" }, city: "", accountNumber: "", rtgsCode: "", neftCode: "",
});

const defaultVendor = () => ({
  name: "",
  vendorCode: "",
  vendorAlias: "",
  gst: {
    isAvailable: true, gstNumber: "", isVerified: false, verifiedAt: null,
    legalName: "", tradeName: "", gstAddress: "", state: { key: "", name: "", code: "" },
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
/* Card 1 — Basic Details (GST verified ⇒ name / PAN / state locked)   */
/* ------------------------------------------------------------------ */

const BasicDetailsCard = ({ vendor, setVendor, errors, gstLocked, onVerified }) => {
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState(null);

  const setGst = (patch) => setVendor((v) => ({ ...v, gst: { ...v.gst, ...patch } }));

  // Real GST verification — see ./gstVerification.js for the response shape.
  const handleVerifyGST = async () => {
    setVerifying(true);
    setVerifyError(null);
    try {
      const result = await verifyGST(vendor.gst.gstNumber);
      const matchedState = STATE_OPTIONS.find((s) => s.code === result.stateCode || s.name === result.state);
      const gstState = matchedState
        ? { key: matchedState.key, name: matchedState.name, code: matchedState.code }
        : vendor.gst.state;

      setVendor((v) => ({
        ...v,
        // GST is the source of truth once verified → overwrite, then lock
        name: result.legalName || v.name,
        panNumber: (result.panNumber || v.panNumber || "").toUpperCase(),
        gst: {
          ...v.gst,
          isVerified: true,
          verifiedAt: new Date().toISOString(),
          legalName: result.legalName,
          tradeName: result.tradeName,
          gstAddress: result.address,
          state: gstState,
        },
      }));

      onVerified({ gstAddress: result.address, state: gstState });
    } catch (err) {
      setVerifyError(err.message);
    } finally {
      setVerifying(false);
    }
  };

  const lastVerifiedLabel = vendor.gst.verifiedAt
    ? new Date(vendor.gst.verifiedAt).toLocaleString("en-IN", {
        day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
      })
    : null;

  return (
    <CollapsibleCard index={1} title="Vendor Basic Details" subtitle="Enter primary information about the vendor">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field
          label="Company / Vendor Name" required locked={gstLocked} error={errors.name}
          hint={gstLocked ? "Auto-filled from GST — the verified legal name cannot be edited" : undefined}
        >
          <input
            className={gstLocked ? lockedCls : errors.name ? inputErrCls : inputCls}
            readOnly={gstLocked}
            value={vendor.name}
            title={vendor.name}
            onChange={(e) => setVendor((v) => ({ ...v, name: e.target.value }))}
            placeholder="e.g. Acme Distributors"
          />
        </Field>

        <Field label="Is GST Available?" required>
          <div className="inline-flex w-fit gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button" onClick={() => setGst({ isAvailable: true })}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                vendor.gst.isAvailable ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() =>
                setVendor((v) => ({
                  ...v,
                  // turning GST off drops verification → everything unlocks again
                  gst: { ...v.gst, isAvailable: false, isVerified: false, verifiedAt: null },
                }))
              }
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                !vendor.gst.isAvailable ? "bg-slate-200 text-slate-700" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              No
            </button>
          </div>
        </Field>

        {vendor.gst.isAvailable && (
          <>
            <Field label="GST Number" required error={errors.gstNumber} hint="Verify to auto-fill name, PAN, state and address">
              <div className="flex gap-2">
                <input
                  className={errors.gstNumber ? inputErrCls : inputCls}
                  value={vendor.gst.gstNumber}
                  onChange={(e) => setGst({ gstNumber: e.target.value.toUpperCase(), isVerified: false, verifiedAt: null })}
                  placeholder="29ABCDE1234F1Z5"
                  maxLength={15}
                />
                <button
                  type="button" onClick={handleVerifyGST} disabled={verifying || !vendor.gst.gstNumber}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-semibold text-indigo-600 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  Verify GST
                </button>
              </div>
              {verifyError && <p className="mt-1 text-xs font-medium text-rose-600">{verifyError}</p>}
            </Field>

            <Field label="GST Status">
              <div className={`rounded-lg px-4 py-2.5 ring-1 ring-inset ${vendor.gst.isVerified ? "bg-emerald-50 ring-emerald-100" : "bg-amber-50 ring-amber-100"}`}>
                {vendor.gst.isVerified ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    <ShieldCheck className="h-3.5 w-3.5" /> VERIFIED
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                    NOT VERIFIED
                  </span>
                )}
                {lastVerifiedLabel && <p className="mt-1.5 text-xs text-slate-500">Last verified: {lastVerifiedLabel}</p>}
              </div>
            </Field>
          </>
        )}

        <Field label="PAN Number" locked={gstLocked} error={errors.panNumber} hint={gstLocked ? "Auto-filled from GST" : undefined}>
          <input
            className={gstLocked ? lockedCls : errors.panNumber ? inputErrCls : inputCls}
            readOnly={gstLocked}
            value={vendor.panNumber}
            onChange={(e) => setVendor((v) => ({ ...v, panNumber: e.target.value.toUpperCase() }))}
            placeholder="ABCDE1234F"
            maxLength={10}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="State" required locked={gstLocked} error={errors.gstState}>
            <StateSelect value={vendor.gst.state} locked={gstLocked} error={Boolean(errors.gstState)} onChange={(state) => setGst({ state })} />
          </Field>
          <Field label="State Code">
            <StateCodeReadOnly code={vendor.gst.state?.code} />
          </Field>
        </div>

        <Field label="Vendor Alias">
          <input
            className={inputCls} value={vendor.vendorAlias}
            onChange={(e) => setVendor((v) => ({ ...v, vendorAlias: e.target.value }))}
            placeholder="Enter alias (optional)"
          />
        </Field>

        <Field label="Payment Terms" required error={errors.paymentTerms}>
          <select
            className={errors.paymentTerms ? inputErrCls : inputCls}
            value={vendor.paymentTerms}
            onChange={(e) => setVendor((v) => ({ ...v, paymentTerms: e.target.value }))}
          >
            <option value="">Select payment term</option>
            {PAYMENT_TERMS.map((pt) => (
              <option key={pt.value} value={pt.value}>{pt.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Notes">
          <textarea
            className={`${inputCls} min-h-[70px]`} value={vendor.notes} maxLength={500}
            onChange={(e) => setVendor((v) => ({ ...v, notes: e.target.value }))}
            placeholder="Enter notes about this vendor (optional)"
          />
          <p className="text-right text-xs text-slate-400 tabular-nums">{vendor.notes.length} / 500</p>
        </Field>
      </div>

      {vendor.gst.isVerified && (
        <div className="mt-5 rounded-xl bg-indigo-50 px-5 py-4 ring-1 ring-inset ring-indigo-100">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-indigo-600">Auto fill (after GST verify)</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="flex items-start gap-2">
              <User className="mt-0.5 h-4 w-4 text-indigo-400" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-500">Legal Name</p>
                <p className="text-sm text-slate-800">{vendor.gst.legalName || "—"}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <FileText className="mt-0.5 h-4 w-4 text-indigo-400" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-500">Trade Name</p>
                <p className="text-sm text-slate-800">{vendor.gst.tradeName || "—"}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 text-indigo-400" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-500">GST Address</p>
                <p className="text-sm text-slate-800">{vendor.gst.gstAddress || "—"}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Landmark className="mt-0.5 h-4 w-4 text-indigo-400" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-500">State</p>
                <p className="text-sm text-slate-800">
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
/* Card 2 — Contact Details (LABEL TABS, one panel at a time)          */
/* FIX 1: PrimaryTag now passed as `trailing` into LabelTabs so it     */
/* renders at the end of the tabs row, next to "+ Other".              */
/* FIX 2: `title` added on text inputs so long values are viewable     */
/* on hover even though the input itself stays within its column.     */
/* ------------------------------------------------------------------ */

const ContactDetailsCard = ({ vendor, setVendor, errors }) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const contacts = vendor.contacts;
  const safeIdx = Math.min(activeIdx, contacts.length - 1);
  const contact = contacts[safeIdx];
  const e = errors.contacts?.[safeIdx] || {};

  const updateContact = (patch) =>
    setVendor((v) => {
      const next = [...v.contacts];
      next[safeIdx] = { ...next[safeIdx], ...patch };
      return { ...v, contacts: next };
    });

  const addContact = (label) => {
    setVendor((v) => ({ ...v, contacts: [...v.contacts, emptyContact(label)] }));
    setActiveIdx(contacts.length);
  };

  const removeContact = () => {
    setVendor((v) => ({ ...v, contacts: v.contacts.filter((_, i) => i !== safeIdx) }));
    setActiveIdx(0);
  };

  return (
    <CollapsibleCard index={2} title="Contact Details" subtitle="Add primary and other contact persons">
      <LabelTabs
        items={contacts} activeIdx={safeIdx} onSelect={setActiveIdx} onAdd={addContact}
        errorsByIdx={errors.contacts || []} suggestions={CONTACT_LABEL_SUGGESTIONS}
        trailing={
          contact?.label === "PRIMARY" ? (
            <PrimaryTag />
          ) : contact ? (
            <button
              type="button" onClick={removeContact}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 shadow-sm transition hover:border-rose-300 hover:bg-rose-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove {contact.label}
            </button>
          ) : null
        }
      />

      {contact && (
        <div className="rounded-xl border border-slate-200 p-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Contact Name" required error={e.name}>
              <input className={e.name ? inputErrCls : inputCls} value={contact.name} title={contact.name} onChange={(ev) => updateContact({ name: ev.target.value })} />
            </Field>
            <Field label="Email" required error={e.email}>
              <input type="email" className={e.email ? inputErrCls : inputCls} value={contact.email} title={contact.email} onChange={(ev) => updateContact({ email: ev.target.value })} />
            </Field>
            <Field label="Phone" required error={e.phone}>
              <input className={e.phone ? inputErrCls : inputCls} value={contact.phone} onChange={(ev) => updateContact({ phone: ev.target.value })} placeholder="10-digit number" />
            </Field>
            <Field label="Designation">
              <input className={inputCls} value={contact.designation} title={contact.designation} onChange={(ev) => updateContact({ designation: ev.target.value })} />
            </Field>
            <Field label="Department">
              <input className={inputCls} value={contact.department} title={contact.department} onChange={(ev) => updateContact({ department: ev.target.value })} />
            </Field>
            <Field label="Recipient Type" required>
              {/* Three-way, and emailing is opt-IN: most contacts on a vendor
                  are reference people who should not be mailed. PRIMARY is the
                  exception and defaults to To, so a new vendor can send its
                  first PO without an extra click.

                  To / CC / None are short and self-explanatory, so they sit on
                  one row: the field keeps the same height as its neighbours
                  instead of stretching the card by two extra lines. */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2">
                {[
                  { v: "TO", label: "To" },
                  { v: "CC", label: "CC" },
                  { v: "NONE", label: "None" },
                ].map((o) => (
                  <label key={o.v} className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
                    <input
                      type="radio"
                      name={`recipientType-${contact.label || "contact"}`}
                      checked={(contact.recipientType || "NONE") === o.v}
                      onChange={() => updateContact({ recipientType: o.v })}
                      className="h-4 w-4 accent-indigo-600"
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            </Field>
          </div>
        </div>
      )}
    </CollapsibleCard>
  );
};

/* ------------------------------------------------------------------ */
/* Card 3 — Address Information                                        */
/* Complete Address is a TEXTAREA (GST addresses are long).            */
/* "Use GST address" toggle: ON (auto after verify) ⇒ address + state  */
/* mirrored from GST and locked. OFF ⇒ both editable.                  */
/* ------------------------------------------------------------------ */

const AddressCard = ({ vendor, setVendor, errors, useGstAddress, setUseGstAddress, gstVerified }) => {
  const setAddress = (patch) => setVendor((v) => ({ ...v, address: { ...v.address, ...patch } }));

  const onToggle = (next) => {
    setUseGstAddress(next);
    if (next) {
      // re-sync from GST whenever the toggle is switched back on
      setAddress({
        fullAddress: vendor.gst.gstAddress || "",
        state: vendor.gst.state || { key: "", name: "", code: "" },
      });
    }
  };

  const locked = gstVerified && useGstAddress;

  return (
    <CollapsibleCard
      index={3}
      title="Address Information"
      subtitle="Enter complete address of the vendor"
      action={
        gstVerified ? (
          <Toggle checked={useGstAddress} onChange={onToggle} label="Use GST address" />
        ) : (
          <span className="text-xs text-slate-400">Verify GST to auto-fill the address</span>
        )
      }
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="sm:col-span-3">
          <Field
            label="Complete Address" required locked={locked} error={errors.fullAddress}
            hint={locked ? "Coming from the verified GST record — switch the toggle off to edit" : "Building, street, landmark — the full postal address"}
          >
            <textarea
              rows={3}
              className={`${locked ? lockedCls : errors.fullAddress ? inputErrCls : inputCls} min-h-[80px] resize-y`}
              readOnly={locked}
              value={vendor.address.fullAddress}
              onChange={(e) => setAddress({ fullAddress: e.target.value })}
              placeholder="383, IMT, Phase-2, Sector-3, Bawal"
            />
          </Field>
        </div>

        <Field label="Area / Locality" error={errors.area}>
          <input className={errors.area ? inputErrCls : inputCls} value={vendor.address.area} onChange={(e) => setAddress({ area: e.target.value })} />
        </Field>
        <Field label="City" required error={errors.city}>
          <input className={errors.city ? inputErrCls : inputCls} value={vendor.address.city} onChange={(e) => setAddress({ city: e.target.value })} />
        </Field>
        <Field label="PIN Code" required error={errors.pinCode}>
          <input
            className={errors.pinCode ? inputErrCls : inputCls}
            value={vendor.address.pinCode}
            onChange={(e) => setAddress({ pinCode: e.target.value.replace(/\D/g, "") })}
            maxLength={6}
          />
        </Field>

        <div className="sm:col-span-2">
          <Field label="State" required locked={locked} error={errors.addressState}>
            <StateSelect
              value={vendor.address.state} locked={locked} error={Boolean(errors.addressState)}
              onChange={(state) => setAddress({ state })}
            />
          </Field>
        </div>
        <Field label="State Code">
          <StateCodeReadOnly code={vendor.address.state?.code} />
        </Field>
      </div>
    </CollapsibleCard>
  );
};



const AssignProductsCard = ({ vendor, setVendor }) => {
  const [search, setSearch] = useState("");
  const [allCategories, setAllCategories] = useState([]);
  const [searching, setSearching] = useState(true);
  const [productsByCategory, setProductsByCategory] = useState({});
  const [selectedCategory, setSelectedCategory] = useState(null);

  // hasProducts=true ⇒ a category with zero products can never show up here.
  // Fetched once, then searched client-side against the full breadcrumb path
  // (the server's `search` param only matches the leaf name).
  useEffect(() => {
    (async () => {
      setSearching(true);
      try {
        setAllCategories(await fetchAllLeafCategories({ hasProducts: true }));
      } catch {
        setAllCategories([]);
      } finally {
        setSearching(false);
      }
    })();
  }, []);

  const leafOptions = search
    ? allCategories
        .filter((c) => (c.displayPath || c.name || "").toLowerCase().includes(search.toLowerCase()))
        .slice(0, 30)
    : [];

  const loadProductsForCategory = useCallback(
    async (categoryId) => {
      if (productsByCategory[categoryId]) return productsByCategory[categoryId];
      try {
        const res = await fetch(`${API_BACKEND_URL}/stock/product-definitions/by-category/${categoryId}`, { credentials: "include" });
        const json = await res.json();
        const list = json.success ? json.data || [] : [];
        setProductsByCategory((prev) => ({ ...prev, [categoryId]: list }));
        return list;
      } catch {
        setProductsByCategory((prev) => ({ ...prev, [categoryId]: [] }));
        return [];
      }
    },
    [productsByCategory]
  );

  // EDIT-MODE FIX (kept): assignedProducts arrives pre-filled from
  // GET /vendors/:id, so fetch products for any category not yet loaded.
  // Only the SAVED products stay checked — no auto-check on edit.
  useEffect(() => {
    vendor.assignedProducts.forEach((ap) => {
      if (ap.categoryId && !productsByCategory[ap.categoryId]) loadProductsForCategory(ap.categoryId);
    });
  }, [vendor.assignedProducts, productsByCategory, loadProductsForCategory]);

  const addSelectedCategory = async () => {
    if (!selectedCategory) return;
    const exists = vendor.assignedProducts.some((ap) => ap.categoryId === selectedCategory._id);
    if (!exists) {
      // Fetch FIRST, then seed products with all of them → every checkbox
      // lands pre-ticked, each defaulted to the product's own warranty.
      // (Seeding [] and ticking afterwards would race with the fetch and
      // leave the category empty.)
      const list = await loadProductsForCategory(selectedCategory._id);
      setVendor((v) => ({
        ...v,
        assignedProducts: [
          ...v.assignedProducts,
          {
            categoryId: selectedCategory._id,
            categoryName: selectedCategory.displayPath || selectedCategory.name,
            products: list.map((p) => ({
              productId: p._id,
              overrides: { warrantyYears: p.warrantyYears ?? null },
            })),
          },
        ],
      }));
    }
    setSelectedCategory(null);
    setSearch("");
  };

  const removeCategory = (categoryId) =>
    setVendor((v) => ({ ...v, assignedProducts: v.assignedProducts.filter((ap) => ap.categoryId !== categoryId) }));

  const toggleProduct = (categoryId, productId) =>
    setVendor((v) => ({
      ...v,
      assignedProducts: v.assignedProducts.map((ap) => {
        if (ap.categoryId !== categoryId) return ap;
        const has = ap.products.some((p) => p.productId === productId);
        if (has) {
          return { ...ap, products: ap.products.filter((p) => p.productId !== productId) };
        }
        const product = (productsByCategory[categoryId] || []).find((p) => p._id === productId);
        return {
          ...ap,
          products: [
            ...ap.products,
            { productId, overrides: { warrantyYears: product?.warrantyYears ?? null } },
          ],
        };
      }),
    }));

  const updateProductWarranty = (categoryId, productId, warrantyYears) =>
    setVendor((v) => ({
      ...v,
      assignedProducts: v.assignedProducts.map((ap) => {
        if (ap.categoryId !== categoryId) return ap;
        return {
          ...ap,
          products: ap.products.map((p) =>
            p.productId === productId ? { ...p, overrides: { warrantyYears } } : p
          ),
        };
      }),
    }));

  // select-all / clear-all within one category
  const toggleAll = (categoryId) =>
    setVendor((v) => ({
      ...v,
      assignedProducts: v.assignedProducts.map((ap) => {
        if (ap.categoryId !== categoryId) return ap;
        const all = productsByCategory[categoryId] || [];
        const allChecked =
          all.length > 0 && all.every((p) => ap.products.some((sel) => sel.productId === p._id));
        return {
          ...ap,
          products: allChecked
            ? []
            : all.map((p) => ({ productId: p._id, overrides: { warrantyYears: p.warrantyYears ?? null } })),
        };
      }),
    }));

  return (
    <CollapsibleCard index={4} title="Assign Products" subtitle="Select categories and products supplied by this vendor">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className={`${inputCls} pl-9`}
            placeholder="Select last category "
            value={selectedCategory ? (selectedCategory.displayPath || selectedCategory.name) : search}
            onChange={(e) => { setSelectedCategory(null); setSearch(e.target.value); }}
          />
          {search && !selectedCategory && (leafOptions.length > 0 || searching) && (
            <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg ring-1 ring-slate-900/5">
              {searching ? (
                <div className="px-3 py-2 text-sm text-slate-400">Searching...</div>
              ) : (
                leafOptions.map((cat) => (
                  <button
                    key={cat._id}
                    type="button" onClick={() => setSelectedCategory(cat)}
                    className="block w-full truncate px-3 py-2 text-left text-sm text-slate-800 transition hover:bg-indigo-50/60"
                  >
                    {cat.displayPath || cat.name}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <button
          type="button" onClick={addSelectedCategory} disabled={!selectedCategory}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-600 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Add Category
        </button>
      </div>

      {vendor.assignedProducts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
          No categories assigned yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {vendor.assignedProducts.map((ap) => {
            const list = productsByCategory[ap.categoryId];
            const allChecked =
              list && list.length > 0 && list.every((p) => ap.products.some((sel) => sel.productId === p._id));
            return (
              <div key={ap.categoryId} className="rounded-xl border border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-sm font-bold text-slate-900">
                    {ap.categoryName}
                    {/* <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                      LEAF
                    </span> */}
                  </span>
                  <div className="flex items-center gap-3">
                    {list && list.length > 0 && (
                      <button
                        type="button" onClick={() => toggleAll(ap.categoryId)}
                        className="text-xs font-semibold text-indigo-600 transition hover:text-indigo-700"
                      >
                        {allChecked ? "Clear all" : "Select all"}
                      </button>
                    )}
                    <button
                      type="button" onClick={() => removeCategory(ap.categoryId)}
                      className="text-xs font-semibold text-rose-600 transition hover:text-rose-700"
                    >
                      <LucideDelete/>
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(list || []).map((product) => {
                    const sel = ap.products.find((p) => p.productId === product._id);
                    const checked = Boolean(sel);
                    return (
                      <div key={product._id} className="rounded-lg px-1 py-1.5 text-sm text-slate-700">
                        <label className="flex min-w-0 cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleProduct(ap.categoryId, product._id)}
                            className="h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="min-w-0 truncate">
                            {product.name}
                            <span className="ml-1 text-xs text-slate-400">
                              (Default Warranty: {product.warrantyYears ?? "—"} {product.warrantyYears === 1 ? "Year" : "Years"})
                            </span>
                          </span>
                        </label>
                        {checked && (
                          <div className="mt-1.5 flex items-center gap-2 pl-6">
                            <label htmlFor={`vendor-warranty-${product._id}`} className="text-xs font-medium text-slate-600">
                              Warranty (Years):
                            </label>
                            <input
                              id={`vendor-warranty-${product._id}`}
                              type="number" min="1" step="1"
                              value={sel.overrides?.warrantyYears ?? ""}
                              onChange={(e) =>
                                updateProductWarranty(
                                  ap.categoryId,
                                  product._id,
                                  e.target.value === "" ? null : Number(e.target.value)
                                )
                              }
                              className="w-16 shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {!list && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                      <Loader2 className="h-3 w-3 animate-spin" /> Loading products...
                    </span>
                  )}
                  {list?.length === 0 && <span className="text-xs text-slate-400">No products in this category</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </CollapsibleCard>
  );
};

/* ------------------------------------------------------------------ */
/* Card 5 — Bank Details (LABEL TABS, same pattern as contacts)        */
/* FIX 1: PrimaryTag now passed as `trailing` into LabelTabs.          */
/* FIX 2: `title` added on text inputs for full-value hover + tighter  */
/* grid columns so long values (branch address, bank name) fit.        */
/* ------------------------------------------------------------------ */

const BankDetailsCard = ({ vendor, setVendor, errors }) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const banks = vendor.bankAccounts;
  const safeIdx = Math.min(activeIdx, banks.length - 1);
  const bank = banks[safeIdx];
  const e = errors.bankAccounts?.[safeIdx] || {};

  const updateBank = (patch) =>
    setVendor((v) => {
      const next = [...v.bankAccounts];
      next[safeIdx] = { ...next[safeIdx], ...patch };
      return { ...v, bankAccounts: next };
    });

  const addBank = (label) => {
    setVendor((v) => ({ ...v, bankAccounts: [...v.bankAccounts, emptyBankAccount(label)] }));
    setActiveIdx(banks.length);
  };

  const removeBank = () => {
    setVendor((v) => ({ ...v, bankAccounts: v.bankAccounts.filter((_, i) => i !== safeIdx) }));
    setActiveIdx(0);
  };

  return (
    <CollapsibleCard index={5} title="Bank Details" subtitle="Add bank account details for payments">
      <LabelTabs
        items={banks} activeIdx={safeIdx} onSelect={setActiveIdx} onAdd={addBank}
        errorsByIdx={errors.bankAccounts || []} suggestions={BANK_LABEL_SUGGESTIONS} addLabel="Other Account"
        trailing={
          bank?.label === "PRIMARY" ? (
            <PrimaryTag />
          ) : bank ? (
            <button
              type="button" onClick={removeBank}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 shadow-sm transition hover:border-rose-300 hover:bg-rose-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove {bank.label}
            </button>
          ) : null
        }
      />

      {bank && (
        <div className="rounded-xl border border-slate-200 p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="IFSC Code" required error={e.ifsc}>
              <input className={e.ifsc ? inputErrCls : inputCls} value={bank.ifsc} onChange={(ev) => updateBank({ ifsc: ev.target.value.toUpperCase() })} placeholder="HDFC0001234" maxLength={11} />
            </Field>
            <Field label="Bank Name" required error={e.bankName}>
              <input className={e.bankName ? inputErrCls : inputCls} value={bank.bankName} title={bank.bankName} onChange={(ev) => updateBank({ bankName: ev.target.value })} />
            </Field>
            <Field label="Branch" required error={e.branch}>
              <input className={e.branch ? inputErrCls : inputCls} value={bank.branch} title={bank.branch} onChange={(ev) => updateBank({ branch: ev.target.value })} />
            </Field>
            <Field label="Branch Address">
              <input className={inputCls} value={bank.branchAddress} title={bank.branchAddress} onChange={(ev) => updateBank({ branchAddress: ev.target.value })} />
            </Field>

            <Field label="State" required error={e.state}>
              <StateSelect value={bank.state} error={Boolean(e.state)} onChange={(state) => updateBank({ state })} />
            </Field>
            <Field label="State Code">
              <StateCodeReadOnly code={bank.state?.code} />
            </Field>
            <Field label="City" required error={e.city}>
              <input className={e.city ? inputErrCls : inputCls} value={bank.city} title={bank.city} onChange={(ev) => updateBank({ city: ev.target.value })} />
            </Field>
            <Field label="Account Number" required error={e.accountNumber}>
              <input
                className={e.accountNumber ? inputErrCls : inputCls}
                value={bank.accountNumber}
                onChange={(ev) => updateBank({ accountNumber: ev.target.value.replace(/\D/g, "") })}
                maxLength={18}
              />
            </Field>

            <Field label="RTGS Code">
              <input className={inputCls} value={bank.rtgsCode} onChange={(ev) => updateBank({ rtgsCode: ev.target.value.toUpperCase() })} />
            </Field>
            <Field label="NEFT Code">
              <input className={inputCls} value={bank.neftCode} onChange={(ev) => updateBank({ neftCode: ev.target.value.toUpperCase() })} />
            </Field>
          </div>
        </div>
      )}
    </CollapsibleCard>
  );
};

/* ------------------------------------------------------------------ */
/* Validation — returns { fieldErrors, messages, valid }               */
/* ------------------------------------------------------------------ */

const validateVendor = (vendor) => {
  const f = { contacts: [], bankAccounts: [] };
  const messages = [];
  const push = (msg) => messages.push(msg);

  if (!vendor.name.trim()) { f.name = "Company / vendor name is required"; push(f.name); }

  if (vendor.gst.isAvailable) {
    const g = vendor.gst.gstNumber.trim().toUpperCase();
    if (!g) { f.gstNumber = "GST number is required"; push(f.gstNumber); }
    else if (!RX.gstin.test(g)) { f.gstNumber = "Enter a valid 15-character GSTIN"; push(f.gstNumber); }
    if (!vendor.gst.state?.key) { f.gstState = "State is required"; push("Vendor state is required"); }
  }

  if (vendor.panNumber && !RX.pan.test(vendor.panNumber.toUpperCase())) {
    f.panNumber = "Enter a valid PAN (ABCDE1234F)";
    push(f.panNumber);
  }

  if (!vendor.paymentTerms) { f.paymentTerms = "Payment terms is required"; push(f.paymentTerms); }

  // contacts — PRIMARY must exist, and every tab that exists must be complete
  if (!vendor.contacts.some((c) => c.label === "PRIMARY")) push("A PRIMARY contact is required");

  vendor.contacts.forEach((c, i) => {
    const e = {};
    if (!c.name?.trim()) e.name = "Name is required";
    if (!c.email?.trim()) e.email = "Email is required";
    else if (!RX.email.test(c.email.trim())) e.email = "Enter a valid email";
    if (!c.phone?.trim()) e.phone = "Phone is required";
    else if (!RX.phone.test(digits(c.phone))) e.phone = "Enter a valid 10-digit phone";
    f.contacts[i] = e;
    if (Object.keys(e).length) push(`Contact "${c.label}" is incomplete or invalid`);
  });

  // address
  if (!vendor.address.fullAddress?.trim()) { f.fullAddress = "Complete address is required"; push(f.fullAddress); }
  if (!vendor.address.city?.trim()) { f.city = "City is required"; push(f.city); }
  if (!vendor.address.pinCode?.trim()) { f.pinCode = "PIN code is required"; push(f.pinCode); }
  else if (!RX.pin.test(vendor.address.pinCode.trim())) { f.pinCode = "Enter a valid 6-digit PIN code"; push(f.pinCode); }
  if (!vendor.address.state?.key) { f.addressState = "State is required"; push("Address state is required"); }

  // bank accounts — PRIMARY must exist, and every tab that exists must be complete
  if (!vendor.bankAccounts.some((b) => b.label === "PRIMARY")) push("A PRIMARY bank account is required");

  vendor.bankAccounts.forEach((b, i) => {
    const e = {};
    if (!b.ifsc?.trim()) e.ifsc = "IFSC is required";
    else if (!RX.ifsc.test(b.ifsc.trim().toUpperCase())) e.ifsc = "Enter a valid IFSC (HDFC0001234)";
    if (!b.bankName?.trim()) e.bankName = "Bank name is required";
    if (!b.branch?.trim()) e.branch = "Branch is required";
    if (!b.city?.trim()) e.city = "City is required";
    if (!b.state?.key) e.state = "State is required";
    if (!b.accountNumber?.trim()) e.accountNumber = "Account number is required";
    else if (!RX.account.test(b.accountNumber.trim())) e.accountNumber = "Account number must be 9–18 digits";
    f.bankAccounts[i] = e;
    if (Object.keys(e).length) push(`Bank account "${b.label}" is incomplete or invalid`);
  });

  // a category with every product unchecked is a mistake, not a valid state
  const emptyCat = vendor.assignedProducts.find((ap) => (ap.products || []).length === 0);
  if (emptyCat) push(`Select at least one product in "${emptyCat.categoryName}" or remove the category`);

  // every checked product needs a valid warranty override (min 1 year)
  const badWarranty = vendor.assignedProducts.some((ap) =>
    (ap.products || []).some(
      (p) => !p.overrides || !Number.isInteger(p.overrides.warrantyYears) || p.overrides.warrantyYears < 1
    )
  );
  if (badWarranty) push("Every assigned product needs a warranty of at least 1 year");

  const hasFieldError =
    Object.keys(f).some((k) => k !== "contacts" && k !== "bankAccounts" && f[k]) ||
    f.contacts.some((e) => Object.keys(e).length) ||
    f.bankAccounts.some((e) => Object.keys(e).length);

  return { fieldErrors: f, messages: [...new Set(messages)], valid: !hasFieldError && messages.length === 0 };
};

/* ------------------------------------------------------------------ */
/* Main form                                                            */
/* ------------------------------------------------------------------ */

const VendorForm = ({ vendorId = null }) => {
  const router = useRouter();
  const isEdit = Boolean(vendorId);

  const [vendor, setVendor] = useState(defaultVendor());
  const [useGstAddress, setUseGstAddress] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({ contacts: [], bankAccounts: [] });

  // GST verified ⇒ name / PAN / vendor state are owned by GST and locked
  const gstLocked = vendor.gst.isAvailable && vendor.gst.isVerified;

  const loadVendor = useCallback(async () => {
    if (!isEdit) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BACKEND_URL}/stock/vendors/${vendorId}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to load vendor");

      const data = json.data;
      const loaded = {
        ...defaultVendor(),
        ...data,
        gst: { ...defaultVendor().gst, ...data.gst },
        // populate gives categoryId as an object ({_id, name, type}) — flatten
        // to id + name so the Assign Products card renders immediately.
        // Soft-deleted categories populate as null → filtered out safely.
        assignedProducts: (data.assignedProducts || [])
          .filter((ap) => ap.categoryId)
          .map((ap) => ({
            categoryId: ap.categoryId?._id || ap.categoryId,
            categoryName: ap.categoryId?.name || ap.categoryName || "",
            products: (ap.products || []).map((p) => ({
              productId: p.productId?._id || p.productId,
              overrides: { warrantyYears: p.overrides?.warrantyYears ?? null },
            })),
          })),
      };
      setVendor(loaded);

      // If the saved address still matches the GST address, the vendor was
      // saved with "use GST address" ON — restore that toggle state.
      const gstAddr = (loaded.gst.gstAddress || "").trim();
      const addr = (loaded.address?.fullAddress || "").trim();
      setUseGstAddress(Boolean(loaded.gst.isVerified && gstAddr && gstAddr === addr));
    } catch (err) {
      setFormErrors([err.message]);
    } finally {
      setLoading(false);
    }
  }, [isEdit, vendorId]);

  useEffect(() => { loadVendor(); }, [loadVendor]);

  // called by BasicDetailsCard right after a successful GST verify:
  // turn the toggle ON and mirror the GST address + state into the Address card
  const handleGstVerified = ({ gstAddress, state }) => {
    setUseGstAddress(true);
    setVendor((v) => ({
      ...v,
      address: { ...v.address, fullAddress: gstAddress || "", state: state || v.address.state },
    }));
  };

  const handleSubmit = async () => {
    const { fieldErrors: fe, messages, valid } = validateVendor(vendor);
    setFieldErrors(fe);
    if (!valid) {
      setFormErrors(messages.length ? messages : ["Please fix the highlighted fields"]);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setFormErrors([]);
    setSaving(true);
    try {
      const payload = {
        ...vendor,
        panNumber: vendor.panNumber?.toUpperCase() || "",
        gst: { ...vendor.gst, gstNumber: vendor.gst.gstNumber?.toUpperCase() || "" },
        // strip the UI-only categoryName helper
        assignedProducts: vendor.assignedProducts.map((ap) => ({
          categoryId: ap.categoryId,
          products: ap.products.map((p) => ({
            productId: p.productId,
            overrides: { warrantyYears: p.overrides?.warrantyYears ?? null },
          })),
        })),
      };

      // E11000 FIX: never send an empty vendorCode. A stored ""/null collides
      // on the unique index the moment a second code-less vendor is saved —
      // the field must simply be ABSENT. (Schema side: no `default: null` +
      // a partialFilterExpression index. See stock.vendor.model.js.)
      if (!payload.vendorCode || !String(payload.vendorCode).trim()) delete payload.vendorCode;
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
      setFormErrors([err.message]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50/60 p-6">
        <div className="mx-auto max-w-5xl animate-pulse space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-40 rounded-2xl bg-slate-100" />)}
        </div>
      </div>
    );
  }

  const SaveBtn = ({ className }) => (
    <button
      type="button" onClick={handleSubmit} disabled={saving}
      className={`inline-flex items-center gap-2 rounded-lg bg-indigo-600 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      {saving ? "Saving..." : "Save Vendor"}
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50/60">
      <div className="mx-auto max-w-5xl p-6 pb-12">
        {/* header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
           <div>
            <button
              type="button" onClick={() => router.push("/stock/vendors")}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Vendors
            </button>
           </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              {isEdit ? "Edit Vendor Details" : "Create Vendor Details"}
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
            
            <SaveBtn className="px-4 py-2" />
          </div>
        </div>

        {formErrors.length > 0 && (
          <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="mb-1 inline-flex items-center gap-1.5 font-semibold">
                  <AlertCircle className="h-4 w-4" /> Please fix the following:
                </p>
                <ul className="ml-5 list-disc space-y-0.5">
                  {formErrors.map((m, i) => <li key={i}>{m}</li>)}
                </ul>
              </div>
              <button type="button" onClick={() => setFormErrors([])} className="shrink-0 text-rose-400 transition hover:text-rose-700">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <div className="space-y-6">
          <BasicDetailsCard
            vendor={vendor} setVendor={setVendor} errors={fieldErrors}
            gstLocked={gstLocked} onVerified={handleGstVerified}
          />
          <ContactDetailsCard vendor={vendor} setVendor={setVendor} errors={fieldErrors} />
          <AddressCard
            vendor={vendor} setVendor={setVendor} errors={fieldErrors}
            useGstAddress={useGstAddress} setUseGstAddress={setUseGstAddress} gstVerified={gstLocked}
          />
          <AssignProductsCard vendor={vendor} setVendor={setVendor} />
          <BankDetailsCard vendor={vendor} setVendor={setVendor} errors={fieldErrors} />
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button" onClick={() => router.push("/stock/vendors")}
            className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <SaveBtn className="px-5 py-2.5" />
        </div>
      </div>
    </div>
  );
};

export default VendorForm;