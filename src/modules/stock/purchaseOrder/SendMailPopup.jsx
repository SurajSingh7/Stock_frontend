"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { sendPoMail, fetchPoMailPreview } from "./purchaseOrderApi";
import {
  X, Mail, Lock, Send, Hand, SkipForward, Paperclip, ScrollText, AlertTriangle, FlaskConical, Building2, Users,
} from "lucide-react";

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

const Modal = ({ onClose, title, children, maxWidth = "max-w-5xl" }) => {
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
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
          <p className="flex items-center gap-2.5 text-base font-semibold tracking-tight text-slate-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
              <Mail className="h-4 w-4" />
            </span>
            {title}
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
  // Internal CC is OUR side — colleagues copied on every PO mail. It comes
  // from the PO's Alerts & Escalations rule and is shown read-only here: it is
  // changed on the rule, not per mail.
  const [internalCc, setInternalCc] = useState([]);
  // What Alerts & Escalations will send: the PO's Manual rule (subject, text,
  // PDF) and its CC list; also whether Email is on and sandbox active.
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!row.poId) return undefined;
    let alive = true;
    fetchPoMailPreview(row.poId)
      .then((data) => {
        if (!alive) return;
        setPreview(data);
        setInternalCc(data?.internalCc || []);
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
    internalCc,
    vendorCc,
    preview,
    // What actually goes on the wire: the vendor's CC contacts plus ours.
    cc: [...new Set([...vendorCc, ...internalCc])],
  };
};

/** True when the vendor has nobody marked To — the send is refused. */
export const hasNoRecipient = (row) => !(row.mailTo || []).some((c) => c.email);

/* One recipient as a chip: initial, name and address. */
const CHIP_TONE = {
  emerald: { chip: "bg-emerald-50 ring-emerald-200", dot: "bg-emerald-500 text-white" },
  sky: { chip: "bg-sky-50 ring-sky-200", dot: "bg-sky-500 text-white" },
  violet: { chip: "bg-violet-50 ring-violet-200", dot: "bg-violet-500 text-white" },
};

