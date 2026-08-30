'use client';
import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { API_BACKEND_URL } from '@/config/getEnvVariables';
import { getDataScopes, setDataScope, clearModuleDataScope, getModules } from '../api';
import { searchHrmsUsers } from '../hrmsDirectory';
import useInternalEntities from '@/modules/stock/shared/useInternalEntities';
import { Card, Field, PrimaryButton, Picker, inputCls } from '../shared';

/* Branch and ownership share OWN/SELECTED/ALL. Entity has no OWN — a user has
   no entity of their own, so access is an explicit list or everything. */
const TRI = [
  { value: 'OWN', label: 'Own' },
  { value: 'SELECTED', label: 'Selected' },
  { value: 'ALL', label: 'All' },
];
const ENTITY_MODES = [
  { value: 'SELECTED', label: 'Selected' },
  { value: 'ALL', label: 'All' },
];

const EMPTY = {
  branch: { configured: false, scope: 'OWN', allowedBranchIds: [] },
  entity: { configured: false, scope: 'SELECTED', allowedEntityAliases: [] },
  recordOwnership: { configured: false, scope: 'OWN', allowedUserIds: [] },
};

const getActiveBranches = async () => {
  const res = await fetch(`${API_BACKEND_URL}/stock/branches/active`, { method: 'GET', credentials: 'include' });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'Failed to load branches');
  return data.data || [];
};

