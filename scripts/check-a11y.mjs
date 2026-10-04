// Runs axe-core over every built page and fails on any violation.
// Passes: dark and light at desktop width, dark and light at phone width. On the phone passes the
// menu is opened and scanned too, so that state is covered as well as the server-rendered page.
// Pages load with reduced motion so scroll reveals do not hide content from the scan, and nothing
// off this machine (the analytics beacon, for one) is requested.
// Run after a build: `npm run build && npm run test:a11y`. CI runs it before every deploy.
// Needs Playwright's Chromium (`npx playwright install chromium`), or set CHROMIUM_PATH to a Chromium binary.
import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { serveDist, localOnly } from './lib/serve-dist.mjs';

const require = createRequire(import.meta.url);
const AXE = await readFile(require.resolve('axe-core/axe.min.js'), 'utf8');
const DIST = 'dist';
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
const PASSES = [
  { name: 'dark, desktop', colorScheme: 'dark', viewport: { width: 1280, height: 900 } },
  { name: 'light, desktop', colorScheme: 'light', viewport: { width: 1280, height: 900 } },
  { name: 'dark, phone', colorScheme: 'dark', viewport: { width: 390, height: 844 } },
  { name: 'light, phone', colorScheme: 'light', viewport: { width: 390, height: 844 } },
];

const { server, base } = serveDist(DIST);

async function pages(dir = DIST, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await pages(p, out);
    else if (e.name.endsWith('.html')) out.push('/' + relative(DIST, p).replaceAll('\\', '/').replace(/index\.html$/, ''));
  }
  return out.sort();
}
const list = await pages();

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
let problems = 0;
let scans = 0;

async function scan(page, label) {
  scans++;
  const violations = await page.evaluate(async (tags) => {
    const result = await window.axe.run(document, { runOnly: { type: 'tag', values: tags } });
    return result.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
  }, TAGS);
  for (const v of violations) {
    problems++;
    console.log(`${label}\n  [${v.impact}] ${v.id}: ${v.help}\n    ${v.targets.join('\n    ')}`);
  }
}

for (const pass of PASSES) {
  const ctx = await browser.newContext({ colorScheme: pass.colorScheme, viewport: pass.viewport, reducedMotion: 'reduce' });
  await ctx.route(...localOnly(base));
  const page = await ctx.newPage();
  for (const path of list) {
    await page.goto(base + path, { waitUntil: 'networkidle' });
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
    }, pass.colorScheme);
    await page.addScriptTag({ content: AXE });
    await scan(page, `${pass.name}  ${path}`);

    // The phone menu is a closed <details> until someone opens it.
    const menuOpened = await page.evaluate(() => {
      const menu = document.querySelector('details[data-mnav]');
      if (!menu || getComputedStyle(menu).display === 'none') return false;
      menu.open = true;
      return true;
    });
    if (menuOpened) await scan(page, `${pass.name}, menu open  ${path}`);
  }
  await ctx.close();
}
await browser.close();
server.close();

if (problems) {
  console.error(`\ntest:a11y found ${problems} violation(s).`);
  process.exit(1);
}
console.log(`test:a11y clean (${list.length} pages, ${scans} scans).`);
