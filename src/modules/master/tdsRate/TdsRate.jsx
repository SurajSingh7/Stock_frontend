'use client'
import { API_BACKEND_URL } from '@/config/getEnvVariables';
import Pagination from '@/shared/ui/pagination/Pagination';
import useInternalEntities from '@/modules/stock/shared/useInternalEntities';
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';

/* ======================== CONSTANTS ======================== */

const TDS_RATES_API = `${API_BACKEND_URL}/stock/tds-rates`;

const STATUS_FILTERS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const DEFAULT_ITEMS_PER_PAGE = 10;

const EMPTY_FORM = { entityAlias: '', rate: '', note: '' };

/* ---------- Design tokens — SAME as GST Rate ---------- */

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";
const fieldInputClass = inputCls + ' disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400';

const th = "px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-700";
const thRight = `${th} text-right`;

/* ======================== API FUNCTIONS ======================== */

const request = async (url, options, fallback) => {
  const response = await fetch(url, { credentials: 'include', ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || fallback);
  return data;
};

const getTdsRates = ({ page, limit, search, showInactive }) => {
  const params = new URLSearchParams({ page, limit });
  if (search) params.set('search', search);
  if (showInactive) params.set('showInactive', 'true');
  return request(`${TDS_RATES_API}?${params.toString()}`, { method: 'GET' }, 'Failed to fetch TDS rates');
};

const json = (method, payload) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});

const createTdsRate = (payload) => request(TDS_RATES_API, json('POST', payload), 'Failed to create TDS rate');
const updateTdsRate = (id, payload) => request(`${TDS_RATES_API}/${id}`, json('PUT', payload), 'Failed to update TDS rate');
const deleteTdsRate = (id) => request(`${TDS_RATES_API}/${id}`, { method: 'DELETE' }, 'Failed to delete TDS rate');
const restoreTdsRate = (id) => request(`${TDS_RATES_API}/${id}/restore`, { method: 'PATCH' }, 'Failed to restore TDS rate');

const mapTdsRate = (item) => ({
  id: item._id,
  entityAlias: item.entityAlias,
  rate: item.rate,
  note: item.note || '',
  isActive: item.isActive !== false,
});

/* ======================== ICONS ======================== */

