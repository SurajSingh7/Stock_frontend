"use client";

import React, { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Wrench, ShieldCheck, CheckCircle2, Trash2, Search, RotateCcw } from "lucide-react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import { usePermissions } from "@/context/PermissionContext";
import Pagination from "@/shared/ui/pagination/Pagination";
import { Modal, SearchableSelect, inputCls, unitLabel } from "@/modules/stock/shared/StockSharedUI";
import { SourceBadge, WarrantyBadge, fmtDate } from "@/modules/stock/inventory/itemBadges";
import { fetchRepairs, fetchRepairCounts, fetchRepairVendors, sendForRepair, repairResult, sendClaim, claimOutcome, markOk, scrapUnit } from "./repairApi";

/*
  Repair & Warranty — our broken units and where each one is in being fixed:
  Faulty → our repair bench / a vendor warranty claim → back on the shelf,
  swapped by the vendor, or scrapped.
*/

const canDo = (permissions, isAdmin, action) => {
  if (isAdmin) return true;
  const mod = (permissions || []).find((m) => m.moduleKey === "repairs");
  return (mod?.actions || []).map((a) => String(a).toUpperCase()).includes(action);
};

const TABS = [
  { value: "FAULTY", label: "Faulty" },
  { value: "IN_REPAIR", label: "In Repair" },
  { value: "AT_VENDOR", label: "At Vendor (claim)" },
  { value: "VENDOR_REPLACED", label: "Vendor Replaced" },
  { value: "SCRAPPED", label: "Scrapped" },
];

const th = "px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 whitespace-nowrap";
const btn = "inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-50";

/* ── A note-and-confirm step (send for repair, mark OK, scrap, results) ── */
const NoteModal = ({ title, hint, required, confirmLabel, tone = "indigo", onClose, onConfirm, children }) => {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal onClose={onClose} title={title} maxWidth="max-w-md">
      {hint && <p className="mb-3 text-sm text-slate-500">{hint}</p>}
      {children}
      <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={required ? "Note (required)" : "Note (optional)"} className={inputCls} />
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
        <button
          type="button"
          disabled={busy || (required && !note.trim())}
          onClick={async () => {
            setBusy(true);
            try { await onConfirm(note.trim()); onClose(); } catch (err) { toast.error(err.message); } finally { setBusy(false); }
          }}
          className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${tone === "rose" ? "bg-rose-600 hover:bg-rose-700" : tone === "emerald" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-indigo-600 hover:bg-indigo-700"}`}
        >
          {busy ? "Saving…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
};

/* ── Warranty claim to the vendor ── */
const ClaimModal = ({ row, vendors, onClose, onDone }) => {
  const [vendorId, setVendorId] = useState(row.vendor?._id ? String(row.vendor._id) : "");
  const [claimRef, setClaimRef] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal onClose={onClose} title={`Warranty claim — ${row.label}`} maxWidth="max-w-md">
      <div className="mb-3"><WarrantyBadge endDate={row.warranty?.endDate} /></div>
      {row.inWarranty === false && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">The warranty has ended — the vendor may charge for this repair.</p>
      )}
      <label className="text-xs font-semibold text-slate-600">Vendor *</label>
      <div className="mb-3 mt-1">
        <SearchableSelect value={vendorId} onChange={setVendorId} options={vendors.map((v) => ({ value: String(v._id), label: v.name }))} placeholder="Select vendor" />
      </div>
      <label className="text-xs font-semibold text-slate-600">Vendor docket / RMA no.</label>
      <input value={claimRef} onChange={(e) => setClaimRef(e.target.value)} placeholder="e.g. RMA-1002" className={`${inputCls} mb-3 mt-1`} />
      <label className="text-xs font-semibold text-slate-600">Note</label>
      <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={`${inputCls} mt-1`} />
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
        <button
          type="button"
          disabled={busy || !vendorId}
          onClick={async () => {
            setBusy(true);
            try { await sendClaim(row._id, { vendorId, claimRef, note }); toast.success("Sent to vendor"); onDone(); onClose(); } catch (err) { toast.error(err.message); } finally { setBusy(false); }
          }}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Saving…" : "Send to vendor"}
        </button>
      </div>
    </Modal>
  );
};

