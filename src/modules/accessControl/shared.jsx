'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/* ═══════════════════════════════════════════════════════════════════════════
   Access Control design system.

   This is a security console, so colour carries meaning and nothing else:
     emerald → granted / open        rose   → denied / removed
     amber   → restrictive / caution indigo → the one accent, for "configured"
     slate   → inherited / default
   Identifiers (module keys, entity aliases, ids) are monospaced, because on a
   configuration surface knowing the exact string matters.
   ═══════════════════════════════════════════════════════════════════════════ */

export const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-50';

export const th =
  'px-4 py-3 text-left text-[0.68rem] font-bold uppercase tracking-wider text-slate-500';

/* ── Section navigation ─────────────────────────────────────────────────────
   Admins move between these constantly while setting one person up, so the
   whole section is reachable from every page rather than via the main navbar. */
const SECTION_LINKS = [
  { href: '/access-control/modules', label: 'Modules', icon: '▦' },
  { href: '/access-control/roles', label: 'Roles', icon: '◈' },
  { href: '/access-control/departments', label: 'Departments', icon: '▤' },
  { href: '/access-control/users', label: 'Users', icon: '◉' },
  { href: '/access-control/delegate', label: 'Delegate', icon: '⇄' },
  { href: '/access-control/audit-log', label: 'Audit Log', icon: '◷' },
];

export const SectionNav = () => {
  const pathname = usePathname();
  return (
    <nav className="mb-6 flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
      {SECTION_LINKS.map((l) => {
        const active = pathname?.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition ${
              active
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className={active ? 'text-indigo-300' : 'text-slate-400'}>{l.icon}</span>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
};

/* ── Page shell ─────────────────────────────────────────────────────────────
   Every screen states the one question it answers, so an admin always knows
   which of the two layers (actions vs data) they are looking at. */
export const PageShell = ({ title, question, description, actions, children }) => (
  <div className="min-h-screen bg-slate-100/70">
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-[1400px] px-6 pt-6 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            {question && (
              <p className="mb-1 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-indigo-600">
                {question}
              </p>
            )}
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
            {description && <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-500">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      </div>
    </div>
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      <SectionNav />
      {children}
    </div>
  </div>
);

/* Kept for pages not yet migrated to PageShell. */
export const PageHeader = ({ title, description }) => (
  <div className="mb-5">
    <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
    {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
  </div>
);

export const Card = ({ title, description, children, className = '', tone = 'default', badge }) => {
  const tones = {
    default: 'border-slate-200 bg-white',
    accent: 'border-indigo-200 bg-indigo-50/40',
    warn: 'border-amber-200 bg-amber-50/50',
    danger: 'border-rose-200 bg-rose-50/40',
  };
  return (
    <div className={`rounded-2xl border shadow-sm ${tones[tone]} ${className}`}>
      {title && (
        <div className="flex items-start justify-between gap-3 border-b border-slate-200/70 px-5 py-4">
          <div>
            <p className="text-[0.95rem] font-semibold text-slate-900">{title}</p>
            {description && <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">{description}</p>}
          </div>
          {badge}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
};

export const Field = ({ label, hint, children }) => (
  <div>
    {label && <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>}
    {children}
    {hint && <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{hint}</p>}
  </div>
);

export const PrimaryButton = ({ children, disabled, onClick, type = 'button' }) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
  >
    {children}
  </button>
);

export const GhostButton = ({ children, onClick, tone = 'slate', disabled }) => {
  const tones = {
    slate: 'border-slate-200 text-slate-600 hover:bg-slate-50',
    rose: 'border-rose-200 text-rose-600 hover:bg-rose-50',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]}`}
    >
      {children}
    </button>
  );
};

/* ── Semantic pills ─────────────────────────────────────────────────────── */

/** An action the user does or does not hold. */
export const ActionPill = ({ children, state = 'neutral' }) => {
  const states = {
    granted: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    removed: 'border-rose-200 bg-rose-50 text-rose-700',
    added: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    neutral: 'border-slate-200 bg-slate-50 text-slate-500',
  };
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[0.7rem] font-semibold ${states[state]}`}>
      {children}
    </span>
  );
};

/** A data-scope mode. Colour tracks how open it is, so a screen full of
    scopes can be read at a glance: amber tight → emerald wide. */
export const ScopePill = ({ scope, detail }) => {
  const states = {
    OWN: 'border-amber-200 bg-amber-50 text-amber-800',
    SELECTED: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    ALL: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[0.7rem] font-semibold ${states[scope] || states.OWN}`}>
      {scope}
      {detail ? <span className="font-normal opacity-70">· {detail}</span> : null}
    </span>
  );
};

export const Mono = ({ children }) => (
  <span className="font-mono text-[0.78rem] text-slate-500">{children}</span>
);

export const Toggle = ({ active, onClick, children, disabled }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
      active
        ? 'border-indigo-300 bg-indigo-600 text-white shadow-sm'
        : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'
    }`}
  >
    {children}
  </button>
);

export const ActionChecklist = ({ actions = [], checked = [], onToggle, disabled, emptyLabel }) => (
  <div className="flex flex-wrap gap-2">
    {actions.length === 0 && (
      <p className="text-sm text-slate-400">{emptyLabel || 'Pick a module to see its actions.'}</p>
    )}
    {actions.map((action) => (
      <Toggle key={action} active={checked.includes(action)} disabled={disabled} onClick={() => onToggle(action)}>
        {action}
      </Toggle>
    ))}
  </div>
);

export const Banner = ({ tone = 'info', children }) => {
  const tones = {
    info: 'border-slate-200 bg-slate-50 text-slate-600',
    warn: 'border-amber-200 bg-amber-50 text-amber-900',
    error: 'border-rose-200 bg-rose-50 text-rose-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  };
  return <div className={`rounded-lg border px-3.5 py-2.5 text-sm leading-relaxed ${tones[tone]}`}>{children}</div>;
};

export const EmptyRow = ({ colSpan, children }) => (
  <tr>
    <td colSpan={colSpan} className="px-6 py-12 text-center text-sm text-slate-400">
      {children}
    </td>
  </tr>
);

export const TableShell = ({ head, children }) => (
  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
    <table className="min-w-full divide-y divide-slate-200">
      <thead className="bg-slate-50">
        <tr>{head.map((h) => <th key={h} className={th}>{h}</th>)}</tr>
      </thead>
      <tbody className="divide-y divide-slate-100">{children}</tbody>
    </table>
  </div>
);

/* ── Debounced search-and-select ────────────────────────────────────────── */

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
        <button type="button" onClick={onClear} className="shrink-0 text-xs font-semibold text-indigo-600 hover:text-indigo-700">
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
        <div className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
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
                className="block w-full border-b border-slate-50 px-3 py-2 text-left text-sm last:border-0 hover:bg-indigo-50/50"
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
