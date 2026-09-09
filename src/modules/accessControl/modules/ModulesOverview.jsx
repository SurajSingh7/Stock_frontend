'use client';
import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { getModules } from '../api';
import { PageShell, Card, ActionPill, ScopePill, Mono, Banner, TableShell, EmptyRow, inputCls } from '../shared';

/* What each dimension actually filters on, in plain language. Shown next to
   the badge because "entity" means nothing to someone who has not read the
   backend registry. */
const DIMENSION_HELP = {
  branch: { label: 'Branch', blurb: 'Filtered to the branch(es) the user may see' },
  entity: { label: 'Entity', blurb: 'Filtered to the companies the user may work on' },
  ownership: { label: 'Ownership', blurb: 'Filtered to records the user created' },
};

const DimensionBadge = ({ dim }) => {
  const tones = {
    branch: 'border-sky-200 bg-sky-50 text-sky-700',
    entity: 'border-violet-200 bg-violet-50 text-violet-700',
    ownership: 'border-teal-200 bg-teal-50 text-teal-700',
  };
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[0.7rem] font-semibold ${tones[dim] || 'border-slate-200 bg-slate-50 text-slate-600'}`}>
      {DIMENSION_HELP[dim]?.label || dim}
    </span>
  );
};

export default function ModulesOverview() {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getModules()
      .then((res) => setModules(res.data || []))
      .catch((err) => toast.error(err.message || 'Failed to load modules'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return modules;
    return modules.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.key.toLowerCase().includes(q) ||
        (m.actions || []).some((a) => a.toLowerCase().includes(q))
    );
  }, [modules, search]);

  const unregistered = modules.filter((m) => m.scopeDimensions === null);
  const totalActions = modules.reduce((n, m) => n + (m.actions || []).length, 0);
  const scopedCount = modules.filter((m) => (m.scopeDimensions || []).length > 0).length;

  return (
    <PageShell
      question="Reference"
      title="Modules & Actions"
      description="Every area of the system that can be granted, the exact actions each one defines, and which data-scope dimensions its records are filtered by. This is the vocabulary the Roles, Departments and Users screens draw from."
    >
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Modules', value: modules.length },
          { label: 'Grantable actions', value: totalActions },
          { label: 'Data-scoped', value: scopedCount },
          { label: 'Shared master data', value: modules.length - scopedCount },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-2xl font-bold tabular-nums tracking-tight text-slate-900">{s.value}</p>
            <p className="mt-0.5 text-xs font-medium text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {unregistered.length > 0 && (
        <div className="mb-5">
          <Banner tone="error">
            <strong>{unregistered.length} module(s)</strong> are not in the backend data-scope registry
            ({unregistered.map((m) => m.key).join(', ')}). Requests to them fail closed until an entry is
            added to <Mono>config/data.scope.registry.js</Mono> — use <Mono>{'{}'}</Mono> if no scope applies.
          </Banner>
        </div>
      )}

      <Card
        title="All modules"
        description="Actions are per module, not a fixed CRUD set — Purchase Orders genuinely need APPROVE and SEND_MAIL, Categories need REORDER and MOVE."
        badge={
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search modules or actions…"
            className={`${inputCls} w-64`}
          />
        }
      >
        <TableShell head={['Module', 'Key', 'Actions', 'Data scope']}>
          {loading ? (
            <EmptyRow colSpan={4}>Loading…</EmptyRow>
          ) : filtered.length === 0 ? (
            <EmptyRow colSpan={4}>Nothing matches “{search}”.</EmptyRow>
          ) : (
            filtered.map((m) => {
              const dims = m.scopeDimensions || [];
              return (
                <tr key={m._id} className="align-top transition hover:bg-slate-50/60">
                  <td className="px-4 py-3.5 text-sm font-semibold whitespace-nowrap text-slate-900">{m.name}</td>
                  <td className="px-4 py-3.5"><Mono>{m.key}</Mono></td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap gap-1.5">
                      {(m.actions || []).map((a) => <ActionPill key={a}>{a}</ActionPill>)}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    {m.scopeDimensions === null ? (
                      <span className="text-xs font-semibold text-rose-600">not registered</span>
                    ) : dims.length === 0 ? (
                      <span className="text-xs text-slate-400">
                        Unscoped — shared master data everyone needs
                      </span>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap gap-1.5">
                          {dims.map((d) => <DimensionBadge key={d} dim={d} />)}
                        </div>
                        <p className="text-[0.7rem] leading-relaxed text-slate-400">
                          {dims.map((d) => DIMENSION_HELP[d]?.blurb).filter(Boolean).join(' · ')}
                        </p>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </TableShell>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
          <span className="font-semibold text-slate-600">Dimensions:</span>
          {Object.keys(DIMENSION_HELP).map((d) => (
            <span key={d} className="flex items-center gap-1.5">
              <DimensionBadge dim={d} />
              {DIMENSION_HELP[d].blurb}
            </span>
          ))}
        </div>
      </Card>

      <div className="mt-5">
        <Card title="Why this list is read-only" tone="accent">
          <p className="text-sm leading-relaxed text-slate-600">
            Modules and their actions are defined in code and seeded on boot, and which dimensions apply to
            each is declared in the backend registry. Both live beside the Mongoose schemas they describe, so
            adding a field and registering it happen in the same change — a database-backed setting could
            drift from the actual model, or be misconfigured into a lockout or a leak. Grant these actions to
            roles under <strong>Roles</strong>, narrow them per department under <strong>Departments</strong>,
            and make individual exceptions under <strong>Users</strong>.
          </p>
        </Card>
      </div>
    </PageShell>
  );
}
