"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Plus, Pencil, Trash2, Send, Paperclip, Search } from "lucide-react";
import { alertApi } from "../shared/alertApi";
import {
  AlertsShell, Modal, Field, ErrorBox, Empty, ConfirmModal, ChannelBadge, inputCls, btnPrimary, btnGhost, cardCls, useAlertActions,
} from "../shared/AlertUI";

export const useAlertEvents = () => {
  const [events, setEvents] = useState([]);
  useEffect(() => {
    alertApi("/events").then((r) => setEvents(r.data || [])).catch(() => {});
  }, []);
  return events;
};

/* WhatsApp formatting rendered for the preview bubble: *bold*, _italic_. */
const WhatsAppPreview = ({ text }) => {
  const html = String(text || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*(\S[^*\n]*?)\*/g, "<strong>$1</strong>")
    .replace(/_(\S[^_\n]*?)_/g, "<em>$1</em>")
    .replace(/\n/g, "<br>");
  return (
    <div className="rounded-xl bg-[#e5ddd5] p-4">
      <div className="ml-auto max-w-[85%] rounded-lg rounded-tr-none bg-[#dcf8c6] px-3 py-2 text-sm text-slate-900 shadow-sm" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
};

const TemplateModal = ({ template, events, onClose, onSaved, canTest }) => {
  const [form, setForm] = useState(
    template || { name: "", channel: "WHATSAPP", eventKey: events[0]?.key || "", subject: "", body: "", attachDocument: false }
  );
  const [lastPreview, setPreview] = useState(null);
  // An empty message has nothing to preview, whatever the last answer was.
  const preview = form.eventKey && form.body ? lastPreview : null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [testTo, setTestTo] = useState("");
  const bodyRef = useRef(null);
  const event = events.find((e) => e.key === form.eventKey);
  const isEmail = form.channel === "EMAIL";
  const isBell = form.channel === "IN_APP";

  useEffect(() => {
    if (!form.eventKey || !form.body) return undefined;
    const t = setTimeout(() => {
      alertApi("/templates/preview", { method: "POST", body: form }).then((r) => setPreview(r.data)).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [form]);

  const insert = (key) => {
    const token = `{{${key}}}`;
    const el = bodyRef.current;
    if (!el) return setForm((f) => ({ ...f, body: `${f.body}${token}` }));
    const start = el.selectionStart ?? form.body.length;
    const end = el.selectionEnd ?? start;
    const body = form.body.slice(0, start) + token + form.body.slice(end);
    setForm((f) => ({ ...f, body }));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (template?._id) await alertApi(`/templates/${template._id}`, { method: "PUT", body: form });
      else await alertApi("/templates", { method: "POST", body: form });
      toast.success(template ? "Template saved" : "Template created");
      onSaved();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  const sendTest = async () => {
    try {
      await alertApi(`/templates/${template._id}/test`, { method: "POST", body: { to: testTo } });
      toast.success("Test queued — check Message Log");
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <Modal
      title={template ? `Edit template` : "New template"}
      description="What a message says. Variables are filled from the record when it is sent."
      onClose={onClose}
      maxWidth="max-w-6xl"
      footer={
        <>
          <button type="button" className={btnGhost} onClick={onClose}>Cancel</button>
          <button type="button" className={btnPrimary} disabled={busy} onClick={submit}>{busy ? "Saving…" : "Save template"}</button>
        </>
      }
    >
      <ErrorBox>{error}</ErrorBox>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Name *" className="sm:col-span-2"><input className={inputCls} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Quotation approval pending" /></Field>
            <Field label="Channel">
              <select className={inputCls} value={form.channel} onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="EMAIL">Email</option>
                <option value="IN_APP">In-App (website bell)</option>
              </select>
            </Field>
            <Field label="Event" hint="Decides which variables exist">
              <select className={inputCls} value={form.eventKey} onChange={(e) => setForm((f) => ({ ...f, eventKey: e.target.value }))}>
                {events.map((ev) => <option key={ev.key} value={ev.key}>{ev.group} · {ev.label}</option>)}
              </select>
            </Field>
          </div>
          {(isEmail || isBell) && (
            <Field label={isBell ? "Title *" : "Subject *"} hint={isBell ? "The bold first line in the bell" : ""}>
              <input className={inputCls} value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} />
            </Field>
          )}
          <Field label="Message *" hint={isEmail ? "HTML allowed. Plain line breaks become <br>." : isBell ? "Plain text. Clicking the notification opens the record." : "WhatsApp: *bold*, _italic_. Line breaks stay as typed."}>
            <textarea ref={bodyRef} rows={12} className={`${inputCls} font-mono text-[13px]`} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} />
          </Field>
          {event?.hasDocument && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" className="h-4 w-4 accent-indigo-600" checked={!!form.attachDocument} onChange={(e) => setForm((f) => ({ ...f, attachDocument: e.target.checked }))} />
              <Paperclip className="h-4 w-4 text-slate-400" />Attach the document (PO PDF)
            </label>
          )}
          {template?._id && canTest && !isBell && (
            <div className="flex gap-2 rounded-lg bg-slate-50 p-3">
              <input className={inputCls} value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder={isEmail ? "Send a test to email…" : "Send a test to WhatsApp number…"} />
              <button type="button" className={btnGhost} disabled={!testTo} onClick={sendTest}><Send className="h-4 w-4" />Send Test</button>
            </div>
          )}
        </div>

        <div className="space-y-4 lg:col-span-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-600">Variables — click to insert</p>
            <div className="flex flex-wrap gap-1.5">
              {(event?.variables || []).map((v) => (
                <button key={v.key} type="button" title={`${v.label} — e.g. ${v.sample}`} onClick={() => insert(v.key)}
                  className="rounded-md bg-indigo-50 px-2 py-1 font-mono text-[11px] text-indigo-700 ring-1 ring-inset ring-indigo-200 hover:bg-indigo-100">
                  {`{{${v.key}}}`}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-600">Preview (sample data)</p>
            {preview?.unknownVariables?.length > 0 && (
              <p className="mb-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">Unknown: {preview.unknownVariables.map((u) => `{{${u}}}`).join(", ")}</p>
            )}
            {!preview ? (
              <p className="text-sm text-slate-400">Type a message to see it here.</p>
            ) : isBell ? (
              <div className="rounded-xl bg-slate-800 p-4">
                <div className="rounded-lg bg-white px-4 py-3 shadow">
                  <p className="text-sm font-semibold text-slate-900">{preview.subject}</p>
                  <p className="mt-0.5 whitespace-pre-line text-xs text-slate-500">{preview.body}</p>
                </div>
              </div>
            ) : isEmail ? (
              <div className="rounded-xl border border-slate-200">
                <p className="border-b border-slate-100 px-4 py-2 text-sm font-semibold text-slate-900">{preview.subject}</p>
                <div className="prose prose-sm max-w-none px-4 py-3 text-sm" dangerouslySetInnerHTML={{ __html: preview.body }} />
              </div>
            ) : (
              <WhatsAppPreview text={preview.body} />
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

const AlertTemplates = () => {
  const can = useAlertActions("alert-templates");
  const events = useAlertEvents();
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ channel: "", eventKey: "", search: "" });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await alertApi("/templates", { query: { ...filters, limit: 100 } });
      setRows(r.data || []);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const byEvent = useMemo(() => {
    const map = new Map();
    rows.forEach((t) => {
      if (!map.has(t.eventKey)) map.set(t.eventKey, []);
      map.get(t.eventKey).push(t);
    });
    return [...map.entries()];
  }, [rows]);
  const eventLabel = (k) => events.find((e) => e.key === k);

  const remove = async () => {
    try {
      await alertApi(`/templates/${removing._id}`, { method: "DELETE" });
      toast.success("Template removed");
      setRemoving(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <AlertsShell
      title="Templates"
      description="What each message says, per channel and event. Rules pick from these."
      actions={can("CREATE") && events.length > 0 && (
        <button type="button" className={btnPrimary} onClick={() => setEditing({ item: null })}><Plus className="h-4 w-4" />New template</button>
      )}
    >
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input className={`${inputCls} pl-9`} value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} placeholder="Search name…" />
        </div>
        <select className={`${inputCls} max-w-40`} value={filters.channel} onChange={(e) => setFilters((f) => ({ ...f, channel: e.target.value }))}>
          <option value="">All channels</option><option value="WHATSAPP">WhatsApp</option><option value="EMAIL">Email</option><option value="IN_APP">In-App</option>
        </select>
        <select className={`${inputCls} max-w-xs`} value={filters.eventKey} onChange={(e) => setFilters((f) => ({ ...f, eventKey: e.target.value }))}>
          <option value="">All events</option>
          {events.map((ev) => <option key={ev.key} value={ev.key}>{ev.group} · {ev.label}</option>)}
        </select>
      </div>

      <ErrorBox>{error}</ErrorBox>
      {!loading && rows.length === 0 ? (
        <Empty title="No templates" message="Create one per event and channel — for example a first message, a reminder and an escalation." />
      ) : (
        <div className="space-y-5">
          {byEvent.map(([key, list]) => (
            <div key={key}>
              <p className="mb-2 text-sm font-semibold text-slate-800">
                {eventLabel(key)?.group} · {eventLabel(key)?.label || key}
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {list.map((t) => (
                  <div key={t._id} className={`${cardCls} flex flex-col gap-2 p-4`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                      <ChannelBadge channel={t.channel} />
                    </div>
                    {t.subject && <p className="truncate text-xs text-slate-500">Subject: {t.subject}</p>}
                    <p className="line-clamp-3 whitespace-pre-line text-xs text-slate-500">{t.body.replace(/<[^>]+>/g, " ")}</p>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      {t.attachDocument ? <span className="inline-flex items-center gap-1 text-[11px] text-slate-500"><Paperclip className="h-3 w-3" />PDF</span> : <span />}
                      <div className="flex gap-1">
                        {can("UPDATE") && <button type="button" title="Edit" onClick={() => setEditing({ item: t })} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600"><Pencil className="h-4 w-4" /></button>}
                        {can("DELETE") && <button type="button" title="Remove" onClick={() => setRemoving(t)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && events.length > 0 && (
        <TemplateModal template={editing.item} events={events} canTest={can("TEST")} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}
      {removing && (
        <ConfirmModal title={`Remove "${removing.name}"?`} message="A template that a rule still uses cannot be removed." confirmLabel="Remove" danger onConfirm={remove} onClose={() => setRemoving(null)} />
      )}
    </AlertsShell>
  );
};

export default AlertTemplates;
