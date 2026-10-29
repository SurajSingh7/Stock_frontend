"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowLeft, PackageCheck, Search, Ban, CircleSlash, XCircle, Repeat } from "lucide-react";
import { usePermissions } from "@/context/PermissionContext";
import { Modal, inputCls, unitLabel } from "@/modules/stock/shared/StockSharedUI";
import { ConditionBadge, SourceBadge, WarrantyBadge } from "@/modules/stock/inventory/itemBadges";
import { fetchRequest, fetchAvailableUnits, issueItems, receiveItems, swapItem, shortCloseRequest, rejectRequest, closeRequestLine } from "./itemRequestApi";
import {
  RequestStatusBadge,
  RequestTypeBadge,
  LineStatusBadge,
  SwapStatusBadge,
  replaceRows,
  ReasonChip,
  ReturnStateFields,
  ReturnStateBadge,
  emptyReturnState,
  returnStateOk,
  returnStateBody,
  IssuedProgress,
  RequestHistory,
  fmtDateTime,
  fmtQty,
  lineQty,
  hasIssueSide,
  hasReturnSide,
} from "./requestUi";

export const canDo = (permissions, isAdmin, action) => {
  if (isAdmin) return true;
  const mod = (permissions || []).find((m) => m.moduleKey === "item-requests");
  return (mod?.actions || []).map((a) => String(a).toUpperCase()).includes(action);
};

const isUnitLine = (line) => line.trackingMethod === "individual";

/* ============================================================= */
/* One line's picker inside the Issue modal — from ANY product   */
/* of the line's category, this branch's free stock only.        */
/* Individual: pick serials. Batch: a quantity per product.      */
/* ============================================================= */
const LinePicker = ({ request, line, pick, onPick }) => {
  const isUnit = isUnitLine(line);
  const left = line.remainingQty;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [productId, setProductId] = useState("");

  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const d = await fetchAvailableUnits(request._id, { lineId: line._id, search: search.trim(), productId });
        if (alive) { setData(d); setError(null); }
      } catch (err) {
        if (alive) setError(err.message);
      }
    }, search ? 300 : 0);
    return () => { alive = false; clearTimeout(t); };
  }, [request._id, line._id, search, productId]);

  const picked = pick.units;
  const toggle = (id) => {
    const n = new Set(picked);
    if (n.has(id)) n.delete(id);
    else if (n.size < left) n.add(id);
    else { toast.error(`Only ${lineQty(left, line)} left on this item`); return; }
    onPick({ ...pick, units: n });
  };
  const qtyTotal = Object.values(pick.qty).reduce((s, v) => s + (Number(v) || 0), 0);

  return (
    <div>
      <p className="mb-3 text-sm text-slate-500">
        <b className="text-slate-800">{line.categoryPath}</b> · left <b className="text-slate-800">{lineQty(left, line)}</b> · any product of this category can be given.
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
          <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-100">
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
                <span className="text-xs text-slate-500">free {fmtQty(p.availableQty)} {unitLabel(line.unit)}</span>
                <input
                  type="number" min="0" step="any" disabled={!p.availableQty}
                  value={pick.qty[p._id] ?? ""}
                  onChange={(e) => onPick({ ...pick, qty: { ...pick.qty, [p._id]: e.target.value }, free: { ...pick.free, [p._id]: p.availableQty } })}
                  className={`${inputCls} w-28 ${Number(pick.qty[p._id]) > p.availableQty ? "border-rose-400" : ""}`}
                />
              </div>
            ))
          )}
          <p className={`border-t border-slate-100 px-4 py-2 text-xs ${qtyTotal > left + 1e-9 ? "text-rose-600" : "text-slate-500"}`}>
            Total {fmtQty(qtyTotal)} of {lineQty(left, line)} left · taken oldest batch first
          </p>
        </div>
      )}
    </div>
  );
};

/* ============================================================= */
/* Issue — one handover for any of the request's open lines.     */
/* Pick for as many lines as there is stock for; the rest stays  */
/* pending.                                                      */
/* ============================================================= */
const emptyPick = () => ({ units: new Set(), qty: {}, free: {} });
const pickedQty = (line, p) => (isUnitLine(line) ? p.units.size : Object.values(p.qty).reduce((s, v) => s + (Number(v) || 0), 0));
const pickOk = (line, p) => {
  const n = pickedQty(line, p);
  if (n <= 0) return true; // nothing for this line this time
  if (isUnitLine(line)) return n <= line.remainingQty;
  return n <= line.remainingQty + 1e-9 && Object.entries(p.qty).every(([id, v]) => !(Number(v) > (p.free[id] ?? Infinity) + 1e-9));
};

