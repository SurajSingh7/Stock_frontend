/*
  Warranty is stored and sent as a whole number of MONTHS (`warrantyMonths`)
  everywhere — product default, vendor override, quotation line. These helpers
  are the only place the UI turns that into words or checks its range; keep
  them in step with stock-backend/helpers/stock.warranty.helper.js.
*/
export const WARRANTY_MONTHS_MIN = 1;
export const WARRANTY_MONTHS_MAX = 120;

export const WARRANTY_RANGE_MESSAGE = "Warranty must be between 1 month and 10 years, in whole months";

export const isValidWarrantyMonths = (v) =>
  typeof v === "number" && Number.isInteger(v) && v >= WARRANTY_MONTHS_MIN && v <= WARRANTY_MONTHS_MAX;

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const split = (months) => {
  if (months === null || months === undefined || months === "") return null;
  const m = Number(months);
  if (!Number.isFinite(m) || m <= 0) return null;
  return { years: Math.floor(m / 12), rest: m % 12 };
};

// 60 -> "5 years", 18 -> "1 year 6 months", 6 -> "6 months", null -> "—"
export const formatWarranty = (months) => {
  const s = split(months);
  if (!s) return "—";
  return [s.years && plural(s.years, "year", "years"), s.rest && plural(s.rest, "month", "months")]
    .filter(Boolean)
    .join(" ");
};

// Compact form for tables and chips: "5 yrs", "1 yr 6 mo", "6 mo"
export const formatWarrantyShort = (months) => {
  const s = split(months);
  if (!s) return "—";
  return [s.years && `${s.years} ${s.years === 1 ? "yr" : "yrs"}`, s.rest && `${s.rest} mo`]
    .filter(Boolean)
    .join(" ");
};
