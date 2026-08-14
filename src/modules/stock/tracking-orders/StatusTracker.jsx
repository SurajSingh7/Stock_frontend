"use client";

import React from "react";

export const STAGES = [
  { key: "ENTITY_PENDING", label: "Entity Pending" },
  { key: "PO_PENDING", label: "PO Pending" },
  { key: "PO_GENERATED", label: "PO Generated" },
  { key: "PO_APPROVED", label: "PO Approved" },
  { key: "PO_SENT", label: "PO Sent" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "PARTIAL", label: "Partial" },
  { key: "COMPLETED", label: "Completed" },
];

// Tracking-order status -> stage index on the 8-node tracker above.
export const stageIndexForStatus = (status) => {
  switch (status) {
    case "ENTITY_PENDING": return 0;
    case "PO_PENDING": return 1;
    case "PO_GENERATED": return 2;
    case "PO_APPROVED": return 3;
    case "PO_SENT": return 4;
    case "IN_PROGRESS": return 5;
    case "PARTIAL": return 6;
    case "COMPLETED": return 7;
    default: return -1; // REJECTED / NOT_REQUIRED — off the happy path
  }
};

/**
 * Horizontal 8-stage progress tracker. `activeStage` (0-7, or -1/null for
 * none) highlights every node up to and including it — completed nodes in
 * emerald, the active node in indigo, everything after stays neutral gray.
 * Pass null for the page's resting state; the Tracking Orders board updates
 * this on row hover so users see exactly where that vendor-order sits.
 */
const StatusTracker = ({ activeStage = null }) => {
  return (
    <div className="mb-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
      <div className="flex min-w-[640px] items-center">
        {STAGES.map((stage, i) => {
          const isCompleted = activeStage != null && activeStage >= 0 && i < activeStage;
          const isCurrent = activeStage != null && i === activeStage;
          const dotCls = isCurrent
            ? "bg-indigo-600 ring-4 ring-indigo-100 scale-110"
            : isCompleted
            ? "bg-emerald-500"
            : "bg-slate-300";
          const labelCls = isCurrent
            ? "text-indigo-700 font-semibold"
            : isCompleted
            ? "text-emerald-600 font-medium"
            : "text-slate-400";
          const lineCls =
            activeStage != null && i < activeStage ? "bg-emerald-400" : "bg-slate-200";

          return (
            <React.Fragment key={stage.key}>
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className={`h-3 w-3 rounded-full transition-all duration-300 ${dotCls}`}
                  aria-hidden="true"
                />
                <span className={`whitespace-nowrap text-[11px] transition-colors duration-300 ${labelCls}`}>
                  {stage.label}
                </span>
              </div>
              {i < STAGES.length - 1 && (
                <div className={`mx-1.5 mb-4 h-0.5 flex-1 rounded-full transition-colors duration-300 ${lineCls}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default StatusTracker;