const RecipientChips = ({ items, empty, tone, warn = false }) => {
  if (!items.length) {
    return (
      <p className={`rounded-lg px-3 py-2 text-xs ${warn ? "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200" : "italic text-slate-400"}`}>
        {empty}
      </p>
    );
  }
  const t = CHIP_TONE[tone];
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((c) => {
        const label = c.name || c.email;
        return (
          <span key={c.email} className={`inline-flex max-w-full items-center gap-2 rounded-full py-1 pl-1 pr-3 ring-1 ring-inset ${t.chip}`} title={c.email}>
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold uppercase ${t.dot}`}>
              {label.charAt(0)}
            </span>
            <span className="min-w-0 truncate text-xs">
              <span className="font-semibold text-slate-900">{label}</span>
              {c.name ? <span className="ml-1 text-slate-500">{c.email}</span> : null}
            </span>
          </span>
        );
      })}
    </div>
  );
};

const SectionTitle = ({ icon: Icon, tone, children, right }) => (
  <div className="mb-2.5 flex items-center gap-2">
    <span className={`flex h-6 w-6 items-center justify-center rounded-md ${tone}`}>
      <Icon className="h-3.5 w-3.5" />
    </span>
    <p className="text-xs font-bold uppercase tracking-wider text-slate-700">{children}</p>
    {right && <span className="ml-auto">{right}</span>}
  </div>
);

/** Toggle OFF but neither option picked — the save is held back. */
export const needsSkipChoice = (form) => !form.sendEmail && !form.skipMode;

/** Fires the send-mail action. Resolves to the resulting mode: "SENT" | "MANUAL" | "SKIPPED". */
export const submitSendMail = async (poId, { sendEmail, to, cc, skipMode, note }) => {
  // `to` is a list now — a vendor can have several contacts marked To.
  const data = await sendPoMail(poId, sendEmail ? { sendEmail, to, cc } : { sendEmail, to, cc, skipMode, note });
  return data?.mailResult?.mode || (sendEmail ? "SENT" : skipMode);
};

const SKIP_OPTIONS = [
  {
    mode: "MANUAL", label: "Sent Manually", icon: Hand,
    hint: "The vendor got the PO outside the system — by hand, own email or WhatsApp.",
    on: "border-sky-300 bg-sky-50 ring-2 ring-sky-100", icon_on: "bg-sky-500 text-white",
  },
  {
    mode: "SKIPPED", label: "Skip Mail", icon: SkipForward,
    hint: "Not sending it now. The order moves on, and the mail can be sent later.",
    on: "border-amber-300 bg-amber-50 ring-2 ring-amber-100", icon_on: "bg-amber-500 text-white",
  },
];

/** Vendor details + send toggle + recipients + the mail — the whole body of
 *  this popup, also embedded verbatim in the PO review popup. */
export const SendMailFields = ({ row, form }) => {
  const { sendEmail, setSendEmail, skipMode, setSkipMode, note, setNote, internalCc } = form;
  const missingTo = hasNoRecipient(row);
  // A PO the vendor already holds can't be recorded as skipped.
  const skipLocked = mailReachedVendor(row.mailResult);
  const p = form.preview;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Left — what is being sent, and whether to send it */}
      <div className="space-y-4">
        <div className="overflow-hidden rounded-xl border border-indigo-100 bg-white shadow-sm">
          <div className="bg-linear-to-r from-indigo-50 via-violet-50 to-white px-4 py-3">
            <SectionTitle icon={Building2} tone="bg-indigo-500 text-white">Vendor</SectionTitle>
            <p className="text-base font-semibold text-slate-900">{row.vendorName || "—"}</p>
            <span className="mt-1.5 inline-flex items-center rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200">
              {row.poNumber || "—"}
            </span>
          </div>

          <div className="p-4">
            {/* the send switch — green when the mail will go out */}
            <button
              type="button" role="switch" aria-checked={sendEmail} onClick={() => setSendEmail((s) => !s)}
              className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition ${
                sendEmail ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"
              }`}
            >
              <span className="flex items-center gap-2.5">
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${sendEmail ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"}`}>
                  <Send className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-slate-900">Send Email Notification</span>
                  <span className={`block text-xs ${sendEmail ? "text-emerald-700" : "text-slate-500"}`}>
                    {sendEmail ? "The PO will be emailed from here" : "No email will go from here"}
                  </span>
                </span>
              </span>
              <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${sendEmail ? "bg-emerald-500" : "bg-slate-300"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${sendEmail ? "translate-x-5" : "translate-x-0.5"}`} />
              </span>
            </button>

            {!sendEmail && (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold text-slate-700">What happened instead?</p>
                {SKIP_OPTIONS.map((o) => {
                  const disabled = o.mode === "SKIPPED" && skipLocked;
                  const picked = skipMode === o.mode;
                  return (
                    <button
                      key={o.mode} type="button" disabled={disabled} onClick={() => setSkipMode(o.mode)}
                      className={`flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                        disabled
                          ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60"
                          : picked ? o.on : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${picked ? o.icon_on : "bg-slate-100 text-slate-500"}`}>
                        <o.icon className="h-3.5 w-3.5" />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-slate-900">{o.label}</span>
                        <span className="block text-xs text-slate-500">
                          {disabled ? "This PO has already reached the vendor." : o.hint}
                        </span>
                      </span>
                    </button>
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

        {/* the mail itself, as Alerts & Escalations will build it */}
        {p && sendEmail && (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
              <SectionTitle icon={Mail} tone="bg-slate-700 text-white">The mail</SectionTitle>
            </div>
            <div className="space-y-2 p-4">
              {!p.emailEnabled && (
                <p className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-inset ring-rose-200">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Email is switched off in Alerts &amp; Escalations → Channels — sending will be refused.
                </p>
              )}
              {p.sandbox && (
                <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-inset ring-amber-200">
                  <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Sandbox is on — this goes to {p.sandbox.email || "the test email (not set yet)"}, not the vendor.
                </p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {p.attachment && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
                    <Paperclip className="h-3 w-3" /> {p.attachment}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                  <ScrollText className="h-3 w-3" /> {p.ruleName ? `Rule: ${p.ruleName}` : "Built-in text — add a Manual rule to change it"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right — who this mail reaches. All read-only: vendor contacts are set
          on the vendor, internal CC on the Alerts & Escalations rule. */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
          <SectionTitle
            icon={Users} tone="bg-emerald-500 text-white"
            right={<span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400"><Lock className="h-3 w-3" /> read-only</span>}
          >
            Recipients
          </SectionTitle>
        </div>
        <div className="space-y-4 p-4">
          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700">To · vendor</p>
            <RecipientChips
              items={row.mailTo || []} tone="emerald" warn={missingTo}
              empty="No contact on this vendor is marked To — the mail cannot be sent."
            />
          </div>
          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-sky-700">CC · vendor</p>
            <RecipientChips items={row.mailCc || []} tone="sky" empty="None" />
          </div>

          <div className="rounded-xl bg-violet-50/50 p-3 ring-1 ring-inset ring-violet-100">
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-violet-700">
              <Lock className="h-3 w-3" /> Internal CC · our team
            </p>
            <RecipientChips
              items={internalCc.map((email) => ({ email }))} tone="violet"
              empty={p ? "None set on the PO mail rule." : "Loading…"}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const SendMailPopup = ({ row, onClose, onDone }) => {
  const form = useSendMailForm(row);
  const [saving, setSaving] = useState(false);
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
      return toast.error(
        "This vendor has no contact marked To. Open Master → Vendors, edit " +
          (row.vendorName || "the vendor") +
          ", and set at least one contact's Recipient Type to To."
      );
    }
    setSaving(true);
    try {
      setResult(await submitSendMail(row.poId, form));
      setTimeout(() => onDone(), 900);
    } catch (err) {
      toast.error(err.message);
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
      {missingTo && form.sendEmail && (
        <div className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
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
          className="inline-flex items-center gap-1.5 rounded-lg bg-linear-to-r from-indigo-600 to-violet-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {form.sendEmail && <Send className="h-4 w-4" />}
          {!form.sendEmail
            ? saving ? "Saving…" : "Save"
            : saving ? (isResend ? "Resending…" : "Sending…") : isResend ? "Resend" : "Send"}
        </button>
      </div>
    </Modal>
  );
};

export default SendMailPopup;
