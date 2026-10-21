"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Users, Search } from "lucide-react";
import { inputCls, unitLabel } from "@/modules/stock/shared/StockSharedUI";
import { SourceBadge, WarrantyBadge } from "@/modules/stock/inventory/itemBadges";
import { fetchSubscribers, fetchSubscriberItems } from "./itemRequestApi";
import { fmtDateTime, fmtQty } from "./requestUi";

/* "What does ORD-101 have?" — every unit / batch currently issued to a subscriber. */
const SubscriberItems = () => {
  const router = useRouter();
  const params = useSearchParams();
  const [search, setSearch] = useState("");
  const [list, setList] = useState(null);
  const [selected, setSelected] = useState(params.get("subscriberId") || "");
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const rows = await fetchSubscribers(search.trim());
        if (alive) setList(rows);
      } catch (err) {
        if (alive) setError(err.message);
      }
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [search]);

  useEffect(() => {
    if (!selected) return;
    let alive = true;
    (async () => {
      try {
        const d = await fetchSubscriberItems(selected);
        if (alive) setDetail(d);
      } catch (err) {
        if (alive) setError(err.message);
      }
    })();
    return () => { alive = false; };
  }, [selected]);

  const extra = Object.entries(detail?.subscriber?.extraFields || {}).filter(([, v]) => v);

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Subscriber Items</h1>
        <p className="mt-0.5 text-sm text-slate-500">Which subscriber has which item — everything issued and not yet returned.</p>
      </div>
      {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Order ID or username…" className={`${inputCls} pl-9`} />
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {list === null ? (
              <p className="py-6 text-center text-sm text-slate-400">Loading…</p>
            ) : list.length === 0 ? (
              <div className="py-10 text-center">
                <Users className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2 text-sm text-slate-500">No subscriber holds stock yet</p>
              </div>
            ) : (
              list.map((s) => (
                <button
                  key={s.subscriberId}
                  type="button"
                  onClick={() => setSelected(String(s.subscriberId))}
                  className={`mb-1 block w-full rounded-xl px-3 py-2.5 text-left transition ${
                    selected === String(s.subscriberId) ? "bg-indigo-50 ring-1 ring-indigo-200" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">{s.orderId}</span>
                    <span className="text-xs font-semibold text-indigo-700">
                      {s.units ? `${s.units} unit${s.units > 1 ? "s" : ""}` : ""}
                      {s.units && s.batchQty ? " + " : ""}
                      {s.batchQty ? `${fmtQty(s.batchQty)} qty` : ""}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{s.username || "—"} · {s.serviceType || "—"}</p>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          {!selected ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-400">Pick a subscriber</div>
          ) : !detail ? (
            <div className="h-40 animate-pulse rounded-2xl bg-white" />
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-lg font-semibold text-slate-900">{detail.subscriber.orderId}</p>
                <p className="text-sm text-slate-500">{detail.subscriber.username || "—"} · {detail.subscriber.serviceType || "—"}</p>
                {extra.length > 0 && (
                  <p className="mt-2 text-xs text-slate-500">{extra.map(([k, v]) => `${k}: ${v}`).join(" · ")}</p>
                )}
              </div>
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-2">Product</th>
                      <th className="px-4 py-2">Serial / Qty</th>
                      <th className="px-4 py-2">Origin</th>
                      <th className="px-4 py-2">Warranty</th>
                      <th className="px-4 py-2">Request</th>
                      <th className="px-4 py-2">Issued</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detail.items.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Nothing with this subscriber right now</td></tr>
                    ) : (
                      detail.items.map((it) => (
                        <tr key={it._id}>
                          <td className="px-4 py-2.5 font-medium text-slate-900">{it.product?.name}</td>
                          <td className="px-4 py-2.5 font-mono text-slate-700">
                            {it.quantity === null ? it.label : `${fmtQty(it.quantity)} ${unitLabel(it.product?.unit)}`}
                          </td>
                          <td className="px-4 py-2.5"><SourceBadge source={it.source} /></td>
                          <td className="px-4 py-2.5"><WarrantyBadge endDate={it.warranty?.endDate} /></td>
                          <td className="px-4 py-2.5">
                            <button type="button" onClick={() => router.push(`/stock/item-requests/${it.assignedTo?.requestId}`)} className="font-mono text-indigo-600 hover:underline">
                              {it.assignedTo?.requestNumber}
                            </button>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-slate-500">{fmtDateTime(it.assignedTo?.assignedAt)}<div>{it.branch?.name}</div></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubscriberItems;
