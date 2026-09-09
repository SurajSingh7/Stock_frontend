/* ═══════════════════════════════════════════════════════════════════════════
   Audit log — presentation logic, kept out of the components.

   The API returns each event as the WHOLE record before and after the change
   (services pass full documents to recordAudit), plus a `changedFields` list
   of top-level keys. Top-level keys alone are close to useless on screen:
   "changed: gst, address" does not tell an admin that a GST number was
   swapped. So the real work here is turning two nested documents into a flat,
   readable list of exactly which leaf values moved, and to what.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Bookkeeping fields every document carries. Never the reason someone opened
    this page, so they are grouped away — not hidden, just folded. */
const SYSTEM_FIELDS = new Set([
  '_id', 'id', '__v', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'deletedBy',
]);

/** An array longer than this is compared as a single value rather than
    element by element — a 60-row item list re-indexed by one insert would
    otherwise render as 60 "changes" and bury the one that matters. */
const ARRAY_DETAIL_LIMIT = 25;

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Nested document → { "path.to.leaf": value }. Arrays get index paths
 * (`contacts[0].email`) so a change points at one element, not the whole list.
 */
export const flatten = (value, prefix = '', out = {}, depth = 0) => {
  if (depth > 6 || value === null || value === undefined || typeof value !== 'object') {
    if (prefix) out[prefix] = value;
    return out;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      out[prefix] = [];
    } else if (value.length > ARRAY_DETAIL_LIMIT) {
      out[prefix] = value;
    } else {
      value.forEach((item, i) => flatten(item, `${prefix}[${i}]`, out, depth + 1));
    }
    return out;
  }
  const keys = Object.keys(value);
  if (keys.length === 0) {
    out[prefix] = {};
    return out;
  }
  for (const key of keys) {
    flatten(value[key], prefix ? `${prefix}.${key}` : key, out, depth + 1);
  }
  return out;
};

/** The document key a flattened path belongs to — `items[0].gstRate` → `items`. */
export const rootKey = (path) => path.split(/[.[]/)[0];

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The field-by-field story of one event.
 *
 * `kind` says how to read it: an UPDATE is a set of before → after pairs, a
 * CREATE has no "before" so its fields are the values it started life with,
 * and a DELETE shows what was on the record when it went.
 */
export const buildDiff = (event) => {
  const { before, after } = event || {};
  const hasBefore = before && typeof before === 'object';
  const hasAfter = after && typeof after === 'object';

  if (!hasBefore && !hasAfter) return { kind: 'none', rows: [], systemRows: [] };

  const kind = hasBefore && hasAfter ? 'diff' : hasAfter ? 'created' : 'removed';
  const flatBefore = hasBefore ? flatten(before) : {};
  const flatAfter = hasAfter ? flatten(after) : {};

  const rows = [];
  const systemRows = [];
  const paths = new Set([...Object.keys(flatBefore), ...Object.keys(flatAfter)]);

  for (const path of [...paths].sort()) {
    const from = flatBefore[path];
    const to = flatAfter[path];
    if (kind === 'diff' && same(from, to)) continue;

    const row = {
      path,
      from,
      to,
      change:
        kind !== 'diff'
          ? kind
          : from === undefined
            ? 'added'
            : to === undefined
              ? 'removed'
              : 'changed',
    };
    (SYSTEM_FIELDS.has(rootKey(path)) ? systemRows : rows).push(row);
  }

  return { kind, rows, systemRows };
};

/** Headline for a row in the list: the real fields that moved, noise dropped. */
export const meaningfulFields = (event) =>
  (event?.changedFields || []).filter((f) => !SYSTEM_FIELDS.has(f));

/* ── Values ──────────────────────────────────────────────────────────────── */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

/** A leaf value as a display string, plus tone hints for the empty cases. */
export const formatValue = (v) => {
  if (v === undefined) return { text: 'not set', muted: true };
  if (v === null) return { text: 'null', muted: true };
  if (v === '') return { text: 'empty', muted: true };
  if (typeof v === 'boolean') return { text: String(v), mono: true };
  if (typeof v === 'number') return { text: String(v), mono: true };
  if (typeof v === 'string') {
    if (ISO_DATE.test(v)) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return { text: fmtDateTime(d) };
    }
    return { text: v };
  }
  if (Array.isArray(v) && v.length === 0) return { text: 'empty list', muted: true };
  if (isPlainObject(v) && Object.keys(v).length === 0) return { text: 'empty', muted: true };
  return { text: JSON.stringify(v), mono: true };
};

