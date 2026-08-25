'use client';
import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { API_BACKEND_URL } from '@/config/getEnvVariables';
import {
  getModules,
  getUserOverrides,
  setUserOverride,
  getScopePolicies,
  setScopePolicy,
  getEffectivePermissions,
  getEntityAccess,
  setEntityAccess,
} from '../api';
import { searchHrmsUsers } from '../hrmsDirectory';
import useInternalEntities from '@/modules/stock/shared/useInternalEntities';
import { PageHeader, Card, Field, PrimaryButton, ActionChecklist, Picker, inputCls, th, EmptyRow } from '../shared';

const SCOPES = [
  { value: 'OWN_BRANCH', label: 'Own branch only' },
  { value: 'ALL_BRANCHES', label: 'All branches' },
  { value: 'SPECIFIC_BRANCHES', label: 'Specific branches' },
];

const ENTITY_SCOPES = [
  { value: 'ALL_ENTITIES', label: 'All entities' },
  { value: 'SPECIFIC_ENTITIES', label: 'Specific entities' },
];

const getActiveWarehouses = async () => {
  const res = await fetch(`${API_BACKEND_URL}/stock/warehouses/active`, { method: 'GET', credentials: 'include' });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'Failed to load warehouses');
  return data.data || [];
};

const UserOverrides = () => {
  const [modules, setModules] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [user, setUser] = useState(null); // { id, label, description, roleId, roleName }
  const [moduleId, setModuleId] = useState('');

  const [addActions, setAddActions] = useState([]);
  const [removeActions, setRemoveActions] = useState([]);
  const [scope, setScope] = useState('OWN_BRANCH');
  const [allowedBranchIds, setAllowedBranchIds] = useState([]);

  // Entity access is per-user, so it lives outside the module-dependent state.
  const [entityScope, setEntityScope] = useState('ALL_ENTITIES');
  const [allowedEntityAliases, setAllowedEntityAliases] = useState([]);
  const [savingEntity, setSavingEntity] = useState(false);

  const [overrides, setOverrides] = useState([]);
  const [scopePolicies, setScopePolicies] = useState([]);
  const [effective, setEffective] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reuses the same master-data hook the Tracking Orders and PO screens use, so
  // the alias list can never drift from the one people actually pick entities
  // from. Only the aliases are used here — a grant of "GTEL" is meant to cover
  // every one of that company's state registrations.
  const { aliases, loading: aliasesLoading } = useInternalEntities();

  useEffect(() => {
    getModules().then((res) => setModules(res.data || [])).catch((err) => toast.error(err.message));
    getActiveWarehouses().then(setWarehouses).catch((err) => toast.error(err.message));
  }, []);

  const selectedModule = modules.find((m) => m._id === moduleId);

  const loadUser = useCallback(async (u) => {
    if (!u?.id) {
      setOverrides([]);
      setScopePolicies([]);
      setEffective([]);
      setEntityScope('ALL_ENTITIES');
      setAllowedEntityAliases([]);
      return;
    }
    setLoading(true);
    try {
      const [ov, sp, ea] = await Promise.all([
        getUserOverrides(u.id),
        getScopePolicies(u.id),
        getEntityAccess(u.id),
      ]);
      setOverrides(ov.data || []);
      setScopePolicies(sp.data || []);
      // The API returns the effective state (ALL_ENTITIES) even when no row
      // exists yet, so this always reflects reality rather than a blank form.
      setEntityScope(ea.data?.scope || 'ALL_ENTITIES');
      setAllowedEntityAliases(ea.data?.allowedEntityAliases || []);
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
      setScope('OWN_BRANCH');
      setAllowedBranchIds([]);
      return;
    }
    const existingOverride = overrides.find((o) => o.moduleId?._id === moduleId);
    setAddActions(existingOverride?.addActions || []);
    setRemoveActions(existingOverride?.removeActions || []);

    const existingScope = scopePolicies.find((s) => s.moduleId?._id === moduleId);
    setScope(existingScope?.scope || 'OWN_BRANCH');
    setAllowedBranchIds((existingScope?.allowedBranchIds || []).map((b) => (typeof b === 'string' ? b : b._id)));
  }, [moduleId, overrides, scopePolicies]);

  const toggle = (setFn) => (action) =>
    setFn((prev) => (prev.includes(action) ? prev.filter((a) => a !== action) : [...prev, action]));

  const toggleBranch = (id) =>
    setAllowedBranchIds((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]));

  const toggleAlias = (alias) =>
    setAllowedEntityAliases((prev) =>
      prev.includes(alias) ? prev.filter((a) => a !== alias) : [...prev, alias]
    );

  const handleSaveEntityAccess = async () => {
    if (!user) return toast.error('Pick a user first.');
    if (entityScope === 'SPECIFIC_ENTITIES' && allowedEntityAliases.length === 0) {
      return toast.error('Pick at least one entity, or choose All entities.');
    }
    setSavingEntity(true);
    try {
      await setEntityAccess({ userId: user.id, scope: entityScope, allowedEntityAliases });
      toast.success('Entity access saved.');
      await loadUser(user);
    } catch (err) {
      toast.error(err.message || 'Failed to save entity access.');
    } finally {
      setSavingEntity(false);
    }
  };

  const handleSaveOverride = async () => {
    if (!user || !moduleId) return toast.error('Pick a user and a module first.');
    setSaving(true);
    try {
      await setUserOverride({ userId: user.id, moduleId, addActions, removeActions });
      toast.success('Override saved.');
      await loadUser(user);
    } catch (err) {
      toast.error(err.message || 'Failed to save override.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveScope = async () => {
    if (!user || !moduleId) return toast.error('Pick a user and a module first.');
    if (scope === 'SPECIFIC_BRANCHES' && allowedBranchIds.length === 0) {
      return toast.error('Pick at least one branch for Specific branches.');
    }
    setSaving(true);
    try {
      await setScopePolicy({ userId: user.id, moduleId, scope, allowedBranchIds });
      toast.success('Branch scope saved.');
      await loadUser(user);
    } catch (err) {
      toast.error(err.message || 'Failed to save scope.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <PageHeader
        title="User Overrides"
        description="Give one specific person more or less than their role's default — and which branch(es) their data is scoped to."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-1">
          <Card>
            <div className="space-y-4">
              <Field label="User" hint={user?.roleName ? `Role: ${user.roleName}` : 'Picking a user also resolves their role automatically.'}>
                <Picker
                  fetcher={searchHrmsUsers}
                  placeholder="Search HRMS users…"
                  selected={user}
                  onSelect={setUser}
                  onClear={() => setUser(null)}
                />
              </Field>
              <Field label="Module">
                <select value={moduleId} onChange={(e) => setModuleId(e.target.value)} className={`${inputCls} appearance-none`}>
                  <option value="">Select a module…</option>
                  {modules.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
                </select>
              </Field>
            </div>
          </Card>

          <Card
            title="Entity access"
            description="Which company's paperwork this person handles — Purchase Orders, Invoices and Tracking Orders. Applies to the person, not to one module, so it can't differ between those screens."
          >
            <div className="space-y-4">
              <div className="space-y-2">
                {ENTITY_SCOPES.map((s) => (
                  <label key={s.value} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="entityScope"
                      checked={entityScope === s.value}
                      onChange={() => setEntityScope(s.value)}
                      disabled={!user}
                    />
                    {s.label}
                  </label>
                ))}
              </div>

              {entityScope === 'SPECIFIC_ENTITIES' && (
                <div className="flex flex-wrap gap-2">
                  {aliasesLoading ? (
                    <p className="text-sm text-slate-400">Loading entities…</p>
                  ) : aliases.length === 0 ? (
                    <p className="text-sm text-rose-600">Couldn’t load the entity list.</p>
                  ) : (
                    aliases.map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => toggleAlias(a)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                          allowedEntityAliases.includes(a)
                            ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                            : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        {a}
                      </button>
                    ))
                  )}
                </div>
              )}

              <PrimaryButton onClick={handleSaveEntityAccess} disabled={savingEntity || !user}>
                {savingEntity ? 'Saving…' : 'Save entity access'}
              </PrimaryButton>
            </div>
          </Card>

          <Card title="Override" description="On top of the role default: add grants this person doesn't otherwise have, or remove ones they do.">
            <div className="space-y-4">
              <Field label="Add"><ActionChecklist actions={selectedModule?.actions || []} checked={addActions} onToggle={toggle(setAddActions)} /></Field>
              <Field label="Remove"><ActionChecklist actions={selectedModule?.actions || []} checked={removeActions} onToggle={toggle(setRemoveActions)} /></Field>
              <PrimaryButton onClick={handleSaveOverride} disabled={saving || !user || !moduleId}>
                {saving ? 'Saving…' : 'Save override'}
              </PrimaryButton>
            </div>
          </Card>

          <Card title="Branch scope" description="Which branch(es) this person can see/act on for this module.">
            <div className="space-y-4">
              <div className="space-y-2">
                {SCOPES.map((s) => (
                  <label key={s.value} className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="radio" name="scope" checked={scope === s.value} onChange={() => setScope(s.value)} />
                    {s.label}
                  </label>
                ))}
              </div>
              {scope === 'SPECIFIC_BRANCHES' && (
                <div className="flex flex-wrap gap-2">
                  {warehouses.map((w) => (
                    <button
                      key={w._id}
                      type="button"
                      onClick={() => toggleBranch(w._id)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        allowedBranchIds.includes(w._id)
                          ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {w.name}
                    </button>
                  ))}
                </div>
              )}
              <PrimaryButton onClick={handleSaveScope} disabled={saving || !user || !moduleId}>
                {saving ? 'Saving…' : 'Save scope'}
              </PrimaryButton>
            </div>
          </Card>
        </div>

        <Card title="Effective permissions" description="What this user can actually do right now, module by module." className="lg:col-span-2 h-fit">
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50/60">
                <tr>
                  <th className={th}>Module</th>
                  <th className={th}>Allowed actions</th>
                  <th className={th}>Scope</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
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
                    <tr key={m.moduleId}>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">{m.moduleName}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{(m.allowedActions || []).join(', ') || <span className="text-slate-300">none</span>}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{m.scope}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default UserOverrides;
