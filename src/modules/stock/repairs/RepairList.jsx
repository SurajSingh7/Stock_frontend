"use client";

import React, { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useSearchParams } from "next/navigation";
import {
  Wrench, CheckCircle2, MoreVertical, ShieldCheck, IndianRupee, Home, RefreshCw, Plus, RotateCcw as Undo,
  CircleCheck, Repeat, CircleX, ExternalLink,
} from "lucide-react";
import { fetchScopedBranches } from "@/modules/stock/shared/lookupsApi";
import { usePermissions } from "@/context/PermissionContext";
import Pagination from "@/shared/ui/pagination/Pagination";
import { Modal, SearchableSelect, inputCls, unitLabel } from "@/modules/stock/shared/StockSharedUI";
import { SourceBadge, WarrantyBadge, fmtDate } from "@/modules/stock/inventory/itemBadges";
import { SearchBox, ResetButton } from "@/modules/stock/inventoryTransfer/shared";
import { fetchRepairs, fetchRepairCounts, fetchRepairVendors, sendForRepair, repairResult, oldUnitReturned, markOk } from "./repairApi";

/*
  Repair & Warranty — our broken units and where each one is in being fixed:

    Faulty ── Send for Repair (Warranty / Paid / In-house) ──► In Repair
    In Repair ── Repaired → back in stock (Refurbished)
              ── Replaced → the vendor sent another unit (the old one kept
                            by the vendor → Replaced, or given back too)
              ── Not Repaired → Faulty again
    Replaced ── Old Unit Returned → back in stock / Faulty
  Writing a unit off as dead is Dead Items (with approval), not here.
*/

const canDo = (permissions, isAdmin, action) => {
  if (isAdmin) return true;
  const mod = (permissions || []).find((m) => m.moduleKey === "repairs");
  return (mod?.actions || []).map((a) => String(a).toUpperCase()).includes(action);
};

