"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import { ArrowRight, ChevronDown, ChevronUp } from "lucide-react";
import { Modal, inputCls, unitLabel } from "@/modules/stock/shared/StockSharedUI";
import { loadSavedName, saveName } from "./userName";

async function fetchDetail(id) {
  const res = await fetch(`${API_BACKEND_URL}/stock/transfer-requests/${id}`, { credentials: "include" });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to load transfer request");
  return json.data;
}

async function fetchAvailableUnits(warehouseId, productDefinitionId) {
  const params = new URLSearchParams({
    warehouseId, productDefinitionId, status: "AVAILABLE", approvalStatus: "APPROVED", limit: "200",
  });
  const res = await fetch(`${API_BACKEND_URL}/stock/inventory-items?${params.toString()}`, { credentials: "include" });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to load available units");
  return json.data || [];
}

const serialLabel = (item) => {
  const fv = item.fieldValues || {};
  return fv.imei || fv.serial_no || item._id.slice(-6).toUpperCase();
};

/* Per-line serial/IMEI picker — individual-tracked products only.
   Auto Select fills the first `need` available units for the user;
   Manual opens the checklist so they can pick/override by hand. */
const SerialPicker = ({ line, sourceLocationId, need, selected, onChangeSelected }) => {
  const [open, setOpen] = useState(false);
  const [units, setUnits] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await fetchAvailableUnits(sourceLocationId, line.productDefinitionId);
      setUnits(data);
      return data;
    } catch (e) {
      setErr(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [sourceLocationId, line.productDefinitionId]);

  useEffect(() => { if (open && units === null) load(); }, [open, units, load]);

  const toggle = (id) => {
    if (selected.includes(id)) {
      onChangeSelected(selected.filter((x) => x !== id));
    } else {
      if (selected.length >= need) return;
      onChangeSelected([...selected, id]);
    }
  };

  const handleAutoSelect = async () => {
    setOpen(true);
    const data = units === null ? await load() : units;
    if (data) onChangeSelected(data.slice(0, need).map((u) => u._id));
  };

  const productFields = (units?.[0]?.productDefinitionId?.selectedFields || [])
    .slice()
    .sort((a, c) => (a.order ?? 0) - (c.order ?? 0))
    .map((sf) => sf.fieldDefId)
    .filter(Boolean);

  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50/60 p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
          <span>Select units ({selected.length}/{need} selected)</span>
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        <div className="flex gap-1.5">
          <button
            type="button" onClick={handleAutoSelect}
            className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700 transition hover:bg-indigo-100"
          >
            Auto Select
          </button>
          <button
            type="button" onClick={() => setOpen(true)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Manual
          </button>
        </div>
      </div>
      {open && (
        <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white">
          {loading || units === null ? (
            <p className="p-3 text-xs text-slate-400">Loading available units…</p>
          ) : err ? (
            <p className="p-3 text-xs text-rose-600">{err}</p>
          ) : units.length === 0 ? (
            <p className="p-3 text-xs text-slate-400">No available units at the source location.</p>
          ) : (
            <table className="w-full min-w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left font-semibold uppercase tracking-wide text-slate-500">
                  <th className="w-8 px-2 py-1.5"></th>
                  <th className="px-2 py-1.5">Product</th>
                  {productFields.length > 0
                    ? productFields.map((fd) => <th key={fd._id} className="px-2 py-1.5">{fd.label}</th>)
                    : <th className="px-2 py-1.5">Unit</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {units.map((u) => {
                  const checked = selected.includes(u._id);
                  const disabled = !checked && selected.length >= need;
                  return (
                    <tr key={u._id} className={checked ? "bg-indigo-50/60" : ""}>
                      <td className="px-2 py-1.5">
                        <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggle(u._id)} />
                      </td>
                      <td className={`px-2 py-1.5 font-medium ${disabled ? "text-slate-300" : "text-slate-700"}`}>
                        {u.productDefinitionId?.name || line.productName}
                      </td>
                      {productFields.length > 0
                        ? productFields.map((fd) => (
                          <td key={fd._id} className={`px-2 py-1.5 ${disabled ? "text-slate-300" : "text-slate-600"}`}>
                            {u.fieldValues?.[fd.code] ?? "—"}
                          </td>
                        ))
                        : <td className={`px-2 py-1.5 ${disabled ? "text-slate-300" : "text-slate-600"}`}>{serialLabel(u)}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

const ProcessTransferRequestModal = ({ requestId, onClose, onDone }) => {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [lineState, setLineState] = useState({}); // lineId -> { transferQty, selectedItemIds }
  const [reason, setReason] = useState("");
  const [name, setName] = useState(loadSavedName());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const d = await fetchDetail(requestId);
        setDetail(d);
        const initial = {};
        (d.lines || []).forEach((l) => {
          initial[l._id] = { transferQty: l.requestedQty, selectedItemIds: [] };
        });
        setLineState(initial);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [requestId]);

  const setLine = (lineId, patch) => setLineState((prev) => ({ ...prev, [lineId]: { ...prev[lineId], ...patch } }));

  const hasShortfall = useMemo(() => {
    if (!detail) return false;
    return (detail.lines || []).some((l) => (lineState[l._id]?.transferQty ?? 0) < l.requestedQty);
  }, [detail, lineState]);

  const submit = async () => {
    if (!detail) return;
    if (!name.trim()) { setError("Your name is required"); return; }
    if (hasShortfall && !reason.trim()) { setError("A reason is required for any quantity not being transferred"); return; }

    const lines = [];
    for (const l of detail.lines) {
      const st = lineState[l._id] || { transferQty: 0, selectedItemIds: [] };
      const qty = Number(st.transferQty) || 0;
      if (qty > l.requestedQty) { setError(`${l.productName}: transfer quantity cannot exceed ${l.requestedQty}`); return; }
      if (l.trackingMethod === "individual" && qty > 0 && st.selectedItemIds.length !== qty) {
        setError(`${l.productName}: select exactly ${qty} unit(s) to transfer`);
        return;
      }
      lines.push({ lineId: l._id, transferQty: qty, inventoryItemIds: st.selectedItemIds });
    }
    if (lines.every((l) => l.transferQty === 0)) {
      setError("Enter a transfer quantity for at least one product, or use Reject instead");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      saveName(name);
      const res = await fetch(`${API_BACKEND_URL}/stock/transfer-requests/${requestId}/process`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines, reason: reason.trim(), processedByName: name.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to process transfer request");
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={detail ? `Process ${detail.requestNumber}` : "Process transfer request"} onClose={onClose} maxWidth="max-w-2xl">
      {loading ? (
        <div className="space-y-3">
          <div className="h-6 w-2/3 animate-pulse rounded bg-slate-100" />
          <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
        </div>
      ) : !detail ? (
        <p className="text-sm text-rose-600">{error || "Not found"}</p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="font-semibold text-slate-900">{detail.sourceLocationId?.name}</span>
            <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
            <span className="font-semibold text-slate-900">{detail.requestingLocationId?.name}</span>
            {detail.remarks && <span className="ml-auto text-xs text-slate-400">"{detail.remarks}"</span>}
          </div>

          <div className="space-y-3">
            {detail.lines.map((l) => {
              const st = lineState[l._id] || { transferQty: 0, selectedItemIds: [] };
              const isIndividual = l.trackingMethod === "individual";
              const unit = unitLabel(l.unit);
              return (
                <div key={l._id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{l.productName}</p>
                      <p className="text-xs text-slate-500">Requested: {l.requestedQty} {unit} {isIndividual ? "· Individual tracked" : "· Group tracked"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-slate-600">Transfer ({unit})</label>
                      <input
                        type="number" min="0" max={l.requestedQty} value={st.transferQty}
                        onChange={(e) => {
                          const qty = Math.max(0, Math.min(l.requestedQty, Number(e.target.value) || 0));
                          setLine(l._id, { transferQty: qty, selectedItemIds: st.selectedItemIds.slice(0, qty) });
                        }}
                        className={`${inputCls} w-20`}
                      />
                    </div>
                  </div>
                  {isIndividual && st.transferQty > 0 && (
                    <SerialPicker
                      line={l}
                      sourceLocationId={detail.sourceLocationId?._id}
                      need={st.transferQty}
                      selected={st.selectedItemIds}
                      onChangeSelected={(ids) => setLine(l._id, { selectedItemIds: ids })}
                    />
                  )}
                  {st.transferQty < l.requestedQty && (
                    <p className="mt-2 text-xs font-medium text-amber-600">
                      Shortfall of {l.requestedQty - st.transferQty} {unit} will be auto-closed as rejected on this line.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">Your name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className={inputCls} />
          </div>

          {hasShortfall && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">Reason for shortfall</label>
              <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why the full quantity isn't being transferred" className={inputCls} />
            </div>
          )}

          {error && <p className="text-sm font-medium text-rose-600">{error}</p>}

          <div className="flex justify-end gap-2.5 border-t border-gray-100 pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm transition hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="button" onClick={submit} disabled={busy}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Submitting…" : "Confirm transfer"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default ProcessTransferRequestModal;
