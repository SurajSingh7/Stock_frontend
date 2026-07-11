"use client";

import React, { useState, useEffect } from "react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";

const INTERNAL_COMPANIES_URL =
  "https://gist.githubusercontent.com/SurajSingh7/ac8ffea18746e9fea058db22054bd3f3/raw/internal-companies.json";
const SHIPMENT_PREFERENCE_OPTIONS = [
  "Self Pickup", "Vendor Delivery", "Courier", "Transport", "Third-Party Logistics", "Hand Delivery",
];
const DEFAULT_TERMS =
  "1. Goods once sold will not be taken back.\n2. Delivery within the committed date.\n3. Payment as per agreed terms.";

const money = (n) => `\u20B9${Number(n || 0).toLocaleString("en-IN")}`;
const leafOf = (c) => String(c || "").split("/").pop().trim();
const todayStr = () => {
  const d = new Date();
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const inputCls = "w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500";

const POCreateView = ({ mode = "create", context = {}, onBack, onDone }) => {
  const isEdit = mode === "edit";
  const { sourceQuotationId, vendorId, vendorName, vendorStateCode, poId } = context;

  const [entities, setEntities] = useState([]);
  const [alias, setAlias] = useState("");
  const [entityId, setEntityId] = useState(""); // resolved alias+state record
  const [requester, setRequester] = useState("Suraj");
  const [poDate, setPoDate] = useState(todayStr());
  const [shipment, setShipment] = useState(SHIPMENT_PREFERENCE_OPTIONS[1]);
  const [terms, setTerms] = useState(DEFAULT_TERMS);
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState(
    (context.items || []).map((it) => ({ ...it, checked: true, reason: "" }))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [openPath, setOpenPath] = useState(null);

  // distinct parent aliases
  const aliases = [...new Set(entities.map((e) => e.alias).filter(Boolean))];
  // states available for the chosen alias
  const statesForAlias = entities.filter((e) => e.alias === alias);
  const selectedEntity = entities.find((e) => String(e._id) === String(entityId)) || null;
  const sameState = selectedEntity && String(selectedEntity.stateCode) === String(vendorStateCode);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(INTERNAL_COMPANIES_URL);
        const json = await res.json();
        const list = (json.data || []).filter((e) => e.isActive !== false && e.isShownOnDropDown !== false);
        setEntities(list);

        if (isEdit) {
          const poRes = await fetch(`${API_BACKEND_URL}/stock/purchase-orders/${poId}`, { credentials: "include" });
          const poJson = await poRes.json();
          const po = poJson.data;
          setRows(
            (po.items || []).map((it) => ({
              quotationItemId: it.quotationItemId, categoryName: it.categoryName, productName: it.productName,
              quantity: it.quantity, unitPrice: it.unitPrice, gstRate: it.gstRate, lineTotal: it.lineTotal,
              checked: true, reason: "",
            }))
          );
          setRequester(po.requester || "Suraj");
          if (po.poDate) setPoDate(new Date(po.poDate).toISOString().slice(0, 10));
          setShipment(po.shipmentPreference || SHIPMENT_PREFERENCE_OPTIONS[1]);
          setTerms(po.terms || DEFAULT_TERMS);
          setNotes(po.notes || "");
          const match =
            list.find((e) => String(e._id) === String(po.buyerEntity?.entityId)) ||
            list.find((e) => e.alias === po.buyerEntity?.alias && String(e.stateCode) === String(po.buyerEntity?.stateCode));
          if (match) { setAlias(match.alias); setEntityId(String(match._id)); }
        } else {
          // default: match vendor state → its alias + that state record
          const match = list.find((e) => String(e.stateCode) === String(vendorStateCode)) || list[0];
          if (match) { setAlias(match.alias); setEntityId(String(match._id)); }
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [isEdit, poId, vendorStateCode]);

  // when alias changes, snap state to vendor-state match within that alias, else first
  const onAliasChange = (a) => {
    setAlias(a);
    const list = entities.filter((e) => e.alias === a);
    const match = list.find((e) => String(e.stateCode) === String(vendorStateCode)) || list[0];
    setEntityId(match ? String(match._id) : "");
  };

  const toggle = (id) => setRows((p) => p.map((r) => (String(r.quotationItemId) === String(id) ? { ...r, checked: !r.checked } : r)));
  const setReason = (id, val) => setRows((p) => p.map((r) => (String(r.quotationItemId) === String(id) ? { ...r, reason: val } : r)));

  const checked = rows.filter((r) => r.checked);
  const unchecked = rows.filter((r) => !r.checked);

  const entityPayload = () =>
    selectedEntity
      ? {
          entityId: selectedEntity._id, name: selectedEntity.name, alias: selectedEntity.alias,
          gstNumber: selectedEntity.gstNumber, address: selectedEntity.address,
          state: selectedEntity.state, stateCode: selectedEntity.stateCode,
        }
      : null;

  const submit = async () => {
    if (!selectedEntity) return setError("Select entity and state");
    if (!isEdit) {
      if (checked.length === 0) return setError("Select at least one item for the PO");
      if (unchecked.some((r) => !r.reason.trim())) return setError("Give a reason for every unchecked (skipped) item");
    }
    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        const res = await fetch(`${API_BACKEND_URL}/stock/purchase-orders/${poId}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
          body: JSON.stringify({ buyerEntity: entityPayload(), requester, poDate, shipmentPreference: shipment, terms, notes }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message || "Failed to update PO");
      } else {
        const res = await fetch(`${API_BACKEND_URL}/stock/purchase-orders`, {
          method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
          body: JSON.stringify({
            sourceQuotationId, vendorId,
            quotationItemIds: checked.map((r) => r.quotationItemId),
            skippedItems: unchecked.map((r) => ({ itemId: r.quotationItemId, reason: r.reason.trim() })),
            buyerEntity: entityPayload(), requester, poDate, shipmentPreference: shipment, terms, notes,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message || "Failed to create PO");
      }
      onDone();
    } catch (err) {
      setError(err.message);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6"><div className="h-64 animate-pulse rounded-xl bg-gray-100" /></div>;
  }

  return (
    <div className="mx-auto max-w-3xl p-6 pb-10">
      <div className="mb-4 flex items-center gap-3">
        <button type="button" onClick={onBack} className="rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">&larr; Back</button>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{isEdit ? "Edit purchase order" : "Create purchase order"}</h1>
          <p className="text-sm text-gray-500">Supplier: {vendorName || "\u2014"}</p>
        </div>
        <span className="ml-auto rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
          {isEdit ? "Rejected · editing" : "PO creation pending"}
        </span>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span><button type="button" onClick={() => setError(null)} className="font-bold">&times;</button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-gray-600">Entity (buyer)</label>
          <select value={alias} onChange={(e) => onAliasChange(e.target.value)} className={inputCls}>
            <option value="">Select entity</option>
            {aliases.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">State</label>
          <select value={entityId} onChange={(e) => setEntityId(e.target.value)} className={inputCls} disabled={!alias}>
            {statesForAlias.map((e) => (
              <option key={e._id} value={e._id}>{e.state} - {e.stateCode}</option>
            ))}
          </select>
          {selectedEntity && (
            <p className="mt-1 text-[11px] text-gray-400">
              GST {selectedEntity.gstNumber} · {sameState ? "Same state → CGST + SGST" : "Different state → IGST"}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs text-gray-600">Requester</label>
          <input value={requester} onChange={(e) => setRequester(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">PO date</label>
          <input type="date" value={poDate} onChange={(e) => setPoDate(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">Shipment preference</label>
          <select value={shipment} onChange={(e) => setShipment(e.target.value)} className={inputCls}>
            {SHIPMENT_PREFERENCE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <p className="mb-1 mt-4 text-xs text-gray-600">
        Items {isEdit ? "" : `(${checked.length} selected · unchecked = skipped)`}
      </p>
      <div className="overflow-hidden rounded-xl border border-gray-200">
        {rows.map((r) => (
          <div key={String(r.quotationItemId)} className="border-b border-gray-100 px-4 py-2.5 last:border-b-0">
            <label className="flex items-center gap-2.5 text-sm">
              {!isEdit && (
                <input type="checkbox" checked={r.checked} onChange={() => toggle(r.quotationItemId)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
              )}
              <span className="flex flex-1 flex-wrap items-center gap-x-1">
                <span className="font-medium text-gray-900">{r.productName}</span>
                <span className="text-gray-500"> · {leafOf(r.categoryName)}</span>
                <button type="button" title="View full path"
                  onClick={(e) => { e.preventDefault(); setOpenPath(openPath === String(r.quotationItemId) ? null : String(r.quotationItemId)); }}
                  className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-indigo-600">👁</button>
                <span className="text-gray-500"> · qty {r.quantity} · {r.gstRate}% · {money(r.lineTotal)}</span>
              </span>
            </label>
            {openPath === String(r.quotationItemId) && (
              <p className="ml-6 mt-1 rounded bg-indigo-50 px-2 py-1 text-xs text-indigo-700">Path: {r.categoryName}</p>
            )}
            {!isEdit && !r.checked && (
              <input value={r.reason} onChange={(e) => setReason(r.quotationItemId, e.target.value)}
                placeholder="Reason for skipping (required)"
                className="mt-1.5 ml-6 w-[calc(100%-1.5rem)] rounded border border-red-200 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-red-300" />
            )}
          </div>
        ))}
      </div>

      <label className="mb-1 mt-4 block text-xs text-gray-600">Terms and conditions</label>
      <textarea value={terms} onChange={(e) => setTerms(e.target.value)} className={`${inputCls} min-h-[60px]`} />
      <label className="mb-1 mt-3 block text-xs text-gray-600">Notes (optional)</label>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputCls} min-h-[46px]`} />

      <div className="mt-5 flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
        <button type="button" onClick={onBack} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
        <button type="button" onClick={submit} disabled={saving}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
          {saving ? "Working\u2026" : isEdit ? "Save & regenerate" : "Generate PO"}
        </button>
      </div>
    </div>
  );
};

export default POCreateView;