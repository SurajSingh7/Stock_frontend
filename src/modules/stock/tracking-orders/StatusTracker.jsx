"use client";

import React from "react";
import {
  Building2, FilePlus, FileText, FileCheck, FileX, Truck, PackageOpen, PackageCheck, PackageX,
} from "lucide-react";
import { TRACKING_STATUS as TS, TRACKING_STATUS_META as META } from "./trackingStatus";

/*
  One line of steps, the way the sales app's order tracker reads. A step can
  hold two statuses that are the two outcomes of the same moment — PO
  Approved / PO Rejected, Fully Received / Closed Short — so the line never
  forks; on hover the step shows the outcome the order actually had.
*/
const STEPS = [
  { keys: [TS.ENTITY_PENDING], icon: Building2 },
  { keys: [TS.PO_PENDING], icon: FilePlus },
  { keys: [TS.PO_GENERATED], icon: FileText },
  { keys: [TS.PO_APPROVED, TS.REJECTED], icon: FileCheck },
  { keys: [TS.AWAITING_DELIVERY], icon: Truck },
  { keys: [TS.PARTLY_RECEIVED], icon: PackageOpen },
  { keys: [TS.FULLY_RECEIVED, TS.CLOSED_SHORT], icon: PackageCheck },
].map((s) => ({ ...s, label: s.keys.map((k) => META[k].label).join(" / ") }));

// The outcome that ended the order gets its own icon on its step.
const OUTCOME_ICON = { [TS.REJECTED]: FileX, [TS.CLOSED_SHORT]: PackageX };

// Index of the step a status sits on (-1 for Not Required, which has none).
export const stepIndexForStatus = (status) => STEPS.findIndex((s) => s.keys.includes(status));

/**
 * `activeStatus` is the status of the card under the pointer (or null). At
 * rest every step shows in its own light colour; on hover the steps already
 * passed turn green, the current one takes its status colour, the rest grey.
 */
const StatusTracker = ({ activeStatus = null }) => {
  const current = activeStatus ? stepIndexForStatus(activeStatus) : -1;
  const hovering = current >= 0;

  return (
    <div className="mb-2 w-full overflow-x-auto rounded-xl border border-slate-200 bg-white px-2 py-2 shadow-sm">
      <div className="flex min-w-max items-start justify-between">
        {STEPS.map((step, i) => {
          const isCurrent = i === current;
          const isPassed = hovering && i < current;
          const restTone = META[step.keys[0]].badge; // light fill + text + ring colour

          const dotCls = !hovering
            ? `${restTone} ring-1 ring-inset`
            : isCurrent
              ? `${META[activeStatus].dot} text-white ring-2 ring-offset-1 ring-slate-300 scale-110`
              : isPassed
                ? "bg-emerald-500 text-white"
                : "bg-slate-100 text-slate-300";
          const Icon = (isCurrent && OUTCOME_ICON[activeStatus]) || step.icon;
          const label = isCurrent ? META[activeStatus].label : step.label;
          const hint = isCurrent ? META[activeStatus].hint : step.keys.map((k) => META[k].hint).join(" · ");

          return (
            <div key={step.label} className="relative flex flex-1 flex-col items-center px-1" title={hint}>
              {/* link to the next step, drawn from this dot's centre */}
              {i < STEPS.length - 1 && (
                <div className={`absolute left-1/2 top-3 h-0.5 w-full transition-colors duration-300 ${isPassed ? "bg-emerald-500" : "bg-slate-200"}`} />
              )}
              <div className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full transition-all duration-300 ${dotCls}`}>
                <Icon className="h-3 w-3" />
              </div>
              <div
                className={`mt-1 w-28 truncate text-center text-[9px] font-semibold uppercase tracking-wide transition-colors duration-300 ${
                  isCurrent ? "text-slate-900" : "text-slate-500"
                }`}
              >
                {label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StatusTracker;
