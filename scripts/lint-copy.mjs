// Fails the build if site copy breaks the writing rules in docs/CONTENT-GUIDE.md.
// Run with `npm run lint:copy`. CI runs it before every deploy.
import { readdir, readFile } from 'node:fs/promises';
import { join, extname, relative } from 'node:path';

const ROOTS = ['src', 'public', 'docs', 'scripts', 'README.md', 'astro.config.mjs', '.github'];
const TEXT = new Set(['.astro', '.md', '.mdx', '.ts', '.js', '.mjs', '.json', '.css', '.html', '.txt', '.yml', '.yaml', '.svg', '.xml']);
const SELF = 'scripts/lint-copy.mjs';
// Tool names that should never appear in site copy or comments (base64 so this file stays clean too).
const TOOLS = ['Y2xhdWRl', 'YW50aHJvcGlj', 'Y2hhdGdwdA==', 'b3BlbmFp', 'Y29waWxvdA=='].map((s) => atob(s));

const rules = [
  { name: 'em dash', test: /—/ },
  { name: 'en dash (use "to" for ranges)', test: /–/ },
  { name: 'filler phrase', test: /\b(passionate about|leverag(e|ing)|cutting[- ]edge|seamless(ly)?|in today's fast[- ]paced|I'm excited to|delve|synerg(y|ies))\b/i },
  { name: 'tool attribution', test: new RegExp(`\\b(${TOOLS.join('|')})\\b`, 'i') },
];

async function walk(path, out = []) {
  let entries;
  try {
    entries = await readdir(path, { withFileTypes: true });
  } catch {
    out.push(path);
    return out;
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.astro')) continue;
    const p = join(path, e.name);
    if (e.isDirectory()) await walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = (await Promise.all(ROOTS.map((r) => walk(r)))).flat();
let problems = 0;

for (const file of files) {
  const rel = relative('.', file).replaceAll('\\', '/');
  if (rel === SELF || !TEXT.has(extname(file))) continue;
  let text;
  try {
    text = await readFile(file, 'utf8');
  } catch {
    continue;
  }
  text.split('\n').forEach((line, i) => {
    // A line that quotes the rules on purpose can opt out with this marker.
    if (line.includes('lint-copy-ignore')) return;
    for (const rule of rules) {
      if (rule.test.test(line)) {
        problems++;
        console.log(`${rel}:${i + 1}  ${rule.name}: ${line.trim().slice(0, 120)}`);
      }
    }
  });
}

if (problems) {
  console.error(`\nlint:copy found ${problems} problem(s).`);
  process.exit(1);
}
console.log(`lint:copy clean (${files.length} files checked).`);
