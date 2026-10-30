"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Plus, Pencil, Trash2, X, ChevronDown, Clock, ArrowDown, Bell, Hand, Info } from "lucide-react";
import { alertApi, STOCK_API } from "../shared/alertApi";
import { useAlertEvents } from "../templates/AlertTemplates";
import {
  AlertsShell, Modal, Field, ErrorBox, Empty, ConfirmModal, ChannelBadge, Toggle, inputCls, btnPrimary, btnGhost, cardCls, useAlertActions,
} from "../shared/AlertUI";

const STEP_LABEL = { INITIAL: "First message", REMINDER: "Reminder", ESCALATION: "Escalation" };
const STEP_TONE = {
  INITIAL: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  REMINDER: "bg-amber-50 text-amber-700 ring-amber-200",
  ESCALATION: "bg-rose-50 text-rose-700 ring-rose-200",
};

const newSend = (channel) => ({ channel, enabled: true, templateId: "", to: [], cc: [] });
const newStep = (type) => ({ type, afterHours: type === "INITIAL" ? 0 : 4, enabled: true, sends: [newSend("WHATSAPP")] });

/* Lookups shared by the list and the editor. */
const useLookups = () => {
  const [state, setState] = useState({ contacts: [], groups: [], templates: [], branches: [], vendors: [] });
  useEffect(() => {
    const safe = (p) => p.then((r) => r.data || []).catch(() => []);
    Promise.all([
      safe(alertApi("/contacts", { query: { limit: 100 } })),
      safe(alertApi("/groups", { query: { limit: 100 } })),
      safe(alertApi("/templates", { query: { limit: 100 } })),
      safe(alertApi(`${STOCK_API}/branches`, { query: { limit: 100 } })),
      safe(alertApi(`${STOCK_API}/vendors`, { query: { limit: 100 } })),
    ]).then(([contacts, groups, templates, branches, vendors]) => setState({ contacts, groups, templates, branches, vendors }));
  }, []);
  return state;
};

const recipientLabel = (r, lk) => {
  if (r.type === "CONTACT") return lk.contacts.find((c) => c._id === String(r.refId))?.name || "Contact";
  if (r.type === "GROUP") return lk.groups.find((g) => g._id === String(r.refId))?.name || "Group";
  if (r.type === "CREATOR") return "Record creator";
  if (r.type === "VENDOR") return "Vendor";
  if (r.type === "BRANCH_USERS") return "People with access to the branch";
  return r.address;
};

/* ─── Recipient picker ──────────────────────────────────────────────────── */
const RecipientPicker = ({ value, onChange, lk, allowVendor, allowBranchUsers, placeholder = "Add recipient" }) => {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const has = (type, refId) => value.some((r) => r.type === type && String(r.refId || "") === String(refId || ""));
  const add = (r) => {
    if (!has(r.type, r.refId) || r.type === "ADDRESS") onChange([...value, r]);
    setOpen(false);
  };

  return (
    <div className="relative">
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
        {value.map((r, i) => (
          <span key={`${r.type}-${r.refId || r.address}-${i}`} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
            {recipientLabel(r, lk)}
            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="text-slate-400 hover:text-rose-600"><X className="h-3 w-3" /></button>
          </span>
        ))}
        <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50">
          <Plus className="h-3 w-3" />{placeholder}<ChevronDown className="h-3 w-3" />
        </button>
      </div>
      {open && (
        <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
          <p className="px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">From the record</p>
          <PickItem disabled={has("CREATOR")} onClick={() => add({ type: "CREATOR" })} label="Record creator" hint="whoever created it" />
          {allowVendor && <PickItem disabled={has("VENDOR")} onClick={() => add({ type: "VENDOR" })} label="Vendor" hint="contacts marked To (CC on the CC line)" />}
          {allowBranchUsers && (
            <PickItem
              disabled={has("BRANCH_USERS")} onClick={() => add({ type: "BRANCH_USERS" })}
              label="People with access to the branch" hint="contacts linked to a login, by their branch access · not admins"
            />
          )}
          <p className="px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Groups</p>
          {lk.groups.map((g) => <PickItem key={g._id} disabled={has("GROUP", g._id)} onClick={() => add({ type: "GROUP", refId: g._id })} label={g.name} hint={g.type === "WHATSAPP_GROUP" ? "WhatsApp group" : `${(g.members || []).length} people`} />)}
          <p className="px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">People</p>
          {lk.contacts.map((c) => <PickItem key={c._id} disabled={has("CONTACT", c._id)} onClick={() => add({ type: "CONTACT", refId: c._id })} label={c.name} hint={c.designation} />)}
          <div className="flex gap-1 border-t border-slate-100 p-2">
            <input className={`${inputCls} py-1.5 text-xs`} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Or type an email / number" />
            <button type="button" className={btnGhost} disabled={!typed.trim()} onClick={() => { add({ type: "ADDRESS", address: typed.trim() }); setTyped(""); }}>Add</button>
          </div>
        </div>
      )}
    </div>
  );
};

