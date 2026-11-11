// Checks that no acronym or jargon name from src/data/glossary.json appears on a page before it has
// been explained there. Part of `npm run verify` (after the build): it reads every built page.
//
// Walking each page's visible text in document order, the first use of a term must be one of:
//   - spelled out: "full name (TERM)", for example "vehicle-to-vehicle (V2V)" (plural full names
//     count: "decibels (dB)"); for a name that isn't an acronym (JANUS, BELLHOP) the term followed by
//     an explanation: "JANUS, a NATO standard" or "BELLHOP (a widely used ...)"; a full name that
//     starts with the term counts when written out in place ("ASTM International");
//   - inside a <Term> (src/components/Term.astro), which shows the full name and meaning on demand.
// Exempt, since they can keep the short form: headings (h1 to h6) and marked titles ([data-title]),
// whose next lines spell it out. Text drawn in an SVG figure can't hold a popover, so a term there
// passes if the page spells it out anywhere (its caption, usually); the same goes for an interactive
// figure's own labels and readouts, marked [data-fig] (stage buttons, a live readout that a script
// rewrites), which can't hold a popover either. Hidden text (scripts, styles,
// code, [hidden], closed dialogs, screen-reader-only text) doesn't count.
import { readFileSync, globSync } from 'node:fs';
import { parse } from 'ultrahtml';

const DIST = process.argv[2] ?? 'dist';
const glossary = JSON.parse(readFileSync(new URL('../src/data/glossary.json', import.meta.url), 'utf8')).terms;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// A term as a whole word: not part of a longer word, and not the tail of a hyphenated one (BFSK in
// FH-BFSK); a plural s is allowed (SDRs).
const termRe = new RegExp(`(?<![\\w-])(${glossary.map((g) => esc(g.term)).sort((a, b) => b.length - a.length).join('|')})(?:s)?(?![\\w])`, 'g');
const byTerm = new Map(glossary.map((g) => [g.term, g]));

const SKIP = new Set(['head', 'title', 'script', 'style', 'template', 'noscript', 'code', 'pre', 'kbd', 'samp']);
const BLOCK = new Set(['p', 'li', 'td', 'th', 'dt', 'dd', 'div', 'section', 'article', 'figcaption', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'footer', 'main', 'nav', 'aside', 'figure', 'blockquote', 'table', 'tr', 'ul', 'ol', 'br', 'button', 'label']);
const hidden = (n) => {
  const a = n.attributes ?? {};
  if ('hidden' in a) return true;
  if (n.name === 'dialog' && !('open' in a)) return true;
  if (/(^|\s)sr-only(\s|$)/.test(a.class ?? '')) return true;
  if (/display\s*:\s*none/.test(a.style ?? '')) return true;
  return false;
};
const decode = (s) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));

