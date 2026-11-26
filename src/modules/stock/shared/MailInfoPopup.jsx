"use client";

import React from "react";
import { MailCheck, MailX } from "lucide-react";
import { Modal } from "@/modules/stock/shared/StockSharedUI";
import { MAIL_MODE_META } from "@/modules/stock/purchaseOrder/SendMailPopup";

/*
  How this PO reached the vendor — shared by the Tracking Orders card and the
  Purchase Order Approval board.

  Three different things can sit behind it: the system emailed it (Mail Sent),
  somebody sent it outside the system (Sent Manually), or nobody sent it and
  the order moved on anyway (Mail Skipped). An approved PO with nothing
  recorded yet has not been sent at all.
*/
const MAIL_INFO_COPY = {
  SENT: {
    heading: "Mail Sent — emailed by the system",
    body: "The PO was emailed from here and the delivery was recorded, so the addresses below are exactly what it went to.",
    at: "Sent at",
  },
  MANUAL: {
    heading: "Sent Manually — outside the system",
    body: "Somebody sent this PO themselves — by their own email, WhatsApp, or by hand — and marked it done. Nothing was sent from this system, so there are no delivery details beyond what they recorded.",
    at: "Recorded at",
  },
  SKIPPED: {
    heading: "Mail Skipped — not sent to the vendor",
    body: "No mail went to the vendor. The order was allowed to move on without it, and the mail can still be sent from Purchase Orders.",
    at: "Skipped at",
  },
};

const NOT_SENT = {
  heading: "Not sent yet",
  body: "The PO is approved but nothing has been sent to the vendor or recorded yet. Use Send Mail on the Purchase Order Approval page.",
  badge: "bg-slate-50 text-slate-600 ring-slate-200",
};

const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const Field = ({ label, value }) => (
  <div className="flex items-baseline gap-1.5 text-sm">
    <span className="font-semibold text-slate-700">{label} :</span>
    <span className="min-w-0 break-words font-medium text-slate-900">{value}</span>
  </div>
);

const MailInfoPopup = ({ row, onClose }) => {
  const mr = row.mailResult || {};
  const copy = MAIL_INFO_COPY[mr.mode];
  const meta = MAIL_MODE_META[mr.mode];
  const bySystem = mr.mode === "SENT";
  const list = (arr) => (arr && arr.length ? arr.join(", ") : "—");

  return (
    <Modal onClose={onClose} title={`Mail · ${row.poNumber || row.vendorName}`} maxWidth="max-w-lg">
      <div className={`mb-4 flex items-center gap-2 rounded-xl px-3 py-2.5 ring-1 ring-inset ${meta?.badge || NOT_SENT.badge}`}>
        {copy ? <MailCheck className="h-4 w-4 shrink-0" /> : <MailX className="h-4 w-4 shrink-0" />}
        <p className="text-sm font-semibold">{copy?.heading || NOT_SENT.heading}</p>
      </div>

      <p className="mb-3 text-sm text-slate-600">{copy?.body || NOT_SENT.body}</p>

      {copy && (
        <div className="space-y-2 rounded-xl border border-slate-200 p-3">
          <Field label={copy.at} value={fmtDateTime(mr.sentAt)} />
          {mr.note ? <Field label="Note" value={mr.note} /> : null}
          {bySystem && <Field label="From" value={mr.from || "—"} />}
          {bySystem && <Field label="To" value={list(mr.to)} />}
          {bySystem && mr.cc?.length ? <Field label="Cc" value={list(mr.cc)} /> : null}
          {mr.channel ? <Field label="Channel" value={mr.channel} /> : null}
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50">
          Close
        </button>
      </div>
    </Modal>
  );
};

export default MailInfoPopup;
