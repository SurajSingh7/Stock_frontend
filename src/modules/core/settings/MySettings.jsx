"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, MonitorCog } from "lucide-react";
import { useZoom } from "@/layouts/header/components/zoom/ZoomProvider";

/*
  My Settings — the signed-in user's own preferences (not Administration,
  which is system-wide). One tab per area; add an entry to TABS to add one.
*/

const SIZES = [0.75, 0.8, 0.85, 0.9, 0.95, 1, 1.05, 1.1, 1.15, 1.2, 1.25];
const pct = (z) => `${Math.round(z * 100)}%`;

const ZoomDisplayTab = () => {
  const { zoom, setZoom } = useZoom();
  const current = Math.round(zoom * 100);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Page size</h2>
          <p className="mt-1 text-sm text-slate-500">Makes every page smaller or bigger: text, spacing and icons together.</p>
        </div>
        {current !== 100 && (
          <button type="button" onClick={() => setZoom(1)} className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
            Reset to 100%
          </button>
        )}
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-3">
        {SIZES.map((z) => {
          const on = Math.round(z * 100) === current;
          return (
            <button
              key={z}
              type="button"
              onClick={() => setZoom(z)}
              aria-pressed={on}
              className={`flex h-24 flex-col items-center justify-center rounded-xl border transition ${
                on
                  ? "border-indigo-400 bg-indigo-50 text-indigo-700 ring-4 ring-indigo-100"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              {/* The "Aa" grows with the size it stands for. */}
              <span className="font-semibold leading-none" style={{ fontSize: `${z}rem` }}>Aa</span>
              <span className="mt-2 text-sm">{pct(z)}</span>
              {z === 1 && <span className="mt-0.5 text-[11px] text-slate-400">default</span>}
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-slate-400">Tip: if everything looks too big on your laptop, try 90%.</p>
    </div>
  );
};

const TABS = [{ key: "zoom-display", label: "Zoom & Display", icon: MonitorCog, Component: ZoomDisplayTab }];

const MySettings = () => {
  const router = useRouter();
  const [tab, setTab] = useState(TABS[0].key);
  const Active = TABS.find((t) => t.key === tab)?.Component || TABS[0].Component;

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <div className="mx-auto max-w-5xl">
        {/* Back | title (centred) | empty — the same header as the Vendor form. */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          {/* Opened from the profile menu on any page, so go back to wherever that was. */}
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
            className="inline-flex items-center gap-2 justify-self-start rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="text-center">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">My Settings</h1>
            <p className="text-xs text-slate-500">Only for you, on this browser.</p>
          </div>
          <div />
        </div>

        <div className="mt-5 mb-5 flex gap-1 border-b border-slate-200">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition ${
                tab === key ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        <Active />
      </div>
    </div>
  );
};

export default MySettings;
