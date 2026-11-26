"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Plus, Trash2, Send, ArrowLeft, ArrowLeftRight, Building2, Store, MessageSquareText, Boxes, ArrowUp, AlertTriangle } from "lucide-react";
import { SearchableSelect, inputCls, unitLabel } from "@/modules/stock/shared/StockSharedUI";
import { fetchRequestCategories, createRequest } from "./transferApi";
import { useTransferBranches } from "./useTransferBase";
import { ConfirmDialog, qtyText } from "./shared";

const BACK = "/stock/inventory/transfers/my-requests";
// A new line goes on top, where it is seen first. Its key is random, not a
// module counter — a counter restarts on a hot reload and two lines would
// share a key (choosing one would change the other).
const newLine = () => ({ key: crypto.randomUUID(), categoryId: "", requestedQty: "" });

/*
  Request Stock — its own page, opened from My Requests. Ask another branch
  for stock for one of your own branches. Like Issue Item, you ask for a
  CATEGORY and a quantity; the other branch picks which products go. The
  request is only an ask: nothing is held until that branch sends.
*/
const RequestStockPage = () => {
  const router = useRouter();
  const { branches, myBranchIds, defaultBranchId } = useTransferBranches("my-stock-requests");

  const mine = useMemo(() => branches.filter((b) => myBranchIds === null || myBranchIds.includes(String(b._id))), [branches, myBranchIds]);
  const [pickedBranchId, setPickedBranchId] = useState("");
  // Your own branch until you pick one (the branch list arrives after the first render).
  const requestingBranchId = pickedBranchId || defaultBranchId || (mine.length === 1 ? String(mine[0]._id) : "");
  const [sourceBranchId, setSourceBranchId] = useState("");
  const [remarks, setRemarks] = useState("");
  const [lines, setLines] = useState(() => [newLine()]);
  const [fresh, setFresh] = useState(null); // the line just added, highlighted for a moment
  const [categories, setCategories] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchRequestCategories().then(setCategories).catch(() => setCategories([]));
  }, []);
  useEffect(() => {
    if (!fresh) return;
    const t = setTimeout(() => setFresh(null), 1500);
    return () => clearTimeout(t);
  }, [fresh]);
  const addLine = () => {
    const l = newLine();
    setLines((p) => [l, ...p]);
    setFresh(l.key);
  };

  const categoryById = useMemo(() => new Map(categories.map((c) => [String(c._id), c])), [categories]);
  const option = (b) => ({ value: String(b._id), label: b.name });
  const branchName = (id) => branches.find((b) => String(b._id) === id)?.name || "";
  const sourceOptions = branches.filter((b) => String(b._id) !== requestingBranchId).map(option);
  const usedIds = new Set(lines.map((l) => l.categoryId).filter(Boolean));
  const categoryOptions = (current) =>
    categories.filter((c) => String(c._id) === current || !usedIds.has(String(c._id))).map((c) => ({ value: String(c._id), label: c.path }));

  const setLine = (key, patch) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const filled = lines.filter((l) => l.categoryId);
  // What still stops Send, shown in the summary before anyone presses it.
  const emptyRows = lines.length - filled.length;
  const noQty = filled.filter((l) => !(Number(l.requestedQty) > 0)).length;
  const warnings = [
    !sourceBranchId && "Choose the branch to ask",
    emptyRows > 0 && filled.length > 0 && `${emptyRows} row${emptyRows === 1 ? " has" : "s have"} no category yet`,
    noQty > 0 && `${noQty} ${noQty === 1 ? "category has" : "categories have"} no quantity`,
  ].filter(Boolean);

  const check = () => {
    if (!requestingBranchId) return "Choose your branch";
    if (!sourceBranchId) return "Choose the branch to ask";
    if (!filled.length) return "Add at least one category";
    if (filled.some((l) => !(Number(l.requestedQty) > 0))) return "Every category needs a quantity";
    const fraction = filled.find((l) => categoryById.get(l.categoryId)?.trackingMethod === "individual" && !Number.isInteger(Number(l.requestedQty)));
    if (fraction) return `${categoryById.get(fraction.categoryId)?.path}: quantity must be a whole number`;
    return null;
  };

  const submit = async () => {
    setBusy(true);
    try {
      await createRequest({
        requestingBranchId,
        sourceBranchId,
        remarks: remarks.trim(),
        lines: filled.map((l) => ({ categoryId: l.categoryId, requestedQty: Number(l.requestedQty) })),
      });
      toast.success(`Request sent to ${branchName(sourceBranchId)}`);
      router.push(BACK);
    } catch (err) {
      toast.error(err.message);
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  const ask = () => { const e = check(); if (e) toast.error(e); else setConfirming(true); };

  return (
    <div className="min-h-screen bg-slate-50/60">
      <div className="mx-auto w-full max-w-5xl p-6 pb-12">
        {/* Header — the same as the vendor form: back, then the title. */}
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <button
            type="button" onClick={() => router.push(BACK)}
            className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" /> Back to My Requests
          </button>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Request Stock</h1>
        </div>

        <div className="space-y-6">
          <Card index={1} icon={ArrowLeftRight} title="Branches" subtitle="Which of your branches needs the stock, and which branch you are asking">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <Field icon={Building2} label="Your branch (needs stock)" required>
                {mine.length > 1 && !defaultBranchId ? (
                  <SearchableSelect value={requestingBranchId} onChange={(v) => { setPickedBranchId(v); if (v === sourceBranchId) setSourceBranchId(""); }} options={mine.map(option)} placeholder="Choose branch" />
                ) : mine.length ? (
                  <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">{branchName(requestingBranchId) || "—"}</p>
                ) : (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">You have no branch — ask an administrator to assign one.</p>
                )}
              </Field>
              <Field icon={Store} label="Ask branch (has stock)" required>
                <SearchableSelect value={sourceBranchId} onChange={setSourceBranchId} options={sourceOptions} placeholder="Choose branch" />
              </Field>
              <Field icon={MessageSquareText} label="Remarks">
                <input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. needed for new connections" className={inputCls} />
              </Field>
            </div>
          </Card>

          <Card
            index={2} icon={Boxes} title="Categories" subtitle="The other branch chooses which products to send for each category"
            action={
              <button type="button" onClick={addLine} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50">
                <Plus className="h-3.5 w-3.5" /> Add Category
              </button>
            }
          >
            {/* The rows on the left, a live summary of the request on the right. */}
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div>
            <div className="mb-2 hidden grid-cols-[minmax(0,26rem)_9rem_2.25rem] gap-3 sm:grid">
              <span className="text-xs font-semibold text-slate-700">Category <span className="text-rose-500">*</span></span>
              <span className="text-xs font-semibold text-slate-700">Quantity <span className="text-rose-500">*</span></span>
              <span />
            </div>
            <div className="space-y-2.5">
              {lines.map((line) => {
                const unit = unitLabel(categoryById.get(line.categoryId)?.unit);
                return (
                  <div
                    key={line.key}
                    className={`grid grid-cols-[minmax(0,26rem)_9rem_2.25rem] items-center gap-3 rounded-xl transition ${fresh === line.key ? "bg-indigo-50 ring-4 ring-indigo-50" : ""}`}
                  >
                    <SearchableSelect value={line.categoryId} onChange={(v) => setLine(line.key, { categoryId: v })} options={categoryOptions(line.categoryId)} placeholder="Select category" />
                    <div className="relative">
                      <input
                        type="number" min="1" value={line.requestedQty} onChange={(e) => setLine(line.key, { requestedQty: e.target.value })}
                        placeholder="Qty" className={`${inputCls} ${unit ? "pr-16" : ""}`}
                      />
                      {unit && <span className="pointer-events-none absolute inset-y-0 right-2 my-auto h-fit rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">{unit}</span>}
                    </div>
                    <button
                      type="button" title="Remove" onClick={() => setLines((p) => (p.length > 1 ? p.filter((l) => l.key !== line.key) : p))} disabled={lines.length === 1}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
            </div>

            <aside className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Request Summary</p>
              <div className="space-y-1 text-sm">
                <p className="flex items-center gap-1.5 font-semibold text-slate-900"><Building2 className="h-3.5 w-3.5 text-slate-400" /> {branchName(requestingBranchId) || "Your branch"}</p>
                <p className="flex items-center gap-1 pl-5 text-[11px] font-semibold uppercase tracking-wide text-slate-400"><ArrowUp className="h-3 w-3" /> asking</p>
                <p className={`flex items-center gap-1.5 font-semibold ${sourceBranchId ? "text-slate-900" : "text-slate-400"}`}><Store className="h-3.5 w-3.5 text-slate-400" /> {branchName(sourceBranchId) || "Choose a branch"}</p>
              </div>
              <div className="my-3 border-t border-slate-200" />
              {filled.length ? (
                <ul className="space-y-1.5">
                  {[...filled].reverse().map((l) => {
                    const c = categoryById.get(l.categoryId);
                    return (
                      <li key={l.key} className="flex items-start justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate text-slate-700" title={c?.path}>{c?.path}</span>
                        <span className={`shrink-0 font-semibold tabular-nums ${Number(l.requestedQty) > 0 ? "text-slate-900" : "text-slate-300"}`}>
                          {Number(l.requestedQty) > 0 ? qtyText(l.requestedQty, c?.unit) : "—"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-slate-400">No category chosen yet.</p>
              )}
              <div className="my-3 border-t border-slate-200" />
              <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                <Boxes className="h-3.5 w-3.5 text-slate-400" /> {filled.length} {filled.length === 1 ? "category" : "categories"}
              </p>
              {warnings.map((w) => (
                <p key={w} className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-amber-700">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {w}
                </p>
              ))}
            </aside>
            </div>
          </Card>
        </div>

        <div className="mt-6 flex justify-end">
          <div className="flex gap-3">
            <button
              type="button" onClick={() => router.push(BACK)}
              className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <SendBtn onClick={ask} className="px-5 py-2.5" />
          </div>
        </div>
      </div>

      {confirming && (
        <ConfirmDialog
          busy={busy} confirmLabel="Yes, send request"
          message={<>Ask <b>{branchName(sourceBranchId)}</b> for this stock?</>}
          detail={
            <ul className="space-y-0.5">
              {filled.map((l) => {
                const c = categoryById.get(l.categoryId);
                return <li key={l.categoryId}>• {c?.path} — <b>{qtyText(l.requestedQty, c?.unit)}</b></li>;
              })}
            </ul>
          }
          onConfirm={submit} onClose={() => setConfirming(false)}
        />
      )}
    </div>
  );
};

const SendBtn = ({ onClick, className = "" }) => (
  <button
    type="button" onClick={onClick}
    className={`inline-flex items-center gap-2 rounded-lg bg-indigo-600 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 ${className}`}
  >
    <Send className="h-4 w-4" /> Send Request
  </button>
);

// A numbered section, the same look as the vendor form's cards, with an icon.
const Card = ({ index, icon: Icon, title, subtitle, action, children }) => (
  <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-2xl bg-slate-50/60 px-6 py-4">
      <div className="flex items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">{index}</span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100">
          <Icon className="h-4.5 w-4.5" />
        </span>
        <div>
          <h2 className="text-sm font-bold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
    <div className="border-t border-slate-100 px-6 pb-6 pt-5">{children}</div>
  </section>
);

// A labelled field — icon, label, and a red * when it is required.
const Field = ({ icon: Icon, label, required, children }) => (
  <div className="flex min-w-0 flex-col gap-1.5">
    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
      {Icon && <Icon className="h-3.5 w-3.5 text-slate-400" />}
      {label} {required && <span className="text-rose-500">*</span>}
    </label>
    {children}
  </div>
);

export default RequestStockPage;
