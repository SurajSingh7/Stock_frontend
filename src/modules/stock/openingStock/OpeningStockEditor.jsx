"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowLeft, Plus, FileSpreadsheet, Trash2, Send, Save, AlertTriangle, CopyPlus, UserRound } from "lucide-react";
import { usePermissions } from "@/context/PermissionContext";
import { SearchableSelect, unitLabel } from "@/modules/stock/shared/StockSharedUI";
import { fmtDate } from "@/modules/stock/inventory/itemBadges";
import { PersonSearch, PersonCard } from "@/modules/stock/people/PersonSearch";
import { canDo, StatusBadge } from "./OpeningStockList";
import { ProductPickerModal, ExcelUploadModal, ConfirmModal } from "./OpeningStockModals";
import FloatingSelect from "./FloatingSelect";
import { entryApi } from "./openingStockApi";
import { kindConfig } from "./openingKinds";

/* ============================================================= */
/* Helpers                                                        */
/* ============================================================= */

let keySeq = 0;
const nextKey = () => `l${++keySeq}`;
const ymd = (d) => (d ? String(d).slice(0, 10) : "");
const todayYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const numOrNull = (v) => (v === "" || v === null || v === undefined ? null : Number(v));

// Months counted from the purchase date — mirrors the server, for the hint only.
const addMonths = (ymdStr, months) => {
  if (!ymdStr || !months) return null;
  const [y, m, d] = ymdStr.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + Number(months), 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target;
};

const toClientLine = (l) => ({
  _k: nextKey(),
  productDefinitionId: String(l.productDefinitionId),
  fieldValues: l.fieldValues || {},
  quantity: l.quantity ?? "",
  condition: l.condition || "USED",
  workingState: l.workingState || "WORKING",
  faultNote: l.faultNote || "",
  vendorId: l.vendorId ? String(l.vendorId) : "",
  purchaseDate: ymd(l.purchaseDate),
  purchaseCost: l.purchaseCost ?? "",
  warrantyMonths: l.warrantyMonths ?? "",
  warrantyEndDate: ymd(l.warrantyEndDate),
  inventoryItemId: l.inventoryItemId || null,
});

const toPayloadLine = (l) => ({
  productDefinitionId: l.productDefinitionId,
  fieldValues: l.fieldValues,
  quantity: numOrNull(l.quantity),
  condition: l.condition,
  workingState: l.workingState,
  faultNote: l.faultNote,
  vendorId: l.vendorId || null,
  purchaseDate: l.purchaseDate || null,
  purchaseCost: numOrNull(l.purchaseCost),
  warrantyMonths: numOrNull(l.warrantyMonths),
  warrantyEndDate: l.warrantyEndDate || null,
});

// A new row for the same product picks up what the previous one had —
// typing 40 units from one purchase should not mean 40 vendors and dates.
const blankLine = (productId, prev) => ({
  _k: nextKey(),
  productDefinitionId: productId,
  fieldValues: {},
  quantity: "",
  condition: prev?.condition || "USED",
  workingState: "WORKING",
  faultNote: "",
  vendorId: prev?.vendorId || "",
  purchaseDate: prev?.purchaseDate || "",
  purchaseCost: prev?.purchaseCost ?? "",
  warrantyMonths: prev?.warrantyMonths ?? "",
  warrantyEndDate: prev?.warrantyEndDate || "",
  inventoryItemId: null,
});

// An entry's person snapshot → the shape PersonCard shows.
const personFromSnapshot = (s) => (s?.personId ? { ...s, personId: String(s.personId), extraFields: s.extraFields || {} } : null);

// Does the unit work? Separate from New / Used.
const WORKING_STATES = { WORKING: "Working", FAULTY: "Faulty (Repairable)", BEYOND_REPAIR: "Beyond Repair (Dead)" };

