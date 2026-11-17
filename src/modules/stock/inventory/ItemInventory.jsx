"use client";

/*
  Available Item — what is in the store right now (AVAILABLE units), one row
  per serial-tracked unit and one row per product + branch for batch stock.
  Where everything else is (with subscribers, employees, in repair) belongs to
  Item Summary (planned).

  Columns: the "Show in list" fields (Serial, MAC…) each get their own column;
  any other field goes in Details — the first one shown, the rest behind +N —
  and Details disappears when no row has one.
*/

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { api } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/constants/api";
import { fetchLeafCategories, fetchScopedBranches, fetchProductOptions, fetchVendors } from "@/modules/stock/shared/lookupsApi";
import { reportFaulty } from "@/modules/stock/repairs/repairApi";
import { usePermissions } from "@/context/PermissionContext";
import Pagination from "@/shared/ui/pagination/Pagination";
import DateRangeButton from "@/modules/stock/shared/DateRangeButton";
import {
  RotateCcw, Boxes, Info, Eye, Search, SlidersHorizontal, MoreVertical, AlertTriangle, ArrowLeft, Receipt, Archive,
  RefreshCw, ShieldCheck, ShieldAlert, ShieldX, Shield, History as HistoryIcon, PackageCheck, Tag,
} from "lucide-react";
import { SearchableSelect, Modal, unitLabel, money } from "@/modules/stock/shared/StockSharedUI";
import { ConditionBadge, SOURCE_LABEL, fmtDate } from "./itemBadges";

const EP = API_ENDPOINTS.inventory.inventoryItems;

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";
const th = "px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 whitespace-nowrap";

const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const DAY = 24 * 60 * 60 * 1000;
// Active (green), ending within 30 days (amber), expired (red), none recorded.
const warrantyOf = (endDate) => {
  if (!endDate) return { key: "NONE", label: "No warranty", icon: Shield, cls: "text-slate-400" };
  const end = new Date(endDate);
  const now = Date.now();
  if (end.getTime() < now) return { key: "EXPIRED", label: "Expired", icon: ShieldX, cls: "text-rose-600" };
  if (end.getTime() - now <= 30 * DAY) return { key: "ENDING", label: fmtDate(end), icon: ShieldAlert, cls: "text-amber-600" };
  return { key: "ACTIVE", label: fmtDate(end), icon: ShieldCheck, cls: "text-emerald-700" };
};

const WARRANTY_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "ENDING", label: "Ending in 30 days" },
  { value: "EXPIRED", label: "Expired" },
  { value: "NONE", label: "No warranty" },
];

const fieldsOf = (card) => (card.productDefinitionId?.selectedFields || []).map((sf) => sf.fieldDefId).filter(Boolean);
const valueOf = (card, code) =>
  card.cardType === "group" && card.variedFields?.includes(code) ? "Multiple" : card.fieldValues?.[code];

/* ============================================================= */
/* Batch breakdown — the receipts that make up a batch row's qty.  */
/* ============================================================= */
const BatchBreakdownModal = ({ productName, unitText, defId, branchId, fields = [], onClose }) => {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const query = { status: "AVAILABLE" };
        if (branchId) query.branchId = branchId;
        const json = await api.get(EP.history(defId), { query, fallback: "Failed to load batches" });
        setRows(json.data || []);
      } catch (err) {
        toast.error(err.message);
        setRows([]);
      }
    })();
  }, [defId, branchId]);

  return (
    <Modal onClose={onClose} title={`Batches — ${productName}`} maxWidth={fields.length > 0 ? "max-w-2xl" : "max-w-lg"}>
      {rows === null ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />)}</div>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">No batches found.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                <th className="px-3 py-2.5">Received via</th>
                <th className="px-3 py-2.5">Date</th>
                {fields.map((fd) => <th key={fd._id} className="px-3 py-2.5">{fd.label}</th>)}
                <th className="px-3 py-2.5 text-right">Quantity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.refId || r.refNumber || "unknown"}>
                  <td className="px-3 py-2 font-semibold text-slate-900">
                    {r.refNumber || "—"}
                    {r.sourceType && <span className="ml-1.5 text-xs font-normal text-slate-500">{SOURCE_LABEL[r.sourceType] || r.sourceType}</span>}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{fmtDate(r.receivedAt)}</td>
                  {fields.map((fd) => <td key={fd._id} className="px-3 py-2 text-slate-700">{r.fieldValues?.[fd.code] ?? "—"}</td>)}
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">{r.quantity} {unitText}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
};

