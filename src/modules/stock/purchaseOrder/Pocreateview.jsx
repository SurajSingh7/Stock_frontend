"use client";

import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import {
  ArrowLeft, Lock, Building2, FileText, Package, ScrollText, User, MapPin, CalendarDays, Truck, StickyNote, Info,
} from "lucide-react";
import { fetchPurchaseOrder, createPurchaseOrder, updatePurchaseOrder, resolveVendorTerms, fetchActiveTerms } from "./purchaseOrderApi";
import { unitLabel, Modal } from "@/modules/stock/shared/StockSharedUI";
import { usePermissions } from "@/context/PermissionContext";
import useInternalEntities from "@/modules/stock/shared/useInternalEntities";

const SHIPMENT_PREFERENCE_OPTIONS = [
  "Self Pickup", "Vendor Delivery", "Courier", "Transport", "Third-Party Logistics", "Hand Delivery",
];

// Terms & conditions are never typed here — they're auto-attached server-side
// from the Terms & Conditions master (vendor-specific match, else the single
// Default term) and are immutable once the PO is created. This view only
// renders whatever the API resolved. Defense-in-depth strip before
// dangerouslySetInnerHTML — the backend already sanitizes on save.
const sanitizeForPreview = (html) =>
  String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "");

/* =============================================================
   LOCK_CHECKBOX
   true  → every item is LOCKED on the PO (checkbox shown checked +
           disabled with a lock icon; no skip, no skip-reason input)
   false → original behavior (uncheck = permanent skip, reason required)
   ============================================================= */
const LOCK_CHECKBOX = true;

const money = (n) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const todayStr = () => {
  const d = new Date();
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/* ---------- shared class tokens ---------- */
const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition duration-200 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";
const labelCls = "mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500";
// A read-only value: bold, on a soft tinted box.
const valueCls = "flex min-h-[38px] items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900";

const fmtDate = (v) =>
  v ? new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "\u2014";

/* A white card with a tinted header: coloured icon tile, bold title, optional right side. */
/*
  A tax amount with a small ⓘ — the rate and how it was worked out open in a
  popup only when asked for, so the column stays a column of amounts.
*/
const TaxCell = ({ amount, rate, base, label, product }) => {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block">
      {/* The amount is centred under its heading; the ⓘ hangs just outside it
          (absolute), so it never pulls the amount off centre. */}
      {money(amount)}
      <button
        type="button" onClick={() => setOpen(true)}
        title={`${label} ${rate}% — how it was worked out`} aria-label={`${label} rate`}
        className="absolute left-full top-1/2 ml-0.5 -translate-y-1/2 rounded-full p-0.5 text-slate-300 transition hover:bg-indigo-50 hover:text-indigo-600"
      >
        <Info className="h-3 w-3" />
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)} title={`${label} · ${product}`} maxWidth="max-w-sm">
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 px-4 text-sm tabular-nums">
            <div className="flex justify-between py-2.5"><span className="text-slate-500">Basic price</span><span className="font-semibold text-slate-900">{money(base)}</span></div>
            <div className="flex justify-between py-2.5"><span className="text-slate-500">{label} rate</span><span className="font-semibold text-slate-900">{rate}%</span></div>
            <div className="flex justify-between py-2.5"><span className="font-semibold text-slate-700">{label} amount</span><span className="font-bold text-indigo-700">{money(amount)}</span></div>
          </div>
          <p className="mt-3 rounded-lg bg-indigo-50 px-3 py-2 text-center text-sm font-medium text-indigo-800 tabular-nums">
            {money(base)} × {rate}% = {money(amount)}
          </p>
        </Modal>
      )}
    </span>
  );
};

