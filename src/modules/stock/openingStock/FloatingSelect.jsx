"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/*
  A searchable select whose list floats on the page (portal), not inside its
  parent. Needed inside the opening-stock table: the table scrolls sideways,
  and a list rendered inside it gets clipped and drags a scrollbar in with it.

  Same look as the shared SearchableSelect, same props: value, onChange,
  options [{ value, label }], placeholder, disabled.
*/
const FloatingSelect = ({ value, onChange, options, placeholder = "Select", disabled = false }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const panelRef = useRef(null);

  const selected = options.find((o) => o.value === value);
  const filtered = options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()));

  /*
    The app zooms the whole page (ZoomProvider sets document.documentElement
    .style.zoom). getBoundingClientRect answers in on-screen pixels, but a fixed
    element inside the zoomed page is drawn at zoom × its CSS pixels — so every
    measurement is divided by the zoom, or the list lands off to one side.
  */
  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const z = parseFloat(document.documentElement.style.zoom || getComputedStyle(document.documentElement).zoom) || 1;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.max(r.width, 240 * z);
    const spaceBelow = vh - r.bottom;
    // Open upwards only when there really is no room below.
    const up = spaceBelow < 200 * z && r.top > spaceBelow;
    const left = Math.max(8, Math.min(r.left, vw - width - 8));
    setPos({
      left: left / z,
      width: width / z,
      ...(up ? { bottom: (vh - r.top + 4) / z } : { top: (r.bottom + 4) / z }),
    });
  };

  useLayoutEffect(() => {
    if (open) place();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (btnRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    // Any scroll (page or the table) would leave the list floating in the wrong
    // place — follow the button instead.
    const onMove = () => place();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open]);

  const pick = (v) => {
    onChange(v);
    setOpen(false);
    setQ("");
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`flex h-[38px] w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-2.5 text-left text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 ${
          disabled ? "cursor-not-allowed bg-slate-50 text-slate-400" : ""
        }`}
      >
        <span className={`truncate ${selected ? "text-slate-900" : "text-slate-400"}`}>{selected ? selected.label : placeholder}</span>
        <span className="ml-2 shrink-0 text-slate-400">▾</span>
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: "fixed", left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, zIndex: 10000 }}
            className="rounded-lg border border-slate-200 bg-white shadow-xl"
          >
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search…"
              className="w-full rounded-t-lg border-b border-slate-100 px-3 py-2 text-sm focus:outline-none"
            />
            <div className="max-h-60 overflow-y-auto py-1">
              <button type="button" onClick={() => pick("")} className="block w-full px-3 py-1.5 text-left text-sm text-slate-500 hover:bg-slate-50">
                {placeholder}
              </button>
              {filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => pick(o.value)}
                  className={`block w-full truncate px-3 py-1.5 text-left text-sm hover:bg-indigo-50 ${o.value === value ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-800"}`}
                >
                  {o.label}
                </button>
              ))}
              {filtered.length === 0 && <p className="px-3 py-2 text-sm text-slate-400">No match</p>}
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default FloatingSelect;
