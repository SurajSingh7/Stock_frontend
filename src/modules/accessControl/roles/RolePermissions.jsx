'use client';
import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getModules, getRolePermissions, setRolePermission } from '../api';
import { searchHrmsRoles } from '../hrmsDirectory';
import { PageHeader, Card, Field, PrimaryButton, ActionChecklist, Picker, inputCls, th, EmptyRow } from '../shared';

const RolePermissions = () => {
  const [modules, setModules] = useState([]);
  const [role, setRole] = useState(null); // { id, label, description }
  const [moduleId, setModuleId] = useState('');
  const [checkedActions, setCheckedActions] = useState([]);
  const [roleGrants, setRoleGrants] = useState([]);
  const [loadingGrants, setLoadingGrants] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getModules()
      .then((res) => setModules(res.data || []))
      .catch((err) => toast.error(err.message || 'Failed to load modules'));
  }, []);

  const selectedModule = modules.find((m) => m._id === moduleId);

  const loadRoleGrants = useCallback(async (id) => {
    if (!id) {
      setRoleGrants([]);
      return;
    }
    setLoadingGrants(true);
    try {
      const res = await getRolePermissions(id);
      setRoleGrants(res.data || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load role permissions');
    } finally {
      setLoadingGrants(false);
    }
  }, []);

  useEffect(() => {
    loadRoleGrants(role?.id);
  }, [role, loadRoleGrants]);

  // Prefill the checklist from the role's existing grant for the selected module.
  useEffect(() => {
    if (!moduleId) {
      setCheckedActions([]);
      return;
    }
    const existing = roleGrants.find((g) => g.moduleId?._id === moduleId);
    setCheckedActions(existing?.allowedActions || []);
  }, [moduleId, roleGrants]);

  const toggleAction = (action) => {
    setCheckedActions((prev) => (prev.includes(action) ? prev.filter((a) => a !== action) : [...prev, action]));
  };

  const handleSave = async () => {
    if (!role || !moduleId) {
      toast.error('Pick a role and a module first.');
      return;
    }
    setSaving(true);
    try {
      await setRolePermission({ roleId: role.id, moduleId, allowedActions: checkedActions });
      toast.success('Role permission saved.');
      await loadRoleGrants(role.id);
    } catch (err) {
      toast.error(err.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <PageHeader
        title="Roles & Permissions"
        description="Set the default actions every user with a role gets, per module. Individual users can still be given more or less via User Overrides."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card title="Grant" description="Pick a role and a module, then choose the actions it should default to." className="lg:col-span-1">
          <div className="space-y-4">
            <Field label="Role">
              <Picker
                fetcher={searchHrmsRoles}
                placeholder="Search HRMS roles…"
                selected={role}
                onSelect={setRole}
                onClear={() => setRole(null)}
              />
            </Field>

            <Field label="Module">
              <select value={moduleId} onChange={(e) => setModuleId(e.target.value)} className={`${inputCls} appearance-none`}>
                <option value="">Select a module…</option>
                {modules.map((m) => (
                  <option key={m._id} value={m._id}>{m.name}</option>
                ))}
              </select>
            </Field>

            <Field label="Allowed actions">
              <ActionChecklist actions={selectedModule?.actions || []} checked={checkedActions} onToggle={toggleAction} />
            </Field>

            <PrimaryButton onClick={handleSave} disabled={saving || !role || !moduleId}>
              {saving ? 'Saving…' : 'Save permission'}
            </PrimaryButton>
          </div>
        </Card>

        <Card title="This role's current grants" className="lg:col-span-2">
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50/60">
                <tr>
                  <th className={th}>Module</th>
                  <th className={th}>Allowed actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!role ? (
                  <EmptyRow colSpan={2}>Pick a role to see its grants.</EmptyRow>
                ) : loadingGrants ? (
                  <EmptyRow colSpan={2}>Loading…</EmptyRow>
                ) : roleGrants.length === 0 ? (
                  <EmptyRow colSpan={2}>No permissions granted to this role yet.</EmptyRow>
                ) : (
                  roleGrants.map((g) => (
                    <tr key={g._id}>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">{g.moduleId?.name || g.moduleId?.key}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{(g.allowedActions || []).join(', ') || '—'}</td>
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

export default RolePermissions;
