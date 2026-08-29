"use client";

import React, { useState, useEffect, useMemo } from "react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import { Plus, Trash2 } from "lucide-react";
import { usePermissions } from "@/context/PermissionContext";
import { Modal, SearchableSelect, inputCls, unitLabel } from "@/modules/stock/shared/StockSharedUI";

const EMPTY_LINE = { productDefinitionId: "", requestedQty: "" };

async function fetchProducts() {
  const res = await fetch(`${API_BACKEND_URL}/stock/product-definitions?limit=1000`, { credentials: "include" });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to load products");
  return json.data || [];
}

const CreateTransferRequestModal = ({ branches, defaultRequestingBranchId, onClose, onCreated }) => {
  // Requester identity is the signed-in user, not a remembered free-text
  // string — the request lands on another branch's board, so who asked has to
  // be the person who actually asked. The backend falls back to the session
  // user's name, so a still-loading context can never submit a blank.
  const { userData } = usePermissions();
  const name = [userData?.firstName, userData?.lastName].filter(Boolean).join(" ");

  // You always request stock *for* your own branch, so this is a fact to show,
  // not a field to fill — resolved by the backend and read-only here.
  const requestingBranchId = defaultRequestingBranchId || "";

  const [sourceBranchId, setSourceBranchId] = useState("");
  const [remarks, setRemarks] = useState("");
  const [lines, setLines] = useState([{ ...EMPTY_LINE }]);

  const [products, setProducts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchProducts().then(setProducts).catch(() => setProducts([]));
  }, []);

  const branchOptions = useMemo(() => branches.map((l) => ({ value: l._id, label: `${l.name} (${l.code})` })), [branches]);
  const requestingBranchation = useMemo(
    () => branchOptions.find((o) => String(o.value) === requestingBranchId) || null,
    [branchOptions, requestingBranchId]
  );
  // A branch cannot transfer to itself — leave it out of the source list
  // entirely rather than letting it be picked and rejected on submit.
  const sourceOptions = useMemo(
    () => branchOptions.filter((o) => String(o.value) !== requestingBranchId),
    [branchOptions, requestingBranchId]
  );
  const productOptions = useMemo(() => products.map((p) => ({ value: p._id, label: p.name })), [products]);
  const productById = useMemo(() => new Map(products.map((p) => [p._id, p])), [products]);

  const updateLine = (idx, field, value) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  };
  const addLine = () => setLines((prev) => [...prev, { ...EMPTY_LINE }]);
  const removeLine = (idx) => setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));

  const validate = () => {
    if (!requestingBranchId) {
      return "You do not have access to any branch. Ask an administrator to assign you a branch before raising a transfer request.";
    }
    if (!sourceBranchId) return "Source branch is required";
    const validLines = lines.filter((l) => l.productDefinitionId);
    if (validLines.length === 0) return "Add at least one product";
    for (const l of validLines) {
      if (!l.requestedQty || Number(l.requestedQty) <= 0) return "Every product line needs a quantity greater than 0";
    }
    return null;
  };

  const submit = async () => {
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setBusy(true);
    setError(null);
    try {
      const payload = {
        requestingBranchId,
        sourceBranchId,
        remarks: remarks.trim(),
        requestedByName: name || undefined,
        lines: lines
          .filter((l) => l.productDefinitionId)
          .map((l) => ({ productDefinitionId: l.productDefinitionId, requestedQty: Number(l.requestedQty) })),
      };
      const res = await fetch(`${API_BACKEND_URL}/stock/transfer-requests`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to create transfer request");
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="New Transfer Request" onClose={onClose} maxWidth="max-w-4xl">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">Requesting branch (needs stock)</label>
            {requestingBranchation ? (
              <>
                <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-slate-900">
                  {requestingBranchation.label}
                </p>
                {/* <p className="mt-1.5 text-xs text-slate-500">
                  Your assigned branch — the stock is being requested for this branch.
                </p> */}
              </>
            ) : (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                You do not have access to any branch — ask an administrator to assign you one.
              </p>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">Source branch (provides stock)</label>
            <SearchableSelect value={sourceBranchId} onChange={setSourceBranchId} options={sourceOptions} placeholder="Select branch" />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">Requested by</label>
          <p className="text-sm font-medium text-slate-900">{name || "—"}</p>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700">Products</label>
            <button type="button" onClick={addLine} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-500">
              <Plus className="h-3.5 w-3.5" /> Add product
            </button>
          </div>
          <div className="space-y-2">
            {lines.map((line, idx) => {
              const unit = unitLabel(productById.get(line.productDefinitionId)?.unit);
              return (
              <div key={idx} className="flex items-center gap-2">
                <div className="flex-1">
                  <SearchableSelect
                    value={line.productDefinitionId}
                    onChange={(v) => updateLine(idx, "productDefinitionId", v)}
                    options={productOptions}
                    placeholder="Select product"
                  />
                </div>
                <div className="relative w-28">
                  <input
                    type="number" min="1" value={line.requestedQty}
                    onChange={(e) => updateLine(idx, "requestedQty", e.target.value)}
                    placeholder="Qty" className={`${inputCls} ${unit ? "pr-14" : ""}`}
                  />
                  {unit && (
                    <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-gray-400">{unit}</span>
                  )}
                </div>
                <button
                  type="button" onClick={() => removeLine(idx)} disabled={lines.length === 1}
                  className="rounded-md border border-gray-200 bg-white p-2 text-gray-400 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              );
            })}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">Remarks (optional)</label>
          <textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Any notes for the source branch" className={inputCls} />
        </div>

        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}

        <div className="flex justify-end gap-2.5 border-t border-gray-100 pt-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm transition hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="button" onClick={submit} disabled={busy}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Creating…" : "Create request"}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default CreateTransferRequestModal;
