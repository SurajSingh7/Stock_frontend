"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/* ============================================================= */
/* Portal Modal — fixed to viewport, centered, scroll-locked      */
/* Not affected by any parent overflow / transform / z-index.     */
/* ============================================================= */

export const Modal = ({ onClose, title, children, maxWidth = "max-w-lg" }) => {
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4" onMouseDown={onClose}>
      <div className={`max-h-[90vh] w-full ${maxWidth} overflow-y-auto rounded-xl bg-white p-5 shadow-2xl`} onMouseDown={(e) => e.stopPropagation()}>
        {title && (
          <div className="mb-3 flex items-center justify-between">
            <p className="text-base font-semibold text-gray-900">{title}</p>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body
  );
};

/* ============================================================= */
/* Searchable select                                              */
/*   options: [{ value, label }]                                  */
/*   renderExtra(option) → optional trailing node                 */
/* ============================================================= */

export const SearchableSelect = ({ value, onChange, options, placeholder = "All", disabled = false, renderExtra }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const selected = options.find((o) => o.value === value);
  const filtered = options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()));
  const cls = "w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500";

  return (
    <div className="relative" ref={ref}>
      <button type="button" disabled={disabled} onClick={() => !disabled && setOpen((o) => !o)}
        className={`${cls} flex items-center justify-between text-left ${disabled ? "cursor-not-allowed bg-gray-50 text-gray-400" : ""}`}>
        <span className={`truncate ${selected ? "text-gray-900" : "text-gray-400"}`}>{selected ? selected.label : placeholder}</span>
        <span className="ml-2 shrink-0 text-gray-400">▾</span>
      </button>
      {open && !disabled && (
        <div className="absolute z-40 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…"
            className="w-full border-b border-gray-100 px-3 py-2 text-sm focus:outline-none" />
          <div className="max-h-56 overflow-y-auto py-1">
            <button type="button" onClick={() => { onChange(""); setOpen(false); setQ(""); }}
              className="block w-full px-3 py-1.5 text-left text-sm text-gray-500 hover:bg-gray-50">{placeholder}</button>
            {filtered.map((o) => (
              <div key={o.value} className="flex items-center gap-1 px-2 hover:bg-gray-50">
                <button type="button" onClick={() => { onChange(o.value); setOpen(false); setQ(""); }}
                  className="flex-1 truncate px-1 py-1.5 text-left text-sm text-gray-800">{o.label}</button>
                {renderExtra && renderExtra(o)}
              </div>
            ))}
            {filtered.length === 0 && <p className="px-3 py-2 text-sm text-gray-400">No match</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export const inputCls = "w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500";
export const money = (n) => `\u20B9${Number(n || 0).toLocaleString("en-IN")}`;

/* ============================================================= */
/* Unit \u2014 independent of trackingMethod, the client picks both     */
/* explicitly (e.g. Group+Pieces for bottles, Individual+Meter for  */
/* a serialized reel are both valid). Always display the actual     */
/* saved `unit` value \u2014 never derive it from trackingMethod.        */
/* ============================================================= */
export const UNIT_LABEL = { pieces: "Pieces", meter: "Meter" };
export const unitLabel = (unit) => UNIT_LABEL[unit] || "";

export const qtyWithUnit = (qty, unit) => {
  const label = unitLabel(unit);
  return label ? `${qty ?? 0} ${label}` : String(qty ?? 0);
};