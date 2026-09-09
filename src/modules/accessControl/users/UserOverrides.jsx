'use client';
import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  getModules,
  getUserOverrides,
  setUserOverride,
  getEffectivePermissions,
} from '../api';
import { searchHrmsUsers } from '../hrmsDirectory';
import DataScopeEditor from './DataScopeEditor';
import { PageShell, Card, Field, PrimaryButton, ActionChecklist, ActionPill, ScopePill, Picker, inputCls, TableShell, EmptyRow } from '../shared';

const TABS = [
  { key: 'permissions', label: 'Permissions', hint: 'What this person may DO' },
  { key: 'dataScope', label: 'Data Scope', hint: 'WHOSE records they may touch' },
];

const UserOverrides = () => {
  const [tab, setTab] = useState('permissions');
  const [modules, setModules] = useState([]);
  const [user, setUser] = useState(null);
  const [moduleId, setModuleId] = useState('');

  const [addActions, setAddActions] = useState([]);
  const [removeActions, setRemoveActions] = useState([]);
  const [reason, setReason] = useState('');

  const [overrides, setOverrides] = useState([]);
  const [effective, setEffective] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getModules().then((res) => setModules(res.data || [])).catch((err) => toast.error(err.message));
  }, []);

  const selectedModule = modules.find((m) => m._id === moduleId);

  const loadUser = useCallback(async (u) => {
    if (!u?.id) {
      setOverrides([]);
      setEffective([]);
      return;
    }
    setLoading(true);
    try {
      const ov = await getUserOverrides(u.id);
      setOverrides(ov.data || []);
      if (u.roleId) {
        const eff = await getEffectivePermissions(u.id, u.roleId);
        setEffective(eff.data || []);
      } else {
        setEffective([]);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load user access');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser(user);
  }, [user, loadUser]);

  useEffect(() => {
    if (!moduleId) {
      setAddActions([]);
      setRemoveActions([]);
      setReason('');
      return;
    }
    const existing = overrides.find((o) => o.moduleId?._id === moduleId);
    setAddActions(existing?.addActions || []);
    setRemoveActions(existing?.removeActions || []);
    setReason(existing?.reason || '');
  }, [moduleId, overrides]);

  const toggle = (setFn) => (action) =>
    setFn((prev) => (prev.includes(action) ? prev.filter((a) => a !== action) : [...prev, action]));

  const handleSaveOverride = async () => {
    if (!user || !moduleId) return toast.error('Pick a user and a module first.');
    if (!reason.trim()) return toast.error('Give a reason — an override is an exception, and the next admin needs to know why.');
    setSaving(true);
    try {
      await setUserOverride({ userId: user.id, moduleId, addActions, removeActions, reason: reason.trim() });
      toast.success('Override saved.');
      await loadUser(user);
    } catch (err) {
      toast.error(err.message || 'Failed to save override.');
    } finally {
      setSaving(false);
    }
  };

  // SELECTED is the only mode with a list behind it worth counting; OWN and
  // ALL say everything they need to on their own.
  const scopeDetail = (dim, listKey) =>
    dim?.scope === 'SELECTED' ? `${(dim[listKey] || []).length}` : undefined;

  return (
    <PageShell
      question="Per person"
      title="User Access"
      description="Two separate questions, two tabs: what this person may DO, and WHOSE records they may do it to. Everything here is an exception on top of their role and department."
    >

      <Card className="mb-5">
        <Field label="User" hint={user?.roleName ? `Role: ${user.roleName}` : 'Picking a user also resolves their role automatically.'}>
          <Picker
            fetcher={searchHrmsUsers}
            placeholder="Search HRMS users…"
            selected={user}
            onSelect={setUser}
            onClear={() => setUser(null)}
          />
        </Field>
      </Card>

      <div className="mb-5 inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            title={t.hint}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
              tab === t.key ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dataScope' ? (
        <DataScopeEditor user={user} />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Card
            title="Override"
            description="An exception on top of the base (role ∩ department). It may deliberately restore something a department restriction removed."
            className="lg:col-span-1 h-fit"
          >
            <div className="space-y-4">
              <Field label="Module">
                <select value={moduleId} onChange={(e) => setModuleId(e.target.value)} className={`${inputCls} appearance-none`}>
                  <option value="">Select a module…</option>
                  {modules.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
                </select>
              </Field>
              <Field label="Add">
                <ActionChecklist actions={selectedModule?.actions || []} checked={addActions} onToggle={toggle(setAddActions)} />
              </Field>
              <Field label="Remove">
                <ActionChecklist actions={selectedModule?.actions || []} checked={removeActions} onToggle={toggle(setRemoveActions)} />
              </Field>
              <Field label="Reason" hint="Required — recorded on the override and in the audit log.">
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Covering approvals while the manager is on leave"
                  className={inputCls}
                />
              </Field>
              <PrimaryButton onClick={handleSaveOverride} disabled={saving || !user || !moduleId}>
                {saving ? 'Saving…' : 'Save override'}
              </PrimaryButton>
            </div>
          </Card>

          <Card
            title="Effective access"
            description="Resolved through the same code the API runs, so this can't disagree with what a request would actually be allowed."
            className="lg:col-span-2 h-fit"
          >
            <TableShell head={['Module', 'Allowed actions', 'Data scope']}>
              {!user ? (
                <EmptyRow colSpan={3}>Pick a user to preview their effective access.</EmptyRow>
              ) : !user.roleId ? (
                <EmptyRow colSpan={3}>This user has no role on HRMS yet — can’t compute effective access.</EmptyRow>
              ) : loading ? (
                <EmptyRow colSpan={3}>Loading…</EmptyRow>
              ) : effective.length === 0 ? (
                <EmptyRow colSpan={3}>Nothing to show.</EmptyRow>
              ) : (
                effective.map((m) => (
                  <tr key={m.moduleId} className="align-top transition hover:bg-slate-50/60">
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-semibold text-slate-900">{m.moduleName}</p>
                      {m.hasModuleOverride && (
                        <span className="mt-1 inline-flex rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                          scope override
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1.5">
                        {(m.allowedActions || []).length === 0 ? (
                          <span className="text-xs text-slate-400">none</span>
                        ) : (
                          m.allowedActions.map((a) => <ActionPill key={a} state="granted">{a}</ActionPill>)
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1.5">
                        <ScopePill scope={m.dataAccess?.branch?.scope} detail={scopeDetail(m.dataAccess?.branch, 'allowedBranchIds')} />
                        <ScopePill scope={m.dataAccess?.entity?.scope} detail={(m.dataAccess?.entity?.allowedEntityAliases || []).join(', ') || undefined} />
                        <ScopePill scope={m.dataAccess?.recordOwnership?.scope} detail={scopeDetail(m.dataAccess?.recordOwnership, 'allowedUserIds')} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </TableShell>
          </Card>
        </div>
      )}
    </PageShell>
  );
};

export default UserOverrides;