const PickItem = ({ label, hint, onClick, disabled }) => (
  <button type="button" disabled={disabled} onClick={onClick} className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-50 disabled:opacity-40">
    <span className="text-slate-800">{label}</span>
    {hint && <span className="text-xs text-slate-400">{hint}</span>}
  </button>
);

/* ─── One channel inside a step ─────────────────────────────────────────── */
const SendEditor = ({ send, onChange, onRemove, lk, eventKey, allowVendor, allowBranchUsers, manual }) => {
  const templates = lk.templates.filter((t) => t.channel === send.channel && t.eventKey === eventKey);
  return (
    <div className={`rounded-lg border p-3 ${send.enabled ? "border-slate-200 bg-white" : "border-dashed border-slate-300 bg-slate-50 opacity-70"}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <ChannelBadge channel={send.channel} />
        <div className="flex items-center gap-2">
          <Toggle size="sm" checked={send.enabled} onChange={(v) => onChange({ ...send, enabled: v })} label={`${send.channel} in this step`} />
          <button type="button" onClick={onRemove} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Remove channel"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Template">
          <select className={inputCls} value={send.templateId} onChange={(e) => onChange({ ...send, templateId: e.target.value })}>
            <option value="">{templates.length ? "Pick a template…" : "No template for this event + channel"}</option>
            {templates.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
          </select>
        </Field>
        <Field label={manual ? "To (pre-filled in the dialog)" : send.channel === "IN_APP" ? "To (people linked to a login)" : "To"}>
          {/* Vendors have no login, so the bell can't reach them. */}
          <RecipientPicker value={send.to} onChange={(to) => onChange({ ...send, to })} lk={lk} allowVendor={allowVendor && send.channel !== "IN_APP"} allowBranchUsers={allowBranchUsers} />
        </Field>
        {send.channel === "EMAIL" && (
          <Field label="CC" className="md:col-span-2">
            <RecipientPicker value={send.cc} onChange={(cc) => onChange({ ...send, cc })} lk={lk} allowVendor={allowVendor} allowBranchUsers={allowBranchUsers} placeholder="Add CC" />
          </Field>
        )}
      </div>
    </div>
  );
};

/* ─── Rule editor ───────────────────────────────────────────────────────── */
const RuleModal = ({ rule, events, lk, onClose, onSaved }) => {
  const [form, setForm] = useState(() =>
    rule
      ? JSON.parse(JSON.stringify({ ...rule, conditions: { branchIds: [], vendorIds: [], minAmount: null, ...rule.conditions } }))
      : { name: "", eventKey: "", description: "", enabled: true, conditions: { branchIds: [], vendorIds: [], minAmount: null }, steps: [newStep("INITIAL")] }
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const event = events.find((e) => e.key === form.eventKey);
  const manual = event?.kind === "MANUAL";
  const allowVendor = !!event?.allowsVendor;
  const allowBranchUsers = !!event?.allowsBranchUsers;

  const setStep = (i, step) => setForm((f) => ({ ...f, steps: f.steps.map((s, j) => (j === i ? step : s)) }));
  const cumulative = form.steps.reduce((acc, s, i) => [...acc, (acc[i - 1] || 0) + (i === 0 ? 0 : Number(s.afterHours) || 0)], []);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = {
        ...form,
        conditions: { ...form.conditions, minAmount: form.conditions.minAmount === "" ? null : form.conditions.minAmount },
      };
      if (rule?._id) await alertApi(`/rules/${rule._id}`, { method: "PUT", body });
      else await alertApi("/rules", { method: "POST", body });
      toast.success(rule ? "Rule saved" : "Rule created");
      onSaved();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  const toggleId = (field, id) =>
    setForm((f) => {
      const list = f.conditions[field].map(String);
      return { ...f, conditions: { ...f.conditions, [field]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] } };
    });

  return (
    <Modal
      title={rule ? `Edit rule · ${rule.name}` : "New rule"}
      description="On this event, send these steps. Later steps go only while the work is still pending."
      onClose={onClose}
      maxWidth="max-w-5xl"
      footer={
        <>
          <button type="button" className={btnGhost} onClick={onClose}>Cancel</button>
          <button type="button" className={btnPrimary} disabled={busy || !form.eventKey} onClick={submit}>{busy ? "Saving…" : "Save rule"}</button>
        </>
      }
    >
      <ErrorBox>{error}</ErrorBox>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Rule name *"><input className={inputCls} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Quotation approval" /></Field>
        <Field label="Event *" hint={rule ? "A rule's event can't change" : ""}>
          <select
            className={inputCls}
            disabled={!!rule}
            value={form.eventKey}
            onChange={(e) => {
              const ev = events.find((x) => x.key === e.target.value);
              setForm((f) => ({
                ...f,
                eventKey: e.target.value,
                // Templates belong to one event; a new event means picking again.
                steps: (ev?.supportsEscalation ? f.steps : f.steps.slice(0, 1)).map((s) => ({
                  ...s,
                  sends: s.sends.map((x) => ({ ...x, templateId: "" })),
                })),
              }));
            }}
          >
            <option value="">Pick an event…</option>
            {events.map((ev) => <option key={ev.key} value={ev.key}>{ev.group} · {ev.label}{ev.kind === "MANUAL" ? " (manual)" : ""}</option>)}
          </select>
        </Field>
        <Field label="Description" className="md:col-span-2"><input className={inputCls} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></Field>
      </div>

      {event && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          {manual
            ? "Manual rule — it never sends by itself. It fills the send dialog on the record's screen; the person there decides."
            : event.supportsEscalation
              ? <>Counts as <strong>pending {event.pendingLabel}</strong>. Reminders and escalations stop the moment it is done.</>
              : "This event has nothing to wait on, so it sends one message only."}
        </div>
      )}

      {event && !manual && (
        <details className="mt-4 rounded-lg border border-slate-200 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-800">
            Conditions (optional) — {[form.conditions.branchIds.length && `${form.conditions.branchIds.length} branch`, form.conditions.vendorIds.length && `${form.conditions.vendorIds.length} vendor`, form.conditions.minAmount && `≥ ₹${form.conditions.minAmount}`].filter(Boolean).join(", ") || "every record"}
          </summary>
          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Minimum amount (₹)">
              <input type="number" min="0" className={inputCls} value={form.conditions.minAmount ?? ""} onChange={(e) => setForm((f) => ({ ...f, conditions: { ...f.conditions, minAmount: e.target.value } }))} />
            </Field>
            <Field label="Only these branches" hint={event.recordType === "Quotation" ? "Quotations have no branch — leave empty" : ""}>
              <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-200 p-1">
                {lk.branches.map((b) => (
                  <label key={b._id} className="flex items-center gap-2 px-2 py-1 text-sm"><input type="checkbox" className="accent-indigo-600" checked={form.conditions.branchIds.map(String).includes(b._id)} onChange={() => toggleId("branchIds", b._id)} />{b.name}</label>
                ))}
              </div>
            </Field>
            <Field label="Only these vendors">
              <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-200 p-1">
                {lk.vendors.map((v) => (
                  <label key={v._id} className="flex items-center gap-2 px-2 py-1 text-sm"><input type="checkbox" className="accent-indigo-600" checked={form.conditions.vendorIds.map(String).includes(v._id)} onChange={() => toggleId("vendorIds", v._id)} />{v.name}</label>
                ))}
              </div>
            </Field>
          </div>
        </details>
      )}

      {event && (
        <div className="mt-5 space-y-2">
          {form.steps.map((step, i) => (
            <React.Fragment key={step._id || `new-${i}`}>
              {i > 0 && (
                <div className="flex items-center gap-2 pl-4 text-xs text-slate-500">
                  <ArrowDown className="h-4 w-4" />
                  still pending after
                  <input type="number" min="1" className="w-20 rounded-md border border-slate-200 px-2 py-1 text-xs" value={step.afterHours} onChange={(e) => setStep(i, { ...step, afterHours: e.target.value })} />
                  hours <span className="text-slate-400">· {cumulative[i]} h after the event</span>
                </div>
              )}
              <div className={`rounded-xl border p-4 ${step.enabled ? "border-slate-200 bg-slate-50/60" : "border-dashed border-slate-300 bg-slate-50 opacity-70"}`}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {i === 0 ? (
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${STEP_TONE.INITIAL}`}>{STEP_LABEL.INITIAL} · at once</span>
                    ) : (
                      <select className={`rounded-full border-0 px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${STEP_TONE[step.type]}`} value={step.type} onChange={(e) => setStep(i, { ...step, type: e.target.value })}>
                        <option value="REMINDER">Reminder</option>
                        <option value="ESCALATION">Escalation</option>
                      </select>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {i > 0 && <Toggle size="sm" checked={step.enabled} onChange={(v) => setStep(i, { ...step, enabled: v })} label="Step on/off" />}
                    {i > 0 && (
                      <button type="button" title="Remove step" onClick={() => setForm((f) => ({ ...f, steps: f.steps.filter((_, j) => j !== i) }))} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  {step.sends.map((send, k) => (
                    <SendEditor
                      key={send._id || `${send.channel}-${k}`}
                      send={send}
                      lk={lk}
                      eventKey={form.eventKey}
                      allowVendor={allowVendor}
                      allowBranchUsers={allowBranchUsers}
                      manual={manual}
                      onChange={(s) => setStep(i, { ...step, sends: step.sends.map((x, j) => (j === k ? s : x)) })}
                      onRemove={() => setStep(i, { ...step, sends: step.sends.filter((_, j) => j !== k) })}
                    />
                  ))}
                  <div className="flex gap-2">
                    {["WHATSAPP", "EMAIL", "IN_APP"].filter((c) => !step.sends.some((s) => s.channel === c)).map((c) => (
                      <button key={c} type="button" className="text-xs font-semibold text-indigo-600 hover:underline" onClick={() => setStep(i, { ...step, sends: [...step.sends, newSend(c)] })}>
                        + {c === "EMAIL" ? "Email" : c === "IN_APP" ? "In-App" : "WhatsApp"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </React.Fragment>
          ))}

          {event.supportsEscalation && !manual && (
            <div className="flex gap-2 pt-2">
              <button type="button" className={btnGhost} onClick={() => setForm((f) => ({ ...f, steps: [...f.steps, newStep("REMINDER")] }))}><Clock className="h-4 w-4" />Add reminder</button>
              <button type="button" className={btnGhost} onClick={() => setForm((f) => ({ ...f, steps: [...f.steps, { ...newStep("ESCALATION"), afterHours: 24 }] }))}><Bell className="h-4 w-4" />Add escalation</button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

/* ─── Page ──────────────────────────────────────────────────────────────── */
const AlertRules = () => {
  const can = useAlertActions("alert-rules");
  const events = useAlertEvents();
  const lk = useLookups();
  const [rows, setRows] = useState([]);
  const [eventKey, setEventKey] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await alertApi("/rules", { query: { eventKey, limit: 100 } });
      setRows(r.data || []);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [eventKey]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const evOf = (k) => events.find((e) => e.key === k);
  const groups = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => {
      const g = evOf(r.eventKey)?.group || "Other";
      if (!m.has(g)) m.set(g, []);
      m.get(g).push(r);
    });
    return [...m.entries()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, events]);

  const toggle = async (rule, enabled) => {
    try {
      await alertApi(`/rules/${rule._id}/enabled`, { method: "PATCH", body: { enabled } });
      toast.success(`${rule.name} switched ${enabled ? "ON" : "OFF"}`);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const remove = async () => {
    try {
      await alertApi(`/rules/${removing._id}`, { method: "DELETE" });
      toast.success("Rule removed");
      setRemoving(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <AlertsShell
      title="Rules"
      description="Which event sends what, to whom — and who hears about it next while the work is still pending."
      actions={can("CREATE") && events.length > 0 && (
        <button type="button" className={btnPrimary} onClick={() => setEditing({ item: null })}><Plus className="h-4 w-4" />New rule</button>
      )}
    >
      <div className="mb-4">
        <select className={`${inputCls} max-w-sm`} value={eventKey} onChange={(e) => setEventKey(e.target.value)}>
          <option value="">All events</option>
          {events.map((ev) => <option key={ev.key} value={ev.key}>{ev.group} · {ev.label}</option>)}
        </select>
      </div>
      <ErrorBox>{error}</ErrorBox>
      {!loading && rows.length === 0 ? (
        <Empty title="No rules" message="A rule ties an event to its messages: who gets the first one, and who is reminded or escalated to while it waits." />
      ) : (
        <div className="space-y-6">
          {groups.map(([group, list]) => (
            <div key={group}>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">{group}</p>
              <div className="space-y-3">
                {list.map((rule) => {
                  let hours = 0;
                  return (
                    <div key={rule._id} className={`${cardCls} p-4 ${rule.enabled ? "" : "opacity-60"}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                            {rule.kind === "MANUAL" && <Hand className="h-4 w-4 text-slate-400" title="Manual" />}
                            {rule.name}
                          </p>
                          <p className="text-xs text-slate-500">{evOf(rule.eventKey)?.label || rule.eventKey}{rule.description ? ` · ${rule.description}` : ""}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {can("UPDATE") && <button type="button" title="Edit" onClick={() => setEditing({ item: rule })} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600"><Pencil className="h-4 w-4" /></button>}
                          {can("DELETE") && <button type="button" title="Remove" onClick={() => setRemoving(rule)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>}
                          <Toggle checked={rule.enabled} disabled={!can("UPDATE")} onChange={(v) => toggle(rule, v)} label="Rule on/off" />
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-stretch gap-2">
                        {rule.steps.map((s, i) => {
                          hours += i === 0 ? 0 : s.afterHours;
                          return (
                            <div key={s._id || i} className={`min-w-40 rounded-lg px-3 py-2 ring-1 ring-inset ${s.enabled ? STEP_TONE[s.type] : "bg-slate-50 text-slate-400 ring-slate-200 line-through"}`}>
                              <p className="text-[11px] font-bold uppercase tracking-wide">{i === 0 ? "At once" : `+${hours} h`} · {STEP_LABEL[s.type]}</p>
                              {s.sends.map((x) => (
                                <p key={x._id || x.channel} className={`mt-1 text-xs ${x.enabled ? "" : "line-through opacity-60"}`}>
                                  {x.channel === "EMAIL" ? "Email" : x.channel === "IN_APP" ? "In-App" : "WA"} → {x.to.map((r) => recipientLabel(r, lk)).join(", ") || "from the dialog"}
                                </p>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && events.length > 0 && (
        <RuleModal rule={editing.item} events={events} lk={lk} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}
      {removing && (
        <ConfirmModal title={`Remove "${removing.name}"?`} message="Its running escalations stop as well." confirmLabel="Remove" danger onConfirm={remove} onClose={() => setRemoving(null)} />
      )}
    </AlertsShell>
  );
};

export default AlertRules;
