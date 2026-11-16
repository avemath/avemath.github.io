// The sweep: the site at every screen size, not a list of sizes. It runs the fit, no-cover and label
// checks (scripts/lib/page-checks.mjs) across:
//   - every page, widths 320 to 2560 every 40px, at heights 640 and 900 (light);
//   - the components that change layout, each checked on its own, widths 320 to 1920 every 8px
//     (light and dark);
//   - short and landscape screens: 568x320, 667x375, 844x390, 1024x600 and 1280x600;
//   - browser zoom 100, 125, 150 and 200% at 1280x720 and 1920x1080 (zoom is a smaller CSS viewport
//     at a higher pixel density);
//   - a browser minimum font size of 20px (people who enlarge text), at 390 and 1280.
// Widths step by resizing the open page, so a job loads its page once. Jobs run on SWEEP_WORKERS
// browsers at once (default 5). Failures are grouped by page or component and problem, with the
// width ranges where each one breaks.
// Run after a build: `npm run test:sweep` (in the background, with a 60-minute cap). It takes about
// the time printed at the end. SWEEP_ONLY=pages,components,short,zoom,font limits the parts.
import { readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { serveDist, localOnly } from '../scripts/lib/serve-dist.mjs';
import { fitInPage, coverInPage, labelsInPage } from '../scripts/lib/page-checks.mjs';

type Job = { part: string; path: string; root?: string; name: string; widths: number[]; height: number; dpr: number; theme: 'light' | 'dark'; minFont?: number };
type Fail = { group: string; problem: string; where: string; width: number };

const started = Date.now();
const range = (a: number, b: number, step: number) => Array.from({ length: Math.floor((b - a) / step) + 1 }, (_, i) => a + i * step);

const pages: string[] = ['/404.html'];
const walk = (dir: string, url: string) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === '_astro' || name === 'media' || name === 'og') continue;
      walk(p, `${url}${name}/`);
    } else if (name === 'index.html') pages.push(url);
  }
};
walk('dist', '/');

// The components that change layout with their width, each with the selector that holds it.
const COMPONENTS: [string, string, string][] = [
  ['/about/', '#datasheet', 'About datasheet'],
  ['/research/', '#bellhop .rfig', 'Ray tracer (Fig. R3)'],
  ['/research/', '#below .rfig', 'Sound race (Fig. R0)'],
  ['/work/signals-playground/', '.sig', 'Signals playground controls'],
  ['/work/rampage/', '#rampage', 'RAMpage timing figure'],
  ['/work/', '.bench-wrap', 'Workbench and its detail'],
  ['/work/', '[data-tmap]', 'Thread map'],
  ['/', '#top', 'Home hero'],
  ['/work/bellhop-sim/', '#gallery', 'Case study gallery'],
  ['/services/', '.prints', 'Services prints'],
  ['/', '#websites', 'Website showcase'],
];

const only = process.env.SWEEP_ONLY?.split(',');
const want = (part: string) => !only || only.includes(part);
const jobs: Job[] = [];
if (want('pages')) for (const path of pages) for (const height of [640, 900]) jobs.push({ part: 'pages', path, name: path, widths: range(320, 2560, 40), height, dpr: 1, theme: 'light' });
if (want('components'))
  for (const [path, root, name] of COMPONENTS) for (const theme of ['light', 'dark'] as const) jobs.push({ part: 'components', path, root, name, widths: range(320, 1920, 8), height: 900, dpr: 1, theme });
if (want('short'))
  for (const path of pages) for (const [w, h] of [[568, 320], [667, 375], [844, 390], [1024, 600], [1280, 600]]) jobs.push({ part: 'short', path, name: path, widths: [w], height: h, dpr: 1, theme: 'light' });
if (want('zoom'))
  for (const path of pages)
    for (const [w, h] of [[1280, 720], [1920, 1080]])
      for (const z of [1, 1.25, 1.5, 2]) jobs.push({ part: `zoom ${Math.round(z * 100)}% of ${w}x${h}`, path, name: path, widths: [Math.round(w / z)], height: Math.round(h / z), dpr: z, theme: 'light' });
if (want('font')) for (const path of pages) for (const w of [390, 1280]) jobs.push({ part: 'min font 20px', path, name: path, widths: [w], height: 900, dpr: 1, theme: 'light', minFont: 20 });

const { server, base } = serveDist('dist');
const [match, handler] = localOnly(base);
const fails: Fail[] = [];
let checks = 0;

// A page as a reader has it: fonts in, every section laid out, at the top.
const settle = async (page: Page) =>
  page.evaluate(async () => {
    await document.fonts.ready;
    document.documentElement.classList.add('cv-off');
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });

async function runJob(ctx: BrowserContext, job: Job) {
  const page = await ctx.newPage();
  await page.route(match, handler);
  await page.setViewportSize({ width: job.widths[0], height: job.height });
  await page.goto(`${base}${job.path}`, { waitUntil: 'networkidle' });
  for (const w of job.widths) {
    await page.setViewportSize({ width: w, height: job.height });
    await settle(page);
    if (job.root) {
      // The component on screen, as a reader would look at it.
      const there = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        el?.scrollIntoView({ block: 'start', behavior: 'instant' as ScrollBehavior });
        return !!el;
      }, job.root);
      if (!there) {
        fails.push({ group: job.name, problem: `${job.root} is missing`, where: job.part, width: w });
        break;
      }
    }
    const where = `${job.part}${job.part === 'pages' || job.part === 'components' ? `, ${job.height} tall` : ''}${job.theme === 'dark' ? ', dark' : ''}`;
    const add = (problem: string) => fails.push({ group: job.name, problem, where, width: w });
    for (const m of (await page.evaluate(fitInPage, job.root)) as string[]) add(m);
    for (const l of (await page.evaluate(labelsInPage, job.root)) as { fig: string; label: string; kind: string }[]) add(`label: ${l.fig}: "${l.label}" ${l.kind}`);
    for (const h of (await page.evaluate(coverInPage, job.root)) as { kind: string; what: string; by: string }[]) add(`covered: ${h.kind} ${h.what} by ${h.by}`);
    checks++;
  }
  await page.close();
}

