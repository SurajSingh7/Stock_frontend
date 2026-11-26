"use client";

import React, { useState, useEffect, useMemo } from "react";
import { fetchInvoice as fetchInvoiceDetail, fetchProductDefinition, decideInvoice } from "@/modules/stock/tracking-orders/trackingApi";
import { invoiceFileUrl } from "@/modules/stock/shared/InvoiceInfoPopups";
import { poPdfUrl } from "@/modules/stock/purchaseOrder/purchaseOrderApi";
import { ArrowLeft, Download, CheckCircle2, XCircle, FileText, ExternalLink, Info } from "lucide-react";
import { inputCls, money, unitLabel, Modal } from "@/modules/stock/shared/StockSharedUI";

const isPdf = (path) => /\.pdf$/i.test(path || "");

/*
  Why the vendor's total and the PO rates disagree: each product at its PO
  rate, the tax, billed misc, and the two totals side by side.
*/
const MismatchPopup = ({ invoice, onClose }) => {
  const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  const lines = invoice?.lines || [];
  const billedMisc = (invoice?.extraCharges || []).filter((c) => c.includeInBilling !== false);
  const unbilledMisc = (invoice?.extraCharges || []).filter((c) => c.includeInBilling === false);
  const poTotal = invoice?.invoiceTotal ?? invoice?.grandTotal ?? 0;
  const diff = r2((invoice?.invoiceAmount || 0) - poTotal);
  const row = "flex justify-between py-1 text-sm";
  return (
    <Modal onClose={onClose} title={`Why the amount does not match · ${invoice?.invoiceNumber || ""}`} maxWidth="max-w-xl">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">At PO rates</p>
      <table className="mb-3 w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <th className="py-1">Product</th>
            <th className="py-1 text-right">Qty × Rate</th>
            <th className="py-1 text-right">GST</th>
            <th className="py-1 text-right">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {lines.map((l) => {
            const qty = l.invoiceQuantity || 0;
            const basic = r2(qty * (l.unitPrice || 0));
            return (
              <tr key={l._id || l.quotationItemId}>
                <td className="py-1.5 font-medium text-slate-900">{l.productName}</td>
                <td className="py-1.5 text-right tabular-nums text-slate-600">{qty} × {money(l.unitPrice)}</td>
                <td className="py-1.5 text-right tabular-nums text-slate-600">{l.gstRate || 0}%</td>
                <td className="py-1.5 text-right font-semibold tabular-nums text-slate-900">{money(r2(basic * (1 + (l.gstRate || 0) / 100)))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="rounded-lg bg-slate-50 px-3 py-2">
        <div className={row}><span className="text-slate-600">Basic</span><span className="tabular-nums">{money(invoice?.basicAmount)}</span></div>
        {invoice?.taxType === "IGST" ? (
          <div className={row}><span className="text-slate-600">IGST</span><span className="tabular-nums">{money(invoice?.igstAmount)}</span></div>
        ) : (
          <>
            <div className={row}><span className="text-slate-600">CGST</span><span className="tabular-nums">{money(invoice?.cgstAmount)}</span></div>
            <div className={row}><span className="text-slate-600">SGST</span><span className="tabular-nums">{money(invoice?.sgstAmount)}</span></div>
          </>
        )}
        <div className={`${row} border-t border-slate-200 font-semibold`}><span>Billing (Basic + GST)</span><span className="tabular-nums">{money(invoice?.grandTotal)}</span></div>
        {billedMisc.map((c, i) => (
          <div key={i} className={row}><span className="text-slate-600">+ {c.note || "Misc"}</span><span className="tabular-nums">{money(c.amount)}</span></div>
        ))}
        {unbilledMisc.map((c, i) => (
          <div key={`u${i}`} className={`${row} text-slate-400`}><span>{c.note || "Misc"} (not billed — not added)</span><span className="tabular-nums">{money(c.amount)}</span></div>
        ))}
        <div className={`${row} border-t border-slate-200 font-bold text-slate-900`}><span>Total at PO rates</span><span className="tabular-nums">{money(poTotal)}</span></div>
        <div className={`${row} font-bold text-slate-900`}><span>Amount on invoice</span><span className="tabular-nums">{money(invoice?.invoiceAmount)}</span></div>
        <div className={`${row} border-t border-rose-200 font-bold text-rose-600`}>
          <span>Difference</span>
          <span className="tabular-nums">{diff > 0 ? "+" : "−"}{money(Math.abs(diff))} ({diff > 0 ? "invoice is more" : "invoice is less"})</span>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Common reasons: the vendor billed a different rate than the PO, a misc charge on the invoice is marked “not billed”
        here (or the other way round), or a quantity was typed differently.
      </p>
    </Modal>
  );
};

/* The PO as its PDF, in a popup — opened from the summary's PO badge. */
const PoPopup =({ poId, poNumber, onClose }) => {
  const url = poPdfUrl(poId);
  return (
    <Modal onClose={onClose} maxWidth="max-w-5xl">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-base font-semibold text-slate-900">PO Document · {poNumber || "—"}</p>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={url} download={`${poNumber || "PO"}.pdf`}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" /> Download
          </a>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        <iframe src={url} title={`PO ${poNumber || ""}`} className="h-[75vh] w-full" />
      </div>
    </Modal>
  );
};

const ROWS_PAGE_SIZE = 10;

const fmt = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const STATUS_META = {
  PENDING: { label: "Pending", badge: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500" },
  APPROVED: { label: "Approved", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  REJECTED: { label: "Rejected", badge: "bg-rose-50 text-rose-700 ring-rose-200", dot: "bg-rose-500" },
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


/*
  Quantity & amount summary, one row per product: what the PO ordered, what
  each earlier approved invoice brought in (one column each, oldest first),
  this invoice, and what is left on the PO once this one is approved. Each
  cell reads "qty · ₹worth" at the PO rate incl. GST. FOC rides along below
  as "+N FOC" — it never counts against the PO and is never priced.
*/
const QtyAmount = ({ qty, amount, foc, tone = "text-slate-900", amountTone = "text-slate-500", empty = "—" }) => (
  <>
    {qty > 0 ? (
      <span className="whitespace-nowrap">
        <span className={`font-bold ${tone}`}>{qty}</span>
        <span className="mx-1 text-slate-300">·</span>
        <span className={`text-xs font-medium ${amountTone}`}>{money(amount)}</span>
      </span>
    ) : (
      <span className="text-slate-300">{empty}</span>
    )}
    {foc > 0 && <span className="block text-[11px] font-semibold text-amber-700">+{foc} FOC</span>}
  </>
);

const ComparisonTable = ({ lines, poNumber, invoiceNumber, invoiceDate, earlierInvoices = [], onViewPo }) => {
  const rows = lines.map((l) => {
    // One unit's worth at the PO rate, GST included.
    const rate = (l.unitPrice || 0) * (1 + (l.gstRate || 0) / 100);
    const worth = (q) => round2((q || 0) * rate);
    const ordered = l.orderedQuantity || 0;
    const byInvoice = new Map((l.earlierInvoices || []).map((e) => [String(e.invoiceId), e]));
    const earlier = earlierInvoices.map((inv) => {
      const e = byInvoice.get(String(inv._id)) || { quantity: 0, focQuantity: 0 };
      return { ...e, amount: worth(e.quantity) };
    });
    const earlierQty = earlier.reduce((t, e) => t + (e.quantity || 0), 0);
    const qty = l.receivedQuantity || 0;
    const left = Math.max(0, ordered - earlierQty - qty);
    return {
      ...l, ordered, earlier, qty, left,
      foc: l.focQuantity || 0,
      orderedAmount: worth(ordered),
      amount: worth(qty),
      leftAmount: worth(left),
    };
  });
  const sum = (pick) => round2(rows.reduce((t, r) => t + (pick(r) || 0), 0));
  const noEarlier = earlierInvoices.length === 0;

  const head = "px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wide text-slate-500 whitespace-nowrap";
  const num = "px-4 py-3 text-right align-top text-sm tabular-nums";
  const current = "bg-indigo-50/60";

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <div>
          <p className="text-sm font-semibold text-slate-900">Quantity &amp; amount summary</p>
          <p className="text-xs text-slate-500">PO, every earlier invoice, and this one — amounts at PO rates incl. GST</p>
        </div>
        {poNumber && (
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-semibold tracking-wide text-white">{poNumber}</span>
            {onViewPo && (
              <button
                type="button" onClick={onViewPo}
                className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
              >
                <FileText className="h-3.5 w-3.5" /> View PO
              </button>
            )}
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200">
              <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">Product</th>
              <th className={head}>PO</th>
              {noEarlier ? (
                <th className={`${head} text-center`}>Earlier invoices</th>
              ) : (
                earlierInvoices.map((inv) => (
                  <th key={inv._id} className={head}>
                    {inv.invoiceNumber}
                    <span className="block text-[10px] font-medium normal-case tracking-normal text-slate-400">{fmt(inv.invoiceDate)}</span>
                  </th>
                ))
              )}
              <th className={`${head} ${current} text-indigo-700`}>
                ▶ This invoice
                <span className="block text-[10px] font-medium normal-case tracking-normal text-indigo-500">
                  {invoiceNumber}{invoiceDate ? ` · ${fmt(invoiceDate)}` : ""}
                </span>
              </th>
              <th className={`${head} text-rose-600`}>Left after this</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, idx) => (
              <tr key={r._id || r.quotationItemId}>
                <td className="px-5 py-3 align-top">
                  <p className="text-sm font-semibold text-slate-900">
                    {r.productName} <span className="text-xs font-normal text-slate-400">{unitLabel(r.unit)}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">{r.categoryPath || r.categoryName || "—"}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{money(r.unitPrice)} + {r.gstRate || 0}% GST</p>
                </td>
                <td className={num}><QtyAmount qty={r.ordered} amount={r.orderedAmount} /></td>
                {noEarlier
                  ? idx === 0 && (
                      <td rowSpan={rows.length} className="px-4 py-3 text-center align-middle text-xs italic text-slate-400">
                        No earlier invoice
                      </td>
                    )
                  : r.earlier.map((e, i) => (
                      <td key={i} className={num}>
                        <QtyAmount qty={e.quantity} amount={e.amount} foc={e.focQuantity} tone="text-slate-800" />
                      </td>
                    ))}
                <td className={`${num} ${current}`}>
                  <QtyAmount qty={r.qty} amount={r.amount} foc={r.foc} tone="text-indigo-700" amountTone="text-indigo-500" empty="0" />
                </td>
                <td className={num}>
                  {r.left > 0 ? (
                    <QtyAmount qty={r.left} amount={r.leftAmount} tone="text-rose-600" amountTone="text-rose-500" />
                  ) : (
                    <span className="font-bold text-emerald-700">0 ✓</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-50 text-sm">
              <td className="px-5 py-3 align-top font-bold text-slate-900">Total</td>
              <td className={num}><QtyAmount qty={sum((r) => r.ordered)} amount={sum((r) => r.orderedAmount)} amountTone="text-slate-600" /></td>
              {noEarlier ? (
                <td />
              ) : (
                earlierInvoices.map((inv, i) => (
                  <td key={inv._id} className={num}>
                    <QtyAmount qty={sum((r) => r.earlier[i].quantity)} amount={sum((r) => r.earlier[i].amount)} amountTone="text-slate-600" />
                  </td>
                ))
              )}
              <td className={`${num} ${current}`}>
                <QtyAmount qty={sum((r) => r.qty)} amount={sum((r) => r.amount)} tone="text-indigo-700" amountTone="text-indigo-600" empty="0" />
              </td>
              <td className={num}>
                {sum((r) => r.left) > 0 ? (
                  <QtyAmount qty={sum((r) => r.left)} amount={sum((r) => r.leftAmount)} tone="text-rose-600" amountTone="text-rose-500" />
                ) : (
                  <span className="font-bold text-emerald-700">0 ✓</span>
                )}
              </td>
            </tr>
          </tfoot>
        </table>
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

const lineKey = (l) => String(l._id || l.quotationItemId);

/*
  One tab per product, numbered, with what this invoice brought in on the chip
  — same look as the Quotation Approval category tabs.
*/
const ProductTabs = ({ lines, activeKey, onSelect }) => (
  <div className="border-b border-slate-100 p-3">
    <div className="flex gap-1.5 overflow-x-auto rounded-xl bg-slate-100/80 p-1.5 pb-2.5">
      {lines.map((l, idx) => {
        const active = lineKey(l) === activeKey;
        const qty = l.receivedQuantity || 0;
        const foc = l.focQuantity || 0;
        return (
          <button
            key={lineKey(l)} type="button" onClick={() => onSelect(lineKey(l))} title={l.productName}
            className={`relative flex min-w-37.5 shrink-0 flex-col gap-0.5 rounded-lg px-3.5 pb-2 pt-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 ${
              active
                ? "bg-slate-700 text-white shadow-md shadow-slate-300"
                : "bg-white/60 text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-white hover:text-slate-900"
            }`}
          >
            <span className="flex items-center gap-2">
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums ${
                active ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
              }`}>
                {idx + 1}
              </span>
              <span className="max-w-45 truncate text-sm font-semibold">{l.productName}</span>
              <span className={`ml-auto shrink-0 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                active ? "bg-white/15 text-white" : "bg-white text-slate-500 ring-1 ring-inset ring-slate-200"
              }`}>
                {qty} {unitLabel(l.unit)}{foc ? ` +${foc} FOC` : ""}
              </span>
            </span>
            <span className={`truncate pl-7 text-[11px] ${active ? "text-slate-300" : "text-slate-400"}`}>{l.categoryPath || l.categoryName || ""}</span>
            {/* pointer under the open tab, aimed at its content below */}
            {active && (
              <span className="absolute -bottom-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 rounded-[2px] bg-slate-700" />
            )}
          </button>
        );
      })}
    </div>
  </div>
);

// bare: drawn inside the product-tabs card, so no border / shadow of its own.
const LineCard = ({ line, taxType, bare = false }) => {
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
    <div className={bare ? "" : "rounded-2xl border border-slate-200 bg-white shadow-sm"}>
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-5 py-3.5">
        <div>
          <p className="text-sm font-semibold text-slate-900">{line.productName}</p>
          <p className="text-xs text-slate-500">{line.categoryPath || line.categoryName}</p>
        </div>
        <div className="flex items-center gap-1.5">
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

const InvoiceReviewView = ({ invoiceId, onBack, onDone }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [productDefs, setProductDefs] = useState({});

  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [showPo, setShowPo] = useState(false);
  const [showMismatch, setShowMismatch] = useState(false);
  const [activeKey, setActiveKey] = useState(null); // product tab open below

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const detail = await fetchInvoiceDetail(invoiceId);
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
  }, [invoiceId]);

  const lines = useMemo(
    () => (invoice?.lines || []).map((l) => ({ ...l, productDef: productDefs[String(l.productDefinitionId)] })),
    [invoice, productDefs]
  );
  const activeLine = lines.find((l) => lineKey(l) === activeKey) || lines[0];

  const approve = async () => {
    setBusy(true); setError(null);
    try {
      await decideInvoice(invoiceId, "approve");
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
      await decideInvoice(invoiceId, "reject", { reason: reason.trim() });
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
  // Billing + Misc is what the vendor's invoice adds up to.
  const invoiceTotal = invoice?.invoiceTotal ?? invoice?.grandTotal ?? 0;
  const amountDiff = round2((invoice?.invoiceAmount || 0) - invoiceTotal);
  const fileUrl = invoiceFileUrl(invoice?.invoiceFile);

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
            {isPending ? "Review" : "View"} Invoice {invoice?.invoiceNumber}
          </h1>
          <p className="truncate text-sm text-slate-500">
            PO {invoice?.poNumber || "—"} · {invoice?.vendorName || "—"}
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

      {isPending && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {!rejecting ? (
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button" onClick={approve} disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" /> {busy ? "Approving…" : "Approve"}
              </button>
              <button
                type="button" onClick={() => setRejecting(true)} disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <XCircle className="h-4 w-4" /> Reject
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
        lines={lines} poNumber={invoice?.poNumber} invoiceNumber={invoice?.invoiceNumber}
        invoiceDate={invoice?.invoiceDate} earlierInvoices={invoice?.earlierInvoices || []}
        onViewPo={invoice?.poId ? () => setShowPo(true) : null}
      />
      {showPo && <PoPopup poId={invoice.poId} poNumber={invoice?.poNumber} onClose={() => setShowPo(false)} />}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-5 py-3">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Invoice Details</p>
        </div>
        <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
          <DetailField label="Invoice Date" value={fmt(invoice?.invoiceDate)} />
          <DetailField label="Received By" value={invoice?.receivedByName || invoice?.createdByName} />
          <DetailField label="Amount on invoice" value={money(invoice?.invoiceAmount)} />
          <DetailField
            label="Attachment"
            value={fileUrl ? <a href={fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:underline"><ExternalLink className="h-3.5 w-3.5" /> Open in new tab</a> : "—"}
          />
        </div>

        {/* Only when the vendor's total and the PO rates (+ billed misc) disagree */}
        {Math.abs(amountDiff) > 1 && (
          <div className="mx-5 mb-4 flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            <span className="flex-1">
              ⚠ <span className="font-semibold">Amount mismatch</span> — invoice says{" "}
              <span className="font-semibold">{money(invoice?.invoiceAmount)}</span>, PO rates give{" "}
              <span className="font-semibold">{money(invoiceTotal)}</span> ({money(Math.abs(amountDiff))} {amountDiff > 0 ? "more" : "less"})
            </span>
            <button
              type="button" onClick={() => setShowMismatch(true)} title="Why it does not match"
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-rose-300 bg-white px-2 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
            >
              <Info className="h-3.5 w-3.5" /> Details
            </button>
          </div>
        )}
        {showMismatch && <MismatchPopup invoice={invoice} onClose={() => setShowMismatch(false)} />}

        {(invoice?.extraCharges?.length > 0 || invoice?.notes) && (
          <div className="mb-4 space-y-2 border-y border-slate-100 px-5 py-3 text-sm text-slate-700">
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

        {/* The vendor's invoice itself, open by default — a PDF in a viewer, an image as itself. */}
        {fileUrl && (
          <div className="mx-5 mb-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            {isPdf(invoice?.invoiceFile) ? (
              <iframe src={fileUrl} title={`Invoice ${invoice?.invoiceNumber || ""}`} className="h-[75vh] w-full" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- an uploaded file on another host, sized by the viewer
              <img src={fileUrl} alt={`Invoice ${invoice?.invoiceNumber || ""}`} className="mx-auto max-h-[75vh] w-auto object-contain" />
            )}
          </div>
        )}
      </div>

      {lines.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <ProductTabs lines={lines} activeKey={activeLine && lineKey(activeLine)} onSelect={setActiveKey} />
          {activeLine && <LineCard key={lineKey(activeLine)} line={activeLine} taxType={invoice?.taxType} bare />}
        </div>
      )}
    </div>
  );
};

export default InvoiceReviewView;
