"use client";

/*
  The Skipped Orders register — everything the business decided not to order
  (the "not-required" module: route and permission keep their original key).

  One CARD per (quotation, vendor), not a row per product: that is the unit a
  reader thinks in — "what did we skip from this vendor on this quotation, and
  why". Paging rows would also split one vendor's products across two pages.

  Mostly read-only. The one action is "Mark as Required", and only on a vendor
  skipped WHOLE — that is the only case with nowhere else to undo it, because a
  skipped vendor no longer appears as workable on either board. Individual
  products go back on the Tracking Orders page, where they were decided.
*/

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { api } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/constants/api";
import Pagination from "@/shared/ui/pagination/Pagination";
import OrderHistoryPopup, { historyCount } from "@/modules/stock/shared/OrderHistoryPopup";
import { SearchableSelect, Modal } from "@/modules/stock/shared/StockSharedUI";
import { fetchVendors } from "@/modules/stock/shared/lookupsApi";
import useInternalEntities from "@/modules/stock/shared/useInternalEntities";
import DateRangeButton from "@/modules/stock/shared/DateRangeButton";
import { Search, RotateCcw, Ban, Undo2, History, MessageSquareText, ArrowLeft } from "lucide-react";

const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const fmt = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const fmtTime = (d) =>
  d ? new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "";

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";
const th = "px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-slate-500";

/*
  Bring a skipped vendor back. Its skipped products are cleared and the order
  returns to Entity Pending on the Tracking Orders page — which is where the
  Skip Order button lives, so anything that really should stay out can be
  skipped again there in one click.
*/
const MarkRequiredPopup = ({ card, onClose, onDone }) => {
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await api.patch(API_ENDPOINTS.purchase.trackingOrders.required(card.trackingOrderId), undefined, { fallback: "Failed" });
      toast.success(`${card.vendorName} is back on Tracking Orders`);
      onDone();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={busy ? () => {} : onClose} maxWidth="max-w-md">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100">
          <Undo2 className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-base font-semibold text-slate-900">Mark {card.vendorName} as required?</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            This vendor goes back to the Tracking Orders page at{" "}
            <span className="font-semibold text-slate-800">Entity Pending</span>, with all {card.productCount} products
            available again. Anything that should still stay out can be skipped there.
          </p>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2.5">
        <button
          type="button" onClick={onClose} disabled={busy}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button" disabled={busy} onClick={submit}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Please wait…" : "Mark as Required"}
        </button>
      </div>
    </Modal>
  );
};

