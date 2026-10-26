"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import { SearchableSelect, money, unitLabel } from "@/modules/stock/shared/StockSharedUI";
import { SOURCE_LABEL, fmtDate } from "@/modules/stock/inventory/itemBadges";

/*
  Stock Reports — inventory (not billing): where everything is, what it is
  worth, whose warranty is running out, what is with customers, and how long
  broken units have been waiting.
*/

const BASE = `${API_BACKEND_URL}/stock/stock-reports`;
const get = async (path, query) => {
  const res = await fetch(`${BASE}/${path}?${new URLSearchParams(query)}`, { credentials: "include" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) throw new Error(json.message || "Failed to load the report");
  return json.data;
};

const TABS = [
  { value: "position", label: "Stock Position" },
  { value: "value", label: "Stock Value" },
  { value: "warranty", label: "Warranty" },
  { value: "subscribers", label: "With Subscribers" },
  { value: "repairs", label: "Repairs Ageing" },
];

const STATUS_LABEL = {
  AVAILABLE: "Available", ASSIGNED: "Assigned", IN_TRANSIT: "In transit", FAULTY: "Faulty",
  IN_REPAIR: "In repair", AT_VENDOR: "At vendor", VENDOR_REPLACED: "Vendor replaced", DEBITED: "Debited", SCRAPPED: "Scrapped",
};

const th = "px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-slate-600 whitespace-nowrap";
const td = "px-3 py-2 text-slate-700";

// CSV of what is on screen: [[header…], [row…], …]
const downloadCsv = (name, rows) => {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const blob = new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
};

const Card = ({ label, value, tone = "slate" }) => (
  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone === "rose" ? "text-rose-600" : tone === "amber" ? "text-amber-600" : tone === "emerald" ? "text-emerald-600" : "text-slate-900"}`}>{value}</p>
  </div>
);

const qtyCell = (s) => (!s ? "—" : [s.units ? `${s.units}` : "", s.qty ? `${s.qty} qty` : ""].filter(Boolean).join(" + ") || "0");

const StockReports = () => {
  const [tab, setTab] = useState("position");
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState([]);
  const [days, setDays] = useState(60);
  const [bucket, setBucket] = useState("ENDING");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BACKEND_URL}/stock/scoped-branches?module=stock-reports`, { credentials: "include" });
        const j = await r.json();
        if (j.success) setBranches(j.data?.branches || []);
      } catch {
        setBranches([]);
      }
    })();
  }, []);

  const load = useCallback(async () => {
    setData(null);
    setError(null);
    try {
      const q = branchId ? { branchId } : {};
      if (tab === "warranty") Object.assign(q, { days: String(days), bucket });
      setData(await get(tab, q));
    } catch (err) {
      setError(err.message);
    }
  }, [tab, branchId, days, bucket]);

  useEffect(() => { load(); }, [load]);

  const exportCsv = () => {
    if (!data) return;
    if (tab === "position") {
      const used = data.statuses.filter((s) => data.rows.some((r) => r.statuses[s]));
      downloadCsv("stock-position", [["Branch", ...used.map((s) => STATUS_LABEL[s] || s), "Total units", "Total qty"], ...data.rows.map((r) => [r.branchName, ...used.map((s) => qtyCell(r.statuses[s])), r.units, r.qty])]);
    } else if (tab === "value") {
      downloadCsv("stock-value", [["Branch", "Invoice", "Opening Stock", "Vendor Replacement", "Unknown origin", "Total", "Units without cost"], ...data.rows.map((r) => [r.branchName, r.bySource.PURCHASE || 0, r.bySource.OPENING_STOCK || 0, r.bySource.VENDOR_REPLACEMENT || 0, r.bySource.UNKNOWN || 0, r.value, r.unpricedUnits])]);
    } else if (tab === "warranty") {
      downloadCsv(`warranty-${bucket.toLowerCase()}`, [["Unit", "Product", "Branch", "Status", "Vendor", "Warranty end", "Days left", "With"], ...data.items.map((i) => [i.label, i.product, i.branch, i.status, i.vendor, i.endDate ? fmtDate(i.endDate) : "Unknown", i.daysLeft ?? "", i.with])]);
    } else if (tab === "subscribers") {
      downloadCsv("with-subscribers", [["Service type", "Product", "Units", "Quantity", "Subscribers"], ...data.map((r) => [r.serviceType, r.product, r.units, r.qty, r.subscribers])]);
    } else {
      downloadCsv("repairs-ageing", [["Unit", "Product", "Branch", "Status", "Days waiting", "Where", "Fault"], ...data.items.map((i) => [i.label, i.product, i.branch, i.status, i.days, i.where, i.note])]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Stock Reports</h1>
          <p className="mt-0.5 text-sm text-slate-500">Where everything is, what it is worth, and what needs attention.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-56">
            <SearchableSelect value={branchId} onChange={setBranchId} options={branches.map((b) => ({ value: b._id, label: b.name }))} placeholder="All branches" />
          </div>
          <button type="button" disabled={!data} onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <Download className="h-4 w-4" /> CSV
          </button>
        </div>
      </div>

      <div className="mb-4 inline-flex flex-wrap rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {TABS.map((t) => (
          <button key={t.value} type="button" onClick={() => setTab(t.value)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${tab === t.value ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {!data && !error && <div className="h-40 animate-pulse rounded-2xl bg-white" />}

      {data && tab === "position" && (() => {
        const used = data.statuses.filter((s) => data.rows.some((r) => r.statuses[s]));
        return (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50"><tr><th className={th}>Branch</th>{used.map((s) => <th key={s} className={`${th} text-right`}>{STATUS_LABEL[s] || s}</th>)}<th className={`${th} text-right`}>Total</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {data.rows.map((r) => (
                  <tr key={r.branchId}>
                    <td className={`${td} font-medium text-slate-900`}>{r.branchName}</td>
                    {used.map((s) => <td key={s} className={`${td} text-right tabular-nums`}>{qtyCell(r.statuses[s])}</td>)}
                    <td className={`${td} text-right font-semibold tabular-nums`}>{qtyCell({ units: r.units, qty: r.qty })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-400">Units = individually tracked items; qty = metres / pieces of batch stock.</p>
          </div>
        );
      })()}

      {data && tab === "value" && (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <Card label="Stock we own" value={money(data.total)} />
            <Card label="Branches" value={data.rows.length} />
            <Card label="Units without a cost" value={data.unpricedUnits} tone={data.unpricedUnits ? "amber" : "slate"} />
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50"><tr>
                <th className={th}>Branch</th>
                {["PURCHASE", "OPENING_STOCK", "VENDOR_REPLACEMENT"].map((s) => <th key={s} className={`${th} text-right`}>{SOURCE_LABEL[s]}</th>)}
                <th className={`${th} text-right`}>Total</th><th className={`${th} text-right`}>No cost</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {data.rows.map((r) => (
                  <tr key={r.branchId}>
                    <td className={`${td} font-medium text-slate-900`}>{r.branchName}</td>
                    {["PURCHASE", "OPENING_STOCK", "VENDOR_REPLACEMENT"].map((s) => <td key={s} className={`${td} text-right tabular-nums`}>{money(r.bySource[s] || 0)}</td>)}
                    <td className={`${td} text-right font-semibold tabular-nums`}>{money(r.value)}</td>
                    <td className={`${td} text-right tabular-nums ${r.unpricedUnits ? "text-amber-600" : ""}`}>{r.unpricedUnits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-400">Everything still ours — on the shelf, with subscribers or employees, faulty or at repair. Debited, scrapped and vendor-replaced units are left out. Units without a cost add nothing, so the total is a floor.</p>
          </div>
        </>
      )}

      {data && tab === "warranty" && (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            {[
              { k: "ENDING", label: `Ending in ${data.days} days`, tone: "amber" },
              { k: "EXPIRED", label: "Expired", tone: "rose" },
              { k: "UNKNOWN", label: "Unknown", tone: "slate" },
              { k: "ACTIVE", label: "Active beyond", tone: "emerald" },
            ].map((c) => (
              <button key={c.k} type="button" onClick={() => setBucket(c.k)} className={`text-left ${bucket === c.k ? "ring-2 ring-indigo-400 rounded-2xl" : ""}`}>
                <Card label={c.label} value={data.counts[c.k]} tone={c.tone} />
              </button>
            ))}
          </div>
          <div className="mb-3 flex items-center gap-2 text-sm text-slate-600">
            Window
            {[30, 60, 90].map((d) => (
              <button key={d} type="button" onClick={() => setDays(d)} className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${days === d ? "bg-indigo-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>{d} days</button>
            ))}
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50"><tr><th className={th}>Unit</th><th className={th}>Product</th><th className={th}>Branch</th><th className={th}>Status</th><th className={th}>Vendor</th><th className={th}>Warranty end</th><th className={`${th} text-right`}>Days left</th><th className={th}>With</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.length === 0 ? (
                  <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-400">Nothing in this group</td></tr>
                ) : data.items.map((i) => (
                  <tr key={i._id}>
                    <td className={`${td} font-mono text-slate-900`}>{i.label}</td>
                    <td className={td}>{i.product}</td><td className={td}>{i.branch}</td>
                    <td className={td}>{STATUS_LABEL[i.status] || i.status}</td><td className={td}>{i.vendor || "—"}</td>
                    <td className={td}>{i.endDate ? fmtDate(i.endDate) : "Unknown"}</td>
                    <td className={`${td} text-right tabular-nums ${i.daysLeft !== null && i.daysLeft < 0 ? "text-rose-600" : ""}`}>{i.daysLeft ?? "—"}</td>
                    <td className={td}>{i.with || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {data && tab === "subscribers" && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr><th className={th}>Service type</th><th className={th}>Product</th><th className={`${th} text-right`}>Out with subscribers</th><th className={`${th} text-right`}>Subscribers</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {data.length === 0 ? (
                <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-400">Nothing is out with subscribers</td></tr>
              ) : data.map((r, k) => (
                <tr key={k}>
                  <td className={`${td} font-medium text-slate-900`}>{r.serviceType}</td>
                  <td className={td}>{r.product}</td>
                  <td className={`${td} text-right tabular-nums`}>{r.trackingMethod === "quantity" ? `${r.qty} ${unitLabel(r.unit)}` : `${r.units} units`}</td>
                  <td className={`${td} text-right tabular-nums`}>{r.subscribers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && tab === "repairs" && (
        <>
          <div className="mb-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50"><tr><th className={th}>Waiting</th>{data.buckets.map((b) => <th key={b} className={`${th} text-right`}>{b} days</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {Object.entries(data.grid).map(([s, row]) => (
                  <tr key={s}>
                    <td className={`${td} font-medium text-slate-900`}>{STATUS_LABEL[s]}</td>
                    {data.buckets.map((b) => <td key={b} className={`${td} text-right tabular-nums ${b === "90+" && row[b] ? "text-rose-600 font-semibold" : ""}`}>{row[b]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50"><tr><th className={th}>Unit</th><th className={th}>Product</th><th className={th}>Branch</th><th className={th}>Status</th><th className={`${th} text-right`}>Days</th><th className={th}>Where</th><th className={th}>Fault</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.length === 0 ? (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">No broken units waiting</td></tr>
                ) : data.items.map((i) => (
                  <tr key={i._id}>
                    <td className={`${td} font-mono text-slate-900`}>{i.label}</td><td className={td}>{i.product}</td><td className={td}>{i.branch}</td>
                    <td className={td}>{STATUS_LABEL[i.status]}</td><td className={`${td} text-right tabular-nums`}>{i.days}</td>
                    <td className={td}>{i.where || "—"}</td><td className={td}>{i.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default StockReports;