/* ── The vendor sent a different unit ── */
const ReplacedModal = ({ row, onClose, onDone }) => {
  const fields = (row.product?.selectedFields || []).map((sf) => sf.fieldDefId).filter(Boolean);
  const isUnit = row.quantity === null || row.quantity === undefined;
  const [values, setValues] = useState({});
  const [months, setMonths] = useState("");
  const [endDate, setEndDate] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal onClose={onClose} title={`Vendor replaced ${row.label}`} maxWidth="max-w-md">
      <p className="mb-3 text-sm text-slate-500">
        The old unit is closed as <b>Vendor Replaced</b>; the new one is added to {row.branch?.name} as NEW stock, linked to the old one.
      </p>
      {isUnit &&
        fields.map((f) => (
          <div key={f.code} className="mb-2">
            <label className="text-xs font-semibold text-slate-600">
              {f.label} of the new unit {f.isUnique && <span className="ml-1 rounded bg-violet-100 px-1 text-[10px] text-violet-700">unique</span>}
            </label>
            <input value={values[f.code] || ""} onChange={(e) => setValues((v) => ({ ...v, [f.code]: e.target.value }))} className={`${inputCls} mt-1 font-mono`} />
          </div>
        ))}
      <label className="text-xs font-semibold text-slate-600">Warranty from the vendor</label>
      <div className="mb-1 mt-1 flex items-center gap-2">
        <input type="number" min="1" max="120" placeholder="Months" disabled={!!endDate} value={months} onChange={(e) => setMonths(e.target.value)} className={`${inputCls} w-28`} />
        <span className="text-xs text-slate-400">or</span>
        <input type="date" disabled={!!months} value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
      </div>
      <p className="mb-3 text-xs text-slate-400">Leave both empty to keep the old unit&apos;s warranty.</p>
      <label className="text-xs font-semibold text-slate-600">Note</label>
      <input value={note} onChange={(e) => setNote(e.target.value)} className={`${inputCls} mt-1`} />
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await claimOutcome(row._id, {
                outcome: "REPLACED",
                note,
                replacement: { fieldValues: values, ...(months ? { warrantyMonths: Number(months) } : {}), ...(endDate ? { warrantyEndDate: endDate } : {}) },
              });
              toast.success("Replacement added to stock");
              onDone();
              onClose();
            } catch (err) {
              toast.error(err.message);
            } finally {
              setBusy(false);
            }
          }}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Saving…" : "Add replacement"}
        </button>
      </div>
    </Modal>
  );
};