const Section = ({ icon: Icon, tone, title, right, children, className = "", flush = false }) => (
  <section className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
    <div className="flex items-center gap-2.5 border-b border-slate-100 bg-linear-to-r from-slate-50 to-white px-5 py-3.5">
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-white shadow-sm ${tone}`}>
        <Icon className="h-4 w-4" />
      </span>
      <p className="flex items-center text-sm font-extrabold uppercase tracking-wider text-slate-800">{title}</p>
      {right && <span className="ml-auto">{right}</span>}
    </div>
    {flush ? children : <div className="p-5">{children}</div>}
  </section>
);

const TERMS_SOURCE_META = {
  VENDOR: { label: "Vendor-specific term", cls: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
  DEFAULT: { label: "Default term", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  MANUAL: { label: "Manually selected", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  NONE: { label: "No term configured", cls: "bg-slate-100 text-slate-500 ring-slate-200" },
};

const POCreateView = ({ mode = "create", context = {}, onBack, onDone }) => {
  const isEdit = mode === "edit";
  const { sourceQuotationId, vendorId, vendorName, vendorStateCode, poId, buyerEntity: contextBuyerEntity } = context;

  // Entity/State is no longer chosen here — it's assigned once on the
  // Tracking Orders page and consumed here read-only (see Backend
  // createPurchaseOrder, which derives it server-side from the tracking
  // order rather than trusting anything sent from this form).
  const assignedEntity = contextBuyerEntity?.alias ? contextBuyerEntity : null;

  // The STATE may still be switched here, to another state record of the same
  // entity (own GST + address) — with a mandatory reason, because it decides
  // CGST+SGST vs IGST. The backend re-resolves the id and refuses another alias.
  const { entities } = useInternalEntities();
  const [pickedEntityId, setPickedEntityId] = useState("");
  const [stateReason, setStateReason] = useState("");
  const statesForAlias = assignedEntity ? entities.filter((e) => e.alias === assignedEntity.alias) : [];
  const assignedId = String(assignedEntity?.entityId || "");
  const canChangeState = !isEdit && statesForAlias.length > 1 && statesForAlias.some((e) => String(e._id) === assignedId);
  const picked = pickedEntityId && pickedEntityId !== assignedId
    ? statesForAlias.find((e) => String(e._id) === pickedEntityId) || null
    : null;
  const stateChanged = !!picked;
  const selectedEntity = picked
    ? { entityId: picked._id, alias: picked.alias, name: picked.name, state: picked.state, stateCode: picked.stateCode }
    : assignedEntity;

  // Requester is whoever is signed in — displayed here, but stamped by the
  // backend from the session, which is why nothing below ever sends it.
  // On an edit it shows the person who originally raised the PO instead.
  const { userData } = usePermissions();
  const signedInName = [userData?.firstName, userData?.lastName].filter(Boolean).join(" ");
  const [requester, setRequester] = useState("");
  const [poDate, setPoDate] = useState(todayStr());
  const [shipment, setShipment] = useState(SHIPMENT_PREFERENCE_OPTIONS[1]);
  // Read-only — resolved from the Terms & Conditions master API, never
  // client-editable (see sanitizeForPreview comment above).
  const [termsContent, setTermsContent] = useState("");
  const [termsSource, setTermsSource] = useState("NONE"); // "VENDOR" | "DEFAULT" | "NONE"
  // Manual fallback — only used (and only shown) when nothing auto-resolves.
  const [activeTerms, setActiveTerms] = useState([]);
  const [selectedTermsId, setSelectedTermsId] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState(
    (context.items || []).map((it) => ({ ...it, checked: true, reason: "" }))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const sameState = selectedEntity && String(selectedEntity.stateCode) === String(vendorStateCode);

  /* -----------------------------------------------------------
     DISPLAY-ONLY tax math (Section 20 #6 — the backend always
     recomputes the real totals server-side from the snapshot;
     this preview just mirrors that GST-split rule in the UI).
     taxType: same state  → CGST_SGST (gstRate split in half)
              diff state  → IGST      (full gstRate)
     ----------------------------------------------------------- */
  const taxType = selectedEntity ? (sameState ? "CGST_SGST" : "IGST") : null;

  const calc = (r) => {
    const base = Number(r.quantity || 0) * Number(r.unitPrice || 0);
    const gst = (base * Number(r.gstRate || 0)) / 100;
    return {
      base,
      gst,
      cgst: gst / 2,
      sgst: gst / 2,
      igst: gst,
      total: base + gst,
    };
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        if (isEdit) {
          const po = await fetchPurchaseOrder(poId);
          setRows(
            (po.items || []).map((it) => ({
              quotationItemId: it.quotationItemId, categoryName: it.categoryName, productName: it.productName,
              quantity: it.quantity, unitPrice: it.unitPrice, gstRate: it.gstRate, lineTotal: it.lineTotal,
              checked: true, reason: "",
            }))
          );
          setRequester(po.requester || "");
          if (po.poDate) setPoDate(new Date(po.poDate).toISOString().slice(0, 10));
          setShipment(po.shipmentPreference || SHIPMENT_PREFERENCE_OPTIONS[1]);
          // Already-resolved snapshot from when this PO was created — never re-resolved on edit.
          setTermsContent(po.terms || "");
          setTermsSource(po.termsSource || "NONE");
          setNotes(po.notes || "");
        } else {
          // Auto-pick terms for this vendor: vendor-specific match, else the
          // single Default term. Read-only — see resolveForVendor on the backend.
          let resolvedSource = "NONE";
          try {
            const resolved = await resolveVendorTerms(vendorId);
            setTermsContent(resolved?.term?.termsContent || "");
            resolvedSource = resolved?.source || "NONE";
            setTermsSource(resolvedSource);
          } catch {
            // non-fatal — PO creation still works with empty terms
          }

          // Nothing auto-resolved (no vendor-specific term, no Default term
          // configured) — Terms & Conditions is mandatory, so the user must
          // pick one by hand from the active templates.
          if (resolvedSource === "NONE") {
            try {
              setActiveTerms(await fetchActiveTerms());
            } catch {
              // non-fatal — the dropdown just stays empty; submit remains blocked
            }
          }
        }
      } catch (err) {
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [isEdit, poId, vendorId, vendorStateCode]);

  // when LOCK_CHECKBOX is on, items can never be toggled off
  const toggle = (id) => {
    if (LOCK_CHECKBOX) return;
    setRows((p) => p.map((r) => (String(r.quotationItemId) === String(id) ? { ...r, checked: !r.checked } : r)));
  };
  const setReason = (id, val) => setRows((p) => p.map((r) => (String(r.quotationItemId) === String(id) ? { ...r, reason: val } : r)));

  const checked = rows.filter((r) => r.checked);
  const unchecked = rows.filter((r) => !r.checked);

  // order summary (checked items only) — display-only preview
  const summary = checked.reduce(
    (acc, r) => {
      const c = calc(r);
      acc.base += c.base; acc.cgst += c.cgst; acc.sgst += c.sgst; acc.igst += c.igst; acc.total += c.total;
      return acc;
    },
    { base: 0, cgst: 0, sgst: 0, igst: 0, total: 0 }
  );

  const submit = async () => {
    if (!selectedEntity) return toast.error("No entity assigned yet — add one in Tracking Orders first");
    if (!isEdit) {
      if (stateChanged && !stateReason.trim()) return toast.error("Give a reason for changing the state");
      if (checked.length === 0) return toast.error("Select at least one item for the PO");
      if (unchecked.some((r) => !r.reason.trim())) return toast.error("Give a reason for every unchecked (skipped) item");
      if (termsSource === "NONE" && !selectedTermsId) return toast.error("Terms & Conditions is required.");
    }
    setSaving(true);
    try {
      if (isEdit) {
        // terms/buyerEntity/requester are immutable after create — never sent from here.
        await updatePurchaseOrder(poId, { poDate, shipmentPreference: shipment, notes });
        toast.success("PO saved and regenerated");
      } else {
        await createPurchaseOrder({
          sourceQuotationId, vendorId,
          quotationItemIds: checked.map((r) => r.quotationItemId),
          skippedItems: unchecked.map((r) => ({ itemId: r.quotationItemId, reason: r.reason.trim() })),
          // requester is stamped server-side from the session, not sent.
          poDate, shipmentPreference: shipment, notes,
          termsConditionId: selectedTermsId || undefined,
          ...(stateChanged ? { buyerEntityId: String(picked._id), stateChangeReason: stateReason.trim() } : {}),
        });
        toast.success(`PO generated for ${vendorName || "the vendor"}`);
      }
      onDone();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 p-6">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  const termsMeta = TERMS_SOURCE_META[termsSource] || TERMS_SOURCE_META.NONE;

  return (
    <div className="mx-auto max-w-7xl p-6 pb-12">
      {/* header */}
      {/* Back on the left, title centred, status on the right */}
      <div className="mb-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <button
          type="button" onClick={onBack}
          className="inline-flex w-fit items-center gap-1.5 justify-self-start rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition duration-200 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex min-w-0 flex-col items-center text-center">
          <h1 className="flex items-center gap-2.5 text-xl font-extrabold tracking-tight text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-200">
              <FileText className="h-4 w-4" />
            </span>
            {isEdit ? "Edit purchase order" : "Create purchase order"}
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-slate-500">
            Supplier
            <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-bold text-violet-700 ring-1 ring-inset ring-violet-200">
              {vendorName || "—"}
            </span>
          </p>
        </div>
        <span className={`inline-flex w-fit items-center gap-1.5 justify-self-end rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${
          isEdit ? "bg-rose-50 text-rose-700 ring-rose-200" : "bg-amber-50 text-amber-700 ring-amber-200"
        }`}>
          <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${isEdit ? "bg-rose-500" : "bg-amber-500"}`} />
          {isEdit ? "Rejected · editing" : "PO creation pending"}
        </span>
      </div>

      {/* buyer entity — read-only: assigned once on Tracking Orders */}
      <Section
        icon={Building2} tone="bg-emerald-500" title="Buyer entity"
        right={<span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-500 ring-1 ring-inset ring-slate-200">{canChangeState ? "Entity set in Tracking Orders · state can be changed" : "Set in Tracking Orders"}</span>}
      >
        {/* row 1 — who: requester, entity, state */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelCls}><User className="h-3.5 w-3.5 text-emerald-500" /> Requester</label>
            <p className={valueCls}>{(isEdit ? requester : signedInName) || "—"}</p>
          </div>
          {selectedEntity ? (
            <>
              <div>
                <label className={labelCls}><Building2 className="h-3.5 w-3.5 text-emerald-500" /> Entity</label>
                <p className={valueCls}>{selectedEntity.alias}</p>
              </div>
              <div>
                <label className={`${labelCls} justify-between`}>
                  <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-emerald-500" /> State</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold normal-case tracking-normal ring-1 ring-inset ${
                    sameState ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-indigo-50 text-indigo-700 ring-indigo-200"
                  }`}>
                    {sameState ? "CGST + SGST" : "IGST"}
                  </span>
                </label>
                {canChangeState ? (
                  <select
                    value={picked ? String(picked._id) : assignedId}
                    onChange={(e) => setPickedEntityId(e.target.value)}
                    className={`${inputCls} font-semibold ${stateChanged ? "border-amber-300 bg-amber-50/40" : ""}`}
                  >
                    {statesForAlias.map((e) => (
                      <option key={e._id} value={String(e._id)}>
                        {e.state} - {e.stateCode}{String(e._id) === assignedId ? "  (assigned)" : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className={valueCls}>{selectedEntity.state} - {selectedEntity.stateCode}</p>
                )}
              </div>
            </>
          ) : (
            <p className="rounded-xl border border-dashed border-amber-200 bg-amber-50/60 px-3 py-2.5 text-sm font-medium text-amber-700 sm:col-span-2">
              No entity assigned yet — add one on the Tracking Orders page before creating this PO.
            </p>
          )}
        </div>

        {stateChanged && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3.5">
            <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-amber-800">
              State changed:
              <span className="rounded-md bg-white px-2 py-0.5 text-xs font-bold text-slate-600 line-through ring-1 ring-inset ring-amber-200">
                {assignedEntity.state} ({assignedEntity.stateCode})
              </span>
              →
              <span className="rounded-md bg-white px-2 py-0.5 text-xs font-bold text-amber-800 ring-1 ring-inset ring-amber-300">
                {picked.state} ({picked.stateCode})
              </span>
              <button type="button" onClick={() => { setPickedEntityId(""); setStateReason(""); }} className="ml-auto text-xs font-semibold text-amber-700 underline hover:text-amber-900">
                Undo
              </button>
            </p>
            <label className={`${labelCls} mt-3`}>Reason for state change <span className="text-rose-500">*</span></label>
            <textarea
              value={stateReason} onChange={(e) => setStateReason(e.target.value)} rows={2} maxLength={500}
              placeholder="Why is this PO raised in a different state?"
              className={`${inputCls} resize-none`}
            />
          </div>
        )}

        {/* row 2 — when and how: PO date, shipment, notes */}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelCls}><CalendarDays className="h-3.5 w-3.5 text-sky-500" /> PO date</label>
            {isEdit ? (
              <input type="date" value={poDate} onChange={(e) => setPoDate(e.target.value)} className={inputCls} />
            ) : (
              <p className={valueCls}>{fmtDate(poDate)}</p>
            )}
          </div>
          <div>
            <label className={labelCls}><Truck className="h-3.5 w-3.5 text-sky-500" /> Shipment preference</label>
            <select value={shipment} onChange={(e) => setShipment(e.target.value)} className={`${inputCls} font-semibold`}>
              {SHIPMENT_PREFERENCE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}><StickyNote className="h-3.5 w-3.5 text-sky-500" /> Notes <span className="font-medium normal-case tracking-normal text-slate-400">(optional)</span></label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} placeholder="Optional" />
          </div>
        </div>
      </Section>

      {/* items */}
      <Section
        className="mt-5" flush
        icon={Package} tone="bg-indigo-500"
        title={<>Items <span className="ml-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-700">{rows.length}</span></>}
        right={
          LOCK_CHECKBOX ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-500 ring-1 ring-inset ring-slate-200">
              <Lock className="h-3 w-3" /> All items locked on this PO
            </span>
          ) : (
            !isEdit && (
              <span className="text-xs text-slate-500">
                <span className="font-semibold text-slate-700 tabular-nums">{checked.length}</span> selected · unchecked = skipped
              </span>
            )
          )
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-indigo-100 bg-indigo-50/50 text-left text-xs font-bold uppercase tracking-wide text-indigo-900/70">
                {!isEdit && <th className="w-10 px-4 py-3"></th>}
                <th className="w-12 px-4 py-3 text-center">Sr.</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Product</th>
                <th className="w-28 whitespace-nowrap px-4 py-3 text-center">Quantity</th>
                <th className="w-28 whitespace-nowrap px-4 py-3 text-center">Unit Price</th>
                <th className="w-28 whitespace-nowrap px-4 py-3 text-center">Basic Price</th>
                {taxType === "CGST_SGST" ? (
                  <>
                    <th className="w-28 whitespace-nowrap px-4 py-3 text-center">CGST</th>
                    <th className="w-28 whitespace-nowrap px-4 py-3 text-center">SGST</th>
                  </>
                ) : (
                  <th className="w-28 whitespace-nowrap px-4 py-3 text-center">{taxType === "IGST" ? "IGST" : "GST"}</th>
                )}
                <th className="w-28 whitespace-nowrap px-4 py-3 text-center">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, idx) => {
                const c = calc(r);
                const skipped = !isEdit && !r.checked;
                return (
                  <React.Fragment key={String(r.quotationItemId)}>
                    <tr className={`transition duration-200 hover:bg-indigo-50/30 ${skipped ? "bg-slate-50/60" : ""}`}>
                      {!isEdit && (
                        <td className="px-4 py-3.5 align-top">
                          <span className="inline-flex items-center gap-1">
                            <input
                              type="checkbox" checked={r.checked} onChange={() => toggle(r.quotationItemId)}
                              disabled={LOCK_CHECKBOX}
                              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-70"
                            />
                            {LOCK_CHECKBOX && <span className="text-slate-400" title="Locked — this item cannot be removed"><Lock className="h-3.5 w-3.5" /></span>}
                          </span>
                        </td>
                      )}
                      <td className="px-4 py-3.5 align-top">
                        <span className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 tabular-nums">{idx + 1}</span>
                      </td>
                      <td className={`px-4 py-3.5 align-top font-medium ${skipped ? "text-slate-400 line-through" : "text-slate-600"}`}>{r.categoryName}</td>
                      <td className={`px-4 py-3.5 align-top font-bold ${skipped ? "text-slate-400 line-through" : "text-slate-900"}`}>{r.productName}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-center align-top font-semibold tabular-nums text-slate-800">
                        {/* "10 Meter" on one line, centred under a centred QTY heading */}
                        {r.quantity} <span className="text-xs font-medium text-slate-400">{unitLabel(r.unit)}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-center align-top tabular-nums text-slate-700">{money(r.unitPrice)}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-center align-top tabular-nums text-slate-700">{money(c.base)}</td>
                      {taxType === "CGST_SGST" ? (
                        <>
                          <td className="whitespace-nowrap px-4 py-3.5 text-center align-top tabular-nums text-slate-700">
                            <TaxCell amount={c.cgst} rate={Number(r.gstRate || 0) / 2} base={c.base} label="CGST" product={r.productName} />
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-center align-top tabular-nums text-slate-700">
                            <TaxCell amount={c.sgst} rate={Number(r.gstRate || 0) / 2} base={c.base} label="SGST" product={r.productName} />
                          </td>
                        </>
                      ) : (
                        <td className="whitespace-nowrap px-4 py-3.5 text-center align-top tabular-nums text-slate-700">
                          <TaxCell amount={taxType === "IGST" ? c.igst : c.gst} rate={Number(r.gstRate || 0)} base={c.base} label={taxType === "IGST" ? "IGST" : "GST"} product={r.productName} />
                        </td>
                      )}
                      <td className="whitespace-nowrap px-4 py-3.5 text-center align-top font-extrabold tabular-nums text-slate-900">{money(c.total)}</td>
                    </tr>
                    {!LOCK_CHECKBOX && !isEdit && !r.checked && (
                      <tr>
                        <td colSpan={10} className="px-4 pb-3">
                          <input
                            value={r.reason} onChange={(e) => setReason(r.quotationItemId, e.target.value)}
                            placeholder="Reason for skipping (required)"
                            className="w-full rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-rose-300 transition duration-200 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* order summary — checked items only (display-only preview) */}
        <div className="border-t border-slate-200 px-5 py-4">
          <dl className="ml-auto w-full max-w-xs text-sm tabular-nums">
            <div className="flex justify-between py-1">
              <dt className="text-slate-500">Basic Price</dt>
              <dd className="font-semibold text-slate-800">{money(summary.base)}</dd>
            </div>
            {taxType === "CGST_SGST" ? (
              <>
                <div className="flex justify-between py-1">
                  <dt className="text-slate-500">CGST</dt>
                  <dd className="font-semibold text-slate-800">{money(summary.cgst)}</dd>
                </div>
                <div className="flex justify-between py-1">
                  <dt className="text-slate-500">SGST</dt>
                  <dd className="font-semibold text-slate-800">{money(summary.sgst)}</dd>
                </div>
              </>
            ) : (
              <div className="flex justify-between py-1">
                <dt className="text-slate-500">IGST</dt>
                <dd className="font-semibold text-slate-800">{money(summary.igst)}</dd>
              </div>
            )}
            <div className="mt-2 flex items-baseline justify-between border-t border-slate-200 pt-3">
              <dt className="font-bold text-slate-900">Grand total</dt>
              <dd className="text-xl font-extrabold text-indigo-700">{money(summary.total)}</dd>
            </div>
          </dl>
        </div>
      </Section>

      {/* terms */}
      <Section
        className="mt-5"
        icon={ScrollText} tone="bg-violet-500" title="Terms & conditions"
        right={
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ${termsMeta.cls}`}>
            {termsMeta.label}
            {!isEdit && termsSource === "NONE" && <span className="ml-0.5 text-rose-500">*</span>}
          </span>
        }
      >
        {!isEdit && termsSource === "NONE" ? (
          <>
            {/* No vendor-specific or Default term exists — Terms & Conditions
                is mandatory, so a template must be picked by hand. */}
            <select
              value={selectedTermsId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedTermsId(id);
                const picked = activeTerms.find((t) => String(t._id) === id);
                setTermsContent(picked?.termsContent || "");
                setTermsSource(picked ? "MANUAL" : "NONE");
              }}
              className={inputCls}
            >
              <option value="">Select a Terms &amp; Conditions template&hellip;</option>
              {activeTerms.map((t) => (
                <option key={t._id} value={t._id}>{t.termName}</option>
              ))}
            </select>
            {activeTerms.length === 0 && (
              <p className="mt-1.5 text-xs font-medium text-rose-500">
                No active Terms &amp; Conditions templates exist. Configure one in Master &rarr; Terms &amp; Conditions before generating this PO.
              </p>
            )}
          </>
        ) : null}

        {/* Read-only preview — auto-attached (or, when nothing resolved, the
            manually selected template above) — never typed here. */}
        {termsContent ? (
          <div
            className="mt-2 max-h-60 overflow-y-auto rounded-xl border border-violet-100 bg-violet-50/30 px-4 py-3 text-sm leading-relaxed text-slate-700 [&_a]:text-indigo-600 [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: sanitizeForPreview(termsContent) }}
          />
        ) : (isEdit || termsSource !== "NONE") ? (
          <p className="mt-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-slate-400">
            No applicable or default Terms &amp; Conditions found. Configure one in Master &rarr; Terms &amp; Conditions.
          </p>
        ) : null}
      </Section>

      {/* footer actions */}
      <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-slate-200 pt-5">
        <button
          type="button" onClick={onBack}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition duration-200 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
        >
          Cancel
        </button>
        <button
          type="button" onClick={submit} disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-linear-to-r from-indigo-600 to-violet-600 px-6 py-2 text-sm font-bold text-white shadow-md shadow-indigo-200 transition duration-200 hover:from-indigo-500 hover:to-violet-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FileText className="h-4 w-4" />
          {saving ? "Working…" : isEdit ? "Save & regenerate" : "Generate PO"}
        </button>
      </div>
    </div>
  );
};

export default POCreateView;