const Chip = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
      active
        ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
        : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
    }`}
  >
    {children}
  </button>
);

const ModeRadios = ({ name, options, value, onChange, disabled }) => (
  <div className="flex flex-wrap gap-4">
    {options.map((o) => (
      <label key={o.value} className="flex items-center gap-1.5 text-sm text-slate-700">
        <input
          type="radio"
          name={name}
          checked={value === o.value}
          onChange={() => onChange(o.value)}
          disabled={disabled}
        />
        {o.label}
      </label>
    ))}
  </div>
);

/**
 * One dimension row. `configured` only appears on module overrides — the
 * global row is the user's baseline and every dimension there always applies.
 */
const Dimension = ({ title, hint, showConfigured, dim, onChange, children }) => {
  const disabled = showConfigured && !dim.configured;
  return (
    <div className={`rounded-xl border p-4 ${disabled ? 'border-slate-200 bg-slate-50/60' : 'border-slate-200 bg-white'}`}>
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="text-xs text-slate-500">{hint}</p>
        </div>
        {showConfigured && (
          <label className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-600">
            <input
              type="checkbox"
              checked={dim.configured}
              onChange={(e) => onChange({ ...dim, configured: e.target.checked })}
            />
            Override
          </label>
        )}
      </div>
      {disabled ? (
        <p className="text-xs italic text-slate-400">Follows the global configuration.</p>
      ) : (
        children
      )}
    </div>
  );
};

/** Global row, or one module override. */
const ScopeForm = ({ value, onChange, showConfigured, branches, aliases, aliasesLoading }) => {
  const [ownerUsers, setOwnerUsers] = useState([]); // {id,label} for display

  const patch = (key) => (next) => onChange({ ...value, [key]: next });

  const toggleIn = (dim, field, id) => {
    const list = dim[field] || [];
    return { ...dim, [field]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] };
  };

  return (
    <div className="space-y-3">
      <Dimension
        title="Branch"
        hint="Which branch's records this person can see."
        showConfigured={showConfigured}
        dim={value.branch}
        onChange={patch('branch')}
      >
        <div className="space-y-3">
          <ModeRadios
            name={`branch-${showConfigured ? 'mod' : 'global'}`}
            options={TRI}
            value={value.branch.scope}
            onChange={(scope) => patch('branch')({ ...value.branch, scope })}
          />
          {value.branch.scope === 'SELECTED' && (
            <div className="flex flex-wrap gap-2">
              {branches.map((b) => (
                <Chip
                  key={b._id}
                  active={(value.branch.allowedBranchIds || []).includes(b._id)}
                  onClick={() => patch('branch')(toggleIn(value.branch, 'allowedBranchIds', b._id))}
                >
                  {b.name}
                </Chip>
              ))}
            </div>
          )}
          {value.branch.scope === 'OWN' && (
            <p className="text-xs text-amber-700">
              Needs a branch on their HRMS account — without one every branch-scoped screen refuses the request.
            </p>
          )}
        </div>
      </Dimension>

      <Dimension
        title="Entity"
        hint="Which company's paperwork — Purchase Orders, Invoices, Tracking Orders."
        showConfigured={showConfigured}
        dim={value.entity}
        onChange={patch('entity')}
      >
        <div className="space-y-3">
          <ModeRadios
            name={`entity-${showConfigured ? 'mod' : 'global'}`}
            options={ENTITY_MODES}
            value={value.entity.scope}
            onChange={(scope) => patch('entity')({ ...value.entity, scope })}
          />
          {value.entity.scope === 'SELECTED' && (
            <>
              <div className="flex flex-wrap gap-2">
                {aliasesLoading ? (
                  <p className="text-sm text-slate-400">Loading entities…</p>
                ) : (
                  aliases.map((a) => (
                    <Chip
                      key={a}
                      active={(value.entity.allowedEntityAliases || []).includes(a)}
                      onClick={() => patch('entity')(toggleIn(value.entity, 'allowedEntityAliases', a))}
                    >
                      {a}
                    </Chip>
                  ))
                )}
              </div>
              <button
                type="button"
                onClick={() => patch('entity')({ ...value.entity, scope: 'ALL', allowedEntityAliases: [] })}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
              >
                Select all → switches to “All”, so entities added later are included automatically
              </button>
              {(value.entity.allowedEntityAliases || []).length === 0 && (
                <p className="text-xs text-amber-700">
                  Nothing selected — this person sees no purchase orders, invoices or tracking orders.
                </p>
              )}
            </>
          )}
        </div>
      </Dimension>

      <Dimension
        title="Record ownership"
        hint="Whose created records — applies to Quotations, Purchase Orders and Invoices."
        showConfigured={showConfigured}
        dim={value.recordOwnership}
        onChange={patch('recordOwnership')}
      >
        <div className="space-y-3">
          <ModeRadios
            name={`own-${showConfigured ? 'mod' : 'global'}`}
            options={TRI}
            value={value.recordOwnership.scope}
            onChange={(scope) => patch('recordOwnership')({ ...value.recordOwnership, scope })}
          />
          {value.recordOwnership.scope === 'SELECTED' && (
            <div className="space-y-2">
              <Picker
                fetcher={searchHrmsUsers}
                placeholder="Add a user whose records they may see…"
                selected={null}
                onSelect={(u) => {
                  setOwnerUsers((prev) => (prev.some((p) => p.id === u.id) ? prev : [...prev, u]));
                  patch('recordOwnership')(toggleIn(value.recordOwnership, 'allowedUserIds', u.id));
                }}
                onClear={() => {}}
              />
              <div className="flex flex-wrap gap-2">
                {(value.recordOwnership.allowedUserIds || []).map((id) => (
                  <Chip
                    key={id}
                    active
                    onClick={() => patch('recordOwnership')(toggleIn(value.recordOwnership, 'allowedUserIds', id))}
                  >
                    {ownerUsers.find((u) => u.id === id)?.label || `${String(id).slice(-6)} ✕`}
                  </Chip>
                ))}
              </div>
            </div>
          )}
          {value.recordOwnership.scope === 'OWN' && (
            <p className="text-xs text-amber-700">
              Only records they created themselves. An approver needs Selected or All, or their queue stays empty.
            </p>
          )}
        </div>
      </Dimension>
    </div>
  );
};

export default function DataScopeEditor({ user }) {
  const [modules, setModules] = useState([]);
  const [branches, setBranches] = useState([]);
  const { aliases, loading: aliasesLoading } = useInternalEntities();

  const [global, setGlobal] = useState(EMPTY);
  const [overrides, setOverrides] = useState([]); // [{ moduleId, moduleName, dims }]
  const [addModuleId, setAddModuleId] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getModules().then((r) => setModules(r.data || [])).catch((e) => toast.error(e.message));
    getActiveBranches().then(setBranches).catch((e) => toast.error(e.message));
  }, []);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await getDataScopes(user.id);
      const g = res.data?.global;
      // Global is the baseline, so every dimension always counts there —
      // `configured` is only meaningful on an override.
      setGlobal(
        g
          ? {
              branch: { ...EMPTY.branch, ...g.branch, configured: true },
              entity: { ...EMPTY.entity, ...g.entity, configured: true },
              recordOwnership: { ...EMPTY.recordOwnership, ...g.recordOwnership, configured: true },
            }
          : EMPTY
      );
      setOverrides(
        (res.data?.moduleOverrides || []).map((o) => ({
          moduleId: o.moduleId?._id || o.moduleId,
          moduleName: o.moduleId?.name || 'Module',
          dims: {
            branch: { ...EMPTY.branch, ...o.branch },
            entity: { ...EMPTY.entity, ...o.entity },
            recordOwnership: { ...EMPTY.recordOwnership, ...o.recordOwnership },
          },
        }))
      );
    } catch (err) {
      toast.error(err.message || 'Failed to load data scopes');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (moduleId, dims) => {
    setSaving(true);
    try {
      await setDataScope({ userId: user.id, moduleId: moduleId || null, ...dims });
      toast.success(moduleId ? 'Module override saved.' : 'Global data access saved.');
      await load();
    } catch (err) {
      toast.error(err.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const removeOverride = async (moduleId) => {
    try {
      await clearModuleDataScope({ userId: user.id, moduleId });
      toast.success('Override removed — this module follows the global scope again.');
      await load();
    } catch (err) {
      toast.error(err.message || 'Failed to remove override.');
    }
  };

  if (!user) {
    return <Card><p className="text-sm text-slate-400">Pick a user to configure their data access.</p></Card>;
  }

  const usedModuleIds = new Set(overrides.map((o) => o.moduleId));
  const addable = modules.filter((m) => !usedModuleIds.has(m._id));

  return (
    <div className="space-y-5">
      <Card
        title="Global data access"
        description="The user's default across every module. Nothing is granted automatically — an unconfigured user sees only their own records, in their own branch, and no entity at all."
      >
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : (
          <div className="space-y-4">
            <ScopeForm
              value={global}
              onChange={setGlobal}
              showConfigured={false}
              branches={branches}
              aliases={aliases}
              aliasesLoading={aliasesLoading}
            />
            <PrimaryButton onClick={() => save(null, global)} disabled={saving}>
              {saving ? 'Saving…' : 'Save global access'}
            </PrimaryButton>
          </div>
        )}
      </Card>

      <Card
        title="Module overrides"
        description="Exceptions to the global configuration. Only the dimensions you tick as “Override” are replaced — the rest keep following global."
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={addModuleId}
              onChange={(e) => setAddModuleId(e.target.value)}
              className={`${inputCls} max-w-xs appearance-none`}
            >
              <option value="">Add an override for…</option>
              {addable.map((m) => (
                <option key={m._id} value={m._id}>{m.name}</option>
              ))}
            </select>
            <PrimaryButton
              disabled={!addModuleId}
              onClick={() => {
                const m = modules.find((x) => x._id === addModuleId);
                setOverrides((prev) => [...prev, { moduleId: m._id, moduleName: m.name, dims: EMPTY }]);
                setAddModuleId('');
              }}
            >
              Add
            </PrimaryButton>
          </div>

          {overrides.length === 0 ? (
            <p className="text-sm text-slate-400">No overrides — every module follows the global configuration.</p>
          ) : (
            overrides.map((o, i) => (
              <div key={o.moduleId} className="rounded-2xl border border-indigo-200 bg-indigo-50/30 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">{o.moduleName}</p>
                  <button
                    type="button"
                    onClick={() => removeOverride(o.moduleId)}
                    className="text-xs font-medium text-rose-600 hover:text-rose-700"
                  >
                    Remove override
                  </button>
                </div>
                <ScopeForm
                  value={o.dims}
                  onChange={(dims) =>
                    setOverrides((prev) => prev.map((x, j) => (j === i ? { ...x, dims } : x)))
                  }
                  showConfigured
                  branches={branches}
                  aliases={aliases}
                  aliasesLoading={aliasesLoading}
                />
                <div className="mt-3">
                  <PrimaryButton onClick={() => save(o.moduleId, o.dims)} disabled={saving}>
                    {saving ? 'Saving…' : `Save ${o.moduleName} override`}
                  </PrimaryButton>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
