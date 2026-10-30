"use client";

import React, { useEffect, useState } from "react";
import { Sparkles, Check, RotateCw, Cpu, TriangleAlert, FileText } from "lucide-react";
import { Modal } from "@/modules/stock/shared/StockSharedUI";
import { ModelPicker } from "@/modules/master/aiSettings/aiSettingsShared";

/*
  The AI scan on Add Invoice, piece by piece:
    ScanProgress      green card while the file uploads and Claude reads it
    ScanSkeleton      shimmer where the form will appear
    ScanResultBanner  "AI read your invoice" + warnings + Re-scan / Change model
    ChangeModelPopup  pick the model (AI Settings · Update only), then re-scan

  Upload progress is real (XHR). Claude answers in one go and reports no
  progress of its own, so the scan bar eases toward 90% against the model's
  usual time and jumps to 100% when the answer lands — never a fake exact %.
*/

// Usual seconds per invoice, for the easing curve only.
const TYPICAL_SECONDS = { "claude-haiku-5-5": 8, "claude-sonnet-5-5": 15, "claude-opus-5-5": 20 };

/** POST a FormData with upload progress. Resolves the API's `data`. */
export const uploadWithProgress = (url, formData, onProgress) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.upload.onload = () => onProgress(100, true);
    xhr.onload = () => {
      let json = {};
      try {
        json = JSON.parse(xhr.responseText);
      } catch {
        // falls through to the generic message
      }
      if (xhr.status >= 200 && xhr.status < 300 && json.success) resolve(json.data);
      else reject(new Error(json.message || "Could not read the invoice"));
    };
    xhr.onerror = () => reject(new Error("Network error while uploading the invoice"));
    xhr.send(formData);
  });

const useElapsed = (startedAt) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return undefined;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [startedAt]);
  return startedAt ? Math.max(0, (now - startedAt) / 1000) : 0;
};

const STEPS = [
  { at: 0, label: "Reading invoice" },
  { at: 35, label: "Finding products" },
  { at: 70, label: "Matching with PO" },
];

