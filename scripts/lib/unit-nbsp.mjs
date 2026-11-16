// An Astro integration: after the build, every value and its unit in the pages' text get a no-break
// space between them ("1.3 km", "20 dB", "1500 m/s"), so a line never breaks between a number and its
// unit. It rewrites text only: never inside a tag, a script, a style, code, pre or a textarea.
// Readouts written by scripts at run time put in their own no-break spaces.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Units of measure that follow a number on this site. Longest first, so "km" wins over "m".
const UNITS = ['kg/m³', 'g/cm³', 'm/s', 'km/h', 'kHz', 'MHz', 'GHz', 'Hz', 'dB', 'km', 'cm', 'mm', 'ms', 'µs', 'kg', 'lbf', 'psi', 'KB', 'MB', 'GB', 'fps', 'ac', '°C', 'm', 's', 'g', '%'];
const esc = (u) => u.replace(/[/.*+?^${}()|[\]\\]/g, '\\$&');
// A digit, one ordinary space, a unit, and then no letter or digit (so "5 sisters" or "2 meters" stay).
export const UNIT_RE = new RegExp(`(\\d) (${UNITS.map(esc).join('|')})(?![\\p{L}\\p{N}])`, 'gu');

const SKIP = /^<(script|style|code|pre|textarea)\b/i;
const END = (tag) => new RegExp(`^</${tag}\\s*>`, 'i');

export function glueUnits(html) {
  const parts = html.split(/(<[^>]*>)/);
  let skipping = null;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.startsWith('<')) {
      if (skipping) {
        if (END(skipping).test(part)) skipping = null;
      } else {
        const m = part.match(SKIP);
        if (m && !part.endsWith('/>')) skipping = m[1].toLowerCase();
      }
      continue;
    }
    if (!skipping && part) parts[i] = part.replace(UNIT_RE, '$1&nbsp;$2');
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
