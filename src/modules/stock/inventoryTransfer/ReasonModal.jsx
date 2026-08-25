"use client";

import React, { useState } from "react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import { Modal, inputCls } from "@/modules/stock/shared/StockSharedUI";
import { loadSavedName, saveName } from "./userName";

/*
  Generic "close this request with a reason" modal — used by the source
  location to reject a request outright (PATCH { reason, processedByName }).
  `path` is relative to `${API_BACKEND_URL}/stock/`.
*/
const ReasonModal = ({ title, description, confirmLabel, path, onClose, onDone }) => {
  const [reason, setReason] = useState("");
  const [name, setName] = useState(loadSavedName());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    if (!reason.trim()) { setError("A reason is required"); return; }
    setBusy(true);
    setError(null);
    try {
      saveName(name);
      const res = await fetch(`${API_BACKEND_URL}/stock/${path}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim(), processedByName: name.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Action failed");
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={title} onClose={onClose} maxWidth="max-w-md">
      <p className="mb-4 text-sm text-slate-500">{description}</p>

      <label className="mb-1.5 block text-xs font-semibold text-slate-700">Your name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className={`${inputCls} mb-4`} />

      <label className="mb-1.5 block text-xs font-semibold text-slate-700">Reason</label>
      <textarea
        rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
        placeholder="Explain why…" className={inputCls}
      />

      {error && <p className="mt-2 text-sm font-medium text-rose-600">{error}</p>}

      <div className="mt-5 flex justify-end gap-2.5">
        <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm transition hover:bg-gray-50">
          Cancel
        </button>
        <button
          type="button" onClick={submit} disabled={busy}
          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Submitting…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
};

export default ReasonModal;
