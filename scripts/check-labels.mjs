// Fails if any figure label runs out of its box. Loads every built page at 320, 390, 768, 1366, 1440, 1920 and 2560,
// light and dark, opens every figure view (Live, Drawing, How it works, Code), every V2V stage,
// every About pin and every RAMpage plow status, and measures:
//   - SVG text against the shape it sits in (rect, circle, ellipse, polygon or closed path): any
//     label that crosses the shape's edge or comes within 4px of it across (1px up and down, since
//     the measured box already includes the font's ascent and descent),
//   - SVG text against other SVG text: any two labels that overlap,
//   - SVG text against straight lines it is not part of (in another group),
//   - SVG text clipped by its viewBox,
//   - HTML text (chips, legends, tooltips, buttons) that runs out of its own box.
// Writes what it finds to audit/label-overflow.md and exits 1 if the list is not empty.
// Run after a build: `npm run build && node scripts/check-labels.mjs`. test:a11y runs it too.
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { chromium } from 'playwright';
import { LAPTOP } from './lib/viewports.mjs';
import { labelsInPage } from './lib/page-checks.mjs';
import { serveDist, localOnly } from './lib/serve-dist.mjs';

const DIST = 'dist';
const WIDTHS = (process.env.LABEL_WIDTHS || '320,390,768,1366,1440,1920,2560').split(',').map(Number);
// The widths above at 900 tall, then the laptop sizes display scaling gives (scripts/lib/viewports.mjs).
const VIEWPORTS = [...WIDTHS.map((w) => ({ label: String(w), width: w, height: 900, dpr: 1 })), ...(process.env.LABEL_WIDTHS ? [] : LAPTOP)];
const THEMES = (process.env.LABEL_THEMES || 'light,dark').split(',');
const ONLY = process.env.LABEL_PAGES ? process.env.LABEL_PAGES.split(',') : null;
const PLOW = ['Ready', 'Filling', 'Plow out', 'Venting', 'Settling', 'Out of air'];

async function pages(dir = DIST, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await pages(p, out);
    else if (e.name.endsWith('.html')) out.push('/' + relative(DIST, p).replaceAll('\\', '/').replace(/index\.html$/, ''));
  }
  return out.sort();
}

// The check itself lives in scripts/lib/page-checks.mjs (the sweep runs it too).
const measure = labelsInPage;

const { server, base } = serveDist(DIST);
const list = (await pages()).filter((p) => !ONLY || ONLY.includes(p));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const found = new Map();

const record = (path, width, theme, state, items) => {
  for (const it of items) {
    const key = [path, width, theme, it.fig, it.label, it.kind].join('|');
    const prev = found.get(key);
    if (!prev || prev.px < it.px) found.set(key, { path, width, theme, state, ...it });
  }
};

for (const theme of THEMES) {
  for (const vp of VIEWPORTS) {
    const width = vp.label;
    const ctx = await browser.newContext({ colorScheme: theme, viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dpr, reducedMotion: 'reduce' });
    await ctx.route(...localOnly(base));
    const page = await ctx.newPage();
    for (const path of list) {
      await page.goto(base + path, { waitUntil: 'networkidle' });
      await page.evaluate((t) => (document.documentElement.dataset.theme = t), theme);
      await page.evaluate(() => document.fonts.ready);
      const run = async (state) => record(path, width, theme, state, await page.evaluate(measure));
      await run('page');

      for (const view of ['drawing', 'how', 'code', 'live']) {
        const n = await page.evaluate((v) => {
          const tabs = document.querySelectorAll(`[data-fc] [role="tab"][data-view="${v}"]`);
          tabs.forEach((t) => t.click());
          return tabs.length;
        }, view);
        if (n) await run(`${view} view`);
      }
      const small = await page.evaluate(() => {
        const tabs = document.querySelectorAll('[data-tabs] [role="tab"]:last-child');
        tabs.forEach((t) => t.click());
        return tabs.length;
      });
      if (small) await run('second tabs');

      const stages = await page.locator('.cf__stage').count();
      for (let i = 0; i < stages; i++) {
        await page.locator('.cf__stage').nth(i).click();
        await run(`V2V stage ${i + 1}`);
      }
      const pins = await page.locator('[data-pin]').count();
      for (let i = 0; i < pins; i++) {
        await page.evaluate((k) => document.querySelector(`[data-pin="${k}"]`).click(), i);
        await run(`pin ${i + 1}`);
      }
      if (await page.locator('[data-tf-state]').count()) {
        for (const word of PLOW) {
          await page.evaluate((w) => {
            document.querySelectorAll('[data-tf-state], [data-pn-status]').forEach((e) => (e.textContent = w));
            document.querySelectorAll('[data-pn-exhaust], [data-pn-inlets]').forEach((e) => (e.textContent = 'closed'));
          }, word);
          await run(`plow ${word}`);
        }
      }
    }
    await ctx.close();
  }
}
await browser.close();
server.close();

const rows = [...found.values()].sort((a, b) => b.px - a.px);
await mkdir('audit', { recursive: true });
const md = [
  '# Label overflow',
  '',
  `Measured ${new Date().toISOString().slice(0, 10)}: ${list.length} pages at ${VIEWPORTS.map((v) => v.label).join(', ')}, ${THEMES.join(' and ')}, every figure view, V2V stage, About pin and plow status. Rule: no label crosses its box or comes within 4px of it across (1px up and down), overlaps another label or a line it is not part of, or is clipped; no HTML text runs out of its box.`,
  '',
  rows.length ? '| Page | Width | Theme | Figure | Label | Problem | px over | Seen in |' : 'Nothing found.',
  ...(rows.length ? ['|---|---|---|---|---|---|---|---|'] : []),
  ...rows.map((r) => `| ${r.path} | ${r.width} | ${r.theme} | ${r.fig.replaceAll('|', '/')} | ${r.label.replaceAll('|', '/')} | ${r.kind.replaceAll('|', '/')} | ${r.px} | ${r.state} |`),
  '',
].join('\n');
await writeFile('audit/label-overflow.md', md);

if (rows.length) {
  console.error(`check-labels: ${rows.length} label problem(s); see audit/label-overflow.md.`);
  process.exit(1);
}
console.log(`check-labels clean (${list.length} pages, ${VIEWPORTS.length} viewports, ${THEMES.length} themes).`);
