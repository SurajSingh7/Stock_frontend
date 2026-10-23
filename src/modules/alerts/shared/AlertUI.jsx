"use client";

import React, { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, Mail, MessageCircle, Bell, Radio, Users, FileText, Workflow, Siren, ScrollText } from "lucide-react";
import { usePermissions } from "@/context/PermissionContext";

/* ─── Design tokens — same family as the master screens ─────────────────── */
export const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";
export const labelCls = "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600";
export const cardCls = "rounded-xl border border-slate-200 bg-white p-5 shadow-sm";
export const th = "px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-700";
export const td = "px-4 py-3 text-sm text-slate-700 align-top";
export const btnPrimary =
  "inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60";
export const btnGhost =
  "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";
export const btnDanger =
  "inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-600 shadow-sm transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60";

/* ─── Tabs — one per Access Control module ──────────────────────────────── */
export const ALERT_TABS = [
  { key: "alert-channels", label: "Channels", path: "/alerts/channels", icon: Radio },
  { key: "alert-contacts", label: "Contacts & Groups", path: "/alerts/contacts", icon: Users },
  { key: "alert-templates", label: "Templates", path: "/alerts/templates", icon: FileText },
  { key: "alert-rules", label: "Rules", path: "/alerts/rules", icon: Workflow },
  { key: "alert-escalations", label: "Escalations", path: "/alerts/escalations", icon: Siren },
  { key: "alert-log", label: "Message Log", path: "/alerts/log", icon: ScrollText },
];

/** Actions the user holds on one module; admins hold everything. */
export const useAlertActions = (moduleKey) => {
  const { permissions, isAdmin } = usePermissions();
  if (isAdmin) return () => true;
  const mod = (permissions || []).find((m) => m.moduleKey === moduleKey);
  const set = new Set((mod?.actions || []).map((a) => String(a).toUpperCase()));
  return (action) => set.has(action);
};

const useVisibleTabs = () => {
  const { permissions, isAdmin } = usePermissions();
  return useMemo(() => {
    if (isAdmin) return ALERT_TABS;
    return ALERT_TABS.filter((t) => {
      const mod = (permissions || []).find((m) => m.moduleKey === t.key);
      return (mod?.actions || []).map((a) => String(a).toUpperCase()).includes("VIEW_MENU");
    });
  }, [permissions, isAdmin]);
};

export const AlertsShell = ({ title, description, actions, children }) => {
  const pathname = usePathname();
  const tabs = useVisibleTabs();
  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-indigo-600">Alerts &amp; Escalations</div>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
            {description && <p className="mt-1 max-w-3xl text-sm text-slate-500">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200">
          {tabs.map((t) => {
            const active = pathname?.startsWith(t.path);
            const Icon = t.icon;
            return (
              <Link
                key={t.key}
                href={t.path}
                className={`-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition ${
                  active ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </Link>
            );
          })}
        </nav>
        {children}
      </div>
    </div>
  );
};

/* ─── Modal ─────────────────────────────────────────────────────────────── */
// Only ever opened by a click, so it never renders on the server — but the
// guard keeps createPortal safe if that changes.
export const Modal = ({ title, description, onClose, children, footer, maxWidth = "max-w-lg" }) => {
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
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className={`flex max-h-[92vh] w-full ${maxWidth} flex-col rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/5`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <p className="truncate pr-4 text-base font-semibold tracking-tight text-slate-900">{title}</p>
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2.5 border-t border-slate-100 px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body
  );
};

/* ─── Small parts ───────────────────────────────────────────────────────── */
export const Toggle = ({ checked, onChange, disabled, label, size = "md" }) => {
  const big = size === "md";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={`relative shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${big ? "h-6 w-11" : "h-5 w-9"} ${
        checked ? "bg-emerald-500" : "bg-slate-300"
      }`}
    >
      <span
        className={`absolute top-0.5 rounded-full bg-white shadow transition-transform ${big ? "h-5 w-5" : "h-4 w-4"} ${
          checked ? (big ? "translate-x-5" : "translate-x-4") : "translate-x-0.5"
        }`}
      />
    </button>
  );
};

export const Field = ({ label, hint, children, className = "" }) => (
  <div className={className}>
    {label && <label className={labelCls}>{label}</label>}
    {children}
    {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
  </div>
);

export const CHANNEL_META = {
  EMAIL: { label: "Email", icon: Mail, cls: "bg-sky-50 text-sky-700 ring-sky-200" },
  WHATSAPP: { label: "WhatsApp", icon: MessageCircle, cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  IN_APP: { label: "In-App", icon: Bell, cls: "bg-violet-50 text-violet-700 ring-violet-200" },
};

export const ChannelBadge = ({ channel }) => {
  const m = CHANNEL_META[channel] || { label: channel, icon: Bell, cls: "bg-slate-50 text-slate-600 ring-slate-200" };
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${m.cls}`}>
      <Icon className="h-3 w-3" />
      {m.label}
    </span>
  );
};

export const MESSAGE_STATUS_META = {
  QUEUED: { label: "Queued", cls: "bg-slate-100 text-slate-700 ring-slate-200" },
  SENDING: { label: "Sending", cls: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
  SENT: { label: "Sent", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  DELIVERED: { label: "Delivered", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  READ: { label: "Read", cls: "bg-emerald-100 text-emerald-800 ring-emerald-300" },
  FAILED: { label: "Failed", cls: "bg-rose-50 text-rose-700 ring-rose-200" },
  SKIPPED: { label: "Skipped", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  CANCELLED: { label: "Cancelled", cls: "bg-slate-50 text-slate-500 ring-slate-200" },
};

export const ESCALATION_STATUS_META = {
  ACTIVE: { label: "Waiting", cls: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
  RESOLVED: { label: "Resolved", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  FINISHED: { label: "Last step sent", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  STOPPED: { label: "Stopped", cls: "bg-slate-100 text-slate-600 ring-slate-200" },
  CANCELLED: { label: "Cancelled", cls: "bg-slate-50 text-slate-500 ring-slate-200" },
};

export const StatusBadge = ({ meta }) =>
  meta ? (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${meta.cls}`}>
      {meta.label}
    </span>
  ) : null;

export const Empty = ({ title, message, action }) => (
  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
    <p className="text-sm font-semibold text-slate-800">{title}</p>
    {message && <p className="mt-1 max-w-md text-sm text-slate-500">{message}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const ErrorBox = ({ children }) =>
  children ? <div className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-100">{children}</div> : null;

export const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

export const ConfirmModal = ({ title, message, confirmLabel = "Confirm", danger, busy, onConfirm, onClose, children }) => (
  <Modal
    title={title}
    onClose={onClose}
    maxWidth="max-w-md"
    footer={
      <>
        <button type="button" className={btnGhost} onClick={onClose}>Cancel</button>
        <button type="button" disabled={busy} className={danger ? `${btnPrimary} bg-rose-600 hover:bg-rose-500` : btnPrimary} onClick={onConfirm}>
          {busy ? "Working…" : confirmLabel}
        </button>
      </>
    }
  >
    {message && <p className="text-sm text-slate-600">{message}</p>}
    {children}
  </Modal>
);
