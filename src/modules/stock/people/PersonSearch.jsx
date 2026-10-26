"use client";

import React, { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Search, UserPlus, Loader2, FlaskConical, AlertTriangle, Phone, Mail, X } from "lucide-react";
import { Modal, inputCls } from "@/modules/stock/shared/StockSharedUI";
import { searchPeople, selectPerson, createPerson } from "./peopleApi";

/*
  People Directory pieces, shared by Opening Issued Stock and Employee Items:
    PersonSearch     one box → employees and subscribers; "Add manually" when not found
    PersonCard       the chosen person, with every detail we have
    AddPersonModal   someone the people list does not have (yet)
*/

const KIND_LABEL = { EMPLOYEE: "Employee", SUBSCRIBER: "Subscriber" };
const SERVICE_TYPES = ["Broadband", "Fiber", "BPL"];

export const KindBadge = ({ kind }) => (
  <span
    className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
      kind === "EMPLOYEE" ? "bg-indigo-50 text-indigo-700 ring-indigo-200" : "bg-teal-50 text-teal-700 ring-teal-200"
    }`}
  >
    {KIND_LABEL[kind] || kind}
  </span>
);

const initials = (name) =>
  String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "?";

const Avatar = ({ person, size = "h-9 w-9 text-xs" }) => (
  <span
    className={`inline-flex ${size} shrink-0 items-center justify-center rounded-full font-bold ${
      person.kind === "EMPLOYEE" ? "bg-indigo-100 text-indigo-700" : "bg-teal-100 text-teal-700"
    }`}
  >
    {initials(person.name || person.username)}
  </span>
);

// The one-line summary under a name.
export const personSummary = (p) => {
  const extra = p.extraFields || {};
  const parts =
    p.kind === "EMPLOYEE"
      ? [p.employeeCode, extra.Department, extra.Designation]
      : [p.orderId, p.username && p.username !== p.name ? `@${p.username}` : "", p.serviceType];
  return parts.filter(Boolean).join(" · ");
};

/* ============================================================= */
/* Search                                                         */
/* ============================================================= */
export const PersonSearch = ({ module, kind = null, onPick, autoFocus = false, placeholder }) => {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState(kind || "");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [picking, setPicking] = useState(null);
  const [adding, setAdding] = useState(false);
  const seq = useRef(0);

  // Below two characters nothing is searched and the panel is hidden. Each
  // answer remembers its query, so an older one is never shown for a newer one.
  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) return;
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchPeople(query, { kind: kind || filter || null, module });
        if (mine === seq.current) setData({ ...res, q: query });
      } catch (err) {
        if (mine === seq.current) setData({ results: [], warning: err.message, q: query });
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q, filter, kind, module]);

  const pick = async (r) => {
    setPicking(r.key);
    try {
      onPick(await selectPerson(r, module));
      setQ("");
      setData(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPicking(null);
    }
  };

  const showPanel = q.trim().length >= 2;
  const current = showPanel && data?.q === q.trim() ? data : null;
  const busy = showPanel && (loading || !current);
  const results = current?.results || [];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            autoFocus={autoFocus}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder || (kind === "EMPLOYEE" ? "Search employee — name, code or phone…" : "Search name, employee code, order ID, username or phone…")}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
          {busy && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />}
        </div>
        {!kind && (
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            {[["", "All"], ["EMPLOYEE", "Employees"], ["SUBSCRIBER", "Subscribers"]].map(([v, l]) => (
              <button
                key={v}
                type="button"
                onClick={() => setFilter(v)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${filter === v ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                {l}
              </button>
            ))}
          </div>
        )}
      </div>

      {data?.provider?.isTest && (
        <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
          <FlaskConical className="h-3 w-3" /> Test people — the real people list is not connected yet
        </p>
      )}

      {showPanel && (
        <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {current?.warning && (
            <p className="flex items-center gap-1.5 border-b border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {current.warning}
            </p>
          )}
          <div className="max-h-80 overflow-y-auto">
            {!current ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">Searching…</p>
            ) : results.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">No one matches “{q.trim()}”</p>
            ) : (
              results.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  disabled={!!picking}
                  onClick={() => pick(r)}
                  className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-2.5 text-left transition last:border-0 hover:bg-indigo-50/60 disabled:opacity-60"
                >
                  <Avatar person={r} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate font-semibold text-slate-900">{r.name || r.username}</span>
                      <KindBadge kind={r.kind} />
                      {r.source === "MANUAL" && <span className="text-[11px] font-medium text-slate-400">added by hand</span>}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500">
                      {personSummary(r)}
                      {r.phone ? ` · ${r.phone}` : ""}
                    </span>
                  </span>
                  {picking === r.key ? <Loader2 className="h-4 w-4 animate-spin text-indigo-500" /> : <span className="text-xs font-semibold text-indigo-600">Choose</span>}
                </button>
              ))
            )}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-2">
            <span className="text-xs text-slate-500">Not in the list?</span>
            <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline">
              <UserPlus className="h-3.5 w-3.5" /> Add manually
            </button>
          </div>
        </div>
      )}
      {!showPanel && (
        <button type="button" onClick={() => setAdding(true)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline">
          <UserPlus className="h-3.5 w-3.5" /> Not in the people list? Add manually
        </button>
      )}

      {adding && (
        <AddPersonModal
          module={module}
          kind={kind || filter || null}
          lockKind={!!kind}
          prefill={q.trim()}
          onClose={() => setAdding(false)}
          onCreated={(p) => {
            setAdding(false);
            setQ("");
            setData(null);
            onPick(p);
          }}
        />
      )}
    </div>
  );
};

/* ============================================================= */
/* The chosen person                                              */
/* ============================================================= */
const Detail = ({ label, value, mono }) =>
  value ? (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`truncate text-sm text-slate-800 ${mono ? "font-mono" : ""}`} title={String(value)}>{String(value)}</p>
    </div>
  ) : null;

export const PersonCard = ({ person, onChange, onClear, compact = false }) => {
  const extra = Object.entries(person.extraFields || {}).filter(([, v]) => v !== "" && v !== null && v !== undefined);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <Avatar person={person} size="h-11 w-11 text-sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-base font-semibold text-slate-900">{person.name || person.username}</p>
            <KindBadge kind={person.kind} />
          </div>
          <p className="mt-0.5 text-xs text-slate-500">{personSummary(person) || "—"}</p>
          {(person.phone || person.email) && (
            <p className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-600">
              {person.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3 text-slate-400" /> {person.phone}</span>}
              {person.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3 text-slate-400" /> {person.email}</span>}
            </p>
          )}
        </div>
        {onChange && (
          <button type="button" onClick={onChange} className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-indigo-300 hover:text-indigo-700">
            Change
          </button>
        )}
        {onClear && (
          <button type="button" onClick={onClear} title="Clear" className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {!compact && (
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-100 pt-3 sm:grid-cols-4">
          {person.kind === "EMPLOYEE" ? (
            <Detail label="Employee code" value={person.employeeCode} mono />
          ) : (
            <>
              <Detail label="Order ID" value={person.orderId} mono />
              <Detail label="Username" value={person.username} />
              <Detail label="Service type" value={person.serviceType} />
            </>
          )}
          {extra.map(([k, v]) => <Detail key={k} label={k} value={v} />)}
        </div>
      )}
    </div>
  );
};

/* ============================================================= */
/* Add manually                                                   */
/* ============================================================= */
const Field = ({ label, required, hint, children }) => (
  <div>
    <label className="text-xs font-semibold text-slate-600">
      {label}
      {required && <span className="text-rose-500"> *</span>}
    </label>
    <div className="mt-1">{children}</div>
    {hint && <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>}
  </div>
);

export const AddPersonModal = ({ module, kind, lockKind = false, prefill = "", onClose, onCreated }) => {
  const [k, setK] = useState(kind || "EMPLOYEE");
  const looksLikeCode = /\d/.test(prefill) && !/\s/.test(prefill);
  const [f, setF] = useState({
    name: looksLikeCode ? "" : prefill,
    employeeCode: looksLikeCode ? prefill : "",
    orderId: looksLikeCode ? prefill : "",
    username: "",
    serviceType: "",
    phone: "",
    email: "",
    department: "",
    designation: "",
    address: "",
  });
  const [busy, setBusy] = useState(false);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const isEmp = k === "EMPLOYEE";
  const ready = isEmp ? f.name.trim() && f.employeeCode.trim() : f.orderId.trim() && (f.name.trim() || f.username.trim()) && f.serviceType.trim();

  const submit = async () => {
    setBusy(true);
    try {
      const extraFields = isEmp ? { Department: f.department, Designation: f.designation } : { Address: f.address };
      const body = isEmp
        ? { kind: k, name: f.name, employeeCode: f.employeeCode, phone: f.phone, email: f.email, extraFields }
        : { kind: k, orderId: f.orderId, name: f.name, username: f.username, serviceType: f.serviceType, phone: f.phone, email: f.email, extraFields };
      const person = await createPerson(body, module);
      toast.success(`${person.name} added to the directory`);
      onCreated(person);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} title="Add a person" maxWidth="max-w-lg">
      <p className="mb-4 text-xs text-slate-500">
        For someone the people list does not have yet. They are saved in the directory, so next time they come up in the search.
      </p>
      {!lockKind && (
        <div className="mb-4 inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
          {["EMPLOYEE", "SUBSCRIBER"].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setK(v)}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${k === v ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              {KIND_LABEL[v]}
            </button>
          ))}
        </div>
      )}

      {isEmp ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" required><input autoFocus value={f.name} onChange={(e) => set({ name: e.target.value })} className={inputCls} /></Field>
          <Field label="Employee code" required><input value={f.employeeCode} onChange={(e) => set({ employeeCode: e.target.value })} className={`${inputCls} font-mono`} /></Field>
          <Field label="Phone"><input value={f.phone} onChange={(e) => set({ phone: e.target.value })} className={inputCls} /></Field>
          <Field label="Email"><input type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} className={inputCls} /></Field>
          <Field label="Department"><input value={f.department} onChange={(e) => set({ department: e.target.value })} className={inputCls} /></Field>
          <Field label="Designation"><input value={f.designation} onChange={(e) => set({ designation: e.target.value })} className={inputCls} /></Field>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Order ID" required><input autoFocus value={f.orderId} onChange={(e) => set({ orderId: e.target.value })} className={`${inputCls} font-mono`} /></Field>
          <Field label="Service type" required>
            <input list="person-service-types" value={f.serviceType} onChange={(e) => set({ serviceType: e.target.value })} placeholder="Broadband, Fiber, BPL…" className={inputCls} />
            <datalist id="person-service-types">{SERVICE_TYPES.map((s) => <option key={s} value={s} />)}</datalist>
          </Field>
          <Field label="Name" hint="Name or username — at least one"><input value={f.name} onChange={(e) => set({ name: e.target.value })} className={inputCls} /></Field>
          <Field label="Username"><input value={f.username} onChange={(e) => set({ username: e.target.value })} className={inputCls} /></Field>
          <Field label="Phone"><input value={f.phone} onChange={(e) => set({ phone: e.target.value })} className={inputCls} /></Field>
          <Field label="Email"><input type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} className={inputCls} /></Field>
          <div className="sm:col-span-2">
            <Field label="Address"><input value={f.address} onChange={(e) => set({ address: e.target.value })} className={inputCls} /></Field>
          </div>
        </div>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
        <button
          type="button"
          disabled={busy || !ready}
          onClick={submit}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <UserPlus className="h-4 w-4" /> {busy ? "Saving…" : `Add ${KIND_LABEL[k].toLowerCase()}`}
        </button>
      </div>
    </Modal>
  );
};