async function worker(id: number, queue: Job[]) {
  const browsers: Browser[] = [];
  const contexts = new Map<string, BrowserContext>();
  // One browser for the plain jobs; one persistent profile with a 20px minimum font for the font jobs.
  const context = async (job: Job) => {
    const key = `${job.theme}|${job.dpr}|${job.minFont ?? 0}`;
    if (contexts.has(key)) return contexts.get(key)!;
    let ctx: BrowserContext;
    const opts = { colorScheme: job.theme, deviceScaleFactor: job.dpr, reducedMotion: 'reduce' as const };
    if (job.minFont) {
      const dir = join(tmpdir(), `sweep-font-${id}-${process.pid}`);
      mkdirSync(join(dir, 'Default'), { recursive: true });
      writeFileSync(join(dir, 'Default', 'Preferences'), JSON.stringify({ webkit: { webprefs: { minimum_font_size: job.minFont, minimum_logical_font_size: job.minFont } } }));
      // The minimum font size is a profile preference, which only the full Chromium build (not the
      // headless shell) reads; it is Playwright's own download, next to the shell.
      const full = process.env.CHROMIUM_FULL || chromium.executablePath().replace(/chromium_headless_shell-(\d+)\/chrome-headless-shell-linux64\/chrome-headless-shell$/, 'chromium-$1/chrome-linux64/chrome');
      ctx = await chromium.launchPersistentContext(dir, { ...opts, executablePath: full, args: ['--headless=new'], ignoreDefaultArgs: ['--hide-scrollbars'] });
    } else {
      if (!browsers.length) browsers.push(await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, ignoreDefaultArgs: ['--hide-scrollbars'] }));
      ctx = await browsers[0].newContext(opts);
    }
    contexts.set(key, ctx);
    return ctx;
  };
  for (let job = queue.shift(); job; job = queue.shift()) {
    try {
      await runJob(await context(job), job);
    } catch (e) {
      fails.push({ group: job.name, problem: `the check could not run: ${String(e).split('\n')[0].slice(0, 120)}`, where: job.part, width: job.widths[0] });
    }
  }
  for (const c of contexts.values()) await c.close();
  for (const b of browsers) await b.close();
}

// The biggest jobs first, so the workers finish together.
const queue = [...jobs].sort((a, b) => b.widths.length - a.widths.length);
const WORKERS = Number(process.env.SWEEP_WORKERS || 5);
try {
  await Promise.all(Array.from({ length: WORKERS }, (_, i) => worker(i, queue)));
} finally {
  server.close();
}

// ---- Report: by page or component, then by problem, with the width ranges where it breaks ----
const ranges = (ws: number[]) => {
  const s = [...new Set(ws)].sort((a, b) => a - b);
  const out: string[] = [];
  for (let i = 0; i < s.length; ) {
    let j = i;
    while (j + 1 < s.length && s[j + 1] - s[j] <= 40) j++;
    out.push(i === j ? `${s[i]}` : `${s[i]} to ${s[j]}`);
    i = j + 1;
  }
  return out.join(', ');
};
// The same problem at different sizes reads the same: numbers in brackets and pixel counts dropped.
const norm = (p: string) => p.replace(/\s*\([^)]*\)/g, '').replace(/\b\d+(\.\d+)?px\b/g, 'Npx').replace(/at \d+,\d+/g, '');
const groups = new Map<string, Map<string, Map<string, number[]>>>();
for (const f of fails) {
  const g = groups.get(f.group) ?? new Map();
  groups.set(f.group, g);
  const k = norm(f.problem);
  const w = g.get(k) ?? new Map();
  g.set(k, w);
  w.set(f.where, [...(w.get(f.where) ?? []), f.width]);
}
const minutes = ((Date.now() - started) / 60000).toFixed(1);
const lines: string[] = [];
for (const [group, probs] of groups) {
  lines.push(`\n${group}`);
  for (const [prob, where] of probs) lines.push(`  ${prob}\n    ${[...where].map(([w, ws]) => `${w}: ${ranges(ws)}`).join('; ')}`);
}
mkdirSync('audit', { recursive: true });
writeFileSync('audit/sweep.md', `# Sweep, ${new Date().toISOString().slice(0, 16).replace('T', ' ')}\n\n${checks} checks in ${minutes} minutes, ${jobs.length} jobs on ${WORKERS} workers.\n${fails.length ? lines.join('\n') : '\nNothing to report.'}\n`);
if (fails.length) {
  console.log(lines.join('\n'));
  console.log(`\nsweep: ${groups.size} page(s) or component(s) with problems; ${checks} checks in ${minutes} minutes (see audit/sweep.md).`);
  process.exit(1);
}
console.log(`sweep clean: ${checks} checks across ${jobs.length} jobs in ${minutes} minutes.`);
