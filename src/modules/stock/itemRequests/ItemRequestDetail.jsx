"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowLeft, PackageCheck, Search, Ban, CircleSlash } from "lucide-react";
import { usePermissions } from "@/context/PermissionContext";
import { Modal, inputCls, unitLabel } from "@/modules/stock/shared/StockSharedUI";
import { ConditionBadge, SourceBadge, WarrantyBadge } from "@/modules/stock/inventory/itemBadges";
import { fetchRequest, fetchAvailableUnits, issueItems, receiveItems, shortCloseRequest, rejectRequest } from "./itemRequestApi";
import { RequestStatusBadge, RequestTypeBadge, IssuedProgress, RequestHistory, fmtDateTime, fmtQty, hasIssueSide, hasReturnSide } from "./requestUi";

export const canDo = (permissions, isAdmin, action) => {
  if (isAdmin) return true;
  const mod = (permissions || []).find((m) => m.moduleKey === "item-requests");
  return (mod?.actions || []).map((a) => String(a).toUpperCase()).includes(action);
};

// "5 units" / "12.5 Meter"
const qtyText = (n, request) => `${fmtQty(n || 0)} ${request.trackingMethod === "individual" ? "units" : unitLabel(request.unit)}`.trim();

/* ============================================================= */
/* Issue — from ANY product of the request's category.           */
/* Individual: pick serials (filter by product). Batch: a qty    */
/* per product. Only this branch's free stock is offered.        */
/* ============================================================= */
const IssueModal = ({ request, onClose, onIssued }) => {
  const isUnit = request.trackingMethod === "individual";
  const left = request.remainingQty;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [productId, setProductId] = useState("");
  const [picked, setPicked] = useState(new Set());
  const [qty, setQty] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const d = await fetchAvailableUnits(request._id, { search: search.trim(), productId });
        if (alive) { setData(d); setError(null); }
      } catch (err) {
        if (alive) setError(err.message);
      }
    }, search ? 300 : 0);
    return () => { alive = false; clearTimeout(t); };
  }, [request._id, search, productId]);

  const toggle = (id) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else if (n.size < left) n.add(id);
      else toast.error(`Only ${fmtQty(left)} left to issue on this request`);
      return n;
    });

  const qtyTotal = Object.values(qty).reduce((s, v) => s + (Number(v) || 0), 0);
  const qtyOk =
    qtyTotal > 0 &&
    qtyTotal <= left + 1e-9 &&
    (data?.products || []).every((p) => !(Number(qty[p._id]) > p.availableQty + 1e-9));
  const canSubmit = isUnit ? picked.size > 0 : qtyOk;

  const submit = async () => {
    setBusy(true);
    try {
      const body = isUnit
        ? { inventoryItemIds: [...picked] }
        : { quantities: Object.entries(qty).filter(([, v]) => Number(v) > 0).map(([productDefinitionId, v]) => ({ productDefinitionId, quantity: Number(v) })) };
      await issueItems(request._id, body);
      toast.success(`Issued ${isUnit ? picked.size : fmtQty(qtyTotal)} to ${request.subscriber?.orderId}`);
      onIssued();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} title={`Issue — ${request.categoryPath}`} maxWidth="max-w-2xl">
      <p className="mb-3 text-sm text-slate-500">
        To <b className="text-slate-800">{request.subscriber?.orderId}</b>
        {request.subscriber?.username ? ` · ${request.subscriber.username}` : ""} from <b className="text-slate-800">{request.branchId?.name}</b>.
        Left on this request: <b className="text-slate-800">{qtyText(left, request)}</b>. Any product of this category can be given.
      </p>
      {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      {isUnit ? (
        <>
          <div className="mb-2 flex flex-wrap gap-2">
            <div className="relative min-w-48 flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search serial / MAC…" className={`${inputCls} pl-9`} />
            </div>
            <div className="flex flex-wrap gap-1">
              {[{ _id: "", name: "All products" }, ...(data?.products || [])].map((p) => (
                <button
                  key={p._id || "all"}
                  type="button"
                  onClick={() => setProductId(String(p._id))}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                    productId === String(p._id) ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-100">
            {!data ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">Loading…</p>
            ) : data.units.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">No free unit at {request.branchId?.name}</p>
            ) : (
              data.units.map((u) => (
                <label key={u._id} className={`flex cursor-pointer items-center gap-3 border-b border-slate-50 px-3 py-2 last:border-0 hover:bg-indigo-50/50 ${picked.has(u._id) ? "bg-indigo-50" : ""}`}>
                  <input type="checkbox" checked={picked.has(u._id)} onChange={() => toggle(u._id)} className="h-4 w-4 accent-indigo-600" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-sm text-slate-900">{u.label}</span>
                    <span className="block text-xs text-slate-500">{u.productName}</span>
                  </span>
                  <span className="flex shrink-0 flex-wrap justify-end gap-1">
                    <ConditionBadge condition={u.condition} />
                    <SourceBadge source={u.source} />
                    <WarrantyBadge endDate={u.warranty?.endDate} />
                  </span>
                </label>
              ))
            )}
          </div>
          <p className="mt-2 text-xs text-slate-500">{picked.size} selected (max {fmtQty(left)})</p>
        </>
      ) : (
        <div className="rounded-xl border border-slate-200">
          {!data ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">Loading…</p>
          ) : (
            data.products.map((p) => (
              <div key={p._id} className="flex items-center gap-3 border-b border-slate-50 px-4 py-2.5 last:border-0">
                <span className="flex-1 text-sm font-medium text-slate-800">{p.name}</span>
                <span className="text-xs text-slate-500">free {fmtQty(p.availableQty)} {unitLabel(request.unit)}</span>
                <input
                  type="number" min="0" step="any" disabled={!p.availableQty}
                  value={qty[p._id] ?? ""} onChange={(e) => setQty((q) => ({ ...q, [p._id]: e.target.value }))}
                  className={`${inputCls} w-28 ${Number(qty[p._id]) > p.availableQty ? "border-rose-400" : ""}`}
                />
              </div>
            ))
          )}
          <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
            Total {fmtQty(qtyTotal)} of {qtyText(left, request)} left · taken oldest batch first
          </p>
        </div>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
        <button type="button" disabled={!canSubmit || busy} onClick={submit} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
          <PackageCheck className="h-4 w-4" /> {busy ? "Issuing…" : `Issue ${isUnit ? picked.size : fmtQty(qtyTotal)}`}
        </button>
      </div>
    </Modal>
  );
};

/* ============================================================= */
/* Receive — what came back from the subscriber, each with the   */
/* condition it came back in. Good → shelf, Faulty → FAULTY.     */
/* ============================================================= */
const ReceiveModal = ({ request, onClose, onReceived }) => {
  const open = request.returnLines.filter((l) => l.remainingQty > 0);
  const [rows, setRows] = useState(() =>
    Object.fromEntries(open.map((l) => [l._id, { on: false, condition: "GOOD", note: "", quantity: String(l.remainingQty) }]))
  );
  const [busy, setBusy] = useState(false);
  const set = (id, patch) => setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }));
  const picked = open.filter((l) => rows[l._id]?.on);
  const valid =
    picked.length > 0 &&
    picked.every((l) => {
      const r = rows[l._id];
      if (r.condition === "FAULTY" && !r.note.trim()) return false;
      if (l.trackingMethod === "quantity") return Number(r.quantity) > 0 && Number(r.quantity) <= l.remainingQty;
      return true;
    });

  const submit = async () => {
    setBusy(true);
    try {
      await receiveItems(
        request._id,
        picked.map((l) => ({
          returnLineId: l._id,
          condition: rows[l._id].condition,
          note: rows[l._id].note.trim(),
          ...(l.trackingMethod === "quantity" ? { quantity: Number(rows[l._id].quantity) } : {}),
        }))
      );
      toast.success(`Received ${picked.length} item(s) from ${request.subscriber?.orderId}`);
      onReceived();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} title={`Receive back — ${request.subscriber?.orderId}`} maxWidth="max-w-2xl">
      <p className="mb-3 text-sm text-slate-500">
        Tick what has physically come back to <b className="text-slate-800">{request.branchId?.name}</b>. Good goes back on the shelf; faulty goes to Faulty items with your note.
      </p>
      <div className="max-h-96 space-y-2 overflow-y-auto">
        {open.map((l) => {
          const r = rows[l._id];
          return (
            <div key={l._id} className={`rounded-xl border px-3 py-2.5 ${r.on ? "border-indigo-200 bg-indigo-50/40" : "border-slate-200"}`}>
              <label className="flex cursor-pointer items-center gap-3">
                <input type="checkbox" checked={r.on} onChange={() => set(l._id, { on: !r.on })} className="h-4 w-4 accent-indigo-600" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-sm text-slate-900">{l.label}</span>
                  <span className="block text-xs text-slate-500">{l.productName} · due {fmtQty(l.remainingQty)}{l.trackingMethod === "quantity" ? ` ${unitLabel(l.unit)}` : ""}</span>
                </span>
              </label>
              {r.on && (
                <div className="mt-2 flex flex-wrap items-center gap-2 pl-7">
                  {l.trackingMethod === "quantity" && (
                    <input type="number" min="0" step="any" value={r.quantity} onChange={(e) => set(l._id, { quantity: e.target.value })} className={`${inputCls} w-24`} />
                  )}
                  <div className="inline-flex rounded-lg border border-slate-200 p-0.5">
                    {["GOOD", "FAULTY"].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => set(l._id, { condition: c })}
                        className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                          r.condition === c ? (c === "GOOD" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white") : "text-slate-600"
                        }`}
                      >
                        {c === "GOOD" ? "Good" : "Faulty"}
                      </button>
                    ))}
                  </div>
                  <input
                    value={r.note}
                    onChange={(e) => set(l._id, { note: e.target.value })}
                    placeholder={r.condition === "FAULTY" ? "What is wrong? (required)" : "Note (optional)"}
                    className={`${inputCls} min-w-40 flex-1 ${r.condition === "FAULTY" && !r.note.trim() ? "border-rose-300" : ""}`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
        <button type="button" disabled={!valid || busy} onClick={submit} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
          {busy ? "Saving…" : `Receive ${picked.length}`}
        </button>
      </div>
    </Modal>
  );
};

const ReasonModal = ({ title, hint, confirmLabel, onClose, onConfirm }) => {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal onClose={onClose} title={title} maxWidth="max-w-md">
      <p className="mb-3 text-sm text-slate-500">{hint}</p>
      <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)" className={inputCls} />
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
        <button
          type="button"
          disabled={!reason.trim() || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm(reason.trim());
              onClose();
            } catch {
              // The caller has already shown the error; stay open so it can be retried.
            } finally {
              setBusy(false);
            }
          }}
          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
        >
          {busy ? "Please wait…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
};

/* ============================================================= */
/* Detail                                                         */
/* ============================================================= */
const ItemRequestDetail = ({ requestId }) => {
  const router = useRouter();
  const { permissions, isAdmin } = usePermissions();
  const [request, setRequest] = useState(null);
  const [error, setError] = useState(null);
  const [issuing, setIssuing] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const [asking, setAsking] = useState(null); // "close" | "reject"

  const load = useCallback(async () => {
    try {
      setRequest(await fetchRequest(requestId));
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [requestId]);

  useEffect(() => { load(); }, [load]);

  const open = request && ["PENDING", "PARTIAL"].includes(request.status);
  const canIssue = open && hasIssueSide(request.type) && request.remainingQty > 0 && canDo(permissions, isAdmin, "ISSUE");
  const canReceive = open && hasReturnSide(request.type) && request.returnRemainingQty > 0 && canDo(permissions, isAdmin, "RECEIVE");
  const canClose = request?.status === "PARTIAL" && canDo(permissions, isAdmin, "SHORT_CLOSE");
  const canReject = request?.status === "PENDING" && canDo(permissions, isAdmin, "REJECT");
  const extra = useMemo(() => Object.entries(request?.subscriber?.extraFields || {}).filter(([, v]) => v), [request]);

  if (error) return <div className="p-6"><div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div></div>;
  if (!request) return <div className="p-6"><div className="h-40 animate-pulse rounded-2xl bg-white" /></div>;

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <button type="button" onClick={() => router.push("/stock/item-requests")} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Item Requests
      </button>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-xl font-semibold text-slate-900">{request.requestNumber}</h1>
            <RequestTypeBadge type={request.type} />
            <RequestStatusBadge status={request.status} />
            {request.revision > 1 && <span className="text-xs font-semibold text-slate-400">revision {request.revision}</span>}
            {request.channel === "TEST_SIMULATOR" && <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-[11px] font-bold text-yellow-800">TEST</span>}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {request.type === "RETURN" ? "back to" : "branch"} <b className="text-slate-700">{request.branchId?.name}</b> · raised {fmtDateTime(request.createdAt)}
            {request.requestedBy?.name ? ` by ${request.requestedBy.name}` : ""}
          </p>
          {request.remarks && <p className="mt-1 text-sm text-slate-600">“{request.remarks}”</p>}
        </div>
        <div className="flex gap-2">
          {canReject && (
            <button type="button" onClick={() => setAsking("reject")} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50">
              <Ban className="h-4 w-4" /> Reject
            </button>
          )}
          {canClose && (
            <button type="button" onClick={() => setAsking("close")} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <CircleSlash className="h-4 w-4" /> Short Close
            </button>
          )}
        </div>
      </div>

      {request.rejection?.reason && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Rejected {fmtDateTime(request.rejection.at)}{request.rejection.by?.name ? ` by ${request.rejection.by.name}` : ""}: {request.rejection.reason}
        </div>
      )}
      {request.closure?.reason && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-700">
          Short-closed {fmtDateTime(request.closure.at)}{request.closure.by?.name ? ` by ${request.closure.by.name}` : ""}: {request.closure.reason}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {hasReturnSide(request.type) && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Coming back from the subscriber</p>
                  <p className="mt-0.5 text-sm text-slate-500">to {request.branchId?.name}</p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="w-40"><IssuedProgress issued={request.returnReceivedQty} requested={request.returnRequestedQty} /></div>
                  {canReceive && (
                    <button type="button" onClick={() => setReceiving(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">
                      <PackageCheck className="h-4 w-4" /> Receive
                    </button>
                  )}
                </div>
              </div>
              <table className="mt-4 w-full text-sm">
                <thead className="text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  <tr className="border-b border-slate-100">
                    <th className="py-2">Item</th>
                    <th className="py-2">Product</th>
                    <th className="py-2 text-right">Due</th>
                    <th className="py-2 text-right">Received</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {request.returnLines.map((l) => (
                    <tr key={l._id}>
                      <td className="py-2 font-mono text-slate-900">{l.label}</td>
                      <td className="py-2 text-slate-700">{l.productName}</td>
                      <td className="py-2 text-right tabular-nums text-slate-700">{fmtQty(l.requestedQty)}{l.trackingMethod === "quantity" ? ` ${unitLabel(l.unit)}` : ""}</td>
                      <td className={`py-2 text-right tabular-nums ${l.receivedQty >= l.requestedQty ? "text-emerald-700" : "text-slate-700"}`}>{fmtQty(l.receivedQty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {request.receipts.length > 0 && (
                <div className="mt-4 space-y-2">
                  {[...request.receipts].reverse().map((rc) => (
                    <div key={rc._id} className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-2.5">
                      <p className="text-xs text-slate-500">{fmtDateTime(rc.at)}{rc.by?.name ? ` · ${rc.by.name}` : ""}</p>
                      {rc.lines.map((l, k) => (
                        <p key={k} className="mt-0.5 text-sm text-slate-800">
                          <span className="font-mono">{l.label}</span> ×{fmtQty(l.quantity)}{" "}
                          <span className={`ml-1 rounded px-1.5 text-[11px] font-semibold ${l.condition === "GOOD" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                            {l.condition === "GOOD" ? "Good" : "Faulty"}
                          </span>
                          {l.note && <span className="ml-2 text-xs text-slate-500">{l.note}</span>}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {hasIssueSide(request.type) && (<>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{request.type === "REPLACE" ? "Going out in their place" : "Requested"}</p>
                <p className="mt-0.5 text-lg font-semibold text-slate-900">{request.categoryPath}</p>
              </div>
              <div className="flex items-center gap-6">
                <div className="w-40"><IssuedProgress issued={request.issuedQty} requested={request.requestedQty} /></div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Left</p>
                  <p className="text-lg font-semibold tabular-nums text-slate-900">{qtyText(request.remainingQty, request)}</p>
                </div>
                {canIssue && (
                  <button
                    type="button"
                    disabled={!request.availableQty}
                    onClick={() => setIssuing(true)}
                    title={!request.availableQty ? "No free stock of this category at this branch" : ""}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <PackageCheck className="h-4 w-4" /> Issue
                  </button>
                )}
              </div>
            </div>

            {(request.products.length > 0 || request.issuedByProduct.length > 0) && (
              <table className="mt-4 w-full text-sm">
                <thead className="text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  <tr className="border-b border-slate-100">
                    <th className="py-2">Product in this category</th>
                    <th className="py-2 text-right">Given</th>
                    {open && <th className="py-2 text-right">Free at {request.branchId?.name}</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {(open ? request.products : request.issuedByProduct.map((g) => ({ _id: g.productDefinitionId, name: g.productName }))).map((p) => {
                    const given = request.issuedByProduct.find((g) => String(g.productDefinitionId) === String(p._id))?.quantity || 0;
                    return (
                      <tr key={p._id}>
                        <td className="py-2 text-slate-800">{p.name}</td>
                        <td className="py-2 text-right tabular-nums text-slate-700">{fmtQty(given)}</td>
                        {open && <td className={`py-2 text-right tabular-nums ${p.availableQty ? "text-slate-700" : "text-rose-600"}`}>{fmtQty(p.availableQty)}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="mb-3 text-sm font-semibold text-slate-800">Handed over</p>
            {request.issues.length === 0 ? (
              <p className="text-sm text-slate-400">Nothing issued yet.</p>
            ) : (
              <div className="space-y-3">
                {[...request.issues].reverse().map((iss) => (
                  <div key={iss._id} className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                    <p className="text-xs text-slate-500">{fmtDateTime(iss.at)}{iss.by?.name ? ` · ${iss.by.name}` : ""}</p>
                    {iss.lines.map((il, k) => (
                      <p key={k} className="mt-1 text-sm text-slate-800">
                        <b>{il.productName}</b> ×{fmtQty(il.quantity)}
                        <span className="ml-2 font-mono text-xs text-slate-500">
                          {il.units.map((u) => (u.quantity ? `${u.label} (${fmtQty(u.quantity)})` : u.label)).join(", ")}
                        </span>
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
          </>)}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="mb-3 text-sm font-semibold text-slate-800">Subscriber</p>
            <dl className="grid grid-cols-3 gap-x-3 gap-y-2 text-sm">
              <dt className="text-slate-500">Order ID</dt><dd className="col-span-2 font-semibold text-slate-900">{request.subscriber?.orderId}</dd>
              <dt className="text-slate-500">Username</dt><dd className="col-span-2 text-slate-800">{request.subscriber?.username || "—"}</dd>
              <dt className="text-slate-500">Service</dt><dd className="col-span-2 text-slate-800">{request.subscriber?.serviceType || "—"}</dd>
              {extra.map(([k, v]) => (
                <React.Fragment key={k}><dt className="text-slate-500">{k}</dt><dd className="col-span-2 text-slate-800">{v}</dd></React.Fragment>
              ))}
            </dl>
            <button type="button" onClick={() => router.push(`/stock/subscriber-items?subscriberId=${request.subscriberId}`)} className="mt-3 text-sm font-semibold text-indigo-600 hover:underline">
              Everything this subscriber has →
            </button>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="mb-3 text-sm font-semibold text-slate-800">History</p>
            <RequestHistory history={request.history} />
          </div>
        </div>
      </div>

      {issuing && <IssueModal request={request} onClose={() => setIssuing(false)} onIssued={load} />}
      {receiving && <ReceiveModal request={request} onClose={() => setReceiving(false)} onReceived={load} />}
      {asking === "reject" && (
        <ReasonModal
          title="Reject this request?"
          hint="Nothing has been issued on it. The requester sees the reason and can edit and send it again."
          confirmLabel="Reject"
          onClose={() => setAsking(null)}
          onConfirm={async (reason) => {
            try { await rejectRequest(request._id, reason); toast.success("Request rejected"); load(); } catch (err) { toast.error(err.message); throw err; }
          }}
        />
      )}
      {asking === "close" && (
        <ReasonModal
          title="Short-close this request?"
          hint="What was issued stays with the subscriber; nothing more will be issued on this request. More needed later means a new request."
          confirmLabel="Short Close"
          onClose={() => setAsking(null)}
          onConfirm={async (reason) => {
            try { await shortCloseRequest(request._id, reason); toast.success("Request short-closed"); load(); } catch (err) { toast.error(err.message); throw err; }
          }}
        />
      )}
    </div>
  );
};

export default ItemRequestDetail;
