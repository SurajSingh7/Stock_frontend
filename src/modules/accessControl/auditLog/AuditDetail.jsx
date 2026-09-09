'use client';
import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Card } from '../shared';
import {
  ACTION_TONE_CLASS,
  actionLabel,
  actionTone,
  buildDiff,
  describeClient,
  entityLabel,
  fmtDateTime,
  fmtRelative,
  formatValue,
} from './auditFormat';

/* ═══════════════════════════════════════════════════════════════════════════
   One event, in full — a page of its own, not a panel over the list.

   The list answers "what happened"; this answers "what exactly changed, and
   who was sitting at which machine when they did it" — the two questions the
   table version of this page left an admin guessing at. It reads nothing from
   the API: every field here arrived with the row that was clicked.
   ═══════════════════════════════════════════════════════════════════════════ */

const LONG_VALUE = 220;

const copy = async (text, what) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied`);
  } catch {
    toast.error('Could not copy — clipboard is blocked in this browser');
  }
};

const CopyButton = ({ value, what = 'Value' }) => (
  <button
    type="button"
    onClick={() => copy(value, what)}
    title={`Copy ${what.toLowerCase()}`}
    className="shrink-0 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[0.65rem] font-semibold text-slate-400 transition hover:border-slate-300 hover:text-slate-700"
  >
    copy
  </button>
);

/** A single leaf value. Long ones stay collapsed so one 2 KB HTML terms field
    cannot push the rest of the change off the screen. */
const Value = ({ value, tone = 'slate' }) => {
  const [open, setOpen] = useState(false);
  const { text, muted, mono } = formatValue(value);
  const long = text.length > LONG_VALUE;
  const tones = {
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
    rose: 'bg-rose-50/70 text-rose-900 border-rose-200',
    emerald: 'bg-emerald-50/70 text-emerald-900 border-emerald-200',
  };
  return (
    <div className={`rounded-lg border px-2.5 py-1.5 ${tones[tone]}`}>
      <p
        className={`break-words text-[0.8rem] leading-relaxed ${mono ? 'font-mono' : ''} ${
          muted ? 'italic opacity-50' : ''
        } ${long && !open ? 'line-clamp-3' : ''}`}
      >
        {text}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-1 text-[0.68rem] font-semibold text-indigo-600 hover:text-indigo-700"
        >
          {open ? 'Show less' : `Show all ${text.length} characters`}
        </button>
      )}
    </div>
  );
};

const CHANGE_BADGE = {
  changed: { label: 'changed', cls: 'bg-amber-100 text-amber-800' },
  added: { label: 'added', cls: 'bg-emerald-100 text-emerald-800' },
  removed: { label: 'removed', cls: 'bg-rose-100 text-rose-800' },
  created: { label: 'set', cls: 'bg-emerald-100 text-emerald-800' },
};

const DiffRow = ({ row, kind }) => (
  <div className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] sm:gap-5">
    <div className="min-w-0">
      <p className="break-all font-mono text-[0.75rem] font-semibold text-slate-800">{row.path}</p>
      {kind === 'diff' && (
        <span
          className={`mt-1 inline-flex rounded px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide ${
            (CHANGE_BADGE[row.change] || CHANGE_BADGE.changed).cls
          }`}
        >
          {(CHANGE_BADGE[row.change] || CHANGE_BADGE.changed).label}
        </span>
      )}
    </div>

    {kind === 'diff' ? (
      <div className="grid grid-cols-1 items-start gap-1.5 sm:grid-cols-[1fr_auto_1fr] sm:gap-3">
        <Value value={row.from} tone="rose" />
        <span className="hidden self-center text-slate-300 sm:block">→</span>
        <Value value={row.to} tone="emerald" />
      </div>
    ) : (
      <Value value={kind === 'created' ? row.to : row.from} />
    )}
  </div>
);

/** One label/value line in the "Who did it" card. */
const Line = ({ label, value, mono, children }) => (
  <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 py-2 last:border-0">
    <span className="shrink-0 text-[0.68rem] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
    {children || (
      <span className={`min-w-0 break-words text-right text-sm text-slate-800 ${mono ? 'font-mono text-[0.78rem]' : ''}`}>
        {value || <span className="text-slate-300">—</span>}
      </span>
    )}
  </div>
);

const AuditDetail = ({ event, onBack, onViewRecordHistory }) => {
  const [showSystem, setShowSystem] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  // Escape goes back to the list — the keyboard habit anyone gets from every
  // other detail screen in this app.
  useEffect(() => {
    if (!event) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onBack(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [event, onBack]);

  const diff = useMemo(() => buildDiff(event), [event]);

  if (!event) return null;

  const tone = actionTone(event.action);
  const actor = event.actor || {};
  const client = describeClient(actor.userAgent);
  const initial = (actor.name || '?').trim().charAt(0).toUpperCase();
  const heading =
    diff.kind === 'created' ? 'Created with these values'
      : diff.kind === 'removed' ? 'Values on the record when this happened'
        : 'What changed';

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
        >
          <span className="text-slate-400">←</span> Back to audit log
        </button>
        <p className="text-xs text-slate-400">
          Your filters and page are kept — going back does not reload the list.
        </p>
      </div>

      {/* Event header */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 bg-gradient-to-br from-slate-50 to-white px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-bold tracking-wide ${ACTION_TONE_CLASS[tone]}`}
              >
                {actionLabel(event.action)}
              </span>
              <h2 className="text-lg font-bold tracking-tight text-slate-900">
                {entityLabel(event.entityType)}
              </h2>
            </div>
            <p className="mt-1.5 text-sm text-slate-500">
              {fmtDateTime(event.createdAt)}
              <span className="text-slate-300"> · </span>
              <span className="text-slate-400">{fmtRelative(event.createdAt)}</span>
              <span className="text-slate-300"> · by </span>
              <span className="font-medium text-slate-700">{actor.name || 'unknown'}</span>
              {actor.employeeCode && (
                <span className="ml-1.5 rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[0.7rem] text-slate-500">
                  {actor.employeeCode}
                </span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1">
              <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">Record</span>
              <span className="font-mono text-[0.72rem] text-slate-700">{String(event.entityId)}</span>
              <CopyButton value={String(event.entityId)} what="Record id" />
            </span>
            {onViewRecordHistory && (
              <button
                type="button"
                onClick={() => onViewRecordHistory(event)}
                className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
              >
                See this record’s full history →
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Left — what actually happened */}
        <div className="space-y-5">
          {event.reason && (
            <Card title="Reason given">
              <p className="rounded-lg border border-amber-200 bg-amber-50/60 px-3.5 py-2.5 text-sm leading-relaxed text-amber-900">
                {event.reason}
              </p>
            </Card>
          )}

          <Card
            title={heading}
            description={
              diff.kind === 'diff'
                ? `${diff.rows.length} field${diff.rows.length === 1 ? '' : 's'} moved, compared value by value through every nested object.`
                : undefined
            }
            badge={
              diff.systemRows.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowSystem((v) => !v)}
                  className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-800"
                >
                  {showSystem ? 'Hide' : 'Show'} system fields ({diff.systemRows.length})
                </button>
              )
            }
          >
            {diff.kind === 'none' ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-500">
                This action recorded no before/after snapshot. Actions like sending a mail or approving a
                request are logged for the trail itself, not for a field change.
              </p>
            ) : (
              <>
                {diff.rows.length === 0 && diff.kind === 'diff' && (
                  <p className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-500">
                    Nothing outside the bookkeeping fields changed — the record was saved without a real edit.
                  </p>
                )}
                {(diff.rows.length > 0 || showSystem) && (
                  <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
                    {diff.rows.map((row) => (
                      <DiffRow key={row.path} row={row} kind={diff.kind} />
                    ))}
                    {showSystem &&
                      diff.systemRows.map((row) => (
                        <div key={row.path} className="bg-slate-50/60">
                          <DiffRow row={row} kind={diff.kind} />
                        </div>
                      ))}
                  </div>
                )}
              </>
            )}
          </Card>

          <Card
            title="Raw event"
            description="Exactly what the API returned, for when a screenshot has to prove something."
            badge={
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => setShowRaw((v) => !v)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-800"
                >
                  {showRaw ? 'Hide' : 'Show'} JSON
                </button>
                <button
                  type="button"
                  onClick={() => copy(JSON.stringify(event, null, 2), 'Event JSON')}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-800"
                >
                  Copy JSON
                </button>
              </div>
            }
          >
            {showRaw ? (
              <pre className="max-h-[32rem] overflow-auto rounded-xl bg-slate-900 px-4 py-3.5 text-[0.72rem] leading-relaxed text-slate-200">
                {JSON.stringify(event, null, 2)}
              </pre>
            ) : (
              <p className="text-sm text-slate-400">Hidden — the fields above are the readable version of it.</p>
            )}
          </Card>
        </div>

        {/* Right — who, and from where */}
        <div className="space-y-5">
          <Card title="Who did it" description="A snapshot taken at the time — not a live lookup into HRMS.">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-base font-bold text-white">
                {initial}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[0.95rem] font-semibold text-slate-900">
                  {actor.name || <span className="text-slate-300">Unknown</span>}
                </p>
                <p className="font-mono text-[0.75rem] text-slate-500">
                  {actor.employeeCode || <span className="not-italic text-slate-300">no employee code</span>}
                </p>
              </div>
            </div>

            <Line label="Employee code" value={actor.employeeCode} mono />
            <Line label="Role" value={actor.roleName} />
            <Line label="Email" value={actor.email} />
            <Line label="IP address" value={actor.ipAddress} mono />
            <Line label="Browser" value={client} />
            <Line label="Branch" value={actor.branchId ? String(actor.branchId) : ''} mono />
            <Line label="HRMS id">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate font-mono text-[0.78rem] text-slate-700">
                  {actor.userId ? String(actor.userId) : '—'}
                </span>
                {actor.userId && <CopyButton value={String(actor.userId)} what="User id" />}
              </span>
            </Line>

            {!actor.employeeCode && (
              <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500">
                Employee code started being recorded on new events only. Older events kept whatever HRMS
                returned at the time, which did not include it.
              </p>
            )}
          </Card>

          <Card title="Event">
            <Line label="Type" value={entityLabel(event.entityType)} />
            <Line label="Action" value={actionLabel(event.action)} />
            <Line label="Recorded" value={fmtDateTime(event.createdAt)} />
            <Line label="Event id">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate font-mono text-[0.78rem] text-slate-700">{String(event._id)}</span>
                <CopyButton value={String(event._id)} what="Event id" />
              </span>
            </Line>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AuditDetail;
