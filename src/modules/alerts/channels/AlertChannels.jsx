"use client";

import React, { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { CheckCircle2, AlertTriangle, Send, FlaskConical, Clock, RefreshCw, Sunrise } from "lucide-react";
import { alertApi } from "../shared/alertApi";
import {
  AlertsShell, CHANNEL_META, Toggle, Field, ErrorBox, inputCls, cardCls, btnPrimary, btnGhost, useAlertActions,
} from "../shared/AlertUI";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const ChannelCard = ({ ch, canUpdate, canTest, onToggle }) => {
  const meta = CHANNEL_META[ch.channel];
  const Icon = meta.icon;
  const [to, setTo] = useState("");
  const [sending, setSending] = useState(false);
  const isEmail = ch.channel === "EMAIL";
  // The bell is built in: nothing to configure, nothing to test-send.
  const isBell = ch.channel === "IN_APP";

  const sendTest = async () => {
    setSending(true);
    try {
      await alertApi(`/channels/${ch.channel}/test`, { method: "POST", body: { to } });
      toast.success("Test queued — see Message Log for the result");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={`${cardCls} flex flex-col gap-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ring-1 ring-inset ${meta.cls}`}>
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-base font-semibold text-slate-900">{meta.label}</p>
            <p className="text-xs text-slate-500">{isBell ? "Website bell in the header" : `Provider: ${ch.provider || "—"}`}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold ${ch.enabled ? "text-emerald-600" : "text-slate-400"}`}>{ch.enabled ? "ON" : "OFF"}</span>
          <Toggle checked={ch.enabled} disabled={!canUpdate} onChange={(v) => onToggle(ch.channel, v)} label={`${meta.label} master switch`} />
        </div>
      </div>

      <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ring-1 ring-inset ${
        ch.connected ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"
      }`}>
        {ch.connected ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
        <span>{ch.detail}</span>
      </div>

      <p className="text-xs text-slate-500">
        {ch.enabled
          ? `Rules may send ${meta.label}.`
          : `OFF: no ${meta.label} message leaves anywhere in the app. They are logged as Skipped and are not sent later.`}
      </p>

      {!isBell && canTest && (
        <div className="flex gap-2">
          <input
            className={inputCls}
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder={isEmail ? "test@company.com" : "WhatsApp number, e.g. 9876543210"}
          />
          <button type="button" className={btnGhost} disabled={!to || sending} onClick={sendTest}>
            <Send className="h-4 w-4" />
            {sending ? "Sending…" : "Send Test"}
          </button>
        </div>
      )}
    </div>
  );
};

const AlertChannels = () => {
  const can = useAlertActions("alert-channels");
  const canUpdate = can("UPDATE");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [sandbox, setSandbox] = useState({ enabled: true, email: "", phone: "" });
  const [hours, setHours] = useState({ enabled: false, days: [1, 2, 3, 4, 5, 6], start: "09:00", end: "19:00" });
  const [digest, setDigest] = useState({ enabled: false, time: "10:00", lastSentOn: "" });
  const [saving, setSaving] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data: d } = await alertApi("/channels");
      setData(d);
      setSandbox({ enabled: !!d.settings.sandbox?.enabled, email: d.settings.sandbox?.email || "", phone: d.settings.sandbox?.phone || "" });
      setHours({ ...hours, ...d.settings.officeHours });
      setDigest({ enabled: false, time: "10:00", lastSentOn: "", ...d.settings.digest });
      setError(null);
    } catch (e) {
      setError(e.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const save = async (part, body, okText) => {
    setSaving(part);
    try {
      await alertApi("/settings", { method: "PUT", body });
      toast.success(okText);
      await load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(null);
    }
  };

  const sendDigestNow = async () => {
    setSaving("digest-now");
    try {
      const { data: r } = await alertApi("/digest/send", { method: "POST" });
      toast.success(r.people ? `Summary queued for ${r.people} people (${r.items} items) — see Message Log` : "Nothing is pending — no summary to send");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(null);
    }
  };

  const toggleChannel = (channel, enabled) =>
    save("channel", { channels: { [channel]: { enabled } } }, `${CHANNEL_META[channel].label} switched ${enabled ? "ON" : "OFF"}`);

  return (
    <AlertsShell
      title="Channels"
      description="Master switches for every channel, the sandbox used while testing, and the office hours escalations wait for."
      actions={<button type="button" className={btnGhost} onClick={load}><RefreshCw className="h-4 w-4" />Refresh</button>}
    >
      <ErrorBox>{error}</ErrorBox>
      {!data ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {data.channels.map((ch) => (
              <ChannelCard key={ch.channel} ch={ch} canUpdate={canUpdate} canTest={can("TEST")} onToggle={toggleChannel} />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Sandbox */}
            <div className={`${cardCls} ${sandbox.enabled ? "ring-2 ring-amber-300" : ""}`}>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <FlaskConical className="h-5 w-5 text-amber-600" />
                  <div>
                    <p className="text-base font-semibold text-slate-900">Sandbox mode</p>
                    <p className="text-xs text-slate-500">While ON, every message goes to the test address below instead of the real person.</p>
                  </div>
                </div>
                <Toggle checked={sandbox.enabled} disabled={!canUpdate} onChange={(v) => setSandbox((s) => ({ ...s, enabled: v }))} label="Sandbox" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Test email">
                  <input className={inputCls} disabled={!canUpdate} value={sandbox.email} onChange={(e) => setSandbox((s) => ({ ...s, email: e.target.value }))} placeholder="you@company.com" />
                </Field>
                <Field label="Test WhatsApp number" hint="10 digits, or with country code">
                  <input className={inputCls} disabled={!canUpdate} value={sandbox.phone} onChange={(e) => setSandbox((s) => ({ ...s, phone: e.target.value }))} placeholder="9876543210" />
                </Field>
              </div>
              {sandbox.enabled && (!sandbox.email || !sandbox.phone) && (
                <p className="mt-3 text-xs text-amber-700">
                  Without a test {!sandbox.phone ? "WhatsApp number" : "email"}, those messages are logged as Skipped.
                </p>
              )}
              {canUpdate && (
                <div className="mt-4 flex justify-end">
                  <button type="button" className={btnPrimary} disabled={saving === "sandbox"} onClick={() => save("sandbox", { sandbox }, "Sandbox saved")}>
                    {saving === "sandbox" ? "Saving…" : "Save sandbox"}
                  </button>
                </div>
              )}
            </div>

            {/* Office hours */}
            <div className={cardCls}>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-indigo-600" />
                  <div>
                    <p className="text-base font-semibold text-slate-900">Office hours</p>
                    <p className="text-xs text-slate-500">Reminders and escalations due outside these hours wait for the next opening (India time). First messages always go at once.</p>
                  </div>
                </div>
                <Toggle checked={hours.enabled} disabled={!canUpdate} onChange={(v) => setHours((h) => ({ ...h, enabled: v }))} label="Office hours" />
              </div>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {DAYS.map((d, i) => {
                  const on = hours.days.includes(i);
                  return (
                    <button
                      key={d}
                      type="button"
                      disabled={!canUpdate}
                      onClick={() => setHours((h) => ({ ...h, days: on ? h.days.filter((x) => x !== i) : [...h.days, i].sort() }))}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition ${
                        on ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white text-slate-500 ring-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Opens">
                  <input type="time" className={inputCls} disabled={!canUpdate} value={hours.start} onChange={(e) => setHours((h) => ({ ...h, start: e.target.value }))} />
                </Field>
                <Field label="Closes">
                  <input type="time" className={inputCls} disabled={!canUpdate} value={hours.end} onChange={(e) => setHours((h) => ({ ...h, end: e.target.value }))} />
                </Field>
              </div>
              {canUpdate && (
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    className={btnPrimary}
                    disabled={saving === "hours"}
                    onClick={() => save("hours", { officeHours: { enabled: hours.enabled, days: hours.days, start: hours.start, end: hours.end } }, "Office hours saved")}
                  >
                    {saving === "hours" ? "Saving…" : "Save office hours"}
                  </button>
                </div>
              )}
            </div>

            {/* Morning summary */}
            <div className={`${cardCls} lg:col-span-2`}>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Sunrise className="h-5 w-5 text-orange-500" />
                  <div>
                    <p className="text-base font-semibold text-slate-900">Morning summary</p>
                    <p className="text-xs text-slate-500">
                      Once a day, everyone on a rule&apos;s first message gets one WhatsApp listing everything still pending for them — instead of many separate reminders.
                    </p>
                  </div>
                </div>
                <Toggle checked={digest.enabled} disabled={!canUpdate} onChange={(v) => setDigest((d) => ({ ...d, enabled: v }))} label="Morning summary" />
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Send at (India time)">
                  <input type="time" className={`${inputCls} w-36`} disabled={!canUpdate} value={digest.time} onChange={(e) => setDigest((d) => ({ ...d, time: e.target.value }))} />
                </Field>
                <p className="pb-2 text-xs text-slate-500">{digest.lastSentOn ? `Last sent on ${digest.lastSentOn}` : "Not sent yet"}</p>
                <div className="ml-auto flex gap-2">
                  {can("TEST") && (
                    <button type="button" className={btnGhost} disabled={saving === "digest-now"} onClick={sendDigestNow}>
                      <Send className="h-4 w-4" />
                      {saving === "digest-now" ? "Sending…" : "Send summary now"}
                    </button>
                  )}
                  {canUpdate && (
                    <button type="button" className={btnPrimary} disabled={saving === "digest"} onClick={() => save("digest", { digest: { enabled: digest.enabled, time: digest.time } }, "Morning summary saved")}>
                      {saving === "digest" ? "Saving…" : "Save summary"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AlertsShell>
  );
};

export default AlertChannels;