function scan(file) {
  const doc = parse(readFileSync(file, 'utf8'));
  // One stream of visible text, in order, with pieces marked: body, exempt (headings, titles), svg.
  const pieces = [];
  const terms = new Set(); // introduced by <Term>
  const nested = []; // a <Term> button inside a link or another button: not allowed in HTML
  const walk = (n, ctx, inside = false) => {
    if (n.type === 2) {
      pieces.push({ text: decode(n.value).replace(/\s+/g, ' '), kind: ctx });
      return;
    }
    if (n.type !== 1 && n.type !== 0) return;
    const name = n.name;
    if (n.type === 1) {
      if (SKIP.has(name) || hidden(n)) return;
      const a = n.attributes ?? {};
      if ('data-term' in a) {
        if (inside) nested.push(a['data-term']);
        terms.add(a['data-term']);
        pieces.push({ text: ' ', kind: 'body', introduce: a['data-term'] });
        return;
      }
    }
    let next = ctx;
    if (name === 'svg' || (n.attributes && 'data-fig' in n.attributes)) next = 'svg';
    else if (ctx !== 'svg' && (/^h[1-6]$/.test(name) || (n.attributes && 'data-title' in n.attributes))) next = 'exempt';
    if (BLOCK.has(name)) pieces.push({ text: ' ', kind: ctx });
    const inner = inside || name === 'a' || name === 'button';
    for (const c of n.children ?? []) walk(c, next, inner);
    if (BLOCK.has(name)) pieces.push({ text: ' ', kind: ctx });
  };
  walk(doc, 'body');

  const stream = pieces.map((p) => p.text).join('');
  // Where each piece starts in the stream, so a match knows what kind of text it is in.
  const starts = [];
  let at = 0;
  for (const p of pieces) {
    starts.push(at);
    at += p.text.length;
  }
  const kindAt = (i) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= i) lo = mid;
      else hi = mid - 1;
    }
    return pieces[lo];
  };
  const introducedAt = new Map(); // term -> stream index where it was explained or wrapped
  pieces.forEach((p, i) => p.introduce && !introducedAt.has(p.introduce) && introducedAt.set(p.introduce, starts[i]));
  const spelledOut = (g, i, matchLen) => {
    // A full name that contains the term, written out in place ("ASTM International").
    if (g.full && g.full.toLowerCase().startsWith(g.term.toLowerCase()) && stream.slice(i, i + g.full.length).toLowerCase() === g.full.toLowerCase()) return true;
    if (g.full) {
      const before = stream.slice(Math.max(0, i - g.full.length - 12), i);
      return new RegExp(`${esc(g.full)}(?:s|es)?\\s*\\($`, 'i').test(before);
    }
    const after = stream.slice(i + matchLen, i + matchLen + 6);
    return /^\s*\(|^,\s+(a|an|the)\s/i.test(after);
  };
  // First pass: where each term is explained in body text.
  const explainedAnywhere = new Set(terms);
  for (const m of stream.matchAll(termRe)) {
    const g = byTerm.get(m[1]);
    if (kindAt(m.index).kind === 'body' && spelledOut(g, m.index, m[0].length)) {
      explainedAnywhere.add(g.term);
      if (!introducedAt.has(g.term) || introducedAt.get(g.term) > m.index) introducedAt.set(g.term, m.index);
    }
  }
  const problems = nested.map((t) => ({ term: t, where: 'a link or button (a <Term> cannot sit inside one)', context: t }));
  const seen = new Set();
  for (const m of stream.matchAll(termRe)) {
    const g = byTerm.get(m[1]);
    const kind = kindAt(m.index).kind;
    if (seen.has(g.term)) continue;
    if (kind === 'exempt') continue;
    if (kind === 'svg') {
      if (!explainedAnywhere.has(g.term)) {
        problems.push({ term: g.term, where: 'a drawing', context: stream.slice(Math.max(0, m.index - 30), m.index + 40) });
        seen.add(g.term);
      }
      continue;
    }
    const intro = introducedAt.get(g.term);
    if (intro !== undefined && intro <= m.index) {
      seen.add(g.term);
      continue;
    }
    problems.push({ term: g.term, where: 'text', context: stream.slice(Math.max(0, m.index - 40), m.index + 40).replace(/\s+/g, ' ') });
    seen.add(g.term);
  }
  return problems;
}

let total = 0;
const files = globSync(`${DIST}/**/*.html`).sort();
for (const f of files) {
  const probs = scan(f);
  if (!probs.length) continue;
  total += probs.length;
  const page = f.replace(DIST, '').replace(/index\.html$/, '');
  for (const p of probs) console.log(`  ${page}  ${p.term}  (first use in ${p.where}, not explained): "${p.context.trim()}"`);
}
if (total) {
  console.log(`\ncheck-terms: ${total} term(s) used before they are explained. Spell out the first use as "full name (TERM)", or wrap it in <Term>.`);
  process.exit(1);
}
console.log(`check-terms clean (${files.length} pages, ${glossary.length} terms).`);
