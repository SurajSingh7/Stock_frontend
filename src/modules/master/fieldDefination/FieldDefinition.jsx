'use client'
import { API_BACKEND_URL } from '@/config/getEnvVariables';
import Pagination from '@/shared/ui/pagination/Pagination';
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';

/* ======================== CONSTANTS ======================== */

const FIELD_DEFINITIONS_API = `${API_BACKEND_URL}/stock/field-definitions`;

const INPUT_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Textarea' },
  { value: 'number', label: 'Number' },
  { value: 'decimal', label: 'Decimal' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'multi_select', label: 'Multi Select' },
  { value: 'date', label: 'Date' },
  { value: 'datetime', label: 'Datetime' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'color', label: 'Color' },
];

const DROPDOWN_TYPES = ['dropdown', 'multi_select'];

// Which Tracking Method(s) (see Product Definition) this field is offered
// for on the "Applicable Fields" picker. Both checked = shown for either.
const TRACKING_METHOD_OPTIONS = [
  { value: 'individual', label: 'Individual' },
  { value: 'quantity', label: 'Group' },
];

// Requirement 1: dropdown-only status filter, no "All" option
const STATUS_FILTERS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const DEFAULT_ITEMS_PER_PAGE = 10;

// Requirement 5: max characters shown inline before "...more" kicks in
const TRUNCATE_LIMIT = 30;

const EMPTY_FORM = {
  code: '',
  label: '',
  inputType: 'text',
  optionsSource: '',
  isRequired: false,
  isFilterable: false,
  showList: false,
  order: 0,
  // Nothing pre-selected — the user must tick at least one before submitting.
  applicableTrackingMethods: [],
};

/* ---------- Design tokens — SAME as VendorsComp ---------- */

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";

const th = "px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-700";
const thRight = `${th} text-right`;

// Requirement 3: dynamic table column definitions — single source of truth.
// Add/remove/toggle `show` here to control rendered columns; no hardcoding elsewhere.
const FIELD_TABLE_COLUMNS = [
  { key: 'order', label: 'Order', show: true, render: (item) => <span className="text-sm text-slate-500 font-mono">{item.order}</span> },
  { key: 'code', label: 'Code', show: true, render: (item) => <TruncatedText label="Code" value={item.code} className="text-slate-700" mono /> },
  { key: 'label', label: 'Label', show: true, render: (item) => <TruncatedText label="Label" value={item.label} className="font-medium text-slate-900" /> },
  { key: 'inputType', label: 'Input type', show: true, render: (item) => <InputTypeTag value={item.inputType} /> },
  { key: 'applicableTrackingMethods', label: 'Applies to', show: true, render: (item) => <TrackingMethodTag value={item.applicableTrackingMethods} /> },
  { key: 'optionsSource', label: 'Options source', show: true, render: (item) => <TruncatedText label="Options source" value={item.optionsSource} className="text-slate-400" mono /> },
  { key: 'isRequired', label: 'Required', show: true, render: (item) => <BooleanDot value={item.isRequired} /> },
  // { key: 'isFilterable', label: 'Filterable', show: true, render: (item) => <BooleanDot value={item.isFilterable} /> },
  { key: 'showList', label: 'Show in list', show: true, render: (item) => <BooleanDot value={item.showList} /> },
  { key: 'isActive', label: 'Status', show: true, render: (item) => <StatusBadge isActive={item.isActive} /> },
  { key: 'actions', label: 'Action', show: true, render: null }, // rendered separately (icon buttons)
];

/* ======================== API FUNCTIONS ======================== */

