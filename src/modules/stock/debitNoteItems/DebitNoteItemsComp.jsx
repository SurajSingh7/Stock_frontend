"use client";

/*
  Debit Note Items — every unit sent back to its vendor on a debit note, and
  the money deducted. (Was "Faulty Items": Faulty now means one of OUR units
  waiting for repair.)

    Items      per debit-note line: invoice, vendor, branch, product, how much
               came in, how much went back, the note and its amount. 👁 shows
               the note's reason and the exact units (serial / MAC).
    By Vendor  received vs debited per vendor, worst first — a click opens
               that vendor's lines on Items.

  Debited = the note is approved. Under review = still in review or approval
  (its units are held). Rejected / withdrawn notes gave their units back and
  are not listed. Read-only.
*/

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { api } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/constants/api";
import { fetchVendors, fetchScopedBranches } from "@/modules/stock/shared/lookupsApi";
import Pagination from "@/shared/ui/pagination/Pagination";
import DateRangeButton from "@/modules/stock/shared/DateRangeButton";
import { Undo2, FileText, PackageX, IndianRupee, Hourglass, Eye, Info, ChevronRight } from "lucide-react";
import { SearchableSelect, Modal, money } from "@/modules/stock/shared/StockSharedUI";
import { Tile } from "@/modules/stock/reports/reportUi";
import { PageHeader, SearchBox, ResetButton, PersonCell, RowButton, EmptyRow, LoadingRows, th, fmtDate } from "@/modules/stock/inventoryTransfer/shared";
import { DnChip } from "@/modules/stock/invoiceList/DebitNoteParts";

const EP = API_ENDPOINTS.purchase.debitNoteItems;
const thR = `${th} text-right`;

