'use client';
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import Pagination from '@/shared/ui/pagination/Pagination';
import { getActivityLog, getEntityHistory } from '../api';
import { searchHrmsUsers } from '../hrmsDirectory';
import { PageShell, Card, Field, Picker, inputCls } from '../shared';
import AuditDetail from './AuditDetail';
import {
  ACTION_DOT_CLASS,
  ACTION_TONE_CLASS,
  actionLabel,
  actionTone,
  dayKey,
  dayLabel,
  entityLabel,
  fmtClock,
  fmtDateTime,
  fmtRelative,
  meaningfulFields,
} from './auditFormat';

const ENTITY_TYPES = [
  'field-definitions', 'categories', 'product-definitions', 'vendors', 'terms-conditions',
  'inventory-items', 'quotations', 'purchase-orders', 'tracking-orders', 'invoices',
  'branches', 'transfer-requests', 'notifications', 'Permission',
];

/* Presets write into the same from/to the API already takes, so a quick range
   is a real server-side filter — not a client-side trim of one page. */
const isoDay = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return d.toISOString().slice(0, 10);
};
const RANGE_PRESETS = [
  { key: 'today', label: 'Today', from: () => isoDay(0), to: () => isoDay(0) },
  { key: '7d', label: 'Last 7 days', from: () => isoDay(6), to: () => isoDay(0) },
  { key: '30d', label: 'Last 30 days', from: () => isoDay(29), to: () => isoDay(0) },
];

/* ── Row ─────────────────────────────────────────────────────────────────── */

const FieldChips = ({ event }) => {
  const fields = meaningfulFields(event);
  if (fields.length === 0) {
    return event.reason ? (
      <span className="line-clamp-1 text-sm text-slate-500">{event.reason}</span>
    ) : (
      <span className="text-sm text-slate-300">—</span>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-1">
      {fields.slice(0, 3).map((f) => (
        <span
          key={f}
          className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[0.68rem] text-slate-600"
        >
          {f}
        </span>
      ))}
      {fields.length > 3 && (
        <span className="text-[0.68rem] font-semibold text-slate-400">+{fields.length - 3} more</span>
      )}
    </span>
  );
};

const EventRow = ({ event, onOpen }) => {
  const tone = actionTone(event.action);
  return (
    <tr onClick={() => onOpen(event)} title="Open full details" className="group cursor-pointer transition hover:bg-indigo-50/40">
      <td className="whitespace-nowrap px-4 py-3 align-top" title={fmtDateTime(event.createdAt)}>
        <div className="flex items-start gap-2.5">
          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${ACTION_DOT_CLASS[tone]}`} />
          <div>
            <p className="font-mono text-[0.8rem] font-medium text-slate-700">{fmtClock(event.createdAt)}</p>
            <p className="text-[0.7rem] text-slate-400">{fmtRelative(event.createdAt)}</p>
          </div>
        </div>
      </td>
      <td className="whitespace-nowrap px-4 py-3 align-top">
        <span
          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[0.7rem] font-bold tracking-wide ${ACTION_TONE_CLASS[tone]}`}
        >
          {actionLabel(event.action)}
        </span>
      </td>
      <td className="px-4 py-3 align-top">
        <p className="text-sm font-medium text-slate-800">{entityLabel(event.entityType)}</p>
        <p className="font-mono text-[0.7rem] text-slate-400">…{String(event.entityId).slice(-8)}</p>
      </td>
      <td className="px-4 py-3 align-top">
        <p className="text-sm text-slate-800">
          {event.actor?.name || <span className="text-slate-300">—</span>}
          {event.actor?.employeeCode && (
            <span className="ml-1.5 rounded border border-slate-200 bg-slate-50 px-1 py-0.5 font-mono text-[0.65rem] text-slate-500">
              {event.actor.employeeCode}
            </span>
          )}
        </p>
        {event.actor?.roleName && <p className="text-[0.7rem] text-slate-400">{event.actor.roleName}</p>}
      </td>
      <td className="px-4 py-3 align-top"><FieldChips event={event} /></td>
      <td className="px-4 py-3 text-right align-top">
        <span className="text-xs font-semibold text-indigo-600 opacity-0 transition group-hover:opacity-100">
          Details →
        </span>
      </td>
    </tr>
  );
};

const SkeletonRows = () =>
  Array.from({ length: 6 }).map((_, i) => (
    <tr key={i}>
      {[36, 20, 28, 24, 40, 8].map((w, j) => (
        <td key={j} className="px-4 py-3.5">
          <div className="h-3 animate-pulse rounded bg-slate-100" style={{ width: `${w * 3}%` }} />
        </td>
      ))}
    </tr>
  ));

