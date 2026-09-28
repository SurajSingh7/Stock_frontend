"use client";

import React from "react";
import { RotateCw } from "lucide-react";
import { money } from "@/modules/stock/shared/StockSharedUI";

/* ============================================================= */
/* Shared chrome for the four report pages.                       */
/*                                                                */
/* Only the parts that are genuinely identical live here — the     */
/* header, the tiles, the table cell classes. Each report keeps    */
/* its OWN table, because the columns are the entire difference    */
/* between them and a "configurable table" component would hide    */
/* that difference behind a config object nobody can read.         */
/* ============================================================= */

export const th = "px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500";
export const thRight = th + " text-right";
export const thCenter = th + " text-center";
export const td = "px-3 py-2.5 text-sm text-slate-700 align-top";
export const tdRight = td + " text-right tabular-nums";

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export const fmtDateTime = (d) =>
  d
    ? new Date(d).toLocaleString("en-GB", {
        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : "—";

/* Zero is noise in a money column — the eye should land on what happened. */
export const num = (n, cls = "text-slate-700") =>
  n ? <span className={cls}>{money(n)}</span> : <span className="text-slate-300">—</span>;

export const ReportHeader = ({ title, subtitle, onRefresh, right = null }) => (
  <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
    <div>
      <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-900">
        {title}
        <button
          type="button" onClick={onRefresh} title="Reload"
          className="text-blue-600 transition hover:text-blue-700"
        >
          <RotateCw className="h-4 w-4" />
        </button>
      </h1>
      <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
    </div>
    {right}
  </div>
);

export const Tile = ({ icon: Icon, label, value, tone }) => (
  <div className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2 ${tone}`}>
    {Icon && <Icon className="h-4 w-4 shrink-0 opacity-70" />}
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">{label}</p>
      <p className="truncate text-sm font-bold tabular-nums">{value}</p>
    </div>
  </div>
);

export const ErrorBanner = ({ error, onDismiss }) =>
  !error ? null : (
    <div className="mb-4 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      <span>{error}</span>
      <button type="button" onClick={onDismiss} className="font-bold">&times;</button>
    </div>
  );

/*
  The line under every report.

  Each page says in its own words which columns follow the period and which
  are as-on-today, because that is the question every one of these pages gets
  asked first and a generic sentence would answer it for none of them.
*/
export const FootNote = ({ children }) => (
  <p className="mt-3 text-xs text-slate-400">{children}</p>
);
