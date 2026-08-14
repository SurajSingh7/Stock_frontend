'use client'
import { API_BACKEND_URL } from '@/config/getEnvVariables';
import Pagination from '@/shared/ui/pagination/Pagination';
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';

/* ======================== CONSTANTS ======================== */

const WAREHOUSES_API = `${API_BACKEND_URL}/stock/warehouses`;

const STATUS_FILTERS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const DEFAULT_ITEMS_PER_PAGE = 10;

const EMPTY_FORM = { name: '', code: '', address: '', description: '' };

/* ---------- Design tokens — SAME as FieldDefinition/VendorsComp ---------- */

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";

const th = "px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-700";
const thRight = `${th} text-right`;

/* ======================== API FUNCTIONS ======================== */

const getWarehouses = async ({ page, limit, search, showInactive }) => {
  const params = new URLSearchParams();
  params.set('page', page);
  params.set('limit', limit);
  if (search) params.set('search', search);
  if (showInactive) params.set('showInactive', 'true');

  const response = await fetch(`${WAREHOUSES_API}?${params.toString()}`, {
    method: 'GET',
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Failed to fetch warehouses');
  return response.json();
};

const createWarehouse = async (payload) => {
  const response = await fetch(WAREHOUSES_API, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || 'Failed to create warehouse');
  return data;
};

const updateWarehouse = async (id, payload) => {
  const response = await fetch(`${WAREHOUSES_API}/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || 'Failed to update warehouse');
  return data;
};

const deleteWarehouse = async (id) => {
  const response = await fetch(`${WAREHOUSES_API}/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || 'Failed to delete warehouse');
  return data;
};

const restoreWarehouse = async (id) => {
  const response = await fetch(`${WAREHOUSES_API}/${id}/restore`, {
    method: 'PATCH',
    credentials: 'include',
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || 'Failed to restore warehouse');
  return data;
};

/* ======================== UTILITY FUNCTIONS ======================== */

const mapWarehouseResponse = (item) => ({
  id: item._id,
  name: item.name,
  code: item.code,
  address: item.address || '',
  description: item.description || '',
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
      <path d="M9 17 24 9l15 8v18l-15 8-15-8V17Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M9 17l15 8 15-8M24 25v18" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
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

const IconBtn = ({ onClick, title, tone = 'slate', children, disabled }) => {
  const toneCls =
    tone === 'indigo' ? "text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50"
    : tone === 'red' ? "text-rose-600 hover:border-rose-200 hover:bg-rose-50"
    : tone === 'emerald' ? "text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50"
    : tone === 'orange' ? "text-orange-500 hover:border-orange-200 hover:bg-orange-50"
    : "text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700";
  return (
    <button
      type="button" onClick={onClick} title={title} aria-label={title} disabled={disabled}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-40 ${toneCls}`}
    >
      {children}
    </button>
  );
};

const LoadingRows = ({ columns = 6, rows = 6 }) => (
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
        <p className="mt-4 text-sm font-medium text-slate-700">No warehouses yet</p>
        <p className="mt-1 text-sm text-slate-400">Adjust your filters, or add a new warehouse to get started.</p>
        <button
          onClick={onCreateClick}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
        >
          {Icon.plus} Add warehouse
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
        <p className="mt-3 text-sm font-medium text-slate-800">Couldn&apos;t load warehouses</p>
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
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">Warehouses</h1>
      <p className="mt-0.5 text-sm text-slate-500">
        {typeof totalItems === 'number' ? `${totalItems} warehouse${totalItems === 1 ? '' : 's'} · ` : ''}
        Physical stock locations used across receiving and inventory.
      </p>
    </div>
    <button
      onClick={onCreateClick}
      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
    >
      {Icon.plus} Add warehouse
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
          placeholder="Search by name or code"
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
    <td className="px-4 py-3.5 text-sm font-mono text-slate-700">
      {item.code}
      {item.code === 'MAIN' && (
        <span className="ml-2 inline-flex items-center rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-600">
          Default
        </span>
      )}
    </td>
    <td className="px-4 py-3.5 text-sm font-medium text-slate-900">{item.name}</td>
    <td className="px-4 py-3.5 text-sm text-slate-500">{item.address || <span className="text-slate-300">—</span>}</td>
    <td className="px-4 py-3.5 text-sm text-slate-500">{item.description || <span className="text-slate-300">—</span>}</td>
    <td className="px-4 py-3.5">
      <StatusBadge isActive={item.isActive} />
    </td>
    <td className="px-4 py-3.5">
      <div className="flex items-center justify-end gap-1">
        <IconBtn onClick={() => onView(item)} title="View" tone="indigo">{Icon.eye}</IconBtn>
        <IconBtn onClick={() => onEdit(item)} title="Edit" tone="orange">{Icon.edit}</IconBtn>
        {item.isActive ? (
          <IconBtn
            onClick={() => onDelete(item)}
            title={item.code === 'MAIN' ? "The default Main Warehouse can't be deleted" : 'Delete'}
            tone="red"
            disabled={item.code === 'MAIN'}
          >
            {Icon.trash}
          </IconBtn>
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
          <th className={th}>Code</th>
          <th className={th}>Name</th>
          <th className={th}>Address</th>
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

/* ======================== FORM ======================== */

const Field = ({ label, hint, error, children }) => (
  <div>
    <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
    {children}
    {hint && !error && <p className="mt-1.5 text-xs text-slate-400">{hint}</p>}
    {error && <p className="mt-1.5 text-xs font-medium text-rose-600">{error}</p>}
  </div>
);

const fieldInputClass = inputCls + ' disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400';

const Form = ({ mode, formData, onChange, onSubmit, onCancel, submitting, errors }) => {
  const isView = mode === 'view';

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Name" error={errors.name}>
            <input
              type="text"
              value={formData.name}
              disabled={isView}
              onChange={(e) => onChange('name', e.target.value)}
              placeholder="e.g. Main Warehouse"
              className={fieldInputClass}
            />
          </Field>

          <Field label="Code" hint="Short unique identifier." error={errors.code}>
            <input
              type="text"
              value={formData.code}
              disabled={isView}
              onChange={(e) => onChange('code', e.target.value.toUpperCase())}
              placeholder="e.g. MAIN"
              className={`${fieldInputClass} font-mono uppercase`}
            />
          </Field>
        </div>

        <Field label="Address">
          <textarea
            value={formData.address}
            disabled={isView}
            onChange={(e) => onChange('address', e.target.value)}
            rows={2}
            placeholder="Physical address of this warehouse"
            className={fieldInputClass}
          />
        </Field>

        <Field label="Description">
          <textarea
            value={formData.description}
            disabled={isView}
            onChange={(e) => onChange('description', e.target.value)}
            rows={2}
            placeholder="Optional notes about this warehouse"
            className={fieldInputClass}
          />
        </Field>

        {errors.general && (
          <div className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
            {Icon.alert}
            <span>{errors.general}</span>
          </div>
        )}
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
            {submitting ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Create warehouse'}
          </button>
        )}
      </div>
    </div>
  );
};

/* ======================== MAIN COMPONENT ======================== */

const Warehouse = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [totalItems, setTotalItems] = useState(0);

  const [modalMode, setModalMode] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [activeItemId, setActiveItemId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  const [confirmTarget, setConfirmTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadWarehouses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getWarehouses({
        page: currentPage,
        limit: itemsPerPage,
        search,
        showInactive: statusFilter !== 'active',
      });
      let mapped = (response?.data || []).map(mapWarehouseResponse);
      let total = response?.pagination?.total ?? mapped.length;

      if (statusFilter === 'inactive') {
        mapped = mapped.filter((f) => !f.isActive);
        total = mapped.length;
      }

      setItems(mapped);
      setTotalItems(total);
    } catch (err) {
      setError(err.message || 'Something went wrong while loading warehouses.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, search, statusFilter]);

  useEffect(() => {
    loadWarehouses();
  }, [loadWarehouses]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  const openCreateModal = () => {
    setFormData(EMPTY_FORM);
    setFormErrors({});
    setActiveItemId(null);
    setModalMode('create');
  };

  const openEditModal = (item) => {
    setFormData({ name: item.name, code: item.code, address: item.address, description: item.description });
    setFormErrors({});
    setActiveItemId(item.id);
    setModalMode('edit');
  };

  const openViewModal = (item) => {
    setFormData({ name: item.name, code: item.code, address: item.address, description: item.description });
    setFormErrors({});
    setActiveItemId(item.id);
    setModalMode('view');
  };

  const closeModal = () => {
    setModalMode(null);
    setActiveItemId(null);
    setFormErrors({});
  };

  const handleFormChange = (field, value) => setFormData((prev) => ({ ...prev, [field]: value }));

  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) errors.name = 'Name is required.';
    if (!formData.code.trim()) errors.code = 'Code is required.';
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
        name: formData.name.trim(),
        code: formData.code.trim(),
        address: formData.address.trim(),
        description: formData.description.trim(),
      };

      if (modalMode === 'create') {
        await createWarehouse(payload);
        toast.success('Warehouse created successfully.');
      } else if (modalMode === 'edit') {
        await updateWarehouse(activeItemId, payload);
        toast.success('Warehouse updated successfully.');
      }

      closeModal();
      await loadWarehouses();
    } catch (err) {
      const message = err.message || 'Failed to save warehouse.';
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
      await deleteWarehouse(confirmTarget.id);
      toast.success('Warehouse deleted successfully.');
      setConfirmTarget(null);
      await loadWarehouses();
    } catch (err) {
      toast.error(err.message || 'Failed to delete warehouse.');
    } finally {
      setDeleting(false);
    }
  };

  const handleRestore = async (item) => {
    try {
      await restoreWarehouse(item.id);
      toast.success('Warehouse restored successfully.');
      await loadWarehouses();
    } catch (err) {
      toast.error(err.message || 'Failed to restore warehouse.');
    }
  };

  const modalTitle =
    modalMode === 'create' ? 'Add warehouse' : modalMode === 'edit' ? 'Edit warehouse' : 'Warehouse details';

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <Header totalItems={totalItems} onCreateClick={openCreateModal} />

      <FilterBar search={search} onSearchChange={setSearch} statusFilter={statusFilter} onStatusFilterChange={setStatusFilter} />

      <Table
        items={items}
        loading={loading}
        error={error}
        onRetry={loadWarehouses}
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
        <Modal title={modalTitle} onClose={closeModal}>
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
        message="Are you sure you want to delete this warehouse?"
        onCancel={() => setConfirmTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
      />
    </div>
  );
};

export default Warehouse;