const VendorCard = ({ sn, card, onOpenQuotation, onHistory, onMarkRequired }) => (
  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    {/* header — which quotation and vendor, how much, what kind of skip */}
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-100 bg-linear-to-r from-slate-50 to-white px-5 py-3.5">
      {/* running serial number across pages */}
      <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-indigo-50 px-2 text-xs font-bold text-indigo-600 ring-1 ring-inset ring-indigo-100 tabular-nums">
        {sn}
      </span>
      <button
        type="button" onClick={onOpenQuotation}
        className="rounded-lg bg-indigo-50 px-2.5 py-1 text-sm font-bold text-indigo-700 ring-1 ring-inset ring-indigo-100 transition hover:bg-indigo-100"
      >
        {card.quotationNumber || "—"}
      </button>
      <span className="text-base font-bold text-slate-900">{card.vendorName || "—"}</span>
      {card.wholeVendor ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 ring-1 ring-inset ring-rose-200">
          <Ban className="h-3 w-3" /> Whole order
        </span>
      ) : (
        <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 ring-1 ring-inset ring-amber-200">
          {card.productCount} product{card.productCount === 1 ? "" : "s"}
        </span>
      )}
      {card.entityAlias ? (
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
          {card.entityAlias}
        </span>
      ) : null}

      <span className="ml-auto flex items-center gap-3">
        {historyCount(card) > 0 && (
          <button
            type="button" onClick={onHistory}
            className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200 transition hover:bg-amber-100"
            title="Resets and product decisions on this order"
          >
            <History className="h-3 w-3" /> History · {historyCount(card)}
          </button>
        )}
        <span className="text-base font-extrabold tabular-nums text-slate-900">{money(card.totalValue)}</span>
        {card.wholeVendor && (
          <button
            type="button" onClick={onMarkRequired}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-500"
          >
            <Undo2 className="h-3.5 w-3.5" /> Mark as Required
          </button>
        )}
      </span>
    </div>

    {/* the table sits flush under the card header — no inner gap */}
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-100">
              <th className={th}>Product</th>
              <th className={th}>Category</th>
              <th className={th}>Reason</th>
              <th className={`${th} text-right`}>Qty</th>
              <th className={`${th} text-right`}>Value</th>
              <th className={th}>Skipped By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {card.products.map((p, i) => {
              // A whole-order skip carries one reason for all of it.
              const reason = p.reason || (card.wholeVendor ? card.reason : "");
              const by = p.byName || (card.wholeVendor ? card.byName : "");
              const at = p.at || (card.wholeVendor ? card.at : null);
              return (
                <tr key={i} className="transition hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-semibold text-slate-900">{p.productName || "—"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{p.categoryName || "—"}</td>
                  <td className="px-4 py-2.5">
                    {reason ? (
                      <span className="inline-flex items-start gap-1.5 text-slate-800">
                        <MessageSquareText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
                        {reason}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{p.quantity}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-slate-900">{money(p.lineTotal)}</td>
                  {/* who skipped it, and when — name over date */}
                  <td className="whitespace-nowrap px-4 py-2.5">
                    {by ? (
                      <span className="flex items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[11px] font-bold uppercase text-indigo-600 ring-1 ring-inset ring-indigo-100">
                          {by.charAt(0)}
                        </span>
                        <span className="leading-tight">
                          <span className="block text-sm font-semibold text-slate-800">{by}</span>
                          {at && <span className="block text-[11px] text-slate-500 tabular-nums">{fmt(at)} · {fmtTime(at)}</span>}
                        </span>
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

const NotRequiredComp = () => {
  const router = useRouter();
  const [cards, setCards] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [popup, setPopup] = useState(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [entityAlias, setEntityAlias] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [vendors, setVendors] = useState([]);
  const { aliases } = useInternalEntities();

  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 350); return () => clearTimeout(t); }, [search]);
  useEffect(() => { fetchVendors(1000).then(setVendors).catch(() => setVendors([])); }, []);

  const vendorOptions = useMemo(() => vendors.map((v) => ({ value: v._id, label: v.name })), [vendors]);
  const entityOptions = useMemo(() => aliases.map((a) => ({ value: a, label: a })), [aliases]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const json = await api.get(API_ENDPOINTS.purchase.notRequired.list, {
        query: { page, limit, search: debouncedSearch.trim(), vendorId, entityAlias, dateFrom, dateTo },
        fallback: "Failed to load skipped orders",
      });
      // successResponseHandler lifts pagination to the top level — see the
      // shape note in getNotRequired.
      setCards(json.data?.cards || []);
      setPagination(json.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, vendorId, entityAlias, dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = () => {
    setPopup(null);
    load();
  };

  const hasActiveFilters = !!search || !!vendorId || !!entityAlias || !!dateFrom || !!dateTo;
  const clearFilters = () => {
    setSearch(""); setVendorId(""); setEntityAlias(""); setDateFrom(""); setDateTo(""); setPage(1);
  };

  return (
    <div className="min-h-screen bg-slate-50/60">
      <div className="mx-auto max-w-7xl p-6 pb-12">
        <div className="mb-5 flex items-center gap-3">
          <button
            type="button" onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600 ring-1 ring-inset ring-rose-100">
              <Ban className="h-5 w-5" />
            </span>
            Skipped Orders
          </h1>
        </div>

        <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center">
          <div className="relative lg:w-96">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Quotation, vendor, product, reason…"
              className={`${inputCls} pl-9`}
            />
          </div>
          <div className="w-full lg:w-56">
            <SearchableSelect value={vendorId} onChange={(v) => { setVendorId(v); setPage(1); }} options={vendorOptions} placeholder="All vendors" />
          </div>
          <div className="w-full lg:w-40">
            <SearchableSelect value={entityAlias} onChange={(v) => { setEntityAlias(v); setPage(1); }} options={entityOptions} placeholder="All entities" />
          </div>
          <div className="flex items-center gap-2 lg:ml-auto">
            <DateRangeButton
              from={dateFrom} to={dateTo}
              onFrom={(v) => { setDateFrom(v); setPage(1); }}
              onTo={(v) => { setDateTo(v); setPage(1); }}
              hint="Filters on the date it was skipped."
            />
            {hasActiveFilters && (
              <button
                type="button" onClick={clearFilters}
                className="inline-flex h-[38px] items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-rose-600 shadow-sm transition hover:border-rose-300 hover:bg-rose-100"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-44 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : cards.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <Ban className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-700">
              {hasActiveFilters ? "No skipped orders match these filters" : "Nothing has been skipped"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {hasActiveFilters ? "Try changing or resetting the filters." : "Orders skipped on the Tracking Orders page will be listed here."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {cards.map((card, idx) => (
              <VendorCard
                key={card.trackingOrderId}
                sn={(page - 1) * limit + idx + 1}
                card={card}
                onOpenQuotation={() => router.push(`/stock/purchase/quotations/${card.sourceQuotationId}`)}
                onHistory={() => setPopup({ type: "history", card })}
                onMarkRequired={() => setPopup({ type: "markRequired", card })}
              />
            ))}
            {pagination.total > limit && (
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <Pagination
                  currentPage={page}
                  totalItems={pagination.total}
                  itemsPerPage={limit}
                  onPageChange={setPage}
                  onItemsPerPageChange={(n) => { setLimit(n); setPage(1); }}
                />
              </div>
            )}
          </div>
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
