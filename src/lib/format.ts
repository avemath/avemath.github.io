const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-05" -> "May 2026", "2026" -> "2026". */
export function formatMonth(value: string, long = false): string {
  const [year, month] = value.split('-');
  if (!month) return year;
  const name = MONTHS[Number(month) - 1];
  if (!long) return `${name} ${year}`;
  return new Date(Number(year), Number(month) - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

/** A start and optional end as "Aug 2024 to May 2025", "2026 to present", or a single year. */
export function formatRange(start: string, end?: string | null, ongoingWord = 'present'): string {
  if (end === undefined || end === null) return `${formatMonth(start)} to ${ongoingWord}`;
  if (start === end) return formatMonth(start);
  return `${formatMonth(start)} to ${formatMonth(end)}`;
}

/** Only the years, for compact timeline labels. */
export function yearRange(start: string, end?: string | null): string {
  const a = start.slice(0, 4);
  if (end === undefined || end === null) return `${a} to now`;
  const b = end.slice(0, 4);
  return a === b ? a : `${a} to ${b}`;
}
