"use client";

import React from "react";
import { Check } from "lucide-react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import { usePermissions } from "@/context/PermissionContext";

/* Shared by the AI Settings page and Add Invoice's "Change model" popup. */

export async function aiApi(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API_BACKEND_URL}/stock/ai-settings${path}`, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) throw new Error(json.message || "Request failed");
  return json.data;
}

// Rough cost of reading a 1–2 page invoice (~5k tokens in, ~1.5k out), in ₹.
const USD_TO_INR = 85;
export const perInvoiceInr = (m) => ((5000 * m.inputPerM + 1500 * m.outputPerM) / 1_000_000) * USD_TO_INR;
const inr = (n) => (n < 1 ? `~₹${n.toFixed(2)}` : `~₹${n.toFixed(1)}`);

/** Whether the viewer holds `action` on `moduleKey` (admins hold everything). */
export const useCan = () => {
  const { permissions, isAdmin } = usePermissions() || {};
  return (moduleKey, action) =>
    !!isAdmin ||
    ((permissions || []).find((m) => m.moduleKey === moduleKey)?.actions || []).map((a) => String(a).toUpperCase()).includes(action);
};

export const ModelPicker = ({ models, value, onChange, disabled }) => (
  <div className="space-y-2">
    {models.map((m) => {
      const on = value === m.id;
      return (
        <button
          key={m.id} type="button" disabled={disabled} onClick={() => onChange(m.id)}
          className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
            on ? "border-emerald-400 bg-emerald-50/70 ring-2 ring-emerald-100" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
          }`}
        >
          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${on ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white"}`}>
            {on && <Check className="h-3 w-3" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-slate-900">{m.label}</span>
            <span className="block text-xs text-slate-500">{m.hint}</span>
          </span>
          <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-500">{inr(perInvoiceInr(m))} / invoice</span>
        </button>
      );
    })}
  </div>
);
