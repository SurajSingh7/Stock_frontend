"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { Modal } from "@/modules/stock/shared/StockSharedUI";

const fmt = (d) =>
  d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

/*
  An ⓘ shown next to an entity whose STATE was switched on the Create PO
  screen; it opens the from → to, the reason, who and when. Used on the
  Purchase Order board and the Tracking Orders card. Renders nothing when the
  state was never changed.
*/
const StateChangeInfo = ({ change, entityAlias = "" }) => {
  const [open, setOpen] = useState(false);
  if (!change) return null;
  const from = `${change.fromState || "—"}${change.fromStateCode ? ` (${change.fromStateCode})` : ""}`;
  const to = `${change.toState || "—"}${change.toStateCode ? ` (${change.toStateCode})` : ""}`;

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        title="State changed on Create PO — view reason"
        aria-label="State change details"
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-amber-500 transition hover:bg-amber-50 hover:text-amber-600"
      >
        <Info className="h-4 w-4" />
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)} title={`State changed${entityAlias ? ` · ${entityAlias}` : ""}`} maxWidth="max-w-md">
          <div className="flex items-center justify-center gap-2 rounded-xl bg-amber-50 px-3 py-3 text-sm font-semibold ring-1 ring-inset ring-amber-200">
            <span className="rounded-md bg-white px-2 py-0.5 text-slate-500 line-through ring-1 ring-inset ring-slate-200">{from}</span>
            <span className="text-amber-600">→</span>
            <span className="rounded-md bg-white px-2 py-0.5 text-amber-800 ring-1 ring-inset ring-amber-300">{to}</span>
          </div>
          <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200 px-4 text-sm">
            <div className="py-2.5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Reason</p>
              <p className="mt-1 whitespace-pre-wrap break-words font-medium text-slate-900">{change.reason || "—"}</p>
            </div>
            <div className="flex justify-between gap-3 py-2.5">
              <span className="text-slate-500">Changed by</span>
              <span className="font-semibold text-slate-900">{change.changedBy || "—"}</span>
            </div>
            <div className="flex justify-between gap-3 py-2.5">
              <span className="text-slate-500">Changed on</span>
              <span className="font-semibold text-slate-900">{fmt(change.changedAt)}</span>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Changed while creating the PO. The tax on the PO follows the new state.
          </p>
        </Modal>
      )}
    </>
  );
};

export default StateChangeInfo;
