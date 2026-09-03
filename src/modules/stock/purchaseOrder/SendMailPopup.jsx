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

/**
 * Send-mail form state — the toggle, the To address and the CC list.
 * Exported so the PO review popup can host the very same fields and approve
 * + send in one step instead of making the accounts team come back for it.
 */
export const useSendMailForm = (row) => {
  const [sendEmail, setSendEmail] = useState(true);

  // Recipients come from the VENDOR's contacts, split by the Recipient Type
  // set on each one — not from a single primary email. A vendor can address
  // two buyers and copy their accounts desk, and that is configured once on
  // the vendor rather than retyped on every PO.
  const vendorTo = (row.mailTo || []).map((c) => c.email).filter(Boolean);
  const vendorCc = (row.mailCc || []).map((c) => c.email).filter(Boolean);

  const [to, setTo] = useState(vendorTo);
  // Internal CC is OUR side — colleagues copied on every mail under this
  // notification. Kept separate from the vendor's own CC so it is obvious
  // which addresses are the vendor's and which are ours.
  const [internalCc, setInternalCc] = useState([]);

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
          setInternalCc(json.data?.notification?.ccEmails || []);
        }
      } catch {
        // non-fatal — send still works without a resolved default
      }
    })();
  }, [row.vendorId]);

  return {
    sendEmail, setSendEmail,
    to, setTo,
    internalCc, setInternalCc,
    vendorCc,
    // What actually goes on the wire: the vendor's CC contacts plus ours.
    cc: [...new Set([...vendorCc, ...internalCc])],
  };
};

/** True when the vendor has nobody marked To — the send is refused. */
export const hasNoRecipient = (row) => !(row.mailTo || []).some((c) => c.email);

const RecipientList = ({ items, empty, tone = "slate" }) => {
  if (!items.length) return <p className="text-xs italic text-slate-400">{empty}</p>;
  const ring = tone === "amber" ? "ring-amber-200 bg-amber-50" : "ring-slate-200 bg-white";
  return (
    <ul className="space-y-1.5">
      {items.map((c) => (
        <li key={c.email} className={`rounded-lg px-2.5 py-1.5 text-sm ring-1 ring-inset ${ring}`}>
          <span className="font-medium text-slate-900">{c.name || c.email}</span>
          {c.name ? <span className="ml-1.5 text-xs text-slate-500">{c.email}</span> : null}
        </li>
      ))}
    </ul>
  );
};

/** Fires the send-mail action. Resolves to the resulting mode: "SENT" | "MANUAL". */
export const submitSendMail = async (poId, { sendEmail, to, cc }) => {
  const res = await fetch(`${API_BACKEND_URL}/stock/purchase-orders/${poId}/send-mail`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    // `to` is a list now — a vendor can have several contacts marked To.
    body: JSON.stringify({ sendEmail, to, cc }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to send");
  return json.data?.mailResult?.mode || (sendEmail ? "SENT" : "MANUAL");
};

/** Vendor details + send toggle + To/CC — the whole body of this popup, also
 *  embedded verbatim in the PO review popup. */
export const SendMailFields = ({ row, form }) => {
  const { sendEmail, setSendEmail, internalCc, setInternalCc } = form;
  const missingTo = hasNoRecipient(row);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {/* Left column — one card: what is being sent, and whether to send it.
          Vendor name + PO number identify the mail; the contact names live in
          the Recipients card on the right, so repeating one here only invited
          the question of why that name and not the others. */}
      <div>
        <div className={cardCls}>
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-700">Vendor Details</p>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Vendor / Company Name</dt>
              <dd className="font-medium text-slate-900">{row.vendorName || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">PO Number</dt>
              <dd className="font-medium text-indigo-600">{row.poNumber || "—"}</dd>
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
      </div>

      {/* Right column — who this mail actually reaches */}
      <div className="space-y-4">
        <div className={cardCls}>
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-700">Vendor Recipients</p>

          <div className="mb-4">
            <label className={labelCls}>To</label>
            <RecipientList
              items={row.mailTo || []}
              empty="No contact on this vendor is marked To — the mail cannot be sent."
              tone={missingTo ? "amber" : "slate"}
            />
          </div>

          <div>
            <label className={labelCls}>CC</label>
            <RecipientList items={row.mailCc || []} empty="None" />
          </div>

          <p className="mt-3 text-xs text-slate-400">
            Set on the vendor, per contact. Change them under Master → Vendors.
          </p>
        </div>

        <div className={cardCls}>
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-700">Internal CC Emails</p>
          <p className="mb-3 text-xs text-slate-400">Our own people, copied on every mail under this notification.</p>
          <EmailChips value={internalCc} onChange={setInternalCc} placeholder="Add internal CC email…" />
        </div>
      </div>
    </div>
  );
};

const SendMailPopup = ({ row, onClose, onDone }) => {
  const form = useSendMailForm(row);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null); // "SENT" | "MANUAL"

  // First sends happen inside Review PO, so this popup is normally a resend.
  // The mailResult (not the status — APPROVED is terminal) says which it is.
  const isResend = !!row.mailResult?.mode;
  const title = `${isResend ? "Resend Mail" : "Send Mail"} · ${row.poNumber}`;

  // Only blocks an actual send — "Manual" is still allowed, because marking a
  // PO as handled outside the system does not need a recipient.
  const missingTo = hasNoRecipient(row);

  const submit = async () => {
    if (form.sendEmail && missingTo) {
      return setError(
        "This vendor has no contact marked To. Open Master → Vendors, edit " +
          (row.vendorName || "the vendor") +
          ", and set at least one contact's Recipient Type to To."
      );
    }
    setSaving(true);
    setError(null);
    try {
      setResult(await submitSendMail(row.poId, form));
      setTimeout(() => onDone(), 900);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (result) {
    return (
      <Modal onClose={onDone} title={title} maxWidth="max-w-md">
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
    <Modal onClose={onClose} title={title}>
      {error && <div className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-100">{error}</div>}

      {missingTo && form.sendEmail && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
          <span className="mt-0.5 shrink-0">⚠</span>
          <span>
            <strong>{row.vendorName || "This vendor"}</strong> has no contact marked <strong>To</strong>.
            Edit the vendor and set one, or switch off Send Email Notification to mark this PO manual.
          </span>
        </div>
      )}

      <SendMailFields row={row} form={form} />

      <div className="mt-6 flex justify-end gap-2.5 border-t border-slate-200 pt-5">
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50">
          Cancel
        </button>
        <button
          type="button" disabled={saving || (form.sendEmail && missingTo)} onClick={submit}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? (isResend ? "Resending…" : "Sending…") : isResend ? "Resend" : "Send"}
        </button>
      </div>
    </Modal>
  );
};

export default SendMailPopup;
