// apps/web/src/utils/format.js

/**
 * Land/title work benefits from readable acreage precision.
 * - Large tracts: 1 decimal
 * - Medium tracts: 2 decimals
 * - Small tracts: 3 decimals
 */
export function fmtAcres(m2) {
  const acres = m2 / 4046.8564224;

  if (acres >= 50) return `${acres.toFixed(1)} ac`;
  if (acres >= 1) return `${acres.toFixed(2)} ac`;
  return `${acres.toFixed(3)} ac`;
}

/** Explicit tenth-acre display when you want quick field-style readability. */
export function fmtAcresTenth(m2) {
  const acres = m2 / 4046.8564224;
  return `${acres.toFixed(1)} ac`;
}

export function fmtMiles(m) {
  return `${(m / 1609.344).toFixed(2)} mi`;
}

export function fmtFeet(m) {
  return `${(m * 3.28084).toFixed(0)} ft`;
}

export function fmtPerimeter(m) {
  if (m < 402.336) return fmtFeet(m);
  return fmtMiles(m);
}

/**
 * Formats a net mineral acres value for display.
 * Existing data stored as free-text date strings (e.g. "01/05/2019") is handled
 * by fmtDate and chain sort via Date.parse, which accepts both ISO (YYYY-MM-DD)
 * and locale strings. Falls back to the original string if parsing fails.
 */
export function fmtNMA(value) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  if (n === 0) return "0.0000 NMA";
  if (n >= 100) return `${n.toFixed(2)} NMA`;
  if (n >= 1) return `${n.toFixed(4)} NMA`;
  return `${n.toFixed(6)} NMA`;
}

/**
 * Normalizes an ISO date-only string (YYYY-MM-DD) to include a noon time
 * component so it isn't parsed as UTC midnight (which shifts to the previous
 * calendar day in US timezones). Other formats are returned unchanged.
 */
export function normalizeDateStr(s) {
  const str = String(s || "");
  return /^\d{4}-\d{2}-\d{2}$/.test(str) ? `${str}T12:00:00` : str;
}

export function fmtDate(dateStr) {
  if (!dateStr) return "—";
  // ISO date-only strings (YYYY-MM-DD) are parsed as UTC midnight by the Date
  // constructor, which causes US timezones to display the previous calendar day.
  // Appending a noon time component keeps the correct calendar date in any
  // timezone from UTC-11 to UTC+11.
  const d = new Date(normalizeDateStr(String(dateStr)));
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
