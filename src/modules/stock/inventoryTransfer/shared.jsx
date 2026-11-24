"use client";

import React, { useState, useEffect } from "react";
import { ArrowLeft, ArrowRight, AlertTriangle, Search, MoreVertical, Info, ChevronRight, RotateCcw } from "lucide-react";
import { usePermissions } from "@/context/PermissionContext";
import { Modal, inputCls, unitLabel } from "@/modules/stock/shared/StockSharedUI";

/* ── Words and colours ────────────────────────────────────────────────── */

export const REQUEST_STATUS = {
  PENDING: { label: "Pending", badge: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500" },
  ON_THE_WAY: { label: "On the Way", badge: "bg-indigo-50 text-indigo-700 ring-indigo-200", dot: "bg-indigo-500" },
  MISMATCH: { label: "Mismatch", badge: "bg-rose-50 text-rose-700 ring-rose-200", dot: "bg-rose-500" },
  RECEIVED: { label: "Received", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  DECLINED: { label: "Declined", badge: "bg-slate-100 text-slate-600 ring-slate-200", dot: "bg-slate-400" },
};

/*
  Whose move it is on an open request — "mine" (the branch that asked) while
  it is On the Way, "to-us" (the branch asked) while Pending or Needs
  Correction; null once finished.
*/
export const turnOf = (status) => (status === "ON_THE_WAY" ? "mine" : status === "PENDING" || status === "MISMATCH" ? "to-us" : null);

// The latest step of a type on a transfer (history is oldest first).
export const lastEvent = (t, type) => [...(t?.history || [])].reverse().find((h) => h.type === type) || null;

export const StatusBadge = ({ status, map }) => {
  const m = map[status] || { label: status, badge: "bg-slate-50 text-slate-600 ring-slate-200", dot: "bg-slate-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${m.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
};

/* ── Formatting ───────────────────────────────────────────────────────── */

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
export const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export const qtyText = (n, unit) => {
  const v = Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });
  return unit === "meter" ? `${v} m` : `${v} ${unitLabel(unit) || "unit"}`;
};

// What is on the way for a request line — null until something is sent.
export const sentOf = (l, status) => (status === "PENDING" || status === "DECLINED" ? null : l.sentQty || 0);

/* ── Small pieces ─────────────────────────────────────────────────────── */

export const th = "px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600";

export const BranchPair = ({ from, to }) => (
  <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm">
    <span className="font-semibold text-slate-900">{from?.name || "—"}</span>
    <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
    <span className="font-semibold text-slate-900">{to?.name || "—"}</span>
  </span>
);

// Asked / Sent / Short for one request line: Short is what was asked and not sent.
export const shortOf = (l, status) => {
  const sent = sentOf(l, status);
  return sent === null ? 0 : Math.max(0, Math.round((l.requestedQty - sent) * 1000) / 1000);
};
export const lineCells = (l, status) => {
  const sent = sentOf(l, status);
  const short = shortOf(l, status);
  return {
    asked: qtyText(l.requestedQty, l.unit),
    sent: sent === null ? <span className="text-slate-300">—</span> : <span className={short ? "text-amber-700" : "text-emerald-700"}>{qtyText(sent, l.unit)}</span>,
    short: short ? <span className="font-semibold text-rose-600">{qtyText(short, l.unit)}</span> : <span className="text-slate-300">—</span>,
  };
};

// Every category of a request with its Asked / Sent / Short — the popup behind "3 categories".
const LinesModal = ({ request: r, onClose }) => (
  <Modal title={`${r.requestNumber} — ${r.lines.length} categories`} onClose={onClose} maxWidth="max-w-2xl">
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr className="text-left text-xs font-bold uppercase tracking-wide text-slate-600">
            <th className="px-4 py-2.5">Category</th>
            <th className="px-4 py-2.5 text-right">Asked</th>
            <th className="px-4 py-2.5 text-right">Sent</th>
            <th className="px-4 py-2.5 text-right">Short</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {r.lines.map((l) => {
            const c = lineCells(l, r.status);
            return (
              <tr key={l._id}>
                <td className="px-4 py-2.5 font-medium text-slate-900">{l.categoryPath}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{c.asked}</td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{c.sent}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{c.short}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </Modal>
);

/*
  The Category / Asked / Sent / Short cells of a request row (four <td>s).
  One category: its own quantities. Several: counts — "3 categories",
  "3 items", "3 items", "2 short" — and a click on the category or the short
  count opens every category with its quantities. (Different units can not be
  added up, so several categories are never totalled.)
*/
export const LinesColumns = ({ request: r }) => {
  const [open, setOpen] = useState(false);
  const lines = r.lines || [];
  if (lines.length === 1) {
    const c = lineCells(lines[0], r.status);
    return (
      <>
        <td className="max-w-56 px-4 py-3"><p className="truncate text-sm text-slate-700" title={lines[0].categoryPath}>{lines[0].categoryPath}</p></td>
        <td className="px-4 py-3 text-right text-sm tabular-nums text-slate-700">{c.asked}</td>
        <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums">{c.sent}</td>
        <td className="px-4 py-3 text-right text-sm tabular-nums">{c.short}</td>
      </>
    );
  }
  const notSent = sentOf(lines[0], r.status) === null;
  const sentCount = lines.filter((l) => (l.sentQty || 0) > 0).length;
  const shortCount = lines.filter((l) => shortOf(l, r.status) > 0).length;
  return (
    <>
      <td className="px-4 py-3">
        <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-0.5 text-sm font-semibold text-indigo-600 hover:underline">
          {lines.length} categories <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </td>
      <td className="px-4 py-3 text-right text-sm tabular-nums text-slate-700">{lines.length} items</td>
      <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums">
        {notSent ? <span className="text-slate-300">—</span> : <span className={shortCount ? "text-amber-700" : "text-emerald-700"}>{sentCount} items</span>}
      </td>
      <td className="px-4 py-3 text-right text-sm tabular-nums">
        {shortCount ? (
          <button type="button" onClick={() => setOpen(true)} className="font-semibold text-rose-600 hover:underline">{shortCount} short</button>
        ) : <span className="text-slate-300">—</span>}
      </td>
      {open && <LinesModal request={r} onClose={() => setOpen(false)} />}
    </>
  );
};

/*
  A small box fixed to the screen next to the button that opened it, so a
  table's scroll box never clips it. Only one is open at a time — opening
  one closes whichever was open — and any outside click, scroll or resize
  closes it. Returns [position, toggle(event, place), close].
*/
let closeOpenFloating = null;
const useFloating = () => {
  const [pos, setPos] = useState(null);
  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    closeOpenFloating = close;
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      if (closeOpenFloating === close) closeOpenFloating = null;
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [pos]);
  const toggle = (e, place) => {
    e.stopPropagation();
    if (pos) return setPos(null);
    closeOpenFloating?.();
    setPos(place(e.currentTarget.getBoundingClientRect()));
  };
  return [pos, toggle, () => setPos(null)];
};
// Below the button, kept on screen.
const below = (width) => (r) => ({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)) });

const InfoButton = ({ onClick, title = "Details" }) => (
  <button type="button" title={title} onClick={onClick} className="rounded-full text-slate-400 transition hover:text-indigo-600">
    <Info className="h-3.5 w-3.5" />
  </button>
);

// ⋮ next to a row's View — more actions in a small menu.
export const RowMenu = ({ items }) => {
  const [pos, toggle, close] = useFloating();
  return (
    <>
      <button
        type="button" title="More"
        onClick={(e) => toggle(e, (r) => ({ top: r.bottom + 4, right: window.innerWidth - r.right }))}
        className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-1.5 py-1.5 text-slate-500 shadow-sm transition hover:bg-slate-50"
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </button>
      {pos && (
        <div style={pos} className="fixed z-50 min-w-40 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {items.map((it) => (
            <button
              key={it.label} type="button" onClick={() => { close(); it.onClick(); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {it.icon && <it.icon className="h-4 w-4 text-slate-400" />} {it.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
};

/*
  "Requested By" / "Closed By": the name and date, and an ⓘ that opens who it
  was — employee code, their branch, role, phone, email (a snapshot taken when
  they acted). actor: a createdBy / closedBy stamp with branchId populated.
*/
export const PersonCell = ({ actor, name, at }) => {
  const [pos, toggle] = useFloating();
  const who = actor?.name || name;
  if (!who && !at) return <span className="text-sm text-slate-300">—</span>;
  const rows = [
    ["Employee Code", actor?.employeeCode],
    ["Branch", actor?.branchId?.name],
    ["Role", actor?.roleName],
    ["Phone", actor?.phone],
    ["Email", actor?.email],
  ];
  return (
    <div className="text-sm">
      <div className="flex items-center gap-1">
        <span className="font-medium text-slate-800">{who || "—"}</span>
        {actor && <InfoButton onClick={(e) => toggle(e, below(256))} />}
      </div>
      <p className="text-xs text-slate-400">{fmtDate(at)}</p>
      {pos && (
        <div style={pos} onClick={(e) => e.stopPropagation()} className="fixed z-50 w-64 rounded-lg border border-slate-200 bg-white p-3 text-left shadow-lg">
          <p className="mb-2 text-sm font-semibold text-slate-900">{who}</p>
          <dl className="space-y-1 text-xs">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-slate-500">{k}</dt>
                <dd className="truncate text-right font-medium text-slate-800">{v || "—"}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 border-t border-slate-100 pt-2 text-[11px] text-slate-400">{fmtDateTime(at)}</p>
        </div>
      )}
    </div>
  );
};

/*
  The status badge, and an ⓘ beside it when there is something to explain:
    Declined           why it was declined
    Mismatch   the problem the branch that asked reported
    On the Way         "Corrected — check again" and what was taken off,
                       after a Correct & Resend
    less than asked    why less was sent (On the Way / Received)
  Nothing to explain → no ⓘ.
*/
export const StatusCell = ({ request: r }) => {
  const [pos, toggle] = useFloating();
  const t = r.transferId || {};
  const notes = [];
  if (r.status === "DECLINED" && r.reason) {
    notes.push({ title: "Why declined", text: r.reason, by: r.closedBy?.name || r.processedByName, at: r.closedAt || r.processedAt, tone: "text-slate-700" });
  }
  if (r.status === "MISMATCH") {
    const p = lastEvent(t, "PROBLEM_REPORTED");
    if (p) notes.push({ title: "Problem reported", text: p.note, by: p.byName, at: p.at, tone: "text-rose-700" });
  }
  if (r.status === "ON_THE_WAY") {
    const c = lastEvent(t, "CORRECTED");
    if (c) {
      const off = (c.removed || []).map((x) => `${x.productName} ${qtyText(x.quantity, x.unit)}`).join(", ");
      notes.push({ title: "Corrected — check again", text: [off && `Took off: ${off}`, c.note].filter(Boolean).join(" · ") || "Resent unchanged", by: c.byName, at: c.at, tone: "text-indigo-700" });
    }
  }
  if ((r.status === "ON_THE_WAY" || r.status === "RECEIVED") && r.reason) {
    notes.push({ title: "Why less", text: r.reason, by: r.processedByName, at: r.processedAt, tone: "text-amber-700" });
  }
  return (
    <div className="flex items-center gap-1.5">
      <StatusBadge status={r.status} map={REQUEST_STATUS} />
      {notes.length > 0 && <InfoButton title="Why" onClick={(e) => toggle(e, below(288))} />}
      {pos && (
        <div style={pos} onClick={(e) => e.stopPropagation()} className="fixed z-50 w-72 space-y-3 rounded-lg border border-slate-200 bg-white p-3 text-left shadow-lg">
          {notes.map((n) => (
            <div key={n.title}>
              <p className={`text-xs font-bold ${n.tone}`}>{n.title}</p>
              <p className="mt-0.5 text-sm text-slate-800">“{n.text}”</p>
              <p className="mt-0.5 text-[11px] text-slate-400">{[n.by, n.at && fmtDateTime(n.at)].filter(Boolean).join(" · ")}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Title row, the same as Purchase Order Approval: icon + title, actions on the right.
export const PageHeader = ({ icon: Icon, title, children }) => (
  <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3">
    <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-900">
      <Icon className="h-5 w-5 text-indigo-600" /> {title}
    </h1>
    <div className="flex flex-wrap items-center gap-2">{children}</div>
  </div>
);

// A full page's title row, the same as Invoice Review: ← Back inline with
// the title, subtitle under it, anything on the right (a status badge).
export const BackHeader = ({ onBack, title, subtitle, children }) => (
  <div className="flex flex-wrap items-center gap-3">
    <button
      type="button" onClick={onBack}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
    >
      <ArrowLeft className="h-4 w-4" /> Back
    </button>
    <div className="min-w-0">
      <h1 className="text-lg font-bold tracking-tight text-slate-900">{title}</h1>
      {subtitle && <div className="truncate text-sm text-slate-500">{subtitle}</div>}
    </div>
    {children && <div className="ml-auto">{children}</div>}
  </div>
);

export const PrimaryButton =({ icon: Icon, children, ...rest }) => (
  <button
    type="button" {...rest}
    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
  >
    {Icon && <Icon className="h-4 w-4" />} {children}
  </button>
);

// Status tabs — "All 12 · Pending 3 · …", each in its status colour (the
// Purchase Order Approval style).
const CHIP_TONE = {
  "": { active: "border-indigo-600 bg-indigo-600 text-white", inactive: "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100", chipActive: "bg-indigo-500 text-indigo-50", chipInactive: "bg-indigo-100 text-indigo-700" },
  PENDING: { active: "border-amber-600 bg-amber-600 text-white", inactive: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100", chipActive: "bg-amber-500 text-amber-50", chipInactive: "bg-amber-100 text-amber-700" },
  ON_THE_WAY: { active: "border-sky-600 bg-sky-600 text-white", inactive: "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100", chipActive: "bg-sky-500 text-sky-50", chipInactive: "bg-sky-100 text-sky-700" },
  MISMATCH: { active: "border-rose-600 bg-rose-600 text-white", inactive: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100", chipActive: "bg-rose-500 text-rose-50", chipInactive: "bg-rose-100 text-rose-700" },
  RECEIVED: { active: "border-emerald-600 bg-emerald-600 text-white", inactive: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100", chipActive: "bg-emerald-500 text-emerald-50", chipInactive: "bg-emerald-100 text-emerald-700" },
  APPROVED: { active: "border-emerald-600 bg-emerald-600 text-white", inactive: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100", chipActive: "bg-emerald-500 text-emerald-50", chipInactive: "bg-emerald-100 text-emerald-700" },
  REJECTED: { active: "border-rose-600 bg-rose-600 text-white", inactive: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100", chipActive: "bg-rose-500 text-rose-50", chipInactive: "bg-rose-100 text-rose-700" },
  DECLINED: { active: "border-slate-600 bg-slate-600 text-white", inactive: "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200", chipActive: "bg-slate-500 text-slate-50", chipInactive: "bg-slate-200 text-slate-700" },
};
export const StatusChips = ({ options, counts, value, onChange }) => (
  <div className="flex flex-wrap gap-2">
    {options.map((o) => {
      const active = value === o.key;
      const st = CHIP_TONE[o.key] || CHIP_TONE[""];
      return (
        <button
          key={o.key || "all"} type="button" onClick={() => onChange(o.key)}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 ${active ? st.active : st.inactive}`}
        >
          {o.label}
          <span className={`rounded-full px-1.5 text-xs tabular-nums ${active ? st.chipActive : st.chipInactive}`}>{counts?.[o.key || "ALL"] ?? 0}</span>
        </button>
      );
    })}
  </div>
);

// Shown only while a filter is set.
export const ResetButton = ({ onClick }) => (
  <button
    type="button" onClick={onClick}
    className="inline-flex h-9.5 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-rose-600 shadow-sm transition hover:border-rose-300 hover:bg-rose-100"
  >
    <RotateCcw className="h-3.5 w-3.5" /> Reset
  </button>
);

// Fills the width its wrapper gives it.
export const SearchBox = ({ value, onChange, placeholder }) => (
  <div className="relative">
    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${inputCls} pl-9`} />
  </div>
);

export const EmptyRow = ({ colSpan, icon: Icon, title, hint }) => (
  <tr>
    <td colSpan={colSpan} className="px-4 py-16 text-center">
      {Icon && <Icon className="mx-auto h-8 w-8 text-slate-300" />}
      <p className="mt-2 text-sm font-medium text-slate-700">{title}</p>
      {hint && <p className="mt-1 text-sm text-slate-400">{hint}</p>}
    </td>
  </tr>
);

export const LoadingRows = ({ cols, rows = 5 }) =>
  Array.from({ length: rows }).map((_, r) => (
    <tr key={r} className="animate-pulse">
      {Array.from({ length: cols }).map((__, c) => <td key={c} className="px-4 py-4"><div className="h-3.5 w-3/4 rounded bg-slate-100" /></td>)}
    </tr>
  ));

export const RowButton = ({ tone = "slate", icon: Icon, children, ...rest }) => {
  const tones = {
    slate: "border-slate-200 text-slate-600 hover:bg-slate-50",
    indigo: "border-indigo-200 text-indigo-700 hover:bg-indigo-50",
    emerald: "border-emerald-200 text-emerald-700 hover:bg-emerald-50",
    rose: "border-rose-200 text-rose-600 hover:bg-rose-50",
    amber: "border-amber-200 text-amber-700 hover:bg-amber-50",
  };
  return (
    // No label = an icon button (give it a title); its padding matches the ⋮ button.
    <button type="button" {...rest} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg border bg-white py-1.5 text-xs font-semibold shadow-sm transition disabled:opacity-50 ${children ? "px-2.5" : "px-1.5"} ${tones[tone]}`}>
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
};

/* ── Popups ───────────────────────────────────────────────────────────── */

// "Are you sure?" — every action that moves stock or closes something asks first.
export const ConfirmDialog = ({ title = "Are you sure?", message, detail, confirmLabel = "Yes, I'm sure", tone = "indigo", busy, onConfirm, onClose }) => {
  const btn = tone === "rose" ? "bg-rose-600 hover:bg-rose-700" : tone === "emerald" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-indigo-600 hover:bg-indigo-500";
  const ring = tone === "rose" ? "bg-rose-50 text-rose-600 ring-rose-50/50" : tone === "emerald" ? "bg-emerald-50 text-emerald-600 ring-emerald-50/50" : "bg-indigo-50 text-indigo-600 ring-indigo-50/50";
  return (
    <Modal title={title} onClose={() => !busy && onClose()} maxWidth="max-w-sm">
      <div className="flex flex-col items-center text-center">
        <span className={`flex h-12 w-12 items-center justify-center rounded-full ring-8 ${ring}`}>
          <AlertTriangle className="h-6 w-6" />
        </span>
        <p className="mt-4 text-sm text-slate-700">{message}</p>
        {detail && <div className="mt-3 w-full rounded-lg bg-slate-50 px-3 py-2 text-left text-xs text-slate-600 ring-1 ring-inset ring-slate-200">{detail}</div>}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" disabled={busy} onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">No, go back</button>
        <button type="button" disabled={busy} onClick={onConfirm} className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition disabled:opacity-50 ${btn}`}>
          {busy ? "Saving…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
};

// A reason, then "Are you sure?" — Decline, Report Problem.
export const ReasonDialog = ({ title, message, label = "Reason", placeholder, required = true, confirmLabel, tone = "rose", onSubmit, onClose }) => {
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await onSubmit(reason.trim());
    } finally {
      setBusy(false);
    }
  };
  if (confirming) {
    return (
      <ConfirmDialog
        message={message} tone={tone} busy={busy} confirmLabel="Yes, I'm sure"
        detail={reason.trim() ? <><span className="font-semibold text-slate-700">{label}: </span>{reason.trim()}</> : null}
        onConfirm={submit} onClose={() => setConfirming(false)}
      />
    );
  }
  return (
    <Modal title={title} onClose={onClose} maxWidth="max-w-md">
      <div className="mb-3 text-sm text-slate-600">{message}</div>
      <label className="mb-1.5 block text-xs font-bold text-slate-700">{label} {required && <span className="text-rose-500">*</span>}</label>
      <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={placeholder} className={inputCls} autoFocus />
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">Cancel</button>
        <button
          type="button" disabled={required && !reason.trim()} onClick={() => setConfirming(true)}
          className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition disabled:opacity-50 ${tone === "rose" ? "bg-rose-600 hover:bg-rose-700" : "bg-indigo-600 hover:bg-indigo-500"}`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
};

/* ── Who may do what ──────────────────────────────────────────────────── */

export const useTransferAccess = () => {
  const { permissions, isAdmin } = usePermissions();
  const of = (key) => ((permissions || []).find((m) => m.moduleKey === key)?.actions || []).map((a) => String(a).toUpperCase());
  const mine = of("my-stock-requests");
  const toUs = of("stock-requests-to-us");
  const has = (list, a) => isAdmin || list.includes(a);
  return {
    // My Requests — ask, then All Received / Report Problem.
    canRequest: has(mine, "CREATE"),
    canReceive: has(mine, "RECEIVE"),
    // Requests to Us — Send (and Correct & Resend), Decline.
    canSend: has(toUs, "SEND"),
    canDecline: has(toUs, "DECLINE"),
  };
};