const EventTable = ({ rows, loading, onOpen }) => {
  // Events arrive newest-first; a day heading between them turns a flat list
  // into something you can scan by "what happened on Tuesday".
  const groups = useMemo(() => {
    const out = [];
    let current = null;
    for (const row of rows) {
      const key = dayKey(row.createdAt);
      if (!current || current.key !== key) {
        current = { key, label: dayLabel(row.createdAt), rows: [] };
        out.push(current);
      }
      current.rows.push(row);
    }
    return out;
  }, [rows]);

  const th = 'px-4 py-2.5 text-left text-[0.66rem] font-bold uppercase tracking-wider text-slate-500';

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full">
        <thead className="border-b border-slate-200 bg-slate-50/80">
          <tr>
            <th className={th}>Time</th>
            <th className={th}>Action</th>
            <th className={th}>Record</th>
            <th className={th}>Who</th>
            <th className={th}>Fields touched</th>
            <th className={`${th} text-right`}>&nbsp;</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? (
            <SkeletonRows />
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-6 py-16 text-center">
                <p className="text-3xl text-slate-200">◷</p>
                <p className="mt-2 text-sm font-medium text-slate-600">No events match this filter.</p>
                <p className="mt-1 text-xs text-slate-400">
                  Widen the date range, or clear the actor and entity type to see everything.
                </p>
              </td>
            </tr>
          ) : (
            groups.map((group) => (
              <React.Fragment key={group.key}>
                <tr className="bg-slate-50/70">
                  <td colSpan={6} className="px-4 py-1.5">
                    <span className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-slate-500">
                      {group.label}
                    </span>
                    <span className="ml-2 text-[0.68rem] text-slate-400">
                      {group.rows.length} event{group.rows.length === 1 ? '' : 's'}
                    </span>
                  </td>
                </tr>
                {group.rows.map((event) => (
                  <EventRow key={event._id} event={event} onOpen={onOpen} />
                ))}
              </React.Fragment>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

/* ── Page ────────────────────────────────────────────────────────────────── */

const AuditLog = () => {
  const [mode, setMode] = useState('activity'); // 'activity' | 'entity'

  const [user, setUser] = useState(null); // { id, label, description }
  const [entityType, setEntityType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [lookupEntityType, setLookupEntityType] = useState(ENTITY_TYPES[0]);
  const [entityId, setEntityId] = useState('');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState(null);

  const loadActivity = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (user?.id) params.userId = user.id;
      if (entityType) params.entityType = entityType;
      if (from) params.from = from;
      if (to) params.to = to;
      const res = await getActivityLog(params);
      setRows(res.data || []);
      setTotal(res.pagination?.total ?? (res.data || []).length);
    } catch (err) {
      toast.error(err.message || 'Failed to load activity log');
    } finally {
      setLoading(false);
    }
  }, [user, entityType, from, to, page, limit]);

  const loadEntity = useCallback(async () => {
    if (!entityId.trim()) {
      setRows([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    try {
      const res = await getEntityHistory({ entityType: lookupEntityType, entityId: entityId.trim(), page, limit });
      setRows(res.data || []);
      setTotal(res.pagination?.total ?? (res.data || []).length);
    } catch (err) {
      toast.error(err.message || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [lookupEntityType, entityId, page, limit]);

  useEffect(() => {
    if (mode === 'activity') loadActivity();
    else loadEntity();
  }, [mode, loadActivity, loadEntity]);

  /* Every filter goes back to page 1, because page 4 of the old filter is
     meaningless under the new one. Done in the event handler rather than in an
     effect watching the filters: an effect fires a render AFTER the fetch has
     already started on the stale page, so the list was quietly loaded twice on
     every filter change. */
  const setFilter = (setter) => (value) => {
    setPage(1);
    setter(value);
  };

  const refresh = () => (mode === 'activity' ? loadActivity() : loadEntity());

  const applyPreset = (preset) => {
    setPage(1);
    setFrom(preset.from());
    setTo(preset.to());
  };

  const clearFilters = () => {
    setPage(1);
    setUser(null);
    setEntityType('');
    setFrom('');
    setTo('');
  };

  /* Jumping from one event to that record's whole life is the move an admin
     makes constantly, and pasting a Mongo id by hand was the only way to do
     it before. */
  const openRecordHistory = (event) => {
    setPage(1);
    setLookupEntityType(event.entityType);
    setEntityId(String(event.entityId));
    setMode('entity');
    setSelected(null);
  };

  const activePreset = RANGE_PRESETS.find((p) => p.from() === from && p.to() === to)?.key || null;
  const activeFilters = [
    user && { key: 'user', label: `Actor: ${user.label}`, clear: () => setFilter(setUser)(null) },
    entityType && { key: 'type', label: `Type: ${entityLabel(entityType)}`, clear: () => setFilter(setEntityType)('') },
    from && { key: 'from', label: `From ${from}`, clear: () => setFilter(setFrom)('') },
    to && { key: 'to', label: `To ${to}`, clear: () => setFilter(setTo)('') },
  ].filter(Boolean);

  // An entity type from a row may not be one of the known options — keep the
  // select honest rather than silently snapping to a different type.
  const lookupOptions = ENTITY_TYPES.includes(lookupEntityType)
    ? ENTITY_TYPES
    : [lookupEntityType, ...ENTITY_TYPES];

  const firstOnPage = total === 0 ? 0 : (page - 1) * limit + 1;
  const lastOnPage = Math.min(page * limit, total);

  const list = (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
          {['activity', 'entity'].map((m) => (
            <button
              key={m}
              onClick={() => { setPage(1); setMode(m); }}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                mode === m ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {m === 'activity' ? 'Global activity' : 'One record’s history'}
            </button>
          ))}
        </div>

        <p className="text-sm text-slate-500">
          {loading ? (
            'Loading…'
          ) : total > 0 ? (
            <>
              <span className="font-semibold text-slate-900">{total.toLocaleString()}</span> event
              {total === 1 ? '' : 's'} match this view
              <span className="text-slate-300"> · </span>
              showing {firstOnPage}–{lastOnPage}
            </>
          ) : (
            'Nothing to show yet'
          )}
        </p>
      </div>

      <Card className="mb-5">
        {mode === 'activity' ? (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <Field label="Actor">
                <Picker
                  fetcher={searchHrmsUsers}
                  placeholder="Filter by actor…"
                  selected={user}
                  onSelect={setFilter(setUser)}
                  onClear={() => setFilter(setUser)(null)}
                />
              </Field>
              <Field label="Entity type">
                <select
                  value={entityType}
                  onChange={(e) => setFilter(setEntityType)(e.target.value)}
                  className={`${inputCls} appearance-none`}
                >
                  <option value="">All types</option>
                  {ENTITY_TYPES.map((t) => (
                    <option key={t} value={t}>{entityLabel(t)}</option>
                  ))}
                </select>
              </Field>
              <Field label="From">
                <input type="date" value={from} onChange={(e) => setFilter(setFrom)(e.target.value)} className={inputCls} />
              </Field>
              <Field label="To">
                <input type="date" value={to} onChange={(e) => setFilter(setTo)(e.target.value)} className={inputCls} />
              </Field>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3.5">
              <span className="text-[0.68rem] font-bold uppercase tracking-wide text-slate-400">Quick range</span>
              {RANGE_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    activePreset === preset.key
                      ? 'border-indigo-300 bg-indigo-600 text-white shadow-sm'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {preset.label}
                </button>
              ))}

              {activeFilters.length > 0 && (
                <>
                  <span className="mx-1 h-4 w-px bg-slate-200" />
                  {activeFilters.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={f.clear}
                      title="Remove this filter"
                      className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
                    >
                      {f.label}
                      <span className="text-indigo-400">✕</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-xs font-semibold text-slate-400 underline-offset-2 hover:text-slate-700 hover:underline"
                  >
                    Clear all
                  </button>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Entity type">
              <select
                value={lookupEntityType}
                onChange={(e) => setFilter(setLookupEntityType)(e.target.value)}
                className={`${inputCls} appearance-none`}
              >
                {lookupOptions.map((t) => (
                  <option key={t} value={t}>{entityLabel(t)}</option>
                ))}
              </select>
            </Field>
            <Field
              label="Entity ID"
              hint="The record’s Mongo _id. Easier route: find the record in Global activity and use “See this record’s full history”."
            >
              <input
                type="text"
                value={entityId}
                onChange={(e) => setFilter(setEntityId)(e.target.value)}
                placeholder="e.g. 6a86dff4b50ccc53e42fa88b"
                className={`${inputCls} font-mono`}
              />
            </Field>
            {entityId.trim() && (
              <div className="flex items-start sm:pt-7">
                <button
                  type="button"
                  onClick={() => setFilter(setEntityId)('')}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
                >
                  Clear record
                </button>
              </div>
            )}
          </div>
        )}
      </Card>

      <EventTable rows={rows} loading={loading} onOpen={setSelected} />

      {total > 0 && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <Pagination
            currentPage={page}
            totalItems={total}
            itemsPerPage={limit}
            onPageChange={setPage}
            onItemsPerPageChange={(v) => { setLimit(v); setPage(1); }}
          />
        </div>
      )}

      <p className="mt-4 text-center text-xs text-slate-400">
        Events are written by the backend after an action succeeds, and are never edited or deleted.
        Times are shown in your own timezone.
      </p>
    </>
  );

  return (
    <PageShell
      question="Accountability"
      title="Audit Log"
      description={
        selected
          ? 'One event in full — the exact fields that moved, and who moved them.'
          : 'Who did what, when — every create, update, delete and approve, plus every permission and data-scope change. Open any event to see the exact fields that moved, and from which value to which.'
      }
      actions={
        selected ? null : (
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
          >
            <span className={loading ? 'inline-block animate-spin' : ''}>↻</span>
            Refresh
          </button>
        )
      }
    >
      {/* The list stays mounted in state, not on screen: going back to it costs
          no request, and lands on the same page of the same filter.
          Keyed on the event so opening a different one starts fresh. */}
      {selected ? (
        <AuditDetail
          key={selected._id}
          event={selected}
          onBack={() => setSelected(null)}
          onViewRecordHistory={openRecordHistory}
        />
      ) : (
        list
      )}
    </PageShell>
  );
};

export default AuditLog;
