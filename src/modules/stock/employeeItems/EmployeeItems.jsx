"use client";

import React, { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Search, UserCheck, Undo2 } from "lucide-react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import { usePermissions } from "@/context/PermissionContext";
import { Modal, inputCls, unitLabel } from "@/modules/stock/shared/StockSharedUI";
import { PersonSearch, PersonCard } from "@/modules/stock/people/PersonSearch";
import { ConditionBadge, SourceBadge, WarrantyBadge, fmtDate } from "@/modules/stock/inventory/itemBadges";

/*
  Employee Items — stock with our own people.
    Assign from Stock    any free unit on the shelf, to an employee from the
                         People Directory (or one added there by hand)
    With Employees       who has what; take it back good or faulty
  Stock someone already had before this system goes in Opening Issued Stock.
*/

const BASE = `${API_BACKEND_URL}/stock/employee-items`;
const call = async (url, { method = "GET", body } = {}, fallback = "Request failed") => {
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) throw new Error(json.message || fallback);
  return json.data;
};

const canDo = (permissions, isAdmin, action) => {
  if (isAdmin) return true;
  const mod = (permissions || []).find((m) => m.moduleKey === "employee-items");
  return (mod?.actions || []).map((a) => String(a).toUpperCase()).includes(action);
};

const TABS = [
  { value: "stock", label: "Assign from Stock" },
  { value: "employees", label: "With Employees" },
];

const AssignModal = ({ units, onClose, onDone }) => {
  const [employee, setEmployee] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal onClose={onClose} title={`Assign ${units.length} unit(s) to an employee`} maxWidth="max-w-lg">
      <p className="mb-3 text-xs text-slate-500">{units.map((u) => u.label).join(", ")}</p>
      <label className="mb-1 block text-xs font-semibold text-slate-600">Employee *</label>
      {employee ? (
        <PersonCard person={employee} compact onClear={() => setEmployee(null)} />
      ) : (
        <PersonSearch module="employee-items" kind="EMPLOYEE" autoFocus onPick={setEmployee} />
      )}
      <label className="mt-3 block text-xs font-semibold text-slate-600">Note</label>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Field laptop" className={`${inputCls} mt-1`} />
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
        <button
          type="button"
          disabled={busy || !employee}
          onClick={async () => {
            setBusy(true);
            try {
              await call(`${BASE}/assign`, { method: "POST", body: { itemIds: units.map((u) => u._id), personId: employee.personId, note } }, "Failed to assign");
              toast.success(`Assigned to ${employee.name}`);
              onDone();
              onClose();
            } catch (err) {
              toast.error(err.message);
            } finally {
              setBusy(false);
            }
          }}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Saving…" : "Assign"}
        </button>
      </div>
    </Modal>
  );
};

const ReturnModal = ({ units, employeeName, onClose, onDone }) => {
  const [condition, setCondition] = useState("GOOD");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal onClose={onClose} title={`Take back ${units.length} unit(s) from ${employeeName}`} maxWidth="max-w-md">
      <p className="mb-3 text-xs text-slate-500">{units.map((u) => u.label).join(", ")}</p>
      <div className="mb-3 inline-flex rounded-lg border border-slate-200 p-0.5">
        {["GOOD", "FAULTY"].map((c) => (
          <button key={c} type="button" onClick={() => setCondition(c)}
            className={`rounded-md px-3 py-1 text-sm font-semibold ${condition === c ? (c === "GOOD" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white") : "text-slate-600"}`}>
            {c === "GOOD" ? "Good" : "Faulty"}
          </button>
        ))}
      </div>
      <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={condition === "FAULTY" ? "What is wrong? (required)" : "Note (optional)"} className={inputCls} />
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
        <button
          type="button"
          disabled={busy || (condition === "FAULTY" && !note.trim())}
          onClick={async () => {
            setBusy(true);
            try {
              await call(`${BASE}/return`, { method: "POST", body: { itemIds: units.map((u) => u._id), condition, note } }, "Failed to take back");
              toast.success(condition === "GOOD" ? "Back on the shelf" : "Moved to Repair & Warranty");
              onDone();
              onClose();
            } catch (err) {
              toast.error(err.message);
            } finally {
              setBusy(false);
            }
          }}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Saving…" : "Take back"}
        </button>
      </div>
    </Modal>
  );
};