/* ============================================================= */
/* Popups from the row                                            */
/* ============================================================= */

const InfoRow = ({ label, children }) => (
  <div className="flex items-start justify-between gap-4 py-2">
    <span className="text-sm text-slate-500">{label}</span>
    <span className="text-right text-sm font-semibold text-slate-900">{children ?? "—"}</span>
  </div>
);

// Where a unit came from — invoice or opening stock — and its warranty.
const OriginPopup = ({ card, onClose }) => {
  const src = card.source || {};
  const isOpening = src.type === "OPENING_STOCK";
  const Icon = isOpening ? Archive : src.type === "VENDOR_REPLACEMENT" ? RefreshCw : Receipt;
  const w = warrantyOf(card.warranty?.endDate);
  return (
    <Modal title="Came in via" onClose={onClose} maxWidth="max-w-md">
      <div className="mb-3 flex items-center gap-3 rounded-xl bg-indigo-50/60 px-4 py-3 ring-1 ring-inset ring-indigo-100">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-indigo-600 ring-1 ring-inset ring-indigo-100"><Icon className="h-4 w-4" /></span>
        <div>
          <p className="text-xs font-semibold text-indigo-700">{SOURCE_LABEL[src.type] || (card.invoiceId ? "Invoice" : "Unknown source")}</p>
          <p className="text-sm font-bold text-slate-900">{src.refNumber || card.invoiceId?.invoiceNumber || "—"}</p>
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {!isOpening && <InfoRow label="Vendor">{card.vendorId?.name}</InfoRow>}
        <InfoRow label="Received">{fmtDateTime(card.receivedAt)}</InfoRow>
        {card.invoiceId?.receivedByName && <InfoRow label="Received by">{card.invoiceId.receivedByName}</InfoRow>}
        <InfoRow label="Purchase date">{fmtDate(card.purchaseDate)}</InfoRow>
        <InfoRow label="Cost">{card.purchaseCost === null || card.purchaseCost === undefined ? "Not known" : money(card.purchaseCost)}</InfoRow>
        <InfoRow label="Condition"><ConditionBadge condition={card.condition} /></InfoRow>
        <InfoRow label="Warranty"><span className={w.cls}>{w.key === "EXPIRED" ? `Expired ${fmtDate(card.warranty?.endDate)}` : w.label}</span></InfoRow>
      </div>
    </Modal>
  );
};

// Every "Details" field of one row — opened from +N.
const FieldsPopup = ({ card, fields, onClose }) => (
  <Modal title={`${card.productDefinitionId?.name || "Item"} · Details`} onClose={onClose} maxWidth="max-w-sm">
    <div className="divide-y divide-slate-100">
      {fields.map((fd) => <InfoRow key={fd._id} label={fd.label}>{valueOf(card, fd.code) ?? "—"}</InfoRow>)}
    </div>
  </Modal>
);