const cell = "px-2 py-2 align-top";
// One control height everywhere (38px) — the same as the shared SearchableSelect
// used for Vendor, so every input, select and button in a row lines up.
// inpBase has no width, so a control that needs its own (the warranty pair)
// never ends up with two competing width classes.
const inpBase =
  "block h-[38px] min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-900 placeholder:text-slate-300 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-500";
const inp = `${inpBase} w-full`;
const thc = "px-2 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500 whitespace-nowrap";
const iconBtn = "inline-flex h-[38px] w-[38px] items-center justify-center rounded-lg border transition";

// Fixed column widths (px). The table never squeezes a column below these and
// spreads any extra screen width evenly, instead of letting one column balloon.
const COL = { num: 36, field: 180, qty: 100, condition: 100, state: 180, vendor: 200, date: 150, cost: 100, warranty: 270, del: 46 };

const FieldInput = ({ field, value, onChange, disabled }) => {
  if (field.inputType === "boolean")
    return (
      <select disabled={disabled} value={value === true ? "yes" : value === false ? "no" : ""} onChange={(e) => onChange(e.target.value === "" ? "" : e.target.value === "yes")} className={inp}>
        <option value="">—</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    );
  const type = field.inputType === "date" || field.inputType === "datetime" ? "date" : field.inputType === "number" || field.inputType === "decimal" ? "number" : "text";
  return <input type={type} disabled={disabled} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={`${inp} ${field.isUnique ? "font-mono" : ""}`} />;
};