// NOTE: the backend only exposes a single `showInactive` boolean
// (false => active only, true => everything). There is no
// "inactive only" query, so that case is filtered client-side below.
const getFieldDefinitions = async ({ page, limit, search, inputType, showInactive }) => {
  const params = new URLSearchParams();
  params.set('page', page);
  params.set('limit', limit);
  if (search) params.set('search', search);
  if (inputType) params.set('inputType', inputType);
  if (showInactive) params.set('showInactive', 'true');

  const response = await fetch(`${FIELD_DEFINITIONS_API}?${params.toString()}`, {
    method: 'GET',
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Failed to fetch field definitions');
  return response.json();
};

const createFieldDefinition = async (payload) => {
  const response = await fetch(FIELD_DEFINITIONS_API, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || 'Failed to create field definition');
  return data;
};

const updateFieldDefinition = async (id, payload) => {
  const response = await fetch(`${FIELD_DEFINITIONS_API}/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || 'Failed to update field definition');
  return data;
};

const deleteFieldDefinition = async (id) => {
  const response = await fetch(`${FIELD_DEFINITIONS_API}/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || 'Failed to delete field definition');
  return data;
};

const restoreFieldDefinition = async (id) => {
  const response = await fetch(`${FIELD_DEFINITIONS_API}/${id}/restore`, {
    method: 'PATCH',
    credentials: 'include',
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || 'Failed to restore field definition');
  return data;
};

/* ======================== UTILITY FUNCTIONS ======================== */

const mapFieldDefinitionResponse = (item) => ({
  id: item._id,
  code: item.code,
  label: item.label,
  inputType: item.inputType,
  optionsSource: item.optionsSource || '',
  isRequired: !!item.isRequired,
  isFilterable: !!item.isFilterable,
  showList: !!item.showList,
  isActive: item.isActive !== false,
  order: item.order ?? 0,
  applicableTrackingMethods:
    Array.isArray(item.applicableTrackingMethods) && item.applicableTrackingMethods.length > 0
      ? item.applicableTrackingMethods
      : ['individual', 'quantity'],
});

const isDropdownType = (inputType) => DROPDOWN_TYPES.includes(inputType);

const getInputTypeLabel = (value) =>
  INPUT_TYPES.find((t) => t.value === value)?.label || value;

const getTrackingMethodsLabel = (values) => {
  const arr = Array.isArray(values) && values.length > 0 ? values : ['individual', 'quantity'];
  if (arr.length >= TRACKING_METHOD_OPTIONS.length) return 'Both';
  return arr.map((v) => TRACKING_METHOD_OPTIONS.find((t) => t.value === v)?.label || v).join(', ');
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
  back: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
      <path d="M16 10H4m0 0 5-5m-5 5 5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
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
  // used by the Required / Filterable premium toggle cards in the Add/Edit modal
  requiredMark: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4.5 w-4.5">
      <path d="M6 10.5 8.5 13 14 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  filter: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4.5 w-4.5">
      <path d="M3 4.5h14L11.5 10.8V16l-3-1.6v-3.6L3 4.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  ),
  list: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4.5 w-4.5">
      <path d="M6.5 5.5h10M6.5 10h10M6.5 14.5h10M3.5 5.5h.01M3.5 10h.01M3.5 14.5h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  // small checkmark used inside the Applicable-to checkbox cards
  checkSmall: (
    <svg viewBox="0 0 20 20" fill="none" className="h-3 w-3">
      <path d="M4.5 10.3 8 13.8l7-7.6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  individual: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4.5 w-4.5">
      <circle cx="10" cy="6.5" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 17c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  group: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4.5 w-4.5">
      <rect x="3.5" y="4" width="13" height="6" rx="1.4" stroke="currentColor" strokeWidth="1.6" />
      <rect x="3.5" y="12" width="13" height="4" rx="1.2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
};

/* ======================== UI HELPER COMPONENTS ======================== */

const StatusBadge = ({ isActive }) => (
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

const BooleanDot = ({ value }) => (
  <span
    className={`inline-flex items-center gap-1.5 text-xs font-medium ${
      value ? 'text-indigo-700' : 'text-slate-400'
    }`}
  >
    <span className={`h-1.5 w-1.5 rounded-full ${value ? 'bg-indigo-500' : 'bg-slate-300'}`} />
    {value ? 'Yes' : 'No'}
  </span>
);

const InputTypeTag = ({ value }) => (
  <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-600">
    {getInputTypeLabel(value)}
  </span>
);

const TrackingMethodTag = ({ value }) => (
  <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200">
    {getTrackingMethodsLabel(value)}
  </span>
);

// Requirement 5: truncates any string longer than TRUNCATE_LIMIT and shows
// an inline "...more" trigger that opens a popup with the full value.
const TruncatedText = ({ label, value, className = '', mono = false }) => {
  const [open, setOpen] = useState(false);

  if (!value) return <span className="text-sm text-slate-300">—</span>;

  const isLong = value.length > TRUNCATE_LIMIT;
  const displayValue = isLong ? value.slice(0, TRUNCATE_LIMIT) : value;

  return (
    <>
      <span className={`text-sm ${mono ? 'font-mono' : ''} ${className}`}>
        {displayValue}
        {isLong && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="ml-1 font-semibold text-indigo-600 hover:underline transition-colors"
          >
            ...more
          </button>
        )}
      </span>

      {open && (
        <Modal title={label} onClose={() => setOpen(false)} maxWidth="max-w-md">
          <p className={`whitespace-pre-wrap break-words text-sm text-slate-900 ${mono ? 'font-mono' : ''}`}>
            {value}
          </p>
        </Modal>
      )}
    </>
  );
};

/* IconBtn — SAME tone pattern as VendorsComp (adds orange for edit) */
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

const LoadingRows = ({ columns = 9, rows = 6 }) => (
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
        <p className="mt-4 text-sm font-medium text-slate-700">No field definitions yet</p>
        <p className="mt-1 text-sm text-slate-400">Adjust your filters, or add a new field to get started.</p>
        <button
          onClick={onCreateClick}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
        >
          {Icon.plus} Add field
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
        <p className="mt-3 text-sm font-medium text-slate-800">Couldn't load field definitions</p>
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

/* ======================== HEADER COMPONENT ======================== */

const Header = ({ totalItems, onCreateClick }) => (
  <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">Field definitions</h1>
      <p className="mt-0.5 text-sm text-slate-500">
        {typeof totalItems === 'number' ? `${totalItems} field${totalItems === 1 ? '' : 's'} · ` : ''}
        Dynamic attributes available to product categories.
      </p>
    </div>
    <button
      onClick={onCreateClick}
      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
    >
      {Icon.plus} Add field
    </button>
  </div>
);

/* ======================== FILTER BAR COMPONENT ======================== */

// Requirement 1: status is now a plain <select> dropdown (Active / Inactive only)
const FilterBar = ({ search, onSearchChange, inputTypeFilter, onInputTypeFilterChange, statusFilter, onStatusFilterChange }) => (
  <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <div className="relative lg:col-span-2">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
          {Icon.search}
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by code or label"
          className={`${inputCls} pl-9`}
        />
      </div>

      <select
        value={inputTypeFilter}
        onChange={(e) => onInputTypeFilterChange(e.target.value)}
        className={inputCls}
      >
        <option value="">All input types</option>
        {INPUT_TYPES.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>

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

/* ======================== TABLE ROW COMPONENT ======================== */

// Requirement 3: renders only columns visible in FIELD_TABLE_COLUMNS
const TableRow = ({ item, columns, onView, onEdit, onDelete, onRestore }) => (
  <tr className="transition hover:bg-slate-50/60">
    {columns.map((col) =>
      col.key === 'actions' ? (
        <td key={col.key} className="px-4 py-3.5">
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
      ) : (
        <td key={col.key} className="px-4 py-3.5">{col.render(item)}</td>
      )
    )}
  </tr>
);

/* ======================== TABLE COMPONENT ======================== */

const Table = ({ items, loading, error, onRetry, onCreateClick, onView, onEdit, onDelete, onRestore }) => {
  // Requirement 3: derive visible columns from the constant — no hardcoded headers
  const visibleColumns = FIELD_TABLE_COLUMNS.filter((c) => c.show);

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50/60">
          <tr>
            {visibleColumns.map((col) => (
              <th key={col.key} className={col.key === 'actions' ? thRight : th}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {error ? (
            <ErrorState colSpan={visibleColumns.length} message={error} onRetry={onRetry} />
          ) : loading ? (
            <LoadingRows columns={visibleColumns.length} />
          ) : items.length === 0 ? (
            <EmptyState colSpan={visibleColumns.length} onCreateClick={onCreateClick} />
          ) : (
            items.map((item) => (
              <TableRow
                key={item.id}
                item={item}
                columns={visibleColumns}
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
};

/* ======================== MODAL SHELL (reusable, portal-based) ======================== */

// Requirement 2 & 4: shared premium modal shell — now a createPortal into document.body,
// same pattern as VendorsComp, so it never gets clipped/overlapped by parent overflow.
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

/* ======================== CONFIRM MODAL (Requirement 4) ======================== */

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

// Premium colorful toggle card used for Required / Filterable in the Add/Edit
// modal (row 3). Same on/off semantics as a plain checkbox, just a nicer,
// color-coded presentation — `color` picks the accent (indigo / violet).
const TOGGLE_CARD_PALETTE = {
  indigo: {
    activeBorder: 'border-indigo-300',
    activeBg: 'bg-gradient-to-br from-indigo-50 to-indigo-100/70',
    iconActive: 'bg-indigo-600 text-white',
    track: 'bg-indigo-600',
    text: 'text-indigo-700',
  },
  violet: {
    activeBorder: 'border-violet-300',
    activeBg: 'bg-gradient-to-br from-violet-50 to-violet-100/70',
    iconActive: 'bg-violet-600 text-white',
    track: 'bg-violet-600',
    text: 'text-violet-700',
  },
};

// Checkbox variant of ToggleCard used for "Applicable to" — unlike the
// toggle cards above, multiple of these can be checked at once (Individual,
// Group, or both), so it renders a checkbox rather than an on/off switch.
const CheckboxCard = ({ label, hint, checked, onChange, disabled, color = 'indigo', icon }) => {
  const p = TOGGLE_CARD_PALETTE[color];
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left shadow-sm transition ${
        checked ? `${p.activeBorder} ${p.activeBg}` : 'border-slate-200 bg-white'
      } ${disabled ? 'cursor-not-allowed opacity-60' : 'hover:shadow-md'}`}
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition ${checked ? p.iconActive : 'bg-slate-100 text-slate-400'}`}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm font-semibold ${checked ? p.text : 'text-slate-700'}`}>{label}</span>
        {hint && <span className="block text-xs text-slate-400">{hint}</span>}
      </span>
      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${checked ? `${p.track} border-transparent` : 'border-slate-300 bg-white'}`}>
        {checked && Icon.checkSmall}
      </span>
    </button>
  );
};

const ToggleCard = ({ label, hint, checked, onChange, disabled, color = 'indigo', icon }) => {
  const p = TOGGLE_CARD_PALETTE[color];
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left shadow-sm transition ${
        checked ? `${p.activeBorder} ${p.activeBg}` : 'border-slate-200 bg-white'
      } ${disabled ? 'cursor-not-allowed opacity-60' : 'hover:shadow-md'}`}
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition ${checked ? p.iconActive : 'bg-slate-100 text-slate-400'}`}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm font-semibold ${checked ? p.text : 'text-slate-700'}`}>{label}</span>
        <span className="block text-xs text-slate-400">{hint}</span>
      </span>
      <span className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${checked ? p.track : 'bg-slate-300'}`}>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </span>
    </button>
  );
};

/* ======================== FORM PAGE SHELL ======================== */

// Add / Edit / View is an inline full-page view (no popup): the list is swapped
// out for this screen and the back button returns to it.
const FormPage = ({ title, description, onBack, children }) => (
  <div className="min-h-screen bg-slate-50/60 p-6">
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onBack}
          title="Back to field definitions"
          className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
        >
          {Icon.back}
        </button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        </div>
      </div>
      <button
        type="button"
        onClick={onBack}
        className="hidden items-center gap-1.5 self-start rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 sm:inline-flex"
      >
        {Icon.back} Back
      </button>
    </div>

    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      {children}
    </div>
  </div>
);

/* ======================== FORM COMPONENT ======================== */

// Requested layout: Row 1 = Code + Label, Row 2 = Input type + Order,
// Row 3 = Required + Filterable as colorful premium toggle cards.
const Form = ({ mode, formData, onChange, onSubmit, onCancel, submitting, errors }) => {
  const isEdit = mode === 'edit';
  const isView = mode === 'view';

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-5">
        {/* Row 1 — Code + Label */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Code" required hint={isEdit ? 'Code cannot be changed after creation.' : 'Lowercase, snake_case identifier.'} error={errors.code}>
            <input
              type="text"
              value={formData.code}
              disabled={isEdit || isView}
              onChange={(e) => onChange('code', e.target.value.trim().toLowerCase())}
              placeholder="e.g. warranty_period"
              className={`${fieldInputClass} font-mono`}
            />
          </Field>

          <Field label="Label" required hint="Must be unique across all fields." error={errors.label}>
            <input
              type="text"
              value={formData.label}
              disabled={isView}
              onChange={(e) => onChange('label', e.target.value)}
              placeholder="e.g. Warranty Period"
              className={fieldInputClass}
            />
          </Field>
        </div>

        {/* Row 2 — Input type + Order */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Input type">
            <select
              value={formData.inputType}
              disabled={isView}
              onChange={(e) => onChange('inputType', e.target.value)}
              className={fieldInputClass}
            >
              {INPUT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Order" hint="Controls display sequence in the table (lower shows first)." error={errors.order}>
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

        {isDropdownType(formData.inputType) && (
          <Field label="Options source key" required hint="Must match a key in STOCK_FIELD_OPTIONS constants." error={errors.optionsSource}>
            <input
              type="text"
              value={formData.optionsSource}
              disabled={isView}
              onChange={(e) => onChange('optionsSource', e.target.value.trim().toUpperCase())}
              placeholder="e.g. WARRANTY_PERIODS"
              className={`${fieldInputClass} font-mono`}
            />
          </Field>
        )}

        {/* Row 3 — Required + Filterable + Show in list (colorful premium toggle cards) */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ToggleCard
            label="Required"
            hint="M"
            checked={formData.isRequired}
            onChange={(value) => onChange('isRequired', value)}
            disabled={isView}
            color="indigo"
            icon={Icon.requiredMark}
          />
          <ToggleCard
            label="Filterable"
            hint=""
            checked={formData.isFilterable}
            onChange={(value) => onChange('isFilterable', value)}
            disabled={isView}
            color="violet"
            icon={Icon.filter}
          />
          <ToggleCard
            label="Show in list"
            hint="Renders as a column on the Item Inventory list."
            checked={formData.showList}
            onChange={(value) => onChange('showList', value)}
            disabled={isView}
            color="indigo"
            icon={Icon.list}
          />
        </div>

        {/* Row 4 — Applicable to (Tracking Method): check either or both */}
        <Field
          label="Applicable to (Tracking Method)"
          required
          hint="Pick at least one. Controls which fields show up on the product's Applicable Fields picker for each tracking method."
          error={errors.applicableTrackingMethods}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {TRACKING_METHOD_OPTIONS.map((opt) => {
              const checked = formData.applicableTrackingMethods.includes(opt.value);
              return (
                <CheckboxCard
                  key={opt.value}
                  label={opt.label}
                  checked={checked}
                  onChange={(value) => {
                    const next = value
                      ? [...formData.applicableTrackingMethods, opt.value]
                      : formData.applicableTrackingMethods.filter((v) => v !== opt.value);
                    onChange('applicableTrackingMethods', next);
                  }}
                  disabled={isView}
                  color={opt.value === 'individual' ? 'indigo' : 'violet'}
                  icon={opt.value === 'individual' ? Icon.individual : Icon.group}
                />
              );
            })}
          </div>
        </Field>

        {errors.general && (
          <div className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
            {Icon.alert}
            <span>{errors.general}</span>
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-end gap-2.5 border-t border-slate-100 pt-5">
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
            {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create field'}
          </button>
        )}
      </div>
    </div>
  );
};

/* ======================== MAIN COMPONENT ======================== */

const FieldDefinition = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [inputTypeFilter, setInputTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active'); // 'active' | 'inactive' — default Active (Req 1)

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [totalItems, setTotalItems] = useState(0);

  const [formMode, setFormMode] = useState(null); // 'create' | 'edit' | 'view' | null
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [activeItemId, setActiveItemId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // Requirement 4: confirm-delete popup state
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  /* ----- Data fetching ----- */

  const loadFieldDefinitions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getFieldDefinitions({
        page: currentPage,
        limit: itemsPerPage,
        search,
        inputType: inputTypeFilter,
        showInactive: statusFilter !== 'active',
      });
      let mapped = (response?.data || []).map(mapFieldDefinitionResponse);
      let total = response?.pagination?.total ?? mapped.length;

      // Backend has no "inactive only" filter — narrow it down client-side.
      if (statusFilter === 'inactive') {
        mapped = mapped.filter((f) => !f.isActive);
        total = mapped.length;
      }

      setItems(mapped);
      setTotalItems(total);
    } catch (err) {
      setError(err.message || 'Something went wrong while loading field definitions.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, search, inputTypeFilter, statusFilter]);

  useEffect(() => {
    loadFieldDefinitions();
  }, [loadFieldDefinitions]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, inputTypeFilter, statusFilter]);

  /* ----- Modal handlers ----- */

  const openCreateForm = () => {
    setFormData(EMPTY_FORM);
    setFormErrors({});
    setActiveItemId(null);
    setFormMode('create');
  };

  const openEditForm = (item) => {
    setFormData({
      code: item.code,
      label: item.label,
      inputType: item.inputType,
      optionsSource: item.optionsSource,
      isRequired: item.isRequired,
      isFilterable: item.isFilterable,
      showList: item.showList,
      order: item.order ?? 0,
      applicableTrackingMethods: item.applicableTrackingMethods,
    });
    setFormErrors({});
    setActiveItemId(item.id);
    setFormMode('edit');
  };

  const openViewForm = (item) => {
    setFormData({
      code: item.code,
      label: item.label,
      inputType: item.inputType,
      optionsSource: item.optionsSource,
      isRequired: item.isRequired,
      isFilterable: item.isFilterable,
      showList: item.showList,
      order: item.order ?? 0,
      applicableTrackingMethods: item.applicableTrackingMethods,
    });
    setFormErrors({});
    setActiveItemId(item.id);
    setFormMode('view');
  };

  const closeForm = () => {
    setFormMode(null);
    setActiveItemId(null);
    setFormErrors({});
  };

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear the field's error as soon as it's touched (e.g. ticking a tracking
    // method should drop the "select at least one" message right away).
    setFormErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  /* ----- Validation ----- */

  const validateForm = () => {
    const errors = {};
    if (!formData.code.trim()) errors.code = 'Code is required.';
    if (!formData.label.trim()) errors.label = 'Label is required.';
    if (formData.order !== '' && Number.isNaN(Number(formData.order))) {
      errors.order = 'Order must be a number.';
    }
    if (isDropdownType(formData.inputType) && !formData.optionsSource.trim()) {
      errors.optionsSource = 'Options source key is required for dropdown / multi-select fields.';
    }
    if (!formData.applicableTrackingMethods || formData.applicableTrackingMethods.length === 0) {
      errors.applicableTrackingMethods = 'Select at least one tracking method (Individual and/or Group).';
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
        label: formData.label.trim(),
        inputType: formData.inputType,
        optionsSource: isDropdownType(formData.inputType) ? formData.optionsSource.trim() : null,
        isRequired: formData.isRequired,
        isFilterable: formData.isFilterable,
        showList: formData.showList,
        order: formData.order === '' ? 0 : Number(formData.order),
        applicableTrackingMethods: formData.applicableTrackingMethods,
      };

      if (formMode === 'create') {
        payload.code = formData.code.trim();
        await createFieldDefinition(payload);
        toast.success('Field definition created successfully.');
      } else if (formMode === 'edit') {
        await updateFieldDefinition(activeItemId, payload);
        toast.success('Field definition updated successfully.');
      }

      closeForm();
      await loadFieldDefinitions();
    } catch (err) {
      const message = err.message || 'Failed to save field definition.';
      setFormErrors({ general: message });
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  // Requirement 4: opens custom confirm popup instead of window.confirm
  const handleDeleteClick = (item) => setConfirmTarget(item);

  const handleConfirmDelete = async () => {
    if (!confirmTarget) return;
    setDeleting(true);
    try {
      await deleteFieldDefinition(confirmTarget.id);
      toast.success('Field definition deleted successfully.');
      setConfirmTarget(null);
      await loadFieldDefinitions();
    } catch (err) {
      toast.error(err.message || 'Failed to delete field definition.');
    } finally {
      setDeleting(false);
    }
  };

  const handleRestore = async (item) => {
    try {
      await restoreFieldDefinition(item.id);
      toast.success('Field definition restored successfully.');
      await loadFieldDefinitions();
    } catch (err) {
      toast.error(err.message || 'Failed to restore field definition.');
    }
  };

  /* ----- Render ----- */

  const formTitle =
    formMode === 'create' ? 'Add field definition'
    : formMode === 'edit' ? 'Edit field definition'
    : 'Field definition details';

  const formDescription =
    formMode === 'create' ? 'Define a new dynamic attribute for products.'
    : formMode === 'edit' ? 'Update label, type, and rules for this field.'
    : null;

  // Add / Edit / View replaces the list with a full-page form (back button returns).
  if (formMode) {
    return (
      <FormPage title={formTitle} description={formDescription} onBack={closeForm}>
        <Form
          mode={formMode}
          formData={formData}
          onChange={handleFormChange}
          onSubmit={handleSubmit}
          onCancel={closeForm}
          submitting={submitting}
          errors={formErrors}
        />
      </FormPage>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <Header totalItems={totalItems} onCreateClick={openCreateForm} />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        inputTypeFilter={inputTypeFilter}
        onInputTypeFilterChange={setInputTypeFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      <Table
        items={items}
        loading={loading}
        error={error}
        onRetry={loadFieldDefinitions}
        onCreateClick={openCreateForm}
        onView={openViewForm}
        onEdit={openEditForm}
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

      {/* Requirement 4: reusable confirm modal for delete */}
      <ConfirmModal
        open={!!confirmTarget}
        message="Are you sure you want to delete this field?"
        onCancel={() => setConfirmTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
      />
    </div>
  );
};

export default FieldDefinition;