"use client";

import React, { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Sparkles, KeyRound, PlugZap, RefreshCw } from "lucide-react";
import { aiApi, useCan, ModelPicker } from "./aiSettingsShared";

/* ============================================================= */
/* AI Settings — which Claude model reads uploaded invoices on   */
/* Add Invoice, whether the scan is on, and what it has cost.     */
/* The API key lives only in the server .env.                     */
/* ============================================================= */

const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const Card = ({ title, icon: Icon, children, right }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-4 flex items-center justify-between gap-2">
      <p className="flex items-center gap-2 text-sm font-bold text-slate-800">{Icon && <Icon className="h-4 w-4 text-emerald-600" />}{title}</p>
      {right}
    </div>
    {children}
  </div>
);

const AiSettings = () => {
  const can = useCan();
  const canUpdate = can("ai-settings", "UPDATE");
  const canTest = can("ai-settings", "TEST");
  const [data, setData] = useState(null);
  const [usage, setUsage] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, u] = await Promise.all([aiApi(""), aiApi("/usage")]);
      setData(s);
      setUsage(u);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const save = async (invoiceScan) => {
    setSaving(true);
    try {
      setData(await aiApi("", { method: "PUT", body: { invoiceScan } }));
      toast.success("AI settings saved");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const r = await aiApi("/test", { method: "POST" });
      toast.success(`Connected · ${r.model} answered in ${(r.ms / 1000).toFixed(1)}s`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setTesting(false);
    }
  };

  const enabled = data?.invoiceScan?.enabled;

  return (
    <div className="mx-auto max-w-4xl p-6 pb-12">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900"><Sparkles className="h-5 w-5 text-emerald-600" />AI Settings</h1>
          <p className="mt-1 text-sm text-slate-500">Which Claude model reads invoices uploaded on Add Invoice.</p>
        </div>
        <button type="button" onClick={load} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {error && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      {!data ? (
        <div className="space-y-4">
          {[0, 1].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-100" />)}
        </div>
      ) : (
        <div className="space-y-4">
          <Card
            title="Invoice scan" icon={Sparkles}
            right={
              <button
                type="button" role="switch" aria-checked={enabled} disabled={!canUpdate || saving}
                onClick={() => save({ enabled: !enabled })}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${enabled ? "bg-emerald-600" : "bg-slate-300"}`}
                title={enabled ? "Switch AI scan off" : "Switch AI scan on"}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${enabled ? "left-[22px]" : "left-0.5"}`} />
              </button>
            }
          >
            <p className="mb-3 text-xs text-slate-500">
              {enabled
                ? "Uploading an invoice fills in its details automatically with the model below. People check them before saving."
                : "Off — Add Invoice opens an empty form after upload, filled in by hand."}
            </p>
            <ModelPicker models={data.models} value={data.invoiceScan.model} disabled={!canUpdate || saving || !enabled} onChange={(model) => save({ model })} />
            {!canUpdate && <p className="mt-3 text-xs text-slate-400">You can view these settings; changing them needs AI Settings · Update.</p>}
          </Card>

          <Card
            title="API key" icon={KeyRound}
            right={canTest && (
              <button type="button" onClick={test} disabled={testing || !data.keyConfigured} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm hover:bg-emerald-50 disabled:opacity-50">
                <PlugZap className="h-3.5 w-3.5" />{testing ? "Testing…" : "Test connection"}
              </button>
            )}
          >
            {data.keyConfigured ? (
              <p className="text-sm text-emerald-700">✓ Found in the server&apos;s .env (ANTHROPIC_API_KEY). It is never shown here.</p>
            ) : (
              <p className="text-sm text-rose-700">✗ ANTHROPIC_API_KEY is not set in the server&apos;s .env — AI scan cannot run.</p>
            )}
          </Card>

          {usage && (
            <Card title="Usage" icon={null}>
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Scans this month", value: usage.month.scans },
                  { label: "Cost this month", value: `~${inr(usage.month.costInr)}` },
                  { label: "Failed this month", value: usage.month.failed },
                  { label: "All-time cost", value: `~${inr(usage.allTime.costInr)}` },
                ].map((t) => (
                  <div key={t.label} className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t.label}</p>
                    <p className="text-lg font-bold tabular-nums text-slate-900">{t.value}</p>
                  </div>
                ))}
              </div>
              {usage.allTime.byModel.length > 0 && (
                <p className="mb-3 text-xs text-slate-500">
                  Average time: {usage.allTime.byModel.map((m) => `${data.models.find((x) => x.id === m.model)?.label || m.model} ${m.avgSeconds ?? "—"}s`).join(" · ")}
                </p>
              )}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <tr><th className="px-3 py-2">When</th><th className="px-3 py-2">Model</th><th className="px-3 py-2">By</th><th className="px-3 py-2 text-right">Time</th><th className="px-3 py-2 text-right">Cost</th><th className="px-3 py-2">Result</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {usage.recent.length === 0 ? (
                      <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">No scans yet.</td></tr>
                    ) : usage.recent.map((r, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-xs text-slate-600">{fmtDateTime(r.at)}</td>
                        <td className="px-3 py-2 text-xs">{data.models.find((x) => x.id === r.model)?.label || r.model}</td>
                        <td className="px-3 py-2 text-xs text-slate-600">{r.byName || "—"}</td>
                        <td className="px-3 py-2 text-right text-xs tabular-nums">{r.seconds}s</td>
                        <td className="px-3 py-2 text-right text-xs tabular-nums">~{inr(r.costInr)}</td>
                        <td className="px-3 py-2 text-xs">{r.ok ? <span className="text-emerald-700">✓ Read</span> : <span className="text-rose-600" title={r.error}>✗ {r.error}</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">Cost is an estimate from token counts at Anthropic&apos;s list prices.</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default AiSettings;