/* ============================================================= */
/* One product section — its own columns, since every product     */
/* carries its own fields.                                        */
/* `issued`: the units are with someone, so they work and are     */
/* used — no Condition / Working state columns.                   */
/* ============================================================= */
const ProductSection = ({ product, rows, editable, issued, vendorOptions, issuesByKey, onChange, onRemove, onAddRow }) => {
  const isQty = product.trackingMethod === "quantity";
  const fields = product.fields || [];
  const widths = [
    COL.num,
    ...fields.map(() => COL.field),
    ...(isQty ? [COL.qty] : []),
    ...(issued ? [] : [COL.condition, COL.state]),
    COL.vendor, COL.date, COL.cost, COL.warranty, COL.del,
  ];
  const colCount = widths.length;
  const minWidth = widths.reduce((s, w) => s + w, 0);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
        <div>
          <span className="font-semibold text-slate-900">{product.name}</span>
          <span className="ml-2 text-xs text-slate-500">
            {product.categoryPath || ""} · {isQty ? `Group (${unitLabel(product.unit) || "qty"})` : "Individual"} · {rows.length} line(s)
          </span>
        </div>
        {editable && (
          <div className="flex gap-1.5">
            <button type="button" onClick={() => onAddRow(1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700">
              <Plus className="h-3.5 w-3.5" /> Row
            </button>
            {!isQty && (
              <button type="button" onClick={() => onAddRow(10)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700">
                <CopyPlus className="h-3.5 w-3.5" /> 10 rows
              </button>
            )}
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-sm" style={{ minWidth }}>
          <colgroup>
            {widths.map((w, i) => <col key={i} style={{ width: w }} />)}
          </colgroup>
          <thead className="bg-slate-50/60">
            <tr className="border-b border-slate-100">
              <th className={thc}>#</th>
              {fields.map((f) => (
                <th key={f.code} className={thc}>
                  {f.label}
                  {f.required && <span className="text-rose-500"> *</span>}
                  {f.isUnique && <span className="ml-1 rounded bg-violet-100 px-1 text-[10px] text-violet-700">unique</span>}
                </th>
              ))}
              {isQty && <th className={thc}>Qty *</th>}
              {!issued && <th className={thc}>Condition</th>}
              {!issued && <th className={thc}>Working state</th>}
              <th className={thc}>Vendor</th>
              <th className={thc}>Purchase date</th>
              <th className={thc}>Cost / unit</th>
              <th className={thc}>Warranty: months or end date</th>
              <th className={thc} />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ line, number }) => {
              const issues = issuesByKey.get(line._k) || [];
              const set = (patch) => onChange(line._k, patch);
              const monthsEnd = !line.warrantyEndDate ? addMonths(line.purchaseDate, line.warrantyMonths) : null;
              return (
                <React.Fragment key={line._k}>
                  <tr className={`border-b border-slate-50 ${issues.length ? "bg-rose-50/40" : ""}`}>
                    <td className={`${cell} pt-4 text-xs tabular-nums text-slate-400`}>{number}</td>
                    {fields.map((f) => (
                      <td key={f.code} className={cell}>
                        <FieldInput field={f} disabled={!editable} value={line.fieldValues?.[f.code]} onChange={(v) => set({ fieldValues: { ...line.fieldValues, [f.code]: v } })} />
                      </td>
                    ))}
                    {isQty && (
                      <td className={cell}>
                        <input type="number" min="0" disabled={!editable} value={line.quantity} onChange={(e) => set({ quantity: e.target.value })} className={inp} />
                      </td>
                    )}
                    {!issued && (
                      <td className={cell}>
                        <select disabled={!editable} value={line.condition} onChange={(e) => set({ condition: e.target.value })} className={inp}>
                          <option value="USED">Used</option>
                          <option value="NEW">New</option>
                        </select>
                      </td>
                    )}
                    {!issued && (
                      <td className={cell}>
                        <select
                          disabled={!editable}
                          value={line.workingState}
                          onChange={(e) => set({ workingState: e.target.value, ...(e.target.value === "WORKING" ? { faultNote: "" } : {}) })}
                          className={`${inp} ${line.workingState === "FAULTY" ? "border-amber-300 bg-amber-50" : line.workingState === "BEYOND_REPAIR" ? "border-rose-300 bg-rose-50" : ""}`}
                        >
                          {Object.entries(WORKING_STATES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                        {line.workingState !== "WORKING" && (
                          <input
                            disabled={!editable}
                            value={line.faultNote}
                            onChange={(e) => set({ faultNote: e.target.value })}
                            placeholder="Fault / reason *"
                            className={`${inp} mt-1`}
                          />
                        )}
                        {line.workingState === "FAULTY" && <p className="mt-0.5 text-[11px] font-medium text-amber-700">Goes to Repair &amp; Warranty</p>}
                        {line.workingState === "BEYOND_REPAIR" && <p className="mt-0.5 text-[11px] font-medium text-rose-700">Kept on record as scrapped</p>}
                      </td>
                    )}
                    <td className={cell}>
                      {editable ? (
                        <FloatingSelect value={line.vendorId} onChange={(v) => set({ vendorId: v })} options={vendorOptions} placeholder="Unknown" />
                      ) : (
                        <span className="block pt-2 text-slate-700">{vendorOptions.find((v) => v.value === line.vendorId)?.label || "—"}</span>
                      )}
                    </td>
                    <td className={cell}>
                      <input type="date" disabled={!editable} value={line.purchaseDate} onChange={(e) => set({ purchaseDate: e.target.value })} className={inp} />
                    </td>
                    <td className={cell}>
                      <input type="number" min="0" disabled={!editable} value={line.purchaseCost} onChange={(e) => set({ purchaseCost: e.target.value })} placeholder="—" className={inp} />
                    </td>
                    <td className={cell}>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number" min="1" max="120" placeholder="Months"
                          disabled={!editable || !!line.warrantyEndDate}
                          value={line.warrantyMonths}
                          onChange={(e) => set({ warrantyMonths: e.target.value })}
                          className={`${inpBase} w-19 shrink-0`}
                        />
                        <span className="shrink-0 text-xs text-slate-400">or</span>
                        <input
                          type="date"
                          title="Warranty end date"
                          disabled={!editable || line.warrantyMonths !== ""}
                          value={line.warrantyEndDate}
                          onChange={(e) => set({ warrantyEndDate: e.target.value })}
                          className={`${inpBase} flex-1`}
                        />
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {line.warrantyEndDate
                          ? `Till ${fmtDate(line.warrantyEndDate)}`
                          : monthsEnd
                            ? `Till ${fmtDate(monthsEnd)}`
                            : line.warrantyMonths !== ""
                              ? "Needs purchase date"
                              : "Unknown"}
                      </p>
                    </td>
                    <td className={`${cell} text-center`}>
                      {editable && (
                        <button type="button" onClick={() => onRemove(line._k)} title="Remove line" className={`${iconBtn} border-transparent text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                  {issues.length > 0 && (
                    <tr className="bg-rose-50/40">
                      <td />
                      <td colSpan={colCount - 1} className="px-2 pb-2 text-xs font-medium text-rose-700">
                        <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
                        {issues.join(" · ")}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ============================================================= */
/* Editor — Opening Stock (STORE) or Opening Issued Stock (ISSUED) */
/* ============================================================= */
const OpeningStockEditor = ({ entryId, kind = "STORE" }) => {
  const router = useRouter();
  const cfg = kindConfig(kind);
  const issued = cfg.kind === "ISSUED";
  const api = useMemo(() => entryApi(cfg.kind), [cfg.kind]);
  const { permissions, isAdmin } = usePermissions();
  const isNew = entryId === "new";

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [entry, setEntry] = useState(null);
  const [options, setOptions] = useState({ branches: [], vendors: [], defaultBranchId: null });
  const [header, setHeader] = useState({ branchId: "", entryDate: todayYmd(), remarks: "", issuedSince: "" });
  const [person, setPerson] = useState(null);
  const [changingPerson, setChangingPerson] = useState(false);
  const [lines, setLines] = useState([]);
  const [products, setProducts] = useState(new Map());
  const [issuesByKey, setIssuesByKey] = useState(new Map());
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const [picking, setPicking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirm, setConfirm] = useState(null); // "post" | "delete"

  const isDraft = !entry || entry.status === "DRAFT";
  const editable = isDraft && canDo(permissions, isAdmin, isNew ? "CREATE" : "UPDATE", cfg.moduleKey);
  const canPost = isDraft && !isNew && canDo(permissions, isAdmin, "POST", cfg.moduleKey);
  const canDelete = isDraft && !isNew && canDo(permissions, isAdmin, "DELETE", cfg.moduleKey);

  // Server issues are by line index in the order sent — pin them to the
  // client keys so they follow the row, and vanish from a row once it is edited.
  const absorb = useCallback((data, sentLines) => {
    setEntry(data);
    setHeader({
      branchId: String(data.branchId?._id || data.branchId || ""),
      entryDate: ymd(data.entryDate),
      remarks: data.remarks || "",
      issuedSince: ymd(data.issuedSince),
    });
    setPerson(personFromSnapshot(data.issuedTo));
    setChangingPerson(false);
    const next = sentLines || (data.lines || []).map(toClientLine);
    if (!sentLines) setLines(next);
    else if (data.status === "POSTED") setLines((data.lines || []).map(toClientLine));
    const map = new Map();
    (data.issues || []).forEach((i) => next[i.index] && map.set(next[i.index]._k, i.messages));
    setIssuesByKey(map);
    setDirty(false);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const opts = await api.fetchFormOptions();
        setOptions(opts);
        if (isNew) {
          setHeader((h) => ({ ...h, branchId: opts.defaultBranchId || "" }));
        } else {
          const data = await api.fetchEntry(entryId);
          const ids = [...new Set((data.lines || []).map((l) => String(l.productDefinitionId)))];
          const prods = await api.fetchProductsByIds(ids);
          setProducts(new Map(prods.map((p) => [String(p._id), p])));
          absorb(data);
        }
      } catch (err) {
        setLoadError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [api, entryId, isNew, absorb]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const touch = () => setDirty(true);
  const addProductLines = (product, newLines) => {
    setProducts((m) => new Map(m).set(String(product._id), product));
    setLines((ls) => [...ls, ...newLines]);
    touch();
  };
  const addRows = (productId, n) => {
    setLines((ls) => {
      const prev = [...ls].reverse().find((l) => l.productDefinitionId === productId);
      const add = Array.from({ length: n }, () => blankLine(productId, prev));
      // Insert after the product's last line, so its section stays together.
      const lastIdx = ls.map((l) => l.productDefinitionId).lastIndexOf(productId);
      return lastIdx < 0 ? [...ls, ...add] : [...ls.slice(0, lastIdx + 1), ...add, ...ls.slice(lastIdx + 1)];
    });
    touch();
  };
  const changeLine = (k, patch) => {
    setLines((ls) => ls.map((l) => (l._k === k ? { ...l, ...patch } : l)));
    setIssuesByKey((m) => { if (!m.has(k)) return m; const n = new Map(m); n.delete(k); return n; });
    touch();
  };
  const removeLine = (k) => { setLines((ls) => ls.filter((l) => l._k !== k)); touch(); };
  const choosePerson = (p) => { setPerson(p); setChangingPerson(false); touch(); };

  // Sections in order of first appearance; line numbers are global.
  const sections = useMemo(() => {
    const order = [];
    const byProduct = new Map();
    lines.forEach((line, i) => {
      if (!byProduct.has(line.productDefinitionId)) { byProduct.set(line.productDefinitionId, []); order.push(line.productDefinitionId); }
      byProduct.get(line.productDefinitionId).push({ line, number: i + 1 });
    });
    return order.map((id) => ({ product: products.get(id), rows: byProduct.get(id) })).filter((s) => s.product);
  }, [lines, products]);

  const vendorOptions = useMemo(() => options.vendors.map((v) => ({ value: String(v._id), label: v.name })), [options.vendors]);
  const issueCount = issuesByKey.size;

  const save = async () => {
    if (!header.branchId) { toast.error(issued ? "Choose the branch whose stock this is" : "Choose the branch this stock is in"); return null; }
    if (issued && !person) { toast.error("Choose who has these items"); return null; }
    setSaving(true);
    const sent = lines;
    try {
      const { issuedSince, ...rest } = header;
      const payload = {
        ...rest,
        lines: sent.map(toPayloadLine),
        ...(issued ? { personId: person.personId, issuedSince: issuedSince || null } : {}),
      };
      const data = isNew ? await api.createEntry(payload) : await api.updateEntry(entryId, payload);
      absorb(data, sent);
      toast.success(data.issues?.length ? `Saved — ${data.issues.length} line(s) need fixing` : "Saved");
      if (isNew) router.replace(`${cfg.path}/${data._id}`);
      return data;
    } catch (err) {
      toast.error(err.message);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const doPost = async () => {
    setSaving(true);
    try {
      if (dirty) {
        const saved = await save();
        if (!saved) return;
        if (saved.issues?.length) { setConfirm(null); return; }
      }
      const data = await api.postEntry(entryId);
      absorb(data, lines);
      toast.success(
        issued
          ? `${data.entryNumber} posted — ${data.lines.length} item(s) are now with ${data.issuedTo?.name || "them"}`
          : `${data.entryNumber} posted — ${data.lines.length} item(s) are now in stock`
      );
      setConfirm(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    setSaving(true);
    try {
      await api.deleteEntry(entryId);
      toast.success("Draft deleted");
      router.push(cfg.path);
    } catch (err) {
      toast.error(err.message);
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6"><div className="h-40 animate-pulse rounded-2xl bg-white" /></div>;
  if (loadError) return <div className="p-6"><div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loadError}</div></div>;

  const faultyCount = issued ? 0 : lines.filter((l) => l.workingState === "FAULTY").length;
  const beyondCount = issued ? 0 : lines.filter((l) => l.workingState === "BEYOND_REPAIR").length;
  const branchName = options.branches.find((b) => String(b._id) === header.branchId)?.name || entry?.branchId?.name || "this branch";
  const personName = person?.name || person?.username || "";

  return (
    <div className="min-h-screen bg-slate-50/60 p-6 pb-28">
      <button type="button" onClick={() => router.push(cfg.path)} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> {cfg.title}
      </button>

      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">{entry?.entryNumber || cfg.newTitle}</h1>
          {entry && <StatusBadge status={entry.status} />}
          {entry?.status === "POSTED" && (
            <span className="text-sm text-slate-500">
              Posted {fmtDate(entry.postedAt)}{entry.postedBy?.name ? ` by ${entry.postedBy.name}` : ""}
            </span>
          )}
        </div>
        <div className={`grid gap-3 ${issued ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`}>
          <div>
            <label className="text-xs font-semibold text-slate-600">Branch *</label>
            <div className="mt-1">
              {editable ? (
                <SearchableSelect
                  value={header.branchId}
                  onChange={(v) => { setHeader((h) => ({ ...h, branchId: v })); touch(); }}
                  options={options.branches.map((b) => ({ value: String(b._id), label: b.name }))}
                  placeholder="Select branch"
                />
              ) : (
                <p className="py-2 text-sm font-medium text-slate-800">{entry?.branchId?.name || "—"}</p>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Entry date</label>
            <input type="date" disabled={!editable} value={header.entryDate} onChange={(e) => { setHeader((h) => ({ ...h, entryDate: e.target.value })); touch(); }} className={`${inp} mt-1 py-2`} />
          </div>
          {issued && (
            <div>
              <label className="text-xs font-semibold text-slate-600">With them since</label>
              <input
                type="date"
                disabled={!editable}
                max={header.entryDate || undefined}
                value={header.issuedSince}
                onChange={(e) => { setHeader((h) => ({ ...h, issuedSince: e.target.value })); touch(); }}
                className={`${inp} mt-1 py-2`}
              />
              <p className="mt-0.5 text-[11px] text-slate-400">Leave blank if not known</p>
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-slate-600">Remarks</label>
            <input
              disabled={!editable}
              value={header.remarks}
              onChange={(e) => { setHeader((h) => ({ ...h, remarks: e.target.value })); touch(); }}
              placeholder={issued ? "e.g. Laptop + charger since joining" : "e.g. Delhi store physical count"}
              className={`${inp} mt-1 py-2`}
            />
          </div>
        </div>
      </div>

      {issued && (
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <UserRound className="h-4 w-4 text-indigo-600" />
            <h2 className="text-sm font-semibold text-slate-900">Who has these items? <span className="text-rose-500">*</span></h2>
            <span className="text-xs text-slate-400">Employee or subscriber — one person per entry</span>
          </div>
          {person && !changingPerson ? (
            <PersonCard person={person} onChange={editable ? () => setChangingPerson(true) : null} />
          ) : editable ? (
            <div>
              <PersonSearch module={cfg.moduleKey} onPick={choosePerson} autoFocus={changingPerson} />
              {changingPerson && (
                <button type="button" onClick={() => setChangingPerson(false)} className="mt-2 text-xs font-semibold text-slate-500 hover:text-slate-700">
                  Keep {personName}
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">—</p>
          )}
        </div>
      )}

      {editable && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => setPicking(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 shadow-sm hover:bg-indigo-50">
            <Plus className="h-4 w-4" /> Add Item
          </button>
          {!issued && (
            <button type="button" onClick={() => setUploading(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm hover:bg-emerald-50">
              <FileSpreadsheet className="h-4 w-4" /> Upload Excel
            </button>
          )}
        </div>
      )}

      {issueCount > 0 && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertTriangle className="mr-1 inline h-4 w-4" />
          {issueCount} line(s) need fixing before this entry can be posted — they are marked below.
        </div>
      )}

      {sections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center">
          <p className="text-sm font-medium text-slate-700">No items yet</p>
          <p className="mt-1 text-sm text-slate-400">
            {issued ? "Add each item this person has — serial numbers make them traceable." : "Add items one by one, or upload a product's Excel template."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sections.map((s) => (
            <ProductSection
              key={s.product._id}
              product={s.product}
              rows={s.rows}
              editable={editable}
              issued={issued}
              vendorOptions={vendorOptions}
              issuesByKey={issuesByKey}
              onChange={changeLine}
              onRemove={removeLine}
              onAddRow={(n) => addRows(String(s.product._id), n)}
            />
          ))}
        </div>
      )}

      {(editable || canPost || canDelete) && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-6 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.04)] backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{lines.length}</span> line(s)
              {issued && personName && <> · with <span className="font-semibold text-slate-900">{personName}</span></>}
              {faultyCount > 0 && <> · <span className="font-semibold text-amber-700">{faultyCount}</span> faulty</>}
              {beyondCount > 0 && <> · <span className="font-semibold text-rose-700">{beyondCount}</span> beyond repair</>}
              {dirty && <span className="ml-2 text-amber-600">· unsaved changes</span>}
            </p>
            <div className="flex gap-2">
              {canDelete && (
                <button type="button" onClick={() => setConfirm("delete")} className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50">
                  Delete draft
                </button>
              )}
              {editable && (
                <button type="button" disabled={saving} onClick={save} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                  <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save draft"}
                </button>
              )}
              {canPost && (
                <button
                  type="button"
                  disabled={saving || !lines.length || (!dirty && issueCount > 0) || (issued && !person)}
                  onClick={() => setConfirm("post")}
                  title={!dirty && issueCount > 0 ? "Fix the marked lines first" : issued && !person ? "Choose who has these items first" : ""}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send className="h-4 w-4" /> {issued ? "Post & assign" : "Post to stock"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {picking && <ProductPickerModal search={api.searchProducts} onClose={() => setPicking(false)} onPick={(p) => addProductLines(p, [blankLine(String(p._id))])} />}
      {uploading && (
        <ExcelUploadModal
          onClose={() => setUploading(false)}
          onAdd={(product, parsed) => addProductLines(product, parsed.map(toClientLine))}
        />
      )}
      {confirm === "post" && (
        <ConfirmModal
          title={issued ? "Post and assign?" : "Post to stock?"}
          confirmLabel={`Post ${lines.length} line(s)`}
          busy={saving}
          onConfirm={doPost}
          onClose={() => setConfirm(null)}
        >
          {issued ? (
            <>
              <p>
                Every line becomes an inventory item of <b>{branchName}</b>, <b>assigned to {personName}</b>
                {person?.kind === "EMPLOYEE" ? " — it shows under Employee Items." : " — it shows under Subscriber Items, and the website sees it as theirs."}
              </p>
              {header.issuedSince && <p className="mt-2">Their history will say they have had it since <b>{fmtDate(header.issuedSince)}</b>.</p>}
            </>
          ) : (
            <>
              <p>Every line becomes an inventory item at <b>{branchName}</b>.</p>
              {faultyCount > 0 && <p className="mt-2">{faultyCount} faulty item(s) go straight to <b>Repair &amp; Warranty</b>.</p>}
              {beyondCount > 0 && <p className="mt-2">{beyondCount} beyond-repair item(s) are kept on record as <b>scrapped</b> — never available stock.</p>}
            </>
          )}
          <p className="mt-2 text-slate-500">A posted entry can no longer be edited.</p>
        </ConfirmModal>
      )}
      {confirm === "delete" && (
        <ConfirmModal title="Delete this draft?" tone="rose" confirmLabel="Delete" busy={saving} onConfirm={doDelete} onClose={() => setConfirm(null)}>
          Nothing has gone into stock from it — the draft and its {lines.length} line(s) will be removed.
        </ConfirmModal>
      )}
    </div>
  );
};

export default OpeningStockEditor;
