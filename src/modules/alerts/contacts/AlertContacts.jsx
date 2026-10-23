"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Plus, Pencil, Trash2, Search, MessageCircle, Phone, Mail, Link2, Users, User } from "lucide-react";
import Pagination from "@/shared/ui/pagination/Pagination";
import { searchHrmsUsers } from "@/modules/accessControl/hrmsDirectory";
import { alertApi } from "../shared/alertApi";
import {
  AlertsShell, Modal, Field, ErrorBox, Empty, ConfirmModal, inputCls, th, td, btnPrimary, btnGhost, useAlertActions,
} from "../shared/AlertUI";

const EMPTY_CONTACT = { name: "", type: "INTERNAL", designation: "", phone: "", whatsappNumber: "", email: "", userId: "", note: "" };
const EMPTY_GROUP = { name: "", type: "LIST", description: "", members: [], whatsappGroupId: "", whatsappGroupName: "" };

/* ─── HRMS link ─────────────────────────────────────────────────────────── */
const HrmsLink = ({ value, onPick, onClear }) => {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [err, setErr] = useState(null);
  // Results only count for a query of 2+ letters; shorter ones show nothing.
  const shown = q.trim().length >= 2 ? results : [];
  useEffect(() => {
    if (q.trim().length < 2) return undefined;
    const t = setTimeout(async () => {
      try {
        setResults(await searchHrmsUsers(q.trim()));
        setErr(null);
      } catch (e) {
        setErr(e.message);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-800 ring-1 ring-inset ring-indigo-200">
        <span className="inline-flex items-center gap-1.5"><Link2 className="h-4 w-4" />Linked to HRMS user</span>
        <button type="button" className="text-xs font-semibold hover:underline" onClick={onClear}>Unlink</button>
      </div>
    );
  }
  return (
    <div className="relative">
      <input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search HRMS user to link (optional)…" />
      {err && <p className="mt-1 text-xs text-amber-700">HRMS search unavailable: {err}</p>}
      {shown.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {shown.map((u) => (
            <li key={u.id}>
              <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => { onPick(u); setQ(""); setResults([]); }}>
                <span className="font-medium text-slate-900">{u.label}</span>
                <span className="ml-2 text-xs text-slate-500">{u.description}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/* ─── Contact form ──────────────────────────────────────────────────────── */
const ContactModal = ({ contact, onClose, onSaved }) => {
  const [form, setForm] = useState(contact ? { ...EMPTY_CONTACT, ...contact, userId: contact.userId || "" } : EMPTY_CONTACT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = { ...form, userId: form.userId || null };
      if (contact?._id) await alertApi(`/contacts/${contact._id}`, { method: "PUT", body });
      else await alertApi("/contacts", { method: "POST", body });
      toast.success(contact ? "Contact updated" : "Contact added");
      onSaved();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Modal
      title={contact ? `Edit ${contact.name}` : "New contact"}
      description="A person alerts can be sent to."
      onClose={onClose}
      maxWidth="max-w-2xl"
      footer={
        <>
          <button type="button" className={btnGhost} onClick={onClose}>Cancel</button>
          <button type="button" className={btnPrimary} disabled={busy} onClick={submit}>{busy ? "Saving…" : "Save contact"}</button>
        </>
      }
    >
      <ErrorBox>{error}</ErrorBox>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="HRMS user" className="sm:col-span-2" hint="Linking lets 'Record creator' find this person's WhatsApp number, and the website bell (later) reach them.">
          <HrmsLink
            value={form.userId}
            onPick={(u) => setForm((f) => ({ ...f, userId: u.id, name: f.name || u.label, email: f.email || (u.description.split(" · ").find((x) => x.includes("@")) || "") }))}
            onClear={() => setForm((f) => ({ ...f, userId: "" }))}
          />
        </Field>
        <Field label="Name *"><input className={inputCls} value={form.name} onChange={set("name")} /></Field>
        <Field label="Designation"><input className={inputCls} value={form.designation} onChange={set("designation")} placeholder="Purchase Head" /></Field>
        <Field label="Phone" hint="From HRMS — may be a calling-only line">
          <input className={inputCls} value={form.phone} onChange={set("phone")} placeholder="9876543210" />
        </Field>
        <Field label="WhatsApp number" hint="Used for WhatsApp. Empty = the phone above">
          <input className={inputCls} value={form.whatsappNumber} onChange={set("whatsappNumber")} placeholder="9876543210" />
        </Field>
        <Field label="Email"><input className={inputCls} value={form.email} onChange={set("email")} placeholder="name@company.com" /></Field>
        <Field label="Type">
          <select className={inputCls} value={form.type} onChange={set("type")}>
            <option value="INTERNAL">Internal (our team)</option>
            <option value="EXTERNAL">External</option>
          </select>
        </Field>
        <Field label="Note" className="sm:col-span-2"><input className={inputCls} value={form.note} onChange={set("note")} /></Field>
      </div>
    </Modal>
  );
};

/* ─── Group form ────────────────────────────────────────────────────────── */
const GroupModal = ({ group, onClose, onSaved }) => {
  const [form, setForm] = useState(
    group ? { ...EMPTY_GROUP, ...group, members: (group.members || []).map((m) => m._id || m) } : EMPTY_GROUP
  );
  const [contacts, setContacts] = useState([]);
  const [waGroups, setWaGroups] = useState(null);
  const [waError, setWaError] = useState(null);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    alertApi("/contacts", { query: { limit: 100 } }).then((r) => setContacts(r.data || [])).catch(() => {});
  }, []);
  useEffect(() => {
    if (form.type !== "WHATSAPP_GROUP" || waGroups) return;
    alertApi("/whatsapp-groups")
      .then((r) => setWaGroups(r.data || []))
      .catch((e) => { setWaGroups([]); setWaError(e.message); });
  }, [form.type, waGroups]);

  const shown = contacts.filter((c) => !filter || c.name.toLowerCase().includes(filter.toLowerCase()));
  const toggleMember = (id) =>
    setForm((f) => ({ ...f, members: f.members.includes(id) ? f.members.filter((m) => m !== id) : [...f.members, id] }));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = { ...form };
      if (group?._id) await alertApi(`/groups/${group._id}`, { method: "PUT", body });
      else await alertApi("/groups", { method: "POST", body });
      toast.success(group ? "Group updated" : "Group added");
      onSaved();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Modal
      title={group ? `Edit ${group.name}` : "New group"}
      onClose={onClose}
      maxWidth="max-w-2xl"
      footer={
        <>
          <button type="button" className={btnGhost} onClick={onClose}>Cancel</button>
          <button type="button" className={btnPrimary} disabled={busy} onClick={submit}>{busy ? "Saving…" : "Save group"}</button>
        </>
      }
    >
      <ErrorBox>{error}</ErrorBox>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name *"><input className={inputCls} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Purchase Team" /></Field>
        <Field label="Type">
          <select className={inputCls} value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
            <option value="LIST">List of people — each gets their own message</option>
            <option value="WHATSAPP_GROUP">WhatsApp group — one message in the group</option>
          </select>
        </Field>
        <Field label="Description" className="sm:col-span-2">
          <input className={inputCls} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        </Field>

        {form.type === "WHATSAPP_GROUP" && (
          <Field label="WhatsApp group *" className="sm:col-span-2" hint="Groups the chatflow API key is allowed to post to.">
            {waError ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">{waError}</p>
            ) : (
              <select
                className={inputCls}
                value={form.whatsappGroupId}
                onChange={(e) => {
                  const g = (waGroups || []).find((x) => x.id === e.target.value);
                  setForm((f) => ({ ...f, whatsappGroupId: e.target.value, whatsappGroupName: g?.name || "" }));
                }}
              >
                <option value="">{waGroups ? "Pick a group…" : "Loading…"}</option>
                {form.whatsappGroupId && !(waGroups || []).some((g) => g.id === form.whatsappGroupId) && (
                  <option value={form.whatsappGroupId}>{form.whatsappGroupName || form.whatsappGroupId}</option>
                )}
                {(waGroups || []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            )}
          </Field>
        )}

        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600">
            Members {form.type === "LIST" ? "*" : "(used for Email — a WhatsApp group has no email)"} · {form.members.length} picked
          </label>
          <input className={`${inputCls} mb-2`} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter contacts…" />
          <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
            {shown.length === 0 && <p className="px-3 py-4 text-sm text-slate-400">No contacts — add some first.</p>}
            {shown.map((c) => (
              <label key={c._id} className="flex cursor-pointer items-center gap-3 border-b border-slate-100 px-3 py-2 text-sm last:border-0 hover:bg-slate-50">
                <input type="checkbox" className="h-4 w-4 accent-indigo-600" checked={form.members.includes(c._id)} onChange={() => toggleMember(c._id)} />
                <span className="font-medium text-slate-900">{c.name}</span>
                <span className="text-xs text-slate-500">{[c.designation, c.whatsappNumber || c.phone, c.email].filter(Boolean).join(" · ")}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
};

/* ─── Page ──────────────────────────────────────────────────────────────── */
const AlertContacts = () => {
  const can = useAlertActions("alert-contacts");
  const [view, setView] = useState("contacts");
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [search, setSearch] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // { item } | { item: null } for new
  const [removing, setRemoving] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await alertApi(view === "contacts" ? "/contacts" : "/groups", { query: { page, limit, search } });
      setRows(r.data || []);
      setTotal(r.pagination?.total || 0);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [view, page, limit, search]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const remove = async () => {
    try {
      await alertApi(`/${view === "contacts" ? "contacts" : "groups"}/${removing._id}`, { method: "DELETE" });
      toast.success("Removed");
      setRemoving(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const columns = useMemo(() => (view === "contacts" ? ["Name", "WhatsApp", "Phone", "Email", "Type", ""] : ["Group", "Type", "Members / WhatsApp group", ""]), [view]);

  return (
    <AlertsShell
      title="Contacts & Groups"
      description="The people alerts go to. A contact keeps a separate WhatsApp number, because the HRMS phone is often a calling-only line."
      actions={
        can("CREATE") && (
          <button type="button" className={btnPrimary} onClick={() => setEditing({ item: null })}>
            <Plus className="h-4 w-4" />
            {view === "contacts" ? "New contact" : "New group"}
          </button>
        )
      }
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg bg-slate-100 p-1">
          {[["contacts", "Contacts", User], ["groups", "Groups", Users]].map(([k, label, Icon]) => (
            <button
              key={k}
              type="button"
              onClick={() => { setView(k); setPage(1); setSearch(""); }}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${view === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
            >
              <Icon className="h-4 w-4" />{label}
            </button>
          ))}
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input className={`${inputCls} pl-9`} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search…" />
        </div>
      </div>

      <ErrorBox>{error}</ErrorBox>
      {!loading && rows.length === 0 ? (
        <Empty
          title={view === "contacts" ? "No contacts yet" : "No groups yet"}
          message={view === "contacts" ? "Add the people who approve, review and get escalations." : "Group contacts into teams like Purchase Team or Accounts Team, or point one at a WhatsApp group."}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50"><tr>{columns.map((c) => <th key={c} className={th}>{c}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) =>
                view === "contacts" ? (
                  <tr key={r._id} className="hover:bg-slate-50/60">
                    <td className={td}>
                      <p className="font-medium text-slate-900">{r.name}{r.userId && <Link2 className="ml-1 inline h-3.5 w-3.5 text-indigo-500" />}</p>
                      <p className="text-xs text-slate-500">{r.designation}</p>
                    </td>
                    <td className={td}>
                      {r.whatsappNumber ? (
                        <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5 text-emerald-600" />{r.whatsappNumber}</span>
                      ) : r.phone ? (
                        <span className="text-xs text-slate-400">uses phone</span>
                      ) : "—"}
                    </td>
                    <td className={td}>{r.phone ? <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5 text-slate-400" />{r.phone}</span> : "—"}</td>
                    <td className={td}>{r.email ? <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5 text-slate-400" />{r.email}</span> : "—"}</td>
                    <td className={td}><span className="text-xs">{r.type === "EXTERNAL" ? "External" : "Internal"}</span></td>
                    <RowActions can={can} onEdit={() => setEditing({ item: r })} onRemove={() => setRemoving(r)} />
                  </tr>
                ) : (
                  <tr key={r._id} className="hover:bg-slate-50/60">
                    <td className={td}><p className="font-medium text-slate-900">{r.name}</p><p className="text-xs text-slate-500">{r.description}</p></td>
                    <td className={td}><span className="text-xs">{r.type === "WHATSAPP_GROUP" ? "WhatsApp group" : "List"}</span></td>
                    <td className={td}>
                      {r.type === "WHATSAPP_GROUP" && (
                        <p className="inline-flex items-center gap-1 text-emerald-700"><MessageCircle className="h-3.5 w-3.5" />{r.whatsappGroupName || r.whatsappGroupId}</p>
                      )}
                      <p className="text-xs text-slate-500">{(r.members || []).map((m) => m.name).join(", ") || (r.type === "LIST" ? "No members" : "")}</p>
                    </td>
                    <RowActions can={can} onEdit={() => setEditing({ item: r })} onRemove={() => setRemoving(r)} />
                  </tr>
                )
              )}
            </tbody>
          </table>
          <div className="border-t border-slate-100 px-4 py-3">
            <Pagination currentPage={page} totalItems={total} itemsPerPage={limit} onPageChange={setPage} onItemsPerPageChange={(n) => { setLimit(n); setPage(1); }} />
          </div>
        </div>
      )}

      {editing && view === "contacts" && (
        <ContactModal contact={editing.item} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}
      {editing && view === "groups" && (
        <GroupModal group={editing.item} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}
      {removing && (
        <ConfirmModal
          title={`Remove ${removing.name}?`}
          message={view === "contacts" ? "They are taken out of every group too. Rules that name them directly will skip them." : "Rules that send to this group will skip it."}
          confirmLabel="Remove"
          danger
          onConfirm={remove}
          onClose={() => setRemoving(null)}
        />
      )}
    </AlertsShell>
  );
};

const RowActions = ({ can, onEdit, onRemove }) => (
  <td className={`${td} text-right`}>
    <div className="inline-flex gap-1">
      {can("UPDATE") && (
        <button type="button" title="Edit" onClick={onEdit} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600"><Pencil className="h-4 w-4" /></button>
      )}
      {can("DELETE") && (
        <button type="button" title="Remove" onClick={onRemove} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
      )}
    </div>
  </td>
);

export default AlertContacts;
