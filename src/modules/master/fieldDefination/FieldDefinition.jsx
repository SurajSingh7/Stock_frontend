'use client'
import { API_BACKEND_URL } from '@/config/getEnvVariables';
import Pagination from '@/shared/ui/pagination/Pagination';
import React, { useState, useEffect, useCallback } from 'react';

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

const STATUS_FILTERS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'all', label: 'All statuses' },
];

const DEFAULT_ITEMS_PER_PAGE = 10;

const EMPTY_FORM = {
  code: '',
  label: '',
  inputType: 'text',
  optionsSource: '',
  isRequired: false,
  isFilterable: false,
};

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
  isActive: item.isActive !== false,
});

const isDropdownType = (inputType) => DROPDOWN_TYPES.includes(inputType);

const getInputTypeLabel = (value) =>
  INPUT_TYPES.find((t) => t.value === value)?.label || value;

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
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
      <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
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
};

/* ======================== UI HELPER COMPONENTS ======================== */

const StatusBadge = ({ isActive }) => (
  <span
    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ring-1 ring-inset ${
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
  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono bg-slate-100 text-slate-600">
    {getInputTypeLabel(value)}
  </span>
);

const IconButton = ({ onClick, label, tone = 'slate', children }) => {
  const tones = {
    slate: 'text-slate-500 hover:text-slate-800 hover:bg-slate-100',
    indigo: 'text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50',
    red: 'text-red-500 hover:text-red-700 hover:bg-red-50',
    emerald: 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50',
  };
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${tones[tone]}`}
    >
      {children}
    </button>
  );
};

const LoadingRows = ({ columns = 8, rows = 6 }) => (
  <>
    {Array.from({ length: rows }).map((_, r) => (
      <tr key={r}>
        {Array.from({ length: columns }).map((__, c) => (
          <td key={c} className="px-5 py-3.5">
            <div className="h-3.5 rounded bg-slate-100 animate-pulse" style={{ width: `${55 + ((r + c) % 4) * 10}%` }} />
          </td>
        ))}
      </tr>
    ))}
  </>
);

const EmptyState = ({ onCreateClick }) => (
  <tr>
    <td colSpan={8} className="px-6 py-16">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-300">
          {Icon.empty}
        </div>
        <p className="mt-4 text-sm font-medium text-slate-700">No field definitions yet</p>
        <p className="mt-1 text-sm text-slate-400">Adjust your filters, or add a new field to get started.</p>
        <button
          onClick={onCreateClick}
          className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          {Icon.plus} Add field
        </button>
      </div>
    </td>
  </tr>
);

const ErrorState = ({ message, onRetry }) => (
  <tr>
    <td colSpan={8} className="px-6 py-16">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500">
          {Icon.alert}
        </div>
        <p className="mt-3 text-sm font-medium text-slate-800">Couldn't load field definitions</p>
        <p className="mt-1 max-w-sm text-sm text-slate-400">{message}</p>
        <button
          onClick={onRetry}
          className="mt-4 rounded-md border border-slate-200 px-3.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Try again
        </button>
      </div>
    </td>
  </tr>
);

/* ======================== HEADER COMPONENT ======================== */

const Header = ({ totalItems, onCreateClick }) => (
  <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between mb-6">
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Field definitions</h1>
      <p className="mt-1 text-sm text-slate-500">
        {typeof totalItems === 'number' ? `${totalItems} field${totalItems === 1 ? '' : 's'} · ` : ''}
        Dynamic attributes available to product categories.
      </p>
    </div>
    <button
      onClick={onCreateClick}
      className="inline-flex items-center justify-center gap-1.5 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-800 transition-colors"
    >
      {Icon.plus} Add field
    </button>
  </div>
);

/* ======================== FILTER BAR COMPONENT ======================== */

const FilterBar = ({ search, onSearchChange, inputTypeFilter, onInputTypeFilterChange, statusFilter, onStatusFilterChange }) => (
  <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 mb-4 sm:flex-row sm:items-center">
    <div className="relative flex-1 min-w-[200px]">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
        {Icon.search}
      </span>
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search by code or label"
        className="w-full rounded-md border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
      />
    </div>

    <select
      value={inputTypeFilter}
      onChange={(e) => onInputTypeFilterChange(e.target.value)}
      className="rounded-md border border-slate-200 bg-slate-50 py-2 px-3 text-sm text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
    >
      <option value="">All input types</option>
      {INPUT_TYPES.map((t) => (
        <option key={t.value} value={t.value}>{t.label}</option>
      ))}
    </select>

    <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5">
      {STATUS_FILTERS.map((s) => (
        <button
          key={s.value}
          onClick={() => onStatusFilterChange(s.value)}
          className={`px-3 py-1.5 text-sm font-medium rounded-[5px] transition-colors ${
            statusFilter === s.value
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  </div>
);

/* ======================== TABLE ROW COMPONENT ======================== */

const TableRow = ({ item, onView, onEdit, onDelete, onRestore }) => (
  <tr className="group border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
    <td className="px-5 py-3.5">
      <span className="text-sm font-mono text-slate-700">{item.code}</span>
    </td>
    <td className="px-5 py-3.5 text-sm font-medium text-slate-900">{item.label}</td>
    <td className="px-5 py-3.5"><InputTypeTag value={item.inputType} /></td>
    <td className="px-5 py-3.5 text-sm text-slate-400">
      {item.optionsSource || <span className="text-slate-300">—</span>}
    </td>
    <td className="px-5 py-3.5"><BooleanDot value={item.isRequired} /></td>
    <td className="px-5 py-3.5"><BooleanDot value={item.isFilterable} /></td>
    <td className="px-5 py-3.5"><StatusBadge isActive={item.isActive} /></td>
    <td className="px-5 py-3.5">
      <div className="flex items-center justify-end gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
        <IconButton onClick={() => onView(item)} label="View">{Icon.eye}</IconButton>
        <IconButton onClick={() => onEdit(item)} label="Edit" tone="indigo">{Icon.edit}</IconButton>
        {item.isActive ? (
          <IconButton onClick={() => onDelete(item)} label="Delete" tone="red">{Icon.trash}</IconButton>
        ) : (
          <IconButton onClick={() => onRestore(item)} label="Restore" tone="emerald">{Icon.restore}</IconButton>
        )}
      </div>
    </td>
  </tr>
);

/* ======================== TABLE COMPONENT ======================== */

const TABLE_HEADERS = ['Code', 'Label', 'Input type', 'Options source', 'Required', 'Filterable', 'Status', ''];

const Table = ({ items, loading, error, onRetry, onCreateClick, onView, onEdit, onDelete, onRestore }) => (
  <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/60">
            {TABLE_HEADERS.map((h) => (
              <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {error ? (
            <ErrorState message={error} onRetry={onRetry} />
          ) : loading ? (
            <LoadingRows />
          ) : items.length === 0 ? (
            <EmptyState onCreateClick={onCreateClick} />
          ) : (
            items.map((item) => (
              <TableRow
                key={item.id}
                item={item}
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
  </div>
);

/* ======================== SLIDE-OVER PANEL COMPONENT ======================== */

const SlideOver = ({ title, description, onClose, children }) => (
  <div className="fixed inset-0 z-50">
    <div onClick={onClose} className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]" />
    <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col animate-[slideIn_0.2s_ease-out]">
      <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-slate-400">{description}</p>}
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          {Icon.close}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
    </div>
    <style>{`@keyframes slideIn { from { transform: translateX(16px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }`}</style>
  </div>
);

/* ======================== FORM FIELD COMPONENTS ======================== */

const Field = ({ label, hint, error, children }) => (
  <div>
    <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
    {children}
    {hint && !error && <p className="mt-1.5 text-xs text-slate-400">{hint}</p>}
    {error && <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}
  </div>
);

const fieldInputClass =
  'w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 disabled:bg-slate-50 disabled:text-slate-400';

/* ======================== FORM COMPONENT ======================== */

const Form = ({ mode, formData, onChange, onSubmit, onCancel, submitting, errors }) => {
  const isEdit = mode === 'edit';
  const isView = mode === 'view';

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-5">
        <Field label="Code" hint={isEdit ? 'Code cannot be changed after creation.' : 'Lowercase, snake_case identifier.'} error={errors.code}>
          <input
            type="text"
            value={formData.code}
            disabled={isEdit || isView}
            onChange={(e) => onChange('code', e.target.value.trim().toLowerCase())}
            placeholder="e.g. warranty_period"
            className={`${fieldInputClass} font-mono`}
          />
        </Field>

        <Field label="Label" error={errors.label}>
          <input
            type="text"
            value={formData.label}
            disabled={isView}
            onChange={(e) => onChange('label', e.target.value)}
            placeholder="e.g. Warranty Period"
            className={fieldInputClass}
          />
        </Field>

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

        {isDropdownType(formData.inputType) && (
          <Field label="Options source key" hint="Must match a key in STOCK_FIELD_OPTIONS constants." error={errors.optionsSource}>
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

        <div className="flex flex-col gap-3 rounded-md border border-slate-100 bg-slate-50/60 p-3.5">
          <label className="flex items-center justify-between text-sm text-slate-700">
            <span>
              Required
              <span className="block text-xs text-slate-400">Must be filled when creating a product.</span>
            </span>
            <input
              type="checkbox"
              checked={formData.isRequired}
              disabled={isView}
              onChange={(e) => onChange('isRequired', e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900/20"
            />
          </label>
          <div className="h-px bg-slate-200" />
          <label className="flex items-center justify-between text-sm text-slate-700">
            <span>
              Filterable
              <span className="block text-xs text-slate-400">Shown as a filter option in product listings.</span>
            </span>
            <input
              type="checkbox"
              checked={formData.isFilterable}
              disabled={isView}
              onChange={(e) => onChange('isFilterable', e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900/20"
            />
          </label>
        </div>

        {errors.general && (
          <div className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2.5 text-sm text-red-700">
            {Icon.alert}
            <span>{errors.general}</span>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 mt-5 -mx-6 px-6">
        <button
          onClick={onCancel}
          className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {isView ? 'Close' : 'Cancel'}
        </button>
        {!isView && (
          <button
            onClick={onSubmit}
            disabled={submitting}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
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
  const [statusFilter, setStatusFilter] = useState('active'); // 'active' | 'inactive' | 'all'

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [totalItems, setTotalItems] = useState(0);

  const [modalMode, setModalMode] = useState(null); // 'create' | 'edit' | 'view' | null
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [activeItemId, setActiveItemId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});

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

  const openCreateModal = () => {
    setFormData(EMPTY_FORM);
    setFormErrors({});
    setActiveItemId(null);
    setModalMode('create');
  };

  const openEditModal = (item) => {
    setFormData({
      code: item.code,
      label: item.label,
      inputType: item.inputType,
      optionsSource: item.optionsSource,
      isRequired: item.isRequired,
      isFilterable: item.isFilterable,
    });
    setFormErrors({});
    setActiveItemId(item.id);
    setModalMode('edit');
  };

  const openViewModal = (item) => {
    setFormData({
      code: item.code,
      label: item.label,
      inputType: item.inputType,
      optionsSource: item.optionsSource,
      isRequired: item.isRequired,
      isFilterable: item.isFilterable,
    });
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
    if (!formData.code.trim()) errors.code = 'Code is required.';
    if (!formData.label.trim()) errors.label = 'Label is required.';
    if (isDropdownType(formData.inputType) && !formData.optionsSource.trim()) {
      errors.optionsSource = 'Options source key is required for dropdown / multi-select fields.';
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
      };

      if (modalMode === 'create') {
        payload.code = formData.code.trim();
        await createFieldDefinition(payload);
      } else if (modalMode === 'edit') {
        await updateFieldDefinition(activeItemId, payload);
      }

      closeModal();
      await loadFieldDefinitions();
    } catch (err) {
      setFormErrors({ general: err.message || 'Failed to save field definition.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete field "${item.label}"? This can be restored later.`)) return;
    try {
      await deleteFieldDefinition(item.id);
      await loadFieldDefinitions();
    } catch (err) {
      window.alert(err.message || 'Failed to delete field definition.');
    }
  };

  const handleRestore = async (item) => {
    try {
      await restoreFieldDefinition(item.id);
      await loadFieldDefinitions();
    } catch (err) {
      window.alert(err.message || 'Failed to restore field definition.');
    }
  };

  /* ----- Render ----- */

  const modalTitle =
    modalMode === 'create' ? 'Add field definition'
    : modalMode === 'edit' ? 'Edit field definition'
    : 'Field definition details';

  const modalDescription =
    modalMode === 'create' ? 'Define a new dynamic attribute for products.'
    : modalMode === 'edit' ? 'Update label, type, and rules for this field.'
    : null;

  return (
    <div className="min-h-screen bg-slate-50/40 p-6">
      <div className="mx-auto max-w-6xl">
        <Header totalItems={totalItems} onCreateClick={openCreateModal} />

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
          onCreateClick={openCreateModal}
          onView={openViewModal}
          onEdit={openEditModal}
          onDelete={handleDelete}
          onRestore={handleRestore}
        />

        {!error && totalItems > 0 && (
          <div className="mt-4">
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
      </div>

      {modalMode && (
        <SlideOver title={modalTitle} description={modalDescription} onClose={closeModal}>
          <Form
            mode={modalMode}
            formData={formData}
            onChange={handleFormChange}
            onSubmit={handleSubmit}
            onCancel={closeModal}
            submitting={submitting}
            errors={formErrors}
          />
        </SlideOver>
      )}
    </div>
  );
};

export default FieldDefinition;