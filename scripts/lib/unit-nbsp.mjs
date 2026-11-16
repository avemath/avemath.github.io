// An Astro integration: after the build, every value and its unit in the pages' text are joined so a
// line never breaks between them ("1.3 km", "20 dB", "1500 m/s"). In ordinary text the pair is
// wrapped in <span class="nu"> (white-space: nowrap in global.css), which holds even where long words
// may break anywhere; inside SVG text, an option or a title, where a span cannot go, the space
// becomes a no-break space. It rewrites text only: never inside a tag, a script, a style, code, pre
// or a textarea. Readouts written by scripts at run time put in their own no-break spaces.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Units of measure that follow a number on this site. Longest first, so "km" wins over "m".
const UNITS = ['kg/m³', 'g/cm³', 'm/s', 'km/h', 'kHz', 'MHz', 'GHz', 'Hz', 'dB', 'km', 'cm', 'mm', 'ms', 'µs', 'kg', 'lbf', 'psi', 'KB', 'MB', 'GB', 'fps', 'ac', '°C', 'm', 's', 'g', '%'];
const esc = (u) => u.replace(/[/.*+?^${}()|[\]\\]/g, '\\$&');
// A whole number (not the tail of a word), one space (ordinary or already no-break), a unit, and then
// no letter or digit (so "5 sisters" or "2 meters" stay as they are).
export const UNIT_RE = new RegExp(`(?<![\\p{L}\\p{N}.,])(\\d[\\d.,]*)(?: |&nbsp;|\\u00a0)(${UNITS.map(esc).join('|')})(?![\\p{L}\\p{N}])`, 'gu');

const SKIP = /^<(script|style|code|pre|textarea)\b/i;
const END = (tag) => new RegExp(`^</${tag}\\s*>`, 'i');

export function glueUnits(html) {
  const parts = html.split(/(<[^>]*>)/);
  let skipping = null;
  let svg = 0;
  let plain = 0; // inside an option or a title: text only, no spans
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.startsWith('<')) {
      if (skipping) {
        if (END(skipping).test(part)) skipping = null;
        continue;
      }
      const m = part.match(SKIP);
      if (m && !part.endsWith('/>')) skipping = m[1].toLowerCase();
      else if (/^<svg\b/i.test(part) && !part.endsWith('/>')) svg++;
      else if (/^<\/svg\s*>/i.test(part)) svg = Math.max(0, svg - 1);
      else if (/^<(option|title)\b/i.test(part)) plain++;
      else if (/^<\/(option|title)\s*>/i.test(part)) plain = Math.max(0, plain - 1);
      continue;
    }
    if (skipping || !part) continue;
    parts[i] = svg || plain ? part.replace(UNIT_RE, '$1&nbsp;$2') : part.replace(UNIT_RE, '<span class="nu">$1&nbsp;$2</span>');
  }
  return parts.join('');
}

async function* htmlFiles(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* htmlFiles(p);
    else if (e.name.endsWith('.html')) yield p;
  }
}

export default function unitNbsp() {
  return {
    name: 'unit-nbsp',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        let files = 0;
        for await (const f of htmlFiles(fileURLToPath(dir))) {
          const before = await readFile(f, 'utf8');
          const after = glueUnits(before);
          if (after !== before) {
            await writeFile(f, after);
            files++;
          }
        }
        logger.info(`glued values to their units in ${files} pages`);
      },
    },
  };
}
