'use client';
import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getModules, getRolePermissions, setRolePermission } from '../api';
import { searchHrmsRoles } from '../hrmsDirectory';
import { PageShell, Card, Field, PrimaryButton, ActionChecklist, ActionPill, Picker, inputCls, TableShell, EmptyRow, Mono } from '../shared';

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
    <PageShell
      question="What can they do?"
      title="Roles & Permissions"
      description="The base grant. Everyone holding a role gets these actions on these modules — before any department ceiling narrows them, and before any per-user exception adjusts them."
    >

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

        <Card
          title={role ? `Current grants for ${role.label}` : 'Current grants'}
          description="Modules not listed here grant this role nothing — a missing role permission denies."
          className="lg:col-span-2 h-fit"
        >
          <TableShell head={['Module', 'Allowed actions']}>
            {!role ? (
              <EmptyRow colSpan={2}>Pick a role to see its grants.</EmptyRow>
            ) : loadingGrants ? (
              <EmptyRow colSpan={2}>Loading…</EmptyRow>
            ) : roleGrants.length === 0 ? (
              <EmptyRow colSpan={2}>Nothing granted yet — this role currently has no access at all.</EmptyRow>
            ) : (
              roleGrants.map((g) => (
                <tr key={g._id} className="align-top transition hover:bg-slate-50/60">
                  <td className="px-4 py-3.5">
                    <p className="text-sm font-semibold whitespace-nowrap text-slate-900">{g.moduleId?.name}</p>
                    <Mono>{g.moduleId?.key}</Mono>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap gap-1.5">
                      {(g.allowedActions || []).length === 0 ? (
                        <span className="text-xs text-slate-400">none</span>
                      ) : (
                        g.allowedActions.map((a) => <ActionPill key={a} state="granted">{a}</ActionPill>)
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </TableShell>
        </Card>
      </div>
    </PageShell>
  );
};

export default RolePermissions;
