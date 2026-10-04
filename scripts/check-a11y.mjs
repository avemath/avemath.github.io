// Runs axe-core over every built page, in both themes and at a phone width, and fails on any violation.
// Run after a build: `npm run build && npm run test:a11y`. CI runs it before every deploy.
// Needs Playwright's Chromium (`npx playwright install chromium`), or set CHROMIUM_PATH to a Chromium binary.
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { join, extname, relative } from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const AXE = await readFile(require.resolve('axe-core/axe.min.js'), 'utf8');
const DIST = 'dist';
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json' };
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
const PASSES = [
  { name: 'dark, desktop', colorScheme: 'dark', viewport: { width: 1280, height: 900 } },
  { name: 'light, desktop', colorScheme: 'light', viewport: { width: 1280, height: 900 } },
  { name: 'dark, phone', colorScheme: 'dark', viewport: { width: 390, height: 844 } },
];

const server = createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.endsWith('/')) path += 'index.html';
  try {
    const body = await readFile(join(DIST, path));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

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
for (const pass of PASSES) {
  const ctx = await browser.newContext({ colorScheme: pass.colorScheme, viewport: pass.viewport, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  for (const path of list) {
    await page.goto(base + path, { waitUntil: 'networkidle' });
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
    }, pass.colorScheme);
    await page.addScriptTag({ content: AXE });
    const violations = await page.evaluate(async (tags) => {
      const result = await window.axe.run(document, { runOnly: { type: 'tag', values: tags } });
      return result.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
    }, TAGS);
    for (const v of violations) {
      problems++;
      console.log(`${pass.name}  ${path}\n  [${v.impact}] ${v.id}: ${v.help}\n    ${v.targets.join('\n    ')}`);
    }
  }
  await ctx.close();
}
await browser.close();
server.close();

if (problems) {
  console.error(`\ntest:a11y found ${problems} violation(s).`);
  process.exit(1);
}
console.log(`test:a11y clean (${list.length} pages × ${PASSES.length} passes).`);
