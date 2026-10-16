"use client";

import React, { useMemo } from "react";

/* ============================================================= */
/* Period picker — three ways of saying the same thing.           */
/*                                                                */
/* Whichever tab is used, the only thing that leaves this         */
/* component is { from, to }. The screens and the API never learn */
/* which tab produced it, so adding a fourth way later changes    */
/* nothing downstream.                                            */
/* ============================================================= */

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

const pad = (n) => String(n).padStart(2, "0");
const firstOf = (y, m) => `${y}-${pad(m)}-01`;
const lastOf = (y, m) => {
  // Day 0 of the NEXT month is the last day of this one — no leap-year table.
  const d = new Date(y, m, 0);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const TABS = [
  { key: "period", label: "Period Selector" },
  { key: "range", label: "Month Range" },
  { key: "dates", label: "Date Range" },
];

const btn = (active, disabled) =>
  "rounded-lg px-3.5 py-1.5 text-xs font-semibold transition " +
  (disabled
    ? "cursor-not-allowed bg-slate-50 text-slate-300"
    : active
      ? "bg-teal-500 text-white shadow-sm"
      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50");

const PeriodPicker = ({ value, onChange, allowAllTime = false }) => {
  const { tab = "period", year, month, fromMonth, toMonth, from, to, allTime } = value;
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth() + 1;

  // Ten years back is plenty for a ledger and keeps the select readable.
  const years = useMemo(
    () => Array.from({ length: 10 }, (_, i) => thisYear - i),
    [thisYear]
  );

  // Any pick narrows the window, so it always leaves "All time".
  const set = (patch) => onChange({ ...value, allTime: false, ...patch });

  const pickMonth = (m) => {
    // "All" means the whole year, which for the CURRENT year still ends today
    // — a ledger should not claim figures for months that have not happened.
    if (m === 0) {
      set({ tab: "period", month: 0, from: firstOf(year, 1), to: year === thisYear ? lastOf(year, thisMonth) : lastOf(year, 12) });
      return;
    }
    set({ tab: "period", month: m, from: firstOf(year, m), to: lastOf(year, m) });
  };

  const pickYear = (y) => {
    const m = month || 0;
    if (m === 0) {
      set({ tab: "period", year: y, from: firstOf(y, 1), to: y === thisYear ? lastOf(y, thisMonth) : lastOf(y, 12) });
    } else {
      // A month that has not happened in the newly picked year falls back to
      // the whole year rather than silently showing an empty page.
      const safe = y === thisYear && m > thisMonth ? 0 : m;
      pickMonthIn(y, safe);
    }
  };

  const pickMonthIn = (y, m) => {
    if (m === 0) {
      set({ tab: "period", year: y, month: 0, from: firstOf(y, 1), to: y === thisYear ? lastOf(y, thisMonth) : lastOf(y, 12) });
    } else {
      set({ tab: "period", year: y, month: m, from: firstOf(y, m), to: lastOf(y, m) });
    }
  };

  const setMonthRange = (which, v) => {
    // <input type="month"> gives "2026-01".
    const next = { ...value, allTime: false, tab: "range", [which]: v };
    const f = which === "fromMonth" ? v : fromMonth;
    const t = which === "toMonth" ? v : toMonth;
    if (f) { const [y, m] = f.split("-").map(Number); next.from = firstOf(y, m); }
    if (t) { const [y, m] = t.split("-").map(Number); next.to = lastOf(y, m); }
    onChange(next);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex gap-1 border-b border-slate-200 px-4">
        {TABS.map((t) => (
          <button
            key={t.key} type="button" onClick={() => set({ tab: t.key })}
            className={`border-b-2 px-3 py-2.5 text-sm font-semibold transition ${
              tab === t.key
                ? "border-teal-500 text-teal-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {tab === "period" && (
          <div className="flex flex-wrap items-center gap-3">
            {allowAllTime && (
              <button
                type="button"
                onClick={() => onChange({ ...value, ...allTimePeriod() })}
                className={btn(!!allTime, false) + " py-2.5"}
              >
                All time
              </button>
            )}
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
              <span className="text-sm font-semibold text-slate-600">Year</span>
              <select
                value={year} onChange={(e) => pickYear(Number(e.target.value))}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-100"
              >
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2">
              <span className="mr-1 text-sm font-semibold text-slate-600">Month</span>
              <button type="button" onClick={() => pickMonth(0)} className={btn(!allTime && month === 0, false)}>All</button>
              {MONTHS.map((label, i) => {
                const m = i + 1;
                // A month in the future has no figures and never will until it
                // arrives — offering it would only ever return an empty page.
                const future = year === thisYear && m > thisMonth;
                return (
                  <button
                    key={label} type="button" disabled={future}
                    onClick={() => !future && pickMonth(m)}
                    className={btn(!allTime && month === m, future)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {tab === "range" && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
              <span className="whitespace-nowrap text-sm font-semibold text-slate-600">From Month</span>
              <input
                type="month" value={fromMonth || ""} max={toMonth || undefined}
                onChange={(e) => setMonthRange("fromMonth", e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
              <span className="whitespace-nowrap text-sm font-semibold text-slate-600">To Month</span>
              <input
                type="month" value={toMonth || ""} min={fromMonth || undefined}
                onChange={(e) => setMonthRange("toMonth", e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
            </div>
            {fromMonth && toMonth && (
              <span className="rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700">
                {fromMonth.split("-").reverse().join("/")} &rarr; {toMonth.split("-").reverse().join("/")}
              </span>
            )}
          </div>
        )}

        {tab === "dates" && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
              <span className="text-sm font-semibold text-slate-600">From</span>
              <input
                type="date" value={from || ""} max={to || undefined}
                onChange={(e) => set({ tab: "dates", from: e.target.value })}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
              <span className="text-sm font-semibold text-slate-600">To</span>
              <input
                type="date" value={to || ""} min={from || undefined}
                onChange={(e) => set({ tab: "dates", to: e.target.value })}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
            </div>
            {/* Said plainly rather than left to be discovered: a ledger is
                month-grained, so an arbitrary range summarises correctly but
                the month-by-month view below always shows whole months. */}
            <span className="text-xs text-slate-400">
              Totals follow these dates. The month-wise ledger always shows whole months.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

// The period a page opens on: this month, which is what someone checking
// "where are we" almost always wants.
export const defaultPeriod = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  return {
    tab: "period",
    year: y,
    month: m,
    fromMonth: `${y}-${pad(m)}`,
    toMonth: `${y}-${pad(m)}`,
    from: firstOf(y, m),
    to: lastOf(y, m),
  };
};

// No window at all — every invoice ever. Only offered where allowAllTime is
// set (Outstanding), because there a narrower default could hide a debt.
export const allTimePeriod = () => {
  const now = new Date();
  return { tab: "period", year: now.getFullYear(), month: null, allTime: true, fromMonth: "", toMonth: "", from: "", to: "" };
};

export default PeriodPicker;
