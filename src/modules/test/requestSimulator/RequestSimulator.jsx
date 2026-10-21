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
import { FlaskConical, Plus, PackagePlus, Undo2, Repeat, ListChecks, Search } from "lucide-react";
import { Modal, SearchableSelect, inputCls, unitLabel } from "@/modules/stock/shared/StockSharedUI";
import { RequestStatusBadge, IssuedProgress, RequestHistory, fmtDateTime, fmtQty } from "@/modules/stock/itemRequests/requestUi";
import { fetchMeta, fetchSubscribers, addSubscriber, sendRequest, resendRequest } from "./simulatorApi";

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
   A category and how many — which product goes out is the store's call. */
const RequestModal = ({ meta, subscriber, existing, onClose, onSent }) => {
  const [branchId, setBranchId] = useState(existing ? String(existing.branchId) : "");
  const [categoryId, setCategoryId] = useState(existing ? String(existing.categoryId) : "");
  const [quantity, setQuantity] = useState(existing ? String(existing.requestedQty) : "");
  const [remarks, setRemarks] = useState(existing?.remarks || "");
  const [busy, setBusy] = useState(false);

  const category = meta.categories.find((c) => String(c._id) === categoryId);
  const isUnits = category?.trackingMethod !== "quantity";
  const qtyNum = Number(quantity);
  const valid = branchId && category && qtyNum > 0 && (!isUnits || Number.isInteger(qtyNum));

  const send = async () => {
    setBusy(true);
    try {
      const body = { branchId, categoryId, quantity: qtyNum, remarks };
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
    <Modal onClose={onClose} title={existing ? `Edit & resend ${existing.requestNumber}` : `Issue Item — ${subscriber.orderId}`} maxWidth="max-w-xl">
      {existing?.rejection?.reason && (
        <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">Store rejected it: {existing.rejection.reason}</p>
      )}
      <div className="space-y-3">
        <div>
          <label className={label}>Branch (stock is given from here) *</label>
          <div className="mt-1">
            <SearchableSelect value={branchId} onChange={setBranchId} options={meta.branches.map((b) => ({ value: String(b._id), label: b.name }))} placeholder="Select branch" />
          </div>
        </div>
        <div>
          <label className={label}>Category *</label>
          <div className="mt-1">
            <SearchableSelect value={categoryId} onChange={setCategoryId} options={meta.categories.map((c) => ({ value: String(c._id), label: c.path }))} placeholder="Select category" />
          </div>
          {meta.mixedCategories?.length > 0 && (
            <p className="mt-1 text-xs text-amber-700">
              Not requestable until their products are counted the same way (units vs metres): {meta.mixedCategories.map((c) => c.path).join(", ")}
            </p>
          )}
        </div>
        <div>
          <label className={label}>Quantity *</label>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="number" min="0" step={isUnits ? "1" : "any"} disabled={!category}
              value={quantity} onChange={(e) => setQuantity(e.target.value)}
              placeholder={category ? "" : "Pick a category first"} className={`${inputCls} w-40`}
            />
            <span className="text-sm text-slate-500">{category ? (isUnits ? "units" : unitLabel(category.unit)) : ""}</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">The store decides which product(s) of this category to give.</p>
        </div>
        <div>
          <label className={label}>Remarks</label>
          <input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. New fiber connection" className={`${inputCls} mt-1`} />
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
        <button type="button" disabled={!valid || busy} onClick={send} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? "Sending…" : existing ? "Send again" : "Send Request"}
        </button>
      </div>
    </Modal>
  );
};

/* ── A subscriber's requests, as the website would show them ──── */
const RequestsModal = ({ subscriber, onClose, onResend }) => (
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
                <RequestStatusBadge status={r.status} />
              </div>
              <IssuedProgress issued={r.issuedQty} requested={r.requestedQty} />
            </div>
            <p className="mt-1 text-xs text-slate-500">{r.categoryPath} · {r.branchName || ""} · {fmtDateTime(r.createdAt)}</p>
            <p className="mt-2 text-sm text-slate-700">
              Asked <b>{fmtQty(r.requestedQty)}</b> {r.trackingMethod === "quantity" ? unitLabel(r.unit) : "units"}
              {r.issuedByProduct.length > 0 && (
                <> · given {r.issuedByProduct.map((g) => `${g.productName} ×${fmtQty(g.quantity)}`).join(", ")}</>
              )}
            </p>
            {r.issues.length > 0 && (
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
              <button type="button" onClick={() => onResend(r)} className="mt-3 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">
                Edit &amp; resend
              </button>
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
  const soon = () => toast("Coming in the next phase", { icon: "🚧" });

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
                      <button type="button" onClick={soon} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-400" title="Next phase">
                        <Undo2 className="h-3.5 w-3.5" /> Return Item
                      </button>
                      <button type="button" onClick={soon} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-400" title="Next phase">
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
      {requesting && meta && (
        <RequestModal meta={meta} subscriber={requesting.subscriber} existing={requesting.existing} onClose={() => setRequesting(null)} onSent={load} />
      )}
      {viewingRow && (
        <RequestsModal
          subscriber={viewingRow}
          onClose={() => setViewing(null)}
          onResend={(r) => { setViewing(null); setRequesting({ subscriber: viewingRow, existing: r }); }}
        />
      )}
    </div>
  );
};

export default RequestSimulator;