const IssueModal = ({ request, onClose, onIssued }) => {
  const open = useMemo(() => request.lines.filter((l) => l.remainingQty > 0), [request.lines]);
  const [active, setActive] = useState(open[0]?._id);
  const [picks, setPicks] = useState(() => Object.fromEntries(open.map((l) => [l._id, emptyPick()])));
  const [busy, setBusy] = useState(false);

  const chosen = open.filter((l) => pickedQty(l, picks[l._id]) > 0);
  const valid = chosen.length > 0 && open.every((l) => pickOk(l, picks[l._id]));
  const activeLine = open.find((l) => l._id === active);

  const submit = async () => {
    setBusy(true);
    try {
      const lines = chosen.map((l) => {
        const p = picks[l._id];
        return isUnitLine(l)
          ? { requestLineId: l._id, inventoryItemIds: [...p.units] }
          : {
              requestLineId: l._id,
              quantities: Object.entries(p.qty).filter(([, v]) => Number(v) > 0).map(([productDefinitionId, v]) => ({ productDefinitionId, quantity: Number(v) })),
            };
      });
      await issueItems(request._id, { lines });
      toast.success(`Issued ${chosen.map((l) => `${l.categoryPath} ×${lineQty(pickedQty(l, picks[l._id]), l)}`).join(", ")} to ${request.subscriber?.orderId}`);
      onIssued();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} title={`Issue — ${request.requestNumber}`} maxWidth="max-w-4xl">
      <p className="mb-3 text-sm text-slate-500">
        To <b className="text-slate-800">{request.subscriber?.orderId}</b>
        {request.subscriber?.username ? ` · ${request.subscriber.username}` : ""} from <b className="text-slate-800">{request.branchId?.name}</b>.
        Pick for any items you have stock for — the rest stays pending.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {open.map((l) => {
          const n = pickedQty(l, picks[l._id]);
          const bad = !pickOk(l, picks[l._id]);
          return (
            <button
              key={l._id}
              type="button"
              onClick={() => setActive(l._id)}
              className={`rounded-xl border px-3 py-2 text-left transition ${
                active === l._id ? "border-indigo-400 bg-indigo-50 ring-2 ring-indigo-100" : "border-slate-200 bg-white hover:border-indigo-200"
              }`}
            >
              <span className="block max-w-56 truncate text-sm font-semibold text-slate-900" title={l.categoryPath}>{l.categoryPath}</span>
              <span className="mt-0.5 flex items-center gap-2 text-xs">
                <span className="text-slate-500">left {lineQty(l.remainingQty, l)}</span>
                {n > 0 && (
                  <span className={`rounded-full px-1.5 font-semibold ${bad ? "bg-rose-100 text-rose-700" : "bg-indigo-600 text-white"}`}>
                    {fmtQty(n)} picked
                  </span>
                )}
                {!l.availableQty && <span className="font-medium text-rose-600">no stock</span>}
              </span>
            </button>
          );
        })}
      </div>

      {activeLine && (
        <LinePicker
          key={activeLine._id}
          request={request}
          line={activeLine}
          pick={picks[activeLine._id]}
          onPick={(p) => setPicks((all) => ({ ...all, [activeLine._id]: p }))}
        />
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <p className="text-sm text-slate-600">
          {chosen.length === 0
            ? "Nothing picked yet"
            : chosen.map((l) => `${l.categoryPath} ×${lineQty(pickedQty(l, picks[l._id]), l)}`).join(" · ")}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
          <button type="button" disabled={!valid || busy} onClick={submit} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
            <PackageCheck className="h-4 w-4" /> {busy ? "Issuing…" : `Issue ${chosen.length} item(s)`}
          </button>
        </div>
      </div>
    </Modal>
  );
};

/* ============================================================= */
/* Receive — what came back from the subscriber, each with the   */
/* state it came back in — Condition + Working State.          */
/* ============================================================= */
const ReceiveModal = ({ request, onClose, onReceived }) => {
  const open = request.returnLines.filter((l) => l.remainingQty > 0);
  const [rows, setRows] = useState(() =>
    Object.fromEntries(open.map((l) => [l._id, { on: false, state: emptyReturnState(), quantity: String(l.remainingQty) }]))
  );
  const [busy, setBusy] = useState(false);
  const set = (id, patch) => setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }));
  const picked = open.filter((l) => rows[l._id]?.on);
  const valid =
    picked.length > 0 &&
    picked.every((l) => {
      const r = rows[l._id];
      if (!returnStateOk(r.state)) return false;
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
          ...returnStateBody(rows[l._id].state),
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
        Tick what has physically come back to <b className="text-slate-800">{request.branchId?.name}</b>, then check each: its condition (New / Used) and whether it works.
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
                  <div className="min-w-0 flex-1"><ReturnStateFields compact value={r.state} onChange={(state) => set(l._id, { state })} /></div>
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

/* ============================================================= */
/* Replace one row — the old item back, then the new one out, in */
/* one save. "Receive only" when there is no stock for the new   */
/* one yet; give it later from the same row.                     */
/* ============================================================= */
const SwapModal = ({ request, row, onClose, onDone }) => {
  const { old, line } = row;
  const isBatch = old.trackingMethod === "quantity";
  const due = old.remainingQty || 0; // still to come back
  const [receiveQty, setReceiveQty] = useState(String(due));
  const [state, setState] = useState(emptyReturnState);
  const noStock = !line.availableQty;
  const [giveNow, setGiveNow] = useState(!noStock);
  const [pick, setPick] = useState(emptyPick);
  const [busy, setBusy] = useState(false);

  const receiving = due > 0 ? (isBatch ? Number(receiveQty) || 0 : 1) : 0;
  const giveMax = Math.min(line.remainingQty, (line.givableQty || 0) + receiving);
  const giveLine = { ...line, remainingQty: giveMax };
  const giving = giveNow ? pickedQty(line, pick) : 0;

  const receiveOk = due <= 0 || (receiving > 0 && receiving <= due + 1e-9 && returnStateOk(state));
  const giveOk = !giveNow || (giving > 0 && pickOk(giveLine, pick));
  const valid = receiveOk && giveOk && (receiving > 0 || giving > 0);

  const submit = async () => {
    setBusy(true);
    try {
      const body = { returnLineId: old._id };
      if (receiving > 0) body.receive = { ...returnStateBody(state), ...(isBatch ? { quantity: receiving } : {}) };
      if (giving > 0)
        body.give = isUnitLine(line)
          ? { inventoryItemIds: [...pick.units] }
          : { quantities: Object.entries(pick.qty).filter(([, v]) => Number(v) > 0).map(([productDefinitionId, v]) => ({ productDefinitionId, quantity: Number(v) })) };
      await swapItem(request._id, body);
      toast.success(giving > 0 ? `${old.label} replaced` : `${old.label} received — give the new one when you have it`);
      onDone();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const step = "mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800";
  const num = "flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white";

  return (
    <Modal onClose={onClose} title={`Replace ${old.label}`} maxWidth="max-w-3xl">
      <p className="mb-4 text-sm text-slate-500">
        {old.productName} with <b className="text-slate-800">{request.subscriber?.orderId}</b> · new one from <b className="text-slate-800">{request.branchId?.name}</b>, same category ({line.categoryPath}).
      </p>

      <div className="mb-4 rounded-xl border border-slate-200 p-4">
        <p className={step}><span className={num}>1</span> Old item back</p>
        {due <= 0 ? (
          <p className="text-sm text-emerald-700">Already received{isBatch ? ` (${lineQty(old.receivedQty, old)})` : ""}.</p>
        ) : (
          <div>
            {isBatch && (
              <label className="mb-2 flex items-center gap-1.5 text-sm text-slate-600">
                Came back
                <input type="number" min="0" step="any" value={receiveQty} onChange={(e) => setReceiveQty(e.target.value)} className={`${inputCls} w-24 ${receiving > due + 1e-9 ? "border-rose-400" : ""}`} />
                of {lineQty(due, old)}
              </label>
            )}
            <ReturnStateFields value={state} onChange={setState} />
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className={`${step} mb-0`}><span className={num}>2</span> New item in its place</p>
          {due > 0 && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={!giveNow} onChange={() => setGiveNow(!giveNow)} className="h-4 w-4 accent-indigo-600" />
              Receive only now — give the new one later
            </label>
          )}
        </div>
        {noStock && <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">No free stock of {line.categoryPath} at {request.branchId?.name} right now.</p>}
        {giveNow ? (
          giveMax > 0 ? (
            <LinePicker request={request} line={giveLine} pick={pick} onPick={setPick} />
          ) : (
            <p className="text-sm text-slate-400">{isBatch ? "Enter how much came back first." : "Receive the old item first."}</p>
          )
        ) : (
          <p className="text-sm text-slate-500">The row will show “Received — give new”. Use <b>Give new</b> on it when the stock is in.</p>
        )}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
        <button type="button" disabled={!valid || busy} onClick={submit} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
          <Repeat className="h-4 w-4" /> {busy ? "Saving…" : giving > 0 ? (receiving > 0 ? "Replace" : "Give new") : "Receive only"}
        </button>
      </div>
    </Modal>
  );
};

/* ============================================================= */
/* Replace rows — each old item with the new one in its place    */
/* ============================================================= */
const ReplaceRows = ({ request, canSwap, canCloseRow, onSwap, onCloseRow }) => {
  const rows = replaceRows(request);
  const conditionsOf = (id) =>
    request.receipts.flatMap((rc) => rc.lines.filter((l) => String(l.returnLineId) === String(id)).map((l) => ({ ...l, at: rc.at })));
  return (
    <div className="overflow-x-auto">
      <table className="mt-4 w-full min-w-[720px] text-sm">
        <thead className="border-b border-slate-100">
          <tr>
            <th className={th}>Old item</th>
            <th className={th}>Back</th>
            <th className={th}>New item</th>
            <th className={th}>Status</th>
            <th className={th} />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {rows.map(({ old, line, given }) => {
            const back = conditionsOf(old._id);
            const isBatch = old.trackingMethod === "quantity";
            const open = line && line.remainingQty > 0;
            return (
              <tr key={old._id} className={line?.swapStatus === "CLOSED" ? "bg-slate-50/70" : ""}>
                <td className="px-3 py-2.5 align-top">
                  <p className="font-mono font-medium text-slate-900">{old.label}</p>
                  <p className="text-xs text-slate-500">{old.productName}{isBatch ? ` · ${lineQty(old.requestedQty, old)}` : ""}</p>
                </td>
                <td className="px-3 py-2.5 align-top">
                  {back.length === 0 ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    back.map((b, k) => (
                      <p key={k} className="text-xs">
                        <ReturnStateBadge line={b} />
                        {isBatch && <span className="ml-1 tabular-nums text-slate-600">{fmtQty(b.quantity)}</span>}
                        {b.note && <span className="ml-1 text-slate-500">{b.note}</span>}
                      </p>
                    ))
                  )}
                </td>
                <td className="px-3 py-2.5 align-top">
                  {given.length ? <p className="font-mono text-xs text-slate-800">{given.join(", ")}</p> : <span className="text-slate-400">—</span>}
                  {line?.closure?.reason && <p className="mt-0.5 text-xs text-slate-500">closed: {line.closure.reason}</p>}
                </td>
                <td className="px-3 py-2.5 align-top">{line && <SwapStatusBadge status={line.swapStatus} />}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right align-top">
                  {open && canSwap && (old.remainingQty > 0 || line.givableQty > 0) && (
                    <button type="button" onClick={() => onSwap({ old, line })} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-700">
                      <Repeat className="h-3.5 w-3.5" /> {old.remainingQty > 0 ? "Replace" : "Give new"}
                    </button>
                  )}
                  {open && canCloseRow && (
                    <button type="button" onClick={() => onCloseRow({ old, line })} className="ml-1 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-rose-50 hover:text-rose-600" title="Close this row — nothing more is replaced on it">
                      <XCircle className="h-3.5 w-3.5" /> Close
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
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
/* The outgoing lines — one row per category asked for           */
/* ============================================================= */
const th = "px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-500";

const LinesTable = ({ request, open, canCloseLine, onCloseLine }) => (
  <div className="overflow-x-auto">
    <table className="mt-4 w-full min-w-[640px] text-sm">
      <thead className="border-b border-slate-100">
        <tr>
          <th className={th}>Item</th>
          <th className={`${th} text-right`}>Requested</th>
          <th className={`${th} text-right`}>Issued</th>
          <th className={`${th} text-right`}>Left</th>
          {open && <th className={`${th} text-right`}>Free at branch</th>}
          <th className={th}>Status</th>
          {canCloseLine && <th className={th} />}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {request.lines.map((l) => (
          <tr key={l._id} className={l.status === "CLOSED" ? "bg-slate-50/70" : ""}>
            <td className="px-3 py-2.5 align-top">
              <p className="font-medium text-slate-900">{l.categoryPath}</p>
              {l.issuedByProduct.length > 0 && (
                <p className="mt-0.5 text-xs text-slate-500">given: {l.issuedByProduct.map((g) => `${g.productName} ×${fmtQty(g.quantity)}`).join(", ")}</p>
              )}
              {l.closure?.reason && <p className="mt-0.5 text-xs text-slate-500">closed: {l.closure.reason}</p>}
            </td>
            <td className="px-3 py-2.5 text-right align-top tabular-nums text-slate-700">{lineQty(l.requestedQty, l)}</td>
            <td className={`px-3 py-2.5 text-right align-top tabular-nums ${l.issuedQty >= l.requestedQty ? "text-emerald-700" : "text-slate-700"}`}>{fmtQty(l.issuedQty)}</td>
            <td className="px-3 py-2.5 text-right align-top font-semibold tabular-nums text-slate-900">{l.remainingQty > 0 ? fmtQty(l.remainingQty) : "—"}</td>
            {open && (
              <td className={`px-3 py-2.5 text-right align-top tabular-nums ${l.remainingQty > 0 && !l.availableQty ? "font-semibold text-rose-600" : "text-slate-600"}`}>
                {l.remainingQty > 0 ? fmtQty(l.availableQty || 0) : "—"}
              </td>
            )}
            <td className="px-3 py-2.5 align-top"><LineStatusBadge status={l.status} /></td>
            {canCloseLine && (
              <td className="px-3 py-2.5 text-right align-top">
                {l.remainingQty > 0 && (
                  <button type="button" onClick={() => onCloseLine(l)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-rose-50 hover:text-rose-600" title="Close this item — nothing more goes out on it">
                    <XCircle className="h-3.5 w-3.5" /> Close item
                  </button>
                )}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

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
  const [asking, setAsking] = useState(null); // "close" | "reject" | { line } | { line, old } (replace row)
  const [swapping, setSwapping] = useState(null); // { old, line }

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
  const anyFree = !!request?.lines?.some((l) => l.remainingQty > 0 && l.availableQty > 0);
  const canIssue = open && hasIssueSide(request.type) && request.remainingQty > 0 && canDo(permissions, isAdmin, "ISSUE");
  const canReceive = open && hasReturnSide(request.type) && request.returnRemainingQty > 0 && canDo(permissions, isAdmin, "RECEIVE");
  const isReplace = request?.type === "REPLACE";
  const moved = (request?.issuedQty || 0) > 0 || (request?.returnReceivedQty || 0) > 0;
  const canClose = open && moved && canDo(permissions, isAdmin, "SHORT_CLOSE");
  const canCloseLine = open && hasIssueSide(request.type) && canDo(permissions, isAdmin, "SHORT_CLOSE");
  const canReject = request?.status === "PENDING" && !moved && canDo(permissions, isAdmin, "REJECT");
  const canSwap = open && isReplace && canDo(permissions, isAdmin, "RECEIVE") && canDo(permissions, isAdmin, "ISSUE");
  const extra = useMemo(() => Object.entries(request?.subscriber?.extraFields || {}).filter(([, v]) => v), [request]);
  const lineName = (id) => request?.lines?.find((l) => String(l._id) === String(id))?.categoryPath || "";

  if (error) return <div className="p-6"><div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div></div>;
  if (!request) return <div className="p-6"><div className="h-40 animate-pulse rounded-2xl bg-white" /></div>;

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <button type="button" onClick={() => router.push(`/stock/item-requests?type=${request.type || "ISSUE"}`)} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800">
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
          {request.reason?.code && (
            <p className="mt-1.5 text-sm text-slate-600">Reason: <ReasonChip type={request.type} reason={request.reason} /></p>
          )}
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
              <CircleSlash className="h-4 w-4" /> Short Close All
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

      {request.openElsewhere?.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">⚠ This subscriber is also waiting for the same item(s) from another branch</p>
          <ul className="mt-1 space-y-0.5">
            {request.openElsewhere.map((o) => (
              <li key={`${o.requestId}-${o.categoryId}`}>
                {o.categoryPath} — {lineQty(o.remainingQty, request.lines.find((l) => String(l.categoryId) === String(o.categoryId)))} pending at <b>{o.branchName}</b> on{" "}
                <button type="button" onClick={() => router.push(`/stock/item-requests/${o.requestId}`)} className="font-mono font-semibold text-indigo-700 hover:underline">
                  {o.requestNumber}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-amber-800">Check before issuing, so the subscriber is not given the same thing twice.</p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {isReplace && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Items to replace</p>
                  <p className="mt-0.5 text-sm text-slate-500">Take the old one back, then give a new one of the same category · {request.branchId?.name}</p>
                </div>
                <div className="w-40">
                  <p className="mb-0.5 text-[10px] font-semibold uppercase text-slate-400">Replaced</p>
                  <IssuedProgress issued={request.issuedQty} requested={request.requestedQty} />
                </div>
              </div>
              <ReplaceRows request={request} canSwap={canSwap} canCloseRow={canCloseLine} onSwap={setSwapping} onCloseRow={({ old, line }) => setAsking({ line, old })} />
            </div>
          )}

          {request.type === "RETURN" && (
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
                          <span className="ml-1"><ReturnStateBadge line={l} /></span>
                          {l.note && <span className="ml-2 text-xs text-slate-500">{l.note}</span>}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {hasIssueSide(request.type) && !isReplace && (<>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Requested items</p>
                <p className="mt-0.5 text-sm text-slate-500">{request.lines.length} item(s) · from {request.branchId?.name}</p>
              </div>
              <div className="flex items-center gap-6">
                <div className="w-40"><IssuedProgress issued={request.issuedQty} requested={request.requestedQty} /></div>
                {canIssue && (
                  <button
                    type="button"
                    disabled={!anyFree}
                    onClick={() => setIssuing(true)}
                    title={!anyFree ? "No free stock for any open item at this branch" : ""}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <PackageCheck className="h-4 w-4" /> Issue items
                  </button>
                )}
              </div>
            </div>
            <LinesTable request={request} open={open} canCloseLine={canCloseLine} onCloseLine={(line) => setAsking({ line })} />
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
                        {request.lines.length > 1 && lineName(il.requestLineId) && <span className="mr-1 text-xs text-slate-500">{lineName(il.requestLineId)} ·</span>}
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
      {swapping && <SwapModal request={request} row={swapping} onClose={() => setSwapping(null)} onDone={load} />}
      {asking === "reject" && (
        <ReasonModal
          title="Reject this request?"
          hint="Nothing has moved on it. The requester sees the reason and can edit and send it again, or withdraw it."
          confirmLabel="Reject"
          onClose={() => setAsking(null)}
          onConfirm={async (reason) => {
            try { await rejectRequest(request._id, reason); toast.success("Request rejected"); load(); } catch (err) { toast.error(err.message); throw err; }
          }}
        />
      )}
      {asking === "close" && (
        <ReasonModal
          title="Short-close the whole request?"
          hint={
            isReplace
              ? "Every row not yet replaced is closed. Old items already received stay in the store; old items not back stay with the subscriber. Nothing more is replaced on this request."
              : "Every item still pending is closed. What was issued stays with the subscriber; nothing more will be issued on this request. More needed later means a new request."
          }
          confirmLabel="Short Close All"
          onClose={() => setAsking(null)}
          onConfirm={async (reason) => {
            try { await shortCloseRequest(request._id, reason); toast.success("Request short-closed"); load(); } catch (err) { toast.error(err.message); throw err; }
          }}
        />
      )}
      {asking?.line && (
        <ReasonModal
          title={`Close “${asking.old ? asking.old.label : asking.line.categoryPath}”?`}
          hint={
            asking.old
              ? asking.old.receivedQty > 0
                ? "The old item is already in the store and stays there; no new one goes out for it. The other rows carry on."
                : "The old item stays with the subscriber and no new one goes out for it. The other rows carry on."
              : `${lineQty(asking.line.remainingQty, asking.line)} still pending on this item will not be issued. The other items carry on.`
          }
          confirmLabel="Close item"
          onClose={() => setAsking(null)}
          onConfirm={async (reason) => {
            try { await closeRequestLine(request._id, asking.line._id, reason); toast.success("Item closed"); load(); } catch (err) { toast.error(err.message); throw err; }
          }}
        />
      )}
    </div>
  );
};

export default ItemRequestDetail;
