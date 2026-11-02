// Code for the How it works and Code tabs, cut at build time from the files that actually run,
// with their real line numbers. Files in src/lib mark their excerpts with `#region how:<name>`
// and `#endregion` comments. Vendored files stay unmodified, so their excerpts are found by a
// line they start with and a line count.
import { highlight } from './highlight';

export type Lang = 'py' | 'cpp' | 'ts';
export interface Excerpt {
  /** Highlighted HTML, one entry per line. */
  lines: string[];
  /** The real line number of the first line. */
  from: number;
}

const strip = (lines: string[]) => {
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)![0].length));
  return lines.map((l) => l.slice(indent));
};

const paint = (lines: string[], lang: Lang) => lines.map((l) => highlight(l, lang) || ' ');

/** The lines between `#region how:<name>` and the next `#endregion`. */
export function region(source: string, name: string, lang: Lang = 'ts'): Excerpt {
  const all = source.split('\n');
  const start = all.findIndex((l) => l.includes(`#region how:${name}`));
  if (start < 0) throw new Error(`No #region how:${name}`);
  const end = all.findIndex((l, i) => i > start && l.includes('#endregion'));
  return { lines: paint(strip(all.slice(start + 1, end)), lang), from: start + 2 };
}

/** `count` lines starting at the first line that contains `from`. */
export function cut(source: string, from: string, count: number, lang: Lang): Excerpt {
  const all = source.split('\n');
  const start = all.findIndex((l) => l.includes(from));
  if (start < 0) throw new Error(`Excerpt not found: ${from}`);
  return { lines: paint(strip(all.slice(start, start + count)), lang), from: start + 1 };
}

/** A whole file, line by line, for the Code tab. */
export function whole(source: string, lang: Lang): { n: number; html: string }[] {
  return source
    .replace(/\n$/, '')
    .split('\n')
    .map((l, i) => ({ n: i + 1, html: highlight(l, lang) || ' ' }));
}

/** The real line number of the first line that contains `text`. */
export function lineOf(source: string, text: string, after = 0) {
  const i = source.split('\n').findIndex((l, n) => n >= after && l.includes(text));
  if (i < 0) throw new Error(`Line not found: ${text}`);
  return i + 1;
}
