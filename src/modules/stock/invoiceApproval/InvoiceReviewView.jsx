"use client";

import React, { useState, useEffect, useMemo } from "react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import { ArrowLeft, Download, CheckCircle2, XCircle } from "lucide-react";
import { inputCls, money, unitLabel } from "@/modules/stock/shared/StockSharedUI";

const ROWS_PAGE_SIZE = 10;

const fmt = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const STATUS_META = {
  PENDING: { label: "Pending", badge: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500" },
  APPROVED: { label: "Approved", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  REJECTED: { label: "Rejected", badge: "bg-rose-50 text-rose-700 ring-rose-200", dot: "bg-rose-500" },
  IN_PROGRESS: { label: "In progress", badge: "bg-violet-50 text-violet-700 ring-violet-200", dot: "bg-violet-500" },
  DRAFT: { label: "Draft", badge: "bg-sky-50 text-sky-700 ring-sky-200", dot: "bg-sky-500" },
};
const StatusBadge = ({ status }) => {
  const m = STATUS_META[status] || {};
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${m.badge || "bg-slate-50 text-slate-600 ring-slate-200"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot || "bg-slate-400"}`} />
      {m.label || status}
    </span>
  );
};

const unitPriceBreakdown = (unitPrice, gstRate, taxType) => {
  const basic = Number(unitPrice) || 0;
  const rate = Number(gstRate) || 0;
  let cgst = 0, sgst = 0, igst = 0;
  if (taxType === "IGST") {
    igst = round2((basic * rate) / 100);
  } else {
    cgst = round2((basic * rate) / 200);
    sgst = cgst;
  }
  return { basic, cgst, sgst, igst, total: round2(basic + cgst + sgst + igst) };
};

async function fetchInvoiceDetail(id, entryId) {
  const qs = entryId ? `?entryId=${entryId}` : "";
  const res = await fetch(`${API_BACKEND_URL}/stock/invoices/${id}${qs}`, { credentials: "include" });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to load invoice");
  return json.data;
}
async function fetchProductDefinition(id) {
  const res = await fetch(`${API_BACKEND_URL}/stock/product-definitions/${id}`, { credentials: "include" });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to load product");
  return json.data;
}

/*
  The numbers the approver decides on, per product: category, PO qty, what
  earlier approved invoices brought in, what this invoice says, what was
  entered on it (and FOC), what stays pending on the PO — plus a check that
  the entry matches the invoice, and a bar of how far the PO has come.
  `isEntry`: reviewing one part of a partial-submit invoice, where the
  entered quantity is only part of the invoice by design.
*/
/*
  Column groups, in the order the arithmetic runs. Each is marked by a thin
  coloured rule under its name and a divider on its left — the table itself
  stays white; only the current invoice gets a faint tint, as the focus.
*/
const GROUP_RULE = {
  po: "border-slate-400 text-slate-600",
  earlier: "border-emerald-500 text-emerald-700",
  before: "border-amber-500 text-amber-700",
  current: "border-indigo-500 text-indigo-700",
  after: "border-violet-500 text-violet-700",
};

// partialWhole: a partial invoice viewed as a whole — "entered" is what its
// approved entries brought in, so a shortfall is progress, not a mismatch.
const ComparisonTable = ({ lines, isEntry, poNumber, partialWhole }) => {
  const rows = lines.map((l) => {
    const ordered = l.orderedQuantity || 0;
    const earlier = l.earlierReceivedQuantity || 0;
    const entered = l.receivedQuantity || 0;
    // Entry review: what earlier entries of THIS invoice already brought in.
    const approvedEarlier = l.approvedEarlierQuantity || 0;
    const before = Math.max(0, ordered - earlier - approvedEarlier);
    return {
      ...l, ordered, earlier, entered, before, approvedEarlier,
      earlierFoc: l.earlierFocQuantity || 0,
      invoiceQty: l.invoiceQuantity || 0,
      foc: l.focQuantity || 0,
      leftOnInvoice: Math.max(0, (l.invoiceQuantity || 0) - approvedEarlier - entered),
      after: Math.max(0, before - entered),
      matches: entered === (l.invoiceQuantity || 0),
    };
  });
  const sum = (k) => rows.reduce((t, r) => t + (r[k] || 0), 0);
  const pct = (n, of) => (of > 0 ? Math.min(100, (n / of) * 100) : 0);

  const divider = "border-l border-slate-100";
  const tint = "bg-indigo-50/50";
  const group = (key, label, span, extra = "") => (
    <th colSpan={span} className={`px-3 pt-3 pb-0 text-center ${extra}`}>
      <span className={`inline-block border-b-2 pb-1 text-[10px] font-bold uppercase tracking-[0.12em] ${GROUP_RULE[key]}`}>{label}</span>
    </th>
  );
  const sub = "px-3 pb-2 pt-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400";
  const num = "px-3 py-3 text-right align-top text-sm tabular-nums";
  const zero = (v, cls) => (v ? cls : "text-slate-300");

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <div>
          <p className="text-sm font-semibold text-slate-900">PO · Invoice · Received</p>
          <p className="text-xs text-slate-500">Where this invoice stands against the purchase order</p>
        </div>
        {poNumber && (
          <span className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-semibold tracking-wide text-white">{poNumber}</span>
        )}
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th />
            {group("po", "PO", 1, divider)}
            {group("earlier", isEntry ? "Earlier (other invoices)" : "Earlier received", 2, divider)}
            {group("before", "Before", 1, divider)}
            {group("current", "Current invoice", isEntry ? 5 : 3, `${divider} ${tint}`)}
            {group("after", "After", 1, divider)}
            <th className={divider} />
          </tr>
          <tr className="border-b border-slate-200">
            <th className="px-5 pb-2 pt-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">Product</th>
            <th className={`${sub} ${divider}`}>Qty</th>
            <th className={`${sub} ${divider}`}>Qty</th>
            <th className={sub}>FOC</th>
            <th className={`${sub} ${divider}`}>Pending</th>
            <th className={`${sub} ${divider} ${tint}`}>Inv qty</th>
            {isEntry && <th className={`${sub} ${tint}`}>Approved earlier</th>}
            <th className={`${sub} ${tint}`}>{isEntry ? "This entry" : partialWhole ? "Approved" : "Entered"}</th>
            <th className={`${sub} ${tint}`}>FOC</th>
            {isEntry && <th className={`${sub} ${tint}`}>Left on invoice</th>}
            <th className={`${sub} ${divider}`}>Pending</th>
            <th className={`px-3 pb-2 pt-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400 ${divider}`}>Check</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={r._id || r.quotationItemId} className={!isEntry && !partialWhole && !r.matches ? "bg-rose-50/40" : ""}>
              <td className="px-5 py-3 align-top">
                <p className="text-sm font-semibold text-slate-900">
                  {r.productName} <span className="text-xs font-normal text-slate-400">{unitLabel(r.unit)}</span>
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{r.categoryPath || r.categoryName || "—"}</p>
                <div
                  title={`${r.earlier + r.approvedEarlier} earlier · ${r.entered} this · ${r.after} pending of ${r.ordered}`}
                  className="mt-2 flex h-1 w-28 overflow-hidden rounded-full bg-slate-100"
                >
                  <div className="bg-emerald-500" style={{ width: `${pct(r.earlier + r.approvedEarlier, r.ordered)}%` }} />
                  <div className="bg-indigo-500" style={{ width: `${pct(r.entered, r.ordered)}%` }} />
                </div>
              </td>
              <td className={`${num} ${divider} font-semibold text-slate-900`}>{r.ordered}</td>
              <td className={`${num} ${divider} ${zero(r.earlier, "text-slate-800")}`}>{r.earlier}</td>
              <td className={`${num} ${zero(r.earlierFoc, "text-slate-800")}`}>{r.earlierFoc}</td>
              <td className={`${num} ${divider} text-slate-800`}>{r.before}</td>
              <td className={`${num} ${divider} ${tint} text-slate-800`}>{r.invoiceQty}</td>
              {isEntry && <td className={`${num} ${tint} ${zero(r.approvedEarlier, "text-emerald-700")}`}>{r.approvedEarlier}</td>}
              <td className={`${num} ${tint} font-bold ${isEntry || partialWhole || r.matches ? "text-indigo-700" : "text-rose-600"}`}>{r.entered}</td>
              <td className={`${num} ${tint} ${zero(r.foc, "font-semibold text-slate-800")}`}>{r.foc}</td>
              {isEntry && <td className={`${num} ${tint} font-semibold text-slate-800`}>{r.leftOnInvoice}</td>}
              <td className={`${num} ${divider} font-bold text-violet-700`}>{r.after}</td>
              <td className={`px-3 py-3 align-top ${divider}`}>
                {isEntry ? (
                  <span className="whitespace-nowrap rounded-md bg-violet-50 px-2 py-1 text-[11px] font-semibold text-violet-700">Part entry</span>
                ) : partialWhole && !r.matches ? (
                  <span className="whitespace-nowrap rounded-md bg-violet-50 px-2 py-1 text-[11px] font-semibold text-violet-700">Approved {r.entered}/{r.invoiceQty}</span>
                ) : r.matches ? (
                  <span className="whitespace-nowrap rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">✓ Match</span>
                ) : (
                  <span className="whitespace-nowrap rounded-md bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700">⚠ {r.entered}/{r.invoiceQty}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-200 bg-slate-50 text-sm font-bold text-slate-900">
            <td className="px-5 py-3">Total</td>
            <td className={`${num} ${divider}`}>{sum("ordered")}</td>
            <td className={`${num} ${divider}`}>{sum("earlier")}</td>
            <td className={num}>{sum("earlierFoc")}</td>
            <td className={`${num} ${divider}`}>{sum("before")}</td>
            <td className={`${num} ${divider} bg-indigo-50`}>{sum("invoiceQty")}</td>
            {isEntry && <td className={`${num} bg-indigo-50 text-emerald-700`}>{sum("approvedEarlier")}</td>}
            <td className={`${num} bg-indigo-50 text-indigo-700`}>{sum("entered")}</td>
            <td className={`${num} bg-indigo-50`}>{sum("foc")}</td>
            {isEntry && <td className={`${num} bg-indigo-50`}>{sum("leftOnInvoice")}</td>}
            <td className={`${num} ${divider} text-violet-700`}>{sum("after")}</td>
            <td className={divider} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

/*
  Reviewing one entry of a partial invoice: the whole bill first — what it is
  worth, how much is approved, what this entry adds — so an entry is never
  read as a bill of its own.
*/
// One headline figure of the glance card.
const Fig = ({ label, value, sub, tone = "text-slate-900" }) => (
  <div>
    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className={`mt-0.5 text-base font-bold tabular-nums ${tone}`}>{value}</p>
    {sub && <p className="text-[11px] text-slate-500">{sub}</p>}
  </div>
);

const BillGlance = ({ glance, grandTotal, currentEntryId, entryStatus }) => {
  const { invoiceQty, approvedQty, thisQty, thisValue, entries } = glance;
  const pct = (n) => (invoiceQty > 0 ? Math.round((n / invoiceQty) * 100) : 0);
  // approvedQty already includes this entry once it is approved — never add
  // it twice; a rejected entry adds nothing.
  const approved = entryStatus === "APPROVED";
  const rejected = entryStatus === "REJECTED";
  const before = approved ? Math.max(0, approvedQty - thisQty) : approvedQty;
  const after = rejected ? approvedQty : before + thisQty;
  const labels = approved
    ? ["Approved before this", "This entry ✓ approved", "Approved now"]
    : rejected
      ? ["Approved so far", "This entry ✕ rejected", "After this (not counted)"]
      : ["Approved so far", "This entry", "After approving this"];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-700">This bill at a glance</p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Fig label="Bill (whole invoice)" value={money(grandTotal)} sub={`${invoiceQty} qty`} />
        <Fig label={labels[0]} value={`${before} / ${invoiceQty}`} sub={`${pct(before)}%`} tone="text-emerald-700" />
        <Fig label={labels[1]} value={`${thisQty} qty`} sub={money(thisValue)} tone={rejected ? "text-rose-600" : "text-indigo-700"} />
        <Fig label={labels[2]} value={`${after} / ${invoiceQty}`} sub={`${pct(after)}%`} tone="text-violet-700" />
      </div>
      <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-slate-100" title={`${before} approved before · ${rejected ? 0 : thisQty} this entry · ${Math.max(0, invoiceQty - after)} left`}>
        <div className="bg-emerald-500" style={{ width: `${pct(before)}%` }} />
        {!rejected && <div className="bg-indigo-500" style={{ width: `${Math.min(100 - pct(before), pct(thisQty))}%` }} />}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="text-slate-500">Entries:</span>
        {entries.map((e) => {
          const current = String(e._id) === String(currentEntryId);
          const tone = current
            ? "bg-indigo-600 text-white"
            : e.status === "APPROVED"
              ? "bg-emerald-50 text-emerald-700"
              : e.status === "REJECTED"
                ? "bg-rose-50 text-rose-700"
                : "bg-amber-50 text-amber-800";
          const mark = e.status === "APPROVED" ? "✓ " : e.status === "REJECTED" ? "✕ " : "● ";
          return (
            <span key={e._id} className={`rounded-full px-2 py-0.5 font-semibold ${tone}`}>
              {mark}Entry {e.entryNumber} ({e.qty}{e.foc ? ` + ${e.foc} FOC` : ""}){current ? (entryStatus === "PENDING" ? " · reviewing" : " · viewing") : ""}
            </span>
          );
        })}
      </div>
    </div>
  );
};

const DetailField = ({ label, value }) => (
  <div>
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 text-sm font-medium text-slate-900">{value ?? "—"}</p>
  </div>
);

/*
  ⓘ price breakup for one product — paid units or FOC units, per unit × qty.
  Opens under the figure it explains; closes on any outside click.
*/
const BreakupPopover = ({ title, b, qty, taxType, foc, onClose }) => {
  const ref = React.useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);
  const rows = [
    ["Basic", b.basic],
    ...(taxType === "IGST" ? [["IGST", b.igst]] : [["CGST", b.cgst], ["SGST", b.sgst]]),
  ];
  return (
    <div ref={ref} className="absolute left-0 top-full z-30 mt-1.5 w-64 rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-xl">
      <p className={`mb-2 font-semibold ${foc ? "text-amber-700" : "text-emerald-700"}`}>{title}</p>
      {rows.map(([label, unit]) => (
        <div key={label} className="flex justify-between py-0.5 text-slate-600">
          <span>{label} <span className="text-slate-400">{money(unit)} × {qty}</span></span>
          <span className="tabular-nums text-slate-900">{money(round2(unit * qty))}</span>
        </div>
      ))}
      <div className="mt-1.5 flex justify-between border-t border-slate-100 pt-1.5 font-semibold text-slate-900">
        <span>Total <span className="font-normal text-slate-400">{money(b.total)} × {qty}</span></span>
        <span className="tabular-nums">{money(round2(b.total * qty))}</span>
      </div>
      {foc && <p className="mt-1.5 text-[10px] text-slate-400">Not billed — value only.</p>}
    </div>
  );
};

// One figure in a product card's summary line.
const Stat = ({ label, children }) => (
  <div className="relative px-5 py-3">
    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <div className="mt-1 text-sm font-semibold text-slate-900">{children}</div>
  </div>
);
const InfoButton = ({ onClick }) => (
  <button
    type="button" onClick={onClick} title="Price breakup"
    className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] font-bold text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
  >
    i
  </button>
);

const Stars = ({ value }) =>
  value ? (
    <span className="text-amber-500">
      {"★".repeat(Math.round(value))}<span className="text-slate-200">{"★".repeat(5 - Math.round(value))}</span>
      <span className="ml-1 text-sm font-semibold text-slate-800">{value}</span>
    </span>
  ) : (
    <span className="text-slate-400">—</span>
  );

/* ============================================================= */
/* One product: everything that matters on one line, the price      */
/* breakup behind ⓘ, and serials / batch details under "More".      */
/* ============================================================= */

const LineCard = ({ line, taxType, isEntry }) => {
  const [visible, setVisible] = useState(ROWS_PAGE_SIZE);
  const [open, setOpen] = useState(false);
  const [breakup, setBreakup] = useState(null); // "paid" | "foc"
  const [query, setQuery] = useState("");
  const isIndividual = line.trackingMethod === "individual";
  const b = unitPriceBreakdown(line.unitPrice, line.gstRate, taxType);
  const qty = line.receivedQuantity || 0;
  const focQty = line.focQuantity || 0;
  const unit = unitLabel(line.unit);
  const selectedFields = (line.productDef?.selectedFields || [])
    .slice()
    .sort((a, c) => (a.order ?? 0) - (c.order ?? 0))
    .map((sf) => sf.fieldDefId)
    .filter(Boolean);
  const rows = line.rows || [];
  // Group lines carry a single row covering the whole lot.
  const groupValues = isIndividual ? null : (rows.find((r) => !r.isFoc) || rows[0])?.fieldValues || null;

  const q = query.trim().toLowerCase();
  const filtered = q
    ? rows.filter((r) => Object.values(r.fieldValues || {}).some((v) => String(v ?? "").toLowerCase().includes(q)))
    : rows;
  const visibleRows = filtered.slice(0, visible);
  const paidRows = rows.filter((r) => !r.isFoc).length;
  const focRows = rows.length - paidRows;

  const toggleBreakup = (which) => setBreakup(breakup === which ? null : which);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-5 py-3.5">
        <div>
          <p className="text-sm font-semibold text-slate-900">{line.productName}</p>
          <p className="text-xs text-slate-500">{line.categoryPath || line.categoryName}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {isEntry && (
            <span className="rounded-md bg-violet-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-700">This entry</span>
          )}
          <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
            {isIndividual ? "Individual tracking" : "Group tracking"}
          </span>
        </div>
      </div>

      {/* Everything that matters, on one line */}
      <div className="grid grid-cols-2 divide-slate-100 sm:grid-cols-5 sm:divide-x">
        <Stat label="Qty received (paid)">{qty} {unit}</Stat>
        <Stat label="Grand total (paid)">
          <span className="text-emerald-700">{money(round2(b.total * qty))}</span>
          <InfoButton onClick={() => toggleBreakup("paid")} />
          {breakup === "paid" && (
            <BreakupPopover title={`Paid · ${qty} ${unit}`} b={b} qty={qty} taxType={taxType} onClose={() => setBreakup(null)} />
          )}
        </Stat>
        <Stat label="FOC qty">{focQty} {unit}</Stat>
        <Stat label="FOC value (free)">
          {focQty > 0 ? (
            <>
              <span className="text-amber-700">{money(round2(b.total * focQty))}</span>
              <span className="ml-1.5 rounded bg-amber-50 px-1 py-0.5 text-[9px] font-bold uppercase text-amber-700">free</span>
              <InfoButton onClick={() => toggleBreakup("foc")} />
              {breakup === "foc" && (
                <BreakupPopover title={`FOC (free) · ${focQty} ${unit}`} b={b} qty={focQty} taxType={taxType} foc onClose={() => setBreakup(null)} />
              )}
            </>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </Stat>
        <Stat label="Rating"><Stars value={line.rating?.rating} /></Stat>
      </div>
      {line.rating?.notes && (
        <p className="border-t border-slate-100 px-5 py-2 text-xs text-slate-600">“{line.rating.notes}”</p>
      )}

      {/* Serials / batch details, on demand */}
      <div className="border-t border-slate-100">
        <button
          type="button" onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-1.5 px-5 py-2.5 text-left text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        >
          <span className="text-slate-400">{open ? "▾" : "▸"}</span>
          More details
          <span className="font-normal text-slate-400">
            · {isIndividual ? `${rows.length} serials (${paidRows} paid + ${focRows} FOC)` : "Batch"}
          </span>
        </button>

        {open && (
          <div className="px-5 pb-4">
            {isIndividual && rows.length > 0 && (
              <>
                <div className="mb-2 flex justify-end">
                  <input
                    value={query} onChange={(e) => { setQuery(e.target.value); setVisible(ROWS_PAGE_SIZE); }}
                    placeholder="🔍 Search serial / MAC"
                    className="w-60 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        <th className="w-10 px-3 py-2">#</th>
                        <th className="w-16 px-3 py-2">Type</th>
                        {selectedFields.map((fd) => (
                          <th key={fd._id} className="px-3 py-2">{fd.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {visibleRows.length === 0 ? (
                        <tr><td colSpan={2 + selectedFields.length} className="px-3 py-3 text-center text-xs text-slate-400">No serial matches “{query}”.</td></tr>
                      ) : (
                        visibleRows.map((row, idx) => (
                          <tr key={idx} className={row.isFoc ? "bg-amber-50/50" : ""}>
                            <td className="px-3 py-2 tabular-nums text-slate-400">{idx + 1}</td>
                            <td className="px-3 py-2">
                              {row.isFoc ? (
                                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-700">FOC</span>
                              ) : (
                                <span className="text-[10px] font-medium text-slate-400">Paid</span>
                              )}
                            </td>
                            {selectedFields.map((fd) => (
                              <td key={fd._id} className="px-3 py-2 text-slate-700">{row.fieldValues?.[fd.code] ?? "—"}</td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {filtered.length > visible && (
                  <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500">
                    <span>Showing {Math.min(visible, filtered.length)} of {filtered.length}</span>
                    <button
                      type="button" onClick={() => setVisible((v) => v + ROWS_PAGE_SIZE)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Show {Math.min(ROWS_PAGE_SIZE, filtered.length - visible)} more
                    </button>
                  </div>
                )}
              </>
            )}

            {isIndividual && rows.length === 0 && <p className="text-xs text-slate-400">No serials on this entry.</p>}

            {/* Group records its fields once for the whole lot (paid + FOC). */}
            {!isIndividual && (
              groupValues && selectedFields.length > 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    Batch · {qty} {unit}{focQty > 0 ? ` + ${focQty} FOC` : ""}
                  </p>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {selectedFields.map((fd) => (
                      <DetailField key={fd._id} label={fd.label} value={groupValues[fd.code] ?? "—"} />
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400">No batch details recorded for this product.</p>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/* ============================================================= */
/* Main                                                            */
/* ============================================================= */

// entryId: reviewing one entry of a partial-submit invoice.
const InvoiceReviewView = ({ invoiceId, entryId, onBack, onDone }) => {
  const decisionUrl = (action) =>
    entryId
      ? `${API_BACKEND_URL}/stock/invoices/${invoiceId}/entries/${entryId}/${action}`
      : `${API_BACKEND_URL}/stock/invoices/${invoiceId}/${action}`;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [productDefs, setProductDefs] = useState({});

  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const detail = await fetchInvoiceDetail(invoiceId, entryId);
        setInvoice(detail);

        const ids = [...new Set((detail.lines || []).map((l) => String(l.productDefinitionId)))];
        const defs = {};
        await Promise.all(
          ids.map(async (id) => {
            try {
              defs[id] = await fetchProductDefinition(id);
            } catch {
              defs[id] = null;
            }
          })
        );
        setProductDefs(defs);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [invoiceId, entryId]);

  const lines = useMemo(
    () => (invoice?.lines || []).map((l) => ({ ...l, productDef: productDefs[String(l.productDefinitionId)] })),
    [invoice, productDefs]
  );

  const approve = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(decisionUrl("approve"), { method: "PATCH", credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to approve");
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submitReject = async () => {
    if (!reason.trim()) { setError("A reason is required to reject"); return; }
    setBusy(true); setError(null);
    try {
      const res = await fetch(decisionUrl("reject"), {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to reject");
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-6">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  const isPending = invoice?.status === "PENDING";
  // The whole bill — for an entry review the server sends it separately.
  const invoiceLines = invoice?.invoiceLines || invoice?.lines || [];
  const glance = invoice?.entry ? invoice.glance : null;
  // Billing + Misc is what the vendor's invoice adds up to.
  const invoiceTotal = invoice?.invoiceTotal ?? invoice?.grandTotal ?? 0;
  const amountDiff = round2((invoice?.invoiceAmount || 0) - invoiceTotal);
  const fileUrl = invoice?.invoiceFile ? `${API_BACKEND_URL.replace(/\/api\/v1$/, "")}${invoice.invoiceFile}` : "";

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-6 pb-12">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button" onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="min-w-0">
          <h1 className="text-lg font-bold tracking-tight text-slate-900">
            {invoice?.entry ? (
              <>Review Entry {invoice.entry.entryNumber} <span className="text-slate-500">· {invoice?.invoiceNumber}</span></>
            ) : (
              <>{isPending ? "Review" : "View"} Invoice {invoice?.invoiceNumber}</>
            )}
          </h1>
          <p className="truncate text-sm text-slate-500">
            PO {invoice?.poNumber || "—"} · {invoice?.vendorName || "—"}
            {invoice?.entry && ` · Partial invoice · entered by ${invoice.entry.submittedByName || "—"} · ${fmt(invoice.entry.submittedAt)}`}
          </p>
        </div>
        <span className="ml-auto"><StatusBadge status={invoice?.status} /></span>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      {invoice?.status === "REJECTED" && invoice?.rejectedReason && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Rejected: {invoice.rejectedReason}
        </div>
      )}

      {glance && <BillGlance glance={glance} grandTotal={invoiceTotal} currentEntryId={invoice?.entry?._id} entryStatus={invoice?.entry?.status} />}

      {isPending && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {glance && (
            <p className="mb-3 rounded-lg bg-indigo-50/70 px-3 py-2 text-xs text-indigo-800">
              {glance.firstApproval
                ? `Approving this entry accepts the whole bill (${money(invoiceTotal)}) into the vendor ledger.`
                : `This bill (${money(invoiceTotal)}) is already in the vendor ledger — approving this entry adds its stock only, not money.`}
            </p>
          )}
          {!rejecting ? (
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button" onClick={approve} disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" /> {busy ? "Approving…" : glance ? `Approve Entry ${invoice.entry.entryNumber}` : "Approve"}
              </button>
              <button
                type="button" onClick={() => setRejecting(true)} disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <XCircle className="h-4 w-4" /> {glance ? `Reject Entry ${invoice.entry.entryNumber}` : "Reject"}
              </button>
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">Reason for rejection</label>
              <textarea
                rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="Explain what needs to be corrected before resubmission"
                className={inputCls}
              />
              <div className="mt-3 flex justify-end gap-2.5">
                <button
                  type="button" onClick={() => { setRejecting(false); setReason(""); }}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button" onClick={submitReject} disabled={busy}
                  className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? "Submitting…" : "Submit Rejection"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <ComparisonTable
        lines={lines} isEntry={!!invoice?.entry} poNumber={invoice?.poNumber}
        partialWhole={!!invoice?.partialSubmit && !invoice?.entry}
      />

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-5 py-3">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Invoice Details{glance ? " · Bill — whole invoice" : ""}
          </p>
          {glance && (
            <span className="rounded-md bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
              This entry: {glance.thisQty} qty{glance.thisFoc ? ` + ${glance.thisFoc} FOC` : ""} · {money(glance.thisValue)} at PO rates
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
          <DetailField label="Invoice Date" value={fmt(invoice?.invoiceDate)} />
          <DetailField label="Received By" value={invoice?.receivedByName || invoice?.createdByName} />
          <DetailField label="Amount on invoice" value={money(invoice?.invoiceAmount)} />
          <DetailField
            label="Attachment"
            value={fileUrl ? <a href={fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:underline"><Download className="h-3.5 w-3.5" /> View file</a> : "—"}
          />
        </div>

        {/* Every product on the invoice, priced at PO rates */}
        <div className="border-t border-slate-100">
          <table className="w-full border-collapse">
            <thead className="bg-slate-50">
              <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-slate-600">
                <th className="px-5 py-2">Category</th>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">FOC</th>
                <th className="px-3 py-2 text-right">Unit price</th>
                <th className="px-3 py-2 text-right">GST</th>
                <th className="px-5 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoiceLines.map((l) => {
                const qty = l.invoiceQuantity || 0;
                const amount = round2(qty * (l.unitPrice || 0) * (1 + (l.gstRate || 0) / 100));
                return (
                  <tr key={l._id || l.quotationItemId}>
                    <td className="px-5 py-2 text-xs text-slate-500">{l.categoryPath || l.categoryName || "—"}</td>
                    <td className="px-3 py-2 text-sm font-medium text-slate-900">{l.productName}</td>
                    <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-900">{qty}</td>
                    <td className={`px-3 py-2 text-right text-sm tabular-nums ${l.focQuantity ? "font-semibold text-amber-700" : "text-slate-400"}`}>{l.focQuantity || 0}</td>
                    <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-700">{money(l.unitPrice)}</td>
                    <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-700">{l.gstRate || 0}%</td>
                    <td className="px-5 py-2 text-right text-sm font-semibold tabular-nums text-slate-900">{money(amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {(invoice?.extraCharges?.length > 0 || invoice?.notes) && (
          <div className="space-y-2 border-t border-slate-100 px-5 py-3 text-sm text-slate-700">
            {invoice?.extraCharges?.length > 0 && (
              <p>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Misc: </span>
                {invoice.extraCharges.map((c, i) => (
                  <span key={i} className={c.includeInBilling === false ? "text-slate-400" : ""}>
                    {i > 0 && " · "}{c.note || "Charge"} {money(c.amount)}
                    {c.includeInBilling === false && (
                      <span className="ml-1 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500">Not billed</span>
                    )}
                  </span>
                ))}
              </p>
            )}
            {invoice?.notes && (
              <p className="whitespace-pre-wrap">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes: </span>{invoice.notes}
              </p>
            )}
          </div>
        )}

        {/* The amount check: PO rates against what the invoice says */}
        <div className="flex justify-end border-t border-slate-100 px-5 py-4">
          <div className="w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between text-slate-600"><span>Basic</span><span className="tabular-nums">{money(invoice?.basicAmount)}</span></div>
            {invoice?.taxType === "IGST" ? (
              <div className="flex justify-between text-slate-600"><span>IGST</span><span className="tabular-nums">{money(invoice?.igstAmount)}</span></div>
            ) : (
              <>
                <div className="flex justify-between text-slate-600"><span>CGST</span><span className="tabular-nums">{money(invoice?.cgstAmount)}</span></div>
                <div className="flex justify-between text-slate-600"><span>SGST</span><span className="tabular-nums">{money(invoice?.sgstAmount)}</span></div>
              </>
            )}
            <div className="flex justify-between border-t border-slate-200 pt-1.5 font-semibold text-slate-800">
              <span>Billing</span><span className="tabular-nums">{money(invoice?.grandTotal)}</span>
            </div>
            <div className="flex justify-between text-slate-600"><span>+ Misc</span><span className="tabular-nums">{money(invoice?.miscTotal ?? invoice?.extraChargesTotal)}</span></div>
            <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold text-slate-900">
              <span>Total (PO rates)</span><span className="tabular-nums">{money(invoiceTotal)}</span>
            </div>
            <div className="flex justify-between text-slate-700"><span>Amount on invoice</span><span className="tabular-nums">{money(invoice?.invoiceAmount)}</span></div>
            <div className={`flex justify-between font-semibold ${Math.abs(amountDiff) > 1 ? "text-rose-600" : "text-emerald-700"}`}>
              <span>Difference</span>
              <span className="tabular-nums">
                {Math.abs(amountDiff) > 1 ? `${amountDiff > 0 ? "+" : "−"}${money(Math.abs(amountDiff))} ⚠` : "₹0 ✓"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {lines.map((line) => (
          <LineCard key={line._id || line.quotationItemId} line={line} taxType={invoice?.taxType} isEntry={!!invoice?.entry} />
        ))}
      </div>
    </div>
  );
};

export default InvoiceReviewView;