const TABS = [
  { value: "FAULTY", label: "Faulty", active: "border-amber-500 bg-amber-500 text-white", idle: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" },
  { value: "IN_REPAIR", label: "In Repair", active: "border-indigo-600 bg-indigo-600 text-white", idle: "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100" },
  { value: "REPLACED", label: "Replaced", active: "border-violet-600 bg-violet-600 text-white", idle: "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100" },
  { value: "SCRAPPED", label: "Dead / Scrapped", active: "border-slate-600 bg-slate-600 text-white", idle: "border-slate-200 bg-white text-slate-600 hover:bg-slate-50" },
];

export const REPAIR_TYPE = {
  WARRANTY: { label: "Warranty", long: "Warranty Repair", icon: ShieldCheck, hint: "Same vendor, free", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  PAID: { label: "Paid", long: "Paid Repair", icon: IndianRupee, hint: "Any vendor, costs money", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  IN_HOUSE: { label: "In-house", long: "In-house Repair", icon: Home, hint: "Our own technician", cls: "bg-sky-50 text-sky-700 ring-sky-200" },
};

const th = "px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 whitespace-nowrap";
const btn = "inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-50";
const label = "mb-1.5 block text-xs font-semibold text-slate-700";
const Req = () => <span className="text-rose-500">*</span>;
const rupees = (n) => (n === null || n === undefined || n === "" ? "" : `₹${Number(n).toLocaleString("en-IN")}`);

/* ── shared bits ───────────────────────────────────────────────── */

// Big option cards — where it is repaired, what came back, how the old unit is.
const ChoiceCards = ({ options, value, onChange }) => (
  <div className={`grid gap-2 ${options.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
    {options.map((o) => {
      const on = value === o.value;
      return (
        <button
          key={o.value} type="button" disabled={o.disabled} onClick={() => onChange(o.value)}
          className={`rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
            on ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200" : "border-slate-200 bg-white hover:border-indigo-300"
          }`}
        >
          <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">{o.icon && <o.icon className="h-4 w-4 text-indigo-600" />} {o.label}</p>
          <p className="mt-0.5 text-xs text-slate-500">{o.hint}</p>
          {o.extra && <p className={`mt-1 text-[11px] font-semibold ${o.disabled ? "text-rose-600" : "text-emerald-700"}`}>{o.extra}</p>}
        </button>
      );
    })}
  </div>
);

const Footer = ({ onClose, busy, disabled, onSave, saveLabel, tone = "indigo" }) => (
  <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
    <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
    <button
      type="button" disabled={busy || disabled} onClick={onSave}
      className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50 ${tone === "rose" ? "bg-rose-600 hover:bg-rose-700" : tone === "emerald" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-indigo-600 hover:bg-indigo-700"}`}
    >
      {busy ? "Saving…" : saveLabel}
    </button>
  </div>
);

// Runs a save, toasts, refreshes the list and closes — or toasts the error.
const useSave = (onDone, onClose) => {
  const [busy, setBusy] = useState(false);
  const run = async (fn, msg) => {
    setBusy(true);
    try { await fn(); toast.success(msg); onDone(); onClose(); } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  return [busy, run];
};

/* ── a note-and-confirm step (Working Fine) ────────────────────── */
const NoteModal = ({ title, hint, required, confirmLabel, tone = "indigo", onClose, onConfirm }) => {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal onClose={onClose} title={title} maxWidth="max-w-md">
      {hint && <p className="mb-3 text-sm text-slate-500">{hint}</p>}
      <label className={label}>Note {required && <Req />}</label>
      <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} />
      <Footer
        onClose={onClose} busy={busy} disabled={required && !note.trim()} saveLabel={confirmLabel} tone={tone}
        onSave={async () => { setBusy(true); try { await onConfirm(note.trim()); onClose(); } catch (err) { toast.error(err.message); } finally { setBusy(false); } }}
      />
    </Modal>
  );
};

/* ── vendor picker with "+ New Vendor" (opens the Vendor form in a new tab) ── */
const VendorPicker = ({ value, onChange, vendors, onReload }) => (
  <div className="flex items-center gap-2">
    <div className="min-w-0 flex-1">
      <SearchableSelect value={value} onChange={onChange} options={vendors.map((v) => ({ value: String(v._id), label: v.name }))} placeholder="Select vendor" />
    </div>
    <button type="button" onClick={onReload} title="Reload the vendor list" className="flex h-9.5 w-9.5 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50">
      <RefreshCw className="h-4 w-4" />
    </button>
    <a
      href="/stock/vendors/create" target="_blank" rel="noreferrer" title="Add a vendor in a new tab, then reload the list"
      className="inline-flex h-9.5 items-center gap-1 whitespace-nowrap rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
    >
      <Plus className="h-3.5 w-3.5" /> New Vendor <ExternalLink className="h-3 w-3" />
    </a>
  </div>
);

/* ── Popup 1: Send for Repair ──────────────────────────────────── */
const SendRepairModal = ({ row, vendors, onReloadVendors, onClose, onDone }) => {
  const warrantyEnded = row.inWarranty === false;
  const ownVendor = row.vendor?._id ? String(row.vendor._id) : "";
  const [type, setType] = useState(warrantyEnded ? "PAID" : "WARRANTY");
  const [vendorId, setVendorId] = useState("");
  const [claimRef, setClaimRef] = useState("");
  const [cost, setCost] = useState("");
  const [note, setNote] = useState("");
  const [busy, run] = useSave(onDone, onClose);

  const options = Object.entries(REPAIR_TYPE).map(([value, t]) => ({
    value, label: t.long, icon: t.icon, hint: t.hint,
    disabled: value === "WARRANTY" && warrantyEnded,
    extra: value === "WARRANTY"
      ? warrantyEnded ? `Warranty ended ${fmtDate(row.warranty?.endDate)}` : row.warranty?.endDate ? `Till ${fmtDate(row.warranty.endDate)}` : "Warranty date not known"
      : "",
  }));
  const needVendor = type === "PAID" || (type === "WARRANTY" && !ownVendor);
  const save = () =>
    run(() => sendForRepair(row._id, {
      type, note, claimRef,
      ...(needVendor ? { vendorId } : {}),
      ...(type === "PAID" ? { estimatedCost: cost } : {}),
    }), "Sent for repair");

  return (
    <Modal onClose={onClose} title={`Send for Repair — ${row.label} · ${row.product?.name || ""}`} maxWidth="max-w-2xl">
      <p className={label}>Where is it repaired? <Req /></p>
      <ChoiceCards options={options} value={type} onChange={setType} />

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {type === "WARRANTY" && (
          <>
            <div className="sm:col-span-2">
              <label className={label}>Vendor {!ownVendor && <Req />}</label>
              {ownVendor
                ? <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800">{row.vendor.name} <span className="text-xs font-normal text-slate-500">— bought from here</span></p>
                : <VendorPicker value={vendorId} onChange={setVendorId} vendors={vendors} onReload={onReloadVendors} />}
            </div>
            <div className="sm:col-span-2">
              <label className={label}>Claim / RMA no.</label>
              <input value={claimRef} onChange={(e) => setClaimRef(e.target.value)} placeholder="e.g. RMA-1002" className={inputCls} />
            </div>
          </>
        )}
        {type === "PAID" && (
          <>
            <div className="sm:col-span-2">
              <label className={label}>Vendor <Req /></label>
              <VendorPicker value={vendorId} onChange={setVendorId} vendors={vendors} onReload={onReloadVendors} />
            </div>
            <div>
              <label className={label}>Estimated cost (₹)</label>
              <input type="number" min="0" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="Leave blank if not known" className={inputCls} />
            </div>
            <div>
              <label className={label}>Docket / job no.</label>
              <input value={claimRef} onChange={(e) => setClaimRef(e.target.value)} className={inputCls} />
            </div>
          </>
        )}
        <div className="sm:col-span-2">
          <label className={label}>Note</label>
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What needs doing…" className={inputCls} />
        </div>
      </div>
      <Footer onClose={onClose} busy={busy} disabled={needVendor && !vendorId} onSave={save} saveLabel="Send for Repair" />
    </Modal>
  );
};

/* ── the old unit's state, when the vendor hands it back ───────── */
const OLD_STATE = [
  { value: "WORKING", label: "Working", icon: CircleCheck, hint: "Back in stock, Refurbished" },
  { value: "FAULTY", label: "Faulty", icon: Wrench, hint: "Back to Faulty" },
];

/* ── Popup 2: Repair Result ────────────────────────────────────── */
const RepairResultModal = ({ row, onClose, onDone }) => {
  const repair = row.repair || {};
  const paid = repair.type === "PAID";
  const inHouse = repair.type === "IN_HOUSE";
  const fields = (row.product?.selectedFields || []).map((sf) => sf.fieldDefId).filter(Boolean);
  const isUnit = row.quantity === null || row.quantity === undefined;

  const [result, setResult] = useState("REPAIRED");
  const [cost, setCost] = useState(repair.estimatedCost ?? "");
  const [note, setNote] = useState("");
  const [values, setValues] = useState({});
  const [months, setMonths] = useState("");
  const [endDate, setEndDate] = useState("");
  const [oldReturned, setOldReturned] = useState(""); // "" | "NO" | "YES"
  const [oldState, setOldState] = useState("");
  const [oldNote, setOldNote] = useState("");
  const [busy, run] = useSave(onDone, onClose);

  const options = [
    { value: "REPAIRED", label: "Repaired", icon: CircleCheck, hint: "The same unit came back fixed" },
    { value: "REPLACED", label: "Replaced", icon: Repeat, hint: inHouse ? "Only a vendor can replace" : "The vendor sent another unit", disabled: inHouse },
    { value: "NOT_REPAIRED", label: "Not Repaired", icon: CircleX, hint: "It could not be fixed" },
  ];

  const missingField = result === "REPLACED" && isUnit && fields.some((f) => f.isUnique && !String(values[f.code] || "").trim());
  const oldIncomplete = result === "REPLACED" && (!oldReturned || (oldReturned === "YES" && (!oldState || (oldState !== "WORKING" && !oldNote.trim()))));
  const disabled = (result === "NOT_REPAIRED" && !note.trim()) || missingField || oldIncomplete;

  const save = () =>
    run(() => repairResult(row._id, {
      result, note,
      ...(paid ? { cost } : {}),
      ...(result === "REPLACED"
        ? {
            replacement: {
              fieldValues: values,
              ...(months ? { warrantyMonths: Number(months) } : {}),
              ...(endDate ? { warrantyEndDate: endDate } : {}),
              oldUnit: oldReturned === "YES" ? { returned: true, workingState: oldState, note: oldNote } : { returned: false },
            },
          }
        : {}),
    }), result === "REPAIRED" ? "Back in stock" : result === "REPLACED" ? "Replacement added to stock" : "Back to Faulty");

  return (
    <Modal onClose={onClose} title={`Repair Result — ${row.label} · ${REPAIR_TYPE[repair.type]?.long || "Repair"}${repair.vendorName ? ` · ${repair.vendorName}` : ""}`} maxWidth="max-w-2xl">
      <p className={label}>What happened? <Req /></p>
      <ChoiceCards options={options} value={result} onChange={setResult} />

      <div className="mt-4 space-y-4">
        {paid && result !== "NOT_REPAIRED" && (
          <div className="sm:w-1/2">
            <label className={label}>Final cost (₹)</label>
            <input type="number" min="0" value={cost} onChange={(e) => setCost(e.target.value)} className={inputCls} />
          </div>
        )}
        {result === "REPAIRED" && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Goes back in stock as <b>Available</b>, condition <b>Refurbished</b>.</p>}

        {result === "REPLACED" && (
          <div className="space-y-4 rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">New unit</p>
            {isUnit && (
              <div className="grid gap-3 sm:grid-cols-2">
                {fields.map((f) => (
                  <div key={f.code}>
                    <label className={label}>{f.label} {f.isUnique && <Req />}</label>
                    <input value={values[f.code] || ""} onChange={(e) => setValues((v) => ({ ...v, [f.code]: e.target.value }))} className={`${inputCls} font-mono`} />
                  </div>
                ))}
              </div>
            )}
            <div>
              <label className={label}>Warranty — months or end date</label>
              <div className="flex items-center gap-2">
                <input type="number" min="1" max="120" placeholder="Months" disabled={!!endDate} value={months} onChange={(e) => setMonths(e.target.value)} className={`${inputCls} w-28`} />
                <span className="text-xs text-slate-400">or</span>
                <input type="date" disabled={!!months} value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
              </div>
              <p className="mt-1 text-xs text-slate-400">Leave both blank to keep the old unit&apos;s warranty.</p>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <p className={label}>Did the vendor give the old unit ({row.label}) back? <Req /></p>
              <ChoiceCards
                value={oldReturned} onChange={setOldReturned}
                options={[
                  { value: "NO", label: "No, the vendor kept it", hint: "The new unit takes its place — counted once" },
                  { value: "YES", label: "Yes, we got it back", hint: "Both units are ours — the new one counts as free" },
                ]}
              />
              {oldReturned === "YES" && (
                <div className="mt-3 space-y-3">
                  <p className={label}>How is the old unit? <Req /></p>
                  <ChoiceCards options={OLD_STATE} value={oldState} onChange={setOldState} />
                  {oldState && oldState !== "WORKING" && (
                    <div>
                      <label className={label}>What is wrong with it? <Req /></label>
                      <input value={oldNote} onChange={(e) => setOldNote(e.target.value)} className={inputCls} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <div>
          <label className={label}>{result === "NOT_REPAIRED" ? <>What happened? <Req /></> : "Note"}</label>
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={result === "NOT_REPAIRED" ? "e.g. The vendor says the part is not available" : ""} className={inputCls} />
          {result === "NOT_REPAIRED" && <p className="mt-1 text-xs text-slate-500">It goes back to Faulty — send it to another vendor, or scrap it.</p>}
        </div>
      </div>
      <Footer onClose={onClose} busy={busy} disabled={disabled} onSave={save} saveLabel="Save" tone={result === "NOT_REPAIRED" ? "rose" : "indigo"} />
    </Modal>
  );
};

/* ── Popup 3: Old Unit Returned ────────────────────────────────── */
const OldUnitModal = ({ row, onClose, onDone }) => {
  const [state, setState] = useState("");
  const [note, setNote] = useState("");
  const [busy, run] = useSave(onDone, onClose);
  return (
    <Modal onClose={onClose} title={`Old Unit Returned — ${row.label}`} maxWidth="max-w-xl">
      <p className="mb-4 text-sm text-slate-600">
        The vendor sent <b className="font-mono">{row.replacedBy?.label || "a new unit"}</b> in its place. Now the old one has come back too.
      </p>
      <p className={label}>How is it? <Req /></p>
      <ChoiceCards options={OLD_STATE} value={state} onChange={setState} />
      <div className="mt-4">
        <label className={label}>Note {state && state !== "WORKING" && <Req />}</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} />
      </div>
      <p className="mt-3 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-800">Both units are ours now — stock goes up by one.</p>
      <Footer
        onClose={onClose} busy={busy} disabled={!state || (state !== "WORKING" && !note.trim())} saveLabel="Save"
        onSave={() => run(() => oldUnitReturned(row._id, { workingState: state, note }), "Old unit taken back")}
      />
    </Modal>
  );
};

/* ── ⋮ menu ────────────────────────────────────────────────────── */
const RowMenu = ({ items }) => {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-label="More" className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50">
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-1 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
            {items.map((it) => (
              <button
                key={it.label} type="button" onClick={() => { setOpen(false); it.onClick(); }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 ${it.danger ? "text-rose-600" : "text-slate-700"}`}
              >
                <it.icon className="h-4 w-4" /> {it.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const RepairCell = ({ r }) => {
  if (r.status === "SCRAPPED") return <span className="text-slate-700">{r.scrapNote || "—"}</span>;
  if (r.status === "REPLACED")
    return (
      <span className="text-slate-700">
        New unit <b className="font-mono">{r.replacedBy?.label || "—"}</b>
      </span>
    );
  if (!r.repair) return <span className="text-slate-300">—</span>;
  const t = REPAIR_TYPE[r.repair.type];
  return (
    <div>
      {t && <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${t.cls}`}><t.icon className="h-3 w-3" /> {t.label}</span>}
      <p className="mt-0.5 font-medium text-slate-800">{r.repair.vendorName || (r.repair.type === "IN_HOUSE" ? "Our technician" : "—")}</p>
      <p className="text-xs text-slate-500">{[r.repair.claimRef, rupees(r.repair.estimatedCost), fmtDate(r.repair.sentAt)].filter((x) => x && x !== "—").join(" · ")}</p>
    </div>
  );
};

const RepairList = () => {
  const { permissions, isAdmin } = usePermissions();
  const canManage = canDo(permissions, isAdmin, "MANAGE");

  // Product Summary links straight to a tab (?status=IN_REPAIR …).
  const searchParams = useSearchParams();
  const [status, setStatus] = useState(() => (TABS.some((t) => t.value === searchParams.get("status")) ? searchParams.get("status") : "FAULTY"));
  const [branchId, setBranchId] = useState("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [branches, setBranches] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [action, setAction] = useState(null); // { kind, row }

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const loadVendors = useCallback(() => fetchRepairVendors().then(setVendors).catch(() => setVendors([])), []);
  useEffect(() => {
    fetchScopedBranches("repairs").then(setBranches).catch(() => setBranches([]));
    loadVendors();
  }, [loadVendors]);

  const load = useCallback(async () => {
    setLoading(true);
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
      toast.error(err.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [status, branchId, debounced, page, limit]);

  useEffect(() => { load(); }, [load]);

  const close = () => setAction(null);
  const filtered = !!branchId || !!search;

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <h1 className="mb-2.5 flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-900">
        <Wrench className="h-5 w-5 text-indigo-600" /> Repair &amp; Warranty
      </h1>

      <div className="mb-2.5 flex flex-wrap items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="w-full sm:w-72"><SearchBox value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search serial / MAC…" /></div>
        <div className="w-full sm:w-52">
          <SearchableSelect value={branchId} onChange={(v) => { setBranchId(v); setPage(1); }} options={branches.map((b) => ({ value: b._id, label: b.name }))} placeholder="All branches" />
        </div>
        {filtered && <ResetButton onClick={() => { setBranchId(""); setSearch(""); setPage(1); }} />}
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const on = status === t.value;
          return (
            <button
              key={t.value} type="button" onClick={() => { setStatus(t.value); setPage(1); }}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold shadow-sm transition ${on ? t.active : t.idle}`}
            >
              {t.label}
              <span className={`rounded-full px-1.5 text-xs tabular-nums ${on ? "bg-white/25" : "bg-white/70"}`}>{counts[t.value] || 0}</span>
            </button>
          );
        })}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-250 border-collapse text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className={th}>Unit</th>
              <th className={th}>Product</th>
              <th className={th}>Branch</th>
              <th className={th}>Fault</th>
              <th className={th}>Warranty</th>
              <th className={th}>{status === "SCRAPPED" ? "Reason" : status === "REPLACED" ? "Replaced by" : "Repair"}</th>
              <th className={`${th} text-right`}>Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-6"><div className="h-5 animate-pulse rounded bg-slate-100" /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">Nothing here</td></tr>
            ) : (
              rows.map((r) => {
                const menu = [];
                if (r.status === "FAULTY" && canManage) menu.push({ label: "Working Fine", icon: CheckCircle2, onClick: () => setAction({ kind: "ok", row: r }) });
                return (
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
                    <td className="px-4 py-3"><RepairCell r={r} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {r.status === "FAULTY" && canManage && (
                          <button type="button" onClick={() => setAction({ kind: "send", row: r })} className={`${btn} bg-indigo-600 text-white hover:bg-indigo-700`}><Wrench className="h-3.5 w-3.5" /> Send for Repair</button>
                        )}
                        {r.status === "IN_REPAIR" && canManage && (
                          <button type="button" onClick={() => setAction({ kind: "result", row: r })} className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}><CircleCheck className="h-3.5 w-3.5" /> Repair Result</button>
                        )}
                        {r.status === "REPLACED" && canManage && (
                          <button type="button" onClick={() => setAction({ kind: "old", row: r })} className={`${btn} border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100`}><Undo className="h-3.5 w-3.5" /> Old Unit Returned</button>
                        )}
                        <RowMenu items={menu} />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {total > 10 && (
        <div className="mt-5">
          <Pagination currentPage={page} totalItems={total} itemsPerPage={limit} onPageChange={setPage} onItemsPerPageChange={(n) => { setLimit(n); setPage(1); }} />
        </div>
      )}

      {action?.kind === "send" && <SendRepairModal row={action.row} vendors={vendors} onReloadVendors={loadVendors} onClose={close} onDone={load} />}
      {action?.kind === "result" && <RepairResultModal row={action.row} onClose={close} onDone={load} />}
      {action?.kind === "old" && <OldUnitModal row={action.row} onClose={close} onDone={load} />}
      {action?.kind === "ok" && (
        <NoteModal title={`${action.row.label} is working?`} hint="It goes back in stock as available." confirmLabel="Working Fine" tone="emerald" onClose={close}
          onConfirm={async (note) => { await markOk(action.row._id, { note }); toast.success("Back in stock"); load(); }} />
      )}
    </div>
  );
};

export default RepairList;
