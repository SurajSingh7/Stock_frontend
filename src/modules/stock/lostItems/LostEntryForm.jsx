"use client";

/*
  Add Lost / Add Found / Add Dead / edit a rejected entry — then it goes for
  approval. Dead: units in the store (Available or Faulty), each with its own
  reason if wanted; once approved they are written off (Dead / Scrapped).

    ① Details  branch, note
    ② Units    category → product → search a unit (serial / MAC), or for batch
               stock pick where it is (store / a subscriber's / an employee's
               share) and a quantity. Newest line on top.
  Lost: the reason follows from where the unit was (Store / Subscriber /
  Employee). Found: say how each unit turned up (Working / Faulty / Dead).
*/

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ClipboardList, Boxes, Building2, MessageSquareText, Search, Trash2, Plus, Send, Loader2 } from "lucide-react";
import { SearchableSelect, inputCls, unitLabel } from "@/modules/stock/shared/StockSharedUI";
import { fetchLeafCategories, fetchScopedBranches, fetchProductDefinitions } from "@/modules/stock/shared/lookupsApi";
import { BackHeader, ConfirmDialog } from "@/modules/stock/inventoryTransfer/shared";
import { fetchLostEntry, fetchUnitOptions, fetchBatchSources, createLostEntry, updateLostEntry } from "./lostApi";
import { REASON_LABEL, FOUND_LABEL, qtyText, TypeBadge, FAMILIES, familyOf } from "./lostUi";

const Card = ({ index, icon: Icon, title, subtitle, action, children }) => (
  <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-2xl bg-slate-50/60 px-6 py-4">
      <div className="flex items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">{index}</span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100"><Icon className="h-4 w-4" /></span>
        <div>
          <h2 className="text-sm font-bold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
    <div className="border-t border-slate-100 px-6 pb-6 pt-5">{children}</div>
  </section>
);

const Field = ({ icon: Icon, label, required, hint, children }) => (
  <div className="flex min-w-0 flex-col gap-1.5">
    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
      {Icon && <Icon className="h-3.5 w-3.5 text-slate-400" />}
      {label} {required && <span className="text-rose-500">*</span>}
    </label>
    {children}
    {hint && <p className="text-xs text-slate-400">{hint}</p>}
  </div>
);

const STATUS_TEXT = { AVAILABLE: "In store", ASSIGNED: "With", FAULTY: "Faulty", IN_REPAIR: "In repair", LOST: "Lost" };
// Must match the backend's batch source key (services/stock.lost.entry.service.js).
const sourceKeyOf = (line, type) =>
  type === "FOUND"
    ? `LOST|${line.lostEntryNumber || ""}`
    : [line.fromStatus, line.holder?.kind, line.holder?.subscriberId || "", line.holder?.code || "", line.holder?.orderId || ""].join("|");
const newKey = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()));