const CHIPS = [
  { key: "", count: "ALL", label: "All", active: "border-indigo-600 bg-indigo-600 text-white", idle: "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100" },
  { key: "DEBITED", count: "DEBITED", label: "Debited", active: "border-emerald-600 bg-emerald-600 text-white", idle: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" },
  { key: "UNDER_REVIEW", count: "UNDER_REVIEW", label: "Under review", active: "border-amber-500 bg-amber-500 text-white", idle: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" },
];

// Red at 10% and above, amber from 5%.
const pctTone = (p) => (p == null ? "text-slate-400" : p >= 10 ? "text-rose-600" : p >= 5 ? "text-amber-600" : "text-slate-700");
const pct = (p) => (p == null ? "—" : `${p}%`);

/* 👁 — the note's reason and the exact units on one line. */
const LinePopup = ({ row, onClose, onOpenInvoice }) => {
  const [data, setData] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        setData((await api.get(EP.units(row.debitNoteId, row.lineIndex), { fallback: "Failed to load units" })).data);
      } catch (e) {
        toast.error(e.message);
        onClose();
      }
    })();
  }, [row.debitNoteId, row.lineIndex, onClose]);

  return (
    <Modal title={`DN-${row.dnNumber} · ${row.productName}`} onClose={onClose} maxWidth="max-w-2xl">
      {!data ? (
        <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm sm:grid-cols-4">
            <div><p className="text-xs text-slate-500">Status</p><div className="mt-0.5"><DnChip status={data.dnStatus} /></div></div>
            <div><p className="text-xs text-slate-500">Invoice</p><p className="mt-0.5 font-semibold text-slate-900">{data.invoiceNumber}</p></div>
            <div><p className="text-xs text-slate-500">Debited</p><p className="mt-0.5 font-semibold text-rose-700">{row.debitedQty} {data.unit === "meter" ? "m" : "pcs"}</p></div>
            <div><p className="text-xs text-slate-500">Amount</p><p className="mt-0.5 font-semibold text-rose-700">−{money(data.amount)}</p></div>
            <div className="sm:col-span-4"><p className="text-xs text-slate-500">Reason</p><p className="mt-0.5 text-slate-800">{data.reason || "—"}</p></div>
          </div>

          {data.units.length === 0 ? (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">Tracked by quantity — there are no serial numbers for this line.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                    <th className="px-3 py-2">#</th>
                    {data.fields.map((f) => <th key={f.code} className="px-3 py-2">{f.label}</th>)}
                    <th className="px-3 py-2">Stock status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.units.map((u, i) => (
                    <tr key={u._id}>
                      <td className="px-3 py-2 text-xs text-slate-400">{i + 1}</td>
                      {data.fields.map((f) => <td key={f.code} className="px-3 py-2 font-mono text-xs text-slate-800">{u.fieldValues?.[f.code] ?? "—"}</td>)}
                      <td className="px-3 py-2 text-xs text-slate-500">{String(u.status || "").toLowerCase().replace(/_/g, " ")}{u.isFoc ? " · FOC" : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end">
            <button type="button" onClick={onOpenInvoice} className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100">
              Open in Invoice List <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};

/* ⓘ — what the page counts. */
const AboutPopup = ({ onClose }) => (
  <Modal title="Debit Note Items — what it shows" onClose={onClose} maxWidth="max-w-md">
    <ul className="space-y-2 text-sm text-slate-700">
      <li><b>Debited</b> — the debit note is approved: the units went back to the vendor and the money came off the bill.</li>
      <li><b>Under review</b> — the note is still in review or approval; its units are held.</li>
      <li>Notes rejected in approval or withdrawn gave their units back, so they are not listed.</li>
      <li><b>Received</b> is what came in on that invoice line (FOC included). <b>%</b> is debited out of received — amber from 5%, red from 10%.</li>
    </ul>
  </Modal>
);

const DebitNoteItemsComp = () => {
  const router = useRouter();
  const [view, setView] = useState("items"); // items | vendors
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [totals, setTotals] = useState({});
  const [total, setTotal] = useState(0);
  const [vendorRows, setVendorRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [state, setState] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [vendors, setVendors] = useState([]);
  const [branches, setBranches] = useState([]);
  const [viewing, setViewing] = useState(null);
  const [about, setAbout] = useState(false);

  useEffect(() => { const t = setTimeout(() => setDebounced(search.trim()), 350); return () => clearTimeout(t); }, [search]);
  useEffect(() => {
    fetchVendors().then(setVendors).catch(() => setVendors([]));
    fetchScopedBranches("debit-note-items").then(setBranches).catch(() => setBranches([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (view === "vendors") {
        const json = await api.get(EP.byVendor, { query: { state, ...(branchId ? { branchId } : {}) }, fallback: "Failed to load" });
        setVendorRows(json.data || []);
      } else {
        const query = { page, limit, search: debounced, vendorId, branchId, state, from, to };
        const json = await api.get(EP.list, { query, fallback: "Failed to load" });
        setRows(json.data?.rows || []);
        setCounts(json.data?.counts || {});
        setTotals(json.data?.totals || {});
        setTotal(json.pagination?.total || 0);
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [view, page, limit, debounced, vendorId, branchId, state, from, to]);

  useEffect(() => { load(); }, [load]);

  const vendorOptions = useMemo(() => vendors.map((v) => ({ value: v._id, label: v.name })), [vendors]);
  const branchOptions = useMemo(() => branches.map((b) => ({ value: String(b._id), label: b.name })), [branches]);
  const reset = (fn) => (v) => { fn(v); setPage(1); };
  const filtered = !!search || !!vendorId || !!branchId || !!from || !!to;
  const clear = () => { setSearch(""); setVendorId(""); setBranchId(""); setFrom(""); setTo(""); setPage(1); };
  const openInvoice = (invoiceNumber) => router.push(`/stock/purchase/invoices?search=${encodeURIComponent(invoiceNumber)}`);
  const closeViewing = useCallback(() => setViewing(null), []);
  const COLS = 11;

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <PageHeader icon={Undo2} title="Debit Note Items">
        <Tile icon={FileText} label="Notes" value={totals.notes ?? 0} tone="border-slate-200 bg-white text-slate-700" />
        <Tile icon={PackageX} label="Units" value={totals.debitedQty ?? 0} tone="border-rose-200 bg-rose-50 text-rose-700" />
        <Tile icon={IndianRupee} label="Debited" value={money(totals.amount || 0)} tone="border-emerald-200 bg-emerald-50 text-emerald-700" />
        <Tile icon={Hourglass} label="Under review" value={money(totals.underReview || 0)} tone="border-amber-200 bg-amber-50 text-amber-700" />
      </PageHeader>

      <div className="mb-2.5 flex flex-wrap items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        {view === "items" && <div className="w-full sm:w-72"><SearchBox value={search} onChange={reset(setSearch)} placeholder="Invoice, PO, DN, product…" /></div>}
        {view === "items" && <div className="w-full sm:w-52"><SearchableSelect value={vendorId} onChange={reset(setVendorId)} options={vendorOptions} placeholder="All vendors" /></div>}
        <div className="w-full sm:w-52"><SearchableSelect value={branchId} onChange={reset(setBranchId)} options={branchOptions} placeholder="All branches" /></div>
        {view === "items" && <DateRangeButton from={from} to={to} onFrom={reset(setFrom)} onTo={reset(setTo)} hint="Debit note raised between these dates" />}
        {filtered && <ResetButton onClick={clear} />}
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {CHIPS.map((c) => {
          const on = state === c.key;
          return (
            <button
              key={c.key || "all"} type="button" onClick={() => { setState(c.key); setPage(1); }}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold shadow-sm transition ${on ? c.active : c.idle}`}
            >
              {c.label}
              {view === "items" && <span className={`rounded-full px-1.5 text-xs tabular-nums ${on ? "bg-white/25" : "bg-white/70"}`}>{counts[c.count] ?? 0}</span>}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
            {[{ key: "items", label: "Items" }, { key: "vendors", label: "By Vendor" }].map((t) => (
              <button
                key={t.key} type="button" onClick={() => { setView(t.key); setPage(1); }}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${view === t.key ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setAbout(true)} title="What this page shows" aria-label="What this page shows" className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-indigo-600">
            <Info className="h-4 w-4" />
          </button>
        </div>
      </div>

      {view === "items" ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-275 border-collapse text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className={th}>Invoice</th>
                <th className={th}>Vendor</th>
                <th className={th}>Branch</th>
                <th className={th}>Product</th>
                <th className={thR}>Received</th>
                <th className={thR}>Debited</th>
                <th className={thR}>%</th>
                <th className={th}>Debit Note</th>
                <th className={thR}>Amount</th>
                <th className={th}>Raised By</th>
                <th className={thR}>Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <LoadingRows cols={COLS} />
              ) : rows.length === 0 ? (
                <EmptyRow colSpan={COLS} icon={Undo2} title="No debit note items" hint={filtered || state ? "Try changing or resetting the filters." : "Units appear here once a debit note is raised."} />
              ) : (
                rows.map((r) => (
                  <tr key={r.key} className="transition hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{r.invoiceNumber}</p>
                      <p className="text-xs text-slate-400">{r.poNumber || "—"} · {fmtDate(r.invoiceDate)}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{r.vendorName || "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{r.branchName || "—"}</td>
                    <td className="px-4 py-3">
                      <p className="text-slate-900">{r.productName}</p>
                      <p className="text-xs text-slate-400">{r.categoryName}</p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{r.received}</td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-rose-700">{r.debitedQty}</td>
                    <td className={`px-4 py-3 text-right font-semibold tabular-nums ${pctTone(r.percent)}`}>{pct(r.percent)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        <button type="button" onClick={() => openInvoice(r.invoiceNumber)} title="Open in Invoice List" className="text-xs font-semibold text-indigo-600 hover:underline">DN-{r.dnNumber}</button>
                        <DnChip status={r.dnStatus} />
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-rose-700">−{money(r.amount)}</td>
                    <td className="px-4 py-3"><PersonCell actor={r.raisedBy} name={r.raisedByName} at={r.date} /></td>
                    <td className="px-4 py-3 text-right">
                      <RowButton icon={Eye} title={r.unitCount ? `The ${r.unitCount} units and the reason` : "The reason"} onClick={() => setViewing(r)} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {total > 10 && (
            <div className="border-t border-slate-100 px-4 py-3">
              <Pagination currentPage={page} totalItems={total} itemsPerPage={limit} onPageChange={setPage} onItemsPerPageChange={(n) => { setLimit(n); setPage(1); }} />
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-200 border-collapse text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className={th}>Vendor</th>
                <th className={thR}>Received</th>
                <th className={thR}>Debited</th>
                <th className={thR}>% Debited</th>
                <th className={thR}>Invoices</th>
                <th className={thR}>Debit Notes</th>
                <th className={thR}>Debited Value</th>
                <th className={thR}>Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <LoadingRows cols={8} />
              ) : vendorRows.length === 0 ? (
                <EmptyRow colSpan={8} icon={Undo2} title="No vendor has debit note items" />
              ) : (
                vendorRows.map((v) => (
                  <tr key={String(v.vendorId)} className="transition hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-semibold text-slate-900">{v.vendorName}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{v.received}</td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-rose-700">{v.debitedQty}</td>
                    <td className={`px-4 py-3 text-right font-bold tabular-nums ${pctTone(v.percent)}`}>{pct(v.percent)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{v.invoiceCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{v.debitNoteCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-rose-700">−{money(v.amount)}</td>
                    <td className="px-4 py-3 text-right">
                      {/* That vendor's lines on Items */}
                      <RowButton tone="indigo" icon={ChevronRight} onClick={() => { setVendorId(String(v.vendorId)); setView("items"); setPage(1); }}>Items</RowButton>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {viewing && <LinePopup row={viewing} onClose={closeViewing} onOpenInvoice={() => openInvoice(viewing.invoiceNumber)} />}
      {about && <AboutPopup onClose={() => setAbout(false)} />}
    </div>
  );
};

export default DebitNoteItemsComp;