/* ── Time ────────────────────────────────────────────────────────────────── */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n) => String(n).padStart(2, '0');

export const fmtDateTime = (input) => {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const fmtClock = (input) => {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** "4 min ago" — the first thing anyone wants from an audit trail. */
export const fmtRelative = (input) => {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const secs = Math.round((Date.now() - d.getTime()) / 1000);
  if (secs < 45) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  if (days < 30) return `${Math.round(days / 7)} week${Math.round(days / 7) === 1 ? '' : 's'} ago`;
  if (days < 365) return `${Math.round(days / 30)} month${Math.round(days / 30) === 1 ? '' : 's'} ago`;
  return `${Math.round(days / 365)} yr ago`;
};

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Heading for a day separator in the list. */
export const dayLabel = (input) => {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return 'Unknown date';
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

export const dayKey = (input) => {
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? 'unknown' : String(startOfDay(d));
};

/* ── Labels ──────────────────────────────────────────────────────────────── */

/**
 * Colour carries meaning on this surface, same as the rest of Access Control:
 * emerald made something, rose removed or refused it, indigo configured
 * access, amber moved a record along. An action nobody has mapped yet stays
 * slate rather than being forced into a colour it might not deserve.
 */
export const actionTone = (action = '') => {
  if (/^(CREATE|ADD_|APPROVE|RESTORE|GENERATE)/.test(action)) return 'emerald';
  if (/^(DELETE|REJECT|REMOVE|CLEAR_|REVOKE)/.test(action)) return 'rose';
  if (/^(SET_|DELEGATE)/.test(action)) return 'indigo';
  if (/^(UPDATE|PROCESS|REVIEW|TOGGLE|SEND_|MOVE|REORDER)/.test(action)) return 'amber';
  return 'slate';
};

export const ACTION_TONE_CLASS = {
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  rose: 'border-rose-200 bg-rose-50 text-rose-700',
  indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  slate: 'border-slate-200 bg-slate-50 text-slate-600',
};

export const ACTION_DOT_CLASS = {
  emerald: 'bg-emerald-500',
  rose: 'bg-rose-500',
  indigo: 'bg-indigo-500',
  amber: 'bg-amber-500',
  slate: 'bg-slate-400',
};

/** `purchase-orders` → `Purchase orders`. `Permission` is already a label. */
export const entityLabel = (type = '') =>
  type.includes('-')
    ? type.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase())
    : type;

export const actionLabel = (action = '') => action.replace(/_/g, ' ');

/**
 * A user agent, shortened to the two things worth reading in an audit trail:
 * which browser, on which OS. The full string stays in the raw JSON below it.
 */
export const describeClient = (ua = '') => {
  if (!ua) return '';
  const match = (re) => re.exec(ua)?.[1];
  const browser =
    (match(/Edg\/(\d+)/) && `Edge ${match(/Edg\/(\d+)/)}`) ||
    (match(/OPR\/(\d+)/) && `Opera ${match(/OPR\/(\d+)/)}`) ||
    (match(/Firefox\/(\d+)/) && `Firefox ${match(/Firefox\/(\d+)/)}`) ||
    (match(/Chrome\/(\d+)/) && `Chrome ${match(/Chrome\/(\d+)/)}`) ||
    (match(/Version\/(\d+).*Safari/) && `Safari ${match(/Version\/(\d+).*Safari/)}`) ||
    '';
  const os =
    /Windows NT/.test(ua) ? 'Windows'
      : /Mac OS X/.test(ua) ? 'macOS'
        : /Android/.test(ua) ? 'Android'
          : /iPhone|iPad/.test(ua) ? 'iOS'
            : /Linux/.test(ua) ? 'Linux'
              : '';
  if (!browser && !os) return ua.slice(0, 40);
  return [browser, os].filter(Boolean).join(' · ');
};
