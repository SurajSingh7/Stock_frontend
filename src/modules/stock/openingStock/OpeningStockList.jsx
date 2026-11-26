"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, PackageOpen, Users, RotateCcw, Search, Eye, Pencil, ChevronRight } from "lucide-react";
import Pagination from "@/shared/ui/pagination/Pagination";
import { usePermissions } from "@/context/PermissionContext";
import { Modal, SearchableSelect, inputCls, unitLabel } from "@/modules/stock/shared/StockSharedUI";
import { PersonCell } from "@/modules/stock/inventoryTransfer/shared";
import DateRangeButton from "@/modules/stock/shared/DateRangeButton";
import { entryApi } from "./openingStockApi";
import { kindConfig } from "./openingKinds";
import { fmtDate } from "@/modules/stock/inventory/itemBadges";
import { KindBadge, personSummary } from "@/modules/stock/people/PersonSearch";

export const canDo = (permissions, isAdmin, action, moduleKey = "opening-stock") => {
  if (isAdmin) return true;
  const mod = (permissions || []).find((m) => m.moduleKey === moduleKey);
  return (mod?.actions || []).map((a) => String(a).toUpperCase()).includes(action);
};

export const StatusBadge = ({ status }) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
      status === "POSTED" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-700 ring-amber-200"
    }`}
  >
    <span className={`h-1.5 w-1.5 rounded-full ${status === "POSTED" ? "bg-emerald-500" : "bg-amber-500"}`} />
    {status === "POSTED" ? "Posted" : "Draft"}
  </span>
);

// Status tabs in their status colour, with counts — the same look as the
// other list pages (Purchase Order Approval, Stock Transfer).
const STATUS_TABS = [
  { key: "", label: "All", active: "border-indigo-600 bg-indigo-600 text-white", inactive: "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100", chipActive: "bg-indigo-500 text-indigo-50", chipInactive: "bg-indigo-100 text-indigo-700" },
  { key: "DRAFT", label: "Draft", active: "border-amber-600 bg-amber-600 text-white", inactive: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100", chipActive: "bg-amber-500 text-amber-50", chipInactive: "bg-amber-100 text-amber-700" },
  { key: "POSTED", label: "Posted", active: "border-emerald-600 bg-emerald-600 text-white", inactive: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100", chipActive: "bg-emerald-500 text-emerald-50", chipInactive: "bg-emerald-100 text-emerald-700" },
];

const th = "px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600";

const qtyText = (n, unit) => {
  const v = Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });
  return unit === "meter" ? `${v} m` : `${v} ${unitLabel(unit) || "pcs"}`;
};

// "1 product name" or "3 products ▸" — the popup lists each with its quantity.
const ProductsCell = ({ entry }) => {
  const [open, setOpen] = useState(false);
  const products = entry.products || [];
  if (products.length === 0) return <span className="text-slate-300">—</span>;
  if (products.length === 1) return <span className="text-slate-800">{products[0].name}</span>;
  return (
    <>
      <button
        type="button" onClick={() => setOpen(true)}
        className="inline-flex items-center gap-0.5 font-semibold text-indigo-600 hover:underline"
      >
        {products.length} products <ChevronRight className="h-3.5 w-3.5" />
      </button>
      {open && (
        <Modal title={`${entry.entryNumber} — ${products.length} products`} onClose={() => setOpen(false)} maxWidth="max-w-md">
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {products.map((p) => (
                <li key={p.productDefinitionId} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="text-slate-800">{p.name}</span>
                  <span className="font-semibold tabular-nums text-slate-900">{qtyText(p.quantity, p.unit)}</span>
                </li>
              ))}
            </ul>
        </Modal>
      )}
    </>
  );
};

// "12 pcs · 50 m" — pieces and metres are never added together.
const quantityText = (entry) => (entry.quantity || []).map((q) => qtyText(q.quantity, q.unit)).join(" · ") || "—";

// "All working", or "10 ok · 2 faulty · 1 dead".
const ConditionCell = ({ c = {} }) => {
  if (!c.faulty && !c.beyondRepair) return <span className="font-medium text-emerald-700">All working</span>;
  return (
    <span className="text-slate-700">
      {[c.working && `${c.working} ok`, c.faulty && <span key="f" className="font-semibold text-amber-700">{c.faulty} faulty</span>, c.beyondRepair && <span key="d" className="font-semibold text-rose-600">{c.beyondRepair} dead</span>]
        .filter(Boolean)
        .reduce((acc, x, i) => (i ? [...acc, " · ", x] : [x]), [])}
    </span>
  );
};

/*
  Opening Stock — In Store (kind STORE) and With People (kind ISSUED) share
  this list: one filter row (search, branch, entry date, Reset), the status
  tabs under it, and the entries. In Action, 👁 opens an entry to read and
  ✏ (drafts only) opens it to change.
*/
const OpeningStockList = ({ kind = "STORE" }) => {
  const router = useRouter();
  const cfg = kindConfig(kind);
  const api = useMemo(() => entryApi(cfg.kind), [cfg.kind]);
  const issued = cfg.kind === "ISSUED";
  const { permissions, isAdmin } = usePermissions();
  const canCreate = canDo(permissions, isAdmin, "CREATE", cfg.moduleKey);
  const canUpdate = canDo(permissions, isAdmin, "UPDATE", cfg.moduleKey);

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [status, setStatus] = useState("");
  const [branchId, setBranchId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [branches, setBranches] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    api.fetchFormOptions().then((o) => setBranches(o.branches || [])).catch(() => setBranches([]));
  }, [api]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = { page: String(page), limit: String(limit) };
      if (status) query.status = status;
      if (branchId) query.branchId = branchId;
      if (debounced) query.search = debounced;
      if (from) query.from = from;
      if (to) query.to = to;
      const res = await api.fetchEntries(query);
      setRows(res.rows);
      setTotal(res.total);
      setCounts(res.counts);
    } catch (err) {
      setError(err.message);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [api, page, limit, status, branchId, debounced, from, to]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [status, branchId, debounced, from, to]);

  const filtered = !!branchId || !!search || !!from || !!to;
  const reset = () => { setBranchId(""); setSearch(""); setFrom(""); setTo(""); };
  const open = (r) => router.push(`${cfg.path}/${r._id}`);
  const cols = 10;

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      {/* Title row — compact, like the other list pages. */}
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-900">
          {issued ? <Users className="h-5 w-5 text-indigo-600" /> : <PackageOpen className="h-5 w-5 text-indigo-600" />} {cfg.title}
        </h1>
        {canCreate && (
          <button
            type="button" onClick={() => router.push(`${cfg.path}/new`)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
          >
            <Plus className="h-4 w-4" /> New Entry
          </button>
        )}
      </div>

      {error && <div className="mb-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      {/* One row of filters, then the status tabs. */}
      <div className="mb-2.5 flex flex-wrap items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={cfg.searchPlaceholder} className={`${inputCls} pl-9`} />
        </div>
        <div className="w-full sm:w-52">
          <SearchableSelect value={branchId} onChange={setBranchId} options={branches.map((b) => ({ value: b._id, label: b.name }))} placeholder="All branches" />
        </div>
        <DateRangeButton from={from} to={to} onFrom={setFrom} onTo={setTo} hint={issued ? "Entry date between these dates" : "Stock as of between these dates"} />
        {filtered && (
          <button
            type="button" onClick={reset}
            className="inline-flex h-9.5 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-rose-600 shadow-sm transition hover:border-rose-300 hover:bg-rose-100"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
        )}
      </div>
      <div className="mb-5 flex flex-wrap gap-2">
        {STATUS_TABS.map((t) => {
          const active = status === t.key;
          return (
            <button
              key={t.key || "all"} type="button" onClick={() => setStatus(t.key)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 ${active ? t.active : t.inactive}`}
            >
              {t.label}
              <span className={`rounded-full px-1.5 text-xs tabular-nums ${active ? t.chipActive : t.chipInactive}`}>{counts[t.key || "ALL"] ?? 0}</span>
            </button>
          );
        })}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-275 border-collapse text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className={th}>Entry No.</th>
              {issued && <th className={th}>With</th>}
              <th className={th}>Branch</th>
              {issued ? <th className={th}>Issued Since</th> : <th className={th}>Stock As Of</th>}
              <th className={th}>Products</th>
              <th className={th}>Quantity</th>
              {!issued && <th className={th}>Condition</th>}
              <th className={th}>Status</th>
              <th className={th}>Created By</th>
              <th className={th}>Posted By</th>
              <th className={`${th} text-right`}>Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={cols} className="px-4 py-3"><div className="h-5 animate-pulse rounded bg-slate-100" /></td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={cols} className="px-4 py-14 text-center">
                  <PackageOpen className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-3 text-sm font-medium text-slate-700">{filtered || status ? "No entry matches the filters" : cfg.empty}</p>
                  {!filtered && !status && canCreate && <p className="mt-1 text-sm text-slate-400">Start one with “New Entry”.</p>}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r._id} className="transition hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-mono font-semibold text-indigo-700">{r.entryNumber}</td>
                  {issued && (
                    <td className="px-4 py-3">
                      {r.issuedTo ? (
                        <>
                          <span className="flex items-center gap-1.5">
                            <span className="font-medium text-slate-900">{r.issuedTo.name || r.issuedTo.username}</span>
                            <KindBadge kind={r.issuedTo.kind} />
                          </span>
                          <span className="text-xs text-slate-500">{personSummary(r.issuedTo)}</span>
                        </>
                      ) : "—"}
                    </td>
                  )}
                  <td className="px-4 py-3 text-slate-700">{r.branchId?.name || "—"}</td>
                  {issued
                    ? <td className="px-4 py-3 text-slate-600">{r.issuedSince ? fmtDate(r.issuedSince) : "—"}</td>
                    : <td className="px-4 py-3 text-slate-600">{fmtDate(r.entryDate)}</td>}
                  <td className="max-w-56 px-4 py-3"><ProductsCell entry={r} /></td>
                  <td className="px-4 py-3 font-semibold tabular-nums text-slate-800">{quantityText(r)}</td>
                  {!issued && <td className="px-4 py-3"><ConditionCell c={r.condition} /></td>}
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3"><PersonCell actor={r.createdBy} at={r.createdAt} /></td>
                  <td className="px-4 py-3"><PersonCell actor={r.postedBy} at={r.postedAt} /></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      {r.status === "DRAFT" && canUpdate && (
                        <button
                          type="button" title="Edit" aria-label="Edit"
                          onClick={() => router.push(`${cfg.path}/${r._id}/edit`)}
                          className="inline-flex items-center rounded-lg border border-indigo-200 bg-white px-1.5 py-1.5 text-indigo-700 shadow-sm transition hover:bg-indigo-50"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button" title="View" aria-label="View"
                        onClick={() => open(r)}
                        className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-1.5 py-1.5 text-slate-600 shadow-sm transition hover:bg-slate-50"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > 10 && (
        <div className="mt-5">
          <Pagination currentPage={page} totalItems={total} itemsPerPage={limit} onPageChange={setPage} onItemsPerPageChange={(n) => { setLimit(n); setPage(1); }} />
        </div>
      )}
    </div>
  );
};

export default OpeningStockList;