// A selectable list of units.
const UnitTable = ({ rows, picked, onToggle, extraColumn }) => (
  <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
    <table className="w-full min-w-[760px] text-sm">
      <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
        <tr>
          <th className="w-10 px-4 py-2" />
          <th className="px-4 py-2">Unit</th>
          <th className="px-4 py-2">Product</th>
          <th className="px-4 py-2">Branch</th>
          {extraColumn && <th className="px-4 py-2">{extraColumn.label}</th>}
          <th className="px-4 py-2">Details</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.length === 0 ? (
          <tr><td colSpan={extraColumn ? 6 : 5} className="px-4 py-10 text-center text-slate-400">Nothing here</td></tr>
        ) : (
          rows.map((r) => (
            <tr key={r._id} className={picked.has(r._id) ? "bg-indigo-50/50" : ""}>
              <td className="px-4 py-2"><input type="checkbox" checked={picked.has(r._id)} onChange={() => onToggle(r._id)} className="h-4 w-4 accent-indigo-600" /></td>
              <td className="px-4 py-2 font-mono text-slate-900">{r.label}{r.quantity !== null && r.quantity !== undefined ? ` · ${r.quantity} ${unitLabel(r.product?.unit)}` : ""}</td>
              <td className="px-4 py-2 text-slate-800">{r.product?.name}</td>
              <td className="px-4 py-2 text-slate-600">{r.branch?.name || "—"}</td>
              {extraColumn && <td className="px-4 py-2 text-slate-700">{extraColumn.render(r)}</td>}
              <td className="px-4 py-2"><span className="flex flex-wrap gap-1"><ConditionBadge condition={r.condition} /><SourceBadge source={r.source} /><WarrantyBadge endDate={r.warranty?.endDate} /></span></td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

const EmployeeItems = () => {
  const { permissions, isAdmin } = usePermissions();
  const canAssign = canDo(permissions, isAdmin, "ASSIGN");
  const canReturn = canDo(permissions, isAdmin, "RETURN");
  const [tab, setTab] = useState("stock");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [rows, setRows] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [picked, setPicked] = useState(new Set());
  const [modal, setModal] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setError(null);
    setPicked(new Set());
    const q = debounced ? `?${new URLSearchParams({ search: debounced })}` : "";
    try {
      if (tab === "stock") setRows(await call(`${BASE}/available${q}`));
      else {
        const list = await call(`${BASE}/employees${q}`);
        setEmployees(list);
        const key = selectedEmp && list.some((e) => e.key === selectedEmp.key) ? selectedEmp.key : list[0]?.key;
        setSelectedEmp(list.find((e) => e.key === key) || null);
        setRows(key ? await call(`${BASE}/items?${new URLSearchParams({ key })}`) : []);
      }
    } catch (err) {
      setError(err.message);
      setRows([]);
    }
    // selectedEmp is read, not tracked: switching employee loads via pickEmployee.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, debounced]);

  useEffect(() => { load(); }, [load]);

  const pickEmployee = async (e) => {
    setSelectedEmp(e);
    setPicked(new Set());
    try { setRows(await call(`${BASE}/items?${new URLSearchParams({ key: e.key })}`)); } catch (err) { setError(err.message); }
  };
  const toggle = (id) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const pickedRows = rows.filter((r) => picked.has(r._id));

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Employee Items</h1>
        <p className="mt-0.5 text-sm text-slate-500">Stock with our own people — hand it out, see who has what, take it back.</p>
      </div>
      {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {TABS.map((t) => (
            <button key={t.value} type="button" onClick={() => { setTab(t.value); setSearch(""); }}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${tab === t.value ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tab === "employees" ? "Employee name or code…" : "Serial / MAC…"} className={`${inputCls} pl-9`} />
          </div>
          {tab !== "employees" && canAssign && (
            <button type="button" disabled={!picked.size} onClick={() => setModal("assign")} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
              <UserCheck className="h-4 w-4" /> Assign ({picked.size})
            </button>
          )}
          {tab === "employees" && canReturn && (
            <button type="button" disabled={!picked.size} onClick={() => setModal("return")} className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
              <Undo2 className="h-4 w-4" /> Take back ({picked.size})
            </button>
          )}
        </div>
      </div>

      {tab === "employees" ? (
        <div className="grid gap-4 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            {employees.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No employee holds stock</p>
            ) : (
              employees.map((e) => (
                <button key={e.key} type="button" onClick={() => pickEmployee(e)}
                  className={`mb-1 block w-full rounded-xl px-3 py-2 text-left ${selectedEmp?.key === e.key ? "bg-indigo-50 ring-1 ring-indigo-200" : "hover:bg-slate-50"}`}>
                  <p className="font-semibold text-slate-900">{e.employeeName}</p>
                  <p className="text-xs text-slate-500">{e.employeeCode || "—"} · {e.units} unit(s){e.phone ? ` · ${e.phone}` : ""}</p>
                </button>
              ))
            )}
          </div>
          <div className="lg:col-span-3">
            <UnitTable rows={rows} picked={picked} onToggle={toggle} extraColumn={{ label: "Since", render: (r) => `${fmtDate(r.assignedTo?.assignedAt)}${r.assignedTo?.note ? ` · ${r.assignedTo.note}` : ""}` }} />
          </div>
        </div>
      ) : (
        <UnitTable rows={rows} picked={picked} onToggle={toggle} />
      )}

      {modal === "assign" && <AssignModal units={pickedRows} onClose={() => setModal(null)} onDone={load} />}
      {modal === "return" && <ReturnModal units={pickedRows} employeeName={selectedEmp?.employeeName || "employee"} onClose={() => setModal(null)} onDone={load} />}
    </div>
  );
};

export default EmployeeItems;
