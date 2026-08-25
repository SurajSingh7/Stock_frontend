'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';

export const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";

export const th = "px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-700";

export const PageHeader = ({ title, description }) => (
  <div className="mb-5">
    <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
    {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
  </div>
);

export const Card = ({ title, description, children, className = '' }) => (
  <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
    {title && (
      <div className="mb-4">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
    )}
    {children}
  </div>
);

export const Field = ({ label, hint, children }) => (
  <div>
    <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
    {children}
    {hint && <p className="mt-1.5 text-xs text-slate-400">{hint}</p>}
  </div>
);

export const PrimaryButton = ({ children, disabled, onClick, type = 'button' }) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
  >
    {children}
  </button>
);

export const ActionChecklist = ({ actions = [], checked = [], onToggle, disabled }) => (
  <div className="flex flex-wrap gap-2">
    {actions.length === 0 && <p className="text-sm text-slate-400">Pick a module to see its actions.</p>}
    {actions.map((action) => {
      const isChecked = checked.includes(action);
      return (
        <button
          key={action}
          type="button"
          disabled={disabled}
          onClick={() => onToggle(action)}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
            isChecked
              ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
              : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
          }`}
        >
          {action}
        </button>
      );
    })}
  </div>
);

export const Banner = ({ tone = 'info', children }) => {
  const toneCls =
    tone === 'error'
      ? 'bg-rose-50 text-rose-700'
      : tone === 'success'
      ? 'bg-emerald-50 text-emerald-700'
      : 'bg-slate-50 text-slate-600';
  return <div className={`rounded-lg px-3 py-2.5 text-sm ${toneCls}`}>{children}</div>;
};

export const EmptyRow = ({ colSpan, children }) => (
  <tr>
    <td colSpan={colSpan} className="px-6 py-10 text-center text-sm text-slate-400">
      {children}
    </td>
  </tr>
);

// Debounced search-and-select, backed by any `fetcher(search) => [{id, label, description}]`.
// Used for the HRMS role/user pickers (see hrmsDirectory.js) — kept generic
// so it isn't tied to that one source.
export const Picker = ({ fetcher, placeholder = 'Search…', selected, onSelect, onClear }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const boxRef = useRef(null);

  const runSearch = useCallback(
    async (q) => {
      setLoading(true);
      setError(null);
      try {
        setResults(await fetcher(q));
      } catch (err) {
        setError(err.message || 'Search failed');
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [fetcher]
  );

  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => runSearch(query), 300);
    return () => clearTimeout(handle);
  }, [query, open, runSearch]);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">{selected.label}</p>
          {selected.description && <p className="truncate text-xs text-slate-400">{selected.description}</p>}
        </div>
        <button type="button" onClick={onClear} className="shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-700">
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={boxRef}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => { setOpen(true); runSearch(query); }}
        placeholder={placeholder}
        className={inputCls}
      />
      {open && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {loading ? (
            <p className="px-3 py-2.5 text-sm text-slate-400">Searching…</p>
          ) : error ? (
            <p className="px-3 py-2.5 text-sm text-rose-600">{error}</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-slate-400">No matches.</p>
          ) : (
            results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => { onSelect(r); setOpen(false); setQuery(''); }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <p className="font-medium text-slate-900">{r.label}</p>
                {r.description && <p className="text-xs text-slate-400">{r.description}</p>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};
