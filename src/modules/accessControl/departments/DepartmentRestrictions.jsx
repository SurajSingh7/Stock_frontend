'use client';
import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  getModules,
  getDepartmentRestrictions,
  setDepartmentRestriction,
  clearDepartmentRestriction,
} from '../api';
import { searchHrmsDepartments } from '../hrmsDirectory';
import {
  PageShell, Card, Field, PrimaryButton, GhostButton, ActionChecklist,
  ActionPill, Picker, Banner, TableShell, EmptyRow, Mono, inputCls,
} from '../shared';

export default function DepartmentRestrictions() {
  const [modules, setModules] = useState([]);
  const [department, setDepartment] = useState(null);
  const [moduleId, setModuleId] = useState('');
  const [allowedActions, setAllowedActions] = useState([]);
  const [restrictions, setRestrictions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getModules().then((r) => setModules(r.data || [])).catch((e) => toast.error(e.message));
  }, []);

  const selectedModule = modules.find((m) => m._id === moduleId);

  const load = useCallback(async (d) => {
    if (!d?.id) return setRestrictions([]);
    setLoading(true);
    try {
      const res = await getDepartmentRestrictions(d.id);
      setRestrictions(res.data || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load restrictions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(department); }, [department, load]);

  // Prefill from whatever is already configured for this module.
  useEffect(() => {
    if (!moduleId) return setAllowedActions([]);
    const existing = restrictions.find((r) => r.moduleId?._id === moduleId);
    setAllowedActions(existing?.allowedActions || []);
  }, [moduleId, restrictions]);

  const toggle = (a) =>
    setAllowedActions((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));

  const save = async () => {
    if (!department || !moduleId) return toast.error('Pick a department and a module first.');
    setSaving(true);
    try {
      await setDepartmentRestriction({ departmentId: department.id, moduleId, allowedActions });
      toast.success('Department restriction saved.');
      await load(department);
    } catch (err) {
      toast.error(err.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const clear = async (mId) => {
    try {
      await clearDepartmentRestriction({ departmentId: department.id, moduleId: mId });
      toast.success('Restriction removed — the role’s actions now apply unchanged.');
      await load(department);
    } catch (err) {
      toast.error(err.message || 'Failed to remove.');
    }
  };

  return (
    <PageShell
      question="What can they do?"
      title="Department Restrictions"
      description="A ceiling on what a role granted, never a grant of its own. Base actions = role actions ∩ department actions, so a department can only ever narrow — it can never hand someone an action their role does not have."
    >
      <div className="mb-5">
        <Banner tone="warn">
          <strong>No restriction is the normal state.</strong> A department with nothing configured places no
          ceiling at all, and the role’s actions apply unchanged. Only configure one where a department must
          genuinely do less than its roles allow — and remember a user-level override can deliberately
          restore what you remove here.
        </Banner>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card
          title="Set a ceiling"
          description="Tick only the actions this department may keep. Anything left unticked is removed from every role in it."
          className="lg:col-span-1 h-fit"
        >
          <div className="space-y-4">
            <Field label="Department">
              <Picker
                fetcher={searchHrmsDepartments}
                placeholder="Search HRMS departments…"
                selected={department}
                onSelect={setDepartment}
                onClear={() => setDepartment(null)}
              />
            </Field>

            <Field label="Module">
              <select
                value={moduleId}
                onChange={(e) => setModuleId(e.target.value)}
                disabled={!department}
                className={`${inputCls} appearance-none disabled:bg-slate-50 disabled:text-slate-400`}
              >
                <option value="">Select a module…</option>
                {modules.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
              </select>
            </Field>

            <Field
              label="Actions this department keeps"
              hint={
                selectedModule
                  ? `${allowedActions.length} of ${selectedModule.actions.length} kept — the rest are removed from every role in this department.`
                  : undefined
              }
            >
              <ActionChecklist
                actions={selectedModule?.actions || []}
                checked={allowedActions}
                onToggle={toggle}
                emptyLabel="Pick a module to see its actions."
              />
            </Field>

            <PrimaryButton onClick={save} disabled={saving || !department || !moduleId}>
              {saving ? 'Saving…' : 'Save restriction'}
            </PrimaryButton>
          </div>
        </Card>

        <Card
          title={department ? `Ceilings on ${department.label}` : 'Configured ceilings'}
          description="Modules not listed here have no ceiling — roles apply in full."
          className="lg:col-span-2 h-fit"
        >
          <TableShell head={['Module', 'Kept', 'Removed', '']}>
            {!department ? (
              <EmptyRow colSpan={4}>Pick a department to see its restrictions.</EmptyRow>
            ) : loading ? (
              <EmptyRow colSpan={4}>Loading…</EmptyRow>
            ) : restrictions.length === 0 ? (
              <EmptyRow colSpan={4}>
                No ceilings configured — every role in this department keeps its full set of actions.
              </EmptyRow>
            ) : (
              restrictions.map((r) => {
                const all = r.moduleId?.actions || [];
                const kept = r.allowedActions || [];
                const removed = all.filter((a) => !kept.includes(a));
                return (
                  <tr key={r._id} className="align-top transition hover:bg-slate-50/60">
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-semibold whitespace-nowrap text-slate-900">{r.moduleId?.name}</p>
                      <Mono>{r.moduleId?.key}</Mono>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1.5">
                        {kept.length === 0
                          ? <span className="text-xs font-semibold text-rose-600">nothing — this module is fully blocked</span>
                          : kept.map((a) => <ActionPill key={a} state="granted">{a}</ActionPill>)}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1.5">
                        {removed.length === 0
                          ? <span className="text-xs text-slate-400">nothing</span>
                          : removed.map((a) => <ActionPill key={a} state="removed">{a}</ActionPill>)}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <GhostButton tone="rose" onClick={() => clear(r.moduleId._id)}>Remove</GhostButton>
                    </td>
                  </tr>
                );
              })
            )}
          </TableShell>
        </Card>
      </div>
    </PageShell>
  );
}
