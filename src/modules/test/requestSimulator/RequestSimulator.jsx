"use client";

/*
  🧪 TEST ONLY — Request Simulator.

  Pretends to be the NOC / broadband website: a subscriber list with row
  actions, raising Item Requests into the stock system through the same
  service the real website's API will use. Remove when the real site is live
  (see the backend's services/stock.test.simulator.service.js for the list).
*/

import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FlaskConical, Plus, PackagePlus, Undo2, Repeat, ListChecks, Search, Trash2 } from "lucide-react";
import { Modal, SearchableSelect, inputCls, unitLabel } from "@/modules/stock/shared/StockSharedUI";
import {
  RequestStatusBadge,
  RequestTypeBadge,
  LineStatusBadge,
  SwapStatusBadge,
  replaceRows,
  ReasonChip,
  IssuedProgress,
  RequestHistory,
  fmtDateTime,
  fmtQty,
  lineQty,
  hasReturnSide,
} from "@/modules/stock/itemRequests/requestUi";
import { fetchMeta, fetchSubscribers, fetchHoldings, addSubscriber, sendRequest, resendRequest, withdrawRequest } from "./simulatorApi";

const th = "px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 whitespace-nowrap";
const label = "text-xs font-semibold text-slate-600";

/* ── + Add Subscriber ─────────────────────────────────────────── */
const AddSubscriberModal = ({ serviceTypes, onClose, onAdded }) => {
  const [form, setForm] = useState({ orderId: "", username: "", serviceType: serviceTypes[0] || "", customerName: "", mobile: "", address: "", plan: "" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = async () => {
    setBusy(true);
    try {
      await addSubscriber(form);
      toast.success(`Subscriber ${form.orderId} added`);
      onAdded();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal onClose={onClose} title="Add test subscriber" maxWidth="max-w-lg">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={label}>Order ID *</label><input value={form.orderId} onChange={set("orderId")} placeholder="ORD-101" className={`${inputCls} mt-1`} /></div>
        <div><label className={label}>Username *</label><input value={form.username} onChange={set("username")} placeholder="amit123" className={`${inputCls} mt-1`} /></div>
        <div>
          <label className={label}>Service Type *</label>
          <select value={form.serviceType} onChange={set("serviceType")} className={`${inputCls} mt-1`}>
            {serviceTypes.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div><label className={label}>Plan</label><input value={form.plan} onChange={set("plan")} placeholder="100 Mbps" className={`${inputCls} mt-1`} /></div>
        <div><label className={label}>Customer name</label><input value={form.customerName} onChange={set("customerName")} className={`${inputCls} mt-1`} /></div>
        <div><label className={label}>Mobile</label><input value={form.mobile} onChange={set("mobile")} className={`${inputCls} mt-1`} /></div>
        <div className="sm:col-span-2"><label className={label}>Address</label><input value={form.address} onChange={set("address")} className={`${inputCls} mt-1`} /></div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
        <button type="button" disabled={busy || !form.orderId.trim() || !form.username.trim()} onClick={save} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? "Saving…" : "Add"}
        </button>
      </div>
    </Modal>
  );
};

/* ── Issue Item request (new, or edit & resend a rejected one) ──
   Up to 20 items, each a category and how many — which product goes out is
   the store's call. The same category twice is added up into one row. */
const MAX_ITEMS = 20;
let rowSeq = 0;
const newRow = (categoryId = "", quantity = "") => ({ key: `r${++rowSeq}`, categoryId, quantity });

const RequestModal = ({ meta, subscriber, existing, onClose, onSent, onOpenRequest }) => {
  const [branchId, setBranchId] = useState(existing ? String(existing.branchId) : "");
  const [rows, setRows] = useState(() =>
    existing?.lines?.length ? existing.lines.map((l) => newRow(String(l.categoryId), String(l.requestedQty))) : [newRow()]
  );
  const [remarks, setRemarks] = useState(existing?.remarks || "");
  const [busy, setBusy] = useState(false);

  const catById = useMemo(() => new Map(meta.categories.map((c) => [String(c._id), c])), [meta.categories]);
  const setRow = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const rowOk = (r) => {
    const c = catById.get(r.categoryId);
    const q = Number(r.quantity);
    return !!c && q > 0 && (c.trackingMethod === "quantity" || Number.isInteger(q));
  };
  const filled = rows.filter((r) => r.categoryId || r.quantity);
  const dupes = new Set(filled.map((r) => r.categoryId).filter((id, i, a) => id && a.indexOf(id) !== i));
  // Categories this subscriber cannot ask for again from the chosen branch:
  // still owed on an open issue request (until done or closed), or on a
  // rejected one (resend or withdraw that instead). The store refuses both.
  const openOn = new Map(); // categoryId → { request, rejected }
  (subscriber.requests || [])
    .filter((r) => (r.type || "ISSUE") === "ISSUE" && ["PENDING", "PARTIAL", "REJECTED"].includes(r.status) && String(r.branchId) === branchId && r._id !== existing?._id)
    .forEach((r) =>
      (r.lines || [])
        .filter((l) => r.status === "REJECTED" || ["PENDING", "PARTIAL"].includes(l.status))
        .forEach((l) => openOn.set(String(l.categoryId), { request: r, rejected: r.status === "REJECTED" }))
    );
  const blocked = filled.filter((r) => openOn.has(r.categoryId));
  // …and from OTHER branches: allowed, but shown, so it is not asked for twice by mistake.
  const openElsewhere = new Map();
  (subscriber.requests || [])
    .filter((r) => (r.type || "ISSUE") === "ISSUE" && ["PENDING", "PARTIAL"].includes(r.status) && branchId && String(r.branchId) !== branchId && r._id !== existing?._id)
    .forEach((r) =>
      (r.lines || [])
        .filter((l) => ["PENDING", "PARTIAL"].includes(l.status))
        .forEach((l) => {
          const k = String(l.categoryId);
          openElsewhere.set(k, [...(openElsewhere.get(k) || []), `${r.requestNumber} at ${r.branchName || "another branch"}`]);
        })
    );
  const valid = branchId && filled.length > 0 && filled.every(rowOk) && blocked.length === 0;

  const send = async () => {
    setBusy(true);
    try {
      const body = { branchId, items: filled.map((r) => ({ categoryId: r.categoryId, quantity: Number(r.quantity) })), remarks };
      const r = existing ? await resendRequest(existing._id, body) : await sendRequest(subscriber._id, body);
      toast.success(`${r.requestNumber} sent to the store`);
      (r.warnings || []).forEach((w) => toast(`⚠ ${w}`, { duration: 6000 }));
      onSent();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} title={existing ? `Edit & resend ${existing.requestNumber}` : `Issue Item — ${subscriber.orderId}`} maxWidth="max-w-2xl">
      {existing?.rejection?.reason && (
        <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">Store rejected it: {existing.rejection.reason}</p>
      )}
      <div className="space-y-4">
        <div>
          <label className={label}>Branch (stock is given from here) *</label>
          <div className="mt-1">
            <SearchableSelect value={branchId} onChange={setBranchId} options={meta.branches.map((b) => ({ value: String(b._id), label: b.name }))} placeholder="Select branch" />
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className={label}>Items * <span className="font-normal text-slate-400">— category and quantity, up to {MAX_ITEMS}</span></label>
            <span className="text-xs text-slate-400">{filled.length} item(s)</span>
          </div>
          <div className="rounded-xl border border-slate-200">
            <div className="grid grid-cols-[1fr_9rem_2.25rem] gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <span>Category</span>
              <span>Quantity</span>
              <span />
            </div>
            <div className="divide-y divide-slate-50">
              {rows.map((r) => {
                const c = catById.get(r.categoryId);
                const isUnits = c?.trackingMethod !== "quantity";
                const q = Number(r.quantity);
                const badQty = r.quantity !== "" && !(q > 0 && (!c || !isUnits || Number.isInteger(q)));
                return (
                  <div key={r.key} className="grid grid-cols-[1fr_9rem_2.25rem] items-start gap-2 px-3 py-2">
                    <div>
                      <SearchableSelect
                        value={r.categoryId}
                        onChange={(v) => setRow(r.key, { categoryId: v })}
                        options={meta.categories.map((x) => ({
                          value: String(x._id),
                          label: openOn.has(String(x._id))
                            ? `${x.path} — ${openOn.get(String(x._id)).rejected ? "rejected on" : "on"} ${openOn.get(String(x._id)).request.requestNumber}`
                            : x.path,
                        }))}
                        placeholder="Select category"
                      />
                      {openOn.has(r.categoryId) ? (
                        openOn.get(r.categoryId).rejected ? (
                          <div className="mt-1 rounded-lg bg-rose-50 px-2 py-1.5 text-[11px] text-rose-700">
                            <p className="font-medium">
                              On rejected request {openOn.get(r.categoryId).request.requestNumber} from this branch — edit &amp; resend it, or withdraw it, instead of a new request.
                            </p>
                            {onOpenRequest && (
                              <button
                                type="button"
                                onClick={() => onOpenRequest(openOn.get(r.categoryId).request)}
                                className="mt-1 rounded-md bg-rose-600 px-2 py-0.5 font-semibold text-white hover:bg-rose-700"
                              >
                                Open {openOn.get(r.categoryId).request.requestNumber}
                              </button>
                            )}
                          </div>
                        ) : (
                          <p className="mt-0.5 text-[11px] font-medium text-rose-600">
                            Already on open request {openOn.get(r.categoryId).request.requestNumber} from this branch — wait till it is issued or closed
                          </p>
                        )
                      ) : (
                        <>
                          {openElsewhere.has(r.categoryId) && (
                            <p className="mt-0.5 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
                              ⚠ Also pending for this subscriber on {openElsewhere.get(r.categoryId).join(", ")} — make sure it isn&apos;t asked twice
                            </p>
                          )}
                          {dupes.has(r.categoryId) && <p className="mt-0.5 text-[11px] text-amber-700">Listed again — the quantities are added up</p>}
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number" min="0" step={isUnits ? "1" : "any"} disabled={!c}
                        value={r.quantity} onChange={(e) => setRow(r.key, { quantity: e.target.value })}
                        placeholder={c ? "" : "—"}
                        className={`${inputCls} ${badQty ? "border-rose-400" : ""}`}
                      />
                      <span className="w-12 shrink-0 text-xs text-slate-500">{c ? (isUnits ? "units" : unitLabel(c.unit)) : ""}</span>
                    </div>
                    <button
                      type="button"
                      disabled={rows.length === 1}
                      onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                      title="Remove"
                      className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-slate-100 px-3 py-2">
              <button
                type="button"
                disabled={rows.length >= MAX_ITEMS}
                onClick={() => setRows((rs) => [...rs, newRow()])}
                className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:underline disabled:text-slate-400 disabled:no-underline"
              >
                <Plus className="h-4 w-4" /> Add item
              </button>
            </div>
          </div>
          <p className="mt-1 text-xs text-slate-400">The store decides which product(s) of each category to give.</p>
          {meta.mixedCategories?.length > 0 && (
            <p className="mt-1 text-xs text-amber-700">
              Not requestable until their products are counted the same way (units vs metres): {meta.mixedCategories.map((c) => c.path).join(", ")}
            </p>
          )}
        </div>

        <div>
          <label className={label}>Remarks</label>
          <input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. New fiber connection" className={`${inputCls} mt-1`} />
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
        <button type="button" disabled={!valid || busy} onClick={send} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? "Sending…" : existing ? "Send again" : `Send Request (${filled.length} item${filled.length === 1 ? "" : "s"})`}
        </button>
      </div>
    </Modal>
  );
};

/* ── Return / Replace — picked from what the subscriber holds ──── */
const ReturnModal = ({ meta, subscriber, type, existing, onClose, onSent }) => {
  const isReplace = type === "REPLACE";
  const [items, setItems] = useState(null);
  const [picked, setPicked] = useState(() =>
    Object.fromEntries((existing?.returnLines || []).map((l) => [String(l.inventoryItemId), String(l.requestedQty)]))
  );
  const [branchId, setBranchId] = useState(existing ? String(existing.branchId) : "");
  const [remarks, setRemarks] = useState(existing?.remarks || "");
  const [reason, setReason] = useState(existing?.reason?.code || "");
  const [reasonNote, setReasonNote] = useState(existing?.reason?.note || "");
  const reasons = meta.reasons?.[isReplace ? "REPLACE" : "RETURN"] || [];
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchHoldings(subscriber._id)
      .then((h) => setItems(h.items || []))
      .catch((err) => { toast.error(err.message); setItems([]); });
  }, [subscriber._id]);

  const chosen = (items || []).filter((i) => picked[String(i.inventoryItemId)] !== undefined);
  // A replace swaps each ticked item for a new one of its category, same quantity.
  const outgoing = chosen.map((i) => ({
    label: i.label,
    path: i.categoryPath,
    qty: Number(picked[String(i.inventoryItemId)]) || 0,
    unit: i.trackingMethod === "quantity" ? i.unit : null,
  }));

  const toggle = (i) => {
    const id = String(i.inventoryItemId);
    setPicked((p) => {
      const n = { ...p };
      if (n[id] !== undefined) delete n[id];
      else n[id] = i.trackingMethod === "quantity" ? String(i.quantity) : "1";
      return n;
    });
    if (!branchId && i.branchId) setBranchId(String(i.branchId));
  };

  const valid =
    branchId &&
    reason &&
    (reason !== "OTHER" || reasonNote.trim()) &&
    chosen.length > 0 &&
    chosen.every((i) => i.trackingMethod !== "quantity" || (Number(picked[String(i.inventoryItemId)]) > 0 && Number(picked[String(i.inventoryItemId)]) <= i.quantity));

  const send = async () => {
    setBusy(true);
    try {
      const body = {
        type,
        branchId,
        remarks,
        reason: { code: reason, note: reasonNote.trim() },
        items: chosen.map((i) => ({
          inventoryItemId: i.inventoryItemId,
          ...(i.trackingMethod === "quantity" ? { quantity: Number(picked[String(i.inventoryItemId)]) } : {}),
        })),
      };
      const r = existing ? await resendRequest(existing._id, body) : await sendRequest(subscriber._id, body);
      toast.success(`${r.requestNumber} sent to the store`);
      onSent();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title={existing ? `Edit & resend ${existing.requestNumber}` : `${isReplace ? "Replace Item" : "Return Item"} — ${subscriber.orderId}`}
      maxWidth="max-w-2xl"
    >
      {existing?.rejection?.reason && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">Store rejected it: {existing.rejection.reason}</p>}
      <p className="mb-3 text-sm text-slate-500">
        {isReplace
          ? "Tick the faulty item(s) to swap — any categories. The store takes them back and gives as many of each one's category."
          : "Tick what the subscriber is giving back."}
      </p>
      <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200">
        {items === null ? (
          <p className="px-4 py-6 text-center text-sm text-slate-400">Loading…</p>
        ) : items.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-400">This subscriber holds nothing from the store.</p>
        ) : (
          items.map((i) => {
            const id = String(i.inventoryItemId);
            const on = picked[id] !== undefined;
            const claimed = i.claimedBy && !(existing && existing.returnLines?.some((l) => String(l.inventoryItemId) === id));
            const disabled = !!claimed;
            return (
              <div key={id} className={`flex items-center gap-3 border-b border-slate-50 px-3 py-2 last:border-0 ${on ? "bg-indigo-50/50" : ""} ${disabled ? "opacity-50" : ""}`}>
                <input type="checkbox" checked={on} disabled={disabled} onChange={() => toggle(i)} className="h-4 w-4 accent-indigo-600" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-sm text-slate-900">{i.label}</span>
                  <span className="block text-xs text-slate-500">
                    {i.productName} · {i.categoryPath}
                    {claimed ? ` · already on ${i.claimedBy}` : ""}
                  </span>
                </span>
                {i.trackingMethod === "quantity" && (
                  <span className="flex items-center gap-1">
                    <input
                      type="number" min="0" step="any" disabled={!on} value={picked[id] ?? ""}
                      onChange={(e) => setPicked((p) => ({ ...p, [id]: e.target.value }))}
                      className={`${inputCls} w-24`}
                    />
                    <span className="text-xs text-slate-400">/ {fmtQty(i.quantity)} {unitLabel(i.unit)}</span>
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
      {isReplace && outgoing.length > 0 && (
        <div className="mt-2 rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-800">
          <p className="font-semibold">Each one is swapped — store takes it back, then gives a new one in its place:</p>
          {outgoing.map((o, k) => (
            <p key={k} className="mt-0.5"><span className="font-mono">{o.label}</span> → new {o.path}{o.unit ? ` ×${fmtQty(o.qty)} ${unitLabel(o.unit)}` : ""}</p>
          ))}
        </div>
      )}
      <div className="mt-3">
        <label className={label}>{isReplace ? "Why replace? *" : "Why return? *"}</label>
        <div className="mt-1 grid gap-1.5 sm:grid-cols-2">
          {reasons.map((r) => (
            <label
              key={r.code}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${reason === r.code ? "border-indigo-300 bg-indigo-50 font-semibold text-indigo-800" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
            >
              <input type="radio" name="reason" checked={reason === r.code} onChange={() => setReason(r.code)} className="h-4 w-4 accent-indigo-600" />
              {r.label}
            </label>
          ))}
        </div>
        {reason === "OTHER" && (
          <input value={reasonNote} onChange={(e) => setReasonNote(e.target.value)} placeholder="What is the reason? *" className={`${inputCls} mt-2 ${!reasonNote.trim() ? "border-rose-300" : ""}`} />
        )}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className={label}>Back to branch *</label>
          <div className="mt-1">
            <SearchableSelect value={branchId} onChange={setBranchId} options={meta.branches.map((b) => ({ value: String(b._id), label: b.name }))} placeholder="Select branch" />
          </div>
        </div>
        <div>
          <label className={label}>Remarks</label>
          <input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder={isReplace ? "e.g. red light since Monday" : "e.g. customer moving to Pune"} className={`${inputCls} mt-1`} />
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
        <button type="button" disabled={!valid || busy} onClick={send} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? "Sending…" : existing ? "Send again" : `Send ${isReplace ? "Replace" : "Return"} (${chosen.length})`}
        </button>
      </div>
    </Modal>
  );
};

/* ── A subscriber's requests, as the website would show them ──── */
/* A rejected request the subscriber no longer wants — gone for good, and its
   categories can be asked for afresh. Asks once more before doing it. */
const WithdrawButton = ({ request, onDone }) => {
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      await withdrawRequest(request._id);
      toast.success(`${request.requestNumber} withdrawn`);
      onDone();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
      setSure(false);
    }
  };
  return sure ? (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className="text-slate-600">Withdraw for good?</span>
      <button type="button" disabled={busy} onClick={go} className="rounded-lg bg-rose-600 px-2.5 py-1 font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
        {busy ? "…" : "Yes, withdraw"}
      </button>
      <button type="button" onClick={() => setSure(false)} className="rounded-lg border border-slate-200 px-2.5 py-1 font-semibold text-slate-600">No</button>
    </span>
  ) : (
    <button type="button" onClick={() => setSure(true)} className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50">
      Withdraw
    </button>
  );
};

const RequestsModal = ({ subscriber, onClose, onResend, onChanged }) => (
  <Modal onClose={onClose} title={`Requests — ${subscriber.orderId}`} maxWidth="max-w-2xl">
    {subscriber.requests.length === 0 ? (
      <p className="py-6 text-center text-sm text-slate-400">No requests yet</p>
    ) : (
      <div className="space-y-3">
        {subscriber.requests.map((r) => (
          <div key={r._id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-slate-900">{r.requestNumber}</span>
                <RequestTypeBadge type={r.type} />
                <RequestStatusBadge status={r.status} />
              </div>
              <div className="flex gap-4">
                {r.type === "RETURN" ? (
                  <IssuedProgress issued={r.returnReceivedQty} requested={r.returnRequestedQty} />
                ) : (
                  <IssuedProgress issued={r.issuedQty} requested={r.requestedQty} />
                )}
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-500">{r.branchName || ""} · {fmtDateTime(r.createdAt)}</p>
            {r.reason?.code && <div className="mt-1"><ReasonChip type={r.type} reason={r.reason} /></div>}
            {r.type === "REPLACE" && (
              <div className="mt-2 overflow-hidden rounded-lg border border-slate-100">
                {replaceRows(r).map(({ old, line, given }) => (
                  <div key={old._id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-b border-slate-50 px-3 py-1.5 text-sm last:border-0">
                    <span className="min-w-0 flex-1 truncate font-mono text-slate-800">{old.label}</span>
                    <span className="font-mono text-xs text-slate-600">→ {given.length ? given.join(", ") : "—"}</span>
                    {line && <SwapStatusBadge status={line.swapStatus} />}
                    {line?.closure?.reason && <span className="w-full text-xs text-slate-500">closed by store: {line.closure.reason}</span>}
                  </div>
                ))}
              </div>
            )}
            {r.type === "RETURN" && (
              <p className="mt-2 text-sm text-slate-700">
                Back: {r.returnLines.map((l) => `${l.label} ${fmtQty(l.receivedQty)}/${fmtQty(l.requestedQty)}`).join(", ")}
                {r.receipts.some((rc) => rc.lines.some((l) => l.condition === "FAULTY")) && <span className="ml-1 text-rose-600">(some faulty)</span>}
              </p>
            )}
            {r.type !== "RETURN" && r.type !== "REPLACE" && r.lines?.length > 0 && (
              <div className="mt-2 overflow-hidden rounded-lg border border-slate-100">
                {r.lines.map((l) => (
                  <div key={l._id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-b border-slate-50 px-3 py-1.5 text-sm last:border-0">
                    <span className="min-w-0 flex-1 truncate text-slate-800">{l.categoryPath}</span>
                    <span className="tabular-nums text-slate-600">{fmtQty(l.issuedQty)} / {lineQty(l.requestedQty, l)}</span>
                    <LineStatusBadge status={l.status} />
                    {l.issuedByProduct.length > 0 && (
                      <span className="w-full text-xs text-slate-500">given {l.issuedByProduct.map((g) => `${g.productName} ×${fmtQty(g.quantity)}`).join(", ")}</span>
                    )}
                    {l.closure?.reason && <span className="w-full text-xs text-slate-500">closed by store: {l.closure.reason}</span>}
                  </div>
                ))}
              </div>
            )}
            {r.issues.length > 0 && r.type !== "REPLACE" && (
              <p className="mt-2 font-mono text-xs text-slate-500">
                Given: {r.issues.flatMap((i) => i.lines.flatMap((l) => l.units)).join(", ")}
              </p>
            )}
            {r.rejection?.reason && <p className="mt-2 text-sm text-rose-700">Rejected: {r.rejection.reason}</p>}
            {r.closure?.reason && <p className="mt-2 text-sm text-slate-600">Short-closed: {r.closure.reason}</p>}
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-semibold text-slate-500">History</summary>
              <div className="mt-2"><RequestHistory history={r.history} /></div>
            </details>
            {r.status === "REJECTED" && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => onResend(r)} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">
                  Edit &amp; resend
                </button>
                <WithdrawButton request={r} onDone={onChanged} />
                <span className="text-[11px] text-slate-400">Until one of these, its items can&apos;t be asked for in a new request from this branch.</span>
              </div>
            )}
          </div>
        ))}
      </div>
    )}
  </Modal>
);

/* ── Page ─────────────────────────────────────────────────────── */
const RequestSimulator = () => {
  const [meta, setMeta] = useState(null);
  const [rows, setRows] = useState(null);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [requesting, setRequesting] = useState(null); // { subscriber, existing? }
  const [viewing, setViewing] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setRows(await fetchSubscribers(search.trim()));
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [search]);

  useEffect(() => {
    fetchMeta().then(setMeta).catch((err) => setError(err.message));
  }, []);
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  // Keep the open "Requests" popup in step after a resend.
  const viewingRow = useMemo(() => (viewing ? rows?.find((r) => r._id === viewing) : null), [viewing, rows]);

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <div className="mb-4 flex items-center gap-3 rounded-2xl border-2 border-dashed border-yellow-400 bg-yellow-50 px-5 py-3">
        <FlaskConical className="h-6 w-6 shrink-0 text-yellow-700" />
        <p className="text-sm text-yellow-900">
          <b>TEST ONLY — Request Simulator.</b> This page stands in for the NOC / broadband website. Requests raised here reach
          Item Requests exactly as the real website&apos;s will, marked <b>TEST</b>. It will be removed once the real site is connected.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Subscribers (test)</h1>
          <p className="mt-0.5 text-sm text-slate-500">Order ID · Username · Service Type, with the actions the real website will have.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative w-64">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className={`${inputCls} pl-9`} />
          </div>
          <button type="button" disabled={!meta} onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50">
            <Plus className="h-4 w-4" /> Add Subscriber
          </button>
        </div>
      </div>

      {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[1000px] border-collapse text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className={th}>Order ID</th>
              <th className={th}>Username</th>
              <th className={th}>Service Type</th>
              <th className={th}>Customer</th>
              <th className={th}>Mobile</th>
              <th className={th}>Plan</th>
              <th className={th}>Requests</th>
              <th className={th}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows === null ? (
              <tr><td colSpan={8} className="px-4 py-6"><div className="h-5 animate-pulse rounded bg-slate-100" /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-400">No test subscribers — add one to start.</td></tr>
            ) : (
              rows.map((s) => (
                <tr key={s._id}>
                  <td className="px-4 py-3 font-semibold text-slate-900">{s.orderId}</td>
                  <td className="px-4 py-3 text-slate-700">{s.username}</td>
                  <td className="px-4 py-3 text-slate-700">{s.serviceType}</td>
                  <td className="px-4 py-3 text-slate-600">{s.customerName || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{s.mobile || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{s.plan || "—"}</td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => setViewing(s._id)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:underline">
                      <ListChecks className="h-4 w-4" /> {s.requests.length}
                    </button>
                    {s.requests[0] && <span className="ml-2"><RequestStatusBadge status={s.requests[0].status} /></span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <button type="button" disabled={!meta} onClick={() => setRequesting({ subscriber: s })} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">
                        <PackagePlus className="h-3.5 w-3.5" /> Issue Item
                      </button>
                      <button type="button" disabled={!meta} onClick={() => setRequesting({ subscriber: s, type: "RETURN" })} className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-700">
                        <Undo2 className="h-3.5 w-3.5" /> Return Item
                      </button>
                      <button type="button" disabled={!meta} onClick={() => setRequesting({ subscriber: s, type: "REPLACE" })} className="inline-flex items-center gap-1 rounded-lg bg-orange-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-orange-600">
                        <Repeat className="h-3.5 w-3.5" /> Replace Item
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {adding && meta && <AddSubscriberModal serviceTypes={meta.serviceTypes} onClose={() => setAdding(false)} onAdded={load} />}
      {requesting && meta && (requesting.type || "ISSUE") === "ISSUE" && (
        <RequestModal
          meta={meta}
          subscriber={requesting.subscriber}
          existing={requesting.existing}
          onClose={() => setRequesting(null)}
          onSent={load}
          onOpenRequest={() => { setViewing(requesting.subscriber._id); setRequesting(null); }}
        />
      )}
      {requesting && meta && hasReturnSide(requesting.type) && (
        <ReturnModal meta={meta} subscriber={requesting.subscriber} type={requesting.type} existing={requesting.existing} onClose={() => setRequesting(null)} onSent={load} />
      )}
      {viewingRow && (
        <RequestsModal
          subscriber={viewingRow}
          onClose={() => setViewing(null)}
          onResend={(r) => { setViewing(null); setRequesting({ subscriber: viewingRow, existing: r, type: r.type }); }}
          onChanged={load}
        />
      )}
    </div>
  );
};

export default RequestSimulator;
