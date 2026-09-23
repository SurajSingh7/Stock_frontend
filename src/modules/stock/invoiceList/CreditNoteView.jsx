"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import { ArrowLeft, Plus, X, Search, AlertTriangle } from "lucide-react";
import { inputCls, money, unitLabel } from "@/modules/stock/shared/StockSharedUI";

/* ============================================================= */
/* Credit note — a full page, not a popup, because picking units  */
/* out of a 40-piece delivery needs room to search and scroll.    */
/*                                                                */
/* Two kinds of line, and they ask completely different           */
/* questions. Individual: WHICH units (by serial / MAC). Group:    */
/* HOW MUCH. The server decides what is claimable; this page only  */
/* renders what it was told and sends back what was picked.        */
/* ============================================================= */

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const CreditNoteView = ({ invoice, adjustment = null, onBack, onDone }) => {
  const isEdit = !!adjustment;
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // quotationItemId -> Set of inventoryItemIds (individual) or a number (group)
  const [picked, setPicked] = useState({});
  const [quantities, setQuantities] = useState({});
  const [unitSearch, setUnitSearch] = useState({});
  const [extras, setExtras] = useState(() =>
    isEdit ? (adjustment.extras || []).map((e) => ({ note: e.note || "", amount: String(e.amount ?? "") })) : []
  );
  const [reason, setReason] = useState(isEdit ? adjustment.reason || "" : "");
  const [editReason, setEditReason] = useState("");

  /*
    Editing asks the server for the same list, plus its OWN claims marked as
    still selectable — a note being re-decided has not "already taken" the
    units it holds. The server hands back what this note picked, so the form
    opens exactly as it was saved rather than making someone re-tick it.
  */
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const qs = isEdit ? `?adjustmentId=${adjustment._id}` : "";
      const res = await fetch(
        `${API_BACKEND_URL}/stock/payments/${invoice._id}/creditable-items${qs}`,
        { credentials: "include" }
      );
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to load items");
      const loaded = json.data?.lines || [];
      setLines(loaded);

      if (isEdit) {
        const nextPicked = {};
        const nextQty = {};
        loaded.forEach((l) => {
          const key = String(l.quotationItemId);
          if ((l.selectedUnitIds || []).length) nextPicked[key] = new Set(l.selectedUnitIds.map(String));
          if (l.selectedQuantity) nextQty[key] = String(l.selectedQuantity);
        });
        setPicked(nextPicked);
        setQuantities(nextQty);
      }
    } catch (e) {
      setError(e.message);
      setLines([]);
    } finally {
      setLoading(false);
    }
  }, [invoice._id, isEdit, adjustment]);

  useEffect(() => { load(); }, [load]);

  const toggleUnit = (key, unitId) => {
    setPicked((prev) => {
      const set = new Set(prev[key] || []);
      if (set.has(unitId)) set.delete(unitId);
      else set.add(unitId);
      return { ...prev, [key]: set };
    });
  };

  const addExtra = () => setExtras((p) => [...p, { note: "", amount: "" }]);
  const updateExtra = (i, field, value) =>
    setExtras((p) => p.map((e, k) => (k === i ? { ...e, [field]: value } : e)));
  const removeExtra = (i) => setExtras((p) => p.filter((_, k) => k !== i));

  /*
    Totals mirrored from the server's own arithmetic so the number is visible
    while choosing. The server recomputes all of it on submit — this is a
    preview, never the figure that gets stored.
  */
  const totals = useMemo(() => {
    let itemsAmount = 0;
    lines.forEach((l) => {
      const key = String(l.quotationItemId);
      const qty = l.trackingMethod === "individual" ? (picked[key]?.size || 0) : (Number(quantities[key]) || 0);
      // Mirrors the server: basic at the billed rate, plus that line GST slab.
      // A credit note that gave back basic only would under-settle by the tax.
      const basic = qty * (l.rate || 0);
      itemsAmount += basic + (basic * (l.gstRate || 0)) / 100;
    });
    const extrasAmount = extras.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    return {
      itemsAmount: Math.round(itemsAmount * 100) / 100,
      extrasAmount: Math.round(extrasAmount * 100) / 100,
      total: Math.round((itemsAmount + extrasAmount) * 100) / 100,
    };
  }, [lines, picked, quantities, extras]);

  const pickedUnitCount = useMemo(
    () => Object.values(picked).reduce((s, set) => s + (set?.size || 0), 0),
    [picked]
  );

  // While editing, the payable already has the OLD figure taken off it — so
  // the ceiling has to add that back before comparing.
  const basePayable = (invoice.payable || 0) + (isEdit ? adjustment.amount || 0 : 0);
  const overPayable = totals.total > basePayable;
  const canSubmit = !saving && totals.total > 0 && !!reason.trim() && !overPayable;

  const submit = async () => {
    setSaving(true); setError(null);
    try {
      const payloadLines = lines
        .map((l) => {
          const key = String(l.quotationItemId);
          if (l.trackingMethod === "individual") {
            const ids = [...(picked[key] || [])];
            return ids.length ? { quotationItemId: key, inventoryItemIds: ids } : null;
          }
          const qty = Number(quantities[key]) || 0;
          return qty > 0 ? { quotationItemId: key, quantity: qty } : null;
        })
        .filter(Boolean);

      const body = {
        lines: payloadLines,
        extras: extras
          .filter((e) => Number(e.amount) > 0)
          .map((e) => ({ note: e.note, amount: Number(e.amount) })),
        reason: reason.trim(),
      };
      const url = isEdit
        ? `${API_BACKEND_URL}/stock/payments/adjustments/${adjustment._id}`
        : `${API_BACKEND_URL}/stock/payments/${invoice._id}/adjustments`;

      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(
          isEdit ? { ...body, editReason: editReason.trim() } : { ...body, type: "CREDIT_NOTE" }
        ),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to save credit note");
      onDone();
    } catch (e) {
      setError(e.message);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <div className="mx-auto max-w-5xl">
        <button
          type="button" onClick={onBack}
          className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">
            {isEdit ? "Edit credit note" : "Credit note"} · Invoice {invoice.invoiceNumber}
          </h1>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-500">
            <span>{invoice.vendorName}</span>
            <span>{invoice.poNumber || "—"}</span>
            <span>Invoice date {fmtDate(invoice.invoiceDate)}</span>
            <span>Payable <strong className="text-slate-900">{money(invoice.payable)}</strong></span>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} className="font-bold">&times;</button>
          </div>
        )}

        {/* ── Faulty items ─────────────────────────────────────── */}
        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-700">Faulty items</p>

          {loading ? (
            <p className="py-8 text-center text-sm text-slate-400">Loading items…</p>
          ) : lines.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">This invoice has no lines.</p>
          ) : (
            <div className="space-y-4">
              {lines.map((l) => {
                const key = String(l.quotationItemId);
                const isIndividual = l.trackingMethod === "individual";
                const term = (unitSearch[key] || "").trim().toLowerCase();

                // Blocked units stay on screen with their reason. Hiding them
                // would leave someone hunting for stock they can see elsewhere.
                const visible = isIndividual
                  ? l.units.filter((u) =>
                      !term ||
                      Object.values(u.fieldValues || {}).some((v) =>
                        String(v ?? "").toLowerCase().includes(term)
                      )
                    )
                  : [];

                return (
                  <div key={key} className="rounded-xl border border-slate-200">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{l.productName}</p>
                        <p className="text-xs text-slate-500">
                          {isIndividual ? "Individual" : "Group"} · {unitLabel(l.unit)} ·
                          {" "}Received {l.receivedQuantity}
                          {l.focQuantity > 0 ? ` + ${l.focQuantity} FOC` : ""} ·
                          {" "}{money(l.rate)} each{l.gstRate > 0 ? ` + ${l.gstRate}% GST` : ""}
                        </p>
                      </div>
                      {isIndividual ? (
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            value={unitSearch[key] || ""}
                            onChange={(e) => setUnitSearch((p) => ({ ...p, [key]: e.target.value }))}
                            placeholder="Search serial / MAC…"
                            className="w-52 rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-100"
                          />
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-slate-600">
                          {l.creditableQuantity} {unitLabel(l.unit)} still creditable
                        </span>
                      )}
                    </div>

                    {isIndividual ? (
                      l.units.length === 0 ? (
                        <p className="px-4 py-4 text-sm text-slate-400">No units recorded for this line.</p>
                      ) : (
                        <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
                          {visible.map((u) => {
                            const blocked = !!u.blockReason;
                            const on = picked[key]?.has(String(u._id));
                            return (
                              <label
                                key={u._id}
                                className={`flex flex-wrap items-center gap-3 px-4 py-2 text-sm ${
                                  blocked ? "cursor-not-allowed bg-slate-50 text-slate-400" : "cursor-pointer hover:bg-indigo-50/40"
                                }`}
                              >
                                <input
                                  type="checkbox" disabled={blocked} checked={!!on}
                                  onChange={() => toggleUnit(key, String(u._id))}
                                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-40"
                                />
                                {l.fields.map((f) => (
                                  <span key={f.code} className="min-w-0">
                                    <span className="text-xs text-slate-400">{f.label}: </span>
                                    <span className={blocked ? "" : "text-slate-800"}>
                                      {u.fieldValues?.[f.code] ?? "—"}
                                    </span>
                                  </span>
                                ))}
                                {u.isFoc && (
                                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">FOC</span>
                                )}
                                {blocked && (
                                  <span className="ml-auto rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                    {u.blockReason}
                                  </span>
                                )}
                              </label>
                            );
                          })}
                          {visible.length === 0 && (
                            <p className="px-4 py-4 text-sm text-slate-400">No unit matches that search.</p>
                          )}
                        </div>
                      )
                    ) : (
                      <div className="flex flex-wrap items-end gap-4 px-4 py-3">
                        <div>
                          <label htmlFor={`qty-${key}`} className="mb-1.5 block text-xs font-semibold text-slate-700">
                            Faulty quantity ({unitLabel(l.unit)})
                          </label>
                          <input
                            id={`qty-${key}`}
                            type="number" min="0" max={l.creditableQuantity}
                            value={quantities[key] ?? ""}
                            onChange={(e) => setQuantities((p) => ({ ...p, [key]: e.target.value }))}
                            disabled={l.creditableQuantity <= 0}
                            className="w-36 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-400"
                          />
                        </div>
                        <p className="pb-2 text-sm font-semibold tabular-nums text-slate-900">
                          {money((Number(quantities[key]) || 0) * (l.rate || 0))}
                        </p>
                      </div>
                    )}

                    {isIndividual && (picked[key]?.size || 0) > 0 && (
                      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-4 py-2 text-xs">
                        <span className="text-slate-500">
                          {picked[key].size} of {l.units.filter((u) => !u.blockReason).length} selected
                        </span>
                        <span className="font-semibold tabular-nums text-slate-900">
                          {money(picked[key].size * (l.rate || 0))}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Other deductions ─────────────────────────────────── */}
        {/* Same {note, amount} shape as the invoice's extra charges, but the
            opposite effect — these REDUCE what is payable. Named for what they
            do here rather than reusing "extra charges", which would have the
            label saying the opposite of the row. */}
        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Other deductions</p>
            <button
              type="button" onClick={addExtra}
              className="inline-flex items-center gap-1 rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-600 shadow-sm transition hover:bg-blue-50"
            >
              <Plus className="h-3.5 w-3.5" /> Add row
            </button>
          </div>

          {extras.length === 0 ? (
            <p className="text-sm text-slate-400">
              For anything without an item behind it — a last-minute discount, transport damage.
            </p>
          ) : (
            <div className="space-y-2">
              {extras.map((e, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <input
                    type="text" value={e.note}
                    onChange={(ev) => updateExtra(i, "note", ev.target.value)}
                    placeholder="Description"
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                  <input
                    type="number" min="0" value={e.amount}
                    onChange={(ev) => updateExtra(i, "amount", ev.target.value)}
                    placeholder="Amount"
                    className="w-32 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                  <button
                    type="button" onClick={() => removeExtra(i)}
                    className="rounded-md border border-rose-200 bg-white p-1.5 text-rose-600 shadow-sm transition hover:bg-rose-50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Reason ───────────────────────────────────────────── */}
        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <label htmlFor="cn-reason" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700">
            Reason <span className="text-rose-500">*</span>
          </label>
          <textarea
            id="cn-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="What was wrong with the goods…"
            className={inputCls}
          />

          {isEdit && (
            <>
              <label htmlFor="cn-edit-reason" className="mb-1.5 mt-4 block text-xs font-bold uppercase tracking-wider text-slate-700">
                What changed
              </label>
              <input
                id="cn-edit-reason" type="text" value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Kept with the edit history" className={inputCls}
              />
            </>
          )}
        </div>

        {/* ── Summary ──────────────────────────────────────────── */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Faulty items{pickedUnitCount > 0 ? ` (${pickedUnitCount} units)` : ""}</span>
              <span className="font-medium tabular-nums text-slate-900">{money(totals.itemsAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Other deductions</span>
              <span className="font-medium tabular-nums text-slate-900">{money(totals.extrasAmount)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1.5 text-base">
              <span className="font-semibold text-slate-900">Credit note</span>
              <span className="font-bold tabular-nums text-slate-900">{money(totals.total)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Payable after this</span>
              <span className="tabular-nums">
                {money(basePayable)} &rarr; {money(Math.max(0, basePayable - totals.total))}
              </span>
            </div>
          </div>

          {overPayable && (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-inset ring-rose-100">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              A credit note cannot exceed the payable amount ({money(basePayable)}). Reduce the claim or split it across two notes.
            </p>
          )}

          {pickedUnitCount > 0 && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 ring-1 ring-inset ring-amber-100">
              {pickedUnitCount} inventory {pickedUnitCount === 1 ? "unit" : "units"} will be marked faulty and leave available stock
              {isEdit ? ". Units dropped from this note go back to available." : " as soon as this is saved."}
            </p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button" onClick={onBack} disabled={saving}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button" onClick={submit} disabled={!canSubmit}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {saving ? "Saving…" : isEdit ? "Save changes" : "Apply credit note"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreditNoteView;
