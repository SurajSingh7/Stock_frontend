"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import { X, Mail } from "lucide-react";

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";
const labelCls = "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600";
const cardCls = "rounded-xl border border-slate-200 bg-slate-50/60 p-4";

const Modal = ({ onClose, title, children, maxWidth = "max-w-3xl" }) => {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className={`max-h-full w-full ${maxWidth} overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/5`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <p className="flex items-center gap-2 text-base font-semibold tracking-tight text-slate-900">
            <Mail className="h-4 w-4 text-indigo-600" /> {title}
          </p>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body
  );
};

/** Comma/Enter-separated email chip input — used for CC. */
const EmailChips = ({ value, onChange, placeholder }) => {
  const [draft, setDraft] = useState("");

  const commit = () => {
    const v = draft.trim().replace(/,$/, "");
    if (v && !value.includes(v)) onChange([...value, v]);
    setDraft("");
  };

  return (
    <div className={`${inputCls} flex flex-wrap items-center gap-1.5 py-1.5`}>
      {value.map((email) => (
        <span key={email} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
          {email}
          <button type="button" onClick={() => onChange(value.filter((e) => e !== email))} className="text-indigo-400 hover:text-indigo-700">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
            if (draft.trim()) e.preventDefault();
            commit();
          }
        }}
        onBlur={commit}
        placeholder={value.length ? "" : placeholder}
        className="min-w-[120px] flex-1 border-0 bg-transparent p-0.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
      />
    </div>
  );
};

const SendMailPopup = ({ row, onClose, onDone }) => {
  const [sendEmail, setSendEmail] = useState(true);
  const [to, setTo] = useState(row.email || "");
  const [cc, setCc] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null); // "SENT" | "MANUAL"

  // CC defaults from the vendor-assigned (or default) Email notification —
  // the From address is no longer configured per-notification; sending
  // always goes out as the server's MAIL_FROM_DEFAULT.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BACKEND_URL}/stock/notifications/resolve/${row.vendorId}?channel=EMAIL`, {
          credentials: "include",
        });
        const json = await res.json();
        if (res.ok && json.success) {
          setCc(json.data?.notification?.ccEmails || []);
        }
      } catch {
        // non-fatal — send still works without a resolved default
      }
    })();
  }, [row.vendorId]);

  const submit = async () => {
    if (sendEmail && !to.trim()) return setError("A To email is required");
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BACKEND_URL}/stock/purchase-orders/${row.poId}/send-mail`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sendEmail, to: to.trim(), cc }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to send");
      setResult(json.data?.mailResult?.mode || (sendEmail ? "SENT" : "MANUAL"));
      setTimeout(() => onDone(), 900);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (result) {
    return (
      <Modal onClose={onDone} title={`Send Mail · ${row.poNumber}`} maxWidth="max-w-md">
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <span className={`inline-flex h-12 w-12 items-center justify-center rounded-full ${result === "SENT" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
            <Mail className="h-6 w-6" />
          </span>
          <p className="text-base font-semibold text-slate-900">{result === "SENT" ? "Mail Sent" : "Manual"}</p>
          <p className="text-sm text-slate-500">
            {result === "SENT" ? "The PO was emailed to the vendor." : "Marked as manually handled — no email was sent."}
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} title={`Send Mail · ${row.poNumber}`}>
      {error && <div className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-100">{error}</div>}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Left column */}
        <div className="space-y-4">
          <div className={cardCls}>
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-700">Vendor Details</p>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Vendor / Company Name</dt>
                <dd className="font-medium text-slate-900">{row.vendorName || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Contact Name</dt>
                <dd className="font-medium text-slate-900">{row.contactName || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Primary Email</dt>
                <dd className="font-medium text-slate-900">{row.email || "—"}</dd>
              </div>
            </dl>

            <label className="mt-4 flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5">
              <span className="text-sm font-medium text-slate-700">Send Email Notification</span>
              <button
                type="button"
                role="switch"
                aria-checked={sendEmail}
                onClick={() => setSendEmail((s) => !s)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${sendEmail ? "bg-indigo-600" : "bg-slate-300"}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${sendEmail ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </label>
            {!sendEmail && (
              <p className="mt-2 text-xs text-slate-500">Email sending will be skipped — this PO will be marked <span className="font-medium">Manual</span>.</p>
            )}
          </div>

          <div className={cardCls}>
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-700">PO Details</p>
            <div>
              <dt className="text-xs text-slate-500">PO Number</dt>
              <dd className="text-sm font-medium text-indigo-600">{row.poNumber || "—"}</dd>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className={cardCls}>
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-700">Email Details</p>
          <div className="space-y-3">
            <div>
              <label className={labelCls}>To (Primary Vendor Email)</label>
              <input value={to} onChange={(e) => setTo(e.target.value)} disabled={!sendEmail} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>CC</label>
              <EmailChips value={cc} onChange={setCc} placeholder="Add CC email…" />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2.5 border-t border-slate-200 pt-5">
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50">
          Cancel
        </button>
        <button
          type="button" disabled={saving} onClick={submit}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Sending…" : "Send"}
        </button>
      </div>
    </Modal>
  );
};

export default SendMailPopup;
