"use client";

import React, { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";

/*
  Date range behind a calendar button — for filter bars with no room for two
  date fields. The button shows the chosen range once one is set; `hint` says
  which date the board filters on.
*/
const shortDate = (v) => (v ? new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "");

const DateRangeButton = ({ from, to, onFrom, onTo, hint }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const active = !!(from || to);
  const dateCls =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";
  return (
    <div ref={ref} className="relative">
      <button
        type="button" onClick={() => setOpen((v) => !v)}
        title={active ? `Date: ${shortDate(from) || "…"} – ${shortDate(to) || "…"}` : "Filter by date"}
        className={`inline-flex h-[38px] items-center gap-1.5 rounded-lg border px-3 text-sm font-medium shadow-sm transition ${
          active
            ? "border-indigo-300 bg-indigo-50 text-indigo-700"
            : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700"
        }`}
      >
        <CalendarDays className="h-4 w-4" />
        {active && <span className="whitespace-nowrap tabular-nums">{shortDate(from) || "…"} – {shortDate(to) || "…"}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Date range</p>
          <label className="mb-1 block text-xs font-medium text-slate-600">From</label>
          <input type="date" value={from} max={to || undefined} onChange={(e) => onFrom(e.target.value)} className={dateCls} />
          <label className="mb-1 mt-2.5 block text-xs font-medium text-slate-600">To</label>
          <input type="date" value={to} min={from || undefined} onChange={(e) => onTo(e.target.value)} className={dateCls} />
          {hint && <p className="mt-2 text-[11px] text-slate-400">{hint}</p>}
          <div className="mt-3 flex justify-between">
            <button
              type="button" onClick={() => { onFrom(""); onTo(""); }} disabled={!active}
              className="text-xs font-semibold text-rose-600 hover:underline disabled:text-slate-300 disabled:no-underline"
            >
              Clear
            </button>
            <button
              type="button" onClick={() => setOpen(false)}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangeButton;
