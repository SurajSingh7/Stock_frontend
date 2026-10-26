"use client";

import React, { useEffect, useState } from "react";
import { Download, Upload, Search, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Modal, inputCls } from "@/modules/stock/shared/StockSharedUI";
import { searchProducts, downloadTemplate, parseUpload } from "./openingStockApi";

const TRACKING_LABEL = { individual: "Individual", quantity: "Group" };

/* ============================================================= */
/* Product picker — name search; each result shows the fields     */
/* its lines will ask for, so the right product is obvious.       */
/* ============================================================= */
// `search` is the screen's own product search (each kind has its module).
export const ProductPicker = ({ value, onPick, placeholder = "Search product…", search = searchProducts }) => {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const rows = await search(q.trim());
        if (alive) setResults(rows);
      } catch {
        if (alive) setResults([]);
      } finally {
        if (alive) setLoading(false);
      }
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [q, search]);

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className={`${inputCls} pl-9`} />
      </div>
      <div className="mt-3 max-h-80 overflow-y-auto rounded-xl border border-slate-100">
        {loading && results.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-400">Loading…</p>
        ) : results.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-400">No product matches</p>
        ) : (
          results.map((p) => (
            <button
              key={p._id}
              type="button"
              onClick={() => onPick(p)}
              className={`block w-full border-b border-slate-100 px-4 py-2.5 text-left transition last:border-0 hover:bg-indigo-50 ${
                value === p._id ? "bg-indigo-50" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-slate-900">{p.name}</span>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                  {TRACKING_LABEL[p.trackingMethod] || p.trackingMethod}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {p.categoryPath || "—"}
                {p.fields?.length ? ` · ${p.fields.map((f) => f.label + (f.isUnique ? " (unique)" : "")).join(", ")}` : ""}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export const ProductPickerModal = ({ onClose, onPick, search }) => (
  <Modal onClose={onClose} title="Add item — choose the product" maxWidth="max-w-xl">
    <ProductPicker search={search} onPick={(p) => { onPick(p); onClose(); }} />
  </Modal>
);

/* ============================================================= */
/* Excel upload — pick product → download its template → upload   */
/* → preview. Malformed rows are shown and NOT added; incomplete   */
/* rows are added and flagged, exactly as on the entry itself.     */
/* ============================================================= */
export const ExcelUploadModal = ({ onClose, onAdd }) => {
  const [product, setProduct] = useState(null);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const download = async () => {
    setError(null);
    try { await downloadTemplate(product._id); } catch (err) { setError(err.message); }
  };

  const read = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try { setResult(await parseUpload(product._id, file)); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const issuesByRow = new Map((result?.issues || []).map((i) => [i.rowNumber, i.messages]));
  const preview = result
    ? [
        ...result.lines.map((l) => ({ rowNumber: l.rowNumber, line: l, messages: issuesByRow.get(l.rowNumber) || [], error: null })),
        ...result.rowErrors.map((e) => ({ rowNumber: e.rowNumber, line: null, messages: [], error: e.message })),
      ].sort((a, b) => a.rowNumber - b.rowNumber)
    : [];
  const fields = result?.product?.fields || [];

  return (
    <Modal onClose={onClose} title="Upload from Excel" maxWidth={result ? "max-w-4xl" : "max-w-xl"}>
      {!product ? (
        <>
          <p className="mb-3 text-sm text-slate-500">One template per product — its columns are that product&apos;s own fields.</p>
          <ProductPicker onPick={setProduct} />
        </>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Product</p>
              <p className="font-medium text-slate-900">{product.name}</p>
            </div>
            <button type="button" onClick={() => { setProduct(null); setFile(null); setResult(null); }} className="text-sm font-semibold text-indigo-600 hover:underline">
              Change
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-800">1. Download template</p>
              <p className="mt-1 text-xs text-slate-500">Fill one row per {product.trackingMethod === "quantity" ? "batch" : "unit"}. Keep the columns as they are.</p>
              <button type="button" onClick={download} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100">
                <Download className="h-4 w-4" /> Template (.xlsx)
              </button>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-800">2. Upload filled file</p>
              <input
                type="file"
                accept=".xlsx"
                onChange={(e) => { setFile(e.target.files?.[0] || null); setResult(null); }}
                className="mt-2 block w-full text-xs text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-slate-700"
              />
              <button
                type="button"
                disabled={!file || busy}
                onClick={read}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Upload className="h-4 w-4" /> {busy ? "Reading…" : "Read file"}
              </button>
            </div>
          </div>

          {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

          {result && (
            <>
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> {result.lines.length - (result.issues?.length || 0)} ready
                </span>
                {result.issues?.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 font-semibold text-amber-700">
                    <AlertTriangle className="h-4 w-4" /> {result.issues.length} need fixing (added, flagged)
                  </span>
                )}
                {result.rowErrors.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1 font-semibold text-rose-700">
                    <AlertTriangle className="h-4 w-4" /> {result.rowErrors.length} not added — fix in Excel and upload again
                  </span>
                )}
              </div>
              <div className="max-h-72 overflow-auto rounded-xl border border-slate-100">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Row</th>
                      {fields.map((f) => <th key={f.code} className="px-3 py-2">{f.label}</th>)}
                      {product.trackingMethod === "quantity" && <th className="px-3 py-2">Qty</th>}
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.map((r) => (
                      <tr key={r.rowNumber} className={r.error ? "bg-rose-50/60" : r.messages.length ? "bg-amber-50/60" : ""}>
                        <td className="px-3 py-1.5 tabular-nums text-slate-500">{r.rowNumber}</td>
                        {fields.map((f) => <td key={f.code} className="px-3 py-1.5 text-slate-800">{String(r.line?.fieldValues?.[f.code] ?? "—")}</td>)}
                        {product.trackingMethod === "quantity" && <td className="px-3 py-1.5">{r.line?.quantity ?? "—"}</td>}
                        <td className="px-3 py-1.5 text-xs">
                          {r.error ? <span className="text-rose-700">{r.error}</span> : r.messages.length ? <span className="text-amber-700">{r.messages.join(" · ")}</span> : <span className="text-emerald-700">OK</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                <button
                  type="button"
                  disabled={!result.lines.length}
                  onClick={() => { onAdd(result.product, result.lines); onClose(); }}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  Add {result.lines.length} row(s) to entry
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
};

export const ConfirmModal = ({ title, children, confirmLabel, tone = "indigo", busy, onConfirm, onClose }) => (
  <Modal onClose={onClose} title={title} maxWidth="max-w-md">
    <div className="text-sm text-slate-600">{children}</div>
    <div className="mt-5 flex justify-end gap-2">
      <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
      <button
        type="button"
        disabled={busy}
        onClick={onConfirm}
        className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${tone === "rose" ? "bg-rose-600 hover:bg-rose-700" : "bg-indigo-600 hover:bg-indigo-700"}`}
      >
        {busy ? "Please wait…" : confirmLabel}
      </button>
    </div>
  </Modal>
);
