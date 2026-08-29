'use client';
import React, { useState, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import Pagination from '@/shared/ui/pagination/Pagination';
import { getActivityLog, getEntityHistory } from '../api';
import { searchHrmsUsers } from '../hrmsDirectory';
import { PageHeader, Card, Field, Picker, inputCls, th, EmptyRow } from '../shared';

const ENTITY_TYPES = [
  'field-definitions', 'categories', 'product-definitions', 'vendors', 'terms-conditions',
  'inventory-items', 'quotations', 'purchase-orders', 'tracking-orders', 'invoices',
  'branches', 'transfer-requests', 'notifications', 'Permission',
];

const fmtDate = (iso) => new Date(iso).toLocaleString();

const ResultsTable = ({ rows, loading }) => (
  <div className="overflow-x-auto rounded-xl border border-slate-200">
    <table className="min-w-full divide-y divide-slate-200">
      <thead className="bg-slate-50/60">
        <tr>
          <th className={th}>When</th>
          <th className={th}>Entity</th>
          <th className={th}>Action</th>
          <th className={th}>By</th>
          <th className={th}>Changed</th>
          <th className={th}>Reason</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {loading ? (
          <EmptyRow colSpan={6}>Loading…</EmptyRow>
        ) : rows.length === 0 ? (
          <EmptyRow colSpan={6}>No activity found for this filter.</EmptyRow>
        ) : (
          rows.map((r) => (
            <tr key={r._id}>
              <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">{fmtDate(r.createdAt)}</td>
              <td className="px-4 py-3 text-sm text-slate-700">
                {r.entityType}
                <span className="ml-1.5 text-xs text-slate-400 font-mono">{String(r.entityId).slice(-6)}</span>
              </td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                  {r.action}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-slate-700">{r.actor?.name || <span className="text-slate-300">—</span>}</td>
              <td className="px-4 py-3 text-sm text-slate-500">{(r.changedFields || []).join(', ') || <span className="text-slate-300">—</span>}</td>
              <td className="px-4 py-3 text-sm text-slate-500">{r.reason || <span className="text-slate-300">—</span>}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

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
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);

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

  useEffect(() => setPage(1), [mode, user, entityType, from, to, lookupEntityType, entityId]);

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <PageHeader title="Audit Log" description="Who did what, when — every create, update, delete, approve and permission change." />

      <div className="mb-5 inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
        {['activity', 'entity'].map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              mode === m ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {m === 'activity' ? 'Global activity' : 'One record’s history'}
          </button>
        ))}
      </div>

      <Card className="mb-5">
        {mode === 'activity' ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <Field label="Actor">
              <Picker fetcher={searchHrmsUsers} placeholder="Filter by actor…" selected={user} onSelect={setUser} onClear={() => setUser(null)} />
            </Field>
            <Field label="Entity type">
              <select value={entityType} onChange={(e) => setEntityType(e.target.value)} className={`${inputCls} appearance-none`}>
                <option value="">All</option>
                {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="From"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} /></Field>
            <Field label="To"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} /></Field>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Entity type">
              <select value={lookupEntityType} onChange={(e) => setLookupEntityType(e.target.value)} className={`${inputCls} appearance-none`}>
                {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Entity ID" hint="The record's Mongo _id.">
              <input type="text" value={entityId} onChange={(e) => setEntityId(e.target.value)} placeholder="e.g. 6a86dff4b50ccc53e42fa88b" className={`${inputCls} font-mono`} />
            </Field>
          </div>
        )}
      </Card>

      <ResultsTable rows={rows} loading={loading} />

      {total > 0 && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <Pagination currentPage={page} totalItems={total} itemsPerPage={limit} onPageChange={setPage} onItemsPerPageChange={(v) => { setLimit(v); setPage(1); }} />
        </div>
      )}
    </div>
  );
};

export default AuditLog;
