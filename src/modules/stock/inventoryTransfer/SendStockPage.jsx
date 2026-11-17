"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Plus, Trash2, ArrowRight, Truck, StickyNote, Boxes, Search, PackageSearch, X } from "lucide-react";
import { SearchableSelect, inputCls, unitLabel } from "@/modules/stock/shared/StockSharedUI";
import { fetchRequest, fetchSendOptions, fetchSendUnits, sendAgainstRequest } from "./transferApi";
import { BackHeader, StatusBadge, REQUEST_STATUS, ConfirmDialog, qtyText, fmtDateTime } from "./shared";

const BACK = "/stock/inventory/transfers/requests-to-us";

const unitName = (u) => {
  const vals = Object.values(u.fieldValues || {}).filter((v) => v !== null && v !== undefined && v !== "");
  return vals.length ? vals.join(" / ") : String(u._id).slice(-6).toUpperCase();
};

/*
  The units of one product going out. Nothing is listed until you search:
  type a serial or MAC (or scan it) and the matching free units drop down —
  click one, or press Enter for the first, to add it. Added units sit in the
  table below, each with an optional note for the receiver ("box damaged").
*/
const UnitPicker = ({ data, need, selected, notes, onSelected, onNote }) => {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const { fields, units } = data;
  const byId = new Map(units.map((u) => [String(u._id), u]));
  const full = selected.length >= need;
  const term = q.trim().toLowerCase();
  const matches = term
    ? units.filter((u) => !selected.includes(u._id) && Object.values(u.fieldValues || {}).some((v) => String(v ?? "").toLowerCase().includes(term))).slice(0, 8)
    : [];
  const add = (u) => {
    if (full) return;
    onSelected([...selected, u._id]);
    setQ("");
  };
  const cols = fields.length ? fields : [{ code: null, label: "Unit" }];
  const value = (u, f) => (f.code ? u.fieldValues?.[f.code] ?? "—" : unitName(u));

  return (
    <div className="mt-3 rounded-xl border border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-xl bg-slate-50 px-3 py-2.5">
        <p className="text-xs font-semibold text-slate-600">
          Pick units — <span className={full ? "text-emerald-600" : "text-amber-600"}>{selected.length} of {need}</span>
        </p>
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={q} disabled={full}
            onChange={(e) => { setQ(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => { if (e.key === "Enter" && matches[0]) { e.preventDefault(); add(matches[0]); } }}
            placeholder={full ? "All units picked" : `Search ${cols.map((f) => f.label).join(" / ")}…`}
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-100"
          />
          {open && term && (
            <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
              {matches.length ? matches.map((u) => (
                <button
                  key={u._id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => add(u)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-xs transition hover:bg-indigo-50"
                >
                  {cols.map((f) => (
                    <span key={f.label} className="min-w-0 flex-1 truncate">
                      <span className="text-slate-400">{f.label}: </span><span className="font-mono font-semibold text-slate-800">{value(u, f)}</span>
                    </span>
                  ))}
                </button>
              )) : (
                <p className="px-3 py-2.5 text-xs text-slate-400">No free unit matches “{q.trim()}”.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {selected.length === 0 ? (
        <p className="px-3 py-4 text-center text-xs text-slate-400">
          {units.length ? `Search and add ${need} unit${need === 1 ? "" : "s"} — ${units.length} free to send.` : "No units free to send."}
        </p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100 text-left font-semibold uppercase tracking-wide text-slate-500">
              <th className="w-10 px-3 py-2">#</th>
              {cols.map((f) => <th key={f.label} className="px-2 py-2">{f.label}</th>)}
              <th className="px-2 py-2">Note for receiver</th>
              <th className="w-10 px-2 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {selected.map((id, i) => {
              const u = byId.get(String(id));
              if (!u) return null;
              return (
                <tr key={id} className="bg-indigo-50/40">
                  <td className="px-3 py-2 font-semibold text-slate-400">{i + 1}</td>
                  {cols.map((f) => <td key={f.label} className="px-2 py-2 font-mono text-slate-800">{value(u, f)}</td>)}
                  <td className="px-2 py-1.5">
                    <input value={notes[id] || ""} onChange={(e) => onNote(id, e.target.value)} placeholder="optional" className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                  </td>
                  <td className="px-2 py-1.5">
                    <button type="button" title="Remove" onClick={() => onSelected(selected.filter((x) => x !== id))} className="rounded p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};

let partSeq = 0;
// A new product row goes on top, where it is seen first.
const blankPart = (product = null, qty = "") => ({
  key: `p${++partSeq}-${Date.now()}`,
  productDefinitionId: product?._id || "",
  qty,
  itemIds: [],
  unitNotes: {},
});

/*
  Send — its own page, opened from Requests to Us: what the branch asked for,
  against its request. Each request line (a category) is filled from one or
  more of its products. What is sent goes On the Way — it leaves Available
  here and lands there when they say All Received.
*/
const SendStockPage = () => {
  const { id } = useParams();
  const router = useRouter();
  const [request, setRequest] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetchRequest("to-us", id).then(setRequest).catch((e) => setError(e.message));
  }, [id]);
  const back = () => router.push(BACK);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 p-6 pb-12">
      <BackHeader
        onBack={back}
        title={request ? `Send Stock — ${request.requestNumber}` : "Send Stock"}
        subtitle={request && (
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-slate-800">{request.sourceBranchId?.name}</span>
            <ArrowRight className="h-3.5 w-3.5" />
            <span className="font-semibold text-slate-800">{request.requestingBranchId?.name}</span>
            <span>· Requested {fmtDateTime(request.requestedAt)}{request.requestedByName ? ` by ${request.requestedByName}` : ""}</span>
          </span>
        )}
      >
        {request && <StatusBadge status={request.status} map={REQUEST_STATUS} />}
      </BackHeader>
      {error ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500 shadow-sm">{error}</div>
      ) : !request ? (
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
      ) : request.status !== "PENDING" ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
          This request is not waiting to be sent — it is {REQUEST_STATUS[request.status]?.label}.
        </p>
      ) : (
        <SendForm request={request} onDone={back} />
      )}
    </div>
  );
};

const SendForm = ({ request, onDone }) => {
  const toName = request.requestingBranchId?.name || "";
  const [options, setOptions] = useState(null); // lineId → products with free stock
  const [parts, setParts] = useState({}); // lineId → product rows, newest first
  const [units, setUnits] = useState({}); // productId → { fields, units }
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  // A product's free units, once — when it is chosen and is tracked one by one.
  const asked = useRef(new Set());
  const loadUnits = (product) => {
    if (product?.trackingMethod !== "individual") return;
    const pid = String(product._id);
    if (asked.current.has(pid)) return;
    asked.current.add(pid);
    fetchSendUnits(request._id, pid).then((d) => setUnits((u) => ({ ...u, [pid]: d }))).catch((e) => toast.error(e.message));
  };

  useEffect(() => {
    fetchSendOptions(request._id)
      .then((o) => {
        setOptions(o);
        request.lines.forEach((l) => { if ((o[l._id] || []).length === 1) loadUnits(o[l._id][0]); });
        // A category with one product needs no choosing.
        setParts(Object.fromEntries(request.lines.map((l) => {
          const products = o[l._id] || [];
          return [l._id, [products.length === 1 ? blankPart(products[0], Math.min(l.requestedQty, products[0].available) || "") : blankPart()]];
        })));
      })
      .catch((e) => toast.error(e.message));
  }, [request]); // eslint-disable-line react-hooks/exhaustive-deps

  const productOf = (lineId, pid) => (options?.[lineId] || []).find((p) => String(p._id) === String(pid));

  const setPart = (lineId, key, patch) => setParts((ps) => ({ ...ps, [lineId]: ps[lineId].map((p) => (p.key === key ? { ...p, ...patch } : p)) }));
  const addPart = (lineId) => setParts((ps) => ({ ...ps, [lineId]: [blankPart(), ...ps[lineId]] }));
  const removePart = (lineId, key) => setParts((ps) => ({ ...ps, [lineId]: ps[lineId].filter((p) => p.key !== key) }));

  const sumOf = (lineId) => (parts[lineId] || []).reduce((s, p) => s + (p.productDefinitionId ? Number(p.qty) || 0 : 0), 0);
  const sending = useMemo(
    () => request.lines.flatMap((l) => (parts[l._id] || []).filter((p) => p.productDefinitionId && Number(p.qty) > 0).map((p) => ({ ...p, product: productOf(l._id, p.productDefinitionId) }))),
    [parts, options] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const short = request.lines.some((l) => sumOf(l._id) < l.requestedQty);

  const check = () => {
    if (!sending.length) return "Nothing to send — use Decline instead";
    for (const p of sending) {
      if (Number(p.qty) > (p.product?.available || 0)) return `${p.product?.name}: only ${qtyText(p.product?.available, p.product?.unit)} free`;
      if (p.product?.trackingMethod === "individual" && p.itemIds.length !== Number(p.qty)) return `${p.product?.name}: pick ${p.qty} unit(s)`;
    }
    const over = request.lines.find((l) => sumOf(l._id) > l.requestedQty);
    if (over) return `${over.categoryPath}: asked for ${qtyText(over.requestedQty, over.unit)} — sending more than that`;
    if (short && !reason.trim()) return "Say why less than asked is being sent";
    return null;
  };

  const submit = async () => {
    setBusy(true);
    try {
      await sendAgainstRequest(request._id, {
        note: note.trim(), reason: reason.trim(),
        lines: request.lines.map((l) => ({
          lineId: l._id,
          items: (parts[l._id] || []).filter((p) => p.productDefinitionId && Number(p.qty) > 0).map((p) => ({
            productDefinitionId: p.productDefinitionId,
            qty: Number(p.qty),
            inventoryItemIds: p.itemIds,
            unitNotes: Object.fromEntries(Object.entries(p.unitNotes).filter(([uid, v]) => p.itemIds.includes(uid) && v.trim())),
          })),
        })),
      });
      toast.success(`${request.requestNumber} sent — On the Way to ${toName}`);
      onDone();
    } catch (err) {
      toast.error(err.message);
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {request.remarks && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
          <StickyNote className="mt-0.5 h-4 w-4 shrink-0" /> <span><b>Remarks from {toName}:</b> {request.remarks}</span>
        </p>
      )}

      {request.lines.map((l, idx) => {
        const products = options?.[l._id] || [];
        const list = parts[l._id] || [];
        const sent = sumOf(l._id);
        const tone = sent > l.requestedQty ? "bg-rose-50 text-rose-700 ring-rose-200" : sent === l.requestedQty ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-700 ring-amber-200";
        const used = new Set(list.map((p) => p.productDefinitionId).filter(Boolean));
        return (
          <section key={l._id} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-2xl bg-slate-50/60 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">{idx + 1}</span>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100"><Boxes className="h-4 w-4" /></span>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">{l.categoryPath}</h2>
                  <p className="mt-0.5 text-xs text-slate-500">Asked <b className="text-slate-800">{qtyText(l.requestedQty, l.unit)}</b> — choose which products to send</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${tone}`}>Sending {qtyText(sent, l.unit)} of {qtyText(l.requestedQty, l.unit)}</span>
                {products.length > list.length && (
                  <button type="button" onClick={() => addPart(l._id)} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50">
                    <Plus className="h-3.5 w-3.5" /> Add Product
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3 border-t border-slate-100 px-6 pb-6 pt-5">
              {options === null ? (
                <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
              ) : products.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-slate-400"><PackageSearch className="h-4 w-4" /> No products in this category.</p>
              ) : list.map((p) => {
                const product = productOf(l._id, p.productDefinitionId);
                const individual = product?.trackingMethod === "individual";
                const qty = Number(p.qty) || 0;
                const over = product && qty > product.available;
                return (
                  // No overflow-hidden: the product picker opens below its row.
                  <div key={p.key} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-56 flex-1">
                        <SearchableSelect
                          value={p.productDefinitionId}
                          onChange={(v) => { setPart(l._id, p.key, { productDefinitionId: v, qty: "", itemIds: [], unitNotes: {} }); loadUnits(productOf(l._id, v)); }}
                          placeholder="Select product"
                          options={products
                            .filter((x) => String(x._id) === String(p.productDefinitionId) || !used.has(String(x._id)))
                            .map((x) => ({ value: String(x._id), label: `${x.name}  ·  ${qtyText(x.available, x.unit)} available` }))}
                        />
                      </div>
                      {product && (
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${product.available ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-rose-200"}`}>
                          Available {qtyText(product.available, product.unit)}
                        </span>
                      )}
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold text-slate-600">Send</label>
                        <div className="relative w-32">
                          <input
                            type="number" min="0" value={p.qty} disabled={!product}
                            onChange={(e) => {
                              let v = e.target.value === "" ? "" : Math.max(0, Number(e.target.value));
                              if (v !== "" && individual) v = Math.floor(v);
                              setPart(l._id, p.key, { qty: v, itemIds: p.itemIds.slice(0, Number(v) || 0) });
                            }}
                            className={`${inputCls} ${product?.unit ? "pr-16" : ""} ${over ? "border-rose-300" : ""}`}
                          />
                          {product?.unit && <span className="pointer-events-none absolute inset-y-0 right-2 my-auto h-fit rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">{unitLabel(product.unit)}</span>}
                        </div>
                      </div>
                      {list.length > 1 && (
                        <button type="button" title="Remove" onClick={() => removePart(l._id, p.key)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {over && <p className="mt-1.5 text-xs font-medium text-rose-600">Only {qtyText(product.available, product.unit)} free to send.</p>}
                    {individual && qty > 0 && (
                      units[p.productDefinitionId] ? (
                        <UnitPicker
                          data={units[p.productDefinitionId]} need={qty} selected={p.itemIds} notes={p.unitNotes}
                          onSelected={(ids) => setPart(l._id, p.key, { itemIds: ids })}
                          onNote={(uid, v) => setPart(l._id, p.key, { unitNotes: { ...p.unitNotes, [uid]: v } })}
                        />
                      ) : <div className="mt-3 h-24 animate-pulse rounded-xl bg-slate-100" />
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <section className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2">
        {short && (
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">Why less than asked? <span className="text-rose-500">*</span></label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. only 40 in stock" className={inputCls} />
          </div>
        )}
        <div className={short ? "" : "sm:col-span-2"}>
          <label className="mb-1.5 flex items-center gap-1 text-xs font-bold text-slate-700"><StickyNote className="h-3.5 w-3.5" /> Note for {toName}</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. sent by courier, reaches tomorrow" className={inputCls} />
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={onDone} className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50">Cancel</button>
        <button
          type="button" onClick={() => { const e = check(); if (e) toast.error(e); else setConfirming(true); }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
        >
          <Truck className="h-4 w-4" /> Send
        </button>
      </div>

      {confirming && (
        <ConfirmDialog
          busy={busy} tone="emerald" confirmLabel="Yes, send"
          message={<>Send this stock to <b>{toName}</b>? It leaves your Available now and reaches theirs when they say All Received.</>}
          detail={<ul className="space-y-0.5">{sending.map((p) => <li key={p.key}>• {p.product?.name} — <b>{qtyText(p.qty, p.product?.unit)}</b></li>)}</ul>}
          onConfirm={submit} onClose={() => setConfirming(false)}
        />
      )}
    </div>
  );
};

export default SendStockPage;