const RepairList = () => {
  const { permissions, isAdmin } = usePermissions();
  const canManage = canDo(permissions, isAdmin, "MANAGE");
  const canScrap = canDo(permissions, isAdmin, "SCRAP");

  const [status, setStatus] = useState("FAULTY");
  const [branchId, setBranchId] = useState("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [branches, setBranches] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [action, setAction] = useState(null); // { kind, row }

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BACKEND_URL}/stock/scoped-branches?module=repairs`, { credentials: "include" });
        const j = await r.json();
        if (j.success) setBranches(j.data?.branches || []);
      } catch {
        setBranches([]);
      }
      fetchRepairVendors().then(setVendors).catch(() => setVendors([]));
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const base = branchId ? { branchId } : {};
      const [list, c] = await Promise.all([
        fetchRepairs({ ...base, status, page: String(page), limit: String(limit), ...(debounced ? { search: debounced } : {}) }),
        fetchRepairCounts(base),
      ]);
      setRows(list.rows);
      setTotal(list.total);
      setCounts(c);
    } catch (err) {
      setError(err.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [status, branchId, debounced, page, limit]);

  useEffect(() => { load(); }, [load]);

  const done = (msg) => () => { toast.success(msg); load(); };
  const close = () => setAction(null);

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Repair &amp; Warranty</h1>
        <p className="mt-0.5 text-sm text-slate-500">Our broken units — repair them, claim them under warranty, or write them off.</p>
      </div>

      {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => { setStatus(t.value); setPage(1); }}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${status === t.value ? "bg-indigo-600 text-white shadow-sm" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}
            >
              {t.label}
              <span className={`rounded-full px-1.5 text-xs ${status === t.value ? "bg-white/20" : "bg-white text-slate-500"}`}>{counts[t.value] || 0}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-64">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search serial / MAC…" className={`${inputCls} pl-9`} />
          </div>
          <div className="w-56">
            <SearchableSelect value={branchId} onChange={(v) => { setBranchId(v); setPage(1); }} options={branches.map((b) => ({ value: b._id, label: b.name }))} placeholder="All branches" />
          </div>
          {(branchId || search) && (
            <button type="button" onClick={() => { setBranchId(""); setSearch(""); setPage(1); }} className="inline-flex items-center gap-1 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-100">
              <RotateCcw className="h-4 w-4" /> Reset
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[1000px] border-collapse text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className={th}>Unit</th>
              <th className={th}>Product</th>
              <th className={th}>Branch</th>
              <th className={th}>Fault</th>
              <th className={th}>Warranty</th>
              <th className={th}>{status === "AT_VENDOR" ? "Claim" : status === "SCRAPPED" ? "Reason" : "Repair"}</th>
              <th className={th}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-6"><div className="h-5 animate-pulse rounded bg-slate-100" /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">Nothing here</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r._id}>
                  <td className="px-4 py-3">
                    <p className="font-mono font-medium text-slate-900">{r.label}</p>
                    {r.quantity !== null && r.quantity !== undefined && <p className="text-xs text-slate-500">{r.quantity} {unitLabel(r.product?.unit)}</p>}
                    <SourceBadge source={r.source} />
                  </td>
                  <td className="px-4 py-3 text-slate-800">{r.product?.name}</td>
                  <td className="px-4 py-3 text-slate-700">{r.branch?.name || "—"}</td>
                  <td className="max-w-64 px-4 py-3">
                    <p className="text-slate-800">{r.fault?.note || "—"}</p>
                    <p className="text-xs text-slate-400">{[r.fault?.via, fmtDate(r.fault?.reportedAt)].filter((x) => x && x !== "—").join(" · ")}</p>
                  </td>
                  <td className="px-4 py-3"><WarrantyBadge endDate={r.warranty?.endDate} /></td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {status === "SCRAPPED"
                      ? r.scrapNote
                      : r.repair
                        ? <>
                            <p className="font-semibold text-slate-800">{r.repair.kind === "VENDOR" ? r.repair.vendorName : "Our bench"}</p>
                            <p>{[r.repair.claimRef, fmtDate(r.repair.sentAt), r.repair.inWarranty === false ? "out of warranty" : ""].filter(Boolean).join(" · ")}</p>
                            {r.repair.note && <p className="text-slate-400">{r.repair.note}</p>}
                          </>
                        : status === "VENDOR_REPLACED" ? "Replaced — see the new unit in Item Inventory" : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {status === "FAULTY" && canManage && (
                        <>
                          <button type="button" onClick={() => setAction({ kind: "repair", row: r })} className={`${btn} bg-indigo-600 text-white hover:bg-indigo-700`}><Wrench className="h-3.5 w-3.5" /> Repair</button>
                          <button type="button" onClick={() => setAction({ kind: "claim", row: r })} className={`${btn} bg-sky-600 text-white hover:bg-sky-700`}><ShieldCheck className="h-3.5 w-3.5" /> Warranty claim</button>
                          <button type="button" onClick={() => setAction({ kind: "ok", row: r })} className={`${btn} border border-emerald-200 text-emerald-700 hover:bg-emerald-50`}><CheckCircle2 className="h-3.5 w-3.5" /> Working</button>
                        </>
                      )}
                      {status === "FAULTY" && canScrap && (
                        <button type="button" onClick={() => setAction({ kind: "scrap", row: r })} className={`${btn} border border-rose-200 text-rose-600 hover:bg-rose-50`}><Trash2 className="h-3.5 w-3.5" /> Scrap</button>
                      )}
                      {status === "IN_REPAIR" && canManage && (
                        <>
                          <button type="button" onClick={() => setAction({ kind: "repaired", row: r })} className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}>Repaired</button>
                          <button type="button" onClick={() => setAction({ kind: "failed", row: r })} className={`${btn} border border-rose-200 text-rose-600 hover:bg-rose-50`}>Can&apos;t repair</button>
                        </>
                      )}
                      {status === "AT_VENDOR" && canManage && (
                        <>
                          <button type="button" onClick={() => setAction({ kind: "vendorRepaired", row: r })} className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}>Repaired</button>
                          <button type="button" onClick={() => setAction({ kind: "replaced", row: r })} className={`${btn} bg-indigo-600 text-white hover:bg-indigo-700`}>Replaced</button>
                          <button type="button" onClick={() => setAction({ kind: "rejected", row: r })} className={`${btn} border border-rose-200 text-rose-600 hover:bg-rose-50`}>Claim refused</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-5">
        <Pagination currentPage={page} totalItems={total} itemsPerPage={limit} onPageChange={setPage} onItemsPerPageChange={(n) => { setLimit(n); setPage(1); }} />
      </div>

      {action?.kind === "repair" && (
        <NoteModal title={`Send ${action.row.label} for repair`} hint="To our own repair bench." confirmLabel="Send for repair" onClose={close}
          onConfirm={async (note) => { await sendForRepair(action.row._id, { note }); done("Sent for repair")(); }} />
      )}
      {action?.kind === "claim" && <ClaimModal row={action.row} vendors={vendors} onClose={close} onDone={load} />}
      {action?.kind === "ok" && (
        <NoteModal title={`${action.row.label} is working?`} hint="It goes back on the shelf as available." confirmLabel="Mark working" tone="emerald" onClose={close}
          onConfirm={async (note) => { await markOk(action.row._id, { note }); done("Back in stock")(); }} />
      )}
      {action?.kind === "scrap" && (
        <NoteModal title={`Scrap ${action.row.label}?`} hint="It is written off — this cannot be undone." required confirmLabel="Scrap" tone="rose" onClose={close}
          onConfirm={async (note) => { await scrapUnit(action.row._id, { note }); done("Scrapped")(); }} />
      )}
      {action?.kind === "repaired" && (
        <NoteModal title={`${action.row.label} repaired`} hint="It goes back on the shelf as available." confirmLabel="Back in stock" tone="emerald" onClose={close}
          onConfirm={async (note) => { await repairResult(action.row._id, { result: "REPAIRED", note }); done("Back in stock")(); }} />
      )}
      {action?.kind === "failed" && (
        <NoteModal title={`${action.row.label} could not be repaired`} hint="It goes back to Faulty — claim it or scrap it next." required confirmLabel="Save" tone="rose" onClose={close}
          onConfirm={async (note) => { await repairResult(action.row._id, { result: "FAILED", note }); done("Back to faulty")(); }} />
      )}
      {action?.kind === "vendorRepaired" && (
        <NoteModal title={`${action.row.label} came back repaired`} hint="The same unit, working — back on the shelf." confirmLabel="Back in stock" tone="emerald" onClose={close}
          onConfirm={async (note) => { await claimOutcome(action.row._id, { outcome: "REPAIRED", note }); done("Back in stock")(); }} />
      )}
      {action?.kind === "replaced" && <ReplacedModal row={action.row} onClose={close} onDone={load} />}
      {action?.kind === "rejected" && (
        <NoteModal title={`Vendor refused the claim on ${action.row.label}`} hint="It comes back to Faulty." required confirmLabel="Save" tone="rose" onClose={close}
          onConfirm={async (note) => { await claimOutcome(action.row._id, { outcome: "REJECTED", note }); done("Back to faulty")(); }} />
      )}
    </div>
  );
};

export default RepairList;
