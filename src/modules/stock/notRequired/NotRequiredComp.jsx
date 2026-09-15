"use client";

/*
  The Not Required register — everything the business decided not to order.

  One CARD per (quotation, vendor), not a row per product: that is the unit a
  reader thinks in — "what did we drop from this vendor on this quotation, and
  why". Paging rows would also split one vendor's products across two pages.

  Mostly read-only. The one action is "Mark as Required", and only on a vendor
  dropped WHOLE — that is the only case with nowhere else to undo it, because a
  dropped vendor no longer appears as workable on either board. Individual
  products go back on the Tracking Orders page, where they were decided.
*/

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import Pagination from "@/shared/ui/pagination/Pagination";
import OrderHistoryPopup, { historyCount } from "@/modules/stock/shared/OrderHistoryPopup";
import { Search, RotateCcw, Ban, Undo2, History } from "lucide-react";

const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const fmt = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "—";
const fmtTime = (d) =>
  d ? new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "";

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";
const labelCls = "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500";

const StatCard = ({ label, value }) => (
  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
    <p className="text-2xl font-bold tabular-nums text-slate-900">{value}</p>
    <p className="mt-0.5 text-xs font-semibold text-slate-500">{label}</p>
  </div>
);

/*
  Bring a dropped vendor back. Its excluded products are cleared and the order
  returns to Entity Pending on the Tracking Orders page — which is where the
  Not Required button lives, so anything that really should stay out can be
  taken out again there in one click.
*/
const MarkRequiredPopup = ({ card, onClose, onDone }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BACKEND_URL}/stock/tracking-orders/${card.trackingOrderId}/required`,
        { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include" }
      );
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed");
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-900/5"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <p className="text-base font-semibold tracking-tight text-slate-900">
          Mark {card.vendorName} as required?
        </p>
        {error && (
          <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-100">{error}</div>
        )}
        <p className="mt-2 text-sm text-slate-600">
          This vendor goes back to the Tracking Orders page at{" "}
          <span className="font-medium text-slate-800">Entity Pending</span>, with all{" "}
          {card.productCount} products available again. Anything that should still stay out can be
          marked Not Required there.
        </p>
        <div className="mt-5 flex justify-end gap-2.5">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="button" disabled={busy} onClick={submit}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Saving…" : "Mark as Required"}
          </button>
        </div>
      </div>
    </div>
  );
};

const VendorCard = ({ card, onOpenQuotation, onHistory, onMarkRequired }) => (
  <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-100 bg-slate-50/60 px-5 py-3">
      <button
        type="button"
        onClick={onOpenQuotation}
        className="text-sm font-bold tracking-tight text-indigo-600 transition hover:underline"
      >
        {card.quotationNumber || "—"}
      </button>
      <span className="text-slate-300">/</span>
      <span className="text-sm font-semibold text-slate-900">{card.vendorName || "—"}</span>

      {card.wholeVendor ? (
        <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
          whole vendor
        </span>
      ) : (
        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
          {card.productCount} of the order
        </span>
      )}
      {card.entityAlias ? (
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
          {card.entityAlias}
        </span>
      ) : null}

      <span className="ml-auto flex items-center gap-2">
        {historyCount(card) > 0 && (
          <button
            type="button" onClick={onHistory}
            className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200 transition hover:bg-amber-100"
            title="Resets and product decisions on this order"
          >
            <History className="h-3 w-3" /> History &middot; {historyCount(card)}
          </button>
        )}
        <span className="text-sm font-bold tabular-nums text-slate-900">{money(card.totalValue)}</span>
      </span>
    </div>

    <div className="p-5">
      {card.wholeVendor && card.reason ? (
        <div className="mb-3 rounded-xl bg-slate-50 px-3 py-2">
          <p className="text-sm text-slate-800">{card.reason}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {card.byName || "—"} &middot; {fmt(card.at)} {fmtTime(card.at)}
          </p>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-100">
        {card.products.map((p, i) => (
          <div
            key={i}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-50 px-3 py-2 text-sm last:border-b-0"
          >
            <span className="min-w-[160px] flex-1 font-medium text-slate-900">
              {p.productName || "—"}
              {p.categoryName ? (
                <span className="ml-2 text-xs font-normal text-slate-500">{p.categoryName}</span>
              ) : null}
            </span>
            <span className="text-xs tabular-nums text-slate-600">{p.quantity}</span>
            <span className="w-24 text-right text-xs font-semibold tabular-nums text-slate-800">
              {money(p.lineTotal)}
            </span>
            {/* Per-product reason only matters when the vendor is still in the
                flow — a whole-vendor drop already shows one reason above. */}
            {!card.wholeVendor ? (
              <span className="w-full text-xs text-slate-500 sm:w-auto sm:min-w-[200px]">
                {p.reason || "—"}
                <span className="ml-2 text-slate-400">
                  {p.byName} &middot; {fmt(p.at)}
                </span>
              </span>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          {card.wholeVendor
            ? "Nothing will be ordered from this vendor on this quotation."
            : "This vendor is still in the flow — these products go back on the Tracking Orders page."}
        </p>
        {card.wholeVendor && (
          <button
            type="button" onClick={onMarkRequired}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50"
          >
            <Undo2 className="h-3.5 w-3.5" /> Mark as Required
          </button>
        )}
      </div>
    </div>
  </div>
);

const NotRequiredComp = () => {
  const router = useRouter();
  const [cards, setCards] = useState([]);
  const [totals, setTotals] = useState({ vendors: 0, products: 0, value: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [popup, setPopup] = useState(null);

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search.trim()) qs.set("search", search.trim());
      if (dateFrom) qs.set("dateFrom", dateFrom);
      if (dateTo) qs.set("dateTo", dateTo);

      const res = await fetch(`${API_BACKEND_URL}/stock/not-required?${qs}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to load");
      // successResponseHandler lifts pagination to the top level — see the
      // shape note in getNotRequired.
      setCards(json.data?.cards || []);
      setTotals(json.data?.totals || { vendors: 0, products: 0, value: 0 });
      setPagination(json.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = () => {
    setPopup(null);
    load();
  };

  const clearFilters = () => {
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-slate-50/60">
      <div className="mx-auto max-w-6xl p-6 pb-12">
        <div className="mb-5">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Not Required</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Approved products that were not ordered, and why.
          </p>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-3 sm:max-w-2xl">
          <StatCard label="Vendors" value={totals.vendors} />
          <StatCard label="Products not ordered" value={totals.products} />
          <StatCard label="Value not ordered" value={money(totals.value)} />
        </div>

        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <label className={labelCls}>Search</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Quotation, vendor, product, reason…"
                  className={`${inputCls} pl-9`}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>From</label>
              <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>To</label>
              <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className={inputCls} />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Clear
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : cards.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
            <Ban className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-700">Nothing has been marked Not Required</p>
            <p className="mt-1 text-xs text-slate-500">
              Products dropped on the Tracking Orders page will be listed here.
            </p>
          </div>
        ) : (
          <>
            {cards.map((card) => (
              <VendorCard
                key={card.trackingOrderId}
                card={card}
                onOpenQuotation={() => router.push(`/stock/quotations/${card.sourceQuotationId}/view`)}
                onHistory={() => setPopup({ type: "history", card })}
                onMarkRequired={() => setPopup({ type: "markRequired", card })}
              />
            ))}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <Pagination
                currentPage={page}
                totalItems={pagination.total}
                itemsPerPage={limit}
                onPageChange={setPage}
                onItemsPerPageChange={(n) => { setLimit(n); setPage(1); }}
              />
            </div>
          </>
        )}
      </div>

      {popup?.type === "markRequired" && (
        <MarkRequiredPopup card={popup.card} onClose={() => setPopup(null)} onDone={refresh} />
      )}
      {popup?.type === "history" && (
        <OrderHistoryPopup row={popup.card} onClose={() => setPopup(null)} />
      )}
    </div>
  );
};

export default NotRequiredComp;
