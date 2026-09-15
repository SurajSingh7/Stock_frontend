"use client";

/*
  Everything that has happened to one vendor order, in two tabs.

  They are two different stories and deliberately not merged: "Resets" is the
  accounts team restarting the order, "Product decision" is the tracking team
  choosing what to buy. Someone opening this is almost always asking one of
  those two questions, not both at once.

  Its own file because three screens show it — Tracking Orders, the PO board
  and the Not Required register — and the same order gets asked about from all
  of them.
*/

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";

const fmt = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "—";
const fmtTime = (d) =>
  d ? new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "";

/* What the chip counts: everything that ever happened to this order. */
export const historyCount = (row) =>
  (row?.resets?.length || 0) + (row?.activity?.length || 0);

const Shell = ({ title, onClose, children }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="max-h-full w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/5"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <p className="text-base font-semibold tracking-tight text-slate-900">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
              <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body
  );
};

const Empty = ({ text }) => <p className="py-8 text-center text-sm text-slate-500">{text}</p>;

const OrderHistoryPopup = ({ row, onClose }) => {
  const resets = [...(row.resets || [])].reverse();
  const activity = [...(row.activity || [])].reverse();

  // Open on whichever tab actually has something, so the popup never greets
  // you with an empty list when the other tab is full.
  const [tab, setTab] = useState(resets.length === 0 && activity.length > 0 ? "products" : "resets");

  const tabCls = (id) =>
    "rounded-lg px-3 py-1.5 text-sm font-semibold transition " +
    (tab === id ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100");

  return (
    <Shell title={"History · " + (row.vendorName || "")} onClose={onClose}>
      <div className="mb-4 flex gap-1.5 rounded-xl bg-slate-50 p-1">
        <button type="button" onClick={() => setTab("resets")} className={tabCls("resets")}>
          Resets ({resets.length})
        </button>
        <button type="button" onClick={() => setTab("products")} className={tabCls("products")}>
          Product decision ({activity.length})
        </button>
      </div>

      {tab === "resets" ? (
        resets.length === 0 ? (
          <Empty text="This order has never been reset." />
        ) : (
          <div className="space-y-3">
            {resets.map((r, i) => (
              <div key={i} className="rounded-xl border border-slate-200 p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">#{resets.length - i}</span>
                  <span>{fmt(r.resetAt)} {fmtTime(r.resetAt)}</span>
                  <span>&middot;</span>
                  <span>{r.resetByName || "—"}</span>
                </div>
                <p className="mt-1.5 text-sm text-slate-800">{r.reason || "—"}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {r.voidedPoNumber ? (
                    <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
                      {r.voidedPoNumber} deleted
                    </span>
                  ) : null}
                  {r.clearedEntityAlias ? (
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
                      entity {r.clearedEntityAlias} cleared
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )
      ) : activity.length === 0 ? (
        <Empty text="No product decision has been recorded on this order yet." />
      ) : (
        <div className="space-y-3">
          {activity.map((a, i) => {
            const dropped = a.type === "NOT_REQUIRED";
            return (
              <div
                key={i}
                className={
                  "rounded-xl border p-3 " + (dropped ? "border-rose-200" : "border-emerald-200")
                }
              >
                <p
                  className={
                    "text-sm font-semibold " + (dropped ? "text-rose-700" : "text-emerald-700")
                  }
                >
                  {dropped ? "Marked Not Required" : "Marked Required"}
                  {" — "}
                  {a.scope === "WHOLE_VENDOR" ? "whole vendor" : "some products"}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>{fmt(a.at)} {fmtTime(a.at)}</span>
                  <span>&middot;</span>
                  <span>{a.byName || "—"}</span>
                  <span>&middot;</span>
                  <span className="tabular-nums">
                    {(a.products?.length || a.productCount || 0)}{" "}
                    {(a.products?.length || a.productCount) === 1 ? "product" : "products"}
                    {dropped ? " removed" : " restored"}
                  </span>
                </div>

                {/* Which ones. Entries written before names were kept show the
                    count above and nothing here. */}
                {a.products?.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {a.products.map((name, k) => (
                      <span
                        key={k}
                        className={
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset " +
                          (dropped
                            ? "bg-rose-50 text-rose-700 ring-rose-200"
                            : "bg-emerald-50 text-emerald-700 ring-emerald-200")
                        }
                      >
                        {name || "—"}
                      </span>
                    ))}
                  </div>
                ) : null}

                {a.reason ? <p className="mt-2 text-sm text-slate-800">{a.reason}</p> : null}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          Close
        </button>
      </div>
    </Shell>
  );
};

export default OrderHistoryPopup;