const Icon = {
  search: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
      <path d="M9 16a7 7 0 1 1 0-14 7 7 0 0 1 0 14Zm9 2-4.35-4.35" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  edit: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
      <path d="M14.2 2.8a1.8 1.8 0 0 1 2.5 2.5L6 15.9l-3.5.7.7-3.5L14.2 2.8Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  ),
  trash: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
      <path d="M3 5.5h14M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M5.5 5.5 6 16a1.5 1.5 0 0 0 1.5 1.4h5a1.5 1.5 0 0 0 1.5-1.4l.5-10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  restore: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
      <path d="M3 10a7 7 0 1 1 2 4.9M3 10V5.5M3 10h4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  close: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
      <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  empty: (
    <svg viewBox="0 0 48 48" fill="none" className="h-10 w-10">
      <rect x="9" y="11" width="30" height="26" rx="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M18 30 30 18M19.5 20.5h.01M28.5 27.5h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  alert: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0">
      <path d="M12 8v5M12 16h.01M3.5 18 12 3.5 20.5 18a1.5 1.5 0 0 1-1.3 2.25H4.8A1.5 1.5 0 0 1 3.5 18Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  ),
  chevronDown: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
      <path d="M5 7.5 10 12.5 15 7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

/* ======================== UI HELPERS ======================== */

const StatusBadge = ({ isActive }) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
      isActive ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-500 ring-slate-200'
    }`}
  >
    <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
    {isActive ? 'Active' : 'Inactive'}
  </span>
);

const RatePill = ({ rate }) => (
  <span className="inline-flex items-center rounded-lg bg-indigo-50 px-2.5 py-1 text-sm font-semibold tabular-nums text-indigo-700 ring-1 ring-inset ring-indigo-100">
    {rate}%
  </span>
);

const IconBtn = ({ onClick, title, tone = 'slate', children }) => {
  const tones = {
    orange: 'text-slate-400 hover:bg-amber-50 hover:text-amber-600',
    red: 'text-slate-400 hover:bg-rose-50 hover:text-rose-600',
    emerald: 'text-slate-400 hover:bg-emerald-50 hover:text-emerald-600',
  };
  return (
    <button type="button" onClick={onClick} title={title} className={`rounded-lg p-1.5 transition ${tones[tone]}`}>
      {children}
    </button>
  );
};

const LoadingRows = ({ columns, rows = 4 }) => (
  <>
    {Array.from({ length: rows }).map((_, r) => (
      <tr key={r} className="animate-pulse">
        {Array.from({ length: columns }).map((__, c) => (
          <td key={c} className="px-4 py-4">
            <div className="h-3 rounded bg-slate-100" style={{ width: `${55 + ((r + c) % 4) * 10}%` }} />
          </td>
        ))}
      </tr>
    ))}
  </>
);

const Field = ({ label, hint, error, required, children }) => (
  <div>
    <label className="mb-1.5 block text-sm font-medium text-slate-700">
      {label}
      {required && <span className="ml-0.5 text-rose-500">*</span>}
    </label>
    {children}
    {hint && !error && <p className="mt-1.5 text-xs text-slate-400">{hint}</p>}
    {error && <p className="mt-1.5 text-xs font-medium text-rose-600">{error}</p>}
  </div>
);

// createPortal into document.body so it is never clipped by a parent's overflow.
const Modal = ({ title, description, onClose, children, maxWidth = 'max-w-lg' }) => {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className={`max-h-[90vh] w-full ${maxWidth} flex flex-col overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/5`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-start justify-between border-b border-slate-100 bg-white px-5 py-4">
          <div>
            <p className="truncate pr-4 text-base font-semibold tracking-tight text-slate-900">{title}</p>
            {description && <p className="mt-0.5 text-sm text-slate-400">{description}</p>}
          </div>
          <button
            type="button" onClick={onClose}
            className="shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            {Icon.close}
          </button>
        </div>
        <div className="flex-1 p-5">{children}</div>
      </div>
    </div>,
    document.body
  );
};

/* ======================== FORM POPUP ======================== */

const FormModal = ({ mode, formData, onChange, onSubmit, onCancel, submitting, errors, aliases, entitiesLoading }) => (
  <Modal
    title={mode === 'edit' ? 'Edit TDS rate' : 'Add TDS rate'}
    description="Deducted on the basic amount (without GST and extra charges) when an invoice of this entity is approved."
    onClose={onCancel}
  >
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Entity" required error={errors.entityAlias} hint="Same rate for every state of the entity.">
          <div className="relative">
            <select
              value={formData.entityAlias}
              onChange={(e) => onChange('entityAlias', e.target.value)}
              disabled={entitiesLoading}
              className={`${fieldInputClass} appearance-none pr-8`}
            >
              <option value="">{entitiesLoading ? 'Loading…' : 'Select entity'}</option>
              {/* Keep an entity that has since left the list selectable on edit. */}
              {[...new Set([...aliases, formData.entityAlias].filter(Boolean))].map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-slate-400">
              {Icon.chevronDown}
            </span>
          </div>
        </Field>

        <Field label="Rate (%)" required error={errors.rate}>
          <input
            type="number" min="0" max="100" step="0.01"
            value={formData.rate}
            onChange={(e) => onChange('rate', e.target.value)}
            placeholder="e.g. 2"
            className={`${fieldInputClass} tabular-nums`}
          />
        </Field>
      </div>

      <Field label="Note" hint="Optional — e.g. the section (194C, 194Q).">
        <textarea
          rows={2}
          value={formData.note}
          onChange={(e) => onChange('note', e.target.value)}
          placeholder="e.g. 194C"
          className={`${fieldInputClass} resize-y`}
        />
      </Field>

      {mode === 'edit' && (
        <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
          Invoices already approved keep the rate they were approved at — a change here applies to new approvals only.
        </div>
      )}

      {errors.general && (
        <div className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
          {Icon.alert}
          <span>{errors.general}</span>
        </div>
      )}
    </div>

    <div className="-mx-5 mt-5 flex justify-end gap-2.5 border-t border-slate-100 px-5 pt-4">
      <button
        type="button" onClick={onCancel}
        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
      >
        Cancel
      </button>
      <button
        type="button" onClick={onSubmit} disabled={submitting}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Save TDS rate'}
      </button>
    </div>
  </Modal>
);

const ConfirmModal = ({ target, onCancel, onConfirm, loading }) => (
  <Modal title="Retire this TDS rate?" onClose={onCancel} maxWidth="max-w-sm">
    <div className="flex flex-col items-center gap-3 py-1 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-500">
        {Icon.alert}
      </div>
      <p className="text-sm text-slate-600">
        New invoices of {target.entityAlias} will be approved with 0% TDS. Invoices already approved keep their TDS, and you can restore this later.
      </p>
    </div>
    <div className="mt-5 flex justify-center gap-2.5">
      <button
        onClick={onCancel}
        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
      >
        Cancel
      </button>
      <button
        onClick={onConfirm} disabled={loading}
        className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Retiring…' : 'Retire'}
      </button>
    </div>
  </Modal>
);

/* ======================== MAIN COMPONENT ======================== */

const TdsRate = () => {
  const { aliases, loading: entitiesLoading } = useInternalEntities();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [totalItems, setTotalItems] = useState(0);

  // null = closed; 'create' | 'edit' = the popup.
  const [formMode, setFormMode] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [activeItemId, setActiveItemId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  const [confirmTarget, setConfirmTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadTdsRates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getTdsRates({
        page: currentPage,
        limit: itemsPerPage,
        search,
        showInactive: statusFilter !== 'active',
      });
      let mapped = (response?.data || []).map(mapTdsRate);
      let total = response?.pagination?.total ?? mapped.length;
      // The backend has no "inactive only" query — narrowed here, as on GST Rates.
      if (statusFilter === 'inactive') {
        mapped = mapped.filter((f) => !f.isActive);
        total = mapped.length;
      }
      setItems(mapped);
      setTotalItems(total);
    } catch (err) {
      setError(err.message || 'Something went wrong while loading TDS rates.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, search, statusFilter]);

  useEffect(() => {
    loadTdsRates();
  }, [loadTdsRates]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  const openCreate = () => {
    setFormData(EMPTY_FORM);
    setFormErrors({});
    setActiveItemId(null);
    setFormMode('create');
  };

  const openEdit = (item) => {
    setFormData({ entityAlias: item.entityAlias, rate: item.rate, note: item.note });
    setFormErrors({});
    setActiveItemId(item.id);
    setFormMode('edit');
  };

  const closeForm = useCallback(() => {
    setFormMode(null);
    setActiveItemId(null);
    setFormErrors({});
  }, []);

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFormErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.entityAlias) errors.entityAlias = 'Entity is required.';
    if (formData.rate === '' || formData.rate === null) {
      errors.rate = 'Rate is required.';
    } else {
      const rate = Number(formData.rate);
      if (!Number.isFinite(rate)) errors.rate = 'Rate must be a number.';
      else if (rate < 0 || rate > 100) errors.rate = 'Rate must be between 0 and 100.';
    }
    return errors;
  };

  const handleSubmit = async () => {
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setSubmitting(true);
    setFormErrors({});
    try {
      const payload = {
        entityAlias: formData.entityAlias,
        rate: Number(formData.rate),
        note: String(formData.note || '').trim(),
      };
      if (formMode === 'create') {
        await createTdsRate(payload);
        toast.success('TDS rate created successfully.');
      } else {
        await updateTdsRate(activeItemId, payload);
        toast.success('TDS rate updated successfully.');
      }
      closeForm();
      await loadTdsRates();
    } catch (err) {
      const message = err.message || 'Failed to save TDS rate.';
      setFormErrors({ general: message });
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmTarget) return;
    setDeleting(true);
    try {
      await deleteTdsRate(confirmTarget.id);
      toast.success('TDS rate retired successfully.');
      setConfirmTarget(null);
      await loadTdsRates();
    } catch (err) {
      toast.error(err.message || 'Failed to retire TDS rate.');
    } finally {
      setDeleting(false);
    }
  };

  const handleRestore = async (item) => {
    try {
      await restoreTdsRate(item.id);
      toast.success('TDS rate restored successfully.');
      await loadTdsRates();
    } catch (err) {
      toast.error(err.message || 'Failed to restore TDS rate.');
    }
  };

  const COLS = 5;

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">TDS rates</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {`${totalItems} rate${totalItems === 1 ? '' : 's'} · `}
            Held back from the vendor payable on the basic amount, per buying entity. No rate = 0%.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
        >
          {Icon.plus} Add TDS rate
        </button>
      </div>

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="relative sm:col-span-2">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
              {Icon.search}
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by entity, rate or note"
              className={`${inputCls} pl-9`}
            />
          </div>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`${inputCls} appearance-none pr-8`}
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-slate-400">
              {Icon.chevronDown}
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50/60">
            <tr>
              <th className={th}>Entity</th>
              <th className={th}>Rate</th>
              <th className={th}>Note</th>
              <th className={th}>Status</th>
              <th className={thRight}>Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {error ? (
              <tr>
                <td colSpan={COLS} className="px-6 py-16 text-center">
                  <p className="text-sm font-medium text-slate-800">Couldn&apos;t load TDS rates</p>
                  <p className="mt-1 text-sm text-slate-400">{error}</p>
                  <button
                    onClick={loadTdsRates}
                    className="mt-4 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                  >
                    Try again
                  </button>
                </td>
              </tr>
            ) : loading ? (
              <LoadingRows columns={COLS} />
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={COLS} className="px-6 py-16">
                  <div className="flex flex-col items-center text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-300">
                      {Icon.empty}
                    </div>
                    <p className="mt-4 text-sm font-medium text-slate-700">No TDS rates yet</p>
                    <p className="mt-1 max-w-sm text-sm text-slate-400">
                      Until an entity has a rate, its invoices are approved with 0% TDS.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="transition hover:bg-slate-50/60">
                  <td className="px-4 py-3.5 text-sm font-semibold text-slate-900">{item.entityAlias}</td>
                  <td className="px-4 py-3.5"><RatePill rate={item.rate} /></td>
                  <td className="px-4 py-3.5 text-sm text-slate-500">
                    {item.note || <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3.5"><StatusBadge isActive={item.isActive} /></td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      {item.isActive ? (
                        <>
                          <IconBtn onClick={() => openEdit(item)} title="Edit" tone="orange">{Icon.edit}</IconBtn>
                          <IconBtn onClick={() => setConfirmTarget(item)} title="Retire" tone="red">{Icon.trash}</IconBtn>
                        </>
                      ) : (
                        <IconBtn onClick={() => handleRestore(item)} title="Restore" tone="emerald">{Icon.restore}</IconBtn>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!error && totalItems > 0 && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <Pagination
            currentPage={currentPage}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(value) => {
              setItemsPerPage(value);
              setCurrentPage(1);
            }}
          />
        </div>
      )}

      {formMode && (
        <FormModal
          mode={formMode}
          formData={formData}
          onChange={handleFormChange}
          onSubmit={handleSubmit}
          onCancel={closeForm}
          submitting={submitting}
          errors={formErrors}
          aliases={aliases}
          entitiesLoading={entitiesLoading}
        />
      )}

      {confirmTarget && (
        <ConfirmModal
          target={confirmTarget}
          onCancel={() => setConfirmTarget(null)}
          onConfirm={handleConfirmDelete}
          loading={deleting}
        />
      )}
    </div>
  );
};

export default TdsRate;
