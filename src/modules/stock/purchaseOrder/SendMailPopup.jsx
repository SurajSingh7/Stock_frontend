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
 * The three things that can happen to a PO mail (mailResult.mode). One place
 * for the label and colour so the PO list, both popups and the tracking card
 * all say the same thing.
 */
export const MAIL_MODE_META = {
  SENT: {
    label: "Mail Sent",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    done: "The PO was emailed to the vendor.",
  },
  MANUAL: {
    label: "Sent Manually",
    badge: "bg-sky-50 text-sky-700 ring-sky-200",
    done: "Recorded as sent outside the system — no email went from here.",
  },
  SKIPPED: {
    label: "Mail Skipped",
    badge: "bg-amber-50 text-amber-700 ring-amber-200",
    done: "No mail was sent. The order moves on, and the mail can still be sent later.",
  },
};

/** True once the vendor actually holds the PO (not for a skipped mail). */
export const mailReachedVendor = (mailResult) => ["SENT", "MANUAL"].includes(mailResult?.mode);

/**
 * Send-mail form state — the toggle, the To address and the CC list.
 * Exported so the PO review popup can host the very same fields and approve
 * + send in one step instead of making the accounts team come back for it.
 */
export const useSendMailForm = (row) => {
  const [sendEmail, setSendEmail] = useState(true);
  // With the toggle OFF the user must pick one: "MANUAL" (Sent Manually) or
  // "SKIPPED" (Skip Mail). No default — guessing would record the wrong thing.
  const [skipMode, setSkipMode] = useState(null);
  const [note, setNote] = useState("");

  // Recipients come from the VENDOR's contacts, split by the Recipient Type
  // set on each one — not from a single primary email. A vendor can address
  // two buyers and copy their accounts desk, and that is configured once on
  // the vendor rather than retyped on every PO.
  const vendorTo = (row.mailTo || []).map((c) => c.email).filter(Boolean);
  const vendorCc = (row.mailCc || []).map((c) => c.email).filter(Boolean);

  const [to, setTo] = useState(vendorTo);
  // Internal CC is OUR side — colleagues copied on every PO mail. Kept
  // separate from the vendor's own CC so it is obvious which addresses are
  // the vendor's and which are ours.
  const [internalCc, setInternalCc] = useState([]);
  // What Alerts & Escalations will send: the PO's Manual rule (subject, text,
  // PDF) and its CC list; also whether Email is on and sandbox active.
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!row.poId) return undefined;
    let alive = true;
    fetch(`${API_BACKEND_URL}/stock/alerts/manual/PO_SEND_TO_VENDOR/${row.poId}/preview`, { credentials: "include" })
      .then((res) => res.json().then((json) => ({ ok: res.ok, json })))
      .then(({ ok, json }) => {
        if (!alive || !ok || !json.success) return;
        setPreview(json.data);
        setInternalCc(json.data?.internalCc || []);
      })
      // Non-fatal: the send itself still works, the server builds the same mail.
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [row.poId]);

  return {
    sendEmail, setSendEmail,
    skipMode, setSkipMode,
    note, setNote,
    to, setTo,
    internalCc, setInternalCc,
    vendorCc,
    preview,
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

/** Toggle OFF but neither option picked — the save is held back. */
export const needsSkipChoice = (form) => !form.sendEmail && !form.skipMode;

/** Fires the send-mail action. Resolves to the resulting mode: "SENT" | "MANUAL" | "SKIPPED". */
export const submitSendMail = async (poId, { sendEmail, to, cc, skipMode, note }) => {
  const res = await fetch(`${API_BACKEND_URL}/stock/purchase-orders/${poId}/send-mail`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    // `to` is a list now — a vendor can have several contacts marked To.
    body: JSON.stringify(sendEmail ? { sendEmail, to, cc } : { sendEmail, to, cc, skipMode, note }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to send");
  return json.data?.mailResult?.mode || (sendEmail ? "SENT" : skipMode);
};

const SKIP_OPTIONS = [
  { mode: "MANUAL", label: "Sent Manually", hint: "The vendor got the PO outside the system — by hand, own email or WhatsApp." },
  { mode: "SKIPPED", label: "Skip Mail", hint: "Not sending it now. The order moves on, and the mail can be sent later." },
];

/** Vendor details + send toggle + To/CC — the whole body of this popup, also
 *  embedded verbatim in the PO review popup. */
export const SendMailFields = ({ row, form }) => {
  const { sendEmail, setSendEmail, skipMode, setSkipMode, note, setNote, internalCc, setInternalCc } = form;
  const missingTo = hasNoRecipient(row);
  // A PO the vendor already holds can't be recorded as skipped.
  const skipLocked = mailReachedVendor(row.mailResult);

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
            <div className="mt-3 space-y-2">
              <p className="text-xs font-semibold text-slate-700">No email will be sent. What happened?</p>
              {SKIP_OPTIONS.map((o) => {
                const disabled = o.mode === "SKIPPED" && skipLocked;
                const picked = skipMode === o.mode;
                return (
                  <label
                    key={o.mode}
                    className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 transition ${
                      disabled
                        ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60"
                        : picked
                          ? "cursor-pointer border-indigo-300 bg-indigo-50/60"
                          : "cursor-pointer border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio" name={`skipMode-${row.poId}`} value={o.mode}
                      checked={picked} disabled={disabled}
                      onChange={() => setSkipMode(o.mode)}
                      className="mt-0.5 h-4 w-4 accent-indigo-600"
                    />
                    <span>
                      <span className="block text-sm font-medium text-slate-900">{o.label}</span>
                      <span className="block text-xs text-slate-500">
                        {disabled ? "This PO has already reached the vendor." : o.hint}
                      </span>
                    </span>
                  </label>
                );
              })}
              <input
                value={note} onChange={(e) => setNote(e.target.value)} maxLength={500}
                placeholder="Note (optional) — e.g. handed over at site"
                className={inputCls}
              />
            </div>
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
          <p className="mb-3 text-xs text-slate-400">Our own people, copied on every PO mail. Set in Alerts &amp; Escalations → Rules.</p>
          <EmailChips value={internalCc} onChange={setInternalCc} placeholder="Add internal CC email…" />
        </div>

        {form.preview && sendEmail && (
          <div className={cardCls}>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-700">The mail</p>
            {!form.preview.emailEnabled && (
              <p className="mb-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-inset ring-rose-100">
                Email is switched off in Alerts &amp; Escalations → Channels — sending will be refused.
              </p>
            )}
            {form.preview.sandbox && (
              <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-inset ring-amber-200">
                Sandbox is on — this goes to {form.preview.sandbox.email || "the test email (not set yet)"}, not the vendor.
              </p>
            )}
            <p className="text-sm font-medium text-slate-900">{form.preview.subject}</p>
            <p className="mt-1 line-clamp-3 text-xs text-slate-500">{String(form.preview.body || "").replace(/<[^>]+>/g, " ")}</p>
            <p className="mt-2 text-xs text-slate-400">
              {form.preview.attachment ? `📎 ${form.preview.attachment} · ` : ""}
              {form.preview.ruleName ? `Rule: ${form.preview.ruleName}` : "Built-in text — add a Manual rule to change it"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const SendMailPopup = ({ row, onClose, onDone }) => {
  const form = useSendMailForm(row);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null); // "SENT" | "MANUAL" | "SKIPPED"

  // First sends happen inside Review PO, so this popup is normally a resend.
  // The mailResult (not the status — APPROVED is terminal) says which it is;
  // a skipped mail never reached the vendor, so sending it now is a first send.
  const isResend = mailReachedVendor(row.mailResult);
  const title = `${isResend ? "Resend Mail" : "Send Mail"} · ${row.poNumber}`;

  // Only blocks an actual send — Sent Manually / Skip Mail are still allowed,
  // because neither needs a recipient.
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
    const meta = MAIL_MODE_META[result] || MAIL_MODE_META.SENT;
    return (
      <Modal onClose={onDone} title={title} maxWidth="max-w-md">
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <span className={`inline-flex h-12 w-12 items-center justify-center rounded-full ring-1 ring-inset ${meta.badge}`}>
            <Mail className="h-6 w-6" />
          </span>
          <p className="text-base font-semibold text-slate-900">{meta.label}</p>
          <p className="text-sm text-slate-500">{meta.done}</p>
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
            Edit the vendor and set one, or switch off Send Email Notification to record it as Sent Manually or Skip Mail.
          </span>
        </div>
      )}

      <SendMailFields row={row} form={form} />

      <div className="mt-6 flex justify-end gap-2.5 border-t border-slate-200 pt-5">
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50">
          Cancel
        </button>
        <button
          type="button" disabled={saving || (form.sendEmail && missingTo) || needsSkipChoice(form)} onClick={submit}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {!form.sendEmail
            ? saving ? "Saving…" : "Save"
            : saving ? (isResend ? "Resending…" : "Sending…") : isResend ? "Resend" : "Send"}
        </button>
      </div>
    </Modal>
  );
};

export default SendMailPopup;