/* Serial / MAC search — the list opens as you type; Enter or a click adds. */
const UnitPicker = ({ family, query, takenIds, onPick }) => {
  const [text, setText] = useState("");
  const [options, setOptions] = useState([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const box = useRef(null);

  const ready = !!query.productDefinitionId && !!query.branchId;
  useEffect(() => {
    if (!ready) return undefined;
    const t = setTimeout(async () => {
      setBusy(true);
      try { setOptions(await fetchUnitOptions(family, { ...query, search: text.trim() })); } catch (e) { toast.error(e.message); } finally { setBusy(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [text, query, ready, family]);

  useEffect(() => {
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const shown = ready ? options.filter((o) => !takenIds.has(String(o._id))) : [];
  const pick = (o) => { onPick(o); setText(""); setOpen(false); };

  return (
    <div ref={box} className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        value={text} onFocus={() => setOpen(true)} onChange={(e) => { setText(e.target.value); setOpen(true); }}
        onKeyDown={(e) => { if (e.key === "Enter" && shown[0]) { e.preventDefault(); pick(shown[0]); } }}
        placeholder="Search serial / MAC…" className={`${inputCls} pl-9`}
      />
      {busy && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />}
      {open && (
        <div className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {shown.length === 0 ? (
            <p className="px-3 py-3 text-center text-sm text-slate-400">{busy ? "Searching…" : "No unit found"}</p>
          ) : (
            shown.map((o) => (
              <button key={o._id} type="button" onClick={() => pick(o)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-indigo-50">
                <span className="font-mono font-medium text-slate-900">{o.label}</span>
                <span className="truncate text-xs text-slate-500">
                  {o.status === "LOST" ? `Lost · ${o.lostEntryNumber || ""}` : o.status === "ASSIGNED" ? o.holderText : STATUS_TEXT[o.status] || o.status}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

const FoundStateCell = ({ line, onChange }) => (
  <div className="space-y-1.5">
    <div className="flex flex-wrap gap-1">
      {Object.entries(FOUND_LABEL).map(([value, label]) => (
        <button
          key={value} type="button" onClick={() => onChange({ foundState: value })}
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset transition ${
            line.foundState === value
              ? value === "WORKING" ? "bg-emerald-600 text-white ring-emerald-600" : value === "FAULTY" ? "bg-amber-500 text-white ring-amber-500" : "bg-slate-600 text-white ring-slate-600"
              : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
    {line.foundState && line.foundState !== "WORKING" && (
      <input value={line.foundNote || ""} onChange={(e) => onChange({ foundNote: e.target.value })} placeholder="What is wrong? *" className={`${inputCls} py-1.5 text-xs`} />
    )}
  </div>
);

const LostEntryForm = ({ type: typeProp = "LOST", entryId }) => {
  const router = useRouter();
  const editing = !!entryId;
  const [type, setType] = useState(typeProp);
  const found = type === "FOUND";
  const dead = type === "DEAD";
  const family = familyOf(type);
  const listPath = FAMILIES[family].items.path;

  const [branches, setBranches] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [branchId, setBranchId] = useState("");
  const [note, setNote] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [productId, setProductId] = useState("");
  const [sources, setSources] = useState([]);
  const [sourceKey, setSourceKey] = useState("");
  const [qty, setQty] = useState("");
  const [lines, setLines] = useState([]);
  const [entryNumber, setEntryNumber] = useState("");
  const [loading, setLoading] = useState(editing);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchScopedBranches(FAMILIES[familyOf(typeProp)].items.module).then((b) => { setBranches(b); if (b.length === 1 && !editing) setBranchId(String(b[0]._id)); }).catch(() => setBranches([]));
    fetchLeafCategories().then(setCategories).catch(() => setCategories([]));
  }, [editing, typeProp]);

  // Editing a rejected entry: load it as it was.
  useEffect(() => {
    if (!editing) return;
    (async () => {
      try {
        const e = await fetchLostEntry(familyOf(typeProp), "items", entryId);
        setType(e.type);
        setEntryNumber(e.entryNumber);
        setBranchId(String(e.branchId?._id || e.branchId));
        setNote(e.note || "");
        setLines([...e.lines].reverse().map((l) => ({
          key: newKey(),
          inventoryItemId: l.inventoryItemId || null,
          productDefinitionId: l.productDefinitionId,
          productName: l.productName,
          unit: l.unit,
          label: l.label,
          quantity: l.quantity,
          holderText: l.holder?.kind === "STORE" ? "Store" : l.label && !l.inventoryItemId ? l.label : [l.holder?.name, l.holder?.code && `(${l.holder.code})`, l.holder?.orderId].filter(Boolean).join(" "),
          reason: l.reason,
          lostEntryNumber: l.lostEntryNumber,
          sourceKey: l.inventoryItemId ? null : sourceKeyOf(l, e.type),
          foundState: l.foundState || "",
          foundNote: l.foundNote || "",
          statusText: STATUS_TEXT[l.fromStatus] || "",
          deadNote: l.deadNote || "",
        })));
      } catch (err) {
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [editing, entryId, typeProp]);

  const product = products.find((p) => String(p._id) === String(productId));
  const isBatch = product?.trackingMethod === "QUANTITY";

  // Batch stock of a product at a branch, by where it is.
  const loadSources = (branch, prod) => {
    setSourceKey(""); setQty(""); setSources([]);
    if (!branch || prod?.trackingMethod !== "QUANTITY") return;
    fetchBatchSources(family, { branchId: branch, productDefinitionId: prod._id, type }).then(setSources).catch((e) => toast.error(e.message));
  };
  const onCategory = (v) => {
    setCategoryId(v);
    setProductId("");
    setProducts([]);
    loadSources(branchId, null);
    if (v) fetchProductDefinitions({ categoryId: v }).then(setProducts).catch(() => setProducts([]));
  };
  const onProduct = (v) => {
    setProductId(v);
    loadSources(branchId, products.find((p) => String(p._id) === String(v)));
  };
  const onBranch = (v) => {
    setBranchId(v);
    loadSources(v, product);
  };

  const unitQuery = useMemo(() => ({ branchId, productDefinitionId: productId, type, ...(editing ? { entryId } : {}) }), [branchId, productId, type, editing, entryId]);
  const takenIds = useMemo(() => new Set(lines.filter((l) => l.inventoryItemId).map((l) => String(l.inventoryItemId))), [lines]);

  const addUnit = (o) =>
    setLines((ls) => [{
      key: newKey(), inventoryItemId: o._id, productDefinitionId: productId, productName: product?.name, unit: product?.unit,
      label: o.label, holderText: o.status === "ASSIGNED" ? o.holderText : STATUS_TEXT[o.status] || "Store", reason: o.reason,
      lostEntryNumber: o.lostEntryNumber, foundState: "", foundNote: "", statusText: STATUS_TEXT[o.status] || "", deadNote: "",
    }, ...ls]);

  const addBatch = () => {
    const src = sources.find((s) => s.key === sourceKey);
    const q = Number(qty);
    if (!src || !(q > 0)) return toast.error("Choose where it was and enter how much");
    if (q > src.quantity) return toast.error(`Only ${qtyText(src.quantity, product?.unit)} there`);
    if (lines.some((l) => !l.inventoryItemId && String(l.productDefinitionId) === String(productId) && l.sourceKey === src.key))
      return toast.error("Already added — change its quantity in the list");
    setLines((ls) => [{
      key: newKey(), inventoryItemId: null, productDefinitionId: productId, productName: product?.name, unit: product?.unit,
      label: src.holderText, quantity: q, holderText: src.holderText, reason: src.reason, lostEntryNumber: src.lostEntryNumber,
      sourceKey: src.key, foundState: "", foundNote: "", statusText: STATUS_TEXT[src.status] || "", deadNote: "",
    }, ...ls]);
    setQty(""); setSourceKey("");
  };

  const setLine = (key, patch) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const removeLine = (key) => setLines((ls) => ls.filter((l) => l.key !== key));

  const missing = !branchId ? "Choose the branch"
    : !note.trim() ? (found ? "Say where it was found" : dead ? "Say why it is dead" : "Say how it was lost")
      : !lines.length ? "Add at least one unit"
        : found && lines.some((l) => !l.foundState) ? "Say how each unit was found"
          : found && lines.some((l) => l.foundState !== "WORKING" && !String(l.foundNote || "").trim()) ? "Say what is wrong with each faulty / dead unit"
            : null;

  const submit = async () => {
    setBusy(true);
    try {
      const body = {
        type, branchId, note: note.trim(),
        lines: [...lines].reverse().map((l) => (l.inventoryItemId
          ? { inventoryItemId: l.inventoryItemId, foundState: l.foundState || undefined, foundNote: l.foundNote, deadNote: l.deadNote }
          : { productDefinitionId: l.productDefinitionId, sourceKey: l.sourceKey, quantity: l.quantity, foundState: l.foundState || undefined, foundNote: l.foundNote, deadNote: l.deadNote })),
      };
      const saved = editing ? await updateLostEntry(family, entryId, body) : await createLostEntry(family, body);
      toast.success(`${saved.entryNumber} sent for approval`);
      router.push(listPath);
    } catch (err) {
      toast.error(err.message);
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="mx-auto w-full max-w-6xl p-6"><div className="h-40 animate-pulse rounded-2xl bg-slate-100" /></div>;

  return (
    <div className="min-h-screen bg-slate-50/60">
      <div className="mx-auto w-full max-w-6xl space-y-5 p-6 pb-12">
        <BackHeader
          onBack={() => router.push(listPath)}
          title={editing ? `Edit ${entryNumber}` : found ? "Add Found" : dead ? "Add Dead" : "Add Lost"}
          subtitle={found ? "Lost units that have turned up — goes for approval" : dead ? "Units beyond repair, to write off — goes for approval" : "Units that are missing — goes for approval"}
        >
          <TypeBadge type={type} />
        </BackHeader>

        <Card index={1} icon={ClipboardList} title="Details">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field icon={Building2} label="Branch" required hint={lines.length ? "Remove the units to change the branch" : ""}>
              <div className={lines.length ? "pointer-events-none opacity-60" : ""}>
                <SearchableSelect value={branchId} onChange={onBranch} options={branches.map((b) => ({ value: String(b._id), label: b.name }))} placeholder="Select branch" />
              </div>
            </Field>
            <div className="sm:col-span-2">
              <Field icon={MessageSquareText} label={found ? "Where was it found?" : dead ? "Why is it dead?" : "How was it lost?"} required>
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={found ? "e.g. Found in the back room" : dead ? "e.g. Burnt in the power surge, board dead" : "e.g. Not found in the stock check on 18 Nov"} className={inputCls} />
              </Field>
            </div>
          </div>
        </Card>

        <Card
          index={2} icon={Boxes} title={found ? "Found Units" : dead ? "Dead Units" : "Lost Units"}
          subtitle={found ? "Only units that are Lost can be picked" : dead ? "Units in the store — Available or Faulty" : "Any unit we hold — in store, with a subscriber or an employee, faulty or in repair"}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Category" required>
              <SearchableSelect value={categoryId} onChange={onCategory} options={categories.map((c) => ({ value: c._id, label: c.displayPath || c.name }))} placeholder="Select category" />
            </Field>
            <Field label="Product" required>
              <SearchableSelect value={productId} onChange={onProduct} options={products.map((p) => ({ value: p._id, label: p.name }))} placeholder={categoryId ? "Select product" : "Choose a category first"} />
            </Field>
            {product && !isBatch && (
              <Field label="Unit" required>
                {branchId ? <UnitPicker family={family} query={unitQuery} takenIds={takenIds} onPick={addUnit} /> : <p className="py-2 text-sm text-slate-400">Choose the branch first</p>}
              </Field>
            )}
          </div>
          {product && isBatch && (
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field label={found ? "From which Lost entry" : "Where was it?"} required>
                <SearchableSelect
                  value={sourceKey} onChange={setSourceKey} placeholder={sources.length ? "Select" : "No stock here"}
                  options={sources.map((s) => ({ value: s.key, label: `${found ? s.lostEntryNumber || "Lost" : dead ? STATUS_TEXT[s.status] || s.status : s.holderText} · ${qtyText(s.quantity, product.unit)}` }))}
                />
              </Field>
              <Field label={`Quantity (${unitLabel(product.unit) || "pcs"})`} required>
                <input type="number" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} className={inputCls} />
              </Field>
              <div className="flex items-end">
                <button type="button" onClick={addBatch} className="inline-flex h-9.5 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500">
                  <Plus className="h-4 w-4" /> Add
                </button>
              </div>
            </div>
          )}

          <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-180 text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                  <th className="w-10 px-3 py-2.5">#</th>
                  <th className="px-3 py-2.5">Product</th>
                  <th className="px-3 py-2.5">Serial / From</th>
                  <th className="px-3 py-2.5 text-right">Qty</th>
                  <th className="px-3 py-2.5">{found ? "Lost entry" : dead ? "Now" : "Where it was"}</th>
                  <th className="px-3 py-2.5">{found ? <>How was it found? <span className="text-rose-500">*</span></> : dead ? "Reason (this unit)" : "Reason"}</th>
                  <th className="w-12 px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.length === 0 ? (
                  <tr><td colSpan={7} className="px-3 py-10 text-center text-sm text-slate-400">No units yet — pick a category, a product, then a unit.</td></tr>
                ) : (
                  lines.map((l, i) => (
                    <tr key={l.key}>
                      <td className="px-3 py-2.5 text-xs font-bold text-slate-400">{lines.length - i}</td>
                      <td className="px-3 py-2.5 font-medium text-slate-800">{l.productName}</td>
                      <td className="px-3 py-2.5 font-mono text-slate-900">{l.inventoryItemId ? l.label : <span className="font-sans text-slate-600">{l.label}</span>}</td>
                      <td className="px-3 py-2.5 text-right">
                        {l.inventoryItemId ? <span className="tabular-nums text-slate-700">1</span> : (
                          <input type="number" min="0" step="any" value={l.quantity} onChange={(e) => setLine(l.key, { quantity: e.target.value === "" ? "" : Number(e.target.value) })} className={`${inputCls} w-24 py-1 text-right`} />
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">{found ? l.lostEntryNumber || "—" : dead ? l.statusText || "—" : l.holderText}</td>
                      <td className="px-3 py-2.5">
                        {found ? <FoundStateCell line={l} onChange={(p) => setLine(l.key, p)} /> : dead ? (
                          <input value={l.deadNote || ""} onChange={(e) => setLine(l.key, { deadNote: e.target.value })} placeholder="Optional — the entry's reason is used" className={`${inputCls} py-1.5 text-xs`} />
                        ) : <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200">{REASON_LABEL[l.reason] || "—"}</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button type="button" onClick={() => removeLine(l.key)} aria-label="Remove" className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
          <p className="text-sm text-slate-500">{missing || <span className="text-emerald-700">Ready — {lines.length} line{lines.length === 1 ? "" : "s"}</span>}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => router.push(listPath)} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
            <button
              type="button" disabled={!!missing} onClick={() => setConfirm(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
            >
              <Send className="h-4 w-4" /> Submit for Approval
            </button>
          </div>
        </div>
      </div>

      {confirm && (
        <ConfirmDialog
          message={`Send this ${found ? "Found" : dead ? "Dead" : "Lost"} entry for approval?`}
          detail={found ? "The units go back to stock only once it is approved." : dead ? "These units are held from now, and written off (Dead / Scrapped) once it is approved." : "These units are held from now — nobody can issue, move or repair them until it is approved or rejected."}
          busy={busy} onConfirm={submit} onClose={() => setConfirm(false)}
        />
      )}
    </div>
  );
};

export default LostEntryForm;