/* Found broken on the shelf → Repair & Warranty: say what is wrong, then confirm. */
const ReportFaultyDialog = ({ card, listFields, onClose, onDone }) => {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const ident = listFields.map((f) => card.fieldValues?.[f.code]).filter(Boolean).join(" · ");
  const submit = async () => {
    setBusy(true);
    try {
      await reportFaulty(card._id, { note: note.trim() });
      toast.success("Moved to Repair & Warranty");
      onDone();
    } catch (err) {
      toast.error(err.message);
    } finally { setBusy(false); }
  };
  if (confirming) {
    return (
      <Modal title="Are you sure?" onClose={() => !busy && setConfirming(false)} maxWidth="max-w-sm">
        <div className="flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600 ring-8 ring-rose-50/50">
            <AlertTriangle className="h-6 w-6" />
          </span>
          <p className="mt-4 text-sm font-bold text-slate-900">{card.productDefinitionId?.name}{ident ? ` · ${ident}` : ""}</p>
          <p className="mt-1 text-sm text-slate-600">will be marked faulty and moved to Repair &amp; Warranty.</p>
          <p className="mt-3 w-full rounded-lg bg-slate-50 px-3 py-2 text-left text-xs text-slate-600 ring-1 ring-inset ring-slate-200">
            <span className="font-semibold text-slate-700">Fault: </span>{note.trim()}
          </p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">No, go back</button>
          <button
            type="button" disabled={busy} onClick={submit}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Yes, I'm sure"}
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Report Faulty" onClose={onClose} maxWidth="max-w-md">
      <div className="mb-4 flex items-start gap-3 rounded-xl bg-amber-50 px-4 py-3 ring-1 ring-inset ring-amber-200">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div>
          <p className="text-sm font-bold text-slate-900">{card.productDefinitionId?.name}{ident ? ` · ${ident}` : ""}</p>
          <p className="mt-0.5 text-sm text-amber-800">This item will leave Available and move to Repair &amp; Warranty.</p>
        </div>
      </div>
      <label className="mb-1.5 block text-xs font-bold text-slate-700">What is wrong with it? <span className="text-rose-500">*</span></label>
      <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. does not power on" className={inputCls} autoFocus />
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">Cancel</button>
        <button
          type="button" disabled={!note.trim()} onClick={() => setConfirming(true)}
          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-50"
        >
          Report
        </button>
      </div>
    </Modal>
  );
};

/* ⋮ — View, and Report Faulty for a unit. */
const RowMenu = ({ items }) => {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const height = items.length * 40 + 8;
      const below = r.bottom + 6;
      setAt({
        top: below + height > window.innerHeight - 8 ? Math.max(8, r.top - height - 6) : below,
        left: Math.min(Math.max(8, r.right - 192), window.innerWidth - 200),
      });
    }
    setOpen((v) => !v);
  };
  return (
    <>
      <button
        ref={btnRef} type="button" onClick={toggle} aria-haspopup="menu" aria-expanded={open} aria-label="Row actions"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div role="menu" style={{ top: at.top, left: at.left }} className="fixed z-50 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
            {items.map((it) => (
              <button
                key={it.label} type="button" role="menuitem" onClick={() => { setOpen(false); it.onClick(); }}
                className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-medium transition ${it.danger ? "text-rose-600 hover:bg-rose-50" : "text-slate-700 hover:bg-slate-50"}`}
              >
                <it.icon className="h-4 w-4" /> {it.label}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </>
  );
};

/* ============================================================= */
/* View — the whole item on one page                              */
/* ============================================================= */
const REF_LABEL = { INVOICE: "Invoice", OPENING_STOCK: "Opening Stock", TRANSFER_REQUEST: "Transfer", ITEM_REQUEST: "Request" };
// Repair & Warranty steps — the note says the rest.
const MOVEMENT_LABEL = {
  REPORTED_FAULTY: "Reported faulty",
  SENT_FOR_REPAIR: "Sent for repair",
  REPAIRED: "Repaired",
  REPAIR_FAILED: "Repair failed",
  CLAIM_SENT: "Warranty claim sent",
  CLAIM_RETURNED: "Back from vendor, repaired",
  CLAIM_REJECTED: "Warranty claim refused",
  VENDOR_REPLACED: "Replaced by vendor",
  MARKED_OK: "Checked — working",
  SCRAPPED: "Scrapped",
  ASSIGNED: "Assigned",
};
const MOVEMENT_DOT = {
  RECEIVED: "bg-indigo-500 ring-indigo-50",
  TRANSFERRED: "bg-violet-500 ring-violet-50",
  ISSUED: "bg-sky-500 ring-sky-50",
  ASSIGNED: "bg-sky-500 ring-sky-50",
  RETURNED: "bg-emerald-500 ring-emerald-50",
};
const describeMovement = (m) => {
  if (m.type === "RECEIVED")
    return `Received via ${REF_LABEL[m.ref?.type] || "—"} ${m.ref?.refNumber || ""}${m.toBranchId?.name ? ` at ${m.toBranchId.name}` : ""}`;
  if (m.type === "TRANSFERRED")
    return `Transferred ${m.fromBranchId?.name || "—"} → ${m.toBranchId?.name || "—"}${m.ref?.refNumber ? ` (${m.ref.refNumber})` : ""}`;
  if (m.type === "ISSUED" || m.type === "RETURNED")
    return `${m.note || (m.type === "ISSUED" ? "Issued" : "Returned")}${m.ref?.refNumber ? ` (${m.ref.refNumber})` : ""}`;
  const label = MOVEMENT_LABEL[m.type] || m.type;
  return m.note && !m.note.startsWith(label) ? `${label}: ${m.note}` : m.note || label;
};

const Section = ({ title, icon: Icon, children }) => (
  <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-5 py-3">
      <Icon className="h-4 w-4 text-indigo-600" />
      <p className="text-xs font-bold uppercase tracking-wider text-slate-700">{title}</p>
    </div>
    <div className="px-5 py-2">{children}</div>
  </section>
);

const ItemDetailsView = ({ card, onBack }) => {
  const def = card.productDefinitionId || {};
  const isGroup = card.cardType === "group";
  const unit = unitLabel(def.unit);
  const fields = fieldsOf(card);
  const [timeline, setTimeline] = useState(null);
  const [batches, setBatches] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        if (isGroup) {
          const query = { status: "AVAILABLE" };
          if (card.branchId?._id) query.branchId = card.branchId._id;
          const json = await api.get(EP.history(def._id), { query, fallback: "Failed to load batches" });
          setBatches(json.data || []);
        } else {
          const json = await api.get(EP.timeline(card._id), { fallback: "Failed to load history" });
          setTimeline(json.data?.movements || []);
        }
      } catch (err) {
        toast.error(err.message);
        if (isGroup) setBatches([]); else setTimeline([]);
      }
    })();
  }, [card._id, card.branchId?._id, def._id, isGroup]);

  const src = card.source || {};
  const w = warrantyOf(card.warranty?.endDate);

  return (
    <div className="mx-auto max-w-6xl p-6 pb-12">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button
          type="button" onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold tracking-tight text-slate-900">{def.name || "Item"}</h1>
          <p className="truncate text-sm text-slate-500">{def.categoryPath || "—"} · {card.branchId?.name || "—"}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Available
        </span>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Section title="Item" icon={Tag}>
          <div className="divide-y divide-slate-100">
            {isGroup && <InfoRow label="Available quantity"><span className="text-indigo-700">{card.totalQty} {unit}</span></InfoRow>}
            {isGroup && <InfoRow label="Batches">{card.batchCount}</InfoRow>}
            {fields.map((fd) => <InfoRow key={fd._id} label={fd.label}>{valueOf(card, fd.code) ?? "—"}</InfoRow>)}
            <InfoRow label="Condition"><ConditionBadge condition={card.condition} /></InfoRow>
            {!isGroup && <InfoRow label="Warranty"><span className={w.cls}>{w.key === "EXPIRED" ? `Expired ${fmtDate(card.warranty?.endDate)}` : w.label}</span></InfoRow>}
            <InfoRow label={isGroup ? "Last received" : "Received on"}>{fmtDate(card.receivedAt)}</InfoRow>
          </div>
        </Section>

        {!isGroup && (
          <Section title="Came in via" icon={src.type === "OPENING_STOCK" ? Archive : Receipt}>
            <div className="divide-y divide-slate-100">
              <InfoRow label={SOURCE_LABEL[src.type] || "Source"}>{src.refNumber || card.invoiceId?.invoiceNumber || "—"}</InfoRow>
              {src.type !== "OPENING_STOCK" && <InfoRow label="Vendor">{card.vendorId?.name}</InfoRow>}
              <InfoRow label="Received">{fmtDateTime(card.receivedAt)}</InfoRow>
              {card.invoiceId?.receivedByName && <InfoRow label="Received by">{card.invoiceId.receivedByName}</InfoRow>}
              <InfoRow label="Purchase date">{fmtDate(card.purchaseDate)}</InfoRow>
              <InfoRow label="Cost">{card.purchaseCost === null || card.purchaseCost === undefined ? "Not known" : money(card.purchaseCost)}</InfoRow>
            </div>
          </Section>
        )}
      </div>

      {isGroup ? (
        <Section title="Batches" icon={Boxes}>
          {batches === null ? (
            <div className="my-2 h-12 animate-pulse rounded-lg bg-slate-100" />
          ) : batches.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No batches found.</p>
          ) : (
            <table className="my-2 w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  <th className="py-2">Received via</th><th className="py-2">Date</th><th className="py-2 text-right">Quantity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batches.map((b) => (
                  <tr key={b.refId || b.refNumber || "unknown"}>
                    <td className="py-2 font-semibold text-slate-900">{b.refNumber || "—"} <span className="text-xs font-normal text-slate-500">{SOURCE_LABEL[b.sourceType] || ""}</span></td>
                    <td className="py-2 text-slate-600">{fmtDate(b.receivedAt)}</td>
                    <td className="py-2 text-right font-semibold tabular-nums text-slate-900">{b.quantity} {unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      ) : (
        <Section title="History" icon={HistoryIcon}>
          {timeline === null ? (
            <div className="my-2 h-12 animate-pulse rounded-lg bg-slate-100" />
          ) : timeline.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No history recorded yet.</p>
          ) : (
            <ol className="relative my-3 ml-2 space-y-4 border-l border-slate-200 pl-6">
              {timeline.map((m) => (
                <li key={m._id} className="relative">
                  <span className={`absolute -left-7.75 top-1 h-3 w-3 rounded-full ring-4 ${MOVEMENT_DOT[m.type] || "bg-amber-500 ring-amber-50"}`} />
                  <p className="text-sm font-semibold text-slate-800">
                    {describeMovement(m)}
                    {m.quantity ? <span className="font-normal text-slate-500"> · {m.quantity}</span> : null}
                  </p>
                  <p className="text-xs text-slate-400">{fmtDateTime(m.at)}{m.createdBy?.name ? ` · ${m.createdBy.name}` : ""}</p>
                </li>
              ))}
            </ol>
          )}
        </Section>
      )}
    </div>
  );
};

/* ============================================================= */
/* Main                                                           */
/* ============================================================= */

const ItemInventory = () => {
  const searchParams = useSearchParams();
  const { permissions, isAdmin } = usePermissions();
  const canReportFaulty =
    isAdmin ||
    ((permissions || []).find((m) => m.moduleKey === "repairs")?.actions || []).map((a) => String(a).toUpperCase()).includes("REPORT");

  const [rows, setRows] = useState([]);
  const [listFields, setListFields] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  // Available Product and Product Summary send the product and branch along.
  const [productId, setProductId] = useState(searchParams.get("productDefinitionId") || "");
  const [branchId, setBranchId] = useState(searchParams.get("branchId") || "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [condition, setCondition] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [warranty, setWarranty] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);

  const [categories, setCategories] = useState([]);
  const [productOptions, setProductOptions] = useState([]);
  const [branches, setBranches] = useState([]);
  const [vendors, setVendors] = useState([]);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);

  const [viewing, setViewing] = useState(null);
  const [popup, setPopup] = useState(null); // { kind: "origin" | "fields" | "batches" | "faulty", card }

  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 350); return () => clearTimeout(t); }, [search]);

  useEffect(() => {
    (async () => {
      try { setCategories(await fetchLeafCategories()); } catch {}
      try { setBranches(await fetchScopedBranches("available-items")); } catch {}
      try { setVendors(await fetchVendors()); } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try { setProductOptions(await fetchProductOptions(categoryId || undefined)); } catch { setProductOptions([]); }
    })();
  }, [categoryId]);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const query = { page, limit, status: "AVAILABLE" };
      if (debouncedSearch.trim()) query.search = debouncedSearch.trim();
      if (categoryId) query.categoryId = categoryId;
      if (productId) query.productDefinitionId = productId;
      if (branchId) query.branchId = branchId;
      if (from) query.from = from;
      if (to) query.to = to;
      if (sourceType) query.sourceType = sourceType;
      if (condition) query.condition = condition;
      if (vendorId) query.vendorId = vendorId;
      if (warranty) query.warranty = warranty;
      const json = await api.get(EP.cards, { query, fallback: "Failed to fetch items" });
      setRows(json.data || []);
      setListFields(json.meta?.listFields || []);
      setTotal(json.pagination?.total ?? 0);
    } catch (err) {
      toast.error(err.message);
      setRows([]); setTotal(0);
    } finally { setLoading(false); }
  }, [page, limit, debouncedSearch, categoryId, productId, branchId, from, to, sourceType, condition, vendorId, warranty]);

  useEffect(() => { loadList(); }, [loadList]);

  const categoryOptions = useMemo(() => categories.map((c) => ({ value: c._id, label: c.displayPath || c.name })), [categories]);
  const vendorOptions = useMemo(() => vendors.map((v) => ({ value: v._id, label: v.name })), [vendors]);

  const listCodes = useMemo(() => new Set(listFields.map((f) => f.code)), [listFields]);
  // The Details fields of a row: every field of its product that has no column.
  const detailsOf = useCallback(
    (card) => fieldsOf(card).filter((fd) => !listCodes.has(fd.code) && (valueOf(card, fd.code) ?? "") !== ""),
    [listCodes]
  );
  const showDetails = rows.some((r) => detailsOf(r).length > 0);

  const moreCount = [sourceType, condition, vendorId, warranty].filter(Boolean).length;
  const hasActiveFilters = !!search || !!categoryId || !!productId || !!branchId || !!from || !!to || moreCount > 0;
  const clearFilters = () => {
    setSearch(""); setCategoryId(""); setProductId(""); setBranchId(""); setFrom(""); setTo("");
    setSourceType(""); setCondition(""); setVendorId(""); setWarranty(""); setPage(1);
  };
  const setAndReset = (fn) => (v) => { fn(v); setPage(1); };

  if (viewing) return <ItemDetailsView card={viewing} onBack={() => setViewing(null)} />;

  const colCount = 9 + listFields.length + (showDetails ? 1 : 0);

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <h1 className="mb-5 flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-900">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100">
          <PackageCheck className="h-5 w-5" />
        </span>
        Available Item
      </h1>

      {/* filters */}
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search serial, MAC, product..." className={`${inputCls} pl-9`}
            />
          </div>
          <div className="w-52"><SearchableSelect value={categoryId} onChange={(v) => { setCategoryId(v); setProductId(""); setPage(1); }} options={categoryOptions} placeholder="All categories" /></div>
          <div className="w-48"><SearchableSelect value={productId} onChange={setAndReset(setProductId)} options={productOptions} placeholder="All products" /></div>
          <div className="w-44"><SearchableSelect value={branchId} onChange={setAndReset(setBranchId)} options={branches.map((b) => ({ value: b._id, label: b.name }))} placeholder="All branches" /></div>
          <DateRangeButton from={from} to={to} onFrom={setAndReset(setFrom)} onTo={setAndReset(setTo)} hint="Received between these dates" />

          {/* the less-used filters, in one popover */}
          <div className="relative">
            <button
              type="button" onClick={() => setMoreOpen((v) => !v)} title="More filters"
              className={`inline-flex h-9.5 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold shadow-sm transition ${
                moreCount ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              {moreCount > 0 && <span className="rounded-full bg-indigo-600 px-1.5 text-[11px] font-bold text-white">{moreCount}</span>}
            </button>
            {moreOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMoreOpen(false)} />
                <div className="absolute right-0 z-40 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">More filters</p>
                  <div className="space-y-3">
                    <div>
                      <p className="mb-1 text-xs font-semibold text-slate-600">Came in via</p>
                      <SearchableSelect value={sourceType} onChange={setAndReset(setSourceType)} options={Object.entries(SOURCE_LABEL).map(([value, label]) => ({ value, label }))} placeholder="Any origin" />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold text-slate-600">Condition</p>
                      <SearchableSelect value={condition} onChange={setAndReset(setCondition)} options={[{ value: "NEW", label: "New" }, { value: "USED", label: "Used" }]} placeholder="Any condition" />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold text-slate-600">Vendor</p>
                      <SearchableSelect value={vendorId} onChange={setAndReset(setVendorId)} options={vendorOptions} placeholder="Any vendor" />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold text-slate-600">Warranty</p>
                      <SearchableSelect value={warranty} onChange={setAndReset(setWarranty)} options={WARRANTY_OPTIONS} placeholder="Any warranty" />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {hasActiveFilters && (
            <button
              type="button" onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600 shadow-sm transition hover:bg-rose-100"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className={`${th} w-12`}>#</th>
                <th className={th}>Category Path</th>
                <th className={th}>Product</th>
                {listFields.map((f) => <th key={f.code} className={th}>{f.label}</th>)}
                {showDetails && <th className={th}>Details</th>}
                <th className={th}>Branch</th>
                <th className={`${th} text-center!`}>Quantity</th>
                <th className={th}>Warranty</th>
                <th className={th}>Condition</th>
                <th className={th}>Received On</th>
                <th className={`${th} text-right!`}>Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 6 }).map((_, r) => (
                  <tr key={r} className="animate-pulse">
                    {Array.from({ length: colCount }).map((__, c) => <td key={c} className="px-4 py-4"><div className="h-3.5 w-3/4 rounded bg-slate-100" /></td>)}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr><td colSpan={colCount} className="px-4 py-16 text-center">
                  <Boxes className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-sm font-medium text-slate-700">No items in store</p>
                  <p className="mt-1 text-sm text-slate-400">{hasActiveFilters ? "Try changing or resetting the filters." : "Items appear here once stock is received."}</p>
                </td></tr>
              ) : (
                rows.map((card, i) => {
                  const def = card.productDefinitionId || {};
                  const isGroup = card.cardType === "group";
                  const details = detailsOf(card);
                  const w = warrantyOf(card.warranty?.endDate);
                  const menu = [{ label: "View", icon: Eye, onClick: () => setViewing(card) }];
                  if (!isGroup && canReportFaulty) menu.push({ label: "Report Faulty", icon: AlertTriangle, danger: true, onClick: () => setPopup({ kind: "faulty", card }) });
                  return (
                    <tr key={card._id} className="transition hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-indigo-50 px-1.5 text-xs font-bold text-indigo-600">{(page - 1) * limit + i + 1}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{def.categoryPath || "—"}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900">{def.name || "—"}</td>
                      {listFields.map((f) => {
                        const v = valueOf(card, f.code);
                        return (
                          <td key={f.code} className="whitespace-nowrap px-4 py-3 text-sm">
                            {v === "Multiple" ? (
                              <button type="button" onClick={() => setPopup({ kind: "batches", card })} className="font-medium text-indigo-600 underline decoration-dotted underline-offset-2">Multiple</button>
                            ) : v ? (
                              <span className="font-mono text-slate-800">{v}</span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        );
                      })}
                      {showDetails && (
                        <td className="whitespace-nowrap px-4 py-3 text-sm">
                          {details.length === 0 ? (
                            <span className="text-slate-300">—</span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5">
                              <span className="text-xs text-slate-400">{details[0].label}</span>
                              <span className="font-medium text-slate-800">{valueOf(card, details[0].code)}</span>
                              {details.length > 1 && (
                                <button
                                  type="button" onClick={() => setPopup({ kind: "fields", card, fields: details })}
                                  className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[11px] font-bold text-indigo-600 ring-1 ring-inset ring-indigo-100 transition hover:bg-indigo-100"
                                >
                                  +{details.length - 1}
                                </button>
                              )}
                            </span>
                          )}
                        </td>
                      )}
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{card.branchId?.name || "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-center text-sm">
                        {/* same "N unit" for both; the ⓘ slot is kept so the numbers line up */}
                        <span className="inline-flex items-center gap-1">
                          {/* batch stock in colour, so it stands apart from single units */}
                          <span className={`tabular-nums ${isGroup ? "font-bold text-indigo-700" : "font-semibold text-slate-900"}`}>{isGroup ? card.totalQty : 1}</span>
                          <span className="text-slate-500">{unitLabel(def.unit)}</span>
                          {isGroup ? (
                            <button type="button" onClick={() => setPopup({ kind: "batches", card })} title="Batch-wise" aria-label="Batches" className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-indigo-600">
                              <Info className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <span className="h-6 w-6" />
                          )}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        {isGroup || w.key === "NONE" ? (
                          <span className="text-slate-300">—</span>
                        ) : (
                          <span className={`inline-flex items-center gap-1 text-sm font-semibold ${w.cls}`}><w.icon className="h-3.5 w-3.5" /> {w.label}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        {card.condition ? <ConditionBadge condition={card.condition} /> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        <p className="inline-flex items-center gap-1.5 text-slate-700">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" title="Available" />
                          {fmtDate(card.receivedAt)}
                          {/* a batch row's origins are its batches — Qty's ⓘ */}
                          {!isGroup && (
                            <button
                              type="button" onClick={() => setPopup({ kind: "origin", card })} title="Came in via" aria-label="Came in via"
                              className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-indigo-600"
                            >
                              <Info className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right"><RowMenu items={menu} /></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {total > 10 && (
          <div className="border-t border-slate-100 px-4 py-3">
            <Pagination currentPage={page} totalItems={total} itemsPerPage={limit} onPageChange={setPage} onItemsPerPageChange={(n) => { setLimit(n); setPage(1); }} />
          </div>
        )}
      </div>

      {popup?.kind === "origin" && <OriginPopup card={popup.card} onClose={() => setPopup(null)} />}
      {popup?.kind === "fields" && <FieldsPopup card={popup.card} fields={popup.fields} onClose={() => setPopup(null)} />}
      {popup?.kind === "batches" && (
        <BatchBreakdownModal
          productName={popup.card.productDefinitionId?.name}
          unitText={unitLabel(popup.card.productDefinitionId?.unit)}
          defId={popup.card.productDefinitionId?._id}
          branchId={popup.card.branchId?._id}
          fields={fieldsOf(popup.card)}
          onClose={() => setPopup(null)}
        />
      )}
      {popup?.kind === "faulty" && (
        <ReportFaultyDialog
          card={popup.card} listFields={listFields}
          onClose={() => setPopup(null)}
          onDone={() => { setPopup(null); loadList(); }}
        />
      )}
    </div>
  );
};

export default ItemInventory;
