"use client";

import React, { useState, useEffect } from "react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import { ArrowRight } from "lucide-react";
import { Modal, unitLabel } from "@/modules/stock/shared/StockSharedUI";

const STATUS_META = {
  PENDING: { label: "Pending", badge: "bg-amber-50 text-amber-700 ring-amber-200" },
  COMPLETED: { label: "Completed", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  REJECTED: { label: "Rejected", badge: "bg-rose-50 text-rose-700 ring-rose-200" },
};

const fmtDateTime = (d) =>
  d
    ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

const DetailField = ({ label, value }) => (
  <div>
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 text-sm font-medium text-slate-900">{value ?? "—"}</p>
  </div>
);

async function fetchDetail(id) {
  const res = await fetch(`${API_BACKEND_URL}/stock/transfer-requests/${id}`, { credentials: "include" });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to load transfer request");
  return json.data;
}

const ViewTransferRequestModal = ({ requestId, onClose }) => {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        setDetail(await fetchDetail(requestId));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [requestId]);

  const meta = detail ? STATUS_META[detail.status] || {} : {};

  return (
    <Modal title={detail ? `Transfer Request ${detail.requestNumber}` : "Transfer request"} onClose={onClose} maxWidth="max-w-2xl">
      {loading ? (
        <div className="space-y-3">
          <div className="h-6 w-2/3 animate-pulse rounded bg-slate-100" />
          <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
        </div>
      ) : !detail ? (
        <p className="text-sm text-rose-600">{error || "Not found"}</p>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
            <span className="text-sm font-semibold text-slate-900">{detail.sourceBranchId?.name}</span>
            <ArrowRight className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-semibold text-slate-900">{detail.requestingBranchId?.name}</span>
            <span className={`ml-auto inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${meta.badge}`}>
              {meta.label || detail.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <DetailField label="Requested By" value={detail.requestedByName} />
            <DetailField label="Requested At" value={fmtDateTime(detail.requestedAt)} />
            <DetailField label="Processed By" value={detail.processedByName} />
            <DetailField label="Processed At" value={fmtDateTime(detail.processedAt)} />
            <DetailField label="Remarks" value={detail.remarks} />
          </div>

          {detail.reason && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <span className="font-semibold">Reason: </span>{detail.reason}
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full min-w-full border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <th className="px-3 py-2.5">Product</th>
                  <th className="px-3 py-2.5">Unit</th>
                  <th className="px-3 py-2.5 text-right">Requested</th>
                  <th className="px-3 py-2.5 text-right">Transferred</th>
                  <th className="px-3 py-2.5 text-right">Rejected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(detail.lines || []).map((l) => (
                  <tr key={l._id}>
                    <td className="px-3 py-2 font-medium text-slate-900">{l.productName}</td>
                    <td className="px-3 py-2 text-slate-500">{unitLabel(l.unit)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">{l.requestedQty}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{l.transferredQty}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-rose-600">{l.rejectedQty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default ViewTransferRequestModal;
