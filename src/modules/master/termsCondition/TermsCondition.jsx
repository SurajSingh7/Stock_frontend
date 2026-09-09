'use client'
import { API_BACKEND_URL } from '@/config/getEnvVariables';
import Pagination from '@/shared/ui/pagination/Pagination';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';

/* ======================== CONSTANTS ======================== */

const TERMS_CONDITIONS_API = `${API_BACKEND_URL}/stock/terms-conditions`;
const VENDORS_API = `${API_BACKEND_URL}/stock/vendors`;

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

// dropdown-only status filter for the list, no "All" option — same
// convention as the Field Definitions master.
const STATUS_FILTERS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const DEFAULT_ITEMS_PER_PAGE = 10;

const EMPTY_FORM = {
  termName: '',
  isDefault: false,
  applicableVendors: [], // [{ id, name }]
  termsContent: '',
  status: 'ACTIVE',
};

/* ---------- Design tokens — SAME as FieldDefinition / VendorsComp ---------- */

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";

const th = "px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-700";
const thRight = `${th} text-right`;

/* ======================== SANITIZE (defense-in-depth — backend also strips this) ======================== */

const sanitizeForPreview = (html) =>
  String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '');

/* ======================== API FUNCTIONS ======================== */

const getTermsConditions = async ({ page, limit, search, showInactive }) => {
  const params = new URLSearchParams();
  params.set('page', page);
  params.set('limit', limit);
  if (search) params.set('search', search);
  if (showInactive) params.set('showInactive', 'true');

  const response = await fetch(`${TERMS_CONDITIONS_API}?${params.toString()}`, {
    method: 'GET',
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Failed to fetch Terms & Conditions');
  return response.json();
};

const createTermsCondition = async (payload) => {
  const response = await fetch(TERMS_CONDITIONS_API, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || 'Failed to create Terms & Conditions');
  return data;
};

const updateTermsCondition = async (id, payload) => {
  const response = await fetch(`${TERMS_CONDITIONS_API}/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || 'Failed to update Terms & Conditions');
  return data;
};

const deleteTermsCondition = async (id) => {
  const response = await fetch(`${TERMS_CONDITIONS_API}/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || 'Failed to delete Terms & Conditions');
  return data;
};

const restoreTermsCondition = async (id) => {
  const response = await fetch(`${TERMS_CONDITIONS_API}/${id}/restore`, {
    method: 'PATCH',
    credentials: 'include',
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || 'Failed to restore Terms & Conditions');
  return data;
};

const searchVendors = async (search) => {
  const params = new URLSearchParams();
  params.set('page', '1');
  params.set('limit', '20');
  if (search) params.set('search', search);

  const response = await fetch(`${VENDORS_API}?${params.toString()}`, {
    method: 'GET',
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Failed to fetch vendors');
  const json = await response.json();
  return (json?.data || []).map((v) => ({ id: v._id, name: v.name }));
};

/* ======================== UTILITY FUNCTIONS ======================== */

const mapTermResponse = (item) => ({
  id: item._id,
  termName: item.termName,
  isDefault: !!item.isDefault,
  applicableVendors: (item.applicableVendors || []).map((v) =>
    typeof v === 'string' ? { id: v, name: v } : { id: v._id, name: v.name }
  ),
  termsContent: item.termsContent || '',
  status: item.status || 'ACTIVE',
  isActive: item.isActive !== false,
  createdAt: item.createdAt,
});

const formatDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

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
  closeSmall: (
    <svg viewBox="0 0 20 20" fill="none" className="h-3 w-3">
      <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  empty: (
    <svg viewBox="0 0 48 48" fill="none" className="h-10 w-10">
      <rect x="9" y="11" width="30" height="26" rx="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 19h30M16 26h6M16 31h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
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
  star: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path d="M10 2.2l2.24 4.9 5.36.6-4 3.72 1.1 5.28L10 13.9l-4.7 2.8 1.1-5.28-4-3.72 5.36-.6L10 2.2Z" />
    </svg>
  ),
  bold: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
      <path d="M6 4h5a3 3 0 0 1 0 6H6V4Zm0 6h5.5a3 3 0 0 1 0 6H6v-6Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ),
  italic: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
      <path d="M9 4h6M5 16h6M12 4 8 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  underline: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
      <path d="M5 3v6a5 5 0 0 0 10 0V3M4 17h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  listBullet: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
      <circle cx="3.5" cy="5" r="1" fill="currentColor" />
      <circle cx="3.5" cy="10" r="1" fill="currentColor" />
      <circle cx="3.5" cy="15" r="1" fill="currentColor" />
      <path d="M7.5 5h9M7.5 10h9M7.5 15h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  listNumber: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
      <path d="M7.5 5h9M7.5 10h9M7.5 15h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <text x="1" y="7" fontSize="5" fill="currentColor">1</text>
      <text x="1" y="12" fontSize="5" fill="currentColor">2</text>
      <text x="1" y="17" fontSize="5" fill="currentColor">3</text>
    </svg>
  ),
  link: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
      <path d="M8.5 11.5a3 3 0 0 0 4.24 0l2-2a3 3 0 0 0-4.24-4.24l-1 1M11.5 8.5a3 3 0 0 0-4.24 0l-2 2a3 3 0 0 0 4.24 4.24l1-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  clear: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
      <path d="M6 4h9l-4 12H7L3 8m9-4L6 16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

/* ======================== UI HELPER COMPONENTS ======================== */

const StatusBadge = ({ status }) => {
  const isActive = status === 'ACTIVE';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
        isActive
          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
          : 'bg-slate-100 text-slate-500 ring-slate-200'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
};

const DefaultBadge = ({ value }) =>
  value ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
      {Icon.star} Yes
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-200">
      No
    </span>
  );

const ApplicableVendorsCell = ({ item }) => {
  if (item.isDefault) {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-medium text-amber-700">
        {Icon.star} All Vendors
      </span>
    );
  }
  const names = item.applicableVendors.map((v) => v.name).filter(Boolean);
  if (names.length === 0) return <span className="text-sm text-slate-300">—</span>;
  const shown = names.slice(0, 2).join(', ');
  const extra = names.length - 2;
  return (
    <span className="text-sm text-slate-700">
      {shown}
      {extra > 0 && <span className="ml-1 font-medium text-indigo-600">+{extra} more</span>}
    </span>
  );
};

/* IconBtn — SAME tone pattern as FieldDefinition/VendorsComp */
const IconBtn = ({ onClick, title, tone = 'slate', children }) => {
  const toneCls =
    tone === 'indigo' ? "text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50"
    : tone === 'red' ? "text-rose-600 hover:border-rose-200 hover:bg-rose-50"
    : tone === 'emerald' ? "text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50"
    : tone === 'orange' ? "text-orange-500 hover:border-orange-200 hover:bg-orange-50"
    : "text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700";
  return (
    <button
      type="button" onClick={onClick} title={title} aria-label={title}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 ${toneCls}`}
    >
      {children}
    </button>
  );
};

const LoadingRows = ({ columns = 7, rows = 6 }) => (
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
        <p className="mt-4 text-sm font-medium text-slate-700">No terms & conditions yet</p>
        <p className="mt-1 text-sm text-slate-400">Adjust your filters, or add a new term to get started.</p>
        <button
          onClick={onCreateClick}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
        >
          {Icon.plus} Add New
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
        <p className="mt-3 text-sm font-medium text-slate-800">Couldn&apos;t load Terms & Conditions</p>
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

/* ======================== HEADER (title + top-right search & Add New) ======================== */

const Header = ({ totalItems, search, onSearchChange, onCreateClick }) => (
  <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">Terms & Conditions Master</h1>
      <p className="mt-0.5 text-sm text-slate-500">
        {typeof totalItems === 'number' ? `${totalItems} term${totalItems === 1 ? '' : 's'} · ` : ''}
        Vendor-specific and default purchase order terms.
      </p>
    </div>
    <div className="flex items-center gap-2.5">
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
          {Icon.search}
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by term name"
          className={`${inputCls} w-64 pl-9`}
        />
      </div>
      <button
        onClick={onCreateClick}
        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
      >
        {Icon.plus} Add New
      </button>
    </div>
  </div>
);

/* ======================== FILTER BAR ======================== */

const FilterBar = ({ statusFilter, onStatusFilterChange }) => (
  <div className="mb-6 flex justify-end">
    <div className="relative">
      <select
        value={statusFilter}
        onChange={(e) => onStatusFilterChange(e.target.value)}
        className={`${inputCls} w-40 appearance-none pr-8`}
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
);

/* ======================== TABLE ======================== */

const TERM_TABLE_COLUMNS = ['#', 'Term Name', 'Default', 'Applicable Vendors', 'Status', 'Created On', 'Action'];

const TableRow = ({ item, index, onView, onEdit, onDelete, onRestore }) => (
  <tr className="transition hover:bg-slate-50/60">
    <td className="px-4 py-3.5 text-sm text-slate-500">{index}</td>
    <td className="px-4 py-3.5 text-sm font-medium text-slate-900">{item.termName}</td>
    <td className="px-4 py-3.5"><DefaultBadge value={item.isDefault} /></td>
    <td className="px-4 py-3.5"><ApplicableVendorsCell item={item} /></td>
    <td className="px-4 py-3.5"><StatusBadge status={item.status} /></td>
    <td className="px-4 py-3.5 text-sm text-slate-500">{formatDate(item.createdAt)}</td>
    <td className="px-4 py-3.5">
      <div className="flex items-center justify-end gap-1">
        <IconBtn onClick={() => onView(item)} title="View" tone="indigo">{Icon.eye}</IconBtn>
        <IconBtn onClick={() => onEdit(item)} title="Edit" tone="orange">{Icon.edit}</IconBtn>
        {item.isActive ? (
          <IconBtn onClick={() => onDelete(item)} title="Delete" tone="red">{Icon.trash}</IconBtn>
        ) : (
          <IconBtn onClick={() => onRestore(item)} title="Restore" tone="emerald">{Icon.restore}</IconBtn>
        )}
      </div>
    </td>
  </tr>
);

const Table = ({ items, startIndex, loading, error, onRetry, onCreateClick, onView, onEdit, onDelete, onRestore }) => (
  <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
    <table className="min-w-full divide-y divide-slate-200">
      <thead className="bg-slate-50/60">
        <tr>
          {TERM_TABLE_COLUMNS.map((label) => (
            <th key={label} className={label === 'Action' ? thRight : th}>{label}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {error ? (
          <ErrorState colSpan={TERM_TABLE_COLUMNS.length} message={error} onRetry={onRetry} />
        ) : loading ? (
          <LoadingRows columns={TERM_TABLE_COLUMNS.length} />
        ) : items.length === 0 ? (
          <EmptyState colSpan={TERM_TABLE_COLUMNS.length} onCreateClick={onCreateClick} />
        ) : (
          items.map((item, i) => (
            <TableRow
              key={item.id}
              item={item}
              index={startIndex + i}
              onView={onView}
              onEdit={onEdit}
              onDelete={onDelete}
              onRestore={onRestore}
            />
          ))
        )}
      </tbody>
    </table>
  </div>
);

/* ======================== MODAL SHELL (reusable, portal-based) ======================== */

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
        className={`max-h-[92vh] w-full ${maxWidth} flex flex-col overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/5`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white px-5 py-4">
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

/* ======================== CONFIRM MODAL ======================== */

const ConfirmModal = ({ open, title = 'Confirm action', message, confirmLabel = 'Delete', onCancel, onConfirm, loading }) => {
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
          {loading ? 'Deleting…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
};

/* ======================== FORM FIELD COMPONENTS ======================== */

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

const Switch = ({ checked, onChange, disabled, labels = ['No', 'Yes'] }) => (
  <div className="flex items-center gap-3">
    <button
      type="button" disabled={disabled} onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${checked ? 'bg-indigo-600' : 'bg-slate-300'} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
    <span className={`text-sm font-medium ${checked ? 'text-indigo-700' : 'text-slate-500'}`}>
      {checked ? labels[1] : labels[0]}
    </span>
  </div>
);

const StatusToggle = ({ value, onChange, disabled }) => (
  <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
    {STATUS_OPTIONS.map((s) => (
      <button
        key={s.value} type="button" disabled={disabled}
        onClick={() => onChange(s.value)}
        className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition ${
          value === s.value ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'
        } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        {s.label}
      </button>
    ))}
  </div>
);

/* ---------- Rich text editor (contentEditable + execCommand toolbar, no extra deps) ---------- */

const ToolbarBtn = ({ onClick, title, children }) => (
  <button
    type="button"
    onMouseDown={(e) => e.preventDefault()} // keep editor selection alive when clicking the toolbar
    onClick={onClick}
    title={title}
    aria-label={title}
    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-200/70 hover:text-slate-900"
  >
    {children}
  </button>
);

const RichTextEditor = ({ value, onChange, disabled, error }) => {
  const editorRef = useRef(null);

  // Uncontrolled on purpose (typing would otherwise reset the caret) — the
  // parent Modal fully unmounts/remounts this on open/close, so a fresh
  // `value` is always the correct initial HTML for a new edit/view session.
  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = value || '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exec = (cmd, arg = null) => {
    if (disabled) return;
    editorRef.current?.focus();
    document.execCommand(cmd, false, arg);
    onChange(editorRef.current?.innerHTML || '');
  };

  const handleLink = () => {
    const url = window.prompt('Enter URL');
    if (url) exec('createLink', url);
  };

  return (
    <div className={`overflow-hidden rounded-lg border ${error ? 'border-rose-300' : 'border-slate-200'} bg-white shadow-sm`}>
      {!disabled && (
        <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-100 bg-slate-50/70 px-2 py-1.5">
          <ToolbarBtn onClick={() => exec('bold')} title="Bold">{Icon.bold}</ToolbarBtn>
          <ToolbarBtn onClick={() => exec('italic')} title="Italic">{Icon.italic}</ToolbarBtn>
          <ToolbarBtn onClick={() => exec('underline')} title="Underline">{Icon.underline}</ToolbarBtn>
          <span className="mx-1 h-4 w-px bg-slate-200" />
          <ToolbarBtn onClick={() => exec('insertUnorderedList')} title="Bullet list">{Icon.listBullet}</ToolbarBtn>
          <ToolbarBtn onClick={() => exec('insertOrderedList')} title="Numbered list">{Icon.listNumber}</ToolbarBtn>
          <span className="mx-1 h-4 w-px bg-slate-200" />
          <ToolbarBtn onClick={handleLink} title="Insert link">{Icon.link}</ToolbarBtn>
          <ToolbarBtn onClick={() => exec('removeFormat')} title="Clear formatting">{Icon.clear}</ToolbarBtn>
        </div>
      )}
      <div
        ref={editorRef}
        contentEditable={!disabled}
        onInput={() => onChange(editorRef.current?.innerHTML || '')}
        suppressContentEditableWarning
        data-placeholder="Enter terms & conditions…"
        className={`min-h-[150px] max-h-72 overflow-y-auto px-3 py-2.5 text-sm text-slate-900 focus:outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-indigo-600 [&_a]:underline empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)] ${disabled ? 'bg-slate-50 text-slate-500' : ''}`}
      />
    </div>
  );
};

/* ---------- Searchable vendor multi-select with chips ---------- */

const VendorMultiSelect = ({ selected, onChange, disabled, error }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const list = await searchVendors(query);
        if (!cancelled) setOptions(list);
      } catch {
        if (!cancelled) setOptions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, open]);

  const selectedIds = new Set(selected.map((v) => v.id));
  const filteredOptions = options.filter((o) => !selectedIds.has(o.id));

  const addVendor = (vendor) => {
    onChange([...selected, vendor]);
    setQuery('');
  };
  const removeVendor = (id) => onChange(selected.filter((v) => v.id !== id));

  return (
    <div ref={wrapRef} className="relative">
      <div
        className={`flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1.5 shadow-sm ${
          error ? 'border-rose-300' : 'border-slate-200'
        } ${disabled ? 'bg-slate-50' : 'bg-white'}`}
      >
        {selected.map((v) => (
          <span
            key={v.id}
            className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200"
          >
            {v.name}
            {!disabled && (
              <button type="button" onClick={() => removeVendor(v.id)} className="text-indigo-400 transition hover:text-indigo-700">
                {Icon.closeSmall}
              </button>
            )}
          </span>
        ))}
        {!disabled && (
          <input
            type="text"
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            placeholder={selected.length ? '' : 'Search vendors…'}
            className="min-w-[120px] flex-1 border-none bg-transparent px-1 py-0.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
        )}
      </div>

      {open && !disabled && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {loading ? (
            <div className="px-3 py-2 text-sm text-slate-400">Searching…</div>
          ) : filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-400">No vendors found</div>
          ) : (
            filteredOptions.map((o) => (
              <button
                key={o.id} type="button"
                onClick={() => addVendor(o)}
                className="flex w-full items-center px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-indigo-50"
              >
                {o.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

/* ---------- Live preview card ---------- */

const LivePreview = ({ termName, isDefault, termsContent }) => (
  <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-4">
    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Live preview</p>
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900">{termName || 'Untitled term'}</h3>
        {isDefault && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
            {Icon.star} Default
          </span>
        )}
      </div>
      <div
        className="prose-sm mt-3 max-h-64 overflow-y-auto text-sm leading-relaxed text-slate-600 [&_a]:text-indigo-600 [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
        dangerouslySetInnerHTML={{
          __html:
            sanitizeForPreview(termsContent) ||
            '<p class="text-slate-300">Terms &amp; conditions content will appear here…</p>',
        }}
      />
    </div>
  </div>
);

/* ======================== FORM (fields left, live preview right) ======================== */

const Form = ({ mode, formData, onChange, onSubmit, onCancel, submitting, errors }) => {
  const isView = mode === 'view';

  return (
    <div className="flex h-full flex-col">
      <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          <Field label="Term Name" required error={errors.termName}>
            <input
              type="text"
              value={formData.termName}
              disabled={isView}
              onChange={(e) => onChange('termName', e.target.value)}
              placeholder="e.g. Standard Payment Terms"
              className={fieldInputClass}
            />
          </Field>

          <Field label="Default">
            <Switch checked={formData.isDefault} onChange={(v) => onChange('isDefault', v)} disabled={isView} />
            <p className="mt-1.5 text-xs text-slate-400">
              {formData.isDefault
                ? 'Used for any vendor with no term of its own. Only one Default term can exist — saving this replaces the current one.'
                : 'Off — choose which vendors this term applies to below.'}
            </p>
          </Field>

          {!formData.isDefault && (
            <Field label="Applicable Vendors" required={!formData.isDefault} error={errors.applicableVendors}>
              <VendorMultiSelect
                selected={formData.applicableVendors}
                onChange={(v) => onChange('applicableVendors', v)}
                disabled={isView}
                error={errors.applicableVendors}
              />
            </Field>
          )}

          <Field label="Terms & Conditions" required error={errors.termsContent}>
            <RichTextEditor
              value={formData.termsContent}
              onChange={(html) => onChange('termsContent', html)}
              disabled={isView}
              error={errors.termsContent}
            />
          </Field>

          <Field label="Status">
            <StatusToggle value={formData.status} onChange={(v) => onChange('status', v)} disabled={isView} />
          </Field>

          {errors.general && (
            <div className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
              {Icon.alert}
              <span>{errors.general}</span>
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <LivePreview termName={formData.termName} isDefault={formData.isDefault} termsContent={formData.termsContent} />
        </div>
      </div>

      <div className="-mx-5 mt-5 flex justify-end gap-2.5 border-t border-slate-100 px-5 pt-4">
        <button
          onClick={onCancel}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          {isView ? 'Close' : 'Cancel'}
        </button>
        {!isView && (
          <button
            onClick={onSubmit}
            disabled={submitting}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Saving…' : 'Save'}
          </button>
        )}
      </div>
    </div>
  );
};

/* ======================== MAIN COMPONENT ======================== */

const TermsCondition = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [totalItems, setTotalItems] = useState(0);

  const [modalMode, setModalMode] = useState(null); // 'create' | 'edit' | 'view' | null
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [activeItemId, setActiveItemId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  const [confirmTarget, setConfirmTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  /* ----- Data fetching ----- */

  const loadTermsConditions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getTermsConditions({
        page: currentPage,
        limit: itemsPerPage,
        search,
        showInactive: statusFilter !== 'active',
      });
      let mapped = (response?.data || []).map(mapTermResponse);
      let total = response?.pagination?.total ?? mapped.length;

      // Backend only has "active only" vs "everything" — narrow to
      // inactive-only client-side, same pattern as Field Definitions.
      if (statusFilter === 'inactive') {
        mapped = mapped.filter((t) => !t.isActive);
        total = mapped.length;
      }

      setItems(mapped);
      setTotalItems(total);
    } catch (err) {
      setError(err.message || 'Something went wrong while loading Terms & Conditions.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, search, statusFilter]);

  useEffect(() => {
    loadTermsConditions();
  }, [loadTermsConditions]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  /* ----- Modal handlers ----- */

  const openCreateModal = () => {
    setFormData(EMPTY_FORM);
    setFormErrors({});
    setActiveItemId(null);
    setModalMode('create');
  };

  const toFormData = (item) => ({
    termName: item.termName,
    isDefault: item.isDefault,
    applicableVendors: item.applicableVendors,
    termsContent: item.termsContent,
    status: item.status,
  });

  const openEditModal = (item) => {
    setFormData(toFormData(item));
    setFormErrors({});
    setActiveItemId(item.id);
    setModalMode('edit');
  };

  const openViewModal = (item) => {
    setFormData(toFormData(item));
    setFormErrors({});
    setActiveItemId(item.id);
    setModalMode('view');
  };

  const closeModal = () => {
    setModalMode(null);
    setActiveItemId(null);
    setFormErrors({});
  };

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  /* ----- Validation ----- */

  const validateForm = () => {
    const errors = {};
    if (!formData.termName.trim()) errors.termName = 'Term name is required.';
    const plainContent = formData.termsContent.replace(/<[^>]*>/g, '').trim();
    if (!plainContent) errors.termsContent = 'Terms & conditions content is required.';
    if (!formData.isDefault && formData.applicableVendors.length === 0) {
      errors.applicableVendors = 'Select at least one vendor, or turn Default on.';
    }
    return errors;
  };

  /* ----- CRUD handlers ----- */

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
        termName: formData.termName.trim(),
        isDefault: formData.isDefault,
        applicableVendors: formData.isDefault ? [] : formData.applicableVendors.map((v) => v.id),
        termsContent: formData.termsContent,
        status: formData.status,
      };

      if (modalMode === 'create') {
        await createTermsCondition(payload);
        toast.success('Terms & Conditions created successfully.');
      } else if (modalMode === 'edit') {
        await updateTermsCondition(activeItemId, payload);
        toast.success('Terms & Conditions updated successfully.');
      }

      closeModal();
      await loadTermsConditions();
    } catch (err) {
      const message = err.message || 'Failed to save Terms & Conditions.';
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
      await deleteTermsCondition(confirmTarget.id);
      toast.success('Terms & Conditions deleted successfully.');
      setConfirmTarget(null);
      await loadTermsConditions();
    } catch (err) {
      toast.error(err.message || 'Failed to delete Terms & Conditions.');
    } finally {
      setDeleting(false);
    }
  };

  const handleRestore = async (item) => {
    try {
      await restoreTermsCondition(item.id);
      toast.success('Terms & Conditions restored successfully.');
      await loadTermsConditions();
    } catch (err) {
      toast.error(err.message || 'Failed to restore Terms & Conditions.');
    }
  };

  /* ----- Render ----- */

  const modalTitle =
    modalMode === 'create' ? 'Add Terms & Conditions'
    : modalMode === 'edit' ? 'Edit Terms & Conditions'
    : 'Terms & Conditions details';

  const modalDescription =
    modalMode === 'create' ? 'Define a new term for purchase orders.'
    : modalMode === 'edit' ? 'Update this term’s content and applicability.'
    : null;

  const startIndex = (currentPage - 1) * itemsPerPage + 1;

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <Header
        totalItems={totalItems}
        search={search}
        onSearchChange={setSearch}
        onCreateClick={openCreateModal}
      />

      <FilterBar statusFilter={statusFilter} onStatusFilterChange={setStatusFilter} />

      <Table
        items={items}
        startIndex={startIndex}
        loading={loading}
        error={error}
        onRetry={loadTermsConditions}
        onCreateClick={openCreateModal}
        onView={openViewModal}
        onEdit={openEditModal}
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

      {modalMode && (
        <Modal title={modalTitle} description={modalDescription} onClose={closeModal} maxWidth="max-w-5xl">
          <Form
            mode={modalMode}
            formData={formData}
            onChange={handleFormChange}
            onSubmit={handleSubmit}
            onCancel={closeModal}
            submitting={submitting}
            errors={formErrors}
          />
        </Modal>
      )}

      <ConfirmModal
        open={!!confirmTarget}
        message="Are you sure you want to delete this term?"
        onCancel={() => setConfirmTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
      />
    </div>
  );
};

export default TermsCondition;
