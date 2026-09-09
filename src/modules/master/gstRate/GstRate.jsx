'use client'
import { API_BACKEND_URL } from '@/config/getEnvVariables';
import Pagination from '@/shared/ui/pagination/Pagination';
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';

/* ======================== CONSTANTS ======================== */

const GST_RATES_API = `${API_BACKEND_URL}/stock/gst-rates`;

const STATUS_FILTERS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const DEFAULT_ITEMS_PER_PAGE = 10;

const EMPTY_FORM = {
  rate: '',
  label: '',
  description: '',
  order: 0,
};

const formFromGstRate = (item) => ({
  rate: item.rate,
  label: item.label,
  description: item.description,
  order: item.order ?? 0,
});

/* ---------- Design tokens — SAME as Branch/FieldDefinition ---------- */

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";

const th = "px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-700";
const thRight = `${th} text-right`;

/* ======================== API FUNCTIONS ======================== */

// The backend exposes a single `showInactive` boolean (false => active only,
// true => everything). There is no "inactive only" query, so that case is
// narrowed client-side below — same as the other master screens.
const getGstRates = async ({ page, limit, search, showInactive }) => {
  const params = new URLSearchParams();
  params.set('page', page);
  params.set('limit', limit);
  if (search) params.set('search', search);
  if (showInactive) params.set('showInactive', 'true');

  const response = await fetch(`${GST_RATES_API}?${params.toString()}`, {
    method: 'GET',
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Failed to fetch GST rates');
  return response.json();
};

const createGstRate = async (payload) => {
  const response = await fetch(GST_RATES_API, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || 'Failed to create GST rate');
  return data;
};

const updateGstRate = async (id, payload) => {
  const response = await fetch(`${GST_RATES_API}/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || 'Failed to update GST rate');
  return data;
};

const deleteGstRate = async (id) => {
  const response = await fetch(`${GST_RATES_API}/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || 'Failed to delete GST rate');
  return data;
};

const restoreGstRate = async (id) => {
  const response = await fetch(`${GST_RATES_API}/${id}/restore`, {
    method: 'PATCH',
    credentials: 'include',
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || 'Failed to restore GST rate');
  return data;
};

/* ======================== UTILITY FUNCTIONS ======================== */

const mapGstRateResponse = (item) => ({
  id: item._id,
  rate: item.rate,
  label: item.label || `${item.rate}%`,
  description: item.description || '',
  order: item.order ?? 0,
  isActive: item.isActive !== false,
});

/* ======================== ICONS (inline, no extra deps) ======================== */

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
  eye: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
      <path d="M1.5 10S4.5 4 10 4s8.5 6 8.5 6-3 6-8.5 6-8.5-6-8.5-6Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
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
  arrowLeft: (
    <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5">
      <path d="M12.5 5 7.5 10l5 5M7.5 10H17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

/* ======================== UI HELPER COMPONENTS ======================== */

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
    slate: 'text-slate-400 hover:bg-slate-100 hover:text-slate-700',
    indigo: 'text-slate-400 hover:bg-indigo-50 hover:text-indigo-600',
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

const LoadingRows = ({ columns = 6, rows = 5 }) => (
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

const EmptyState = ({ colSpan, onCreateClick }) => (
  <tr>
    <td colSpan={colSpan} className="px-6 py-16">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-300">
          {Icon.empty}
        </div>
        <p className="mt-4 text-sm font-medium text-slate-700">No GST rates yet</p>
        <p className="mt-1 max-w-sm text-sm text-slate-400">
          Adjust your filters, or add the slabs your products are billed at.
        </p>
        <button
          onClick={onCreateClick}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
        >
          {Icon.plus} Add GST rate
        </button>
      </div>
    </td>
  </tr>
);

const ErrorState = ({ colSpan, message, onRetry }) => (
  <tr>
    <td colSpan={colSpan} className="px-6 py-16">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-500">
          {Icon.alert}
        </div>
        <p className="mt-3 text-sm font-medium text-slate-800">Couldn&apos;t load GST rates</p>
        <p className="mt-1 max-w-sm text-sm text-slate-400">{message}</p>
        <button
          onClick={onRetry}
          className="mt-4 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          Try again
        </button>
      </div>
    </td>
  </tr>
);

/* ======================== HEADER + FILTER BAR ======================== */

const Header = ({ totalItems, onCreateClick }) => (
  <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">GST rates</h1>
      <p className="mt-0.5 text-sm text-slate-500">
        {typeof totalItems === 'number' ? `${totalItems} rate${totalItems === 1 ? '' : 's'} · ` : ''}
        The slabs offered wherever a product or line is priced.
      </p>
    </div>
    <button
      onClick={onCreateClick}
      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
    >
      {Icon.plus} Add GST rate
    </button>
  </div>
);

const FilterBar = ({ search, onSearchChange, statusFilter, onStatusFilterChange }) => (
  <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div className="relative sm:col-span-2">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
          {Icon.search}
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by rate, label or description"
          className={`${inputCls} pl-9`}
        />
      </div>

      <div className="relative">
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
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
);

/* ======================== TABLE ======================== */

const TableRow = ({ item, onView, onEdit, onDelete, onRestore }) => (
  <tr className="transition hover:bg-slate-50/60">
    <td className="px-4 py-3.5 font-mono text-sm text-slate-500">{item.order}</td>
    <td className="px-4 py-3.5"><RatePill rate={item.rate} /></td>
    <td className="px-4 py-3.5 text-sm font-medium text-slate-900">{item.label}</td>
    <td className="px-4 py-3.5 text-sm text-slate-500">
      {item.description || <span className="text-slate-300">—</span>}
    </td>
    <td className="px-4 py-3.5"><StatusBadge isActive={item.isActive} /></td>
    <td className="px-4 py-3.5">
      <div className="flex items-center justify-end gap-1">
        <IconBtn onClick={() => onView(item)} title="View" tone="indigo">{Icon.eye}</IconBtn>
        <IconBtn onClick={() => onEdit(item)} title="Edit" tone="orange">{Icon.edit}</IconBtn>
        {item.isActive ? (
          <IconBtn onClick={() => onDelete(item)} title="Retire" tone="red">{Icon.trash}</IconBtn>
        ) : (
          <IconBtn onClick={() => onRestore(item)} title="Restore" tone="emerald">{Icon.restore}</IconBtn>
        )}
      </div>
    </td>
  </tr>
);

const Table = ({ items, loading, error, onRetry, onCreateClick, onView, onEdit, onDelete, onRestore }) => (
  <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
    <table className="min-w-full divide-y divide-slate-200">
      <thead className="bg-slate-50/60">
        <tr>
          <th className={th}>Order</th>
          <th className={th}>Rate</th>
          <th className={th}>Label</th>
          <th className={th}>Description</th>
          <th className={th}>Status</th>
          <th className={thRight}>Action</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {error ? (
          <ErrorState colSpan={6} message={error} onRetry={onRetry} />
        ) : loading ? (
          <LoadingRows columns={6} />
        ) : items.length === 0 ? (
          <EmptyState colSpan={6} onCreateClick={onCreateClick} />
        ) : (
          items.map((item) => (
            <TableRow key={item.id} item={item} onView={onView} onEdit={onEdit} onDelete={onDelete} onRestore={onRestore} />
          ))
        )}
      </tbody>
    </table>
  </div>
);

/* ======================== MODAL SHELL ======================== */

// createPortal into document.body so it is never clipped by a parent's overflow.
const Modal = ({ title, description, onClose, children, maxWidth = 'max-w-lg' }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
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

  if (!mounted) return null;

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

const ConfirmModal = ({ open, title = 'Confirm action', message, confirmLabel = 'Retire', onCancel, onConfirm, loading }) => {
  if (!open) return null;
  return (
    <Modal title={title} onClose={onCancel} maxWidth="max-w-sm">
      <div className="flex flex-col items-center gap-3 py-1 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-500">
          {Icon.alert}
        </div>
        <p className="text-sm text-slate-600">{message}</p>
      </div>
      <div className="mt-5 flex justify-center gap-2.5">
        <button
          onClick={onCancel}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Retiring…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
};

/* ======================== FORM ======================== */

// `required` renders the same rose asterisk the product-definition form uses,
// so a starred label means exactly one thing across every master screen: the
// submit is blocked until it is filled in.
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

const fieldInputClass = inputCls + ' disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400';

const FORM_TITLES = {
  create: { title: 'Add GST rate', description: 'Add a slab to the list every pricing screen picks from.' },
  edit: { title: 'Edit GST rate', description: 'Update this slab’s label, note or position.' },
  view: { title: 'GST rate details', description: 'Read-only view of this slab.' },
};

/* Full page, not a dialog — same in-place swap the branch and product
   definition masters use, so Back always lands on the list it came from. */
const FormPage = ({ mode, formData, onChange, onSubmit, onCancel, submitting, errors }) => {
  const isView = mode === 'view';
  const { title, description } = FORM_TITLES[mode] || FORM_TITLES.create;

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-3">
          <button
            type="button" onClick={onCancel} disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {Icon.arrowLeft} Back
          </button>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h1>
            <p className="mt-0.5 text-sm text-slate-500">{description}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Rate (%)"
                required
                hint="The percentage itself — this is what gets stored on every priced line."
                error={errors.rate}
              >
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.rate}
                  disabled={isView}
                  onChange={(e) => onChange('rate', e.target.value)}
                  placeholder="e.g. 18"
                  className={`${fieldInputClass} tabular-nums`}
                />
              </Field>

              <Field label="Order" hint="Position in every GST dropdown (lower shows first)." error={errors.order}>
                <input
                  type="number"
                  value={formData.order}
                  disabled={isView}
                  onChange={(e) => onChange('order', e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 1"
                  className={fieldInputClass}
                />
              </Field>
            </div>

            <Field label="Label" hint="Leave blank to use the rate itself — e.g. “18%”." error={errors.label}>
              <input
                type="text"
                value={formData.label}
                disabled={isView}
                onChange={(e) => onChange('label', e.target.value)}
                placeholder={formData.rate !== '' && formData.rate !== null ? `${formData.rate}%` : 'e.g. 40% (Demerit)'}
                className={fieldInputClass}
              />
            </Field>

            <Field label="Description" hint="Optional note for whoever maintains this later.">
              <textarea
                rows={3}
                value={formData.description}
                disabled={isView}
                onChange={(e) => onChange('description', e.target.value)}
                placeholder="e.g. Standard rate — most goods and services"
                className={`${fieldInputClass} resize-y`}
              />
            </Field>

            {/* Retiring a slab is safe precisely because nothing points at this
                row — saying so here stops it being treated as dangerous. */}
            {!isView && mode === 'edit' && (
              <div className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
                <span>
                  Products and orders already priced at this slab store the number, not a link to this
                  row — editing or retiring it never changes an existing document.
                </span>
              </div>
            )}

            {errors.general && (
              <div className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
                {Icon.alert}
                <span>{errors.general}</span>
              </div>
            )}
          </div>

          <div className="-mx-6 mt-6 flex justify-end gap-2.5 border-t border-slate-100 px-6 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
            >
              {isView ? 'Back to list' : 'Cancel'}
            </button>
            {!isView && (
              <button
                type="button"
                onClick={onSubmit}
                disabled={submitting}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Create GST rate'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ======================== MAIN COMPONENT ======================== */

const GstRate = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [totalItems, setTotalItems] = useState(0);

  // null = the list; 'create' | 'edit' | 'view' = the full-page form in place of it.
  const [formMode, setFormMode] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [activeItemId, setActiveItemId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  const [confirmTarget, setConfirmTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadGstRates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getGstRates({
        page: currentPage,
        limit: itemsPerPage,
        search,
        showInactive: statusFilter !== 'active',
      });
      let mapped = (response?.data || []).map(mapGstRateResponse);
      let total = response?.pagination?.total ?? mapped.length;

      if (statusFilter === 'inactive') {
        mapped = mapped.filter((f) => !f.isActive);
        total = mapped.length;
      }

      setItems(mapped);
      setTotalItems(total);
    } catch (err) {
      setError(err.message || 'Something went wrong while loading GST rates.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, search, statusFilter]);

  useEffect(() => {
    loadGstRates();
  }, [loadGstRates]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  const openCreateForm = () => {
    setFormData(EMPTY_FORM);
    setFormErrors({});
    setActiveItemId(null);
    setFormMode('create');
  };

  const openForm = (mode) => (item) => {
    setFormData(formFromGstRate(item));
    setFormErrors({});
    setActiveItemId(item.id);
    setFormMode(mode);
  };

  const closeForm = () => {
    setFormMode(null);
    setActiveItemId(null);
    setFormErrors({});
  };

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear the field's own error as soon as it is touched, rather than
    // leaving it up until the next submit.
    setFormErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  const validateForm = () => {
    const errors = {};
    if (formData.rate === '' || formData.rate === null) {
      errors.rate = 'Rate is required.';
    } else {
      const rate = Number(formData.rate);
      if (!Number.isFinite(rate)) errors.rate = 'Rate must be a number.';
      else if (rate < 0 || rate > 100) errors.rate = 'Rate must be between 0 and 100.';
    }
    if (formData.order !== '' && !Number.isFinite(Number(formData.order))) {
      errors.order = 'Order must be a number.';
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
        rate: Number(formData.rate),
        // Blank means "track the rate" — the backend fills it in.
        label: formData.label.trim(),
        description: formData.description.trim(),
        order: formData.order === '' ? 0 : Number(formData.order),
      };

      if (formMode === 'create') {
        await createGstRate(payload);
        toast.success('GST rate created successfully.');
      } else if (formMode === 'edit') {
        await updateGstRate(activeItemId, payload);
        toast.success('GST rate updated successfully.');
      }

      closeForm();
      await loadGstRates();
    } catch (err) {
      const message = err.message || 'Failed to save GST rate.';
      setFormErrors({ general: message });
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (item) => setConfirmTarget(item);

  const handleConfirmDelete = async () => {
    if (!confirmTarget) return;
    setDeleting(true);
    try {
      await deleteGstRate(confirmTarget.id);
      toast.success('GST rate retired successfully.');
      setConfirmTarget(null);
      await loadGstRates();
    } catch (err) {
      toast.error(err.message || 'Failed to retire GST rate.');
    } finally {
      setDeleting(false);
    }
  };

  const handleRestore = async (item) => {
    try {
      await restoreGstRate(item.id);
      toast.success('GST rate restored successfully.');
      await loadGstRates();
    } catch (err) {
      toast.error(err.message || 'Failed to restore GST rate.');
    }
  };

  if (formMode) {
    return (
      <FormPage
        mode={formMode}
        formData={formData}
        onChange={handleFormChange}
        onSubmit={handleSubmit}
        onCancel={closeForm}
        submitting={submitting}
        errors={formErrors}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <Header totalItems={totalItems} onCreateClick={openCreateForm} />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      <Table
        items={items}
        loading={loading}
        error={error}
        onRetry={loadGstRates}
        onCreateClick={openCreateForm}
        onView={openForm('view')}
        onEdit={openForm('edit')}
        onDelete={handleDeleteClick}
        onRestore={handleRestore}
      />

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

      {/* "Retire", not "Delete" — the row goes inactive and drops out of every
          picker, while everything already priced at it is untouched. */}
      <ConfirmModal
        open={!!confirmTarget}
        title="Retire this GST rate?"
        message={
          confirmTarget
            ? `${confirmTarget.label} will stop appearing in GST dropdowns. Products and orders already priced at it keep that rate, and you can restore it later.`
            : ''
        }
        onCancel={() => setConfirmTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
      />
    </div>
  );
};

export default GstRate;
