"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import { ArrowLeft, Plus, X, Search, AlertTriangle } from "lucide-react";
import { inputCls, money, unitLabel } from "@/modules/stock/shared/StockSharedUI";

/* ============================================================= */
/* Credit note — a full page, not a popup, because picking units  */
/* out of a 40-piece delivery needs room to search and scroll.    */
/*                                                                */
/* ONE product at a time, chosen by tab. Stacking every product   */
/* vertically meant scrolling past forty checkboxes to reach the  */
/* second one; tabs put a single product's decision in front of   */
/* you and nothing else.                                          */
/*                                                                */
/* Each product offers three choices rather than a checkbox list  */
/* alone: nothing, ALL of it, or a hand-picked set. "All" exists   */
/* because a whole faulty consignment is common, and ticking 38    */
/* boxes to say so is not a decision — it is data entry.          */
/*                                                                */
/* Two kinds of line still ask different questions underneath.    */
/* Individual: WHICH units (by serial / MAC). Group: HOW MUCH.    */
/* The server decides what is claimable; this page only renders   */
/* what it was told and sends back what was picked.               */
/* ============================================================= */

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

// What one product line is currently claiming. Held per product so switching
// tabs never loses what was decided on the one before.
const MODE = { NONE: "NONE", ALL: "ALL", PICK: "PICK" };

// Mirrors the server: basic at the billed rate, plus that line's GST slab. A
// credit note that gave back basic only would under-settle by the tax.
const withGst = (basic, gstRate) => basic + (basic * (gstRate || 0)) / 100;

