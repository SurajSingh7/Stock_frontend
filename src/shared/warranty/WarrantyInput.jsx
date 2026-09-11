"use client";

import { useState } from "react";

/*
  Number + unit picker for a warranty that is stored in MONTHS.

  The user types in whichever unit is natural ("2 Years", "18 Months"); the
  parent only ever receives `months` — a number, or null when empty. It may be
  a non-integer or out of range while typing; validate it with
  isValidWarrantyMonths (shared/warranty/warranty.js) where the form validates.

  Switching the unit re-reads the typed number in the new unit (2 Months ->
  2 Years), which is what someone reaching for the dropdown means.
*/

const UNIT_FACTOR = { months: 1, years: 12 };

const toDraft = (months) => {
  if (months === null || months === undefined || months === "") return { value: "", unit: "years" };
  const m = Number(months);
  if (Number.isFinite(m) && m > 0 && m % 12 === 0) return { value: String(m / 12), unit: "years" };
  return { value: String(months), unit: "months" };
};

// Never NaN: `seen` is compared with !==, and NaN !== NaN would re-sync forever.
const toMonths = ({ value, unit }) => {
  const n = Number(value) * UNIT_FACTOR[unit];
  return value === "" || !Number.isFinite(n) ? null : n;
};

const normalise = (months) => (months === "" || months === undefined ? null : months);

const SIZES = {
  md: {
    input: "h-[38px] w-full min-w-0 rounded-l-lg px-3 text-sm",
    select: "h-[38px] rounded-r-lg px-2 text-sm",
  },
  sm: {
    input: "h-8 w-16 rounded-l-lg px-2 text-sm",
    select: "h-8 rounded-r-lg px-1.5 text-xs",
  },
};

export default function WarrantyInput({
  months,
  onChange,
  disabled = false,
  invalid = false,
  size = "md",
  id,
  placeholder = "e.g. 1",
}) {
  const [draft, setDraft] = useState(() => toDraft(months));
  const [seen, setSeen] = useState(normalise(months));

  // A value set from outside (form reset, edit load, toggle revert) replaces
  // the draft — unless the draft already means the same number of months, so
  // the user's own keystrokes and unit choice are not reformatted under them.
  if (normalise(months) !== seen) {
    setSeen(normalise(months));
    if (toMonths(draft) !== normalise(months)) setDraft(toDraft(months));
  }

  const update = (next) => {
    setDraft(next);
    const m = toMonths(next);
    setSeen(m);
    onChange?.(m);
  };

  const s = SIZES[size] || SIZES.md;
  const border = invalid
    ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
    : "border-slate-200 focus:border-indigo-400 focus:ring-indigo-100";
  const surface = disabled ? "bg-slate-50 text-slate-500" : "bg-white text-slate-900";

  return (
    <div className="flex items-stretch shadow-sm">
      <input
        id={id}
        type="number"
        min="1"
        step="1"
        inputMode="numeric"
        value={draft.value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => update({ ...draft, value: e.target.value })}
        className={`${s.input} ${border} ${surface} border tabular-nums placeholder:text-slate-400 transition focus:z-10 focus:outline-none focus:ring-2 disabled:cursor-not-allowed`}
      />
      <select
        value={draft.unit}
        disabled={disabled}
        aria-label="Warranty unit"
        onChange={(e) => update({ ...draft, unit: e.target.value })}
        className={`${s.select} ${border} ${surface} -ml-px border transition focus:z-10 focus:outline-none focus:ring-2 disabled:cursor-not-allowed`}
      >
        <option value="months">Months</option>
        <option value="years">Years</option>
      </select>
    </div>
  );
}