export const ScanProgress = ({ fileName, phase, uploadPct, scanStartedAt, modelId, modelLabel }) => {
  const elapsed = useElapsed(phase === "scanning" ? scanStartedAt : null);
  const typical = TYPICAL_SECONDS[modelId] || 12;
  const scanPct = phase === "scanning" ? Math.min(90, Math.round(90 * (1 - Math.exp(-elapsed / (typical / 1.6))))) : 0;
  const mm = Math.floor(elapsed / 60);
  const ss = String(Math.floor(elapsed % 60)).padStart(2, "0");

  return (
    <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-5 shadow-sm">
      <div className="pointer-events-none absolute inset-0 -translate-x-full animate-[shimmer_2.2s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
      <div className="relative space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <FileText className="h-4 w-4 text-emerald-600" />
          <span className="truncate">{fileName}</span>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-xs font-semibold">
            <span className={uploadPct >= 100 ? "text-emerald-700" : "text-slate-600"}>
              {uploadPct >= 100 ? <><Check className="mr-1 inline h-3.5 w-3.5" />Uploaded</> : "Uploading…"}
            </span>
            <span className="tabular-nums text-slate-500">{uploadPct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-emerald-100">
            <div className="h-full rounded-full bg-emerald-500 transition-all duration-300" style={{ width: `${uploadPct}%` }} />
          </div>
        </div>

        <div className={phase === "scanning" ? "" : "opacity-40"}>
          <div className="mb-1 flex items-center justify-between text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-emerald-800">
              <Sparkles className={`h-4 w-4 ${phase === "scanning" ? "animate-pulse" : ""}`} />
              AI is scanning your invoice… please wait
            </span>
            <span className="tabular-nums text-slate-500">{phase === "scanning" ? `${mm}:${ss} · ${scanPct}%` : "—"}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-emerald-100">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500" style={{ width: `${scanPct}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {STEPS.map((s, i) => {
              const done = phase === "scanning" && scanPct >= (STEPS[i + 1]?.at ?? 101);
              const active = phase === "scanning" && scanPct >= s.at && !done;
              return (
                <span key={s.label} className={`inline-flex items-center gap-1 ${done ? "text-emerald-700" : active ? "font-semibold text-emerald-800" : "text-slate-400"}`}>
                  {done ? <Check className="h-3.5 w-3.5" /> : <span className={`h-2 w-2 rounded-full ${active ? "animate-ping bg-emerald-500" : "bg-slate-300"}`} />}
                  {s.label}
                </span>
              );
            })}
          </div>
          {modelLabel && <p className="mt-2 text-[11px] text-slate-400">Using {modelLabel}</p>}
        </div>
      </div>
    </div>
  );
};

const Bar = ({ w = "w-full", h = "h-9" }) => <div className={`${w} ${h} animate-pulse rounded-lg bg-slate-200/70`} />;

export const ScanSkeleton = () => (
  <div className="space-y-4" aria-hidden="true">
    <div className="grid gap-3 sm:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-1.5"><Bar w="w-24" h="h-3" /><Bar /></div>
      ))}
    </div>
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="h-9 bg-slate-50" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-4 border-t border-slate-100 px-3 py-3">
          <Bar w="w-1/3" h="h-4" /><div className="flex-1" /><Bar w="w-12" h="h-4" /><Bar w="w-12" h="h-4" /><Bar w="w-24" h="h-8" />
        </div>
      ))}
    </div>
    <Bar h="h-16" />
  </div>
);

export const ScanResultBanner = ({ meta, warnings, onRescan, onChangeModel, busy }) => (
  <div className="space-y-2">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-3">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white"><Check className="h-4 w-4" /></span>
        <div>
          <p className="text-sm font-semibold text-emerald-900">AI read your invoice in {meta.seconds}s · {meta.modelLabel}</p>
          <p className="text-xs text-emerald-800/80">Fields it filled are highlighted green — check them before saving.</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onRescan} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm hover:bg-emerald-50 disabled:opacity-50">
          <RotateCw className="h-3.5 w-3.5" /> Re-scan
        </button>
        {onChangeModel && (
          <button type="button" onClick={onChangeModel} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50">
            <Cpu className="h-3.5 w-3.5" /> Change model
          </button>
        )}
      </div>
    </div>
    {warnings.length > 0 && (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
        <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-amber-800"><TriangleAlert className="h-3.5 w-3.5" />Check these</p>
        <ul className="list-disc space-y-0.5 pl-5 text-xs text-amber-900">
          {warnings.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      </div>
    )}
  </div>
);

export const ScanFailedBanner = ({ message, onRescan, onChangeModel, busy }) => (
  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
    <div>
      <p className="text-sm font-semibold text-rose-800">AI couldn&apos;t read this invoice</p>
      <p className="text-xs text-rose-700">{message} — fill in the details below by hand, or try again.</p>
    </div>
    <div className="flex gap-2">
      <button type="button" onClick={onRescan} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 shadow-sm hover:bg-rose-100 disabled:opacity-50">
        <RotateCw className="h-3.5 w-3.5" /> Re-scan
      </button>
      {onChangeModel && (
        <button type="button" onClick={onChangeModel} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50">
          <Cpu className="h-3.5 w-3.5" /> Change model
        </button>
      )}
    </div>
  </div>
);

export const ChangeModelPopup = ({ models, current, onClose, onPick }) => {
  const [value, setValue] = useState(current);
  const [busy, setBusy] = useState(false);
  return (
    <Modal onClose={onClose} title="Change AI model" maxWidth="max-w-lg">
      <p className="mb-3 text-xs text-slate-500">The model you pick becomes the default for every invoice scan, and this invoice is scanned again with it.</p>
      <ModelPicker models={models} value={value} onChange={setValue} disabled={busy} />
      <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-4">
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50">Cancel</button>
        <button
          type="button" disabled={busy}
          onClick={async () => { setBusy(true); await onPick(value); setBusy(false); }}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-60"
        >
          {busy ? "Saving…" : value === current ? "Re-scan with this model" : "Save & re-scan"}
        </button>
      </div>
    </Modal>
  );
};