const CreditNoteView = ({ invoice, adjustment = null, onBack, onDone }) => {
  const isEdit = !!adjustment;
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [activeTab, setActiveTab] = useState(null);
  const [modes, setModes] = useState({});           // quotationItemId -> MODE
  const [picked, setPicked] = useState({});         // quotationItemId -> Set of inventoryItemIds
  const [quantities, setQuantities] = useState({}); // quotationItemId -> string (group lines)
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
      setActiveTab(loaded[0] ? String(loaded[0].quotationItemId) : null);

      if (isEdit) {
        const nextModes = {};
        const nextPicked = {};
        const nextQty = {};
        loaded.forEach((l) => {
          const key = String(l.quotationItemId);
          if ((l.selectedUnitIds || []).length) {
            nextPicked[key] = new Set(l.selectedUnitIds.map(String));
            /*
              Reopened as ALL only when the claim really was everything
              creditable. Defaulting to ALL would silently widen a hand-picked
              claim the moment somebody opened the note to fix its reason.
            */
            nextModes[key] = l.selectedUnitIds.length === l.creditableQuantity ? MODE.ALL : MODE.PICK;
          } else if (l.selectedQuantity) {
            nextQty[key] = String(l.selectedQuantity);
            nextModes[key] = l.selectedQuantity === l.creditableQuantity ? MODE.ALL : MODE.PICK;
          }
        });
        setModes(nextModes);
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

  const modeOf = useCallback((key) => modes[key] || MODE.NONE, [modes]);
  const setMode = (key, mode) => setModes((p) => ({ ...p, [key]: mode }));

  const toggleUnit = (key, unitId) => {
    setPicked((prev) => {
      const set = new Set(prev[key] || []);
      if (set.has(unitId)) set.delete(unitId);
      else set.add(unitId);
      return { ...prev, [key]: set };
    });
    // Ticking a box IS picking — the radio follows the action rather than
    // making someone set the mode first and then wonder why nothing saved.
    setMode(key, MODE.PICK);
  };

  // What one product line currently claims, in units and in rupees.
  const lineClaim = useCallback(
    (l) => {
      const key = String(l.quotationItemId);
      const mode = modeOf(key);
      const isIndividual = l.trackingMethod === "individual";

      let qty = 0;
      if (mode === MODE.ALL) qty = l.creditableQuantity || 0;
      else if (mode === MODE.PICK) {
        qty = isIndividual ? picked[key]?.size || 0 : Number(quantities[key]) || 0;
      }
      const basic = qty * (l.rate || 0);
      return { qty, amount: Math.round(withGst(basic, l.gstRate) * 100) / 100 };
    },
    [modeOf, picked, quantities]
  );

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
    const itemsAmount = lines.reduce((s, l) => s + lineClaim(l).amount, 0);
    const extrasAmount = extras.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    return {
      itemsAmount: Math.round(itemsAmount * 100) / 100,
      extrasAmount: Math.round(extrasAmount * 100) / 100,
      total: Math.round((itemsAmount + extrasAmount) * 100) / 100,
    };
  }, [lines, lineClaim, extras]);

  const totalUnits = useMemo(
    () => lines.reduce((s, l) => s + lineClaim(l).qty, 0),
    [lines, lineClaim]
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
          const mode = modeOf(key);
          if (mode === MODE.NONE) return null;

          if (l.trackingMethod === "individual") {
            /*
              ALL sends every unit the server said was creditable, so what
              travels is always an explicit list. The server never has to
              re-interpret what "all" meant at the moment the form was open —
              by then another note may have taken some of those units.
            */
            const ids =
              mode === MODE.ALL
                ? l.units.filter((u) => !u.blockReason).map((u) => String(u._id))
                : [...(picked[key] || [])];
            return ids.length ? { quotationItemId: key, inventoryItemIds: ids } : null;
          }

          const qty = mode === MODE.ALL ? l.creditableQuantity || 0 : Number(quantities[key]) || 0;
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

  const active = lines.find((l) => String(l.quotationItemId) === activeTab) || null;
  const claimed = lines.filter((l) => lineClaim(l).qty > 0);

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
            <span>Payable <strong className="text-slate-900">{money(basePayable)}</strong></span>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} className="font-bold">&times;</button>
          </div>
        )}

        {/* ── Faulty items, one product per tab ────────────────── */}
        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-700">Faulty items</p>

          {loading ? (
            <p className="py-8 text-center text-sm text-slate-400">Loading items…</p>
          ) : lines.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">This invoice has no lines.</p>
          ) : (
            <>
              <div className="mb-5 flex flex-wrap gap-2">
                {lines.map((l) => {
                  const key = String(l.quotationItemId);
                  const on = activeTab === key;
                  const claim = lineClaim(l);
                  return (
                    <button
                      key={key} type="button" onClick={() => setActiveTab(key)}
                      className={`rounded-xl border px-4 py-2.5 text-left transition ${
                        on
                          ? "border-indigo-400 bg-indigo-50/60 shadow-sm"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <span className={`block text-sm font-semibold ${on ? "text-indigo-700" : "text-slate-800"}`}>
                        {l.productName}
                        {/* The badge is what makes tabs safe: what was decided
                            on a product is visible without opening it. */}
                        {claim.qty > 0 && (
                          <span className="ml-1.5 font-bold text-emerald-600">({claim.qty})</span>
                        )}
                      </span>
                      <span className="block text-[11px] text-slate-400">
                        {l.trackingMethod === "individual" ? "Individual" : "Group"} ·{" "}
                        {l.creditableQuantity} {unitLabel(l.unit)} creditable
                      </span>
                    </button>
                  );
                })}
              </div>

              {active && (
                <ProductPanel
                  line={active}
                  mode={modeOf(String(active.quotationItemId))}
                  onMode={(m) => setMode(String(active.quotationItemId), m)}
                  picked={picked[String(active.quotationItemId)]}
                  onToggleUnit={(id) => toggleUnit(String(active.quotationItemId), id)}
                  quantity={quantities[String(active.quotationItemId)] ?? ""}
                  onQuantity={(v) => {
                    setQuantities((p) => ({ ...p, [String(active.quotationItemId)]: v }));
                    setMode(String(active.quotationItemId), MODE.PICK);
                  }}
                  search={unitSearch[String(active.quotationItemId)] || ""}
                  onSearch={(v) => setUnitSearch((p) => ({ ...p, [String(active.quotationItemId)]: v }))}
                  claim={lineClaim(active)}
                />
              )}
            </>
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
          {/* Listed per product, because the tabs show only one at a time —
              without this you would have to click through them to find out
              what the note actually claims. */}
          {claimed.length > 0 && (
            <div className="mb-3 space-y-1">
              {claimed.map((l) => {
                const c = lineClaim(l);
                return (
                  <div key={String(l.quotationItemId)} className="flex justify-between text-sm">
                    <span className="text-slate-600">
                      {l.productName}
                      <span className="ml-1.5 text-xs text-slate-400">
                        {c.qty} {unitLabel(l.unit)}
                        {modeOf(String(l.quotationItemId)) === MODE.ALL ? " · all" : ""}
                      </span>
                    </span>
                    <span className="tabular-nums text-slate-800">{money(c.amount)}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="space-y-1.5 border-t border-slate-100 pt-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Faulty items{totalUnits > 0 ? ` (${totalUnits})` : ""}</span>
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

          {totalUnits > 0 && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 ring-1 ring-inset ring-amber-100">
              {totalUnits} inventory {totalUnits === 1 ? "unit" : "units"} will be marked faulty and leave available stock
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

/* ── One product's panel ───────────────────────────────────────── */
/* Declared at module scope, not inside the page: a component built */
/* during a render is a new type on every render, and React would    */
/* remount the whole unit list — losing scroll position on exactly   */
/* the list long enough to have one.                                 */
const ProductPanel = ({
  line: l, mode, onMode, picked, onToggleUnit,
  quantity, onQuantity, search, onSearch, claim,
}) => {
  const isIndividual = l.trackingMethod === "individual";
  const term = (search || "").trim().toLowerCase();
  const allAmount =
    Math.round(withGst((l.creditableQuantity || 0) * (l.rate || 0), l.gstRate) * 100) / 100;

  // Blocked units stay on screen with their reason. Hiding them would leave
  // someone hunting for stock they can see elsewhere.
  const visible = isIndividual
    ? l.units.filter((u) =>
        !term ||
        Object.values(u.fieldValues || {}).some((v) =>
          String(v ?? "").toLowerCase().includes(term)
        )
      )
    : [];

  const radio = (value, label, extra) => (
    <label
      className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm transition ${
        mode === value ? "border-indigo-300 bg-indigo-50/60" : "border-slate-200 hover:bg-slate-50"
      }`}
    >
      <span className="flex items-center gap-2.5">
        <input
          type="radio" name={`mode-${l.quotationItemId}`} checked={mode === value}
          onChange={() => onMode(value)}
          className="h-4 w-4 border-slate-300 text-indigo-600 focus:ring-indigo-500"
        />
        <span className="text-slate-800">{label}</span>
      </span>
      {extra}
    </label>
  );

  return (
    <div className="rounded-xl border border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5">
        <div>
          <p className="text-sm font-semibold text-slate-900">{l.productName}</p>
          <p className="text-xs text-slate-500">
            {money(l.rate)} each{l.gstRate > 0 ? ` + ${l.gstRate}% GST` : ""} ·
            {" "}Received {l.receivedQuantity}
            {l.focQuantity > 0 ? ` + ${l.focQuantity} FOC` : ""} ·
            {" "}{l.creditableQuantity} {unitLabel(l.unit)} still creditable
          </p>
        </div>
        {claim.qty > 0 && (
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
            {claim.qty} claimed · {money(claim.amount)}
          </span>
        )}
      </div>

      <div className="space-y-2 p-4">
        {radio(MODE.NONE, "Nothing from this product")}
        {radio(
          MODE.ALL,
          `All ${l.creditableQuantity} creditable ${unitLabel(l.unit) || "units"}`,
          l.creditableQuantity > 0 ? (
            <span className="text-sm font-semibold tabular-nums text-slate-900">{money(allAmount)}</span>
          ) : (
            <span className="text-xs text-slate-400">nothing creditable</span>
          )
        )}
        {radio(
          MODE.PICK,
          isIndividual ? "Pick units" : "Enter quantity",
          isIndividual ? (
            <span className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text" value={search}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => onSearch(e.target.value)}
                placeholder="Search serial / MAC…"
                className="w-48 rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </span>
          ) : (
            <input
              type="number" min="0" max={l.creditableQuantity}
              value={quantity}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => onQuantity(e.target.value)}
              disabled={l.creditableQuantity <= 0}
              placeholder={unitLabel(l.unit)}
              className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-400"
            />
          )
        )}

        {/* The unit list appears only while picking. Under "All" it is not a
            choice any more, and leaving it visible invites someone to click a
            box that will be overridden. */}
        {isIndividual && mode === MODE.PICK && (
          l.units.length === 0 ? (
            <p className="px-1 py-3 text-sm text-slate-400">No units recorded for this line.</p>
          ) : (
            <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
              {visible.map((u) => {
                const blocked = !!u.blockReason;
                const on = picked?.has(String(u._id));
                return (
                  <label
                    key={u._id}
                    className={`flex flex-wrap items-center gap-3 px-3 py-2 text-sm ${
                      blocked ? "cursor-not-allowed bg-slate-50 text-slate-400" : "cursor-pointer hover:bg-indigo-50/40"
                    }`}
                  >
                    <input
                      type="checkbox" disabled={blocked} checked={!!on}
                      onChange={() => onToggleUnit(String(u._id))}
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
                <p className="px-3 py-4 text-sm text-slate-400">No unit matches that search.</p>
              )}
            </div>
          )
        )}

        {isIndividual && mode === MODE.PICK && (picked?.size || 0) > 0 && (
          <p className="px-1 text-xs text-slate-500">
            {picked.size} of {l.units.filter((u) => !u.blockReason).length} selectable units picked
          </p>
        )}
      </div>
    </div>
  );
};

export default CreditNoteView;
